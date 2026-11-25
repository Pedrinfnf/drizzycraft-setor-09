export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Difficulty = 'practice' | 'easy' | 'hard' | 'nightmare';

export type FloorId = 0 | -1;

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type InputMode = 'touch' | 'pc' | 'gamepad';

export type GamepadGlyphStyle = 'playstation' | 'xbox';

export type GamepadProfile = 'auto' | 'standard' | 'ds4_android';

export type GameMode =
  | 'title'
  | 'intro_cutscene'
  | 'playing'
  | 'paused'
  | 'ending_cutscene'
  | 'jumpscare'
  | 'victory'
  | 'defeat';

export type MatchPhase =
  | 'LOBBY'
  | 'INTRO'
  | 'PLAYING'
  | 'ENDED_VICTORY'
  | 'ENDED_WIPEOUT';

export type PlayerLifeState =
  | 'ALIVE'
  | 'DOWNED'
  | 'CAPTURED'
  | 'DEAD_SPECTATING';

export type ItemType =
  | 'flashlight'
  | 'stun_gun'
  | 'throwable_can'
  | 'red_key'
  | 'blue_key'
  | 'basement_key'
  | 'crowbar'
  | 'crowbar_rod'
  | 'crowbar_hook'
  | 'stun_coil'
  | 'stun_cell'
  | 'fuse'
  | 'wire_cutters'
  | 'master_key'
  | 'flare'
  | 'oil_can'
  | 'alarm_clock'
  | 'polaroid_camera'
  | 'lockpick'
  | 'cell_key'
  | 'medkit'
  | 'gas_can'
  | 'car_battery'
  | 'garage_key'
  | 'freq_pills'
  | 'emblem_sun'
  | 'emblem_moon';

export type WorldPickupType = ItemType | 'battery' | 'stun_ammo';

export type DoorLockType =
  | 'none'
  | 'red_key'
  | 'blue_key'
  | 'basement_key'
  | 'crowbar_planks'
  | 'wire_cutters'
  | 'bunker_blast'
  | 'master_exit';

export type HidingSpotKind = 'locker' | 'under_table' | 'under_bed';

export type SurfaceType =
  | 'wood'
  | 'concrete'
  | 'tile'
  | 'basement_wet'
  | 'stone'
  | 'vent_metal';

export type DiddyAiState =
  | 'patrol'
  | 'investigate'
  | 'chase'
  | 'inspecting_hiding'
  | 'search_hiding'
  | 'stunned';

export type DiddyAnimState =
  | 'idle'
  | 'patrol'
  | 'investigate'
  | 'chase'
  | 'breach_door'
  | 'search_hiding'
  | 'stunned'
  | 'jumpscare';

export type ReticleState = 'idle' | 'interact' | 'pickup' | 'locked' | 'hide';

export type JoystickMode = 'fixed' | 'floating';

export type HudControlId =
  | 'joystick'
  | 'interact'
  | 'sprint'
  | 'crouch'
  | 'flashlight'
  | 'uv'
  | 'drop'
  | 'backpack'
  | 'pause';

export interface HudControlLayout {
  xPct: number; // 4..96 viewport width %
  yPct: number; // 6..94 viewport height %
  scale: number; // 0.7..1.5
  opacity: number; // 0.3..1.0
}

export type HudCustomLayout = Partial<Record<HudControlId, HudControlLayout>>;

export type ShadowQualityLevel = 'off' | 'low' | 'medium' | 'high' | 'ultra';
export type TextureQualityLevel = 'low' | 'medium' | 'high';
export type SubtitleSize = 'sm' | 'md' | 'lg';
export type MinimapSizeOption = 'sm' | 'md' | 'lg';
export type HoldToggleMode = 'hold' | 'toggle';

export interface CustomKeybinds {
  moveForward: string;
  moveBack: string;
  moveLeft: string;
  moveRight: string;
  interact: string;
  flashlight: string;
  uv: string;
  crouch: string;
  sprint: string;
  drop: string;
  journal: string;
  map: string;
}

