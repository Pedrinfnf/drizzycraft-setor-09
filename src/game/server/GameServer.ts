import { DiddyAiController } from '../ai';
import { getDifficultyConfig } from '../difficulty';
import {
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  generateMansionLayout,
  gridToWorld,
  hasWallLineOfSight,
  isPositionInVent,
  resolveWorldMovement,
  type MansionLayout,
} from '../mansionMap';
import type {
  DiddyAiState,
  Difficulty,
  EndingId,
  FloorId,
  ItemType,
  NoiseEvent,
  PerkId,
} from '../types';
import {
  BROADCAST_INTERVAL_TICKS,
  KEY_PROGRESSION_ITEMS,
  LAG_COMP_HISTORY_TICKS,
  SELF_HEAL_SNAPSHOT_TICKS,
  SERVER_MAX_FRAME_DT,
  SERVER_TICK_SEC,
  type ClientIntent,
  type CompactDeltaPacket,
  type DiddyServerState,
  type DoorServerState,
  type GameWorldState,
  type IntentResult,
  type MoveInputIntent,
  type PlayerPlatformId,
  type PlayerState,
  type ServerEvent,
  type WorldItemServerState,
} from './types';

interface QueuedIntent {
  playerId: string;
  intent: ClientIntent;
  resolve?: (res: IntentResult) => void;
}

interface LagCompFrame {
  tick: number;
  diddyX: number;
  diddyY: number;
  diddyZ: number;
  diddyFloor: FloorId;
  players: Map<string, { x: number; y: number; z: number; floor: FloorId; alive: boolean }>;
}

const DIDDY_STATE_LIST: readonly DiddyAiState[] = [
  'patrol',
  'investigate',
  'chase',
  'inspecting_hiding',
  'search_hiding',
  'stunned',
];

const KEY_ITEM_SET = new Set<ItemType>(KEY_PROGRESSION_ITEMS);

/** Basement holding cell spawn where captured multiplayer allies await rescue */
export const BASEMENT_CELL_POS = {
  x: gridToWorld(17.5),
  y: FLOOR_MINUS_1_Y,
  z: gridToWorld(15.5),
  floor: -1 as FloorId,
};

/**
 * Deterministic Authoritative GameServer (10ms / 100Hz fixed timestep).
 * Identical instance powers BOTH Solo Mode (1 local client @ 0ms) and Online Multiplayer (2-5 clients).
 * - Zero object allocations inside stepTick() hot path (pre-allocated ring buffer & noise scratch).
 * - FIFO Intent queue prevents item duplication & door exploits.
 * - 300ms (30-tick) Lag Compensation Ring Buffer for Stun Gun & Capture hitboxes.
 * - Auto-drops key progression items on disconnect or capture (Anti-Softlock).
 * - Exportable/restorable snapshot for seamless Host Migration & 2s self-heal snapshots.
 */
export class GameServer {
  public readonly layout: MansionLayout;
  public readonly state: GameWorldState;
  private readonly ai: DiddyAiController;

  private accumulatorSec = 0;
  private intentQueue: QueuedIntent[] = [];
  private noiseScratch: NoiseEvent[] = [];
  private latestMoveInputs = new Map<string, MoveInputIntent>();
  private eventLog: ServerEvent[] = [];

  // Pre-allocated 30-slot (300ms) Lag Compensation Ring Buffer (0 allocations in tick loop)
  private readonly historyRing: LagCompFrame[];
  private historyCursor = 0;

  // Delta tracking for compact 33Hz network broadcast
  private dirtyPlayers = new Set<string>();
  private dirtyDoors = new Set<string>();
  private dirtyItems = new Set<string>();
  private diddyDirty = true;
  private worldFlagsDirty = true;
  private ticksSinceBroadcast = 0;
  private ticksSinceSelfHeal = 0;

  public onBroadcastDelta: ((delta: CompactDeltaPacket) => void) | null = null;
  public onSelfHealSnapshot: ((snapshot: GameWorldState) => void) | null = null;
  public onServerEvent: ((ev: ServerEvent) => void) | null = null;

  constructor(seed: number, difficulty: Difficulty, existingState?: GameWorldState) {
    this.layout = generateMansionLayout(seed, difficulty);
    this.ai = new DiddyAiController();
    this.ai.reset(this.layout);

    this.historyRing = Array.from({ length: LAG_COMP_HISTORY_TICKS }, () => ({
      tick: -1,
      diddyX: 0,
      diddyY: 0,
      diddyZ: 0,
      diddyFloor: 0 as FloorId,
      players: new Map(),
    }));

    if (existingState) {
      this.state = JSON.parse(JSON.stringify(existingState)) as GameWorldState;
      this.syncLayoutFromState();
    } else {
      const items: Record<string, WorldItemServerState> = {};
      for (const it of this.layout.items) {
        items[it.id] = {
          id: it.id,
          itemType: it.itemType,
          floor: it.floor,
          x: it.x,
          y: it.y,
          z: it.z,
          collected: it.collected,
          insideSafe: Boolean(it.insideSafe),
          droppedByPlayer: Boolean(it.droppedByPlayer),
        };
      }
      const doors: Record<string, DoorServerState> = {};
      for (const d of this.layout.doors) {
        doors[d.id] = {
          id: d.id,
          isOpen: d.isOpen,
          isUnlocked: d.isUnlocked,
          locked: !d.isUnlocked,
          planksRemoved: Boolean(d.planksRemoved),
          electronicUnlocked: Boolean(d.electronicUnlocked),
        };
      }
      const lightSwitches: Record<string, boolean> = {};
      for (const sw of this.layout.lightSwitches) {
        lightSwitches[sw.id] = sw.isOn;
      }

      this.state = {
        tick: 0,
        serverTimeMs: Date.now(),
        seed,
        difficulty,
        elapsedSec: 0,
        phase: 'playing',
        endingId: null,
        players: {},
        diddy: {
          x: this.ai.x,
          y: this.ai.y,
          z: this.ai.z,
          yaw: this.ai.yaw,
          floor: this.ai.floor,
          state: this.ai.state,
          animState: this.ai.animState,
          stunnedTimer: 0,
          targetPlayerId: null,
        },
        items,
        doors,
        safeUnlocked: false,
        fuseInstalled: false,
        generatorFixed: false,
        blackoutActive: false,
        terminalUnlocked: false,
        hatchOpened: false,
        securityPowerPct: 100,
        fnafLeftClosed: false,
        fnafRightClosed: false,
        discoveredClueIds: [],
        discoveredUvMarkIds: [],
        listenedCassetteIds: [],
        translationBoardSeen: false,
        cctvSecretHintSeen: false,
        lightSwitches,
      };
    }
  }

