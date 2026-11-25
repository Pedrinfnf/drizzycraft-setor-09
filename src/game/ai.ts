import type {
  DiddyAiState,
  DiddyAnimState,
  DifficultyConfig,
  DoorDefinition,
  FloorId,
  HidingSpotDefinition,
  NoiseEvent,
} from './types';
import {
  CELL_SIZE,
  CELL_STAIR,
  CELL_VENT,
  CELL_VOID,
  CELL_WALL,
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  GRID_H,
  GRID_W,
  cellIdx,
  getStairHeightAt,
  gridToWorld,
  inBounds,
  isCellSolidForActor,
  isDoorBlockingCell,
  isSightlineBlockedByFurniture,
  resolveWorldMovement,
  worldToGrid,
  type MansionLayout,
} from './mansionMap';

interface AStarNode {
  gx: number;
  gz: number;
  floor: FloorId;
  g: number;
  f: number;
}

class MinHeap {
  private data: AStarNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: AStarNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[idx].f >= this.data[parent].f) break;
      const tmp = this.data[idx];
      this.data[idx] = this.data[parent];
      this.data[parent] = tmp;
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = idx;
      const l = idx * 2 + 1;
      const r = idx * 2 + 2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === idx) break;
      const tmp = this.data[idx];
      this.data[idx] = this.data[smallest];
      this.data[smallest] = tmp;
      idx = smallest;
    }
  }
}

function nodeKey(gx: number, gz: number, floor: FloorId): number {
  const fBit = floor === 0 ? 0 : 1;
  return (fBit * GRID_H + gz) * GRID_W + gx;
}

function isWalkableForEnemy(
  layout: MansionLayout,
  gx: number,
  gz: number,
  floor: FloorId
): boolean {
  if (!inBounds(gx, gz)) return false;
  const grid = floor === 0 ? layout.floor0 : layout.floorMinus1;
  const cell = grid[cellIdx(gx, gz)];
  // P. Diddy can NEVER enter CELL_VENT (low ventilation ducts)!
  if (cell === CELL_VOID || cell === CELL_WALL || cell === CELL_VENT) return false;
  const blockingDoor = isDoorBlockingCell(layout.doors, gx, gz, floor, true);
  if (blockingDoor) return false;
  return true;
}

export interface PathNode {
  x: number;
  y: number;
  z: number;
  floor: FloorId;
}

