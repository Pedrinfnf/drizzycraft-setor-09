import type {
  DiddyAiState,
  DiddyAnimState,
  Difficulty,
  EndingId,
  FloorId,
  ItemType,
  MatchPhase,
  PerkId,
  PlayerLifeState,
  WorldPickupType,
} from '../types';

export type { MatchPhase, PlayerLifeState };

export const SERVER_TICK_MS = 10;
export const SERVER_TICK_SEC = 0.01;
export const SERVER_MAX_FRAME_DT = 0.05; // Strict 50ms clamp eliminates teleportation on Host FPS/network spikes
export const BROADCAST_INTERVAL_TICKS = 3; // 33.3Hz compact delta broadcast
export const SELF_HEAL_SNAPSHOT_TICKS = 200; // Full reconciliation snapshot every 2.0s
export const LAG_COMP_HISTORY_TICKS = 30; // 300ms hitbox lag-compensation ring buffer
export const DOWNED_BLEEDOUT_SEC = 35.0;
export const REVIVE_DURATION_NORMAL_SEC = 4.0;
export const REVIVE_DURATION_MEDKIT_SEC = 2.0;
export const BUNKER_LURE_COOLDOWN_SEC = 25.0;
export const FINAL_GATE_SIREN_SEC = 15.0;

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
  lifeState: PlayerLifeState;
  bleedoutSec: number;
  reviveProgressSec: number;
  captureCount: number;
  capturedInCell: boolean;
  spectating: boolean;
  polaroidCharges: number;
  neuralInterference: number;
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
  /** Explicit inverse of isUnlocked so locked/open are always tracked independently */
  locked: boolean;
  oiled?: boolean;
  planksRemoved: boolean;
  electronicUnlocked: boolean;
}

export interface MansionPuzzlesState {
  bookshelfEmblemsPlaced: ('emblem_sun' | 'emblem_moon')[];
  bookshelfOpened: boolean;
  pianoNotesEntered: string[];
  pianoSolved: boolean;
  steamValvesTurned: number[];
  steamSolved: boolean;
  polaroidClueRevealed: boolean;
  garageCarParts: ('car_battery' | 'gas_can' | 'garage_key')[];
  garageCarReady: boolean;
}

export interface FinalGateProtocolState {
  fusesRestored: number; // 0..2
  chainsCut: number; // 0..2
  masterKeyInserted: boolean;
  sixDigitCodeVerified: boolean;
  sixDigitCode: string; // Split between SecurityBunker CRT (first 3) & Secret Attic (last 3)
  hydraulicLeverProgress: number; // 0..1 (2x faster with 2 players!)
  hydraulicLeverPulled: boolean;
  sirenActive: boolean;
  sirenRemainingSec: number; // 15.0s countdown while gate rises slowly
  gateFullyOpen: boolean;
}

export interface AtmosphericEventState {
  corridorPowerDipSec: number;
  thunderFlashIntensity: number;
  nextEventTimerSec: number;
}

export interface GameWorldState {
  tick: number;
  serverTimeMs: number;
  seed: number;
  difficulty: Difficulty;
  elapsedSec: number;
  phase: 'lobby' | 'playing' | 'ended';
  matchPhase: MatchPhase;
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
  bunkerLeftClosed: boolean;
  bunkerRightClosed: boolean;
  bunkerLureCooldownSec: number;
  puzzles: MansionPuzzlesState;
  finalGate: FinalGateProtocolState;
  atmosphere: AtmosphericEventState;
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
  | { type: 'toggle_bunker_door'; side: 'left' | 'right' }
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
  | { type: 'capture_player'; targetPlayerId: string }
  | { type: 'revive_ally'; targetPlayerId: string; dtSec?: number }
  | { type: 'trigger_bunker_lure'; targetX?: number; targetZ?: number }
  | { type: 'give_item'; targetPlayerId: string; slotIndex: number }
  | { type: 'oil_door'; doorId: string }
  | { type: 'throw_alarm_clock'; x: number; z: number }
  | { type: 'fire_polaroid'; yaw: number; pitch: number }
  | { type: 'use_freq_pills' }
  | { type: 'place_bookshelf_emblem'; emblem: 'emblem_sun' | 'emblem_moon' }
  | { type: 'input_piano_note'; note: string }
  | { type: 'turn_steam_valve'; valveIndex: 1 | 2 | 3 }
  | { type: 'install_garage_part'; part: 'car_battery' | 'gas_can' | 'garage_key' }
  | { type: 'final_gate_install_fuse' }
  | { type: 'final_gate_cut_chain' }
  | { type: 'final_gate_submit_master_code'; code: string }
  | { type: 'final_gate_pull_lever'; dtSec?: number; helpersCount?: number }
  | { type: 'trigger_creak_board'; x: number; z: number };

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
    | 'player_downed'
    | 'player_revived'
    | 'player_spectating'
    | 'player_rescued'
    | 'bunker_lure_fired'
    | 'puzzle_solved'
    | 'final_gate_siren'
    | 'ending_triggered';
  playerId?: string;
  targetId?: string;
  detail?: string;
}