  /**
   * Seamless Host Migration: restores a complete deterministic GameServer
   * from the last replicated GameWorldState snapshot without dropping the match.
   */
  static fromSnapshot(snapshot: GameWorldState): GameServer {
    return new GameServer(snapshot.seed, snapshot.difficulty, snapshot);
  }

  exportSnapshot(): GameWorldState {
    return JSON.parse(JSON.stringify(this.state)) as GameWorldState;
  }

  private syncLayoutFromState(): void {
    for (const d of this.layout.doors) {
      const ds = this.state.doors[d.id];
      if (ds) {
        d.isOpen = ds.isOpen;
        d.isUnlocked = ds.isUnlocked;
        d.planksRemoved = ds.planksRemoved;
        d.electronicUnlocked = ds.electronicUnlocked;
      }
    }
    this.layout.safe.unlocked = this.state.safeUnlocked;
    this.ai.x = this.state.diddy.x;
    this.ai.y = this.state.diddy.y;
    this.ai.z = this.state.diddy.z;
    this.ai.yaw = this.state.diddy.yaw;
    this.ai.floor = this.state.diddy.floor;
    this.ai.state = this.state.diddy.state;
  }

  addPlayer(params: {
    id: string;
    nickname: string;
    platform?: PlayerPlatformId;
    activePerks?: PerkId[];
  }): PlayerState {
    const existing = this.state.players[params.id];
    if (existing) {
      existing.connected = true;
      this.dirtyPlayers.add(params.id);
      return existing;
    }

    const diffCfg = getDifficultyConfig(this.state.difficulty);
    const perks = params.activePerks ? [...params.activePerks].slice(0, 3) : [];
    const maxBattery = perks.includes('extended_battery') ? 125 : 100;
    const flares = diffCfg.startingFlares + (perks.includes('omega_protocol') ? 1 : 0);
    const stunAmmo = perks.includes('spare_cartridge') ? 1 : 0;
    const inv: ItemType[] = ['flashlight'];
    if (flares > 0) inv.push('flare');

    // Offset slightly per player index so teammates never spawn overlapping
    const idx = Object.keys(this.state.players).length;
    const offsetX = ((idx % 3) - 1) * 0.55;
    const offsetZ = Math.floor(idx / 3) * 0.55;

    const p: PlayerState = {
      id: params.id,
      nickname: (params.nickname || 'Agente').trim().slice(0, 24) || 'Agente',
      platform: params.platform ?? 'pc',
      connected: true,
      alive: true,
      capturedInCell: false,
      spectating: false,
      x: this.layout.spawnPoint.x + offsetX,
      y: this.layout.spawnPoint.y,
      z: this.layout.spawnPoint.z + offsetZ,
      vx: 0,
      vz: 0,
      yaw: this.layout.spawnPoint.yaw,
      pitch: 0,
      floor: this.layout.spawnPoint.floor,
      crouching: false,
      inVent: false,
      sprinting: false,
      hidingSpotId: null,
      health: diffCfg.playerMaxHealth,
      maxHealth: diffCfg.playerMaxHealth,
      stamina: 100,
      staminaExhausted: false,
      battery: maxBattery,
      maxBattery,
      flashlightOn: true,
      uvMode: false,
      inventory: inv,
      activeSlot: 0,
      stunAmmo,
      throwables: 0,
      flares,
      activePerks: perks,
      lastProcessedSeq: 0,
      pingMs: 0,
      invulnerableTimer: 0,
      hitBoostTimer: 0,
      adrenalineBurstTimer: 0,
    };

    this.state.players[params.id] = p;
    this.dirtyPlayers.add(params.id);
    return p;
  }

  /**
   * Anti-Softlock: disconnecting player automatically drops all key progression items
   * on accessible ground so the remaining team can still finish every ending route.
   */
  removePlayer(playerId: string): void {
    const p = this.state.players[playerId];
    if (!p) return;
    p.connected = false;
    this.dropKeyItemsFromPlayer(p);
    this.dirtyPlayers.add(playerId);
  }

  private dropKeyItemsFromPlayer(p: PlayerState): void {
    const toDrop = p.inventory.filter((it) => KEY_ITEM_SET.has(it));
    if (toDrop.length === 0) return;

    p.inventory = p.inventory.filter((it) => !KEY_ITEM_SET.has(it));
    const dropFloor: FloorId = p.capturedInCell ? 0 : p.floor;
    const baseX = p.capturedInCell ? this.layout.spawnPoint.x : p.x;
    const baseY = dropFloor === -1 ? FLOOR_MINUS_1_Y : FLOOR_0_Y;
    const baseZ = p.capturedInCell ? this.layout.spawnPoint.z : p.z;

    for (let i = 0; i < toDrop.length; i++) {
      const itemType = toDrop[i];
      const dropId = `drop_${itemType}_${this.state.tick}_${i}`;
      const dropped: WorldItemServerState = {
        id: dropId,
        itemType,
        floor: dropFloor,
        x: baseX + (i % 3) * 0.32,
        y: baseY + 0.14,
        z: baseZ + Math.floor(i / 3) * 0.32,
        collected: false,
        insideSafe: false,
        droppedByPlayer: true,
      };
      this.state.items[dropId] = dropped;
      this.dirtyItems.add(dropId);
      this.emitEvent({ tick: this.state.tick, type: 'item_dropped', playerId: p.id, targetId: dropId, detail: itemType });
    }
  }