export function findDualFloorPath(
  layout: MansionLayout,
  startX: number,
  startFloor: FloorId,
  startZ: number,
  goalX: number,
  goalFloor: FloorId,
  goalZ: number,
  maxExpanded = 1600
): PathNode[] {
  const sgx = Math.max(0, Math.min(GRID_W - 1, worldToGrid(startX)));
  const sgz = Math.max(0, Math.min(GRID_H - 1, worldToGrid(startZ)));
  const ggx = Math.max(0, Math.min(GRID_W - 1, worldToGrid(goalX)));
  const ggz = Math.max(0, Math.min(GRID_H - 1, worldToGrid(goalZ)));

  const startKey = nodeKey(sgx, sgz, startFloor);
  const goalKey = nodeKey(ggx, ggz, goalFloor);

  if (startKey === goalKey) {
    return [
      {
        x: gridToWorld(ggx),
        y: goalFloor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y,
        z: gridToWorld(ggz),
        floor: goalFloor,
      },
    ];
  }

  const heap = new MinHeap();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();

  const heuristic = (gx: number, gz: number, fl: FloorId) => {
    const manhattan = Math.abs(gx - ggx) + Math.abs(gz - ggz);
    const floorPenalty = fl === goalFloor ? 0 : 12;
    return manhattan + floorPenalty;
  };

  gScore.set(startKey, 0);
  heap.push({
    gx: sgx,
    gz: sgz,
    floor: startFloor,
    g: 0,
    f: heuristic(sgx, sgz, startFloor),
  });

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let expanded = 0;
  let bestKey = startKey;
  let bestH = heuristic(sgx, sgz, startFloor);

  while (heap.size > 0 && expanded < maxExpanded) {
    const cur = heap.pop()!;
    const curKey = nodeKey(cur.gx, cur.gz, cur.floor);
    if (closed.has(curKey)) continue;
    closed.add(curKey);
    expanded++;

    if (curKey === goalKey) {
      bestKey = curKey;
      break;
    }

    const curH = heuristic(cur.gx, cur.gz, cur.floor);
    if (curH < bestH) {
      bestH = curH;
      bestKey = curKey;
    }

    for (const [dx, dz] of dirs) {
      const ngx = cur.gx + dx;
      const ngz = cur.gz + dz;
      if (!isWalkableForEnemy(layout, ngx, ngz, cur.floor)) continue;

      const nKey = nodeKey(ngx, ngz, cur.floor);
      if (closed.has(nKey)) continue;

      const tentativeG = cur.g + 1;
      const prevG = gScore.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, curKey);
        heap.push({
          gx: ngx,
          gz: ngz,
          floor: cur.floor,
          g: tentativeG,
          f: tentativeG + heuristic(ngx, ngz, cur.floor),
        });
      }
    }

    const grid = cur.floor === 0 ? layout.floor0 : layout.floorMinus1;
    if (grid[cellIdx(cur.gx, cur.gz)] === CELL_STAIR) {
      const otherFloor: FloorId = cur.floor === 0 ? -1 : 0;
      if (isWalkableForEnemy(layout, cur.gx, cur.gz, otherFloor)) {
        const nKey = nodeKey(cur.gx, cur.gz, otherFloor);
        if (!closed.has(nKey)) {
          const tentativeG = cur.g + 2.5;
          const prevG = gScore.get(nKey);
          if (prevG === undefined || tentativeG < prevG) {
            gScore.set(nKey, tentativeG);
            cameFrom.set(nKey, curKey);
            heap.push({
              gx: cur.gx,
              gz: cur.gz,
              floor: otherFloor,
              g: tentativeG,
              f: tentativeG + heuristic(cur.gx, cur.gz, otherFloor),
            });
          }
        }
      }
    }
  }

  const path: PathNode[] = [];
  let trace: number | undefined = bestKey;
  while (trace !== undefined && trace !== startKey) {
    const fBit = Math.floor(trace / (GRID_W * GRID_H));
    const rem = trace % (GRID_W * GRID_H);
    const gz = Math.floor(rem / GRID_W);
    const gx = rem % GRID_W;
    const fl: FloorId = fBit === 0 ? 0 : -1;
    const wx = gridToWorld(gx);
    const wz = gridToWorld(gz);
    const baseFloorY = fl === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    const st = getStairHeightAt(wx, wz, baseFloorY);
    path.push({
      x: wx,
      y: st.onStair ? st.y : baseFloorY,
      z: wz,
      floor: fl,
    });
    trace = cameFrom.get(trace);
  }
  path.reverse();
  return path;
}

/**
 * Unobstructed Raycast Line-of-Sight check (respects solid walls, closed doors, low vents AND solid furniture colliders!).
 * When `targetEyeHeight` is crouched (~0.82m), tables/desks/beds/cabinets completely block P. Drizzy's vision (ZERO WALLHACK).
 */
export function hasLineOfSight(
  layout: MansionLayout,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  floor: FloorId,
  targetEyeHeight = 1.55
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.25) return true;
  const steps = Math.ceil(dist / 0.45);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = x0 + dx * t;
    const sz = z0 + dz * t;
    const gx = worldToGrid(sx);
    const gz = worldToGrid(sz);
    if (!inBounds(gx, gz)) return false;
    const grid = floor === 0 ? layout.floor0 : layout.floorMinus1;
    const cell = grid[cellIdx(gx, gz)];
    if (cell === CELL_WALL || cell === CELL_VOID) return false;
    // Closed FNAF blast doors and closed locked doors block vision!
    const door = isDoorBlockingCell(layout.doors, gx, gz, floor, false);
    if (door && !door.isOpen) return false;
  }
  if (isSightlineBlockedByFurniture(layout, x0, z0, x1, z1, floor, targetEyeHeight)) {
    return false;
  }
  return true;
}

