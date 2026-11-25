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
  BUNKER_LURE_COOLDOWN_SEC,
  DOWNED_BLEEDOUT_SEC,
  FINAL_GATE_SIREN_SEC,
  KEY_PROGRESSION_ITEMS,
  LAG_COMP_HISTORY_TICKS,
  REVIVE_DURATION_MEDKIT_SEC,
  REVIVE_DURATION_NORMAL_SEC,
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

      // Deterministic 6-digit Final Gate code (3 digits on SecurityBunker CRT + 3 digits in Secret Attic)
      const bunkerHalf = String(100 + (Math.abs(seed * 31 + 17) % 899));
      const atticHalf = String(100 + (Math.abs(seed * 73 + 41) % 899));
      const sixDigitCode = `${bunkerHalf}${atticHalf}`;

      this.state = {
        tick: 0,
        serverTimeMs: Date.now(),
        seed,
        difficulty,
        elapsedSec: 0,
        phase: 'playing',
        matchPhase: 'PLAYING',
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
        bunkerLeftClosed: false,
        bunkerRightClosed: false,
        bunkerLureCooldownSec: 0,
        puzzles: {
          bookshelfEmblemsPlaced: [],
          bookshelfOpened: false,
          pianoNotesEntered: [],
          pianoSolved: false,
          steamValvesTurned: [],
          steamSolved: false,
          polaroidClueRevealed: false,
          garageCarParts: [],
          garageCarReady: false,
        },
        finalGate: {
          fusesRestored: 0,
          chainsCut: 0,
          masterKeyInserted: false,
          sixDigitCodeVerified: false,
          sixDigitCode,
          hydraulicLeverProgress: 0,
          hydraulicLeverPulled: false,
          sirenActive: false,
          sirenRemainingSec: FINAL_GATE_SIREN_SEC,
          gateFullyOpen: false,
        },
        atmosphere: {
          corridorPowerDipSec: 0,
          thunderFlashIntensity: 0,
          nextEventTimerSec: 28,
        },
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
      lifeState: 'ALIVE',
      bleedoutSec: 0,
      reviveProgressSec: 0,
      captureCount: 0,
      capturedInCell: false,
      spectating: false,
      polaroidCharges: 3,
      neuralInterference: 0,
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

    // 2. Step SecurityBunker Power, Remote Lure Cooldown, Atmospheric Events & 15s Final Gate Siren
    if (this.state.bunkerLureCooldownSec > 0) {
      this.state.bunkerLureCooldownSec = Math.max(0, this.state.bunkerLureCooldownSec - SERVER_TICK_SEC);
    }

    // Synchronized atmospheric events (corridor power dip & thunder flash)
    this.state.atmosphere.nextEventTimerSec -= SERVER_TICK_SEC;
    if (this.state.atmosphere.corridorPowerDipSec > 0) {
      this.state.atmosphere.corridorPowerDipSec = Math.max(0, this.state.atmosphere.corridorPowerDipSec - SERVER_TICK_SEC);
    }
    if (this.state.atmosphere.thunderFlashIntensity > 0) {
      this.state.atmosphere.thunderFlashIntensity = Math.max(0, this.state.atmosphere.thunderFlashIntensity - SERVER_TICK_SEC * 2.2);
    }
    if (this.state.atmosphere.nextEventTimerSec <= 0) {
      this.state.atmosphere.nextEventTimerSec = 32 + ((this.state.tick * 13) % 24);
      if ((this.state.tick & 1) === 0) {
        this.state.atmosphere.thunderFlashIntensity = 1.0;
      } else {
        this.state.atmosphere.corridorPowerDipSec = 4.5;
      }
    }

    // 4-Stage Final Gate 15-second frenzy siren countdown
    if (this.state.finalGate.sirenActive && !this.state.finalGate.gateFullyOpen) {
      this.state.finalGate.sirenRemainingSec = Math.max(
        0,
        this.state.finalGate.sirenRemainingSec - SERVER_TICK_SEC
      );
      if (this.state.tick % 50 === 0) {
        this.noiseScratch.push({
          x: gridToWorld(17.5),
          y: FLOOR_0_Y,
          z: gridToWorld(2.5),
          floor: 0,
          radius: 60,
          priority: 5,
          source: 'door',
          timestamp: this.state.elapsedSec,
        });
      }
      if (this.state.finalGate.sirenRemainingSec <= 0) {
        this.state.finalGate.gateFullyOpen = true;
        this.state.finalGate.sirenActive = false;
        const exitDoor = this.layout.doors.find((d) => d.isExit);
        if (exitDoor) {
          exitDoor.isUnlocked = true;
          exitDoor.isOpen = true;
          const ds = this.state.doors[exitDoor.id];
          if (ds) {
            ds.isUnlocked = true;
            ds.locked = false;
            ds.isOpen = true;
            this.dirtyDoors.add(exitDoor.id);
          }
        }
        const ending: EndingId =
          this.state.terminalUnlocked && (this.state.translationBoardSeen || this.state.discoveredUvMarkIds.length > 0)
            ? 'secret'
            : 'good';
        this.triggerEnding(ending);
        return;
      }
    }

    const closedCount = (this.state.bunkerLeftClosed ? 1 : 0) + (this.state.bunkerRightClosed ? 1 : 0);
    if (closedCount > 0) {
      this.state.securityPowerPct = Math.max(0, this.state.securityPowerPct - closedCount * 3.2 * SERVER_TICK_SEC);
      if (this.state.securityPowerPct <= 0) {
        this.state.bunkerLeftClosed = false;
        this.state.bunkerRightClosed = false;
        this.setDoorOpen('door_bunker_left', true);
        this.setDoorOpen('door_bunker_right', true);
      }
    } else if (!this.state.blackoutActive && this.state.securityPowerPct < 100) {
      this.state.securityPowerPct = Math.min(100, this.state.securityPowerPct + 0.85 * SERVER_TICK_SEC);
    }

    // 3. Step every player deterministically
    let closestTarget: PlayerState | null = null;
    let closestDistSq = Infinity;

    for (const pid of Object.keys(this.state.players)) {
      const p = this.state.players[pid];
      if (!p.connected || p.lifeState === 'DEAD_SPECTATING' || p.lifeState === 'CAPTURED' || !p.alive || p.capturedInCell) {
        continue;
      }

      // Tick DOWNED 35s bleedout countdown (can still crawl slowly, transitions to DEAD_SPECTATING at 0)
      if (p.lifeState === 'DOWNED') {
        p.bleedoutSec = Math.max(0, p.bleedoutSec - SERVER_TICK_SEC);
        if (p.bleedoutSec <= 0) {
          this.eliminatePlayerToSpectator(p);
          continue;
        }
      }

      // Neural Interference buildup in complete darkness or close proximity to P. Drizzy, healed by light/allies
      const distDiddy = Math.hypot(p.x - this.ai.x, p.z - this.ai.z);
      const nearDiddy = p.floor === this.ai.floor && distDiddy < 9.5;
      const inDark = !p.flashlightOn || this.state.blackoutActive || this.state.atmosphere.corridorPowerDipSec > 0;
      const nearAlly = Object.values(this.state.players).some(
        (other) => other.id !== p.id && other.connected && other.lifeState === 'ALIVE' && other.floor === p.floor && Math.hypot(other.x - p.x, other.z - p.z) < 5.0
      );
      if (nearDiddy || inDark) {
        const rate = (nearDiddy ? 4.2 : 0) + (inDark ? 1.8 : 0) - (nearAlly ? 2.5 : 0);
        p.neuralInterference = Math.max(0, Math.min(100, p.neuralInterference + rate * SERVER_TICK_SEC));
      } else {
        p.neuralInterference = Math.max(0, p.neuralInterference - (nearAlly ? 8.5 : 4.5) * SERVER_TICK_SEC);
      }

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
          p.lifeState === 'DOWNED'
            ? 1.15
            : (p.crouching
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
    if (p.lifeState === 'DOWNED') {
      // P. Drizzy finishes carrying downed survivor to basement holding cell
      this.capturePlayerToCell(p);
      return;
    }

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

    // Multiplayer (2+ players) OR Solo with Adrenaline Burst: enter DOWNED (35s bleedout, crawl + ally revive!)
    const connectedCount = Object.values(this.state.players).filter((pl) => pl.connected).length;
    if (connectedCount > 1 || p.activePerks.includes('adrenaline_burst')) {
      p.health = 0;
      p.lifeState = 'DOWNED';
      p.bleedoutSec = DOWNED_BLEEDOUT_SEC;
      p.reviveProgressSec = 0;
      p.crouching = true;
      p.sprinting = false;
      p.hidingSpotId = null;
      p.invulnerableTimer = 2.5;
      this.dirtyPlayers.add(p.id);
      this.emitEvent({ tick: this.state.tick, type: 'player_downed', playerId: p.id });
      return;
    }

    // Solo without Adrenaline -> Capture into basement cell
    this.capturePlayerToCell(p);
  }

  private eliminatePlayerToSpectator(p: PlayerState): void {
    p.health = 0;
    p.alive = false;
    p.lifeState = 'DEAD_SPECTATING';
    p.bleedoutSec = 0;
    p.reviveProgressSec = 0;
    p.capturedInCell = false;
    p.spectating = true;
    p.hidingSpotId = null;
    this.dropKeyItemsFromPlayer(p);
    this.dirtyPlayers.add(p.id);
    this.emitEvent({ tick: this.state.tick, type: 'player_spectating', playerId: p.id });
    this.checkTeamWipeout();
  }

  private checkTeamWipeout(): void {
    const connectedPlayers = Object.values(this.state.players).filter((pl) => pl.connected);
    if (connectedPlayers.length === 0) return;
    // Match ONLY wipes out when ZERO players remain ALIVE or DOWNED (revivable)
    const anyActive = connectedPlayers.some(
      (pl) => pl.lifeState === 'ALIVE' || pl.lifeState === 'DOWNED'
    );
    if (!anyActive) {
      this.triggerEnding('bad');
    }
  }

  private capturePlayerToCell(p: PlayerState): void {
    p.captureCount += 1;
    // Exceeding capture limit (3rd capture) eliminates permanently into DEAD_SPECTATING
    if (p.captureCount >= 3) {
      this.eliminatePlayerToSpectator(p);
      return;
    }
    p.health = 0;
    p.lifeState = 'CAPTURED';
    p.bleedoutSec = 0;
    p.reviveProgressSec = 0;
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
    this.checkTeamWipeout();
  }

  private triggerEnding(endingId: EndingId): void {
    if (this.state.phase === 'ended') return;
    this.state.phase = 'ended';
    this.state.matchPhase = endingId === 'bad' ? 'ENDED_WIPEOUT' : 'ENDED_VICTORY';
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

    if (!p.alive || p.capturedInCell || p.lifeState !== 'ALIVE') {
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

      case 'toggle_bunker_door': {
        if (this.state.securityPowerPct <= 1) return { ok: false, code: 'NO_POWER' };
        if (intent.side === 'left') {
          this.state.bunkerLeftClosed = !this.state.bunkerLeftClosed;
          this.setDoorOpen('door_bunker_left', !this.state.bunkerLeftClosed);
        } else {
          this.state.bunkerRightClosed = !this.state.bunkerRightClosed;
          this.setDoorOpen('door_bunker_right', !this.state.bunkerRightClosed);
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

        // Consume lockpick or cell_key if present (also allows cell release when unlocked)
        if (p.inventory.includes('lockpick')) {
          p.inventory = p.inventory.filter((it) => it !== 'lockpick');
          this.dirtyPlayers.add(p.id);
        } else if (p.inventory.includes('cell_key')) {
          p.inventory = p.inventory.filter((it) => it !== 'cell_key');
          this.dirtyPlayers.add(p.id);
        }

        ally.capturedInCell = false;
        ally.spectating = false;
        ally.alive = true;
        ally.lifeState = 'ALIVE';
        ally.bleedoutSec = 0;
        ally.health = Math.max(1, Math.min(ally.maxHealth, 1));
        ally.invulnerableTimer = 3.0;
        this.dirtyPlayers.add(ally.id);
        this.emitEvent({ tick: this.state.tick, type: 'player_rescued', playerId: p.id, targetId: ally.id });
        return { ok: true, code: 'RESCUED' };
      }

      case 'revive_ally': {
        const ally = this.state.players[intent.targetPlayerId];
        if (!ally || ally.lifeState !== 'DOWNED') return { ok: false, code: 'NOT_DOWNED' };
        if (ally.floor !== p.floor) return { ok: false, code: 'WRONG_FLOOR' };
        const dist = Math.hypot(ally.x - p.x, ally.z - p.z);
        if (dist > 3.2) return { ok: false, code: 'TOO_FAR' };

        const hasMedkit = p.inventory.includes('medkit');
        const requiredSec = hasMedkit ? REVIVE_DURATION_MEDKIT_SEC : REVIVE_DURATION_NORMAL_SEC;
        const stepSec = Math.max(0.05, Math.min(4.5, intent.dtSec ?? 0.25));
        ally.reviveProgressSec += stepSec;
        if (ally.reviveProgressSec < requiredSec) {
          this.dirtyPlayers.add(ally.id);
          return { ok: true, code: 'REVIVING' };
        }

        if (hasMedkit) {
          p.inventory = p.inventory.filter((it) => it !== 'medkit');
          this.dirtyPlayers.add(p.id);
        }
        ally.lifeState = 'ALIVE';
        ally.alive = true;
        ally.spectating = false;
        ally.capturedInCell = false;
        ally.bleedoutSec = 0;
        ally.reviveProgressSec = 0;
        ally.crouching = false;
        ally.health = Math.max(1, Math.min(ally.maxHealth, hasMedkit ? ally.maxHealth : 1));
        ally.invulnerableTimer = 3.0;
        this.dirtyPlayers.add(ally.id);
        this.emitEvent({ tick: this.state.tick, type: 'player_revived', playerId: p.id, targetId: ally.id });
        return { ok: true, code: 'REVIVED' };
      }

      case 'trigger_bunker_lure': {
        if (this.state.bunkerLureCooldownSec > 0) return { ok: false, code: 'COOLDOWN' };
        if (this.state.securityPowerPct < 5) return { ok: false, code: 'NO_POWER' };
        this.state.bunkerLureCooldownSec = BUNKER_LURE_COOLDOWN_SEC;
        this.state.securityPowerPct = Math.max(0, this.state.securityPowerPct - 5);
        const lx = intent.targetX ?? gridToWorld(17.5);
        const lz = intent.targetZ ?? gridToWorld(11.0);
        this.noiseScratch.push({
          x: lx,
          y: FLOOR_0_Y,
          z: lz,
          floor: 0,
          radius: 36,
          priority: 5,
          source: 'door',
          timestamp: this.state.elapsedSec,
        });
        this.worldFlagsDirty = true;
        this.emitEvent({ tick: this.state.tick, type: 'bunker_lure_fired', playerId: p.id });
        return { ok: true, code: 'LURE_FIRED' };
      }

      case 'give_item': {
        const ally = this.state.players[intent.targetPlayerId];
        if (!ally || ally.lifeState !== 'ALIVE') return { ok: false, code: 'INVALID_ALLY' };
        if (ally.floor !== p.floor || Math.hypot(ally.x - p.x, ally.z - p.z) > 3.0) {
          return { ok: false, code: 'TOO_FAR' };
        }
        const itemType = p.inventory[intent.slotIndex];
        if (!itemType || itemType === 'flashlight') return { ok: false, code: 'CANNOT_GIVE' };
        p.inventory.splice(intent.slotIndex, 1);
        if (!ally.inventory.includes(itemType)) ally.inventory.push(itemType);
        this.dirtyPlayers.add(p.id);
        this.dirtyPlayers.add(ally.id);
        return { ok: true, code: 'GIVEN' };
      }

      case 'oil_door': {
        if (!p.inventory.includes('oil_can')) return { ok: false, code: 'NEEDS_OIL_CAN' };
        const ds = this.state.doors[intent.doorId];
        if (!ds) return { ok: false, code: 'UNKNOWN_DOOR' };
        ds.oiled = true;
        this.dirtyDoors.add(intent.doorId);
        return { ok: true, code: 'DOOR_OILED' };
      }

      case 'throw_alarm_clock': {
        if (!p.inventory.includes('alarm_clock') && p.throwables <= 0) {
          return { ok: false, code: 'NO_DISTRACTION' };
        }
        p.inventory = p.inventory.filter((it) => it !== 'alarm_clock');
        this.dirtyPlayers.add(p.id);
        this.noiseScratch.push({
          x: intent.x,
          y: p.y,
          z: intent.z,
          floor: p.floor,
          radius: 30,
          priority: 5,
          source: 'thrown_object',
          timestamp: this.state.elapsedSec,
        });
        return { ok: true, code: 'ALARM_THROWN' };
      }

      case 'fire_polaroid': {
        if (!p.inventory.includes('polaroid_camera') || p.polaroidCharges <= 0) {
          return { ok: false, code: 'NO_POLAROID_CHARGES' };
        }
        p.polaroidCharges -= 1;
        this.state.puzzles.polaroidClueRevealed = true;
        this.dirtyPlayers.add(p.id);
        this.worldFlagsDirty = true;

        // 3.0s Flash Stun if P. Drizzy is within 11m in front on same floor with LOS
        const dx = this.state.diddy.x - p.x;
        const dz = this.state.diddy.z - p.z;
        const dist = Math.hypot(dx, dz);
        const hFwdX = -Math.sin(intent.yaw);
        const hFwdZ = -Math.cos(intent.yaw);
        const dot = dist > 0.01 ? (dx * hFwdX + dz * hFwdZ) / dist : 1;
        if (
          this.state.diddy.floor === p.floor &&
          dist <= 11.5 &&
          dot >= 0.65 &&
          hasWallLineOfSight(this.layout, p.x, p.z, this.state.diddy.x, this.state.diddy.z, p.floor)
        ) {
          this.ai.stun(3.0);
          this.state.diddy.state = 'stunned';
          this.state.diddy.stunnedTimer = 3.0;
          this.diddyDirty = true;
          this.emitEvent({ tick: this.state.tick, type: 'diddy_stunned', playerId: p.id, detail: 'polaroid' });
          return { ok: true, code: 'POLAROID_STUN_AND_REVEAL' };
        }
        return { ok: true, code: 'POLAROID_REVEALED' };
      }

      case 'use_freq_pills': {
        if (!p.inventory.includes('freq_pills')) return { ok: false, code: 'NO_PILLS' };
        p.inventory = p.inventory.filter((it) => it !== 'freq_pills');
        p.neuralInterference = 0;
        this.dirtyPlayers.add(p.id);
        return { ok: true, code: 'INTERFERENCE_CLEARED' };
      }

      case 'place_bookshelf_emblem': {
        if (!p.inventory.includes(intent.emblem)) return { ok: false, code: 'MISSING_EMBLEM' };
        if (!this.state.puzzles.bookshelfEmblemsPlaced.includes(intent.emblem)) {
          p.inventory = p.inventory.filter((it) => it !== intent.emblem);
          this.state.puzzles.bookshelfEmblemsPlaced.push(intent.emblem);
          this.dirtyPlayers.add(p.id);
        }
        if (this.state.puzzles.bookshelfEmblemsPlaced.length >= 2) {
          this.state.puzzles.bookshelfOpened = true;
          this.worldFlagsDirty = true;
          this.emitEvent({ tick: this.state.tick, type: 'puzzle_solved', playerId: p.id, detail: 'false_bookshelf' });
          return { ok: true, code: 'BOOKSHELF_OPENED' };
        }
        return { ok: true, code: 'EMBLEM_PLACED' };
      }

      case 'input_piano_note': {
        const expected = ['C', 'E', 'G', 'B'];
        const nextIdx = this.state.puzzles.pianoNotesEntered.length;
        if (intent.note.toUpperCase() === expected[nextIdx]) {
          this.state.puzzles.pianoNotesEntered.push(intent.note.toUpperCase());
          if (this.state.puzzles.pianoNotesEntered.length >= expected.length) {
            this.state.puzzles.pianoSolved = true;
            this.worldFlagsDirty = true;
            this.emitEvent({ tick: this.state.tick, type: 'puzzle_solved', playerId: p.id, detail: 'piano_clock' });
            return { ok: true, code: 'PIANO_SOLVED' };
          }
          return { ok: true, code: 'NOTE_ACCEPTED' };
        }
        this.state.puzzles.pianoNotesEntered = [];
        return { ok: false, code: 'WRONG_NOTE' };
      }

      case 'turn_steam_valve': {
        const order = [2, 1, 3];
        const nextIdx = this.state.puzzles.steamValvesTurned.length;
        if (intent.valveIndex === order[nextIdx]) {
          this.state.puzzles.steamValvesTurned.push(intent.valveIndex);
          if (this.state.puzzles.steamValvesTurned.length >= order.length) {
            this.state.puzzles.steamSolved = true;
            this.worldFlagsDirty = true;
            this.emitEvent({ tick: this.state.tick, type: 'puzzle_solved', playerId: p.id, detail: 'steam_valves' });
            return { ok: true, code: 'STEAM_CLEARED' };
          }
          return { ok: true, code: 'VALVE_TURNED' };
        }
        this.state.puzzles.steamValvesTurned = [];
        return { ok: false, code: 'WRONG_VALVE_ORDER' };
      }

      case 'install_garage_part': {
        if (!p.inventory.includes(intent.part)) return { ok: false, code: 'MISSING_CAR_PART' };
        if (!this.state.puzzles.garageCarParts.includes(intent.part)) {
          p.inventory = p.inventory.filter((it) => it !== intent.part);
          this.state.puzzles.garageCarParts.push(intent.part);
          this.dirtyPlayers.add(p.id);
        }
        if (this.state.puzzles.garageCarParts.length >= 3) {
          this.state.puzzles.garageCarReady = true;
          this.worldFlagsDirty = true;
          this.triggerEnding('good');
          return { ok: true, code: 'GARAGE_CAR_ESCAPED' };
        }
        return { ok: true, code: 'CAR_PART_INSTALLED' };
      }

      case 'final_gate_install_fuse': {
        if (this.state.finalGate.fusesRestored >= 2) return { ok: true, code: 'FUSES_COMPLETE' };
        if (!p.inventory.includes('fuse')) return { ok: false, code: 'NEEDS_FUSE' };
        const idx = p.inventory.indexOf('fuse');
        if (idx >= 0) p.inventory.splice(idx, 1);
        this.state.finalGate.fusesRestored += 1;
        this.dirtyPlayers.add(p.id);
        this.worldFlagsDirty = true;
        return { ok: true, code: this.state.finalGate.fusesRestored >= 2 ? 'STAGE_1_COMPLETE' : 'FUSE_1_RESTORED' };
      }

      case 'final_gate_cut_chain': {
        if (this.state.finalGate.fusesRestored < 2) return { ok: false, code: 'NEEDS_STAGE_1_FUSES' };
        if (this.state.finalGate.chainsCut >= 2) return { ok: true, code: 'CHAINS_COMPLETE' };
        if (!p.inventory.includes('wire_cutters')) return { ok: false, code: 'NEEDS_WIRE_CUTTERS' };
        this.state.finalGate.chainsCut += 1;
        this.worldFlagsDirty = true;
        return { ok: true, code: this.state.finalGate.chainsCut >= 2 ? 'STAGE_2_COMPLETE' : 'CHAIN_1_CUT' };
      }

      case 'final_gate_submit_master_code': {
        if (this.state.finalGate.chainsCut < 2) return { ok: false, code: 'NEEDS_STAGE_2_CHAINS' };
        if (!this.state.finalGate.masterKeyInserted) {
          if (!p.inventory.includes('master_key')) return { ok: false, code: 'NEEDS_MASTER_KEY' };
          p.inventory = p.inventory.filter((it) => it !== 'master_key');
          this.state.finalGate.masterKeyInserted = true;
          this.dirtyPlayers.add(p.id);
        }
        if (intent.code !== this.state.finalGate.sixDigitCode) {
          return { ok: false, code: 'WRONG_6_DIGIT_CODE' };
        }
        this.state.finalGate.sixDigitCodeVerified = true;
        this.worldFlagsDirty = true;
        return { ok: true, code: 'STAGE_3_COMPLETE' };
      }

      case 'final_gate_pull_lever': {
        if (!this.state.finalGate.sixDigitCodeVerified) return { ok: false, code: 'NEEDS_STAGE_3_CODE' };
        if (this.state.finalGate.sirenActive || this.state.finalGate.gateFullyOpen) {
          return { ok: true, code: 'SIREN_ALREADY_ACTIVE' };
        }
        // Co-op lever pull is 2x faster when 2+ players pull together!
        const helpers = Math.max(1, Math.min(2, intent.helpersCount ?? 1));
        const pullRate = helpers >= 2 ? 1.0 : 0.5;
        this.state.finalGate.hydraulicLeverProgress = Math.min(
          1,
          this.state.finalGate.hydraulicLeverProgress + (intent.dtSec ?? 2.0) * pullRate
        );
        if (this.state.finalGate.hydraulicLeverProgress < 1) {
          return { ok: true, code: 'PULLING_LEVER' };
        }
        this.state.finalGate.hydraulicLeverPulled = true;
        this.state.finalGate.sirenActive = true;
        this.state.finalGate.sirenRemainingSec = FINAL_GATE_SIREN_SEC;
        this.worldFlagsDirty = true;
        this.emitEvent({ tick: this.state.tick, type: 'final_gate_siren', playerId: p.id });
        return { ok: true, code: 'SIREN_15S_STARTED' };
      }

      case 'trigger_creak_board': {
        if (p.crouching) return { ok: true, code: 'SILENT_CROUCH' };
        this.noiseScratch.push({
          x: intent.x,
          y: p.y,
          z: intent.z,
          floor: p.floor,
          radius: 17,
          priority: 3,
          source: 'sprint',
          timestamp: this.state.elapsedSec,
        });
        return { ok: true, code: 'CREAK_ALERT' };
      }
    }
  }

  /** Authoritative damage helper (triggers DOWNED in MP, CAPTURED in Solo without Adrenaline) */
  public applyDamageToPlayer(playerId: string): void {
    const p = this.state.players[playerId];
    if (!p || !p.connected || p.lifeState === 'DEAD_SPECTATING' || p.lifeState === 'CAPTURED') return;
    this.applyDiddyHitToPlayer(p);
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
