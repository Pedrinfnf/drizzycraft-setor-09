import type {
  DiddyAiState,
  DiddyAnimState,
  Difficulty,
  EndingId,
  FloorId,
  ItemType,
  PerkId,
  WorldPickupType,
} from '../types';

export const SERVER_TICK_MS = 10;
export const SERVER_TICK_SEC = 0.01;
export const SERVER_MAX_FRAME_DT = 0.1; // Clamp accumulator dt so mobile never spirals
export const BROADCAST_INTERVAL_TICKS = 3; // 33.3Hz compact delta broadcast
export const SELF_HEAL_SNAPSHOT_TICKS = 200; // Full reconciliation snapshot every 2.0s
export const LAG_COMP_HISTORY_TICKS = 30; // 300ms hitbox lag-compensation ring buffer

/**
 * Key progression items that MUST auto-drop on accessible ground if a carrier
 * disconnects or gets captured into the basement cell (Anti-Softlock guarantee).
 */
export const KEY_PROGRESSION_ITEMS: readonly ItemType[] = [
  'red_key',
  'blue_key',
  'basement_key',
  'crowbar',
  'crowbar_rod',
  'crowbar_hook',
  'wire_cutters',
  'fuse',
  'master_key',
];

export type PlayerPlatformId = 'touch' | 'pc' | 'gamepad';

export interface PlayerState {
  id: string;
  nickname: string;
  platform: PlayerPlatformId;
  connected: boolean;
  alive: boolean;
  capturedInCell: boolean;
  spectating: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  floor: FloorId;
  crouching: boolean;
  inVent: boolean;
  sprinting: boolean;
  hidingSpotId: string | null;
  health: number;
  maxHealth: number;
  stamina: number;
  staminaExhausted: boolean;
  battery: number;
  maxBattery: number;
  flashlightOn: boolean;
  uvMode: boolean;
  inventory: ItemType[];
  activeSlot: number;
  stunAmmo: number;
  throwables: number;
  flares: number;
  activePerks: PerkId[];
  lastProcessedSeq: number;
  pingMs: number;
  invulnerableTimer: number;
  hitBoostTimer: number;
  adrenalineBurstTimer: number;
}

export interface DiddyServerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  floor: FloorId;
  state: DiddyAiState;
  animState: DiddyAnimState;
  stunnedTimer: number;
  targetPlayerId: string | null;
}

export interface WorldItemServerState {
  id: string;
  itemType: WorldPickupType;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  insideSafe: boolean;
  droppedByPlayer: boolean;
}

export interface DoorServerState {
  id: string;
  isOpen: boolean;
  isUnlocked: boolean;
  planksRemoved: boolean;
  electronicUnlocked: boolean;
}

export interface GameWorldState {
  tick: number;
  serverTimeMs: number;
  seed: number;
  difficulty: Difficulty;
  elapsedSec: number;
  phase: 'lobby' | 'playing' | 'ended';
  endingId: EndingId | null;
  players: Record<string, PlayerState>;
  diddy: DiddyServerState;
  items: Record<string, WorldItemServerState>;
  doors: Record<string, DoorServerState>;
  safeUnlocked: boolean;
  fuseInstalled: boolean;
  generatorFixed: boolean;
  blackoutActive: boolean;
  terminalUnlocked: boolean;
  hatchOpened: boolean;
  securityPowerPct: number;
  fnafLeftClosed: boolean;
  fnafRightClosed: boolean;
  discoveredClueIds: string[];
  discoveredUvMarkIds: string[];
  listenedCassetteIds: string[];
  translationBoardSeen: boolean;
  cctvSecretHintSeen: boolean;
  lightSwitches: Record<string, boolean>;
}

export interface MoveInputIntent {
  type: 'move_input';
  seq: number;
  moveForward: number;
  moveRight: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  crouch: boolean;
  flashlightOn?: boolean;
  uvMode?: boolean;
  pingMs?: number;
}

export type ClientIntent =
  | MoveInputIntent
  | { type: 'pickup_item'; itemId: string }
  | { type: 'drop_item'; slotIndex: number }
  | { type: 'interact_door'; doorId: string }
  | { type: 'toggle_fnaf_door'; side: 'left' | 'right' }
  | { type: 'submit_safe_code'; code: string }
  | { type: 'submit_terminal_code'; code: string }
  | { type: 'interact_generator' }
  | { type: 'interact_hatch' }
  | { type: 'interact_clue'; clueId: string }
  | { type: 'interact_uv_mark'; markId: string }
  | { type: 'interact_cassette'; tapeId: string }
  | { type: 'interact_light_switch'; switchId: string }
  | { type: 'interact_translation_board' }
  | { type: 'seen_cctv_hint' }
  | { type: 'craft_recipe'; recipe: 'crowbar' | 'stun_ammo' }
  | { type: 'fire_stun_gun'; yaw: number; pitch: number; clientTick?: number }
  | { type: 'use_flare'; yaw: number; pitch: number }
  | { type: 'enter_hiding'; spotId: string }
  | { type: 'exit_hiding' }
  | { type: 'rescue_ally'; targetPlayerId: string }
  | { type: 'capture_player'; targetPlayerId: string };

export interface IntentResult {
  ok: boolean;
  code: string;
  message?: string;
}

/**
 * Compact wire delta packet transmitted at 30-35Hz over public wss:// relays
 * to avoid rate-limiting on mobile 4G/5G connections.
 */
export interface CompactDeltaPacket {
  /** Server tick */
  t: number;
  /** Server timestamp ms */
  s: number;
  /** Changed players: [id, lastProcessedSeq, x, y, z, yaw, floor, flagsBitmask] */
  p: Array<[string, number, number, number, number, number, FloorId, number]>;
  /** Diddy state if changed: [x, y, z, yaw, floor, stateIdx] */
  d?: [number, number, number, number, FloorId, number];
  /** Discrete world state deltas (only included when changed) */
  e?: {
    phase?: GameWorldState['phase'];
    endingId?: EndingId | null;
    safeUnlocked?: boolean;
    generatorFixed?: boolean;
    fuseInstalled?: boolean;
    blackoutActive?: boolean;
    terminalUnlocked?: boolean;
    hatchOpened?: boolean;
    doors?: Record<string, DoorServerState>;
    items?: Record<string, WorldItemServerState>;
  };
}

export interface ServerEvent {
  tick: number;
  type:
    | 'item_collected'
    | 'item_dropped'
    | 'door_changed'
    | 'safe_unlocked'
    | 'generator_fixed'
    | 'terminal_unlocked'
    | 'diddy_stunned'
    | 'player_hit'
    | 'player_captured'
    | 'player_rescued'
    | 'ending_triggered';
  playerId?: string;
  targetId?: string;
  detail?: string;
}