export interface DiddyAiTickInput {
  dt: number;
  elapsedSec: number;
  layout: MansionLayout;
  diff: DifficultyConfig;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerFloor: FloorId;
  playerCrouching: boolean;
  playerInVent?: boolean;
  playerFlashlightOn: boolean;
  playerHidingSpot: HidingSpotDefinition | null;
  playerEnteredHidingThisFrame: boolean;
  playerInvulnerable?: boolean;
  blackoutAlertActive?: boolean;
  noiseEvents: NoiseEvent[];
}

export interface DiddyAiEvents {
  footstepTriggered: boolean;
  breachedDoor: DoorDefinition | null;
  spottedPlayer: boolean;
  hitPlayer: boolean;
  pulledFromHidingSpot: HidingSpotDefinition | null;
  inspectingHidingSpot: HidingSpotDefinition | null;
}

/**
 * Humanized, Fair P. Diddy AI Controller:
 *  - Spawns far opposite player with a strict 5.0s initial delay.
 *  - ZERO path prediction & ZERO wallhack tracking: only pursues live LOS or heard noise.
 *  - Gives up after 4.0s without LOS and picks a DISTANT patrol waypoint (zero camping!).
 *  - 100% fair hiding spots: NEVER pulls player out unless he genuinely had direct LOS when entering.
 *  - Cannot enter Voxel Ventilation Ducts (CELL_VENT) and cannot breach powered FNAF Blast Doors!
 */
export class DiddyAiController {
  x = 0;
  y = FLOOR_0_Y;
  z = 0;
  yaw = 0;
  floor: FloorId = 0;
  state: DiddyAiState = 'patrol';
  animState: DiddyAnimState = 'idle';

  private path: PathNode[] = [];
  private pathRecalcTimer = 0;
  private patrolIndex = 0;
  private patrolPauseTimer = 0;

  private lastKnownPlayerPos: PathNode | null = null;
  private timeSinceSeenPlayer = 99;
  private investigateTarget: PathNode | null = null;
  private investigateTimer = 0;

  private spottedHidingSpot: HidingSpotDefinition | null = null;
  private inspectingSpot: HidingSpotDefinition | null = null;
  private checkedHidingCooldowns = new Map<string, number>();
  private searchHidingTimer = 0;

  private stunTimer = 0;
  private hitCooldown = 0;
  private breachAnimTimer = 0;
  private stepDistAccum = 0;
  private gracePeriodSec = 5.0; // Strict 5.0s opening delay!

  reset(layout: MansionLayout): void {
    this.x = layout.diddySpawnPoint.x;
    this.y = layout.diddySpawnPoint.y;
    this.z = layout.diddySpawnPoint.z;
    this.floor = layout.diddySpawnPoint.floor;
    this.yaw = 0;
    this.state = 'patrol';
    this.animState = 'idle';
    this.path = [];
    this.pathRecalcTimer = 0;
    this.patrolIndex = 0;
    this.patrolPauseTimer = 0.5;
    this.lastKnownPlayerPos = null;
    this.timeSinceSeenPlayer = 99;
    this.investigateTarget = null;
    this.investigateTimer = 0;
    this.spottedHidingSpot = null;
    this.inspectingSpot = null;
    this.checkedHidingCooldowns.clear();
    this.searchHidingTimer = 0;
    this.stunTimer = 0;
    this.hitCooldown = 0;
    this.breachAnimTimer = 0;
    this.stepDistAccum = 0;
  }

  /** Called by HorrorEngine when the Hold-Breath Minigame finishes (survived => P. Drizzy leaves safely!). */
  resolveHidingInspection(survived: boolean, layout: MansionLayout): void {
    const spot = this.inspectingSpot;
    this.inspectingSpot = null;
    if (survived) {
      if (spot) {
        this.checkedHidingCooldowns.set(spot.id, 28.0);
      }
      this.spottedHidingSpot = null;
      this.investigateTarget = null;
      this.lastKnownPlayerPos = null;
      this.state = 'patrol';
      this.animState = 'patrol';
      this.patrolIndex = this.pickDistantPatrolIndex(layout, this.x, this.z);
      this.patrolPauseTimer = 0.5;
      this.path = [];
    } else if (spot) {
      this.spottedHidingSpot = spot;
      this.state = 'search_hiding';
      this.searchHidingTimer = 0.65;
      this.path = [];
    }
  }