export type Language = 'pt-BR' | 'en-US' | 'es-ES';

export type FpsLimit = 30 | 60 | 120; // 120 = "120 FPS / Ilimitado"

export type StickCurve = 'linear' | 'exponential';

export type MinimapPosition = 'top-right' | 'top-left';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  locale: {
    language: Language;
    dubbing: boolean; // Voice dubbing (speechSynthesis) on/off
    subtitleBgOpacity: number; // 0..1
  };
  audio: {
    master: number; // 0..1
    music: number; // 0..1 (Ambiente & Clima)
    tension: number; // 0..1 (Música / Tensão)
    sfx: number; // 0..1 (Efeitos)
    voiceTapes: number; // 0..1 (Vozes / Dublagem / Fitas VHS & Rádio)
    chaseHeartbeat: number; // 0..1 (Batimento & Perseguição)
    soundOcclusion: boolean; // Low-pass occlusion through walls/doors
    nightMode: boolean; // Night audio mode (dynamic range compression)
    subtitles: boolean;
    subtitleSize: SubtitleSize;
    muted: boolean;
  };
  controls: {
    lookSensitivity: number; // 0.3..2.5 (mirrors X for legacy compat)
    lookSensitivityX: number; // 0.3..2.5
    lookSensitivityY: number; // 0.3..2.5
    touchSensitivity: number; // 0.4..2.5
    gamepadSensitivity: number; // 0.3..2.5
    gamepadDeadzone: number; // 0.05..0.35 (Left Stick)
    gamepadDeadzoneRight: number; // 0.05..0.35 (Right Stick)
    gamepadProfile: GamepadProfile;
    cameraSmoothing: number; // 0..1
    rumble: boolean;
    invertY: boolean;
    joystickMode: JoystickMode;
    hudScale: number; // 0.75..1.25
    hudOpacity: number; // 0.40..1.00
    minimapSize: MinimapSizeOption;
    minimapOpacity: number; // 0.40..1.00
    dynamicCrosshair: boolean;
    mobileButtonScale: number; // 0.85..1.30
    mobileButtonOpacity: number; // 0.35..1.00
    hudCustomLayout: HudCustomLayout;
    keybinds: CustomKeybinds;
    crouchSensitivityMult: number; // 0.3..1.0 look sensitivity multiplier while crouched
    stickCurve: StickCurve;
    rumbleStrength: number; // 0..1
    interactionAssist: boolean; // Magnetic aim assist toward interactables
    leftHanded: boolean; // Mirror touch controls (left-handed)
    minimapPosition: MinimapPosition;
  };
  video: {
    fov: number; // 60..110
    brightness: number; // 0.65..1.50
    contrast: number; // 0.75..1.35
    fogDensity: number; // 0.50..1.60
    resolutionScale: number; // 0.50..1.25
    textureQuality: TextureQualityLevel;
    shadowsLevel: ShadowQualityLevel;
    shadowsOverride: 'auto' | 'on' | 'off';
    waterReflections: boolean;
    waterQuality: 'low' | 'high';
    postProcessingOverride: 'auto' | 'on' | 'off';
    volumetricDust: boolean;
    rainParticles: boolean;
    showFps: boolean;
    showFrameTime: boolean; // Frame time (ms) next to FPS counter
    fpsLimit: FpsLimit;
    renderDistance: number; // 0.5..1.5 culling distance multiplier
    vhsIntensity: number; // 0..1 VHS / chromatic aberration strength
  };
  gameplay: {
    headBobIntensity: number; // 0..1.5
    vignetteIntensity: number; // 0..1.5
    sprintMode: HoldToggleMode;
    crouchMode: HoldToggleMode;
    itemOutline: boolean;
    holdBreathAssist: boolean;
    visualAudioCues: boolean;
    showNoiseIndicator: boolean;
    showObjectiveHints: boolean;
    showSpeedrunTimer?: boolean;
    showPing: boolean; // Show multiplayer ping (ms) on HUD
    chatFilter: boolean; // Profanity filter for multiplayer chat
  };
}