  enqueueIntent(playerId: string, intent: ClientIntent): Promise<IntentResult> {
    return new Promise<IntentResult>((resolve) => {
      this.intentQueue.push({ playerId, intent, resolve });
    });
  }

  enqueueIntentSync(playerId: string, intent: ClientIntent): void {
    this.intentQueue.push({ playerId, intent });
  }

  /**
   * Advances the deterministic 10ms fixed-timestep accumulator.
   * Clamps frameDt <= 0.1s to prevent mobile spiral-of-death.
   */
  advance(frameDtSec: number, nowMs: number = Date.now()): number {
    const clamped = Math.max(0, Math.min(SERVER_MAX_FRAME_DT, frameDtSec));
    this.accumulatorSec += clamped;
    let steps = 0;
    while (this.accumulatorSec + 1e-9 >= SERVER_TICK_SEC && steps < 10) {
      this.accumulatorSec = Math.max(0, this.accumulatorSec - SERVER_TICK_SEC);
      this.stepTick(nowMs);
      steps++;
    }
    return steps;
  }

  /**
   * Executes ONE deterministic 10ms (100Hz) authoritative simulation tick.
   */
  stepTick(nowMs: number = Date.now()): void {
    this.state.tick += 1;
    this.state.serverTimeMs = nowMs;

    if (this.state.phase !== 'playing') {
      // Drain any stale intents cleanly
      while (this.intentQueue.length > 0) {
        const q = this.intentQueue.shift()!;
        q.resolve?.({ ok: false, code: 'NOT_PLAYING' });
      }
      return;
    }

    this.state.elapsedSec += SERVER_TICK_SEC;
    this.noiseScratch.length = 0;

    // 1. Drain FIFO Intent Queue strictly in arrival order
    while (this.intentQueue.length > 0) {
      const q = this.intentQueue.shift()!;
      const res = this.processIntent(q.playerId, q.intent);
      q.resolve?.(res);
    }

    const diffCfg = getDifficultyConfig(this.state.difficulty);

    // 2. Step FNAF Security Power
    const closedCount = (this.state.fnafLeftClosed ? 1 : 0) + (this.state.fnafRightClosed ? 1 : 0);
    if (closedCount > 0) {
      this.state.securityPowerPct = Math.max(0, this.state.securityPowerPct - closedCount * 3.2 * SERVER_TICK_SEC);
      if (this.state.securityPowerPct <= 0) {
        this.state.fnafLeftClosed = false;
        this.state.fnafRightClosed = false;
        this.setDoorOpen('door_fnaf_left', true);
        this.setDoorOpen('door_fnaf_right', true);
      }
    } else if (!this.state.blackoutActive && this.state.securityPowerPct < 100) {
      this.state.securityPowerPct = Math.min(100, this.state.securityPowerPct + 0.85 * SERVER_TICK_SEC);
    }

    // 3. Step every player deterministically
    let closestTarget: PlayerState | null = null;
    let closestDistSq = Infinity;

    for (const pid of Object.keys(this.state.players)) {
      const p = this.state.players[pid];
      if (!p.connected || !p.alive || p.capturedInCell) continue;

      p.invulnerableTimer = Math.max(0, p.invulnerableTimer - SERVER_TICK_SEC);
      p.hitBoostTimer = Math.max(0, p.hitBoostTimer - SERVER_TICK_SEC);
      p.adrenalineBurstTimer = Math.max(0, p.adrenalineBurstTimer - SERVER_TICK_SEC);

      const move = this.latestMoveInputs.get(pid);
      let fwd = 0;
      let right = 0;
      let wantsSprint = false;
      if (move && !p.hidingSpotId) {
        fwd = Math.max(-1, Math.min(1, move.moveForward));
        right = Math.max(-1, Math.min(1, move.moveRight));
        const mag = Math.hypot(fwd, right);
        if (mag > 1) {
          fwd /= mag;
          right /= mag;
        }
        p.yaw = move.yaw;
        p.pitch = move.pitch;
        if (move.crouch) p.crouching = true;
        else if (!p.inVent) p.crouching = false;

        wantsSprint = !p.crouching && !p.staminaExhausted && mag > 0.2 && move.sprint && p.stamina > 2;
        if (typeof move.flashlightOn === 'boolean') p.flashlightOn = move.flashlightOn;
        if (typeof move.uvMode === 'boolean') p.uvMode = move.uvMode;
        if (typeof move.pingMs === 'number' && Number.isFinite(move.pingMs)) {
          p.pingMs = Math.max(0, Math.min(600, move.pingMs));
        }
      }

      p.sprinting = wantsSprint;
      if (p.sprinting) {
        p.stamina = Math.max(0, p.stamina - diffCfg.staminaDrainPerSec * SERVER_TICK_SEC);
        if (p.stamina <= 0.5) p.staminaExhausted = true;
      } else {
        const regenMult = p.activePerks.includes('athlete_lungs') ? 1.15 : 1.0;
        p.stamina = Math.min(100, p.stamina + diffCfg.staminaRegenPerSec * regenMult * SERVER_TICK_SEC);
        if (p.staminaExhausted && p.stamina >= 28) p.staminaExhausted = false;
      }

      if (p.flashlightOn && !p.hidingSpotId) {
        const uvMult = p.uvMode ? (p.activePerks.includes('omega_protocol') ? 1.45 * 0.85 : 1.45) : 1.0;
        p.battery = Math.max(0, p.battery - diffCfg.flashlightDrainPerSec * uvMult * SERVER_TICK_SEC);
        if (p.battery <= 0) p.flashlightOn = false;
      }

      if (!p.hidingSpotId) {
        const hitBoost = p.hitBoostTimer > 0 ? 1.35 : 1.0;
        const adrBoost = p.adrenalineBurstTimer > 0 ? 1.12 : 1.0;
        const crouchBoost = p.crouching && p.activePerks.includes('steady_hands') ? 1.15 : 1.0;
        const maxSpeed =
          (p.crouching
            ? diffCfg.playerCrouchSpeed * crouchBoost
            : p.sprinting
            ? diffCfg.playerSprintSpeed
            : diffCfg.playerWalkSpeed) *
          hitBoost *
          adrBoost;

        const sinY = Math.sin(p.yaw);
        const cosY = Math.cos(p.yaw);
        const wishX = (-sinY * fwd + cosY * right) * maxSpeed;
        const wishZ = (-cosY * fwd - sinY * right) * maxSpeed;
        const alpha = 1 - Math.exp(-15 * SERVER_TICK_SEC);
        p.vx += (wishX - p.vx) * alpha;
        p.vz += (wishZ - p.vz) * alpha;

        const prevX = p.x;
        const prevZ = p.z;
        const resolved = resolveWorldMovement(
          this.layout,
          p.x,
          p.y,
          p.z,
          p.vx * SERVER_TICK_SEC,
          p.vz * SERVER_TICK_SEC,
          0.38,
          false,
          p.crouching
        );
        p.x = resolved.x;
        p.y = resolved.y;
        p.z = resolved.z;
        p.floor = resolved.floor;
        p.inVent = isPositionInVent(this.layout, p.x, p.z, p.floor);

        const moved = Math.hypot(p.x - prevX, p.z - prevZ);
        if (moved > 0.0005) {
          this.dirtyPlayers.add(pid);
          if (p.sprinting && this.state.tick % 25 === 0) {
            const noiseMult =
              (p.activePerks.includes('silent_steps') ? 0.82 : 1.0) *
              (p.activePerks.includes('omega_protocol') ? 0.88 : 1.0);
            this.noiseScratch.push({
              x: p.x,
              y: p.y,
              z: p.z,
              floor: p.floor,
              radius: 18.5 * noiseMult,
              priority: 3,
              source: 'sprint',
              timestamp: this.state.elapsedSec,
            });
          }
        }
      }

      const dx = p.x - this.ai.x;
      const dz = p.z - this.ai.z;
      const floorPen = p.floor === this.ai.floor ? 0 : 400;
      const dSq = dx * dx + dz * dz + floorPen;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestTarget = p;
      }
    }