  /** Used for showcase/testing to initiate a Hold-Breath inspection immediately. */
  forceInspectHidingSpot(spot: HidingSpotDefinition): void {
    this.inspectingSpot = spot;
    this.spottedHidingSpot = null;
    this.state = 'inspecting_hiding';
    this.animState = 'search_hiding';
    this.x = spot.x + Math.sin(spot.facingYaw) * 1.55;
    this.y = spot.y;
    this.z = spot.z + Math.cos(spot.facingYaw) * 1.55;
    this.floor = spot.floor;
    this.yaw = Math.atan2(spot.x - this.x, spot.z - this.z);
    this.path = [];
  }

  stun(durationSec: number): void {
    this.stunTimer = Math.max(this.stunTimer, durationSec);
    this.state = 'stunned';
    this.animState = 'stunned';
    this.spottedHidingSpot = null;
    this.inspectingSpot = null;
    this.lastKnownPlayerPos = null;
    this.investigateTarget = null;
    this.timeSinceSeenPlayer = 99;
    this.path = [];
  }

  getDistanceTo(px: number, py: number, pz: number): number {
    return Math.hypot(this.x - px, (this.y - py) * 1.5, this.z - pz);
  }

  private pickDistantPatrolIndex(layout: MansionLayout, avoidX: number, avoidZ: number): number {
    const unlockedBasement = layout.doors.some(
      (d) => d.lockType === 'basement_key' && d.isUnlocked
    );
    const candidates: number[] = [];
    for (let i = 0; i < layout.patrolWaypoints.length; i++) {
      const wp = layout.patrolWaypoints[i];
      if (wp.floor === -1 && !unlockedBasement) continue;
      const d = Math.hypot(wp.x - avoidX, wp.z - avoidZ);
      if (d >= 12.0) candidates.push(i);
    }
    if (candidates.length === 0) {
      return (this.patrolIndex + 2) % Math.max(1, layout.patrolWaypoints.length);
    }
    return candidates[(this.patrolIndex + 1 + Math.floor(Math.random() * candidates.length)) % candidates.length];
  }

  tick(input: DiddyAiTickInput): DiddyAiEvents {
    const events: DiddyAiEvents = {
      footstepTriggered: false,
      breachedDoor: null,
      spottedPlayer: false,
      hitPlayer: false,
      pulledFromHidingSpot: null,
      inspectingHidingSpot: null,
    };

    if (!input.diff.diddyActive) {
      this.animState = 'idle';
      return events;
    }

    const { dt, layout, diff } = input;
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.breachAnimTimer > 0) this.breachAnimTimer -= dt;
    for (const [sid, cd] of this.checkedHidingCooldowns) {
      if (cd - dt <= 0) this.checkedHidingCooldowns.delete(sid);
      else this.checkedHidingCooldowns.set(sid, cd - dt);
    }