export interface ProfileProgress {
  chaptersUnlocked: number[];
  completedDifficulties: Record<string, Difficulty[]>;
  bestTimesSec: Record<string, Partial<Record<Difficulty, number>>>;
  totalEscapes: number;
  totalPlaytimeSec: number;
  argSecretsSolved: string[];
}

export interface ActiveRunSnapshotV3 {
  chapterId: number;
  difficulty: Difficulty;
  seed: number;
  elapsedSec: number;
  floor: FloorId;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  health: number;
  battery: number;
  flares: number;
  inventory: ItemType[];
  unlockedDoorIds: string[];
  removedPlankIds: string[];
  safeUnlocked: boolean;
  discoveredClueIds: string[];
  fogFloor0Base64: string;
  fogFloorMinus1Base64: string;
}

export interface SaveDataV3 {
  saveVersion: 3;
  updatedAt: number;
  profile: ProfileProgress;
  settings: GameSettings;
  activeRun: ActiveRunSnapshotV3 | null;
}

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  subtitle: string;
  unlocksChapter2: boolean;
  diddyActive: boolean;
  diddyPatrolSpeed: number;
  diddyChaseSpeed: number;
  diddyVisionRange: number;
  diddyHearingMult: number;
  diddyStunDuration: number; // 12s Easy, 9s Hard, 6s Nightmare
  playerMaxHealth: number;
  playerWalkSpeed: number;
  playerSprintSpeed: number;
  playerCrouchSpeed: number;
  staminaDrainPerSec: number;
  staminaRegenPerSec: number;
  flashlightDrainPerSec: number;
  fogDensityMult: number;
  batteryPackCount: number;
  startingFlares: number;
}

export interface NoiseEvent {
  x: number;
  y: number;
  z: number;
  floor: FloorId;
  radius: number;
  priority: number; // 1 = light, 2 = medium, 3 = loud (drop/sprint/throw), 4 = critical (flare/stun)
  source:
    | 'footstep'
    | 'sprint'
    | 'vent_fast'
    | 'door'
    | 'dropped_object'
    | 'thrown_object'
    | 'recharge'
    | 'stun_gun'
    | 'flare'
    | 'hiding';
  timestamp: number;
}

export interface RoomDefinition {
  id: string;
  name: string;
  floor: FloorId;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  surface: SurfaceType;
  zoneId: string;
}

export interface DoorDefinition {
  id: string;
  name: string;
  floor: FloorId;
  gx: number;
  gz: number;
  spanCells: number;
  axis: 'x' | 'z';
  lockType: DoorLockType;
  zoneA: string;
  zoneB: string;
  isExit?: boolean;
  isOpen: boolean;
  isUnlocked: boolean;
  planksRemoved?: boolean;
  electronicUnlocked?: boolean;
  openProgress: number; // 0..1 smooth hinge/slide animation
}