    // 4. Step Authoritative P. Drizzy AI targeting closest active survivor
    if (diffCfg.diddyActive && closestTarget) {
      const hidingDef = closestTarget.hidingSpotId
        ? this.layout.hidingSpots.find((h) => h.id === closestTarget!.hidingSpotId) ?? null
        : null;
      const aiEvents = this.ai.tick({
        dt: SERVER_TICK_SEC,
        elapsedSec: this.state.elapsedSec,
        layout: this.layout,
        diff: diffCfg,
        playerX: closestTarget.x,
        playerY: closestTarget.y,
        playerZ: closestTarget.z,
        playerFloor: closestTarget.floor,
        playerCrouching: closestTarget.crouching,
        playerInVent: closestTarget.inVent,
        playerFlashlightOn: closestTarget.flashlightOn,
        playerHidingSpot: hidingDef,
        playerEnteredHidingThisFrame: false,
        playerInvulnerable: closestTarget.invulnerableTimer > 0,
        blackoutAlertActive: this.state.blackoutActive,
        noiseEvents: this.noiseScratch,
      });

      this.state.diddy.x = this.ai.x;
      this.state.diddy.y = this.ai.y;
      this.state.diddy.z = this.ai.z;
      this.state.diddy.yaw = this.ai.yaw;
      this.state.diddy.floor = this.ai.floor;
      this.state.diddy.state = this.ai.state;
      this.state.diddy.animState = this.ai.animState;
      this.state.diddy.targetPlayerId = closestTarget.id;
      this.diddyDirty = true;

      if (aiEvents.hitPlayer && closestTarget.invulnerableTimer <= 0) {
        this.applyDiddyHitToPlayer(closestTarget);
      }
    }

    // 5. Record Lag Compensation Ring Buffer frame (zero allocs)
    this.recordHistoryFrame();

    // 6. Compact 33Hz delta broadcast + 2.0s self-heal snapshot
    this.ticksSinceBroadcast++;
    if (this.ticksSinceBroadcast >= BROADCAST_INTERVAL_TICKS) {
      this.ticksSinceBroadcast = 0;
      this.flushCompactDelta();
    }