    // 1. Stunned State (Stun Gun 12s/9s/6s or Flare)
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.state = 'stunned';
      this.animState = 'stunned';
      if (this.stunTimer <= 0) {
        this.state = 'patrol';
        this.patrolIndex = this.pickDistantPatrolIndex(layout, this.x, this.z);
        this.path = [];
      }
      return events;
    }

    // 2. Strict 5.0-second initial spawn delay
    if (input.elapsedSec < this.gracePeriodSec) {
      this.state = 'patrol';
      this.animState = 'idle';
      return events;
    }

    // 3. Fair Vision & Hearing Sensory Evaluation (ZERO WALLHACK / ZERO PATH PREDICTION!)
    const distToPlayer = Math.hypot(input.playerX - this.x, input.playerZ - this.z);
    const sameFloor = input.playerFloor === this.floor;

    let effectiveVision = diff.diddyVisionRange;
    if (input.playerCrouching) effectiveVision *= 0.68;
    if (input.playerFlashlightOn) effectiveVision *= 1.18;
    if (input.playerInVent) effectiveVision *= 0.45; // Hard to spot inside dark low vents!

    const targetEyeHeight = input.playerCrouching ? 0.82 : 1.55;
    const hasDirectLosNow =
      sameFloor &&
      distToPlayer <= effectiveVision &&
      hasLineOfSight(layout, this.x, this.z, input.playerX, input.playerZ, this.floor, targetEyeHeight);

    // 100% Fair Hiding Spots (ZERO auto-hitkill when hidden unseen!)
    if (input.playerHidingSpot) {
      if (input.playerEnteredHidingThisFrame && hasDirectLosNow && distToPlayer <= effectiveVision * 0.92) {
        // He directly watched you enter the hiding spot -> immediate pull-out search
        this.spottedHidingSpot = input.playerHidingSpot;
        this.inspectingSpot = null;
        this.state = 'search_hiding';
        this.searchHidingTimer = 0;
        this.path = [];
        events.spottedPlayer = true;
      } else if (
        !this.spottedHidingSpot &&
        this.state !== 'inspecting_hiding' &&
        sameFloor &&
        distToPlayer <= 5.2 &&
        (this.checkedHidingCooldowns.get(input.playerHidingSpot.id) ?? 0) <= 0 &&
        hasLineOfSight(layout, this.x, this.z, input.playerHidingSpot.x, input.playerHidingSpot.z, this.floor)
      ) {
        // P. Drizzy senses something near an unseen hiding spot -> pauses outside & triggers Hold-Breath Minigame!
        this.inspectingSpot = input.playerHidingSpot;
        this.state = 'inspecting_hiding';
        this.path = [];
      }
    } else {
      this.spottedHidingSpot = null;
      if (this.state === 'inspecting_hiding') {
        this.inspectingSpot = null;
        this.state = 'patrol';
      }
    }

    // Active Player Direct Sight Detection (never detects hidden players or players inside unreachable vents)
    const canDirectlySeeActivePlayer = !input.playerHidingSpot && !input.playerInVent && hasDirectLosNow;

    if (canDirectlySeeActivePlayer) {
      if (this.state !== 'chase') {
        events.spottedPlayer = true;
      }
      this.state = 'chase';
      this.inspectingSpot = null;
      this.timeSinceSeenPlayer = 0;
      this.lastKnownPlayerPos = {
        x: input.playerX,
        y: input.playerY,
        z: input.playerZ,
        floor: input.playerFloor,
      };
    } else {
      this.timeSinceSeenPlayer += dt;
    }

    // Acoustic Noise Event Detection (Thrown cans, flares, vent echoes, recharge hum, sprints!)
    if (this.state !== 'chase' && this.state !== 'search_hiding' && this.state !== 'inspecting_hiding') {
      let bestNoise: NoiseEvent | null = null;
      let bestScore = -1;
      for (const n of input.noiseEvents) {
        if (input.playerHidingSpot && n.source === 'hiding') continue;
        const d = Math.hypot(n.x - this.x, n.z - this.z);
        const floorFactor = n.floor === this.floor ? 1.0 : 0.45;
        const heardRange = n.radius * diff.diddyHearingMult * floorFactor;
        if (d <= heardRange) {
          const score = n.priority * 100 - d;
          if (score > bestScore) {
            bestScore = score;
            bestNoise = n;
          }
        }
      }
      if (bestNoise) {
        this.state = 'investigate';
        this.investigateTarget = {
          x: bestNoise.x,
          y: bestNoise.y,
          z: bestNoise.z,
          floor: bestNoise.floor,
        };
        this.investigateTimer = 5.0;
        this.pathRecalcTimer = 0;
      }
    }

    // 4. State Machine Execution (ZERO Camping, ZERO Wallhack!)
    let target: PathNode | null = null;
    // Slight adrenaline patrol speed during Blackout surge (still fair & zero wallhack!)
    const blackoutBoost = input.blackoutAlertActive ? 1.12 : 1.0;
    let moveSpeed = diff.diddyPatrolSpeed * blackoutBoost;

    if (this.state === 'inspecting_hiding' && this.inspectingSpot) {
      // Stop cleanly OUTSIDE the hiding spot (1.55m in front of door) and peer in during Hold-Breath Minigame!
      const standX = this.inspectingSpot.x + Math.sin(this.inspectingSpot.facingYaw) * 1.55;
      const standZ = this.inspectingSpot.z + Math.cos(this.inspectingSpot.facingYaw) * 1.55;
      const distStand = Math.hypot(this.x - standX, this.z - standZ);
      if (distStand <= 1.25 && this.floor === this.inspectingSpot.floor) {
        this.animState = 'search_hiding';
        const desiredYaw = Math.atan2(this.inspectingSpot.x - this.x, this.inspectingSpot.z - this.z);
        let deltaYaw = desiredYaw - this.yaw;
        while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
        while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
        this.yaw += deltaYaw * Math.min(1, dt * 8);
        events.inspectingHidingSpot = this.inspectingSpot;
        return events;
      }
      moveSpeed = diff.diddyPatrolSpeed * 0.92;
      target = {
        x: standX,
        y: this.inspectingSpot.y,
        z: standZ,
        floor: this.inspectingSpot.floor,
      };
    } else if (this.state === 'search_hiding' && this.spottedHidingSpot) {
      moveSpeed = diff.diddyChaseSpeed * 0.88;
      target = {
        x: this.spottedHidingSpot.x,
        y: this.spottedHidingSpot.y,
        z: this.spottedHidingSpot.z,
        floor: this.spottedHidingSpot.floor,
      };
      const distSpot = Math.hypot(this.x - target.x, this.z - target.z);
      if (distSpot < 1.65 && this.floor === target.floor) {
        this.searchHidingTimer += dt;
        this.animState = 'search_hiding';
        this.yaw = Math.atan2(target.x - this.x, target.z - this.z);
        if (this.searchHidingTimer >= 0.7) {
          if (input.playerHidingSpot?.id === this.spottedHidingSpot.id) {
            events.pulledFromHidingSpot = this.spottedHidingSpot;
          }
          this.spottedHidingSpot = null;
          this.state = 'patrol';
          this.patrolIndex = this.pickDistantPatrolIndex(layout, this.x, this.z);
        }
        return events;
      }
    } else if (this.state === 'chase') {
      moveSpeed = diff.diddyChaseSpeed;
      target = this.lastKnownPlayerPos;

      const reachedLastKnown =
        target !== null &&
        this.floor === target.floor &&
        Math.hypot(this.x - target.x, this.z - target.z) < 1.15;

      // Strict 4.0s give-up when LOS is lost
      if (this.timeSinceSeenPlayer >= 4.0 || (reachedLastKnown && !canDirectlySeeActivePlayer)) {
        const leaveX = this.x;
        const leaveZ = this.z;
        this.state = 'patrol';
        this.lastKnownPlayerPos = null;
        this.investigateTarget = null;
        this.patrolIndex = this.pickDistantPatrolIndex(layout, leaveX, leaveZ);
        this.path = [];
        this.patrolPauseTimer = 0.6;
      }
    } else if (this.state === 'investigate' && this.investigateTarget) {
      moveSpeed = diff.diddyPatrolSpeed * 1.15 * blackoutBoost;
      target = this.investigateTarget;
      this.investigateTimer -= dt;
      const distInv = Math.hypot(this.x - target.x, this.z - target.z);
      if ((distInv < 1.25 && this.floor === target.floor) || this.investigateTimer <= 0) {
        this.state = 'patrol';
        this.investigateTarget = null;
        this.patrolIndex = this.pickDistantPatrolIndex(layout, this.x, this.z);
        this.patrolPauseTimer = 0.6;
        this.path = [];
      }
    } else {
      // Patrol
      this.state = 'patrol';
      if (this.patrolPauseTimer > 0) {
        this.patrolPauseTimer -= dt;
        this.animState = 'idle';
        return events;
      }
      const wp = layout.patrolWaypoints[this.patrolIndex % layout.patrolWaypoints.length];
      const unlockedBasement = layout.doors.some(
        (d) => d.lockType === 'basement_key' && d.isUnlocked
      );
      if (wp.floor === -1 && !unlockedBasement) {
        this.patrolIndex = this.pickDistantPatrolIndex(layout, this.x, this.z);
        return events;
      }
      target = wp;
      const distWp = Math.hypot(this.x - wp.x, this.z - wp.z);
      if (distWp < 1.2 && this.floor === wp.floor) {
        this.patrolIndex = this.pickDistantPatrolIndex(layout, wp.x, wp.z);
        this.patrolPauseTimer = 0.65;
        this.path = [];
      }
    }

    // 5. Dual-Floor A* Pathfinding Update
    this.pathRecalcTimer -= dt;
    if (target && (this.path.length === 0 || this.pathRecalcTimer <= 0)) {
      this.path = findDualFloorPath(
        layout,
        this.x,
        this.floor,
        this.z,
        target.x,
        target.floor,
        target.z
      );
      this.pathRecalcTimer = this.state === 'chase' ? 0.35 : 0.75;
    }

    // 6. Follow Path Smoothly (respecting solid walls, CELL_VENT, and powered FNAF blast doors!)
    if (this.path.length > 0) {
      const next = this.path[0];
      const dx = next.x - this.x;
      const dz = next.z - this.z;
      const distNode = Math.hypot(dx, dz);

      if (distNode < 0.45 && (next.floor === this.floor || getStairHeightAt(this.x, this.z, this.y).onStair)) {
        this.path.shift();
      } else if (distNode > 0.001) {
        const step = Math.min(distNode, moveSpeed * dt);
        const mx = (dx / distNode) * step;
        const mz = (dz / distNode) * step;

        // Open unlocked normal wooden doors only (NEVER breach locked doors or closed powered FNAF blast doors!)
        const aheadGx = worldToGrid(this.x + (dx / distNode) * 0.9);
        const aheadGz = worldToGrid(this.z + (dz / distNode) * 0.9);
        const nearDoor = isDoorBlockingCell(layout.doors, aheadGx, aheadGz, this.floor, false);
        if (nearDoor && nearDoor.isUnlocked && !nearDoor.isOpen && nearDoor.lockType !== 'fnaf_blast') {
          nearDoor.isOpen = true;
          this.breachAnimTimer = 0.45;
          events.breachedDoor = nearDoor;
        }

        const prevX = this.x;
        const prevZ = this.z;
        const resolved = resolveWorldMovement(
          layout,
          this.x,
          this.y,
          this.z,
          mx,
          mz,
          0.42,
          true,
          false
        );

        const nextGx = worldToGrid(resolved.x);
        const nextGz = worldToGrid(resolved.z);
        if (!isCellSolidForActor(layout, nextGx, nextGz, resolved.floor, true, false).solid) {
          this.x = resolved.x;
          this.y = resolved.y;
          this.z = resolved.z;
          this.floor = resolved.floor;
        }

        const movedDist = Math.hypot(this.x - prevX, this.z - prevZ);
        if (movedDist < step * 0.15) {
          this.path = [];
          this.pathRecalcTimer = 0.25;
        }

        const desiredYaw = Math.atan2(dx, dz);
        let deltaYaw = desiredYaw - this.yaw;
        while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
        while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
        this.yaw += deltaYaw * Math.min(1, dt * 10);

        this.stepDistAccum += movedDist;
        const stride = this.state === 'chase' ? 1.55 : 1.75;
        if (this.stepDistAccum >= stride) {
          this.stepDistAccum -= stride;
          events.footstepTriggered = true;
        }
      }
    }

    // 7. Melee Catch / Hit Check (respects player invulnerability, hiding, and vents!)
    if (
      !input.playerHidingSpot &&
      !input.playerInVent &&
      !input.playerInvulnerable &&
      this.hitCooldown <= 0 &&
      input.playerFloor === this.floor
    ) {
      const catchDist = Math.hypot(input.playerX - this.x, input.playerZ - this.z);
      if (
        catchDist < 1.12 &&
        hasLineOfSight(layout, this.x, this.z, input.playerX, input.playerZ, this.floor, input.playerCrouching ? 0.82 : 1.55)
      ) {
        events.hitPlayer = true;
        this.hitCooldown = 2.6;
      }
    }

    // 8. Map AI state -> Rig animation state
    if (this.breachAnimTimer > 0) {
      this.animState = 'breach_door';
    } else if (this.state === 'chase') {
      this.animState = 'chase';
    } else if (this.state === 'investigate') {
      this.animState = 'investigate';
    } else {
      this.animState = this.path.length > 0 ? 'patrol' : 'idle';
    }

    return events;
  }
}