export interface VentDuctDefinition {
  id: string;
  name: string;
  floor: FloorId;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface BunkerCameraDefinition {
  id: string;
  label: string;
  roomName: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  secretCodeHint?: string;
}

export interface WorkbenchDefinition {
  id: string;
  name: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
}

export interface RechargeStationDefinition {
  id: string;
  name: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  cooldown: number;
}

export interface CassetteTapeDefinition {
  id: string;
  title: string;
  roomName: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  transcript: string;
  listened: boolean;
  drawerId?: string;
}

export interface UvMarkDefinition {
  id: string;
  kind: 'symbol_digit' | 'footprints' | 'secret_hint';
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  symbolChar: string;
  digitValue: string;
  title: string;
  roomName: string;
  discovered: boolean;
}

export interface TutorialPlaqueDefinition {
  id: string;
  title: string;
  lines: string[];
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
}

export type FurnitureKind =
  | 'bookshelf'
  | 'desk_monitor'
  | 'crate'
  | 'barrel'
  | 'pipe_cluster'
  | 'bed_medical'
  | 'dining_table'
  | 'drawer_cabinet'
  | 'translation_board'
  | 'generator_lever'
  | 'secret_terminal'
  | 'side_table'
  | 'wall_frame'
  | 'potted_plant'
  | 'cable_conduit'
  | 'standing_lamp'
  | 'interdiction_board'
  | 'radio_desk'
  | 'coffee_spill'
  | 'vent_grate_loose'
  | 'iv_stand'
  | 'chemical_barrel_ooze'
  | 'specimen_cylinder'
  | 'cell_sign_09'
  | 'level2_hatch'
  | 'bench_broken'
  | 'wing_sign'
  | 'wall_cctv'
  | 'filing_toppled'
  | 'workbench_schematic'
  | 'fuse_box_busted'
  | 'exit_pry_marks'
  | 'marcos_badge'
  | 'broken_glass_counter'
  | 'cafeteria_trays'
  | 'cell_bent_bars'
  | 'swivel_chair';

export interface OmegaDossierDefinition {
  id: string;
  code: string;
  title: string;
  clearance: string;
  date: string;
  body: string;
  unlocked?: boolean;
}

export interface FurniturePropDefinition {
  id: string;
  kind: FurnitureKind;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  label?: string;
  opened?: boolean;
  openProgress?: number;
  variant?: number;
}

export interface HidingSpotDefinition {
  id: string;
  kind: HidingSpotKind;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  roomId: string;
}

export interface WorldItemSpawn {
  id: string;
  itemType: WorldPickupType;
  label: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  zoneId: string;
  collected: boolean;
  insideSafe?: boolean;
  drawerId?: string;
  droppedByPlayer?: boolean;
  droppedAmmo?: number;
}

export interface ArgCluePlacement {
  id: string;
  digitIndex: 0 | 1 | 2 | 3;
  digitValue: string;
  title: string;
  roomId: string;
  roomName: string;
  flavorText: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw?: number;
  zoneId: string;
  discovered: boolean;
}

export interface SafeDefinition {
  id: string;
  name: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  zoneId: string;
  code: string;
  unlocked: boolean;
  rewardItemId: string;
}

export interface NoisePropDefinition {
  id: string;
  kind: 'bottles' | 'tin_cans';
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  triggered: boolean;
  cooldown: number;
}

export interface StairwayDefinition {
  id: string;
  name: string;
  gxMin: number;
  gxMax: number;
  gzTop: number;
  gzBottom: number;
  gateDoorId?: string;
}

export interface LightSwitchDefinition {
  id: string;
  roomId: string;
  roomName: string;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  isOn: boolean;
}

export interface InteractPrompt {
  id: string;
  label: string;
  sublabel?: string;
  actionType:
    | 'pickup'
    | 'door'
    | 'hide'
    | 'unhide'
    | 'safe'
    | 'clue'
    | 'exit'
    | 'workbench'
    | 'recharge'
    | 'cassette'
    | 'cctv_monitor'
    | 'bunker_door_btn'
    | 'generator_lever'
    | 'drawer'
    | 'translation_board'
    | 'secret_terminal'
    | 'level2_hatch'
    | 'uv_mark'
    | 'light_switch';
  accent?: 'default' | 'red' | 'blue' | 'amber' | 'emerald' | 'purple';
}

export interface HotbarSlotInfo {
  slotIndex: number;
  itemType: ItemType | null;
  label: string;
  description?: string;
  droppable?: boolean;
  count?: number;
  chargePct?: number;
}

export interface QuickInspectPayload {
  kind: 'clue' | 'cassette';
  title: string;
  roomName: string;
  body: string;
  digitIndex?: number;
  digitHighlight?: string;
}

export interface JournalSnapshot {
  clues: ArgCluePlacement[];
  uvMarks: UvMarkDefinition[];
  cassettes: CassetteTapeDefinition[];
  omegaDossiers: OmegaDossierDefinition[];
  translationBoardSeen: boolean;
  symbolMap: { symbol: string; digit: string }[];
  cameraSecretHintSeen: boolean;
  cameraSecretCode: string;
  safeUnlocked: boolean;
  terminalUnlocked: boolean;
}

export interface HudSnapshot {
  mode: GameMode;
  difficulty: Difficulty;
  floor: FloorId;
  roomName: string;
  elapsedSec: number;
  health: number;
  maxHealth: number;
  stamina: number;
  battery: number;
  flashlightOn: boolean;
  uvMode: boolean;
  crouching: boolean;
  inVent: boolean;
  sprinting: boolean;
  hiding: boolean;
  hidingKind: HidingSpotKind | null;
  noiseLevel: number;
  diddyDistance: number;
  diddyState: DiddyAiState;
  dangerIntensity: number;
  damageFlash: number;
  activeSlot: number;
  hotbar: HotbarSlotInfo[];
  backpackItems: HotbarSlotInfo[];
  backpackCapacity: number;
  canDropActiveItem: boolean;
  collectedKeys: ItemType[];
  stunAmmo: number;
  throwables: number;
  cluesFound: number;
  cluesTotal: number;
  uvCluesFound: number;
  cassettesFound: number;
  safeUnlocked: boolean;
  blackoutActive: boolean;
  generatorFixed: boolean;
  fuseInstalled: boolean;
  terminalUnlocked: boolean;
  exitProgress: {
    planksRemoved: boolean;
    electronicUnlocked: boolean;
    masterUnlocked: boolean;
  };
  securityPowerPct: number;
  securityLeftClosed: boolean;
  securityRightClosed: boolean;
  cctvOpen: boolean;
  cctvActiveCamIndex: number;
  cctvCameras: { id: string; label: string; roomName: string }[];
  workbenchOpen: boolean;
  terminalOpen: boolean;
  quickInspect: QuickInspectPayload | null;
  objectiveText: string;
  statusBanner: string | null;
  interactPrompt: InteractPrompt | null;
  contextualUseLabel: string | null;
  exploredPct: number;
  keypadOpen: boolean;
  safeCodeHintDigits: (string | null)[];
  isMobileTouch: boolean;
  inputMode: InputMode;
  gamepadStyle: GamepadGlyphStyle;
  gamepadConnected: boolean;
  diddyInView: boolean;
  transitionFade: number;
  graphicsQuality: GraphicsQuality;
  chapter2JustUnlocked: boolean;
  isNewBestTime: boolean;
  reticleState: ReticleState;
  fps: number;
  subtitleText: string | null;
  cassettesTotal: number;
  dossiersUnlockedCount: number;
  holdBreathActive: boolean;
  holdBreathProgress: number; // 0..1 inspection progress
  holdBreathGauge: number; // 0..100 breath equilibrium gauge
  holdBreathZoneMin: number;
  holdBreathZoneMax: number;
  holdBreathHolding: boolean;
  holdBreathWarning: string | null;
  chromaticIntensity: number; // 0..1 proximity/chase chromatic aberration
  staminaExhausted: boolean;
  maxBattery?: number;
  frameTimeMs?: number; // Smoothed frame time for FPS + ms counter
  pingMs?: number | null; // Multiplayer round-trip latency (null when offline/solo)
  spectating?: boolean; // Multiplayer spectator mode after capture/death
  matchPhase?: MatchPhase;
  playerLifeState?: PlayerLifeState;
  bleedoutSec?: number; // 35s countdown while DOWNED
  reviveProgressPct?: number; // 0..100 revive progress
  spectateTargetName?: string | null;
  bunkerLureCooldownSec?: number; // 25s cooldown for SecurityBunker remote acoustic lure
  neuralInterference?: number; // 0..100 CRT static & phantom whisper intensity
  finalGateSirenSec?: number; // 15s frenzy siren countdown while hydraulic gate rises
  finalGateStage?: number; // 0..4 completed protocol stages
  activePerks?: PerkId[];
  lastEndingId?: EndingId | null;
  lastMissionReport?: MissionReportSnapshot | null;
}

export type EndingId = 'bad' | 'good' | 'real' | 'secret';

export type RankGrade = 'S' | 'A' | 'B' | 'C';

export type PerkId =
  | 'silent_steps'
  | 'iron_lungs'
  | 'fast_hacker'
  | 'extended_battery'
  | 'athlete_lungs'
  | 'spare_cartridge'
  | 'field_scavenger'
  | 'steady_hands'
  | 'acoustic_sense'
  | 'adrenaline_burst'
  | 'nightmare_instinct'
  | 'omega_protocol';

export type FlashlightColorId =
  | 'halogen'
  | 'tactical_led'
  | 'industrial_amber'
  | 'night_vision'
  | 'crimson';

export type GloveSkinId =
  | 'urban_default'
  | 'tactical_black'
  | 'insulated_yellow'
  | 'omega_carbon';

export type DiddySkinId =
  | 'classic_s09'
  | 'unstable_exp'
  | 'armored_proto';

export type AchievementCategory = 'story' | 'challenge' | 'exploration' | 'arsenal';

export type AchievementId =
  | 'ending_bad'
  | 'ending_good'
  | 'ending_real'
  | 'ending_secret'
  | 'all_endings'
  | 'beat_easy'
  | 'beat_hard'
  | 'beat_nightmare'
  | 'master_all_difficulties'
  | 'ghost_run'
  | 'speedrun_6m'
  | 'speedrun_4m'
  | 'rank_s_agent'
  | 'vhs_archivist'
  | 'uv_cryptographer'
  | 'omega_whistleblower'
  | 'taser_specialist'
  | 'flare_tactician'
  | 'breath_of_steel'
  | 'bunker_guardian'
  | 'field_engineer'
  | 'shadow_crawler'
  | 'lights_out'
  | 'armory_collector';

export interface RunTelemetry {
  endingId: EndingId;
  difficulty: Difficulty;
  elapsedSec: number;
  detections: number;
  stunsApplied: number;
  flaresUsed: number;
  vhsCollected: number;
  vhsTotal: number;
  uvCluesCollected: number;
  uvCluesTotal: number;
  exploredPct: number;
  safeUnlocked: boolean;
  terminalUnlocked: boolean;
  holdBreathSurvived: number;
  craftsCompleted: number;
}

export interface MissionReportSnapshot {
  endingId: EndingId;
  difficulty: Difficulty;
  elapsedSec: number;
  isNewBestTime: boolean;
  bestTimeSec: number | null;
  detections: number;
  stunsApplied: number;
  vhsCollected: number;
  vhsTotal: number;
  uvCluesCollected: number;
  uvCluesTotal: number;
  exploredPct: number;
  rank: RankGrade;
  rankScore: number;
  rankBreakdown: {
    label: string;
    points: number;
  }[];
  coinsEarned: number;
  coinBreakdown: {
    base: number;
    rankBonus: number;
    difficultyBonus: number;
    endingBonus: number;
  };
  newBalance: number;
  chapter2JustUnlocked: boolean;
}

export interface AchievementToastPayload {
  id: AchievementId;
  title: string;
  description: string;
  rewardCoins: number;
  category: AchievementCategory;
}

export type SpeakerId = 'survivor' | 'radio' | 'diddy';

export type CutsceneSoundCue =
  | 'fence_vault'
  | 'gate_slam'
  | 'radio_static'
  | 'drizzy_growl'
  | 'door_open'
  | 'hatch_hum';

export interface DialogueStep {
  id: string;
  speaker: SpeakerId;
  speakerName: string;
  emotion: 'tense' | 'alert' | 'menacing' | 'relieved' | 'static';
  text: string;
  minDisplaySec: number;
  autoAdvanceSec: number;
  cameraIndex: number;
  soundCue?: CutsceneSoundCue;
}

export interface CutsceneCameraKeyframe {
  pos: [number, number, number];
  lookAt: [number, number, number];
  fov?: number;
  shake?: number;
}

export type CutsceneId =
  | 'intro'
  | 'ending'
  | 'ending_bad'
  | 'ending_good'
  | 'ending_real'
  | 'ending_secret';

export interface CutsceneUiState {
  id: CutsceneId;
  chapterTitle: string;
  subtitle: string;
  stepIndex: number;
  totalSteps: number;
  step: DialogueStep;
  progress: number;
}