    this.ticksSinceSelfHeal++;
    if (this.ticksSinceSelfHeal >= SELF_HEAL_SNAPSHOT_TICKS) {
      this.ticksSinceSelfHeal = 0;
      this.onSelfHealSnapshot?.(this.exportSnapshot());
    }
  }

  private recordHistoryFrame(): void {
    const slot = this.historyRing[this.historyCursor];
    this.historyCursor = (this.historyCursor + 1) % LAG_COMP_HISTORY_TICKS;
    slot.tick = this.state.tick;
    slot.diddyX = this.state.diddy.x;
    slot.diddyY = this.state.diddy.y;
    slot.diddyZ = this.state.diddy.z;
    slot.diddyFloor = this.state.diddy.floor;

    slot.players.clear();
    for (const pid of Object.keys(this.state.players)) {
      const p = this.state.players[pid];
      slot.players.set(pid, { x: p.x, y: p.y, z: p.z, floor: p.floor, alive: p.alive && !p.capturedInCell });
    }
  }

  /**
   * Retrieves the historical frame closest to targetTick within the 300ms ring buffer.
   */
  getLagCompFrame(targetTick: number): LagCompFrame | null {
    let best: LagCompFrame | null = null;
    let bestDiff = Infinity;
    for (let i = 0; i < LAG_COMP_HISTORY_TICKS; i++) {
      const f = this.historyRing[i];
      if (f.tick < 0) continue;
      const diff = Math.abs(f.tick - targetTick);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = f;
      }
    }
    return best;
  }

  private applyDiddyHitToPlayer(p: PlayerState): void {
    p.health -= 1;
    this.dirtyPlayers.add(p.id);
    if (p.health > 0) {
      p.invulnerableTimer = 2.6;
      p.hitBoostTimer = 1.8;
      p.stamina = Math.min(100, p.stamina + 45);
      this.ai.stun(2.4);
      this.emitEvent({ tick: this.state.tick, type: 'player_hit', playerId: p.id });
      return;
    }

    // Player health reached 0 -> Capture into basement cell & drop key items (Anti-Softlock)
    this.capturePlayerToCell(p);
  }

  private capturePlayerToCell(p: PlayerState): void {
    p.health = 0;
    p.capturedInCell = true;
    p.spectating = true;
    p.hidingSpotId = null;
    this.dropKeyItemsFromPlayer(p);

    // Move to basement holding cell
    p.x = BASEMENT_CELL_POS.x;
    p.y = BASEMENT_CELL_POS.y;
    p.z = BASEMENT_CELL_POS.z;
    p.floor = BASEMENT_CELL_POS.floor;
    this.dirtyPlayers.add(p.id);
    this.emitEvent({ tick: this.state.tick, type: 'player_captured', playerId: p.id });

    // Check if ALL connected players are now captured -> Bad Ending!
    const connectedPlayers = Object.values(this.state.players).filter((pl) => pl.connected);
    const anyFree = connectedPlayers.some((pl) => pl.alive && !pl.capturedInCell);
    if (!anyFree) {
      this.triggerEnding('bad');
    }
  }

  private triggerEnding(endingId: EndingId): void {
    if (this.state.phase === 'ended') return;
    this.state.phase = 'ended';
    this.state.endingId = endingId;
    this.worldFlagsDirty = true;
    this.emitEvent({ tick: this.state.tick, type: 'ending_triggered', detail: endingId });
  }

  private setDoorOpen(doorId: string, open: boolean): void {
    const ds = this.state.doors[doorId];
    const ld = this.layout.doors.find((d) => d.id === doorId);
    if (ds) {
      ds.isOpen = open;
      this.dirtyDoors.add(doorId);
    }
    if (ld) ld.isOpen = open;
  }

  private processIntent(playerId: string, intent: ClientIntent): IntentResult {
    const p = this.state.players[playerId];
    if (!p || !p.connected) return { ok: false, code: 'UNKNOWN_PLAYER' };

    if (intent.type === 'move_input') {
      if (intent.seq > p.lastProcessedSeq) {
        p.lastProcessedSeq = intent.seq;
        this.latestMoveInputs.set(playerId, intent);
        this.dirtyPlayers.add(playerId);
      }
      return { ok: true, code: 'OK' };
    }

    if (intent.type === 'capture_player') {
      const target = this.state.players[intent.targetPlayerId];
      if (!target || target.capturedInCell) return { ok: false, code: 'INVALID_TARGET' };
      this.capturePlayerToCell(target);
      return { ok: true, code: 'CAPTURED' };
    }

    if (!p.alive || p.capturedInCell) {
      return { ok: false, code: 'PLAYER_INCAPACITATED' };
    }

    switch (intent.type) {
      case 'pickup_item': {
        const it = this.state.items[intent.itemId];
        if (!it || it.collected) return { ok: false, code: 'ALREADY_COLLECTED' };
        if (it.insideSafe && !this.state.safeUnlocked) return { ok: false, code: 'INSIDE_LOCKED_SAFE' };
        if (it.floor !== p.floor) return { ok: false, code: 'WRONG_FLOOR' };
        const dist = Math.hypot(it.x - p.x, it.z - p.z);
        if (dist > 3.2) return { ok: false, code: 'TOO_FAR' };

        // Atomic authoritative claim — impossible to duplicate!
        it.collected = true;
        this.dirtyItems.add(it.id);

        if (it.itemType === 'battery') {
          const boost = p.activePerks.includes('field_scavenger') ? 52 : 45;
          p.battery = Math.min(p.maxBattery, p.battery + boost);
        } else if (it.itemType === 'stun_ammo') {
          p.stunAmmo += 1;
        } else if (it.itemType === 'throwable_can') {
          p.throwables += 1;
          if (!p.inventory.includes('throwable_can')) p.inventory.push('throwable_can');
        } else if (it.itemType === 'flare') {
          p.flares += 1;
          if (!p.inventory.includes('flare')) p.inventory.push('flare');
        } else {
          if (!p.inventory.includes(it.itemType)) p.inventory.push(it.itemType);
        }

        this.dirtyPlayers.add(p.id);
        this.emitEvent({ tick: this.state.tick, type: 'item_collected', playerId: p.id, targetId: it.id, detail: it.itemType });
        return { ok: true, code: 'COLLECTED' };
      }

      case 'drop_item': {
        const itemType = p.inventory[intent.slotIndex];
        if (!itemType || itemType === 'flashlight') return { ok: false, code: 'CANNOT_DROP' };
        p.inventory.splice(intent.slotIndex, 1);
        const dropId = `drop_${itemType}_${this.state.tick}_${p.id.slice(-3)}`;
        this.state.items[dropId] = {
          id: dropId,
          itemType,
          floor: p.floor,
          x: p.x,
          y: p.y + 0.14,
          z: p.z,
          collected: false,
          insideSafe: false,
          droppedByPlayer: true,
        };
        this.dirtyItems.add(dropId);
        this.dirtyPlayers.add(p.id);
        this.emitEvent({ tick: this.state.tick, type: 'item_dropped', playerId: p.id, targetId: dropId, detail: itemType });
        return { ok: true, code: 'DROPPED' };
      }

      case 'interact_door': {
        const ld = this.layout.doors.find((d) => d.id === intent.doorId);
        const ds = this.state.doors[intent.doorId];
        if (!ld || !ds) return { ok: false, code: 'UNKNOWN_DOOR' };
        if (ld.floor !== p.floor) return { ok: false, code: 'WRONG_FLOOR' };

        if (ld.isExit) {
          if (!ds.planksRemoved) {
            if (!p.inventory.includes('crowbar')) return { ok: false, code: 'NEEDS_CROWBAR' };
            ds.planksRemoved = true;
            ld.planksRemoved = true;
            this.dirtyDoors.add(ld.id);
            return { ok: true, code: 'PLANKS_REMOVED' };
          }
          if (!ds.electronicUnlocked) return { ok: false, code: 'NEEDS_SAFE_CODE' };
          if (!ds.isUnlocked) {
            if (!p.inventory.includes('master_key')) return { ok: false, code: 'NEEDS_MASTER_KEY' };
            // Consume master_key once and unlock exit permanently
            p.inventory = p.inventory.filter((it) => it !== 'master_key');
            ds.isUnlocked = true;
            ds.locked = false;
            ds.isOpen = true;
            ld.isUnlocked = true;
            ld.isOpen = true;
            this.dirtyDoors.add(ld.id);
            this.dirtyPlayers.add(p.id);
          }
          const ending: EndingId =
            this.state.terminalUnlocked && (this.state.translationBoardSeen || this.state.discoveredUvMarkIds.length > 0)
              ? 'secret'
              : 'good';
          this.triggerEnding(ending);
          return { ok: true, code: 'ESCAPED' };
        }

        if (!ds.isUnlocked || ds.locked) {
          const req = ld.lockType;
          const hasTool =
            (req === 'red_key' && p.inventory.includes('red_key')) ||
            (req === 'blue_key' && p.inventory.includes('blue_key')) ||
            (req === 'basement_key' && p.inventory.includes('basement_key')) ||
            (req === 'crowbar_planks' && p.inventory.includes('crowbar')) ||
            (req === 'wire_cutters' && p.inventory.includes('wire_cutters'));
          if (!hasTool) return { ok: false, code: 'LOCKED' };

          // Single-use key consumption: keys are consumed ONCE and unlock permanently (tools like crowbar/wire_cutters stay)
          const isConsumableKey = req === 'red_key' || req === 'blue_key' || req === 'basement_key';
          if (isConsumableKey) {
            p.inventory = p.inventory.filter((it) => it !== req);
            this.dirtyPlayers.add(p.id);
          }

          // Unlocking with basement_key permanently opens both West & East basement gates so no softlock occurs
          const targets =
            req === 'basement_key'
              ? this.layout.doors.filter((d) => d.lockType === 'basement_key')
              : [ld];
          for (const td of targets) {
            const tds = this.state.doors[td.id];
            if (tds) {
              tds.isUnlocked = true;
              tds.locked = false;
              tds.isOpen = true;
              this.dirtyDoors.add(td.id);
            }
            td.isUnlocked = true;
            td.isOpen = true;
          }
          this.emitEvent({ tick: this.state.tick, type: 'door_changed', playerId: p.id, targetId: ld.id });
          return { ok: true, code: 'UNLOCKED' };
        }

        // Once unlocked, door NEVER re-locks — toggles open/closed freely for all players
        ds.isUnlocked = true;
        ds.locked = false;
        ds.isOpen = !ds.isOpen;
        ld.isOpen = ds.isOpen;
        this.dirtyDoors.add(ld.id);
        this.emitEvent({ tick: this.state.tick, type: 'door_changed', playerId: p.id, targetId: ld.id });
        return { ok: true, code: ds.isOpen ? 'OPENED' : 'CLOSED' };
      }

      case 'toggle_fnaf_door': {
        if (this.state.securityPowerPct <= 1) return { ok: false, code: 'NO_POWER' };
        if (intent.side === 'left') {
          this.state.fnafLeftClosed = !this.state.fnafLeftClosed;
          this.setDoorOpen('door_fnaf_left', !this.state.fnafLeftClosed);
        } else {
          this.state.fnafRightClosed = !this.state.fnafRightClosed;
          this.setDoorOpen('door_fnaf_right', !this.state.fnafRightClosed);
        }
        return { ok: true, code: 'TOGGLED' };
      }

      case 'submit_safe_code': {
        if (intent.code !== this.layout.safe.code) return { ok: false, code: 'WRONG_CODE' };
        this.state.safeUnlocked = true;
        this.layout.safe.unlocked = true;
        this.worldFlagsDirty = true;
        const exitDoor = this.layout.doors.find((d) => d.isExit);
        if (exitDoor) {
          exitDoor.electronicUnlocked = true;
          const ds = this.state.doors[exitDoor.id];
          if (ds) {
            ds.electronicUnlocked = true;
            this.dirtyDoors.add(exitDoor.id);
          }
        }
        const reward = this.state.items[this.layout.safe.rewardItemId];
        if (reward && !reward.collected) {
          reward.collected = true;
          reward.insideSafe = false;
          this.dirtyItems.add(reward.id);
          if (reward.itemType !== 'battery' && reward.itemType !== 'stun_ammo' && !p.inventory.includes(reward.itemType)) {
            p.inventory.push(reward.itemType);
          }
          this.dirtyPlayers.add(p.id);
        }
        this.emitEvent({ tick: this.state.tick, type: 'safe_unlocked', playerId: p.id });
        return { ok: true, code: 'SAFE_UNLOCKED' };
      }

      case 'submit_terminal_code': {
        if (intent.code !== this.layout.secretTerminalCode) return { ok: false, code: 'WRONG_CODE' };
        this.state.terminalUnlocked = true;
        this.worldFlagsDirty = true;
        this.emitEvent({ tick: this.state.tick, type: 'terminal_unlocked', playerId: p.id });
        return { ok: true, code: 'TERMINAL_UNLOCKED' };
      }

      case 'interact_generator': {
        if (this.state.generatorFixed) return { ok: true, code: 'ALREADY_FIXED' };
        if (!this.state.fuseInstalled) {
          if (!p.inventory.includes('fuse')) return { ok: false, code: 'NEEDS_FUSE' };
          p.inventory = p.inventory.filter((i) => i !== 'fuse');
          this.state.fuseInstalled = true;
          this.worldFlagsDirty = true;
          this.dirtyPlayers.add(p.id);
          return { ok: true, code: 'FUSE_INSTALLED' };
        }
        this.state.generatorFixed = true;
        this.state.blackoutActive = false;
        this.state.securityPowerPct = Math.min(100, this.state.securityPowerPct + 40);
        this.worldFlagsDirty = true;
        this.emitEvent({ tick: this.state.tick, type: 'generator_fixed', playerId: p.id });
        return { ok: true, code: 'GENERATOR_FIXED' };
      }

      case 'interact_hatch': {
        if (!p.inventory.includes('wire_cutters')) return { ok: false, code: 'NEEDS_WIRE_CUTTERS' };
        if (!this.state.cctvSecretHintSeen) return { ok: false, code: 'NEEDS_CCTV_HINT' };
        if (this.state.listenedCassetteIds.length === 0) return { ok: false, code: 'NEEDS_MARCOS_SIGNAL' };
        this.state.hatchOpened = true;
        this.worldFlagsDirty = true;
        this.triggerEnding('real');
        return { ok: true, code: 'REAL_ENDING' };
      }

      case 'interact_clue': {
        if (!this.state.discoveredClueIds.includes(intent.clueId)) {
          this.state.discoveredClueIds.push(intent.clueId);
        }
        return { ok: true, code: 'CLUE_DISCOVERED' };
      }

      case 'interact_uv_mark': {
        if (!this.state.discoveredUvMarkIds.includes(intent.markId)) {
          this.state.discoveredUvMarkIds.push(intent.markId);
        }
        return { ok: true, code: 'UV_DISCOVERED' };
      }

      case 'interact_cassette': {
        if (!this.state.listenedCassetteIds.includes(intent.tapeId)) {
          this.state.listenedCassetteIds.push(intent.tapeId);
        }
        return { ok: true, code: 'CASSETTE_LISTENED' };
      }

      case 'interact_light_switch': {
        const cur = this.state.lightSwitches[intent.switchId] ?? true;
        this.state.lightSwitches[intent.switchId] = !cur;
        return { ok: true, code: 'SWITCH_TOGGLED' };
      }

      case 'interact_translation_board':
        this.state.translationBoardSeen = true;
        return { ok: true, code: 'OK' };

      case 'seen_cctv_hint':
        this.state.cctvSecretHintSeen = true;
        return { ok: true, code: 'OK' };

      case 'craft_recipe': {
        if (intent.recipe === 'crowbar') {
          if (!p.inventory.includes('crowbar_rod') || !p.inventory.includes('crowbar_hook')) {
            return { ok: false, code: 'MISSING_PARTS' };
          }
          p.inventory = p.inventory.filter((i) => i !== 'crowbar_rod' && i !== 'crowbar_hook');
          p.inventory.push('crowbar');
          this.dirtyPlayers.add(p.id);
          return { ok: true, code: 'CRAFTED_CROWBAR' };
        }
        if (!p.inventory.includes('stun_coil') || !p.inventory.includes('stun_cell')) {
          return { ok: false, code: 'MISSING_PARTS' };
        }
        p.inventory = p.inventory.filter((i) => i !== 'stun_coil' && i !== 'stun_cell');
        p.stunAmmo += 1;
        this.dirtyPlayers.add(p.id);
        return { ok: true, code: 'CRAFTED_STUN_AMMO' };
      }

      case 'fire_stun_gun': {
        if (!p.inventory.includes('stun_gun') || p.stunAmmo <= 0) {
          return { ok: false, code: 'NO_STUN_AMMO' };
        }
        p.stunAmmo -= 1;
        this.dirtyPlayers.add(p.id);

        // Lag-Compensated Hitbox Validation using the 300ms Ring Buffer!
        const rewindTicks = Math.min(
          LAG_COMP_HISTORY_TICKS - 1,
          Math.max(0, Math.round(p.pingMs / 2 / 10))
        );
        const evalTick = intent.clientTick ?? Math.max(0, this.state.tick - rewindTicks);
        const hist = this.getLagCompFrame(evalTick);
        const diddyX = hist ? hist.diddyX : this.state.diddy.x;
        const diddyY = hist ? hist.diddyY : this.state.diddy.y;
        const diddyZ = hist ? hist.diddyZ : this.state.diddy.z;
        const diddyFloor = hist ? hist.diddyFloor : this.state.diddy.floor;

        const dx = diddyX - p.x;
        const dz = diddyZ - p.z;
        const dy = Math.abs(diddyY - p.y);
        const dist = Math.hypot(dx, dz);
        const hFwdX = -Math.sin(intent.yaw);
        const hFwdZ = -Math.cos(intent.yaw);
        const dot = dist > 0.01 ? (dx * hFwdX + dz * hFwdZ) / dist : 1;

        const diffCfg = getDifficultyConfig(this.state.difficulty);
        if (
          diddyFloor === p.floor &&
          dist <= 16.5 &&
          dy <= 2.6 &&
          dot >= 0.72 &&
          hasWallLineOfSight(this.layout, p.x, p.z, diddyX, diddyZ, p.floor)
        ) {
          this.ai.stun(diffCfg.diddyStunDuration);
          this.state.diddy.state = 'stunned';
          this.state.diddy.stunnedTimer = diffCfg.diddyStunDuration;
          this.diddyDirty = true;
          if (p.activePerks.includes('adrenaline_burst')) {
            p.adrenalineBurstTimer = 2.5;
          }
          this.emitEvent({ tick: this.state.tick, type: 'diddy_stunned', playerId: p.id });
          return { ok: true, code: 'STUN_HIT' };
        }
        return { ok: true, code: 'STUN_MISS' };
      }

      case 'use_flare': {
        if (p.flares <= 0) return { ok: false, code: 'NO_FLARES' };
        p.flares -= 1;
        this.dirtyPlayers.add(p.id);
        this.noiseScratch.push({
          x: p.x,
          y: p.y,
          z: p.z,
          floor: p.floor,
          radius: 26,
          priority: 4,
          source: 'flare',
          timestamp: this.state.elapsedSec,
        });
        return { ok: true, code: 'FLARE_USED' };
      }

      case 'enter_hiding': {
        const spot = this.layout.hidingSpots.find((h) => h.id === intent.spotId);
        if (!spot || spot.floor !== p.floor) return { ok: false, code: 'INVALID_SPOT' };
        p.hidingSpotId = spot.id;
        this.dirtyPlayers.add(p.id);
        return { ok: true, code: 'HIDING' };
      }

      case 'exit_hiding': {
        p.hidingSpotId = null;
        this.dirtyPlayers.add(p.id);
        return { ok: true, code: 'EXITED_HIDING' };
      }

      case 'rescue_ally': {
        const ally = this.state.players[intent.targetPlayerId];
        if (!ally || !ally.capturedInCell) return { ok: false, code: 'NOT_CAPTURED' };
        if (ally.floor !== p.floor) return { ok: false, code: 'WRONG_FLOOR' };
        const dist = Math.hypot(ally.x - p.x, ally.z - p.z);
        if (dist > 3.2) return { ok: false, code: 'TOO_FAR' };

        ally.capturedInCell = false;
        ally.spectating = false;
        ally.alive = true;
        ally.health = Math.max(1, Math.min(ally.maxHealth, 1));
        ally.invulnerableTimer = 3.0;
        this.dirtyPlayers.add(ally.id);
        this.emitEvent({ tick: this.state.tick, type: 'player_rescued', playerId: p.id, targetId: ally.id });
        return { ok: true, code: 'RESCUED' };
      }
    }
  }

  private flushCompactDelta(): void {
    if (
      !this.onBroadcastDelta ||
      (this.dirtyPlayers.size === 0 &&
        !this.diddyDirty &&
        this.dirtyDoors.size === 0 &&
        this.dirtyItems.size === 0 &&
        !this.worldFlagsDirty)
    ) {
      return;
    }

    const pArr: CompactDeltaPacket['p'] = [];
    for (const pid of this.dirtyPlayers) {
      const p = this.state.players[pid];
      if (!p) continue;
      const flags =
        (p.alive ? 1 : 0) |
        (p.crouching ? 2 : 0) |
        (p.flashlightOn ? 4 : 0) |
        (p.uvMode ? 8 : 0) |
        (p.capturedInCell ? 16 : 0) |
        (p.spectating ? 32 : 0);
      pArr.push([
        p.id,
        p.lastProcessedSeq,
        Math.round(p.x * 100) / 100,
        Math.round(p.y * 100) / 100,
        Math.round(p.z * 100) / 100,
        Math.round(p.yaw * 1000) / 1000,
        p.floor,
        flags,
      ]);
    }
    this.dirtyPlayers.clear();

    let dArr: CompactDeltaPacket['d'];
    if (this.diddyDirty) {
      const d: DiddyServerState = this.state.diddy;
      const stIdx = Math.max(0, DIDDY_STATE_LIST.indexOf(d.state));
      dArr = [
        Math.round(d.x * 100) / 100,
        Math.round(d.y * 100) / 100,
        Math.round(d.z * 100) / 100,
        Math.round(d.yaw * 1000) / 1000,
        d.floor,
        stIdx,
      ];
      this.diddyDirty = false;
    }

    let eObj: CompactDeltaPacket['e'];
    if (this.worldFlagsDirty || this.dirtyDoors.size > 0 || this.dirtyItems.size > 0) {
      eObj = {};
      if (this.worldFlagsDirty) {
        eObj.phase = this.state.phase;
        eObj.endingId = this.state.endingId;
        eObj.safeUnlocked = this.state.safeUnlocked;
        eObj.generatorFixed = this.state.generatorFixed;
        eObj.fuseInstalled = this.state.fuseInstalled;
        eObj.blackoutActive = this.state.blackoutActive;
        eObj.terminalUnlocked = this.state.terminalUnlocked;
        eObj.hatchOpened = this.state.hatchOpened;
        this.worldFlagsDirty = false;
      }
      if (this.dirtyDoors.size > 0) {
        eObj.doors = {};
        for (const id of this.dirtyDoors) eObj.doors[id] = { ...this.state.doors[id] };
        this.dirtyDoors.clear();
      }
      if (this.dirtyItems.size > 0) {
        eObj.items = {};
        for (const id of this.dirtyItems) eObj.items[id] = { ...this.state.items[id] };
        this.dirtyItems.clear();
      }
    }

    this.onBroadcastDelta({
      t: this.state.tick,
      s: this.state.serverTimeMs,
      p: pArr,
      d: dArr,
      e: eObj,
    });
  }

  private emitEvent(ev: ServerEvent): void {
    this.eventLog.push(ev);
    if (this.eventLog.length > 100) this.eventLog.shift();
    this.onServerEvent?.(ev);
  }

  getRecentEvents(): readonly ServerEvent[] {
    return this.eventLog;
  }
}
