import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DiddyAiController } from './ai';
import { HorrorAudioEngine } from './audio';
import { evaluateCutsceneSpline, getCutsceneScript, getTitleFlyoverCamera } from './cutscenes';
import {
  buildDedicatedCutsceneSets,
  createArticulatedPeerRig,
  updatePeerHeldItem,
  updatePeerNametag,
  updatePeerRigAnimation,
  type ArticulatedPeerRig,
  type DedicatedCutsceneSetsRig,
  type PeerAnimState,
} from './cutsceneSets';
import { getDifficultyConfig } from './difficulty';
import { HoldBreathMinigame } from './holdBreath';
import {
  InputModeController,
  normalizeGamepadState,
  type NormalizedGamepadState,
} from './inputManager';
import {
  SpringDamper1D,
  SpringDamper3D,
  computeSoundOcclusionCutoffHz,
} from './springPhysics';
import { WaterPhysicsManager } from './waterSystem';
import {
  detachCollectedItemMesh,
  finalizeCollectedItemMesh,
  syncActiveWorldItemVisibility,
} from './itemVisualCleanup';
import {
  renderAllCharacterPortraits,
  renderDiddyPortrait,
  type CharacterPortraitId,
} from './portraitRenderer';
import { renderAllItemIcons } from './itemRenderCache';
import {
  getFlashlightCosmetic,
  saveSystem,
  type ProgressionStateV4,
} from './saveSystem';
import { GameServer } from './server/GameServer';
import type { CompactDeltaPacket, GameWorldState } from './server/types';
import { ClientInputPredictor, DrizzyInterpolationBuffer } from '../network/MultiplayerClient';
import { i18nStore } from '../i18n/i18n';
import { tapeAudioPlayer } from '../audio/TapeAudioPlayer';
import {
  createChandelierRig,
  createFalseBookshelfRig,
  createFireplaceRig,
  createFourStageFinalGateRig,
  createGarageEscapeCarRig,
  createGrandfatherClockRig,
  createInteractivePianoRig,
  createOuterGardenProps,
  createSecretAtticProps,
  createSecurityBunkerSetpiece,
  createSteamValvesRig,
  createToolShedRig,
  type FalseBookshelfRig,
  type FourStageFinalGateRig,
  type GarageEscapeCarRig,
  type InteractivePianoRig,
  type OuterGardenRig,
  type SecretAtticRig,
  type SecurityBunkerRig,
  type SteamValvesRig,
  type ToolShedRig,
} from './microVoxelProps';
import {
  BASEMENT_CEILING_H,
  CELL_COURTYARD,
  CELL_FLOOR,
  CELL_SIZE,
  CELL_STAIR,
  CELL_VENT,
  CELL_VOID,
  CELL_WALL,
  CREAKING_FLOORBOARDS,
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  GRID_H,
  GRID_W,
  GROUND_CEILING_H,
  OMEGA_DOSSIERS,
  StrictFogOfWar,
  VENT_CEILING_H,
  cellIdx,
  generateMansionLayout,
  getFloorFromY,
  getItemDescription,
  getItemLabel,
  getRoomAt,
  getStairHeightAt,
  getSurfaceAt,
  gridToWorld,
  hasWallLineOfSight,
  isPositionInVent,
  resolveWorldMovement,
  type MansionLayout,
} from './mansionMap';
import {
  createAnimatedFanVisual,
  createCassetteRecorderVisual,
  createCctvSecretSignVisual,
  createCluePlaqueVisual,
  createCourtyardPillarVisual,
  createDiddyArticulatedRig,
  createDirtyGlassWindowVisual,
  createDoorVisual,
  createDroppedItemGlowRing,
  createBunkerDoorButtonVisual,
  createFurnitureVisual,
  createHeldItemViewmodelRig,
  createHidingSpotVisual,
  createItemPickupMesh,
  createNightSkyRig,
  createNoisePropVisual,
  createRechargeStationVisual,
  createSafeVisual,
  createSecurityCameraVisual,
  createServerRackVisual,
  createStunSparksRig,
  createSwayingTarpVisual,
  createTutorialPlaqueVisual,
  createUvMarkVisual,
  createVoxelItemModel,
  createVoxelSurvivorRig,
  createWallClockVisual,
  createWallLightSwitchVisual,
  createWorkbenchVisual,
  updateDiddyRigAnimation,
  type DiddyArticulatedRig,
  type DoorVisual,
  type FurnitureVisual,
  type HeldItemViewmodelRig,
  type HidingSpotVisual,
  type NightSkyRig,
} from './models';
import { saveManager } from './saveManager';
import { getGraphicsProfile } from './settings';
import {
  ResourceRegistry,
  createProceduralMaterialPack,
  type MaterialId,
  type MaterialPack,
} from './textures';
import {
  clearSculptedCache,
  getSharedSculptedMaterials,
} from './voxelSculptor';
import {
  buildSculptedBaseboardGeo,
  buildSculptedCableTrayGeo,
  buildSculptedCeilingLuminaireGeo,
  buildSculptedCornerColumnGeo,
  buildSculptedFloorDrainGeo,
  buildSculptedRecessedWindowGeo,
  buildSculptedWallPanelGeo,
} from './sculptedArchitecture';
import type {
  AchievementId,
  AchievementToastPayload,
  CutsceneId,
  CutsceneUiState,
  DiddySkinId,
  Difficulty,
  DoorDefinition,
  EndingId,
  FloorId,
  GameMode,
  GameSettings,
  GloveSkinId,
  HidingSpotDefinition,
  PlayerLifeState,
  WorldPickupType,
  HotbarSlotInfo,
  HudSnapshot,
  InteractPrompt,
  ItemType,
  JournalSnapshot,
  MissionReportSnapshot,
  NoiseEvent,
  PerkId,
  ProfileProgress,
  QuickInspectPayload,
  ReticleState,
  WorldItemSpawn,
} from './types';

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onCutsceneUpdate: (cs: CutsceneUiState | null) => void;
  onProfileUpdate: (profile: ProfileProgress) => void;
  onProgressionUpdate?: (progression: ProgressionStateV4) => void;
  onAchievementUnlocked?: (toast: AchievementToastPayload) => void;
  onPortraitsUpdate?: (portraits: Record<CharacterPortraitId, string>) => void;
  onToggleJournal?: () => void;
  onToggleBackpack?: () => void;
  onToggleMap?: () => void;
}

interface ThrownProjectile {
  kind: 'can' | 'flare';
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  floor: FloorId;
  life: number;
  light?: THREE.PointLight;
  burnTimer?: number;
  hissCooldown?: number;
  detonated?: boolean;
  bounces?: number;
}

interface TaserShotVisual {
  group: THREE.Group;
  wireLeft: THREE.Line;
  wireRight: THREE.Line;
  dartLeft: THREE.Mesh;
  dartRight: THREE.Mesh;
  attachedToDiddy: boolean;
  hitPoint: THREE.Vector3;
  age: number;
  maxAge: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotSpeed: number;
  age: number;
  maxAge: number;
  gravity: number;
}

interface PuddleDripVisual {
  group: THREE.Group;
  dropMesh: THREE.Mesh;
  phase: number;
  floor: FloorId;
  x: number;
  y: number;
  z: number;
}

interface CeilingLightVisualMeta {
  roomId: string | null;
  floor: FloorId;
  halo: THREE.Sprite;
  tubeMat: THREE.MeshStandardMaterial;
  baseColor: number;
  flickerSeed: number;
  isSecurityOffice?: boolean;
}

interface PhysicalGrabAnim {
  mesh: THREE.Group;
  startPos: THREE.Vector3;
  startScale: THREE.Vector3;
  t: number;
  dur: number;
}

type ViewmodelActionAnim =
  | 'none'
  | 'key_turn'
  | 'crowbar_swing'
  | 'flashlight_click'
  | 'stun_recoil'
  | 'throw_toss'
  | 'wire_snip'
  | 'grab_reach';

const CHUNK_SIZE = 12;
const CCTV_W = 480;
const CCTV_H = 300;
const BACKPACK_CAPACITY = 10;

export const FLASHLIGHT_CONFIG = {
  color: 0xfff1d6,
  intensity: 18,
  distance: 18,
  angle: Math.PI / 5.2,
  penumbra: 0.78,
  decay: 1.8,
  spillIntensity: 3.2,
  spillDistance: 7.5,
  spillAngle: Math.PI / 2.3,
  spillPenumbra: 1.0,
  spillDecay: 1.1,
  uvColor: 0x8b2cf5,
  uvIntensity: 14,
  uvDistance: 13,
  uvAngle: Math.PI / 4.2,
  uvPenumbra: 0.75,
  uvSpillIntensity: 2.0,
  uvSpillDistance: 6.5,
} as const;

export class HorrorEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private pmremGen: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private materialPack: MaterialPack;
  private worldRegistry = new ResourceRegistry();
  private worldGroup = new THREE.Group();
  private floor0Chunks: THREE.Object3D[] = [];
  private floorMinus1Chunks: THREE.Object3D[] = [];

  private audio = new HorrorAudioEngine();
  private ai = new DiddyAiController();
  private fog = new StrictFogOfWar();
  private holdBreath = new HoldBreathMinigame();
  private waterManager: WaterPhysicsManager | null = null;

  private settings: GameSettings;
  private difficulty: Difficulty = 'hard';
  private mode: GameMode = 'title';
  private layout: MansionLayout;

  // Dynamic lights (strictly budgeted for mobile 60 FPS; Dual Shadows unlocked on High/Ultra!)
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private moonLightTarget: THREE.Object3D;
  private flashlight: THREE.SpotLight;
  private flashlightSpill: THREE.SpotLight;
  private flashlightTarget: THREE.Object3D;
  private scratchFlashPos = new THREE.Vector3();
  private scratchFlashDir = new THREE.Vector3();
  private scratchFlashRight = new THREE.Vector3();
  private scratchFlashUp = new THREE.Vector3();
  private pooledPointLights: THREE.PointLight[] = [];
  private jumpscareLight: THREE.PointLight;
  private cctvFillLight: THREE.PointLight;

  // High/Ultra Post-Processing Pipeline (RenderPass + UnrealBloomPass + Chromatic/Grain ShaderPass + OutputPass)
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private filmPass: ShaderPass | null = null;
  private outputPass: OutputPass | null = null;
  private usePostProcessing = false;

  // Cabine 09-A 15 FPS Live 3D CCTV RenderTarget (1 reused target, 0 cost when closed!)
  private cctvRenderTarget: THREE.WebGLRenderTarget;
  private cctvCamera: THREE.PerspectiveCamera;
  private cctvPixelBuf = new Uint8Array(CCTV_W * CCTV_H * 4);
  private cctvImageData: ImageData | null = null;
  private cctvCanvas: HTMLCanvasElement | null = null;
  private cctvRenderAccum = 0;

  // Viewmodel, 3D Aim Highlight & atmospheric dust / sky / god rays / puddles / steam
  private heldItemRig: HeldItemViewmodelRig;
  private equipAnim = 0;
  private actionAnimType: ViewmodelActionAnim = 'none';
  private actionAnimT = 0;
  private lookSwayX = 0;
  private lookSwayY = 0;
  private aimHighlightBox: THREE.LineSegments;
  private aimHighlightMat: THREE.LineBasicMaterial;
  private dustPoints: THREE.Points | null = null;
  private dustBasePositions: Float32Array | null = null;
  private nightSkyRig: NightSkyRig | null = null;
  private pergolaProjectedShadows: THREE.Group | null = null;
  private godRayMeshes: THREE.Mesh[] = [];
  private ceilingLightMeta: CeilingLightVisualMeta[] = [];
  private puddleDrips: PuddleDripVisual[] = [];
  private steamParticles: { mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }[] = [];
  private activeGrabAnims: PhysicalGrabAnim[] = [];
  private flareArcPoints: THREE.Points | null = null;
  private taserVisuals: TaserShotVisual[] = [];
  private burstParticles: BurstParticle[] = [];
  private disabledLightRooms = new Set<string>();
  private uvScanTimers = new Map<string, number>();
  private fpsSmoothed = 60;
  private frameTimeMsSmoothed = 16.67;
  private lastRenderMs = 0;
  private subtitleText: string | null = null;
  private subtitleTimer = 0;
  private drizzyGrowlCooldown = 3.5;
  private flickerBuzzCooldown = 1.4;
  private animatedFans: { bladesPivot: THREE.Group; speed: number; floor: FloorId }[] = [];
  private wallClocks: { secondHand: THREE.Object3D; minuteHand: THREE.Object3D; x: number; z: number; floor: FloorId }[] = [];
  private serverRacks: { ledMats: THREE.MeshStandardMaterial[]; phaseOffset: number; floor: FloorId; x: number; z: number }[] = [];
  private swayingTarps: { curtainPivot: THREE.Group; phaseOffset: number; floor: FloorId }[] = [];
  private courtyardRainLines: THREE.LineSegments | null = null;
  private courtyardRainData: Float32Array | null = null;
  private rainRippleCooldown = 0.25;
  private clockTickSec = -1;
  private distantAmbientTimer = 24;
  private emiStaticCooldown = 0;
  private drizzyOilyStepsLeft = 0;
  private drizzyFootprintPool: { mesh: THREE.Mesh; age: number; maxAge: number; active: boolean }[] = [];
  private drizzyFootprintCursor = 0;
  private drizzyStepSide = 1;
  private doorSwingSpeed = new Map<string, number>();
  private handPosSpring = new SpringDamper3D(185, 17);
  private handRotSpring = new SpringDamper3D(170, 16);
  private landingDipSpring = new SpringDamper1D(195, 19);
  private prevPlayerY = FLOOR_0_Y;
  private targetYaw = 0;
  private targetPitch = 0;
  private sprintToggleActive = false;

  // World interactive visual handles
  private diddyRig: DiddyArticulatedRig | null = null;
  private stunSparksRig: THREE.Group | null = null;
  private survivorRig: THREE.Group | null = null;
  private doorVisuals: DoorVisual[] = [];
  private hidingVisuals: HidingSpotVisual[] = [];
  private furnitureVisuals: FurnitureVisual[] = [];
  private drawerVisualById = new Map<string, FurnitureVisual>();
  private itemMeshes = new Map<string, THREE.Group>();
  private characterPortraits: Record<CharacterPortraitId, string> = {
    survivor: '',
    marcos: '',
    diddy: '',
    scientist: '',
    director: '',
  };
  private itemRenders: Record<string, string> = {};
  private remotePeerRigs = new Map<
    string,
    {
      rig: ArticulatedPeerRig;
      targetX: number;
      targetY: number;
      targetZ: number;
      targetYaw: number;
      targetPitch: number;
      floor: FloorId;
      crouching: boolean;
      sprinting: boolean;
      speaking: boolean;
      captured: boolean;
      flashlightOn: boolean;
      uvOn: boolean;
      heldItem: string | null;
      nickname: string;
      platform: 'pc' | 'touch' | 'gamepad';
    }
  >();
  private mpPingMs: number | null = null;
  private mpSpectating = false;
  private playerLifeState: PlayerLifeState = 'ALIVE';
  private bleedoutSec = 0;
  private spectateTargetIndex = 0;
  private spectateTargetName: string | null = null;
  private bunkerLureCooldownSec = 0;
  private neuralInterference = 0;
  private creakCooldownSec = 0;
  private finalGateSirenSec = 0;
  private isRemoteClient = false;
  private remoteDiddyInterp = new DrizzyInterpolationBuffer(100, 32);
  private remoteDiddyTarget = {
    x: 0,
    y: FLOOR_0_Y,
    z: 0,
    yaw: 0,
    floor: 0 as FloorId,
    state: 'patrol' as import('./types').DiddyAiState,
    initialized: false,
  };
  private windowRimLight!: THREE.DirectionalLight;
  private fireplaceGlowLight: THREE.PointLight | null = null;
  private bunkerCrtGlowLight: THREE.PointLight | null = null;
  private bunkerSetpieceRig: SecurityBunkerRig | null = null;
  private garageCarRig: GarageEscapeCarRig | null = null;
  private toolShedRig: ToolShedRig | null = null;
  private outerGardenRig: OuterGardenRig | null = null;
  private secretAtticRig: SecretAtticRig | null = null;
  private chandelierRig: ReturnType<typeof createChandelierRig> | null = null;
  private fireplaceRig: ReturnType<typeof createFireplaceRig> | null = null;
  private grandfatherClockRig: ReturnType<typeof createGrandfatherClockRig> | null = null;
  private falseBookshelfRig: FalseBookshelfRig | null = null;
  private interactivePianoRig: InteractivePianoRig | null = null;
  private steamValvesRig: SteamValvesRig | null = null;
  private fourStageFinalGateRig: FourStageFinalGateRig | null = null;
  private garageBatteryInstalled = false;
  private garageFuelInstalled = false;
  private bookshelfSunInstalled = false;
  private bookshelfMoonInstalled = false;
  private bookshelfOpened = false;
  private pianoSequenceStep = 0;
  private steamValvesClosed: [boolean, boolean, boolean] = [false, false, false];
  private oiledDoors = new Set<string>();
  private polaroidCooldownSec = 0;
  private unsubI18n: (() => void) | null = null;
  private cutsceneSets: DedicatedCutsceneSetsRig | null = null;
  private cutsceneSurvivorRig: ArticulatedPeerRig | null = null;
  public onWorldSyncEvent:
    | ((ev: { kind: 'door' | 'item' | 'generator' | 'safe' | 'terminal' | 'ending'; payload: Record<string, unknown> }) => void)
    | null = null;
  private clueMeshes = new Map<string, THREE.Group>();
  private noisePropMeshes = new Map<string, THREE.Group>();
  private rechargeVisuals = new Map<string, { group: THREE.Group; statusMat: THREE.MeshStandardMaterial }>();
  private cassetteVisuals = new Map<string, { group: THREE.Group; ledMat: THREE.MeshStandardMaterial }>();
  private bunkerButtonVisuals = new Map<string, { group: THREE.Group; buttonMat: THREE.MeshStandardMaterial }>();
  private uvMarkVisuals = new Map<string, { group: THREE.Group; mat: THREE.MeshStandardMaterial }>();
  private lightSwitchVisuals = new Map<
    string,
    { group: THREE.Group; lever: THREE.Mesh; ledMat: THREE.MeshStandardMaterial }
  >();
  private safeVisual: {
    group: THREE.Group;
    doorPivot: THREE.Group;
    screenMat: THREE.MeshStandardMaterial;
  } | null = null;

  // Active thrown cans & pyrotechnic flares
  private thrownProjectiles: ThrownProjectile[] = [];

  // Player state
  private px = 0;
  private py = FLOOR_0_Y;
  private pz = 0;
  private pFloor: FloorId = 0;
  private vx = 0;
  private vz = 0;
  private yaw = 0;
  private pitch = 0;
  private health = 2;
  private maxHealth = 2;
  private stamina = 100;
  private battery = 100;
  private flashlightOn = true;
  private uvMode = false;
  private crouching = false;
  private inVent = false;
  private sprinting = false;
  private flares = 2;
  private stunAmmo = 0;
  private throwables = 0;
  private inventory: ItemType[] = ['flashlight'];
  private activeSlot = 0;

  // Phase 1 Progression & World Systems
  private securityPowerPct = 100;
  private cctvOpen = false;
  private cctvActiveCamIndex = 0;
  private cctvSecretHintSeen = false;
  private workbenchOpen = false;
  private terminalOpen = false;
  private terminalUnlocked = false;
  private translationBoardSeen = false;
  private blackoutTriggered = false;
  private blackoutActive = false;
  private blackoutAlertTimer = 0;
  private fuseInstalled = false;
  private generatorFixed = false;
  private ventWarnCooldown = 0;
  private stunFlashTimer = 0;

  // Hiding spot animation & camera transition
  private hidingSpot: HidingSpotDefinition | null = null;
  private hidingTransition = 0;
  private preHidePos = new THREE.Vector3();
  private enteredHidingThisFrame = false;

  // Headbob, step-smoothing, FOV kick, camera shake, damage flash, tension & fade
  private headbobPhase = 0;
  private stepDistAccum = 0;
  private smoothedPlayerY = FLOOR_0_Y;
  private currentFov = 76;
  private currentEyeHeight = 1.62;
  private currentStrafeRoll = 0;
  private trauma = 0;
  private damageFlash = 0;
  private diddyInView = false;
  private transitionFade = 0;
  private invulnerableTimer = 0;
  private hitBoostTimer = 0;
  private noiseLevel = 0;
  private noiseQueue: NoiseEvent[] = [];

  // Phase 2: Perks, Cosmetics, Telemetry, 4 Endings & Background Loop Pause
  private activePerks: PerkId[] = [];
  private maxBattery = 100;
  private flashlightBeamHex: number = FLASHLIGHT_CONFIG.color;
  private flashlightLensHex = 0xfff8dc;
  private equippedDiddySkin: DiddySkinId = 'classic_s09';
  private equippedGloveSkin: GloveSkinId = 'urban_default';
  private runDetections = 0;
  private runStunsApplied = 0;
  private runFlaresUsed = 0;
  private runHoldBreathSurvived = 0;
  private runCraftsCompleted = 0;
  private wasChasedPrevFrame = false;
  private wasInVentPrevFrame = false;
  private adrenalineBurstTimer = 0;
  private lastEndingId: EndingId | null = null;
  private lastMissionReport: MissionReportSnapshot | null = null;
  private backgroundPaused = false;
  private galleryReplayMode = false;
  // Authoritative 10ms GameServer (Solo = local 1-player server @ 0ms; MP Host = broadcasts 33Hz deltas)
  private authoritativeServer: GameServer | null = null;
  private localPlayerId = 'local_player';
  private inputPredictor = new ClientInputPredictor();
  private lastSelfHealSnapshot: GameWorldState | null = null;

  // Run timers, status banner, keypad, cutscenes
  private elapsedSec = 0;
  private totalTimeSec = 0;
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;
  private keypadOpen = false;
  private quickInspect: QuickInspectPayload | null = null;
  private chapter2JustUnlocked = false;
  private isNewBestTime = false;

  // Cutscene playback state
  private activeCutscene: CutsceneId | null = null;
  private cutsceneStepIdx = 0;
  private cutsceneStepElapsed = 0;
  private cutsceneCamPos = new THREE.Vector3();
  private cutsceneCamLook = new THREE.Vector3();

  // Jumpscare playback state
  private jumpscareTimer = 0;
  private jumpscareDuration = 1.25;

  // Input state (PC + Mobile Multi-Touch + Gamepad with real-time auto-detection!)
  private inputController: InputModeController;
  private keysPressed = new Set<string>();
  private mobileMoveX = 0;
  private mobileMoveY = 0;
  private mobileSprintHeld = false;
  private mobileHoldBreathHeld = false;
  private gamepadHoldBreathHeld = false;
  private squareHoldTimer = 0;
  private squareDropTriggered = false;
  private staminaExhausted = false;
  private exhaustedPantCooldown = 0;
  private chromaticIntensity = 0;
  private isMobileTouch = false;
  private gamepadConnected = false;
  private prevGamepadState: NormalizedGamepadState | null = null;
  private pointerLocked = false;
  private mouseDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Minimap / Full Map canvases bound from React
  private minimapCanvas: HTMLCanvasElement | null = null;
  private fullMapCanvas: HTMLCanvasElement | null = null;

  // Loop & throttling
  private rafId: number | null = null;
  private timeoutId: number | null = null;
  private lastFrameMs = 0;
  private hudEmitAccum = 0;
  private minimapRedrawAccum = 0;
  private disposed = false;

  // Pre-allocated scratch objects
  private scratchVecA = new THREE.Vector3();
  private scratchVecB = new THREE.Vector3();
  private scratchVecC = new THREE.Vector3();
  private scratchVecD = new THREE.Vector3();
  private scratchColor = new THREE.Color();
  private scratchMat4 = new THREE.Matrix4();

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.settings = saveManager.getSettings();
    this.isMobileTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 920);
    this.inputController = new InputModeController(this.isMobileTouch);

    // Probe software WebGL cleanly and release probe context immediately
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    const probeExt = probeGl?.getExtension('WEBGL_debug_renderer_info');
    const probeStr = probeExt
      ? String(probeGl?.getParameter(probeExt.UNMASKED_RENDERER_WEBGL) || '')
      : String(probeGl?.getParameter(probeGl.RENDERER) || '');
    this.isSoftwareGl = /SwiftShader|llvmpipe|Software|Mesa/i.test(probeStr);
    probeGl?.getExtension('WEBGL_lose_context')?.loseContext();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'game-canvas');
    this.container.appendChild(this.renderer.domElement);

    // Realistic Midnight-Blue Night Atmosphere (never pure void black!)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1326);
    this.scene.fog = new THREE.FogExp2(0x0a1326, 0.044);

    // Real Procedural PBR Environment Map via PMREMGenerator (Sector 09 Night Sky + Amber Corridor Bounce + Dark Floor)
    this.pmremGen = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = this.buildSector09EnvironmentMap();
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.65;

    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    this.currentFov = this.settings.video.fov;
    this.camera = new THREE.PerspectiveCamera(this.currentFov, w / h, 0.1, 115);
    this.scene.add(this.camera);

    // Cabine 09-A CCTV RenderTarget & Camera (reused single GPU buffer — 0 FPS cost when closed!)
    this.cctvRenderTarget = new THREE.WebGLRenderTarget(CCTV_W, CCTV_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.cctvCamera = new THREE.PerspectiveCamera(76, CCTV_W / CCTV_H, 0.1, 52);
    this.cctvFillLight = new THREE.PointLight(0xd1fae5, 18.0, 34, 1.0);
    this.cctvFillLight.visible = false;
    this.scene.add(this.cctvFillLight);

    // Midnight-Blue Night Lighting Rig (balanced so Nightmare stays legible on OLED mobile displays)
    this.hemiLight = new THREE.HemisphereLight(0x5272b8, 0x1b2133, 0.58);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0x7aa2e3, 0.28);
    this.dirLight.position.set(16, 28, 12);
    this.scene.add(this.dirLight);

    // Cool-blue moonlight rim directional fill so architecture & silhouettes never crush to black
    this.windowRimLight = new THREE.DirectionalLight(0x6e98ff, 0.42);
    this.windowRimLight.position.set(-14, 18, -16);
    this.scene.add(this.windowRimLight);

    // Dedicated Courtyard Moonlight Directional Light (crisp cool moonlit contrast against night sky!)
    this.moonLight = new THREE.DirectionalLight(0x8ab8ff, 1.08);
    this.moonLight.position.set(10, 26, 24);
    this.moonLightTarget = new THREE.Object3D();
    this.moonLightTarget.position.set(gridToWorld(17.5), 0, gridToWorld(25.0));
    this.moonLight.target = this.moonLightTarget;
    this.moonLight.shadow.camera.left = -18;
    this.moonLight.shadow.camera.right = 18;
    this.moonLight.shadow.camera.top = 18;
    this.moonLight.shadow.camera.bottom = -18;
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 56;
    this.moonLight.shadow.bias = -0.0005;
    this.moonLight.shadow.normalBias = 0.025;
    this.moonLight.shadow.radius = 2.4;
    this.moonLight.shadow.autoUpdate = false;
    this.moonLight.shadow.needsUpdate = true;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLightTarget);

    // Player Flashlight (Modern Physical Scale + Scene-attached Target + Soft Peripheral Spill SpotLight!)
    this.flashlight = new THREE.SpotLight(
      FLASHLIGHT_CONFIG.color,
      FLASHLIGHT_CONFIG.intensity,
      FLASHLIGHT_CONFIG.distance,
      FLASHLIGHT_CONFIG.angle,
      FLASHLIGHT_CONFIG.penumbra,
      FLASHLIGHT_CONFIG.decay
    );
    this.flashlightSpill = new THREE.SpotLight(
      FLASHLIGHT_CONFIG.color,
      FLASHLIGHT_CONFIG.spillIntensity,
      FLASHLIGHT_CONFIG.spillDistance,
      FLASHLIGHT_CONFIG.spillAngle,
      FLASHLIGHT_CONFIG.spillPenumbra,
      FLASHLIGHT_CONFIG.spillDecay
    );
    this.flashlightSpill.castShadow = false;
    this.flashlightTarget = new THREE.Object3D();
    this.flashlight.target = this.flashlightTarget;
    this.flashlightSpill.target = this.flashlightTarget;
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightSpill);
    this.scene.add(this.flashlightTarget);

    // 1st-Person Voxel Right-Hand Viewmodel Rig (castShadow forced FALSE so held flashlight never blocks its own beam!)
    this.heldItemRig = createHeldItemViewmodelRig();
    this.heldItemRig.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = false;
      }
    });
    this.camera.add(this.heldItemRig.root);

    // Subtle 3D Voxel Wireframe Aim Highlight Box around targeted interactables
    const hlBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const hlEdges = new THREE.EdgesGeometry(hlBoxGeo);
    hlBoxGeo.dispose();
    this.aimHighlightMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.72,
      depthTest: true,
    });
    this.aimHighlightBox = new THREE.LineSegments(hlEdges, this.aimHighlightMat);
    this.aimHighlightBox.visible = false;
    this.scene.add(this.aimHighlightBox);

    // Pooled dynamic ceiling lights (physical decay=2.0, max 3 active nearby -> 60 FPS mobile!)
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.PointLight(0xffcf99, 6.2, 14, 2.0);
      pl.visible = false;
      this.scene.add(pl);
      this.pooledPointLights.push(pl);
    }

    this.jumpscareLight = new THREE.PointLight(0xff2a1f, 6.5, 5.0, 1.8);
    this.jumpscareLight.visible = false;
    this.scene.add(this.jumpscareLight);

    this.scene.add(this.worldGroup);

    const prof = getGraphicsProfile(this.settings.graphicsQuality);
    this.materialPack = createProceduralMaterialPack(
      this.isSoftwareGl ? 128 : prof.textureSize,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    // Attach realistic flashlight lens ring cookie texture to SpotLight!
    this.flashlight.map = this.materialPack.flashlightLensTex;

    // Phase 2: Load initial equipped cosmetics before portrait & world build
    const initProg = saveSystem.getProgression();
    this.activePerks = [...initProg.equippedPerks];
    this.equippedDiddySkin = initProg.cosmetics.equippedDiddySkin;
    this.equippedGloveSkin = initProg.cosmetics.equippedGloves;
    const initFl = getFlashlightCosmetic(initProg.cosmetics.equippedFlashlight);
    this.flashlightBeamHex = initFl.beamHex;
    this.flashlightLensHex = initFl.lensHex;

    // Render 256x256 3-point-lit 3D character bust portraits once at startup (cached, 0 gameplay FPS cost!)
    this.characterPortraits = renderAllCharacterPortraits(
      this.renderer,
      this.materialPack,
      this.envRenderTarget.texture,
      this.equippedDiddySkin
    );

    // Render 128x128 transparent 3D hero icons for every collectible & equippable item once at startup (0 extra GPU contexts!)
    this.itemRenders = renderAllItemIcons(this.renderer, this.envRenderTarget.texture);

    this.layout = generateMansionLayout(202509, this.difficulty);
    this.buildWorldScene();
    this.applySettings(this.settings);
    this.handleResize();
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.setBodyState('title');
    this.installQaBridge();
    this.unsubI18n = i18nStore.subscribe(() => {
      this.emitHud();
    });
    this.emitHud();
    this.lastFrameMs = performance.now();
    this.scheduleNextFrame();
  }

  public getCharacterPortraits(): Record<CharacterPortraitId, string> {
    return this.characterPortraits;
  }

  public getItemRenders(): Record<string, string> {
    return this.itemRenders;
  }

  public setMultiplayerPeers(
    peers: {
      id: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch?: number;
      floor: FloorId;
      alive: boolean;
      crouching?: boolean;
      sprinting?: boolean;
      speaking?: boolean;
      captured?: boolean;
      flashlightOn?: boolean;
      uvOn?: boolean;
      heldItem?: string | null;
      nickname?: string;
      platform?: 'pc' | 'touch' | 'gamepad';
    }[],
    pingMs: number | null,
    spectating: boolean
  ): void {
    this.mpPingMs = pingMs;
    this.mpSpectating = spectating;

    const seen = new Set<string>();
    for (const peer of peers) {
      seen.add(peer.id);
      let entry = this.remotePeerRigs.get(peer.id);
      if (!entry) {
        const rig = createArticulatedPeerRig(true);
        rig.root.position.set(peer.x, peer.y, peer.z);
        rig.root.rotation.y = peer.yaw;
        rig.root.visible = peer.alive || Boolean(peer.captured);
        this.scene.add(rig.root);
        entry = {
          rig,
          targetX: peer.x,
          targetY: peer.y,
          targetZ: peer.z,
          targetYaw: peer.yaw,
          targetPitch: peer.pitch ?? 0,
          floor: peer.floor,
          crouching: Boolean(peer.crouching),
          sprinting: Boolean(peer.sprinting),
          speaking: Boolean(peer.speaking),
          captured: Boolean(peer.captured),
          flashlightOn: peer.flashlightOn !== false,
          uvOn: Boolean(peer.uvOn),
          heldItem: peer.heldItem ?? null,
          nickname: peer.nickname || 'Aliado',
          platform: peer.platform ?? 'pc',
        };
        this.remotePeerRigs.set(peer.id, entry);
      } else {
        entry.targetX = peer.x;
        entry.targetY = peer.y;
        entry.targetZ = peer.z;
        entry.targetYaw = peer.yaw;
        entry.targetPitch = peer.pitch ?? 0;
        entry.floor = peer.floor;
        entry.crouching = Boolean(peer.crouching);
        entry.sprinting = Boolean(peer.sprinting);
        entry.speaking = Boolean(peer.speaking);
        entry.captured = Boolean(peer.captured);
        entry.flashlightOn = peer.flashlightOn !== false;
        entry.uvOn = Boolean(peer.uvOn);
        entry.heldItem = peer.heldItem ?? null;
        if (peer.nickname) entry.nickname = peer.nickname;
        if (peer.platform) entry.platform = peer.platform;
        entry.rig.root.visible = peer.alive || Boolean(peer.captured);
      }
    }

    for (const [id, entry] of this.remotePeerRigs.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(entry.rig.root);
        this.remotePeerRigs.delete(id);
      }
    }
  }

  public triggerBunkerRemoteLure(): void {
    if (this.bunkerLureCooldownSec > 0 || this.securityPowerPct < 5) return;
    this.bunkerLureCooldownSec = 25.0;
    this.securityPowerPct = Math.max(0, this.securityPowerPct - 5);
    const lureX = gridToWorld(17.5);
    const lureZ = gridToWorld(11.0);
    this.emitNoise(lureX, FLOOR_0_Y, lureZ, 0, 36, 5, 'door');
    this.audio.playFlashlightClick();
    this.showBanner('SINAL SONORO REMOTO DISPARADO! P. Drizzy atraído para o Corredor Norte!');
    this.emitHud();
  }

  public cycleSpectateTarget(dir: 1 | -1): void {
    const alivePeers = Array.from(this.remotePeerRigs.values()).filter((p) => p.rig.root.visible && !p.captured);
    if (alivePeers.length === 0) {
      this.spectateTargetName = 'Cabine 09-A';
      this.emitHud();
      return;
    }
    this.spectateTargetIndex = (this.spectateTargetIndex + dir + alivePeers.length) % alivePeers.length;
    this.spectateTargetName = alivePeers[this.spectateTargetIndex].nickname;
    this.emitHud();
  }

  public openBunkerMonitorFromSpectate(): void {
    if (this.mode !== 'playing') return;
    this.cctvOpen = !this.cctvOpen;
    this.emitHud();
  }

  public getLocalPlayerSyncState(): {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    floor: FloorId;
    crouching: boolean;
    sprinting: boolean;
    flashlightOn: boolean;
    uvOn: boolean;
    heldItem: string | null;
    captured: boolean;
    alive: boolean;
  } {
    return {
      x: this.px,
      y: this.py,
      z: this.pz,
      yaw: this.yaw,
      pitch: this.pitch,
      floor: this.pFloor,
      crouching: this.crouching,
      sprinting: this.sprinting,
      flashlightOn: this.flashlightOn,
      uvOn: this.uvMode,
      heldItem: this.inventory[this.activeSlot] ?? null,
      captured: this.mpSpectating,
      alive: this.health > 0 && this.mode !== 'defeat' && this.mode !== 'jumpscare',
    };
  }

  public applyRemoteDoorToggle(doorId: string, isOpen: boolean, isUnlocked: boolean): void {
    const door = this.layout.doors.find((d) => d.id === doorId);
    if (!door) return;
    // Once unlocked, a door NEVER re-locks!
    const nextUnlocked = door.isUnlocked || isUnlocked;
    door.isUnlocked = nextUnlocked;
    door.isOpen = isOpen;
    if (this.authoritativeServer && this.authoritativeServer.state.doors[doorId]) {
      const ds = this.authoritativeServer.state.doors[doorId];
      ds.isUnlocked = nextUnlocked;
      ds.locked = !nextUnlocked;
      ds.isOpen = isOpen;
    }
    const dv = this.doorVisuals.find((v) => v.def.id === doorId);
    if (nextUnlocked) {
      if (dv?.padlockMesh) dv.padlockMesh.visible = false;
      if (dv?.plankGroup) dv.plankGroup.visible = false;
    }
    if (this.moonLight.castShadow) {
      this.moonLight.shadow.needsUpdate = true;
    }
    this.emitHud();
  }

  public applyRemoteItemSync(
    itemId: string,
    collected: boolean,
    dropInfo?: { itemType?: WorldPickupType; floor?: FloorId; x?: number; y?: number; z?: number }
  ): void {
    let item = this.layout.items.find((it) => it.id === itemId);
    if (collected) {
      if (item) {
        item.collected = true;
        item.insideSafe = false;
      }
      if (this.authoritativeServer && this.authoritativeServer.state.items[itemId]) {
        this.authoritativeServer.state.items[itemId].collected = true;
      }
      const mesh = detachCollectedItemMesh(
        itemId,
        this.itemMeshes,
        this.floor0Chunks,
        this.floorMinus1Chunks
      );
      if (mesh && mesh.parent) {
        mesh.parent.remove(mesh);
      }
      this.emitHud();
      return;
    }

    // Item dropped by a teammate -> ensure mesh exists at exact world position
    if (!item && dropInfo?.itemType && typeof dropInfo.x === 'number' && typeof dropInfo.z === 'number') {
      const fl: FloorId = dropInfo.floor ?? 0;
      const wy = dropInfo.y ?? (fl === -1 ? FLOOR_MINUS_1_Y + 0.14 : FLOOR_0_Y + 0.14);
      item = {
        id: itemId,
        itemType: dropInfo.itemType,
        label: getItemLabel(dropInfo.itemType),
        zoneId: 'remote_drop',
        floor: fl,
        x: dropInfo.x,
        y: wy,
        z: dropInfo.z,
        collected: false,
        insideSafe: false,
        droppedByPlayer: true,
      };
      this.layout.items.push(item);
      const mesh = createItemPickupMesh(item, this.materialPack.contactShadowTex);
      mesh.position.set(item.x, item.y, item.z);
      this.worldRegistry.trackObject3D(mesh);
      this.worldGroup.add(mesh);
      this.itemMeshes.set(item.id, mesh);
      if (fl === -1) this.floorMinus1Chunks.push(mesh);
      else this.floor0Chunks.push(mesh);
      this.emitHud();
    }
  }

  public getAuthoritativeWorldDelta(): CompactDeltaPacket {
    const stateList: readonly import('./types').DiddyAiState[] = [
      'patrol',
      'investigate',
      'chase',
      'inspecting_hiding',
      'search_hiding',
      'stunned',
    ];
    const stIdx = Math.max(0, stateList.indexOf(this.ai.state));
    return {
      t: Math.floor(this.elapsedSec * 100),
      s: Date.now(),
      p: [],
      d: [
        Math.round(this.ai.x * 100) / 100,
        Math.round(this.ai.y * 100) / 100,
        Math.round(this.ai.z * 100) / 100,
        Math.round(this.ai.yaw * 1000) / 1000,
        this.ai.floor,
        stIdx,
      ],
    };
  }

  public exportAuthoritativeFullSnapshot(): GameWorldState {
    const doors: GameWorldState['doors'] = {};
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
    const items: GameWorldState['items'] = {};
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
    return {
      tick: Math.floor(this.elapsedSec * 100),
      serverTimeMs: Date.now(),
      seed: this.layout.seed,
      difficulty: this.difficulty,
      elapsedSec: this.elapsedSec,
      phase: this.mode === 'playing' ? 'playing' : 'ended',
      matchPhase: this.mode === 'playing' ? 'PLAYING' : this.mode === 'victory' ? 'ENDED_VICTORY' : 'ENDED_WIPEOUT',
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
      safeUnlocked: this.layout.safe.unlocked,
      fuseInstalled: this.fuseInstalled,
      generatorFixed: this.generatorFixed,
      blackoutActive: this.blackoutActive,
      terminalUnlocked: this.terminalUnlocked,
      hatchOpened: false,
      securityPowerPct: this.securityPowerPct,
      bunkerLeftClosed: this.layout.doors.find((d) => d.id === 'door_bunker_left')?.isOpen === false,
      bunkerRightClosed: this.layout.doors.find((d) => d.id === 'door_bunker_right')?.isOpen === false,
      bunkerLureCooldownSec: this.bunkerLureCooldownSec,
      puzzles: this.authoritativeServer?.state.puzzles ?? {
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
      finalGate: this.authoritativeServer?.state.finalGate ?? {
        fusesRestored: 0,
        chainsCut: 0,
        masterKeyInserted: false,
        sixDigitCodeVerified: false,
        sixDigitCode: '000000',
        hydraulicLeverProgress: 0,
        hydraulicLeverPulled: false,
        sirenActive: false,
        sirenRemainingSec: 15,
        gateFullyOpen: false,
      },
      atmosphere: this.authoritativeServer?.state.atmosphere ?? {
        corridorPowerDipSec: 0,
        thunderFlashIntensity: 0,
        nextEventTimerSec: 28,
      },
      discoveredClueIds: [],
      discoveredUvMarkIds: [],
      listenedCassetteIds: [],
      translationBoardSeen: this.translationBoardSeen,
      cctvSecretHintSeen: this.cctvSecretHintSeen,
      lightSwitches: {},
    };
  }

  public applyRemoteGeneratorFixed(): void {
    if (this.generatorFixed) return;
    this.fuseInstalled = true;
    this.generatorFixed = true;
    this.blackoutActive = false;
    this.blackoutAlertTimer = 0;
    this.securityPowerPct = Math.min(100, this.securityPowerPct + 40);
    this.audio.playPowerRestore();
    const gv = this.furnitureVisuals.find((f) => f.def.kind === 'generator_lever');
    if (gv?.statusMat) {
      gv.statusMat.color.setHex(0x22c55e);
      gv.statusMat.emissive.setHex(0x16a34a);
    }
    this.showBanner('ENERGIA RESTAURADA! Luzes do complexo e Sala de Segurança reativadas!');
    this.emitHud();
  }

  private updateRemotePeerRigs(dt: number): void {
    if (this.remotePeerRigs.size === 0) return;
    const k = Math.min(1, dt * 14);
    for (const entry of this.remotePeerRigs.values()) {
      const root = entry.rig.root;
      if (!root.visible) continue;
      const prevX = root.position.x;
      const prevZ = root.position.z;
      root.position.x += (entry.targetX - root.position.x) * k;
      root.position.y += (entry.targetY - root.position.y) * k;
      root.position.z += (entry.targetZ - root.position.z) * k;
      let diff = entry.targetYaw - root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.rotation.y += diff * k;

      const speed = dt > 0.0005 ? Math.hypot(root.position.x - prevX, root.position.z - prevZ) / dt : 0;
      let animState: PeerAnimState = 'idle';
      if (entry.captured) {
        animState = 'captured';
      } else if (entry.crouching) {
        animState = speed > 0.35 ? 'crouch_walk' : 'crouch_idle';
      } else if (speed > 4.2 || (entry.sprinting && speed > 1.2)) {
        animState = 'run';
      } else if (speed > 0.35) {
        animState = 'walk';
      }

      updatePeerRigAnimation(entry.rig, animState, entry.targetPitch, dt);
      updatePeerHeldItem(entry.rig, entry.heldItem, entry.flashlightOn, entry.uvOn);
      const dist = Math.hypot(
        root.position.x - this.px,
        root.position.y - this.py,
        root.position.z - this.pz
      );
      updatePeerNametag(entry.rig, {
        nickname: entry.nickname,
        platform: entry.platform,
        speaking: entry.speaking,
        captured: entry.captured,
        distanceMeters: dist,
      });
    }
  }

  private setBodyState(state: 'title' | 'playing' | 'paused' | 'gameover'): void {
    if (typeof document !== 'undefined') {
      document.body.dataset.state = state;
    }
  }

  private hasActiveModal(): boolean {
    return (
      this.keypadOpen ||
      this.cctvOpen ||
      this.workbenchOpen ||
      this.terminalOpen ||
      this.quickInspect !== null
    );
  }

  private triggerViewmodelAction(type: ViewmodelActionAnim): void {
    this.actionAnimType = type;
    this.actionAnimT = 1.0;
    if (type === 'stun_recoil') {
      this.handPosSpring.impulse(0.01, -0.025, 0.085);
      this.handRotSpring.impulse(2.6, 0.3, -0.5);
    } else if (type === 'crowbar_swing') {
      this.handPosSpring.impulse(-0.04, -0.03, -0.07);
      this.handRotSpring.impulse(-2.8, 1.4, 0.9);
    } else if (type === 'key_turn') {
      this.handPosSpring.impulse(0.0, 0.01, -0.06);
      this.handRotSpring.impulse(-0.4, 0.2, 3.1);
    } else if (type === 'flashlight_click') {
      this.handPosSpring.impulse(0.0, -0.01, -0.02);
      this.handRotSpring.impulse(0.65, 0, -0.2);
    } else if (type === 'grab_reach') {
      this.handPosSpring.impulse(-0.03, -0.015, -0.09);
      this.handRotSpring.impulse(-0.9, -0.6, 0.25);
    } else if (type === 'throw_toss') {
      this.handPosSpring.impulse(0.02, 0.03, -0.08);
      this.handRotSpring.impulse(-2.1, 0.4, -0.4);
    } else if (type === 'wire_snip') {
      this.handPosSpring.impulse(-0.01, -0.015, -0.06);
      this.handRotSpring.impulse(-1.1, 0.2, -1.2);
    }
  }

  private installQaBridge(): void {
    if (typeof window === 'undefined') return;
    const bridge = {
      getState: () => ({
        mode: this.mode,
        x: this.px,
        y: this.py,
        z: this.pz,
        floor: this.pFloor,
        yaw: this.yaw,
        pitch: this.pitch,
        roomName: getRoomAt(this.layout, this.px, this.pz, this.pFloor)?.name ?? '',
        inventory: [...this.inventory],
        activeSlot: this.activeSlot,
        battery: Math.round(this.battery),
        droppedCount: this.layout.items.filter((i) => i.droppedByPlayer && !i.collected).length,
        bunkerLeftClosed: !(this.layout.doors.find((d) => d.id === 'door_bunker_left')?.isOpen ?? true),
        bunkerRightClosed: !(this.layout.doors.find((d) => d.id === 'door_bunker_right')?.isOpen ?? true),
        cctvOpen: this.cctvOpen,
        quickInspect: this.quickInspect,
        interactPrompt: this.findNearestInteraction(),
        drawers: this.layout.furniture
          .filter((f) => f.kind === 'drawer_cabinet')
          .map((f) => ({ id: f.id, opened: Boolean(f.opened), x: f.x, z: f.z, floor: f.floor })),
        itemsInDrawers: this.layout.items
          .filter((i) => i.drawerId)
          .map((i) => ({ id: i.id, itemType: i.itemType, drawerId: i.drawerId, collected: i.collected })),
        cassettesInDrawers: this.layout.cassettes
          .filter((t) => t.drawerId)
          .map((t) => ({ id: t.id, drawerId: t.drawerId, listened: t.listened })),
        inputMode: this.inputController.getMode(),
        gamepadStyle: this.inputController.getGamepadStyle(),
        graphicsQuality: this.settings.graphicsQuality,
        dualMoonShadowActive: this.moonLight.castShadow,
        postProcessingActive: this.usePostProcessing,
        diddyInView: this.diddyInView,
      }),
      teleport: (x: number, y: number, z: number, yaw = 0, pitch = 0) => {
        this.px = x;
        this.py = y;
        this.smoothedPlayerY = y;
        this.pz = z;
        this.pFloor = getFloorFromY(y);
        this.yaw = yaw;
        this.targetYaw = yaw;
        this.pitch = pitch;
        this.targetPitch = pitch;
        this.prevPlayerY = y;
        this.vx = 0;
        this.vz = 0;
        this.emitHud();
      },
      setInputMode: (mode: 'touch' | 'pc' | 'gamepad') => {
        const now = performance.now();
        if (mode === 'touch') this.inputController.onTouchInput(now);
        else if (mode === 'pc') this.inputController.onKeyboardInput();
        else this.inputController.onGamepadInput('DualSense Wireless Controller');
        this.isMobileTouch = this.inputController.getMode() === 'touch';
        this.emitHud();
      },
      unlockBasementGates: () => {
        for (const d of this.layout.doors) {
          if (d.lockType === 'basement_key') {
            d.isUnlocked = true;
            d.isOpen = true;
            const dv = this.doorVisuals.find((v) => v.def.id === d.id);
            if (dv?.padlockMesh) dv.padlockMesh.visible = false;
          }
        }
        this.emitHud();
      },
      walkStep: (dx: number, dz: number, steps = 10) => {
        for (let i = 0; i < steps; i++) {
          const r = resolveWorldMovement(
            this.layout,
            this.px,
            this.py,
            this.pz,
            dx / steps,
            dz / steps,
            0.38,
            false,
            this.crouching
          );
          this.px = r.x;
          this.py = r.y;
          this.smoothedPlayerY = r.y;
          this.pz = r.z;
          this.pFloor = r.floor;
        }
        this.emitHud();
        return { x: this.px, y: this.py, z: this.pz, floor: this.pFloor };
      },
      giveItem: (item: ItemType) => {
        if (!this.inventory.includes(item) && this.inventory.length < BACKPACK_CAPACITY) {
          this.inventory.push(item);
          this.emitHud();
        }
      },
      interact: () => this.triggerInteract(),
      dropActive: () => this.dropInventoryItem(),
      reorder: (from: number, to: number) => this.reorderInventorySlot(from, to),
      openCctv: () => this.openCctvMonitor(),
      selectCam: (idx: number) => this.selectCctvCamera(idx),
      closeCctv: () => this.closeCctvMonitor(),
      toggleBunkerDoor: (side: 'left' | 'right') => this.toggleBunkerDoor(side),
      closeQuickInspect: () => this.closeQuickInspect(),
    };
    (window as unknown as Record<string, unknown>).__diddyQA = bridge;
  }

  private triggerHaptic(durationMs: number, strength = 0.45): void {
    if (typeof navigator === 'undefined') return;
    if (this.settings.controls.rumble === false) return;
    const rumbleScale = Math.max(0, Math.min(1, this.settings.controls.rumbleStrength ?? 0.8));
    if (rumbleScale <= 0.01) return;
    const scaledStrength = Math.min(1, strength * rumbleScale);
    if (this.inputController.getMode() === 'touch' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(Math.max(8, Math.round(durationMs * rumbleScale)));
      } catch {
        // ignore
      }
    }
    if (this.gamepadConnected && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const gp = pads ? Array.from(pads).find((p) => p && p.connected) : null;
      const act = (gp as unknown as {
        vibrationActuator?: { playEffect?: (type: string, opts: Record<string, number>) => Promise<void> };
      })?.vibrationActuator;
      if (act?.playEffect) {
        act
          .playEffect('dual-rumble', {
            duration: durationMs,
            strongMagnitude: scaledStrength,
            weakMagnitude: Math.min(1, scaledStrength * 0.7),
          })
          .catch(() => {});
      }
    }
  }

  playUiClick(): void {
    this.audio.playUiClick();
  }

  notifyGamepadActivity(gamepadId: string): void {
    this.gamepadConnected = true;
    if (this.inputController.onGamepadInput(gamepadId)) {
      this.isMobileTouch = false;
      this.emitHud();
    }
  }

  /**
   * Builds a single-init procedural Sector 09 Night PMREM cubemap:
   * - Cool midnight-blue sky dome above
   * - Warm amber/rust corridor lamp bounce panels along the perimeter walls
   * - Subtle cyan/teal sublevel glow + dark damp concrete floor below
   * Ensures all PBR metals (`metalness: 1.0` + `metalnessMap`) reflect true atmospheric light at 0 runtime cost!
   */
  private buildSector09EnvironmentMap(): THREE.WebGLRenderTarget {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0b1528);

    const disposables: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    const addPanel = (
      geo: THREE.BufferGeometry,
      color: number,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0],
      side: THREE.Side = THREE.FrontSide
    ) => {
      const mat = new THREE.MeshBasicMaterial({ color, side });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      envScene.add(mesh);
      disposables.push({ geo, mat });
    };

    // Cool night-blue overhead skylight canopy + moonlight hotspot
    addPanel(new THREE.PlaneGeometry(24, 24), 0x3b67a8, [0, 9.5, 0], [Math.PI / 2, 0, 0]);
    addPanel(new THREE.PlaneGeometry(7.5, 7.5), 0xb8d8ff, [-4.5, 9.2, -5], [Math.PI / 2, 0, 0]);
    // Dark damp floor bounce
    addPanel(new THREE.PlaneGeometry(24, 24), 0x10141c, [0, -6.5, 0], [-Math.PI / 2, 0, 0]);
    // Warm amber / rust industrial lamp bounce strips on N/S/E/W horizon
    addPanel(new THREE.PlaneGeometry(14, 2.8), 0xc47b3b, [0, 2.6, -11], [0, 0, 0]);
    addPanel(new THREE.PlaneGeometry(14, 2.6), 0x99582a, [0, 2.2, 11], [0, Math.PI, 0]);
    addPanel(new THREE.PlaneGeometry(12, 2.5), 0x4b7fa8, [-11, 2.5, 0], [0, Math.PI / 2, 0]);
    addPanel(new THREE.PlaneGeometry(12, 2.4), 0xb87640, [11, 2.4, 0], [0, -Math.PI / 2, 0]);
    // Subtle cyan emergency strip accent
    addPanel(new THREE.PlaneGeometry(5, 1.4), 0x38bdf8, [6, -1.0, -10.5], [0, 0, 0]);

    const rt = this.pmremGen.fromScene(envScene, 0.04);
    for (const d of disposables) {
      d.geo.dispose();
      d.mat.dispose();
    }
    return rt;
  }

  private ensurePostProcessing(): void {
    if (this.composer || this.isSoftwareGl) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.52, 0.84);
    this.composer.addPass(this.bloomPass);

    const FilmChromaticShader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uGrain: { value: 0.032 },
        uChromatic: { value: 0.0012 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uGrain;
        uniform float uChromatic;
        varying vec2 vUv;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        void main() {
          vec2 dir = vUv - vec2(0.5);
          float dist = length(dir);
          vec2 shift = dir * uChromatic * (0.4 + dist * 1.4);
          float r = texture2D(tDiffuse, clamp(vUv + shift, 0.001, 0.999)).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, clamp(vUv - shift, 0.001, 0.999)).b;
          vec3 col = vec3(r, g, b);
          float grain = (hash(vUv * vec2(640.0, 360.0) + fract(uTime * 19.3)) - 0.5) * uGrain;
          col += grain;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    };
    this.filmPass = new ShaderPass(FilmChromaticShader);
    this.composer.addPass(this.filmPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  // ---- PUBLIC CONTROLS FOR REACT UI ----

  applySettings(next: GameSettings): void {
    const prevQuality = this.settings.graphicsQuality;
    this.settings = next;
    this.audio.applySettings(next);

    const prof = getGraphicsProfile(next.graphicsQuality);
    const resScale = next.video.resolutionScale ?? 1.0;
    const dpr = this.isSoftwareGl
      ? 0.6
      : Math.max(0.5, Math.min(window.devicePixelRatio || 1, prof.maxDpr) * resScale);
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMappingExposure = 1.08 * (next.video.brightness ?? 1.0);

    // Real-time Contrast tuning on the WebGL canvas (ZERO backdrop-filter!)
    const contrastVal = Math.max(0.75, Math.min(1.4, next.video.contrast ?? 1.0));
    this.renderer.domElement.style.filter =
      Math.abs(contrastVal - 1.0) > 0.01 ? `contrast(${contrastVal.toFixed(2)})` : '';

    // Real-time PBR / Texture Filtering Quality
    this.materialPack.setTextureQuality(next.video.textureQuality ?? 'high');

    // Tiered Lighting & Shadows (Granular shadowsLevel: off | low | medium | high | ultra)
    const shadowsLvl = next.video.shadowsLevel;
    let shadowsWanted = prof.shadowsEnabled;
    let shadowSize = prof.shadowMapSize;
    let wantDualMoon = prof.dualMoonShadow;
    if (shadowsLvl === 'off' || next.video.shadowsOverride === 'off') {
      shadowsWanted = false;
      wantDualMoon = false;
    } else if (shadowsLvl === 'low') {
      shadowsWanted = true;
      shadowSize = 512;
      wantDualMoon = false;
    } else if (shadowsLvl === 'medium') {
      shadowsWanted = true;
      shadowSize = 1024;
      wantDualMoon = false;
    } else if (shadowsLvl === 'high') {
      shadowsWanted = true;
      shadowSize = 1024;
      wantDualMoon = true;
    } else if (shadowsLvl === 'ultra') {
      shadowsWanted = true;
      shadowSize = 2048;
      wantDualMoon = true;
    } else if (next.video.shadowsOverride === 'on') {
      shadowsWanted = true;
    }

    const useShadows = !this.isSoftwareGl && shadowsWanted;
    this.renderer.shadowMap.enabled = useShadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.flashlight.castShadow = useShadows;
    if (useShadows) {
      if (this.flashlight.shadow.mapSize.x !== shadowSize) {
        this.flashlight.shadow.mapSize.set(shadowSize, shadowSize);
        if (this.flashlight.shadow.map) {
          this.flashlight.shadow.map.dispose();
          this.flashlight.shadow.map = null;
        }
      }
      this.flashlight.shadow.bias = -0.0004;
      this.flashlight.shadow.normalBias = 0.02;
      this.flashlight.shadow.radius = 2.2;
    }

    const useDualMoonShadow = useShadows && wantDualMoon;
    this.moonLight.castShadow = useDualMoonShadow;
    if (useDualMoonShadow) {
      if (this.moonLight.shadow.mapSize.x !== shadowSize) {
        this.moonLight.shadow.mapSize.set(shadowSize, shadowSize);
        if (this.moonLight.shadow.map) {
          this.moonLight.shadow.map.dispose();
          this.moonLight.shadow.map = null;
        }
      }
      this.moonLight.shadow.autoUpdate = false;
      this.moonLight.shadow.needsUpdate = true;
    }
    this.renderer.shadowMap.needsUpdate = true;
    if (this.pergolaProjectedShadows) {
      this.pergolaProjectedShadows.visible = !useDualMoonShadow;
    }

    // Living Water Reflections & Quality live sync
    this.waterManager?.setWaterSettings(
      next.video.waterReflections ?? true,
      next.video.waterQuality ?? 'high'
    );

    // Tiered Parallax Mapping (UV-clamped safe for NearestFilter 32x32 voxel blocks on High/Ultra!)
    this.materialPack.setParallaxEnabled(
      !this.isSoftwareGl && prof.parallaxEnabled,
      next.graphicsQuality === 'ultra' ? 0.025 : 0.017
    );

    // Tiered Post-Processing (EffectComposer UnrealBloom + Chromatic + Film Grain)
    const postWanted =
      next.video.postProcessingOverride === 'on'
        ? true
        : next.video.postProcessingOverride === 'off'
        ? false
        : prof.postProcessingEnabled;
    this.usePostProcessing = !this.isSoftwareGl && postWanted;
    const vhsMult = Math.max(0, Math.min(1, next.video.vhsIntensity ?? 0.65));
    if (this.usePostProcessing) {
      this.ensurePostProcessing();
      if (this.composer) {
        this.composer.setPixelRatio(dpr);
      }
      if (this.bloomPass) {
        this.bloomPass.strength = next.graphicsQuality === 'ultra' ? 0.38 : 0.25;
      }
      if (this.filmPass) {
        this.filmPass.uniforms.uChromatic.value =
          (next.graphicsQuality === 'ultra' ? 0.0016 : 0.00095) * vhsMult;
        this.filmPass.uniforms.uGrain.value =
          (next.graphicsQuality === 'ultra' ? 0.036 : 0.026) * vhsMult;
      }
    }

    if (this.dustPoints) {
      this.dustPoints.visible = next.video.volumetricDust;
    }
    if (this.courtyardRainLines) {
      this.courtyardRainLines.visible = next.video.rainParticles ?? true;
    }

    const renderDist = Math.max(0.5, Math.min(1.5, next.video.renderDistance ?? 1.0));
    this.currentFov = next.video.fov;
    this.camera.fov = next.video.fov;
    this.camera.far = Math.round(115 * renderDist);
    this.camera.updateProjectionMatrix();
    this.handleResize();

    if (prevQuality !== next.graphicsQuality) {
      this.rebuildDustParticles(prof.dustParticleCount);
    }
    this.emitHud();
  }

  toggleMute(): boolean {
    const nextMuted = !this.settings.audio.muted;
    const updated = saveManager.updateSettings({
      ...this.settings,
      audio: { ...this.settings.audio, muted: nextMuted },
    });
    this.applySettings(updated);
    return nextMuted;
  }

  setMinimapCanvas(canvas: HTMLCanvasElement | null): void {
    this.minimapCanvas = canvas;
    if (canvas) this.drawStrictFogMap(canvas, false);
  }

  setFullMapCanvas(canvas: HTMLCanvasElement | null): void {
    this.fullMapCanvas = canvas;
    if (canvas) this.drawStrictFogMap(canvas, true);
  }

  setCctvCanvas(canvas: HTMLCanvasElement | null): void {
    this.cctvCanvas = canvas;
    this.cctvImageData = null;
    if (canvas && this.cctvOpen) {
      this.renderCctvFrame();
    }
  }

  startNewGame(
    difficulty: Difficulty,
    skipIntro = false,
    customSeed?: number,
    localPlayerId = 'local_player',
    runLocalServer = true
  ): void {
    this.audio.unlock();
    this.difficulty = difficulty;
    const seed = typeof customSeed === 'number' && Number.isFinite(customSeed)
      ? Math.floor(customSeed)
      : Math.floor(Date.now() % 1000000) + 17;
    this.localPlayerId = localPlayerId;
    this.isRemoteClient = !runLocalServer;
    this.remoteDiddyInterp.clear();
    this.remoteDiddyTarget.initialized = false;
    this.garageBatteryInstalled = false;
    this.garageFuelInstalled = false;
    this.bookshelfSunInstalled = false;
    this.bookshelfMoonInstalled = false;
    this.bookshelfOpened = false;
    this.pianoSequenceStep = 0;
    this.steamValvesClosed = [false, false, false];
    this.oiledDoors.clear();
    this.polaroidCooldownSec = 0;
    tapeAudioPlayer.stop(false);
    this.playerLifeState = 'ALIVE';
    this.bleedoutSec = 0;
    this.mpSpectating = false;
    this.spectateTargetName = null;
    this.bunkerLureCooldownSec = 0;
    this.neuralInterference = 0;
    this.creakCooldownSec = 0;
    this.finalGateSirenSec = 0;
    const progInit = saveSystem.getProgression();
    if (runLocalServer) {
      this.authoritativeServer = new GameServer(seed, difficulty);
      this.authoritativeServer.addPlayer({
        id: localPlayerId,
        nickname: 'Agente',
        platform: this.inputController.getMode(),
        activePerks: progInit.equippedPerks,
      });
      this.layout = this.authoritativeServer.layout;
    } else {
      this.authoritativeServer = null;
      this.layout = generateMansionLayout(seed, difficulty);
    }
    this.inputPredictor.reset(this.layout.spawnPoint.x, this.layout.spawnPoint.z);
    this.lastSelfHealSnapshot = this.authoritativeServer ? this.authoritativeServer.exportSnapshot() : null;
    this.buildWorldScene();

    const diffCfg = getDifficultyConfig(difficulty);
    this.px = this.layout.spawnPoint.x;
    this.py = this.layout.spawnPoint.y;
    this.prevPlayerY = this.py;
    this.smoothedPlayerY = this.py;
    this.pz = this.layout.spawnPoint.z;
    this.pFloor = this.layout.spawnPoint.floor;
    this.yaw = this.layout.spawnPoint.yaw;
    this.targetYaw = this.yaw;
    this.pitch = 0;
    this.targetPitch = 0;
    this.sprintToggleActive = false;
    this.drizzyOilyStepsLeft = 0;
    this.handPosSpring.reset(0, 0, 0);
    this.handRotSpring.reset(0, 0, 0);
    this.landingDipSpring.reset(0);
    // Phase 2: Load active Perks & equipped Cosmetics from Save v4
    const prog = saveSystem.getProgression();
    this.activePerks = [...prog.equippedPerks];
    const flCos = getFlashlightCosmetic(prog.cosmetics.equippedFlashlight);
    this.flashlightBeamHex = flCos.beamHex;
    this.flashlightLensHex = flCos.lensHex;
    this.equippedGloveSkin = prog.cosmetics.equippedGloves;
    this.equippedDiddySkin = prog.cosmetics.equippedDiddySkin;
    this.maxBattery = this.hasPerk('extended_battery') ? 125 : 100;
    this.runDetections = 0;
    this.runStunsApplied = 0;
    this.runFlaresUsed = 0;
    this.runHoldBreathSurvived = 0;
    this.runCraftsCompleted = 0;
    this.wasChasedPrevFrame = false;
    this.wasInVentPrevFrame = false;
    this.adrenalineBurstTimer = 0;
    this.lastEndingId = null;
    this.lastMissionReport = null;
    this.galleryReplayMode = false;

    this.vx = 0;
    this.vz = 0;
    this.health = diffCfg.playerMaxHealth;
    this.maxHealth = diffCfg.playerMaxHealth;
    this.stamina = 100;
    this.battery = this.maxBattery;
    this.flashlightOn = true;
    this.uvMode = false;
    this.flashlight.color.setHex(this.flashlightBeamHex);
    this.flashlightSpill.color.setHex(this.flashlightBeamHex);
    if (typeof (this.heldItemRig as { setGloveSkin?: (g: GloveSkinId) => void }).setGloveSkin === 'function') {
      (this.heldItemRig as { setGloveSkin?: (g: GloveSkinId) => void }).setGloveSkin?.(this.equippedGloveSkin);
    }
    if (typeof (this.heldItemRig as { setFlashlightColor?: (hex: number) => void }).setFlashlightColor === 'function') {
      (this.heldItemRig as { setFlashlightColor?: (hex: number) => void }).setFlashlightColor?.(this.flashlightLensHex);
    }
    this.heldItemRig.setUvMode(false);
    this.crouching = false;
    this.inVent = false;
    this.sprinting = false;
    this.flares = diffCfg.startingFlares + (this.hasPerk('omega_protocol') ? 1 : 0);
    this.stunAmmo = this.hasPerk('spare_cartridge') ? 1 : 0;
    this.throwables = 0;
    this.inventory = ['flashlight'];
    if (this.flares > 0) this.inventory.push('flare');
    this.activeSlot = 0;
    this.heldItemRig.setActiveItem('flashlight');
    this.equipAnim = 0;

    this.securityPowerPct = 100;
    this.cctvOpen = false;
    this.cctvActiveCamIndex = 0;
    this.cctvSecretHintSeen = false;
    this.workbenchOpen = false;
    this.terminalOpen = false;
    this.terminalUnlocked = false;
    this.translationBoardSeen = false;
    this.blackoutTriggered = false;
    this.blackoutActive = false;
    this.blackoutAlertTimer = 0;
    this.fuseInstalled = false;
    this.generatorFixed = false;
    this.ventWarnCooldown = 0;
    this.stunFlashTimer = 0;

    this.hidingSpot = null;
    this.hidingTransition = 0;
    this.holdBreath.cancel();
    this.disabledLightRooms.clear();
    this.uvScanTimers.clear();
    this.staminaExhausted = false;
    this.exhaustedPantCooldown = 0;
    this.chromaticIntensity = 0;
    this.mobileHoldBreathHeld = false;
    this.gamepadHoldBreathHeld = false;
    this.squareHoldTimer = 0;
    this.squareDropTriggered = false;
    this.elapsedSec = 0;
    this.damageFlash = 0;
    this.invulnerableTimer = 0;
    this.hitBoostTimer = 0;
    this.trauma = 0;
    this.noiseLevel = 0;
    this.noiseQueue = [];
    this.keypadOpen = false;
    this.quickInspect = null;
    this.actionAnimType = 'none';
    this.actionAnimT = 0;
    this.lookSwayX = 0;
    this.lookSwayY = 0;
    this.chapter2JustUnlocked = false;
    this.isNewBestTime = false;
    this.statusBanner = null;
    this.keysPressed.clear();
    this.mobileMoveX = 0;
    this.mobileMoveY = 0;
    this.mobileSprintHeld = false;

    this.fog.reset();
    this.fog.revealAround(this.px, this.pz, this.pFloor, 3.8);
    this.ai.reset(this.layout);

    if (skipIntro) {
      this.enterPlayingState();
    } else {
      this.startCutscene('intro');
    }
  }

  private hasPerk(id: PerkId): boolean {
    return this.activePerks.includes(id);
  }

  private advanceAndNotifyAchievement(id: AchievementId, amount = 1, absolute = false): void {
    const toast = saveSystem.advanceAchievement(id, amount, absolute);
    if (toast) {
      this.callbacks.onAchievementUnlocked?.(toast);
      this.callbacks.onProgressionUpdate?.(saveSystem.getProgression());
    }
  }

  getAuthoritativeServer(): GameServer | null {
    return this.authoritativeServer;
  }

  getLastWorldSnapshot(): GameWorldState | null {
    return this.authoritativeServer ? this.authoritativeServer.exportSnapshot() : this.lastSelfHealSnapshot;
  }

  promoteToHostFromSnapshot(snapshot?: GameWorldState): GameServer | null {
    const snap = snapshot ?? this.lastSelfHealSnapshot;
    if (!snap) return null;
    this.isRemoteClient = false;
    this.authoritativeServer = GameServer.fromSnapshot(snap);
    this.applyReplicatedWorldSnapshot(snap);
    return this.authoritativeServer;
  }

  applyCompactDelta(delta: CompactDeltaPacket): void {
    if (delta.d && this.isRemoteClient) {
      const stateList: readonly import('./types').DiddyAiState[] = [
        'patrol',
        'investigate',
        'chase',
        'inspecting_hiding',
        'search_hiding',
        'stunned',
      ];
      const [dx, dy, dz, dyaw, dfloor, stIdx] = delta.d;
      const st = stateList[stIdx] ?? 'patrol';
      this.remoteDiddyTarget.x = dx;
      this.remoteDiddyTarget.y = dy;
      this.remoteDiddyTarget.z = dz;
      this.remoteDiddyTarget.yaw = dyaw;
      this.remoteDiddyTarget.floor = dfloor;
      this.remoteDiddyTarget.state = st;
      this.remoteDiddyInterp.push({
        x: dx,
        y: dy,
        z: dz,
        yaw: dyaw,
        floor: dfloor,
        state: st,
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        tick: delta.t,
      });
      if (!this.remoteDiddyTarget.initialized) {
        this.remoteDiddyTarget.initialized = true;
        this.ai.x = dx;
        this.ai.y = dy;
        this.ai.z = dz;
        this.ai.yaw = dyaw;
        this.ai.floor = dfloor;
      }
      this.ai.state = st;
      this.ai.animState =
        st === 'chase'
          ? 'chase'
          : st === 'stunned'
          ? 'stunned'
          : st === 'investigate'
          ? 'investigate'
          : 'patrol';
    }
    if (delta.e?.doors) {
      for (const [doorId, ds] of Object.entries(delta.e.doors)) {
        this.applyRemoteDoorToggle(doorId, ds.isOpen, ds.isUnlocked);
      }
    }
    if (delta.e?.items) {
      for (const [itemId, it] of Object.entries(delta.e.items)) {
        this.applyRemoteItemSync(itemId, it.collected, {
          itemType: it.itemType,
          floor: it.floor,
          x: it.x,
          y: it.y,
          z: it.z,
        });
      }
    }
    if (delta.e?.generatorFixed && !this.generatorFixed) {
      this.applyRemoteGeneratorFixed();
    }
    if (delta.e?.safeUnlocked && !this.layout.safe.unlocked) {
      this.layout.safe.unlocked = true;
    }
    if (delta.e?.terminalUnlocked && !this.terminalUnlocked) {
      this.terminalUnlocked = true;
    }
  }

  applyReplicatedWorldSnapshot(snapshot: GameWorldState): void {
    this.lastSelfHealSnapshot = snapshot;
    if (this.isRemoteClient && snapshot.diddy) {
      this.remoteDiddyTarget.x = snapshot.diddy.x;
      this.remoteDiddyTarget.y = snapshot.diddy.y;
      this.remoteDiddyTarget.z = snapshot.diddy.z;
      this.remoteDiddyTarget.yaw = snapshot.diddy.yaw;
      this.remoteDiddyTarget.floor = snapshot.diddy.floor;
      this.remoteDiddyTarget.state = snapshot.diddy.state;
      this.remoteDiddyInterp.push({
        x: snapshot.diddy.x,
        y: snapshot.diddy.y,
        z: snapshot.diddy.z,
        yaw: snapshot.diddy.yaw,
        floor: snapshot.diddy.floor,
        state: snapshot.diddy.state,
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        tick: snapshot.tick,
      });
      if (!this.remoteDiddyTarget.initialized) {
        this.remoteDiddyTarget.initialized = true;
        this.ai.x = snapshot.diddy.x;
        this.ai.y = snapshot.diddy.y;
        this.ai.z = snapshot.diddy.z;
        this.ai.yaw = snapshot.diddy.yaw;
        this.ai.floor = snapshot.diddy.floor;
      }
      this.ai.state = snapshot.diddy.state;
      this.ai.animState = snapshot.diddy.animState;
    }
    for (const [doorId, ds] of Object.entries(snapshot.doors)) {
      this.applyRemoteDoorToggle(doorId, ds.isOpen, ds.isUnlocked);
    }
    if (snapshot.items) {
      for (const [itemId, it] of Object.entries(snapshot.items)) {
        this.applyRemoteItemSync(itemId, it.collected, {
          itemType: it.itemType,
          floor: it.floor,
          x: it.x,
          y: it.y,
          z: it.z,
        });
      }
    }
    if (snapshot.generatorFixed && !this.generatorFixed) {
      this.applyRemoteGeneratorFixed();
    }
    if (snapshot.safeUnlocked && !this.layout.safe.unlocked) {
      this.layout.safe.unlocked = true;
    }
    if (snapshot.terminalUnlocked && !this.terminalUnlocked) {
      this.terminalUnlocked = true;
    }
  }

  pauseBackgroundLoop(paused: boolean): void {
    this.backgroundPaused = paused;
  }

  playRankStampSound(): void {
    this.audio.unlock();
    this.audio.playEscapeReliefChord();
  }

  syncProgressionCosmetics(): void {
    const prog = saveSystem.getProgression();
    this.activePerks = [...prog.equippedPerks];
    const fl = getFlashlightCosmetic(prog.cosmetics.equippedFlashlight);
    this.flashlightBeamHex = fl.beamHex;
    this.flashlightLensHex = fl.lensHex;
    if (!this.uvMode) {
      this.flashlight.color.setHex(this.flashlightBeamHex);
      this.flashlightSpill.color.setHex(this.flashlightBeamHex);
    }

    const nextGloves = prog.cosmetics.equippedGloves;
    if (nextGloves !== this.equippedGloveSkin) {
      this.equippedGloveSkin = nextGloves;
      if (typeof (this.heldItemRig as { setGloveSkin?: (g: GloveSkinId) => void }).setGloveSkin === 'function') {
        (this.heldItemRig as { setGloveSkin?: (g: GloveSkinId) => void }).setGloveSkin?.(nextGloves);
      }
    }
    if (typeof (this.heldItemRig as { setFlashlightColor?: (hex: number) => void }).setFlashlightColor === 'function') {
      (this.heldItemRig as { setFlashlightColor?: (hex: number) => void }).setFlashlightColor?.(this.flashlightLensHex);
    }

    const nextDiddySkin = prog.cosmetics.equippedDiddySkin;
    if (nextDiddySkin !== this.equippedDiddySkin) {
      this.equippedDiddySkin = nextDiddySkin;
      if (this.diddyRig && this.worldGroup) {
        const pos = this.diddyRig.root.position.clone();
        const rotY = this.diddyRig.root.rotation.y;
        const vis = this.diddyRig.root.visible;
        this.worldGroup.remove(this.diddyRig.root);
        this.diddyRig = createDiddyArticulatedRig(this.materialPack, nextDiddySkin);
        this.diddyRig.root.position.copy(pos);
        this.diddyRig.root.rotation.y = rotY;
        this.diddyRig.root.visible = vis;
        if (this.stunSparksRig) {
          this.diddyRig.root.add(this.stunSparksRig);
        }
        this.worldRegistry.trackObject3D(this.diddyRig.root);
        this.worldGroup.add(this.diddyRig.root);
      }
      const newPortrait = renderDiddyPortrait(
        this.renderer,
        this.materialPack,
        nextDiddySkin,
        this.envRenderTarget.texture
      );
      if (newPortrait) {
        this.characterPortraits = { ...this.characterPortraits, diddy: newPortrait };
        this.callbacks.onPortraitsUpdate?.(this.characterPortraits);
      }
    }
  }

  replayEndingCutscene(endingId: EndingId): void {
    this.audio.unlock();
    this.backgroundPaused = false;
    this.galleryReplayMode = true;
    this.syncProgressionCosmetics();
    const csId: CutsceneId =
      endingId === 'bad'
        ? 'ending_bad'
        : endingId === 'real'
        ? 'ending_real'
        : endingId === 'secret'
        ? 'ending_secret'
        : 'ending_good';
    this.startCutscene(csId);
  }

  returnToTitle(): void {
    this.exitPointerLock();
    this.mode = 'title';
    this.activeCutscene = null;
    this.keypadOpen = false;
    this.cctvOpen = false;
    this.workbenchOpen = false;
    this.terminalOpen = false;
    this.quickInspect = null;
    this.hidingSpot = null;
    this.jumpscareLight.visible = false;
    this.aimHighlightBox.visible = false;
    this.callbacks.onCutsceneUpdate(null);
    this.setBodyState('title');
    this.emitHud();
  }

  pauseGame(): void {
    if (this.mode !== 'playing') return;
    this.exitPointerLock();
    this.mode = 'paused';
    this.keysPressed.clear();
    this.mobileMoveX = 0;
    this.mobileMoveY = 0;
    this.setBodyState('paused');
    this.emitHud();
  }

  resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.keysPressed.clear();
    this.setBodyState('playing');
    this.emitHud();
  }

  // ---- MODALS: SAFE KEYPAD, Cabine 09-A CCTV, WORKBENCH, SECRET TERMINAL ----

  openSafeKeypad(): void {
    if (this.mode !== 'playing') return;
    this.exitPointerLock();
    this.keypadOpen = true;
    this.keysPressed.clear();
    this.emitHud();
  }

  closeSafeKeypad(): void {
    this.keypadOpen = false;
    this.emitHud();
  }

  closeQuickInspect(): void {
    if (!this.quickInspect) return;
    this.quickInspect = null;
    this.emitHud();
  }

  /**
   * Swaps or moves inventory items between Hotbar (0..5) and Backpack (6..9).
   */
  reorderInventorySlot(fromIdx: number, toIdx: number): void {
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= BACKPACK_CAPACITY ||
      toIdx >= BACKPACK_CAPACITY ||
      fromIdx === toIdx
    ) {
      return;
    }
    const padded: (ItemType | null)[] = Array.from(
      { length: BACKPACK_CAPACITY },
      (_, i) => this.inventory[i] ?? null
    );
    const tmp = padded[fromIdx];
    padded[fromIdx] = padded[toIdx];
    padded[toIdx] = tmp;

    // Preserve exact slot positions for hotbar/backpack compacting only trailing nulls beyond max index?
    // Even cleaner: compact while keeping swapped order intact if both occupied, or insert at target!
    if (padded[fromIdx] !== null && padded[toIdx] !== null) {
      this.inventory = padded.filter((x): x is ItemType => x !== null);
    } else {
      const compact = padded.filter((x): x is ItemType => x !== null);
      this.inventory = compact;
    }

    const activeItem = this.inventory[this.activeSlot] ?? this.inventory[0] ?? 'flashlight';
    if (!this.inventory[this.activeSlot]) {
      this.activeSlot = 0;
    }
    this.heldItemRig.setActiveItem(activeItem);
    this.equipAnim = 0.85;
    this.audio.playFlashlightClick();
    this.emitHud();
  }

  /**
   * Drops a droppable item cleanly onto a table/floor surface in front of the player as a real 3D voxel pickup!
   */
  dropInventoryItem(slotIdx?: number): boolean {
    if (this.mode !== 'playing' || this.hidingSpot) return false;
    const idx = slotIdx ?? this.activeSlot;
    const itemType = this.inventory[idx];
    if (!itemType) return false;

    if (itemType === 'flashlight') {
      this.audio.playLockedRattle();
      this.showBanner('A Lanterna Tática é essencial e não pode ser dropada.');
      return false;
    }

    this.audio.unlock();

    // Compute safe drop point 0.88m forward clamped by walls/doors
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const dropResolved = resolveWorldMovement(
      this.layout,
      this.px,
      this.py,
      this.pz,
      fwdX * 0.88,
      fwdZ * 0.88,
      0.26,
      false,
      true
    );

    const floorY = dropResolved.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    let dropY = floorY + 0.14;

    // Snap onto a nearby flat surface (table/desk/crate/workbench) if within 0.82m!
    for (const f of this.layout.furniture) {
      if (f.floor !== dropResolved.floor) continue;
      if (
        f.kind !== 'side_table' &&
        f.kind !== 'dining_table' &&
        f.kind !== 'desk_monitor' &&
        f.kind !== 'crate' &&
        f.kind !== 'barrel'
      ) {
        continue;
      }
      if (Math.hypot(f.x - dropResolved.x, f.z - dropResolved.z) < 0.82) {
        const surfTop =
          f.kind === 'side_table'
            ? 0.82
            : f.kind === 'dining_table'
            ? 0.9
            : f.kind === 'desk_monitor'
            ? 0.95
            : f.kind === 'crate'
            ? 0.95
            : 1.04;
        dropY = floorY + surfTop + 0.08;
        break;
      }
    }
    for (const wb of this.layout.workbenches) {
      if (wb.floor === dropResolved.floor && Math.hypot(wb.x - dropResolved.x, wb.z - dropResolved.z) < 0.95) {
        dropY = floorY + 1.08;
        break;
      }
    }

    let droppedAmmo: number | undefined;
    if (itemType === 'throwable_can') {
      this.throwables = Math.max(0, this.throwables - 1);
      if (this.throwables <= 0) {
        this.inventory.splice(idx, 1);
      }
    } else if (itemType === 'flare') {
      this.flares = Math.max(0, this.flares - 1);
      if (this.flares <= 0) {
        this.inventory.splice(idx, 1);
      }
    } else {
      if (itemType === 'stun_gun') {
        droppedAmmo = this.stunAmmo;
        this.stunAmmo = 0;
      }
      this.inventory.splice(idx, 1);
    }

    const droppedSpawn: WorldItemSpawn = {
      id: `dropped_${itemType}_${Date.now()}_${Math.floor(Math.random() * 999)}`,
      itemType,
      label: getItemLabel(itemType),
      floor: dropResolved.floor,
      x: dropResolved.x,
      y: dropY,
      z: dropResolved.z,
      zoneId: 'dropped',
      collected: false,
      droppedByPlayer: true,
      droppedAmmo,
    };

    this.layout.items.push(droppedSpawn);
    const mesh = createItemPickupMesh(droppedSpawn, this.materialPack.contactShadowTex);
    const ringColor =
      itemType === 'red_key'
        ? 0xef4444
        : itemType === 'blue_key'
        ? 0x3b82f6
        : itemType === 'master_key' || itemType === 'basement_key'
        ? 0xfbbf24
        : itemType === 'stun_gun'
        ? 0x38bdf8
        : 0x34d399;
    const glowRing = createDroppedItemGlowRing(this.materialPack, ringColor);
    mesh.add(glowRing);
    this.worldRegistry.trackObject3D(mesh);
    this.worldGroup.add(mesh);
    this.itemMeshes.set(droppedSpawn.id, mesh);

    if (this.activeSlot >= this.inventory.length || !this.inventory[this.activeSlot]) {
      this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
    }
    this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
    this.triggerViewmodelAction('throw_toss');
    const isMetal = itemType !== 'flare';
    this.audio.playItemDrop(isMetal);
    this.triggerHaptic(32, 0.25);
    this.emitNoise(dropResolved.x, dropY, dropResolved.z, dropResolved.floor, 8, 1, 'dropped_object');
    this.showBanner(`Item dropado: ${droppedSpawn.label} (brilhando no chão para pegar depois).`);
    this.emitHud();
    return true;
  }

  openCctvMonitor(): void {
    if (this.mode !== 'playing') return;
    if (this.securityPowerPct <= 0.5) {
      this.audio.playLockedRattle();
      this.showBanner('Monitor CCTV sem energia! Restaure o Gerador no Subsolo.');
      return;
    }
    this.exitPointerLock();
    this.cctvOpen = true;
    this.transitionFade = 0.65;
    this.keysPressed.clear();
    this.audio.playCctvStatic();
    this.checkActiveCameraSecret();
    this.emitHud();
    if (this.cctvCanvas) this.renderCctvFrame();
  }

  closeCctvMonitor(): void {
    if (!this.cctvOpen) return;
    this.cctvOpen = false;
    this.transitionFade = 0.5;
    this.audio.playCctvStatic();
    this.emitHud();
  }

  selectCctvCamera(index: number): void {
    if (index < 0 || index >= this.layout.bunkerCameras.length) return;
    this.cctvActiveCamIndex = index;
    this.audio.playCctvStatic();
    this.checkActiveCameraSecret();
    this.emitHud();
    if (this.cctvCanvas) this.renderCctvFrame();
  }

  private checkActiveCameraSecret(): void {
    const cam = this.layout.bunkerCameras[this.cctvActiveCamIndex];
    if (cam?.secretCodeHint && !this.cctvSecretHintSeen) {
      this.cctvSecretHintSeen = true;
      this.showBanner(`CAM 06 registrou código secreto na parede: ${cam.secretCodeHint} (salvo no Diário!)`);
    }
  }

  toggleBunkerDoor(side: 'left' | 'right'): void {
    if (this.mode !== 'playing') return;
    this.audio.unlock();
    const doorId = side === 'left' ? 'door_bunker_left' : 'door_bunker_right';
    const door = this.layout.doors.find((d) => d.id === doorId);
    if (!door) return;

    const wantsClose = door.isOpen;
    if (wantsClose && this.securityPowerPct <= 1) {
      this.audio.playLockedRattle();
      this.showBanner('Energia da Segurança esgotada! Não é possível fechar a porta blindada.');
      return;
    }

    door.isOpen = !door.isOpen;
    this.audio.playBunkerBlastDoor(!door.isOpen);
    this.emitNoise(this.px, this.py, this.pz, this.pFloor, 12, 2, 'door');
    this.updateBunkerVisualIndicators();
    this.showBanner(
      door.isOpen
        ? `${door.name} aberta.`
        : `${door.name} SELADA! P. Drizzy não consegue passar.`
    );
    this.emitHud();
  }

  private updateBunkerVisualIndicators(): void {
    for (const btn of this.layout.bunkerButtons) {
      const door = this.layout.doors.find((d) => d.id === btn.doorId);
      const vis = this.bunkerButtonVisuals.get(btn.id);
      if (door && vis) {
        const closed = !door.isOpen;
        vis.buttonMat.color.setHex(closed ? 0xef4444 : 0x22c55e);
        vis.buttonMat.emissive.setHex(closed ? 0xdc2626 : 0x16a34a);
      }
      const dv = this.doorVisuals.find((v) => v.def.id === btn.doorId);
      if (door && dv?.ledMesh) {
        const mat = dv.ledMesh.material as THREE.MeshStandardMaterial;
        const closed = !door.isOpen;
        mat.color.setHex(closed ? 0xef4444 : 0x22c55e);
        mat.emissive.setHex(closed ? 0xdc2626 : 0x16a34a);
      }
    }
  }

  openWorkbench(): void {
    if (this.mode !== 'playing') return;
    this.exitPointerLock();
    this.workbenchOpen = true;
    this.keysPressed.clear();
    this.emitHud();
  }

  closeWorkbench(): void {
    this.workbenchOpen = false;
    this.emitHud();
  }

  craftRecipe(recipe: 'crowbar' | 'stun_ammo'): { ok: boolean; message: string } {
    this.audio.unlock();
    if (recipe === 'crowbar') {
      if (this.inventory.includes('crowbar')) {
        return { ok: false, message: 'Você já possui o Pé de Cabra montado!' };
      }
      if (!this.inventory.includes('crowbar_rod') || !this.inventory.includes('crowbar_hook')) {
        this.audio.playLockedRattle();
        return { ok: false, message: 'Precisa da Haste de Ferro + Gancho de Aço.' };
      }
      this.inventory = this.inventory.filter((i) => i !== 'crowbar_rod' && i !== 'crowbar_hook');
      this.inventory.push('crowbar');
      this.equipItemIfInHotbar('crowbar');
      this.audio.playWorkbenchCraft();
      this.runCraftsCompleted += 1;
      this.advanceAndNotifyAchievement('field_engineer', 1);
      this.emitNoise(this.px, this.py, this.pz, this.pFloor, 11, 2, 'door');
      this.showBanner('Bancada: Pé de Cabra montado e equipado!');
      this.emitHud();
      return { ok: true, message: 'Pé de Cabra fabricado com sucesso!' };
    }

    if (!this.inventory.includes('stun_coil') || !this.inventory.includes('stun_cell')) {
      this.audio.playLockedRattle();
      return { ok: false, message: 'Precisa da Bobina Elétrica + Célula de Carga.' };
    }
    this.inventory = this.inventory.filter((i) => i !== 'stun_coil' && i !== 'stun_cell');
    this.stunAmmo += 1;
    this.audio.playWorkbenchCraft();
    this.runCraftsCompleted += 1;
    this.advanceAndNotifyAchievement('field_engineer', 1);
    this.emitNoise(this.px, this.py, this.pz, this.pFloor, 11, 2, 'door');
    this.showBanner(`Bancada: +1 Carga de Stun fabricada! (Total: ${this.stunAmmo})`);
    this.emitHud();
    return { ok: true, message: '+1 Carga de Stun fabricada!' };
  }

  openSecretTerminal(): void {
    if (this.mode !== 'playing') return;
    this.exitPointerLock();
    this.terminalOpen = true;
    this.keysPressed.clear();
    this.emitHud();
  }

  closeSecretTerminal(): void {
    this.terminalOpen = false;
    this.emitHud();
  }

  submitSecretTerminalCode(code: string): { ok: boolean; message: string } {
    this.audio.unlock();
    if (code === this.layout.secretTerminalCode) {
      this.terminalUnlocked = true;
      this.terminalOpen = false;
      this.advanceAndNotifyAchievement('omega_whistleblower', 1, true);
      this.audio.playKeypadPress(false, true);
      const tv = this.furnitureVisuals.find((f) => f.def.kind === 'secret_terminal');
      if (tv?.statusMat) {
        tv.statusMat.color.setHex(0x22c55e);
        tv.statusMat.emissive.setHex(0x16a34a);
      }
      this.showBanner('TERMINAL ÔMEGA DESBLOQUEADO! Todos os 3 Dossiês do Projeto Ômega liberados no Diário!');
      this.emitHud();
      return { ok: true, message: 'ACESSO DE NÍVEL ÔMEGA LIBERADO!' };
    }
    this.audio.playKeypadPress(true, false);
    this.emitNoise(this.px, this.py, this.pz, this.pFloor, 14, 2, 'door');
    return { ok: false, message: 'CÓDIGO INVÁLIDO (Verifique Símbolos UV + Quadro de Tradução)' };
  }

  submitSafeCode(code: string): { ok: boolean; message: string } {
    this.audio.unlock();
    if (code === this.layout.safe.code) {
      this.layout.safe.unlocked = true;
      this.audio.playKeypadPress(false, true);
      if (this.safeVisual) {
        this.safeVisual.screenMat.color.setHex(0x22c55e);
        this.safeVisual.screenMat.emissive.setHex(0x16a34a);
      }
      const exitDoor = this.layout.doors.find((d) => d.isExit);
      if (exitDoor) {
        exitDoor.electronicUnlocked = true;
        const dv = this.doorVisuals.find((v) => v.def.isExit);
        if (dv?.ledMesh) {
          const mat = dv.ledMesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(0x22c55e);
          mat.emissive.setHex(0x16a34a);
        }
      }
      const reward = this.layout.items.find((i) => i.id === this.layout.safe.rewardItemId);
      if (reward && !reward.collected) {
        reward.collected = true;
        reward.insideSafe = false;
        const mesh = detachCollectedItemMesh(
          reward.id,
          this.itemMeshes,
          this.floor0Chunks,
          this.floorMinus1Chunks
        );
        if (mesh) finalizeCollectedItemMesh(mesh);
        if (
          reward.itemType !== 'battery' &&
          reward.itemType !== 'stun_ammo' &&
          !this.inventory.includes(reward.itemType)
        ) {
          this.inventory.push(reward.itemType);
          this.audio.playKeyJingle();
        }
      }
      this.keypadOpen = false;
      this.showBanner('Cofre aberto! Trava eletrônica desligada e Chave Mestra guardada no inventário!');
      this.emitHud();
      return { ok: true, message: 'COFRE DESBLOQUEADO!' };
    }
    this.audio.playKeypadPress(true, false);
    this.emitNoise(this.px, this.py, this.pz, this.pFloor, 12, 2, 'door');
    return { ok: false, message: 'CÓDIGO INCORRETO' };
  }

  playKeypadTapSound(): void {
    this.audio.unlock();
    this.audio.playKeypadPress(false, false);
  }

  advanceCutscene(): void {
    if (!this.activeCutscene) return;
    const script = getCutsceneScript(this.activeCutscene);
    if (this.cutsceneStepIdx + 1 < script.steps.length) {
      this.cutsceneStepIdx++;
      this.cutsceneStepElapsed = 0;
      const nextStep = script.steps[this.cutsceneStepIdx];
      if (nextStep?.soundCue) {
        this.audio.playCutsceneCue(nextStep.soundCue);
      }
      this.emitCutsceneState();
    } else {
      this.finishCutscene();
    }
  }

  skipCutscene(): void {
    if (!this.activeCutscene) return;
    this.finishCutscene();
  }

  playDialogueVoiceBlip(speaker: 'survivor' | 'radio' | 'diddy'): void {
    this.audio.playDialogueBlip(speaker);
  }

  // ---- MOBILE MULTI-TOUCH, UV, STUN GUN, THROWABLES & HOTBAR ----

  setMobileJoystick(nx: number, ny: number): void {
    this.mobileMoveX = Math.max(-1, Math.min(1, nx));
    this.mobileMoveY = Math.max(-1, Math.min(1, ny));
  }

  addMobileLookDelta(dx: number, dy: number): void {
    if (this.mode !== 'playing' || this.hasActiveModal()) return;
    const crouchMult = this.crouching
      ? Math.max(0.3, Math.min(1.0, this.settings.controls.crouchSensitivityMult ?? 0.7))
      : 1.0;
    const baseSens = 0.0044 * this.settings.controls.touchSensitivity * crouchMult;
    const sensX = baseSens * (this.settings.controls.lookSensitivityX ?? 1.0);
    const sensY = baseSens * (this.settings.controls.lookSensitivityY ?? 1.0);
    const invertSign = this.settings.controls.invertY ? -1 : 1;
    this.targetYaw -= dx * sensX;
    this.targetPitch = Math.max(-1.25, Math.min(1.25, this.targetPitch - dy * sensY * invertSign));
    if ((this.settings.controls.cameraSmoothing ?? 0) <= 0.01) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    }
    this.handPosSpring.impulse(-dx * 0.0014, dy * 0.0011, 0);
    this.handRotSpring.impulse(dy * 0.0042, -dx * 0.0052, -dx * 0.0024);
    this.lookSwayX = Math.max(-0.045, Math.min(0.045, this.lookSwayX - dx * 0.00055));
    this.lookSwayY = Math.max(-0.035, Math.min(0.035, this.lookSwayY + dy * 0.00045));
    if (this.hidingSpot) {
      this.clampHidingLook();
    }
  }

  setMobileSprint(held: boolean): void {
    this.mobileSprintHeld = held;
  }

  setMobileHoldBreath(held: boolean): void {
    this.mobileHoldBreathHeld = held;
  }

  toggleCrouch(): void {
    if (this.mode !== 'playing' || this.hidingSpot) return;
    if (this.crouching && isPositionInVent(this.layout, this.px, this.pz, this.pFloor)) {
      this.showBanner('Teto baixo no duto! Saia da ventilação para ficar de pé.');
      return;
    }
    this.crouching = !this.crouching;
    this.emitHud();
  }

  toggleFlashlight(): void {
    if (this.mode !== 'playing') return;
    this.audio.unlock();
    if (this.battery <= 0.5) {
      this.flashlightOn = false;
      this.showBanner('Bateria esgotada! Procure pilhas ou uma Estação de Recarga na parede.');
      return;
    }
    this.flashlightOn = !this.flashlightOn;
    this.triggerViewmodelAction('flashlight_click');
    this.audio.playFlashlightClick();
    this.emitHud();
  }

  toggleUvMode(): void {
    if (this.mode !== 'playing') return;
    this.audio.unlock();
    if (this.battery <= 0.5) {
      this.showBanner('Sem bateria para ativar o modo Luz UV!');
      return;
    }
    this.uvMode = !this.uvMode;
    if (this.uvMode && !this.flashlightOn) {
      this.flashlightOn = true;
    }
    const nextHex = this.uvMode ? FLASHLIGHT_CONFIG.uvColor : FLASHLIGHT_CONFIG.color;
    this.flashlight.color.setHex(nextHex);
    this.flashlightSpill.color.setHex(nextHex);
    this.heldItemRig.setUvMode(this.uvMode);
    this.triggerViewmodelAction('flashlight_click');
    this.audio.playUvToggle(this.uvMode);
    this.showBanner(
      this.uvMode
        ? 'Luz UV ATIVADA! Ilumine paredes para revelar símbolos ocultos.'
        : 'Modo Lanterna Normal restaurado.'
    );
    this.emitHud();
  }

  private equipItemIfInHotbar(item: ItemType): void {
    const idx = this.inventory.indexOf(item);
    if (idx >= 0 && idx < 6) {
      this.activeSlot = idx;
      this.heldItemRig.setActiveItem(item);
      this.equipAnim = 1.0;
    }
  }

  selectHotbarSlot(index: number): void {
    if (index < 0 || index >= 6) return;
    const item = this.getHotbarSlots()[index]?.itemType ?? null;
    const wasSelected = this.activeSlot === index;
    this.activeSlot = index;

    if (item) {
      if (!wasSelected) {
        this.heldItemRig.setActiveItem(item);
        this.equipAnim = 1.0;
      } else if (item === 'flashlight') {
        this.toggleFlashlight();
      } else if (item === 'stun_gun') {
        this.fireStunGun();
      } else if (item === 'throwable_can') {
        this.throwCan();
      } else if (item === 'flare') {
        this.useFlare();
      }
    } else {
      this.heldItemRig.setActiveItem('flashlight');
    }
    this.emitHud();
  }

  /**
   * Single Unified Contextual Item Action (Mobile "Usar Item" button + PC Right-Click/Q + Gamepad RT).
   */
  triggerContextualUse(): void {
    if (this.mode !== 'playing' || this.hasActiveModal() || this.hidingSpot) return;
    const activeItem = this.getHotbarSlots()[this.activeSlot]?.itemType ?? 'flashlight';
    if (activeItem === 'stun_gun') {
      this.fireStunGun();
    } else if (activeItem === 'throwable_can') {
      this.throwCan();
    } else if (activeItem === 'flare') {
      this.useFlare();
    } else if (activeItem === 'polaroid_camera') {
      this.usePolaroidCamera();
    } else if (activeItem === 'oil_can') {
      this.useOilCanOnNearestDoor();
    } else if (activeItem === 'alarm_clock') {
      this.useAlarmClockDistraction();
    } else if (activeItem === 'freq_pills') {
      this.useFreqPills();
    } else if (activeItem === 'medkit') {
      this.useMedkitSelf();
    } else {
      this.toggleUvMode();
    }
  }

  private usePolaroidCamera(): void {
    if (this.polaroidCooldownSec > 0) {
      this.showBanner(`Flash Polaroid recarregando (${Math.ceil(this.polaroidCooldownSec)}s)...`);
      return;
    }
    this.audio.unlock();
    this.polaroidCooldownSec = 8.0;
    this.stunFlashTimer = 0.24;
    this.triggerViewmodelAction('flashlight_click');
    this.audio.playFlashlightClick();
    this.emitNoise(this.px, this.py, this.pz, this.pFloor, 15, 2, 'stun_gun');

    // Reveal nearby hidden clues within 9m
    let revealedClue = false;
    for (const clue of this.layout.clues) {
      if (!clue.discovered && clue.floor === this.pFloor && Math.hypot(clue.x - this.px, clue.z - this.pz) < 9.0) {
        clue.discovered = true;
        revealedClue = true;
      }
    }

    const diffCfg = getDifficultyConfig(this.difficulty);
    if (diffCfg.diddyActive && this.ai.floor === this.pFloor) {
      const dx = this.ai.x - this.px;
      const dz = this.ai.z - this.pz;
      const dist = Math.hypot(dx, dz);
      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      const dot = dist > 0.01 ? (dx * fwdX + dz * fwdZ) / dist : 1;
      if (
        dist <= 12.0 &&
        dot >= 0.6 &&
        hasWallLineOfSight(this.layout, this.px, this.pz, this.ai.x, this.ai.z, this.pFloor)
      ) {
        this.ai.stun(3.0);
        this.runStunsApplied += 1;
        this.spawnBurstParticles(this.scratchVecC.set(this.ai.x, this.ai.y + 1.55, this.ai.z), 0xffffff, 14, 0.05, 3.0);
        this.showBanner('FLASH POLAROID! P. Drizzy cegado por 3s! Corra agora!');
        this.emitHud();
        return;
      }
    }
    this.showBanner(
      revealedClue
        ? 'Flash Polaroid disparado! Uma pista oculta próxima foi revelada no Diário!'
        : 'Flash Polaroid disparado! Mire no rosto do P. Drizzy (<12m) para cegá-lo por 3s.'
    );
    this.emitHud();
  }

  private useOilCanOnNearestDoor(): void {
    let nearestDoor: DoorDefinition | null = null;
    let bestD = 3.2;
    for (const door of this.layout.doors) {
      if (door.floor !== this.pFloor || door.lockType === 'bunker_blast') continue;
      const halfSpan = (door.spanCells || 2) * 0.5;
      const cx = door.axis === 'x' ? (door.gx + halfSpan) * CELL_SIZE : (door.gx + 0.5) * CELL_SIZE;
      const cz = door.axis === 'x' ? (door.gz + 0.5) * CELL_SIZE : (door.gz + halfSpan) * CELL_SIZE;
      const d = Math.hypot(cx - this.px, cz - this.pz);
      if (d < bestD) {
        bestD = d;
        nearestDoor = door;
      }
    }
    if (!nearestDoor) {
      this.showBanner('Aproxime-se de uma porta (<3m) para lubrificar as dobradiças.');
      return;
    }
    if (this.oiledDoors.has(nearestDoor.id)) {
      this.showBanner(`${nearestDoor.name} já está lubrificada (abertura 100% silenciosa).`);
      return;
    }
    this.oiledDoors.add(nearestDoor.id);
    this.triggerViewmodelAction('grab_reach');
    this.audio.playFlashlightClick();
    this.showBanner(`${nearestDoor.name} lubrificada com Óleo! Agora abre sem emitir ruído.`);
    this.emitHud();
  }

  private useAlarmClockDistraction(): void {
    this.audio.unlock();
    this.inventory = this.inventory.filter((i) => i !== 'alarm_clock');
    this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
    this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
    this.triggerViewmodelAction('throw_toss');
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const landX = this.px + fwdX * 3.8;
    const landZ = this.pz + fwdZ * 3.8;
    const resolved = resolveWorldMovement(this.layout, this.px, this.py, this.pz, fwdX * 3.8, fwdZ * 3.8, 0.2, false, true);
    this.audio.playDroppedObjectCrash('tin_cans');
    this.emitNoise(resolved.x || landX, this.py, resolved.z || landZ, this.pFloor, 34, 4, 'thrown_object');
    this.showBanner('Despertador acionado! O toque atraiu P. Drizzy para o local!');
    this.emitHud();
  }

  private useFreqPills(): void {
    this.inventory = this.inventory.filter((i) => i !== 'freq_pills');
    this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
    this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
    this.neuralInterference = 0;
    this.stamina = Math.min(100, this.stamina + 35);
    this.audio.playFlashlightClick();
    this.showBanner('Supressor de Frequência tomado! Interferência Neural zerada (+35% estamina).');
    this.emitHud();
  }

  private useMedkitSelf(): void {
    if (this.health >= this.maxHealth) {
      this.showBanner('Sua saúde já está no máximo!');
      return;
    }
    this.inventory = this.inventory.filter((i) => i !== 'medkit');
    this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
    this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
    this.health = Math.min(this.maxHealth, this.health + 1);
    this.audio.playFlashlightClick();
    this.showBanner(`Kit Médico aplicado! Saúde restaurada (${this.health}/${this.maxHealth}).`);
    this.emitHud();
  }

  private getContextualUseLabel(): string | null {
    if (this.hidingSpot) return null;
    const activeItem = this.getHotbarSlots()[this.activeSlot]?.itemType ?? 'flashlight';
    if (activeItem === 'stun_gun') {
      return `ATIRAR (${this.stunAmmo})`;
    }
    if (activeItem === 'throwable_can') {
      return `LANÇAR (${this.throwables})`;
    }
    if (activeItem === 'flare') {
      return `FLARE (${this.flares})`;
    }
    if (activeItem === 'polaroid_camera') {
      return this.polaroidCooldownSec > 0
        ? `FLASH (${Math.ceil(this.polaroidCooldownSec)}s)`
        : 'FLASH POLAROID';
    }
    if (activeItem === 'oil_can') {
      return 'LUBRIFICAR PORTA';
    }
    if (activeItem === 'alarm_clock') {
      return 'SOLTAR ALARME';
    }
    if (activeItem === 'freq_pills') {
      return 'TOMAR PÍLULAS';
    }
    if (activeItem === 'medkit') {
      return 'CURAR (+1 HP)';
    }
    return this.uvMode ? 'LUZ NORMAL' : 'LUZ UV';
  }

  fireStunGun(): void {
    if (this.mode !== 'playing' || this.hidingSpot) return;
    if (!this.inventory.includes('stun_gun')) {
      this.showBanner('Você ainda não encontrou a Arma de Stun!');
      return;
    }
    if (this.stunAmmo <= 0) {
      this.audio.playLockedRattle();
      this.showBanner('Arma de Stun sem carga! Ache cargas ou fabrique na Bancada.');
      return;
    }
    this.audio.unlock();
    this.stunAmmo -= 1;
    this.triggerViewmodelAction('stun_recoil');
    this.stunFlashTimer = 0.18;
    this.trauma = Math.min(1, this.trauma + 0.28);
    this.audio.playStunGunFire();
    this.emitNoise(this.px, this.py, this.pz, this.pFloor, 26, 4, 'stun_gun');

    const fwdX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

    const diffCfg = getDifficultyConfig(this.difficulty);
    let hitDiddy = false;
    if (diffCfg.diddyActive) {
      const dx = this.ai.x - this.px;
      const dz = this.ai.z - this.pz;
      const dy = Math.abs(this.ai.y - this.py);
      const dist = Math.hypot(dx, dz);
      const hFwdX = -Math.sin(this.yaw);
      const hFwdZ = -Math.cos(this.yaw);
      const dot = dist > 0.01 ? (dx * hFwdX + dz * hFwdZ) / dist : 1;

      if (
        dist <= 16.5 &&
        dy <= 2.6 &&
        dot >= 0.72 &&
        hasWallLineOfSight(this.layout, this.px, this.pz, this.ai.x, this.ai.z, this.pFloor)
      ) {
        hitDiddy = true;
        this.ai.stun(diffCfg.diddyStunDuration);
        this.runStunsApplied += 1;
        if (this.hasPerk('adrenaline_burst')) {
          this.adrenalineBurstTimer = 2.5;
        }
        this.advanceAndNotifyAchievement('taser_specialist', 1);
        const chestPos = this.scratchVecC.set(this.ai.x, this.ai.y + 1.32, this.ai.z);
        this.spawnTaserDartsAndWires(chestPos, true, Math.min(4.5, diffCfg.diddyStunDuration));
        this.spawnBurstParticles(chestPos, 0x38bdf8, 14, 0.045, 2.8);
        this.showBanner(
          `P. DRIZZY ELETROCUTADO! Atordoado por ${diffCfg.diddyStunDuration.toFixed(0)}s! (${this.stunAmmo} carga restante)`
        );
        this.emitHud();
        return;
      }
    }

    if (!hitDiddy) {
      const missPos = this.scratchVecC.set(
        this.px + fwdX * 7.5,
        Math.max(this.py + 0.3, this.py + this.currentEyeHeight + fwdY * 7.5),
        this.pz + fwdZ * 7.5
      );
      this.spawnTaserDartsAndWires(missPos, false, 0.65);
      this.spawnBurstParticles(missPos, 0x38bdf8, 8, 0.038, 2.2);
    }
    this.showBanner(`Disparo elétrico efetuado! (${this.stunAmmo} carga restante)`);
    this.emitHud();
  }

  private spawnTaserDartsAndWires(
    hitPoint: THREE.Vector3,
    attachedToDiddy: boolean,
    durationSec: number
  ): void {
    const group = new THREE.Group();
    const dartGeo = new THREE.BoxGeometry(0.035, 0.035, 0.14);
    const dartMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 1.0,
      roughness: 0.2,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
    });
    const dartLeft = new THREE.Mesh(dartGeo, dartMat);
    const dartRight = new THREE.Mesh(dartGeo, dartMat);
    dartLeft.position.copy(hitPoint).add(this.scratchVecD.set(-0.1, 0.04, 0));
    dartRight.position.copy(hitPoint).add(this.scratchVecD.set(0.1, -0.04, 0));
    group.add(dartLeft, dartRight);

    const makeWire = () => {
      const pts = Array.from({ length: 7 }, () => new THREE.Vector3());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.92,
      });
      return new THREE.Line(geo, mat);
    };
    const wireLeft = makeWire();
    const wireRight = makeWire();
    group.add(wireLeft, wireRight);
    this.worldGroup.add(group);

    this.taserVisuals.push({
      group,
      wireLeft,
      wireRight,
      dartLeft,
      dartRight,
      attachedToDiddy,
      hitPoint: hitPoint.clone(),
      age: 0,
      maxAge: durationSec,
    });
  }

  private spawnBurstParticles(
    origin: THREE.Vector3,
    colorHex: number,
    count: number,
    size = 0.06,
    speed = 3.2,
    gravity = 9.2
  ): void {
    const maxParticles = this.isSoftwareGl ? 24 : 96;
    if (this.burstParticles.length >= maxParticles) return;
    const finalCount = Math.min(count, maxParticles - this.burstParticles.length);
    for (let i = 0; i < finalCount; i++) {
      const geo = new THREE.BoxGeometry(size, size * (0.7 + Math.random() * 0.9), size * 0.8);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.55,
        metalness: colorHex === 0xfbbf24 || colorHex === 0x38bdf8 ? 0.6 : 0.05,
        emissive: colorHex === 0xfbbf24 || colorHex === 0x38bdf8 || colorHex === 0xf97316 ? colorHex : 0x000000,
        emissiveIntensity: colorHex === 0xfbbf24 || colorHex === 0x38bdf8 || colorHex === 0xf97316 ? 1.1 : 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.worldGroup.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const horiz = (0.35 + Math.random() * 0.85) * speed;
      this.burstParticles.push({
        mesh,
        vx: Math.cos(a) * horiz,
        vy: (0.45 + Math.random() * 0.85) * speed,
        vz: Math.sin(a) * horiz,
        rotSpeed: (Math.random() - 0.5) * 14,
        age: 0,
        maxAge: 0.45 + Math.random() * 0.55,
        gravity,
      });
    }
  }

  throwCan(): void {
    if (this.mode !== 'playing' || this.hidingSpot) return;
    if (this.throwables <= 0) {
      this.showBanner('Nenhuma lata arremessável no inventário!');
      return;
    }
    this.audio.unlock();
    this.throwables -= 1;
    this.triggerViewmodelAction('throw_toss');
    this.audio.playThrowWhoosh();

    const mesh = createVoxelItemModel('throwable_can');
    mesh.scale.setScalar(1.1);
    const fwdX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
    const sx = this.px + fwdX * 0.6;
    const sy = this.py + this.currentEyeHeight - 0.15;
    const sz = this.pz + fwdZ * 0.6;
    mesh.position.set(sx, sy, sz);
    this.worldGroup.add(mesh);

    this.thrownProjectiles.push({
      kind: 'can',
      mesh,
      x: sx,
      y: sy,
      z: sz,
      vx: fwdX * 11.2,
      vy: fwdY * 9.0 + 2.4,
      vz: fwdZ * 11.2,
      floor: this.pFloor,
      life: 3.5,
    });

    if (this.throwables <= 0) {
      this.inventory = this.inventory.filter((i) => i !== 'throwable_can');
      this.activeSlot = 0;
      this.heldItemRig.setActiveItem(this.inventory[0] ?? 'flashlight');
    }
    this.showBanner('Lata arremessada! O eco metálico vai distrair o P. Drizzy.');
    this.emitHud();
  }

  useFlare(): void {
    if (this.mode !== 'playing' || this.hidingSpot) return;
    if (this.flares <= 0) {
      this.showBanner('Sem sinalizadores restantes!');
      return;
    }
    this.audio.unlock();
    this.flares--;
    this.runFlaresUsed += 1;
    this.advanceAndNotifyAchievement('flare_tactician', 1);
    this.triggerViewmodelAction('throw_toss');
    this.audio.playFlareIgnite();
    this.audio.playThrowWhoosh();

    const mesh = createVoxelItemModel('flare');
    mesh.scale.setScalar(1.15);
    const fwdX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
    const sx = this.px + fwdX * 0.58;
    const sy = this.py + this.currentEyeHeight - 0.14;
    const sz = this.pz + fwdZ * 0.58;
    mesh.position.set(sx, sy, sz);

    // Attached dynamic pyrotechnic PointLight on the bouncing flare!
    const flareLight = new THREE.PointLight(0xff4d2e, 5.2, 16, 1.5);
    flareLight.position.set(0, 0.18, 0);
    mesh.add(flareLight);
    this.worldGroup.add(mesh);

    this.thrownProjectiles.push({
      kind: 'flare',
      mesh,
      x: sx,
      y: sy,
      z: sz,
      vx: fwdX * 10.6,
      vy: fwdY * 8.2 + 2.6,
      vz: fwdZ * 10.6,
      floor: this.pFloor,
      life: 4.5,
      light: flareLight,
      burnTimer: 3.6,
      hissCooldown: 0.15,
      detonated: false,
      bounces: 0,
    });

    this.emitNoise(sx, sy, sz, this.pFloor, 24, 3, 'flare');
    this.showBanner('Sinalizador pirotécnico arremessado! Vai detonar e atrair o P. Drizzy!');

    if (this.flares <= 0) {
      this.inventory = this.inventory.filter((i) => i !== 'flare');
      this.activeSlot = 0;
      this.heldItemRig.setActiveItem(this.inventory[0] ?? 'flashlight');
    }
    this.emitHud();
  }

  /**
   * Silent verification helper for URL-only automated tests (`?showcase=uv|cctv|workbench|courtyard|holdbreath`).
   */
  preparePhase1Showcase(showcase: 'uv' | 'cctv' | 'workbench' | 'courtyard' | 'holdbreath'): void {
    if (showcase === 'uv') {
      if (!this.inventory.includes('stun_gun')) this.inventory.push('stun_gun');
      if (!this.inventory.includes('throwable_can')) this.inventory.push('throwable_can');
      this.stunAmmo = 2;
      this.throwables = 1;
      this.toggleUvMode();
      this.equipItemIfInHotbar('stun_gun');
    } else if (showcase === 'cctv') {
      this.openCctvMonitor();
    } else if (showcase === 'workbench') {
      if (!this.inventory.includes('crowbar_rod')) this.inventory.push('crowbar_rod');
      if (!this.inventory.includes('crowbar_hook')) this.inventory.push('crowbar_hook');
      this.openWorkbench();
    } else if (showcase === 'courtyard') {
      // Position player in the Courtyard looking toward the Cratered Moon, Stars, Silhouettes & Living Water Puddle
      this.pFloor = 0;
      this.px = gridToWorld(18.5);
      this.py = FLOOR_0_Y;
      this.smoothedPlayerY = FLOOR_0_Y;
      this.pz = gridToWorld(27.2);
      this.yaw = 0.28;
      this.targetYaw = 0.28;
      this.pitch = 0.34;
      this.targetPitch = 0.34;
      this.flashlightOn = true;
      this.waterManager?.triggerRippleAndSplash(0, gridToWorld(16), FLOOR_0_Y, gridToWorld(25), 1.25, 10);
    } else if (showcase === 'holdbreath') {
      // Place player inside a locker and trigger P. Drizzy inspection Hold-Breath Minigame live!
      const spot = this.layout.hidingSpots.find((h) => h.floor === 0 && h.kind === 'locker') ?? this.layout.hidingSpots[0];
      if (spot) {
        this.px = spot.x;
        this.py = spot.y;
        this.smoothedPlayerY = spot.y;
        this.pz = spot.z;
        this.pFloor = spot.floor;
        this.enterHidingSpot(spot);
        this.ai.forceInspectHidingSpot(spot);
        this.holdBreath.start(spot.id, this.settings.gameplay.holdBreathAssist, 6.0);
        this.showBanner('P. DRIZZY ESTÁ NA PORTA! SEGURE PARA PRENDER A RESPIRAÇÃO!');
      }
    }
    this.emitHud();
  }

  triggerInteract(): void {
    if (this.mode !== 'playing' || this.hasActiveModal()) return;
    this.audio.unlock();

    if (this.hidingSpot) {
      this.exitHidingSpot();
      return;
    }

    const prompt = this.findNearestInteraction();
    if (!prompt) return;

    if (prompt.actionType === 'hide') {
      const spot = this.layout.hidingSpots.find((h) => h.id === prompt.id);
      if (spot) this.enterHidingSpot(spot);
      return;
    }

    if (prompt.actionType === 'pickup') {
      const item = this.layout.items.find((i) => i.id === prompt.id && !i.collected && !i.insideSafe);
      if (item) {
        const needsNewSlot =
          item.itemType !== 'battery' &&
          item.itemType !== 'stun_ammo' &&
          !this.inventory.includes(item.itemType);

        if (needsNewSlot && this.inventory.length >= BACKPACK_CAPACITY) {
          this.audio.playLockedRattle();
          this.showBanner('Mochila cheia (10/10)! Aperte [G] ou abra a Mochila [I] para dropar um item.');
          return;
        }

        item.collected = true;
        this.onWorldSyncEvent?.({
          kind: 'item',
          payload: { itemId: item.id, collected: true, itemType: item.itemType },
        });
        const mesh = detachCollectedItemMesh(
          item.id,
          this.itemMeshes,
          this.floor0Chunks,
          this.floorMinus1Chunks
        );
        if (mesh) {
          // Physical Item Grab Animation (ZERO instant teleport!): pull real 3D mesh smoothly toward hand,
          // then completely detach from worldGroup so it can NEVER stay floating in mid-air!
          const worldPos = this.scratchVecC;
          mesh.getWorldPosition(worldPos);
          if (mesh.parent && mesh.parent !== this.worldGroup) {
            mesh.parent.remove(mesh);
            this.worldGroup.add(mesh);
          }
          mesh.position.copy(worldPos);
          mesh.visible = true;
          this.activeGrabAnims.push({
            mesh,
            startPos: worldPos.clone(),
            startScale: mesh.scale.clone(),
            t: 0,
            dur: 0.34,
          });
        }
        this.triggerViewmodelAction('grab_reach');
        this.triggerHaptic(22, 0.2);

        if (item.itemType === 'battery') {
          const boost = this.hasPerk('field_scavenger') ? 52 : 45;
          this.battery = Math.min(this.maxBattery, this.battery + boost);
          this.audio.playFlashlightClick();
          this.showBanner(`Pilha coletada (+${boost}% bateria da lanterna).`);
        } else if (item.itemType === 'stun_ammo') {
          this.stunAmmo += 1;
          this.audio.playKeyJingle();
          this.showBanner(`Carga de Stun coletada! (Total: ${this.stunAmmo})`);
        } else if (item.itemType === 'throwable_can') {
          this.throwables += 1;
          if (!this.inventory.includes('throwable_can')) {
            this.inventory.push('throwable_can');
          }
          const slotIdx = this.inventory.indexOf('throwable_can');
          this.audio.playKeyJingle();
          this.showBanner(
            slotIdx < 6
              ? `Lata Arremessável coletada (${this.throwables}x) — Slot ${slotIdx + 1}.`
              : `Lata Arremessável guardada na Mochila [I]!`
          );
        } else if (item.itemType === 'flare') {
          this.flares += 1;
          if (!this.inventory.includes('flare')) {
            this.inventory.push('flare');
          }
          const slotIdx = this.inventory.indexOf('flare');
          this.audio.playKeyJingle();
          this.showBanner(
            slotIdx < 6
              ? `Sinalizador coletado (${this.flares}x) — Slot ${slotIdx + 1}.`
              : `Sinalizador guardado na Mochila [I]!`
          );
        } else {
          if (item.itemType === 'stun_gun') {
            this.stunAmmo += item.droppedByPlayer ? (item.droppedAmmo ?? 0) : 1;
          }
          if (!this.inventory.includes(item.itemType)) {
            this.inventory.push(item.itemType);
          }
          // Intentionally DO NOT auto-equip keys/tools: keep Flashlight in hand so player swaps under tension!
          this.audio.playKeyJingle();
          const slotIdx = this.inventory.indexOf(item.itemType);
          const inBackpackOnly = slotIdx >= 6;
          this.showBanner(
            inBackpackOnly
              ? `${item.label} guardado na Mochila [I]!`
              : item.itemType === 'stun_gun'
              ? `Arma de Stun coletada (${this.stunAmmo} carga) — selecione Slot ${slotIdx + 1} para equipar!`
              : `Coletado: ${item.label} (Slot ${slotIdx + 1}).`
          );
        }
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'clue') {
      const clue = this.layout.clues.find((c) => c.id === prompt.id);
      if (clue) {
        clue.discovered = true;
        this.audio.playFlashlightClick();
        this.exitPointerLock();
        this.keysPressed.clear();
        this.quickInspect = {
          kind: 'clue',
          title: clue.title,
          roomName: clue.roomName,
          body: clue.flavorText,
          digitIndex: clue.digitIndex,
          digitHighlight: clue.digitValue,
        };
        this.showBanner(`Pista #${clue.digitIndex + 1} salva no Diário: Dígito "${clue.digitValue}" (${clue.roomName})`);
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'uv_mark') {
      const mark = this.layout.uvMarks.find((m) => m.id === prompt.id);
      if (mark) {
        const firstDiscover = !mark.discovered;
        mark.discovered = true;
        if (firstDiscover) {
          this.advanceAndNotifyAchievement('uv_cryptographer', 1);
        }
        this.audio.playJournalClueSaved();
        this.showBanner(`Marca UV salva no Diário: ${mark.title} → Símbolo ${mark.symbolChar}`);
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'light_switch') {
      const sw = this.layout.lightSwitches.find((s) => s.id === prompt.id);
      if (sw) {
        sw.isOn = !sw.isOn;
        this.advanceAndNotifyAchievement('lights_out', 1);
        if (sw.isOn) this.disabledLightRooms.delete(sw.roomId);
        else this.disabledLightRooms.add(sw.roomId);
        const vis = this.lightSwitchVisuals.get(sw.id);
        if (vis) {
          vis.lever.rotation.x = sw.isOn ? -0.45 : 0.45;
          vis.ledMat.color.setHex(sw.isOn ? 0x4ade80 : 0xef4444);
          vis.ledMat.emissive.setHex(sw.isOn ? 0x22c55e : 0xdc2626);
        }
        this.audio.playWallSwitchClick(sw.isOn);
        this.emitNoise(sw.x, sw.y, sw.z, sw.floor, 4.5, 1, 'door');
        this.showBanner(
          sw.isOn ? `Luzes acesas: ${sw.roomName}.` : `Luzes apagadas: ${sw.roomName} (mais furtivo).`
        );
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'cctv_monitor') {
      this.advanceAndNotifyAchievement('bunker_guardian', 1);
      this.openCctvMonitor();
      return;
    }

    if (prompt.actionType === 'bunker_door_btn') {
      const btn = this.layout.bunkerButtons.find((b) => b.id === prompt.id);
      if (btn) this.toggleBunkerDoor(btn.side);
      return;
    }

    if (prompt.actionType === 'workbench') {
      this.openWorkbench();
      return;
    }

    if (prompt.actionType === 'recharge') {
      const st = this.layout.rechargeStations.find((s) => s.id === prompt.id);
      if (st) {
        if (st.cooldown > 0) {
          this.showBanner(`Estação recarregando capacitor (${Math.ceil(st.cooldown)}s)...`);
          return;
        }
        this.battery = this.maxBattery;
        st.cooldown = this.hasPerk('field_scavenger') ? 21 : 25;
        this.audio.playRechargeHum();
        this.emitNoise(st.x, st.y, st.z, st.floor, 21, 3, 'recharge');
        this.showBanner(`Lanterna recarregada para ${this.maxBattery}%! Cuidado: o zumbido elétrico faz barulho!`);
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'cassette') {
      const tape = this.layout.cassettes.find((t) => t.id === prompt.id);
      if (tape) {
        const firstListen = !tape.listened;
        tape.listened = true;
        if (firstListen) {
          this.advanceAndNotifyAchievement('vhs_archivist', 1);
        }
        const vis = this.cassetteVisuals.get(tape.id);
        if (vis) {
          vis.ledMat.color.setHex(0x22c55e);
          vis.ledMat.emissive.setHex(0x16a34a);
        }
        this.audio.playCassettePlay();
        // Play pre-generated neural MP3 dubbing via Web Audio analog cassette DSP (Bandpass + Saturation + Wow & Flutter + Tape Hiss)
        const tapeNum: 1 | 2 =
          tape.id.endsWith('2') || tape.id.endsWith('4') ? 2 : 1;
        void tapeAudioPlayer.playTape(tapeNum, {
          lang: this.settings.locale?.language ?? 'pt-BR',
          volume:
            this.settings.audio.muted
              ? 0
              : (this.settings.audio.master ?? 0.85) * (this.settings.audio.voiceTapes ?? 0.95),
          onSubtitle: (line) => {
            if (this.settings.audio.subtitles) {
              this.subtitleText = line;
              this.subtitleTimer = line ? 8.0 : 0;
              this.emitHud();
            }
          },
        });
        if (this.settings.audio.subtitles) {
          this.subtitleText = `${tape.title}: ${tape.transcript}`;
          this.subtitleTimer = 7.0;
        }
        this.exitPointerLock();
        this.keysPressed.clear();
        this.quickInspect = {
          kind: 'cassette',
          title: tape.title,
          roomName: tape.roomName,
          body: tape.transcript,
        };
        this.showBanner(`${tape.title} reproduzida! Transcrição completa salva no Diário.`);
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'drawer') {
      const prop = this.layout.furniture.find((f) => f.id === prompt.id);
      if (prop) {
        prop.opened = !prop.opened;
        this.audio.playDrawerSlide();
        const hasItem = this.layout.items.some((i) => i.drawerId === prop.id && !i.collected);
        const hasTape = this.layout.cassettes.some((t) => t.drawerId === prop.id);
        this.showBanner(
          prop.opened
            ? hasItem || hasTape
              ? 'Gaveta aberta — há algo lá dentro!'
              : 'Gaveta aberta (vazia).'
            : 'Gaveta fechada.'
        );
        this.emitHud();
      }
      return;
    }

    if (prompt.actionType === 'translation_board') {
      this.translationBoardSeen = true;
      this.audio.playFlashlightClick();
      this.showBanner('Quadro de Tradução UV salvo no Diário! Use-o para decifrar o Terminal Secreto.');
      this.emitHud();
      return;
    }

    if (prompt.actionType === 'generator_lever') {
      if (this.generatorFixed) {
        this.showBanner('Gerador operando em 100%! Energia do complexo estabilizada.');
        return;
      }
      if (!this.fuseInstalled) {
        if (this.inventory.includes('fuse')) {
          this.fuseInstalled = true;
          this.inventory = this.inventory.filter((i) => i !== 'fuse');
          this.activeSlot = 0;
          this.heldItemRig.setActiveItem(this.inventory[0] ?? 'flashlight');
          this.triggerViewmodelAction('grab_reach');
          this.audio.playFuseSnapSpark();
          const gv = this.furnitureVisuals.find((f) => f.def.kind === 'generator_lever');
          if (gv) {
            this.spawnBurstParticles(this.scratchVecC.set(gv.def.x, gv.def.y + 1.1, gv.def.z), 0xfbbf24, 12, 0.04, 3.2);
            this.spawnBurstParticles(this.scratchVecC.set(gv.def.x, gv.def.y + 1.15, gv.def.z), 0x38bdf8, 8, 0.035, 2.8);
          }
          this.showBanner('Fusível Industrial instalado! Puxe a alavanca novamente para religar a energia!');
          this.emitHud();
        } else {
          this.audio.playLockedRattle();
          this.showBanner('Gerador queimado! Encontre o Fusível Industrial (Oficina ou Subsolo).');
        }
        return;
      }
      this.generatorFixed = true;
      this.onWorldSyncEvent?.({ kind: 'generator', payload: { powered: true, fuseInserted: true } });
      this.blackoutActive = false;
      this.blackoutAlertTimer = 0;
      this.securityPowerPct = Math.min(100, this.securityPowerPct + 40);
      this.audio.playPowerRestore();
      const gv = this.furnitureVisuals.find((f) => f.def.kind === 'generator_lever');
      if (gv?.statusMat) {
        gv.statusMat.color.setHex(0x22c55e);
        gv.statusMat.emissive.setHex(0x16a34a);
      }
      this.showBanner('ENERGIA RESTAURADA! Luzes do complexo e Sala de Segurança reativadas!');
      this.emitHud();
      return;
    }

    if (prompt.actionType === 'secret_terminal') {
      if (this.terminalUnlocked) {
        this.showBanner('Dossiê Ômega já vazado! Escape pelo Portão Norte para o Final Secreto.');
      } else {
        this.openSecretTerminal();
      }
      return;
    }

    if (prompt.actionType === 'level2_hatch') {
      const hasCutters = this.inventory.includes('wire_cutters');
      const hasCamHint = this.cctvSecretHintSeen;
      const heardMarcos = this.layout.cassettes.some((t) => t.listened);
      if (!hasCutters) {
        this.audio.playLockedRattle();
        this.showBanner('Alçapão Vermelho blindado com correntes! Requer Alicate de Corte.');
        return;
      }
      if (!hasCamHint) {
        this.audio.playLockedRattle();
        this.showBanner('Trava eletrônica do Nível -2! Verifique o código secreto nas Câmeras CCTV.');
        return;
      }
      if (!heardMarcos) {
        this.audio.playLockedRattle();
        this.showBanner('Sinal de rádio fraco! Ouça ao menos uma fita/transmissão do Vigia Marcos antes de descer.');
        return;
      }
      this.triggerViewmodelAction('wire_snip');
      this.audio.playCutsceneCue('hatch_hum');
      this.showBanner('ALÇAPÃO VERMELHO ABERTO! Descendo ao Nível -2 para resgatar o Vigia Marcos!');
      this.triggerRealEndingEscape();
      return;
    }

    if (prompt.actionType === 'garage_car') {
      if (!this.garageBatteryInstalled && this.inventory.includes('car_battery')) {
        this.garageBatteryInstalled = true;
        this.inventory = this.inventory.filter((i) => i !== 'car_battery');
        this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
        this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
        this.audio.playFuseSnapSpark();
        this.showBanner('Bateria Automotiva instalada no carro da Garagem!');
        this.emitHud();
        return;
      }
      if (!this.garageFuelInstalled && this.inventory.includes('gas_can')) {
        this.garageFuelInstalled = true;
        this.inventory = this.inventory.filter((i) => i !== 'gas_can');
        this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
        this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
        this.audio.playWorkbenchCraft();
        this.showBanner('Tanque abastecido com o Galão de Gasolina!');
        this.emitHud();
        return;
      }
      if (this.garageBatteryInstalled && this.garageFuelInstalled) {
        if (this.inventory.includes('garage_key')) {
          this.audio.playPowerRestore();
          this.showBanner('MOTOR LIGADO! Fugindo da mansão pela Garagem Leste!');
          this.triggerVictoryEscape();
          return;
        }
        this.audio.playLockedRattle();
        this.showBanner('Carro abastecido e com bateria! Falta apenas a Chave da Garagem para ligar!');
        return;
      }
      this.audio.playLockedRattle();
      const missing: string[] = [];
      if (!this.garageBatteryInstalled) missing.push('Bateria de Carro');
      if (!this.garageFuelInstalled) missing.push('Galão de Gasolina');
      if (!this.inventory.includes('garage_key')) missing.push('Chave da Garagem');
      this.showBanner(`Carro de Fuga incompleto — Falta: ${missing.join(', ')}.`);
      return;
    }

    if (prompt.actionType === 'false_bookshelf') {
      if (this.bookshelfOpened) {
        this.showBanner('Estante Falsa aberta — acesso ao Arquivo do Dono liberado!');
        return;
      }
      let installedAny = false;
      if (!this.bookshelfSunInstalled && this.inventory.includes('emblem_sun')) {
        this.bookshelfSunInstalled = true;
        this.inventory = this.inventory.filter((i) => i !== 'emblem_sun');
        installedAny = true;
      }
      if (!this.bookshelfMoonInstalled && this.inventory.includes('emblem_moon')) {
        this.bookshelfMoonInstalled = true;
        this.inventory = this.inventory.filter((i) => i !== 'emblem_moon');
        installedAny = true;
      }
      if (installedAny) {
        this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
        this.heldItemRig.setActiveItem(this.inventory[this.activeSlot] ?? 'flashlight');
        this.audio.playKeyLockTurn();
      }
      if (this.bookshelfSunInstalled && this.bookshelfMoonInstalled) {
        this.bookshelfOpened = true;
        this.audio.playDoorCreak(true);
        this.showBanner('ESTANTE FALSA DESLIZADA! Os Emblemas Sol e Lua revelaram o Arquivo do Dono!');
      } else if (installedAny) {
        this.showBanner('Emblema encaixado na Estante Falsa! Falta o segundo emblema (Sol/Lua).');
      } else {
        this.audio.playLockedRattle();
        this.showBanner('Estante Falsa com encaixes Sol e Lua — procure os dois Emblemas na mansão.');
      }
      this.emitHud();
      return;
    }

    if (prompt.actionType === 'piano') {
      this.pianoSequenceStep = Math.min(3, this.pianoSequenceStep + 1);
      if (this.interactivePianoRig) {
        const keyIdx = (this.pianoSequenceStep * 2) % Math.max(1, this.interactivePianoRig.keyMeshes.length);
        const keyMesh = this.interactivePianoRig.keyMeshes[keyIdx];
        if (keyMesh) {
          keyMesh.position.y = 0.785;
          setTimeout(() => {
            keyMesh.position.y = 0.805;
          }, 220);
        }
      }
      this.audio.playKeyJingle();
      this.emitNoise(this.px, this.py, this.pz, this.pFloor, 14, 2, 'door');
      if (this.pianoSequenceStep === 3) {
        this.battery = Math.min(this.maxBattery, this.battery + 30);
        this.showBanner('Acorde secreto tocado no Piano! Compartimento oculto liberou +30% de carga!');
      } else {
        this.showBanner(`Piano tocado (${this.pianoSequenceStep}/3 notas do acorde secreto)...`);
      }
      this.emitHud();
      return;
    }

    if (prompt.actionType === 'steam_valve') {
      const nextIdx = this.steamValvesClosed.findIndex((v) => !v);
      if (nextIdx === -1) {
        this.showBanner('Todas as 3 válvulas de vapor do Subsolo já foram fechadas!');
        return;
      }
      this.steamValvesClosed[nextIdx] = true;
      const closedCount = this.steamValvesClosed.filter(Boolean).length;
      if (this.steamValvesRig?.valveWheels[nextIdx]) {
        this.steamValvesRig.valveWheels[nextIdx].rotation.z += Math.PI * 1.5;
      }
      this.audio.playDoorCreak(true);
      this.emitNoise(this.px, this.py, this.pz, this.pFloor, 15, 2, 'door');
      this.showBanner(
        closedCount === 3
          ? 'PRESSÃO ESTABILIZADA (3/3)! O vapor escaldante da Câmara do Subsolo foi dissipado!'
          : `Válvula de Vapor #${nextIdx + 1} fechada (${closedCount}/3)!`
      );
      this.emitHud();
      return;
    }

    if (prompt.actionType === 'safe') {
      if (!this.layout.safe.unlocked) {
        this.openSafeKeypad();
      }
      return;
    }

    if (prompt.actionType === 'door' || prompt.actionType === 'exit') {
      const door = this.layout.doors.find((d) => d.id === prompt.id);
      if (!door) return;
      this.interactWithDoor(door);
    }
  }

  getJournalSnapshot(): JournalSnapshot {
    const tapesListened = this.layout.cassettes.filter((t) => t.listened).length;
    const dossiersUnlocked = this.terminalUnlocked
      ? OMEGA_DOSSIERS.length
      : Math.min(2, Math.floor(tapesListened / 2) + (this.layout.safe.unlocked ? 1 : 0));
    return {
      clues: this.layout.clues.map((c) => ({ ...c })),
      uvMarks: this.layout.uvMarks.map((u) => ({ ...u })),
      cassettes: this.layout.cassettes.map((c) => ({ ...c })),
      omegaDossiers: OMEGA_DOSSIERS.map((d, idx) => ({ ...d, unlocked: idx < dossiersUnlocked })),
      translationBoardSeen: this.translationBoardSeen,
      symbolMap: this.layout.symbolMap.map((s) => ({ ...s })),
      cameraSecretHintSeen: this.cctvSecretHintSeen,
      cameraSecretCode: this.layout.cameraSecretCode,
      safeUnlocked: this.layout.safe.unlocked,
      terminalUnlocked: this.terminalUnlocked,
    };
  }

  getSafeCodeForTesting(): string {
    return this.layout.safe.code;
  }

  // ---- INTERNAL WORLD BUILDING WITH 32x32 VOXEL CHUNKING & VENTS ----

  private buildWorldScene(): void {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    for (const entry of this.remotePeerRigs.values()) {
      this.scene.remove(entry.rig.root);
    }
    this.remotePeerRigs.clear();
    this.worldRegistry.disposeAll();
    if (this.waterManager) {
      this.waterManager.dispose();
      this.waterManager = null;
    }
    this.disposeTransientEffects();
    clearSculptedCache(false);
    this.floor0Chunks = [];
    this.floorMinus1Chunks = [];
    this.doorVisuals = [];
    this.hidingVisuals = [];
    this.furnitureVisuals = [];
    this.drawerVisualById.clear();
    this.itemMeshes.clear();
    this.clueMeshes.clear();
    this.noisePropMeshes.clear();
    this.rechargeVisuals.clear();
    this.cassetteVisuals.clear();
    this.bunkerButtonVisuals.clear();
    this.uvMarkVisuals.clear();
    this.lightSwitchVisuals.clear();
    this.thrownProjectiles = [];
    this.safeVisual = null;
    this.stunSparksRig = null;
    this.nightSkyRig = null;
    this.pergolaProjectedShadows = null;
    this.godRayMeshes = [];
    this.ceilingLightMeta = [];
    this.puddleDrips = [];
    this.steamParticles = [];
    this.activeGrabAnims = [];
    this.animatedFans = [];
    this.wallClocks = [];
    this.serverRacks = [];
    this.swayingTarps = [];
    this.courtyardRainLines = null;
    this.courtyardRainData = null;
    this.drizzyFootprintPool = [];
    this.drizzyFootprintCursor = 0;
    this.doorSwingSpeed.clear();

    // 1. Chunked Static Architecture (including Full Ceilings, Low Vents, Baseboards, Ceiling Beams & Corner AO!)
    this.buildFloorChunks(0, this.layout.floor0, this.layout.surface0, FLOOR_0_Y, GROUND_CEILING_H);
    this.buildFloorChunks(-1, this.layout.floorMinus1, this.layout.surfaceMinus1, FLOOR_MINUS_1_Y, BASEMENT_CEILING_H);

    // 2. Crisp 100% Gap-Free Textured 32x32 Voxel Stairways (ALWAYS visible — never hidden by floor culling!)
    this.buildStairwayGeometry();

    // 2b. Deep Midnight-Blue Night Sky + Pixel Moon + Stars + Clouds + Option B Courtyard Pergola + Living Water!
    this.buildCourtyardPergolaAndAtmosphere();

    // 3. Sculpted Industrial Trough Ceiling Luminaires (InstancedMesh per floor!) + Emissive Fluorescent Tubes (ZERO fake cones!)
    const sculptedMats = getSharedSculptedMaterials();
    for (const m of sculptedMats) this.worldRegistry.trackMaterial(m);
    const luminaireGeo = this.worldRegistry.trackGeometry(buildSculptedCeilingLuminaireGeo());
    const tubeGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.68, 0.055, 0.14));

    const lumMatrices0: THREE.Matrix4[] = [];
    const lumMatricesM1: THREE.Matrix4[] = [];

    for (const l of this.layout.ceilingLights) {
      const lumMat = new THREE.Matrix4().makeTranslation(l.x, l.y + 0.25, l.z);
      if (l.floor === 0) lumMatrices0.push(lumMat);
      else lumMatricesM1.push(lumMat);

      // Calibrated Emissive Fluorescent Tube inside luminaire (synchronized with wall switches & physical flicker!)
      const tubeMat = this.worldRegistry.trackMaterial(
        new THREE.MeshStandardMaterial({
          color: l.color,
          emissive: l.color,
          emissiveIntensity: 2.0,
          roughness: 0.22,
          metalness: 0.1,
        })
      );
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.position.set(l.x, l.y + 0.09, l.z);
      this.worldGroup.add(tubeMesh);
      (l.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(tubeMesh);

      const halo = new THREE.Sprite(
        this.worldRegistry.trackMaterial(
          new THREE.SpriteMaterial({
            map: this.materialPack.glowHaloTex,
            color: l.color,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      halo.position.set(l.x, l.y + 0.04, l.z);
      halo.scale.set(1.15, 1.15, 1);
      this.worldGroup.add(halo);
      (l.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(halo);

      const roomAtLight = getRoomAt(this.layout, l.x, l.z, l.floor);
      this.ceilingLightMeta.push({
        roomId: roomAtLight?.id ?? null,
        floor: l.floor,
        halo,
        tubeMat,
        baseColor: l.color,
        flickerSeed: l.flickerSeed,
        isSecurityOffice: l.isSecurityOffice,
      });
    }

    if (lumMatrices0.length > 0) {
      const im0 = new THREE.InstancedMesh(luminaireGeo, sculptedMats, lumMatrices0.length);
      for (let i = 0; i < lumMatrices0.length; i++) im0.setMatrixAt(i, lumMatrices0[i]);
      im0.instanceMatrix.needsUpdate = true;
      im0.computeBoundingSphere();
      this.worldGroup.add(im0);
      this.floor0Chunks.push(im0);
    }
    if (lumMatricesM1.length > 0) {
      const imM1 = new THREE.InstancedMesh(luminaireGeo, sculptedMats, lumMatricesM1.length);
      for (let i = 0; i < lumMatricesM1.length; i++) imM1.setMatrixAt(i, lumMatricesM1[i]);
      imM1.instanceMatrix.needsUpdate = true;
      imM1.computeBoundingSphere();
      this.worldGroup.add(imM1);
      this.floorMinus1Chunks.push(imM1);
    }

    // 3b. Courtyard Lantern Pillars (Flush to 3.6m Pergola Beams + Moss Base!)
    for (const pillar of this.layout.courtyardPillars) {
      const pMesh = createCourtyardPillarVisual(pillar, this.materialPack);
      this.worldRegistry.trackObject3D(pMesh);
      this.worldGroup.add(pMesh);
      this.floor0Chunks.push(pMesh);
    }

    // 4. Doors (Hinged, Wire-Cutter Gate & Cabine 09-A Vertical Blast Doors)
    for (const d of this.layout.doors) {
      const dv = createDoorVisual(d, this.materialPack, CELL_SIZE);
      this.worldRegistry.trackObject3D(dv.group);
      this.worldGroup.add(dv.group);
      this.doorVisuals.push(dv);
    }

    // 5. Hiding Spots
    for (const h of this.layout.hidingSpots) {
      const hv = createHidingSpotVisual(h, this.materialPack);
      this.worldRegistry.trackObject3D(hv.group);
      this.worldGroup.add(hv.group);
      this.hidingVisuals.push(hv);
    }

    // 6. Safe in Underground Generator Room
    this.safeVisual = createSafeVisual(this.layout.safe, this.materialPack);
    this.worldRegistry.trackObject3D(this.safeVisual.group);
    this.worldGroup.add(this.safeVisual.group);

    // 7. Rich Voxel Furniture FIRST (so hollow sliding drawers exist before nesting items/cassettes!)
    for (const prop of this.layout.furniture) {
      const fv = createFurnitureVisual(prop, this.materialPack, this.layout.symbolMap);
      this.worldRegistry.trackObject3D(fv.group);
      this.worldGroup.add(fv.group);
      this.furnitureVisuals.push(fv);
      if (prop.kind === 'drawer_cabinet') {
        this.drawerVisualById.set(prop.id, fv);
      }
      (prop.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(fv.group);
    }

    // 8. Collectible Items (100% 3D Voxel Models — nested inside hollow drawers OR resting flush on surfaces!)
    for (const item of this.layout.items) {
      const mesh = createItemPickupMesh(item, this.materialPack.contactShadowTex);
      const hostDrawer = item.drawerId ? this.drawerVisualById.get(item.drawerId) : undefined;
      if (hostDrawer?.contentsAnchor) {
        // Place cleanly inside hollow sliding drawer tray!
        const siblingCount = hostDrawer.contentsAnchor.children.length;
        mesh.position.set(siblingCount === 0 ? 0 : siblingCount % 2 === 1 ? -0.16 : 0.16, 0.08, 0.02);
        mesh.visible = !item.collected && Boolean(hostDrawer.def.opened);
        this.worldRegistry.trackObject3D(mesh);
        hostDrawer.contentsAnchor.add(mesh);
      } else {
        mesh.visible = !item.collected && !item.insideSafe;
        this.worldRegistry.trackObject3D(mesh);
        this.worldGroup.add(mesh);
      }
      if (!item.collected) {
        this.itemMeshes.set(item.id, mesh);
      } else {
        finalizeCollectedItemMesh(mesh);
      }
    }

    // 9. Visual ARG Clue Plaques (pinned flush to walls with exact facingYaw!)
    for (const clue of this.layout.clues) {
      const mesh = createCluePlaqueVisual(clue);
      this.worldRegistry.trackObject3D(mesh);
      this.worldGroup.add(mesh);
      this.clueMeshes.set(clue.id, mesh);
      (clue.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(mesh);
    }

    // 10. Granny-Style Noise Traps
    for (const np of this.layout.noiseProps) {
      const mesh = createNoisePropVisual(np);
      this.worldRegistry.trackObject3D(mesh);
      this.worldGroup.add(mesh);
      this.noisePropMeshes.set(np.id, mesh);
      (np.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(mesh);
    }

    // 11. Workbenches, Recharge Stations, Cassettes (nested in drawers or on benches!), CCTV Cameras, Cabine 09-A Buttons,
    // Tutorial Plaques, UV Fluorescent Marks, and Secret CAM-06 Sign
    for (const wb of this.layout.workbenches) {
      const mesh = createWorkbenchVisual(wb, this.materialPack);
      this.worldRegistry.trackObject3D(mesh);
      this.worldGroup.add(mesh);
      (wb.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(mesh);
    }

    for (const st of this.layout.rechargeStations) {
      const vis = createRechargeStationVisual(st, this.materialPack);
      this.worldRegistry.trackObject3D(vis.group);
      this.worldGroup.add(vis.group);
      this.rechargeVisuals.set(st.id, vis);
      (st.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(vis.group);
    }

    for (const tape of this.layout.cassettes) {
      const vis = createCassetteRecorderVisual(tape);
      const hostDrawer = tape.drawerId ? this.drawerVisualById.get(tape.drawerId) : undefined;
      if (hostDrawer?.contentsAnchor) {
        vis.group.position.set(0, 0.08, 0.02);
        vis.group.scale.setScalar(0.86);
        vis.group.visible = Boolean(hostDrawer.def.opened);
        this.worldRegistry.trackObject3D(vis.group);
        hostDrawer.contentsAnchor.add(vis.group);
      } else {
        this.worldRegistry.trackObject3D(vis.group);
        this.worldGroup.add(vis.group);
        (tape.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(vis.group);
      }
      this.cassetteVisuals.set(tape.id, vis);
    }

    for (const cam of this.layout.bunkerCameras) {
      const mesh = createSecurityCameraVisual(cam);
      this.worldRegistry.trackObject3D(mesh);
      this.worldGroup.add(mesh);
      (cam.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(mesh);
    }

    for (const btn of this.layout.bunkerButtons) {
      const vis = createBunkerDoorButtonVisual(btn);
      this.worldRegistry.trackObject3D(vis.group);
      this.worldGroup.add(vis.group);
      this.bunkerButtonVisuals.set(btn.id, vis);
      this.floor0Chunks.push(vis.group);
    }

    for (const pl of this.layout.tutorialPlaques) {
      const mesh = createTutorialPlaqueVisual(pl);
      this.worldRegistry.trackObject3D(mesh);
      this.worldGroup.add(mesh);
      this.floor0Chunks.push(mesh);
    }

    for (const mark of this.layout.uvMarks) {
      const vis = createUvMarkVisual(mark);
      this.worldRegistry.trackObject3D(vis.group);
      this.worldGroup.add(vis.group);
      this.uvMarkVisuals.set(mark.id, vis);
      (mark.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(vis.group);
    }

    for (const sw of this.layout.lightSwitches) {
      const vis = createWallLightSwitchVisual(sw);
      this.worldRegistry.trackObject3D(vis.group);
      this.worldGroup.add(vis.group);
      this.lightSwitchVisuals.set(sw.id, vis);
      (sw.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(vis.group);
    }

    // Dotted curved parabolic aim trajectory arc (shown while holding Flare or Throwable Can!)
    const arcGeo = this.worldRegistry.trackGeometry(new THREE.BufferGeometry());
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
    const arcMat = this.worldRegistry.trackMaterial(
      new THREE.PointsMaterial({
        color: 0xf97316,
        size: 0.12,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    this.flareArcPoints = new THREE.Points(arcGeo, arcMat);
    this.flareArcPoints.visible = false;
    this.flareArcPoints.frustumCulled = false;
    this.worldGroup.add(this.flareArcPoints);

    // Secret Chamber CAM-06 Wall Code Sign (visible live via CAM 06 cleanly above Terminal Ômega!)
    const cam06Sign = createCctvSecretSignVisual(
      gridToWorld(25.5),
      FLOOR_MINUS_1_Y + 2.24,
      gridToWorld(3.08),
      this.layout.cameraSecretCode
    );
    this.worldRegistry.trackObject3D(cam06Sign);
    this.worldGroup.add(cam06Sign);
    this.floorMinus1Chunks.push(cam06Sign);

    // 11. Articulated Voxel P. Diddy Rig + Orbiting Stun Sparks + Survivor Rig
    this.diddyRig = createDiddyArticulatedRig(this.materialPack, this.equippedDiddySkin);
    this.diddyRig.root.position.set(
      this.layout.diddySpawnPoint.x,
      this.layout.diddySpawnPoint.y,
      this.layout.diddySpawnPoint.z
    );
    this.stunSparksRig = createStunSparksRig();
    this.diddyRig.root.add(this.stunSparksRig);
    this.worldRegistry.trackObject3D(this.diddyRig.root);
    this.worldGroup.add(this.diddyRig.root);

    this.survivorRig = createVoxelSurvivorRig(this.materialPack);
    this.survivorRig.visible = false;
    this.worldRegistry.trackObject3D(this.survivorRig);
    this.worldGroup.add(this.survivorRig);

    this.cutsceneSurvivorRig = createArticulatedPeerRig(false);
    this.cutsceneSurvivorRig.root.visible = false;
    this.worldRegistry.trackObject3D(this.cutsceneSurvivorRig.root);
    this.worldGroup.add(this.cutsceneSurvivorRig.root);

    this.cutsceneSets = buildDedicatedCutsceneSets();
    this.worldRegistry.trackObject3D(this.cutsceneSets.root);
    this.worldGroup.add(this.cutsceneSets.root);

    this.buildLivingPropsGlassAndDecals();
    this.buildRemasterMicroVoxelSetpieces();

    const prof = getGraphicsProfile(this.settings.graphicsQuality);
    this.rebuildDustParticles(prof.dustParticleCount);
    const waterMgr = this.waterManager as WaterPhysicsManager | null;
    waterMgr?.setWaterSettings(
      this.settings.video.waterReflections ?? true,
      this.settings.video.waterQuality ?? 'high'
    );
    this.updateBunkerVisualIndicators();
  }

  /**
   * Mounts all Update 2.0 High-Density Micro-Voxel 3D Setpieces, Wing Props,
   * Puzzle Mechanisms & 4-Stage Final Gate directly into the active Chapter 1 scene!
   */
  private buildRemasterMicroVoxelSetpieces(): void {
    const a = this.layout.remasterAnchors;

    const mountFloor0 = (obj: THREE.Object3D, pos: { x: number; y: number; z: number }, rotY = 0) => {
      obj.position.set(pos.x, pos.y, pos.z);
      obj.rotation.y = rotY;
      this.worldRegistry.trackObject3D(obj);
      this.worldGroup.add(obj);
      this.floor0Chunks.push(obj);
    };
    const mountBasement = (obj: THREE.Object3D, pos: { x: number; y: number; z: number }, rotY = 0) => {
      obj.position.set(pos.x, pos.y, pos.z);
      obj.rotation.y = rotY;
      this.worldRegistry.trackObject3D(obj);
      this.worldGroup.add(obj);
      this.floorMinus1Chunks.push(obj);
    };

    // 1. Cabine 09-A Security Bunker Console + Diegetic CRT Green Glow
    this.bunkerSetpieceRig = createSecurityBunkerSetpiece();
    mountFloor0(this.bunkerSetpieceRig.root, a.bunkerConsole, 0);
    this.bunkerCrtGlowLight = new THREE.PointLight(0x34d399, 3.4, 8.5, 1.6);
    this.bunkerCrtGlowLight.position.set(a.bunkerConsole.x, a.bunkerConsole.y + 1.55, a.bunkerConsole.z + 0.45);
    this.worldGroup.add(this.bunkerCrtGlowLight);
    this.floor0Chunks.push(this.bunkerCrtGlowLight);

    // 2. East Garage Escape Car
    this.garageCarRig = createGarageEscapeCarRig();
    mountFloor0(this.garageCarRig.root, a.garageCar, Math.PI * 0.5);

    // 3. Chained Tool Shed interior workbench & tool rack
    this.toolShedRig = createToolShedRig();
    mountFloor0(this.toolShedRig.root, a.toolShed, Math.PI);

    // 4. Outer Garden iron fencing, stone path & hedge props
    this.outerGardenRig = createOuterGardenProps();
    mountFloor0(this.outerGardenRig.root, a.outerGarden, 0);

    // 5. Secret Attic storage crates + Chapter 2 Cargo Elevator shaft
    this.secretAtticRig = createSecretAtticProps();
    mountFloor0(this.secretAtticRig.root, a.secretAttic, Math.PI);

    // 6. Mansion Architectural Showpieces: Chandelier, Lit Fireplace (+ Warm Ember PointLight), Grandfather Clock
    this.chandelierRig = createChandelierRig();
    mountFloor0(this.chandelierRig.root, a.chandelier, 0);

    this.fireplaceRig = createFireplaceRig();
    mountFloor0(this.fireplaceRig.root, a.fireplace, 0);
    this.fireplaceGlowLight = new THREE.PointLight(0xff8c32, 4.6, 11.0, 1.5);
    this.fireplaceGlowLight.position.set(a.fireplace.x, a.fireplace.y + 0.95, a.fireplace.z + 0.55);
    this.worldGroup.add(this.fireplaceGlowLight);
    this.floor0Chunks.push(this.fireplaceGlowLight);

    this.grandfatherClockRig = createGrandfatherClockRig();
    mountFloor0(this.grandfatherClockRig.root, a.grandfatherClock, 0);

    // 7. Interactive Puzzles & 4-Stage Final Gate
    this.falseBookshelfRig = createFalseBookshelfRig();
    mountFloor0(this.falseBookshelfRig.root, a.falseBookshelf, 0);

    this.interactivePianoRig = createInteractivePianoRig();
    mountFloor0(this.interactivePianoRig.root, a.piano, Math.PI * 0.5);

    this.steamValvesRig = createSteamValvesRig();
    mountBasement(this.steamValvesRig.root, a.steamValves, Math.PI * 0.5);

    this.fourStageFinalGateRig = createFourStageFinalGateRig();
    mountFloor0(this.fourStageFinalGateRig.root, a.finalGate, 0);
  }

  /**
   * Builds Living Environment Micro-Animated Props (Ceiling/Desk Fans, Ticking Wall Clocks,
   * Blinking Server Racks, Swaying Quarantine Tarps), Dirty Cracked Reflective Glass Windows,
   * Environmental Storytelling Decals, Pooled Compound 09 Oily Footprints & Courtyard Drizzle Rain!
   */
  private buildLivingPropsGlassAndDecals(): void {
    // 1. Animated Ceiling & Desk Fans
    const addFan = (variant: 'ceiling' | 'desk', x: number, y: number, z: number, floor: FloorId, speed: number, rotY = 0) => {
      const fan = createAnimatedFanVisual(variant);
      fan.group.position.set(x, y, z);
      fan.group.rotation.y = rotY;
      this.worldRegistry.trackObject3D(fan.group);
      this.worldGroup.add(fan.group);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(fan.group);
      this.animatedFans.push({ bladesPivot: fan.bladePivot, speed, floor });
    };
    addFan('ceiling', gridToWorld(17.5), FLOOR_0_Y + GROUND_CEILING_H - 0.04, gridToWorld(31.5), 0, 2.35);
    addFan('ceiling', gridToWorld(5.5), FLOOR_0_Y + GROUND_CEILING_H - 0.04, gridToWorld(22.0), 0, 1.85);
    addFan('ceiling', gridToWorld(17.5), FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.04, gridToWorld(12.5), -1, 1.55);
    addFan('desk', gridToWorld(11.1), FLOOR_0_Y + 0.94, gridToWorld(31.25), 0, 7.2, 0.45);

    // 2. Ticking Wall Clocks
    const addClock = (x: number, y: number, z: number, rotY: number, floor: FloorId) => {
      const clk = createWallClockVisual();
      clk.group.position.set(x, y, z);
      clk.group.rotation.y = rotY;
      this.worldRegistry.trackObject3D(clk.group);
      this.worldGroup.add(clk.group);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(clk.group);
      this.wallClocks.push({ secondHand: clk.secondHand, minuteHand: clk.minuteHand, x, z, floor });
    };
    addClock(gridToWorld(19.45), FLOOR_0_Y + 2.38, gridToWorld(30.06), 0, 0);
    addClock(gridToWorld(11.0), FLOOR_0_Y + 2.38, gridToWorld(33.42), Math.PI, 0);

    // 3. Blinking Server Racks (tucked strictly into non-blocking corners!)
    const addServer = (x: number, y: number, z: number, rotY: number, floor: FloorId, phaseOffset: number) => {
      const srv = createServerRackVisual();
      srv.group.position.set(x, y, z);
      srv.group.rotation.y = rotY;
      this.worldRegistry.trackObject3D(srv.group);
      this.worldGroup.add(srv.group);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(srv.group);
      this.serverRacks.push({ ledMats: srv.ledMats, phaseOffset, floor, x, z });
    };
    addServer(gridToWorld(9.35), FLOOR_0_Y, gridToWorld(33.15), Math.PI, 0, 0.0);
    addServer(gridToWorld(27.25), FLOOR_MINUS_1_Y, gridToWorld(4.2), -Math.PI / 2, -1, 1.7);
    addServer(gridToWorld(21.4), FLOOR_MINUS_1_Y, gridToWorld(3.55), 0, -1, 3.1);

    // 4. Swaying Quarantine Tarps (hung high from doorway lintels so walkways stay 100% clear)
    const addTarp = (x: number, y: number, z: number, rotY: number, floor: FloorId, phaseOffset: number) => {
      const tarp = createSwayingTarpVisual();
      tarp.group.position.set(x, y, z);
      tarp.group.rotation.y = rotY;
      this.worldRegistry.trackObject3D(tarp.group);
      this.worldGroup.add(tarp.group);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(tarp.group);
      this.swayingTarps.push({ curtainPivot: tarp.swayPivot, phaseOffset, floor });
    };
    addTarp(gridToWorld(23.0), FLOOR_0_Y + 2.55, gridToWorld(19.22), 0, 0, 0.4);
    addTarp(gridToWorld(23.5), FLOOR_MINUS_1_Y + 2.55, gridToWorld(16.18), 0, -1, 2.2);

    // 5. Dirty Cracked Reflective Glass Windows (optimized MeshStandardMaterial, ZERO transmission!)
    const addGlassWindow = (x: number, y: number, z: number, w: number, h: number, rotY: number, floor: FloorId) => {
      const win = createDirtyGlassWindowVisual(w, h, this.materialPack);
      win.position.set(x, y, z);
      win.rotation.y = rotY;
      this.worldRegistry.trackObject3D(win);
      this.worldGroup.add(win);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(win);
    };
    // Guardhouse observation glass facing Courtyard (lets player spot P. Drizzy stalking outside!)
    addGlassWindow(gridToWorld(11.0), FLOOR_0_Y + 1.56, gridToWorld(29.88), 2.2, 1.24, 0, 0);
    // Infirmary & Subsolo Cell 09 observation glass partitions
    addGlassWindow(gridToWorld(21.12), FLOOR_0_Y + 1.56, gridToWorld(16.5), 1.85, 1.22, Math.PI / 2, 0);
    addGlassWindow(gridToWorld(21.12), FLOOR_MINUS_1_Y + 1.48, gridToWorld(20.5), 1.85, 1.18, Math.PI / 2, -1);

    // 6. Environmental Storytelling Decals (polygonOffset -> ZERO z-fighting!)
    const addDecal = (
      tex: THREE.CanvasTexture,
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      rotX: number,
      rotY: number,
      floor: FloorId,
      opacity = 0.88
    ) => {
      const geo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(w, h));
      const mat = this.worldRegistry.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          opacity,
          roughness: 0.45,
          metalness: 0.08,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        })
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rotX, rotY, 0);
      this.worldGroup.add(mesh);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(mesh);
    };

    // Claw gouges near West Vent & Cell 09
    addDecal(this.materialPack.clawMarksTex, 1.05, 1.05, gridToWorld(7.45), FLOOR_0_Y + 0.92, gridToWorld(26.0), 0, -Math.PI / 2, 0, 0.85);
    addDecal(this.materialPack.clawMarksTex, 1.15, 1.15, gridToWorld(25.8), FLOOR_MINUS_1_Y + 1.32, gridToWorld(20.42), 0, Math.PI, -1, 0.9);
    // Wall scribbles ("09") inside Containment Cells
    addDecal(this.materialPack.cellScribbleTex, 1.3, 1.1, gridToWorld(26.42), FLOOR_MINUS_1_Y + 1.42, gridToWorld(24.0), 0, -Math.PI / 2, -1, 0.86);
    // Oily Compound 09 floor seepage pools
    addDecal(this.materialPack.oozeSeepTex, 1.55, 1.55, gridToWorld(22.5), FLOOR_MINUS_1_Y + 0.024, gridToWorld(21.5), -Math.PI / 2, 0.4, -1, 0.82);
    addDecal(this.materialPack.oozeSeepTex, 1.45, 1.45, gridToWorld(17.5), FLOOR_MINUS_1_Y + 0.024, gridToWorld(19.5), -Math.PI / 2, 1.8, -1, 0.78);
    addDecal(this.materialPack.oozeSeepTex, 1.3, 1.3, gridToWorld(17.5), FLOOR_0_Y + 0.024, gridToWorld(28.5), -Math.PI / 2, 0.9, 0, 0.65);

    // 7. Pooled Oily Compound 09 Footprints stamped by P. Drizzy (14 reusable quads, zero per-frame alloc!)
    const fpGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(0.42, 0.64));
    fpGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const fpMat = this.worldRegistry.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: this.materialPack.drizzyFootprintTex,
          transparent: true,
          opacity: 0,
          roughness: 0.14,
          metalness: 0.18,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        })
      );
      const mesh = new THREE.Mesh(fpGeo, fpMat);
      mesh.visible = false;
      this.worldGroup.add(mesh);
      this.drizzyFootprintPool.push({ mesh, age: 0, maxAge: 18, active: false });
    }

    // 8. Courtyard Light Drizzle Rain (140 lightweight LineSegments streaks over open Courtyard bay)
    const dropCount = this.isSoftwareGl ? 60 : 140;
    const rainPos = new Float32Array(dropCount * 6);
    this.courtyardRainData = new Float32Array(dropCount * 4); // x, y, z, speed
    const xMin = gridToWorld(10.4);
    const xMax = gridToWorld(24.6);
    const zMin = gridToWorld(21.4);
    const zMax = gridToWorld(28.6);
    for (let i = 0; i < dropCount; i++) {
      const rx = xMin + Math.random() * (xMax - xMin);
      const ry = FLOOR_0_Y + 0.3 + Math.random() * 6.2;
      const rz = zMin + Math.random() * (zMax - zMin);
      const spd = 7.2 + Math.random() * 2.8;
      this.courtyardRainData[i * 4] = rx;
      this.courtyardRainData[i * 4 + 1] = ry;
      this.courtyardRainData[i * 4 + 2] = rz;
      this.courtyardRainData[i * 4 + 3] = spd;
      rainPos[i * 6] = rx;
      rainPos[i * 6 + 1] = ry;
      rainPos[i * 6 + 2] = rz;
      rainPos[i * 6 + 3] = rx - 0.04;
      rainPos[i * 6 + 4] = ry - 0.38;
      rainPos[i * 6 + 5] = rz - 0.03;
    }
    const rainGeo = this.worldRegistry.trackGeometry(new THREE.BufferGeometry());
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = this.worldRegistry.trackMaterial(
      new THREE.LineBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      })
    );
    this.courtyardRainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.courtyardRainLines.visible = this.settings.video.rainParticles ?? true;
    this.worldGroup.add(this.courtyardRainLines);
    this.floor0Chunks.push(this.courtyardRainLines);
  }

  /**
   * Option B Courtyard Pergola + Deep Midnight-Blue Night Sky + Pixel Moon + Stars + Clouds +
   * Translucent Volumetric God Rays + Abandoned Puddles, Cobwebs, Grass Tufts & Underground Steam!
   */
  private buildCourtyardPergolaAndAtmosphere(): void {
    const courtyardCenterX = gridToWorld(17.5);
    const courtyardCenterZ = gridToWorld(25.0);

    // 1. Deep Midnight-Blue Night Sky Dome + Pixel Full Moon + Stars + Drifting Clouds
    this.nightSkyRig = createNightSkyRig(this.materialPack, courtyardCenterX, courtyardCenterZ);
    this.worldRegistry.trackObject3D(this.nightSkyRig.group);
    this.worldGroup.add(this.nightSkyRig.group);
    this.floor0Chunks.push(this.nightSkyRig.group);

    // 2. Option B Courtyard Voxel Pergola Beams (resting FLUSH on top of all 4 pillars at y = 3.6m!)
    const pergolaGroup = new THREE.Group();
    const beamMat = this.materialPack.materials.oak_log;
    const beamY = FLOOR_0_Y + GROUND_CEILING_H + 0.16; // Bottom rests flush at y = 3.60m!
    const xMin = 10 * CELL_SIZE;
    const xMax = 26 * CELL_SIZE;
    const zMin = 21 * CELL_SIZE;
    const zMax = 30 * CELL_SIZE;
    const spanX = xMax - xMin;
    const spanZ = zMax - zMin;
    const midX = (xMin + xMax) / 2;
    const midZ = (zMin + zMax) / 2;

    // 4 Heavy East-West Primary Girders (perimeter + direct over the North & South pillar rows at gz=23 and gz=27!)
    const ewBeamZCoords = [zMin + 0.22, gridToWorld(23), gridToWorld(27), zMax - 0.22];
    const ewGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(spanX, 0.32, 0.42));
    ewGeo.setAttribute('uv1', ewGeo.attributes.uv);
    for (const bz of ewBeamZCoords) {
      const m = new THREE.Mesh(ewGeo, beamMat);
      m.position.set(midX, beamY, bz);
      m.castShadow = true;
      m.receiveShadow = true;
      pergolaGroup.add(m);
    }

    // 2 Heavy North-South Spine Girders resting dead-center over the West & East pillar columns (gx=14 and gx=21)!
    const nsPillarX = [gridToWorld(14), gridToWorld(21)];
    const nsGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.42, 0.34, spanZ));
    nsGeo.setAttribute('uv1', nsGeo.attributes.uv);
    for (const bx of nsPillarX) {
      const m = new THREE.Mesh(nsGeo, beamMat);
      m.position.set(bx, beamY + 0.02, midZ);
      m.castShadow = true;
      m.receiveShadow = true;
      pergolaGroup.add(m);
    }

    // Spaced Cross-Rafters leaving open skylight bays so the Night Sky, Moon & Moonlight stream through!
    const rafterGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.22, 0.22, spanZ));
    rafterGeo.setAttribute('uv1', rafterGeo.attributes.uv);
    const rafterXList = [11.2, 14.8, 16.6, 18.4, 20.2, 23.8];
    for (const rgx of rafterXList) {
      const r = new THREE.Mesh(rafterGeo, beamMat);
      r.position.set(gridToWorld(rgx), beamY + 0.14, midZ);
      r.castShadow = true;
      r.receiveShadow = true;
      pergolaGroup.add(r);
    }

    this.worldGroup.add(pergolaGroup);
    this.floor0Chunks.push(pergolaGroup);

    // 2b. Zero-Cost Projected Pergola Shadow Slats on Courtyard floor (polygonOffset + staggered Y -> zero z-fighting!)
    const projGroup = new THREE.Group();
    const shadowSlatMat = this.worldRegistry.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x050914,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    const ewShadowGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(spanX - 0.6, 0.65));
    ewShadowGeo.rotateX(-Math.PI / 2);
    for (const bz of ewBeamZCoords) {
      const s = new THREE.Mesh(ewShadowGeo, shadowSlatMat);
      s.position.set(midX + 0.55, FLOOR_0_Y + 0.022, bz + 0.75);
      projGroup.add(s);
    }
    const rafterShadowGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(0.36, spanZ - 0.6));
    rafterShadowGeo.rotateX(-Math.PI / 2);
    for (const rgx of [14, 16.6, 18.4, 21]) {
      const s = new THREE.Mesh(rafterShadowGeo, shadowSlatMat);
      s.position.set(gridToWorld(rgx) + 0.55, FLOOR_0_Y + 0.028, midZ + 0.75);
      projGroup.add(s);
    }
    projGroup.visible = !this.moonLight.castShadow;
    this.pergolaProjectedShadows = projGroup;
    this.worldGroup.add(projGroup);
    this.floor0Chunks.push(projGroup);

    // 3. Subtle Outdoor Moonlight Shafts descending through the open Courtyard Pergola bays (NO indoor fake lamp cones!)
    const makeGodRay = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      colorHex: number,
      opacity: number,
      floor: FloorId,
      tiltX = 0.22,
      tiltZ = -0.18
    ) => {
      const mat = this.worldRegistry.trackMaterial(
        new THREE.MeshBasicMaterial({
          map: this.materialPack.glowHaloTex,
          color: colorHex,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const geo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(w, h));
      const m1 = new THREE.Mesh(geo, mat);
      m1.position.set(x, y, z);
      m1.rotation.set(tiltX, 0.35, tiltZ);
      m1.userData = { baseOpacity: opacity };
      this.worldGroup.add(m1);
      (floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(m1);
      this.godRayMeshes.push(m1);
    };

    // Crisp outdoor Moonlight shafts pouring through the Courtyard Pergola openings!
    makeGodRay(gridToWorld(15.6), 2.1, gridToWorld(24.2), 2.6, 4.4, 0x93c5fd, 0.12, 0);
    makeGodRay(gridToWorld(19.4), 2.1, gridToWorld(25.6), 2.8, 4.4, 0x93c5fd, 0.11, 0);
    makeGodRay(gridToWorld(17.5), 2.1, gridToWorld(22.2), 2.2, 4.2, 0xbfdbfe, 0.09, 0);

    // 4. Living Organic Water Physics Puddles (MeshPhysicalMaterial + Schlick Fresnel + Flashlight Reflections + 8-Slot Ripples!)
    this.waterManager = new WaterPhysicsManager(
      this.layout.puddles,
      this.materialPack.waterNormalTex,
      (f) => (f === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y)
    );
    this.worldGroup.add(this.waterManager.group);

    // Falling ceiling water drops over puddles with hasDrip -> feed live ripples into WaterPhysicsManager!
    const dripDropGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.04, 0.11, 0.04));
    const dripDropMat = this.worldRegistry.trackMaterial(
      new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.82 })
    );
    this.layout.puddles.forEach((p, idx) => {
      if (!p.hasDrip) return;
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      const dropMesh = new THREE.Mesh(dripDropGeo, dripDropMat);
      dropMesh.position.y = 2.6;
      g.add(dropMesh);
      this.worldGroup.add(g);
      this.puddleDrips.push({
        group: g,
        dropMesh,
        phase: (idx * 1.37) % 3.2,
        floor: p.floor,
        x: p.x,
        y: p.y,
        z: p.z,
      });
      (p.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(g);
    });

    // 5. Abandoned Pixel-Art Cobwebs in Ceiling Corners (polygonOffset prevents any corner z-fighting)
    const webGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(0.95, 0.95));
    const webMat = this.worldRegistry.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: this.materialPack.cobwebTex,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    for (const cw of this.layout.cobwebs) {
      const mesh = new THREE.Mesh(webGeo, webMat);
      mesh.position.set(cw.x, cw.y, cw.z);
      mesh.rotation.y = cw.rotY;
      mesh.scale.setScalar(cw.scale);
      this.worldGroup.add(mesh);
      (cw.floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks).push(mesh);
    }

    // 6. Overgrown Courtyard Pixel-Art Grass Tufts & Dry Fallen Leaves (polygonOffset -> zero ground z-fighting!)
    const tuftGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(0.68, 0.56));
    const tuftMat = this.worldRegistry.trackMaterial(
      new THREE.MeshStandardMaterial({
        map: this.materialPack.grassTuftTex,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        roughness: 0.92,
      })
    );
    const leafGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(0.45, 0.45));
    leafGeo.rotateX(-Math.PI / 2);
    const leafMat = this.worldRegistry.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x5c3d22,
        roughness: 0.96,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    for (let i = 0; i < this.layout.grassTufts.length; i++) {
      const gt = this.layout.grassTufts[i];
      const g = new THREE.Group();
      g.position.set(gt.x, FLOOR_0_Y + 0.24 * gt.scale, gt.z);
      g.scale.setScalar(gt.scale);
      const q1 = new THREE.Mesh(tuftGeo, tuftMat);
      const q2 = new THREE.Mesh(tuftGeo, tuftMat);
      q2.rotation.y = Math.PI / 2;
      g.add(q1, q2);
      if (i % 2 === 0) {
        const lf = new THREE.Mesh(leafGeo, leafMat);
        lf.position.set(0.24, -0.22 * gt.scale, 0.18);
        lf.rotation.y = i * 1.1;
        g.add(lf);
      }
      this.worldGroup.add(g);
      this.floor0Chunks.push(g);
    }

    // 7. Rising Underground Steam / Pipe Vapor Puffs (Subsolo)
    const steamGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.28, 0.28, 0.28));
    for (let vIdx = 0; vIdx < this.layout.steamVents.length; vIdx++) {
      const sv = this.layout.steamVents[vIdx];
      for (let k = 0; k < 3; k++) {
        const sMat = this.worldRegistry.trackMaterial(
          new THREE.MeshBasicMaterial({
            color: 0xcbd5e1,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          })
        );
        const puff = new THREE.Mesh(steamGeo, sMat);
        puff.position.set(sv.x, sv.y, sv.z);
        this.worldGroup.add(puff);
        this.floorMinus1Chunks.push(puff);
        this.steamParticles.push({
          mesh: puff,
          baseX: sv.x,
          baseY: sv.y,
          baseZ: sv.z,
          phase: vIdx * 0.7 + k * 0.33,
        });
      }
    }
  }

  private buildFloorChunks(
    floor: FloorId,
    grid: Uint8Array,
    surfaces: string[],
    baseY: number,
    ceilH: number
  ): void {
    const floorTileGeo = this.worldRegistry.trackGeometry(
      new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE)
    );
    floorTileGeo.rotateX(-Math.PI / 2);
    floorTileGeo.setAttribute('uv1', floorTileGeo.attributes.uv);

    const wallBlockGeo = this.worldRegistry.trackGeometry(
      new THREE.BoxGeometry(CELL_SIZE, ceilH, CELL_SIZE)
    );
    wallBlockGeo.setAttribute('uv1', wallBlockGeo.attributes.uv);

    const ceilTileGeo = this.worldRegistry.trackGeometry(
      new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE)
    );
    ceilTileGeo.rotateX(Math.PI / 2);
    ceilTileGeo.setAttribute('uv1', ceilTileGeo.attributes.uv);

    const ventUpperH = Math.max(0.2, ceilH - VENT_CEILING_H);
    const ventUpperGeo = this.worldRegistry.trackGeometry(
      new THREE.BoxGeometry(CELL_SIZE, ventUpperH, CELL_SIZE)
    );
    ventUpperGeo.setAttribute('uv1', ventUpperGeo.attributes.uv);

    // Lightweight Corner/Vertex AO Strip Geometry (polygonOffset + staggered H/V heights -> zero z-fighting!)
    const aoStripHGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(CELL_SIZE, 0.36));
    aoStripHGeo.rotateX(-Math.PI / 2);
    const aoStripVGeo = this.worldRegistry.trackGeometry(new THREE.PlaneGeometry(0.36, CELL_SIZE));
    aoStripVGeo.rotateX(-Math.PI / 2);
    const aoStripMat = this.worldRegistry.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x03050a,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );

    // Architectural Depth: Micro-Voxel Stepped Baseboards, Chamfered Corner Columns, Recessed Floor Drains,
    // Recessed Barred Wall Windows & Ceiling Beams — ALL instanced per chunk for 60 FPS mobile!
    const sculptedMats = getSharedSculptedMaterials();
    for (const m of sculptedMats) this.worldRegistry.trackMaterial(m);
    const baseboardGeo = this.worldRegistry.trackGeometry(buildSculptedBaseboardGeo(CELL_SIZE));
    const cornerColGeo = this.worldRegistry.trackGeometry(buildSculptedCornerColumnGeo(ceilH));
    const drainGeo = this.worldRegistry.trackGeometry(buildSculptedFloorDrainGeo());
    const windowGeo = this.worldRegistry.trackGeometry(buildSculptedRecessedWindowGeo());
    const cableTrayGeo = this.worldRegistry.trackGeometry(buildSculptedCableTrayGeo(CELL_SIZE));
    const wallPanelGeo = this.worldRegistry.trackGeometry(buildSculptedWallPanelGeo());
    const beamHGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(CELL_SIZE, 0.16, 0.18));
    const dadoGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(CELL_SIZE, 0.11, 0.075));
    const overheadPipeGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(CELL_SIZE, 0.11, 0.11));
    const trimMat = floor === -1 ? this.materialPack.materials.rusted_metal : this.materialPack.materials.oak_log;
    const pipeMat = this.materialPack.materials.rusted_metal;

    const rotY = (angle: number) => new THREE.Matrix4().makeRotationY(angle);
    const makeOriented = (x: number, y: number, z: number, yaw: number) =>
      new THREE.Matrix4().makeTranslation(x, y, z).multiply(rotY(yaw));

    // Pre-collect occupied wall points (clues, tutorial plaques, recharge stations, buttons, switches, furniture) so trims never clip!
    const occupiedWalls: { x: number; z: number }[] = [];
    for (const c of this.layout.clues) if (c.floor === floor) occupiedWalls.push({ x: c.x, z: c.z });
    for (const f of this.layout.furniture) if (f.floor === floor) occupiedWalls.push({ x: f.x, z: f.z });
    for (const st of this.layout.rechargeStations) if (st.floor === floor) occupiedWalls.push({ x: st.x, z: st.z });
    for (const tp of this.layout.tutorialPlaques) if (tp.floor === floor) occupiedWalls.push({ x: tp.x, z: tp.z });
    for (const u of this.layout.uvMarks) if (u.floor === floor) occupiedWalls.push({ x: u.x, z: u.z });
    for (const sw of this.layout.lightSwitches) if (sw.floor === floor) occupiedWalls.push({ x: sw.x, z: sw.z });
    for (const b of this.layout.bunkerButtons) if (floor === 0) occupiedWalls.push({ x: b.x, z: b.z });
    const isWallClearForWindow = (x: number, z: number) => {
      for (const o of occupiedWalls) {
        if (Math.hypot(o.x - x, o.z - z) < 2.2) return false;
      }
      return true;
    };

    const chunkTargetList = floor === 0 ? this.floor0Chunks : this.floorMinus1Chunks;

    for (let cz = 0; cz < GRID_H; cz += CHUNK_SIZE) {
      for (let cx = 0; cx < GRID_W; cx += CHUNK_SIZE) {
        const floorBuckets = new Map<MaterialId, THREE.Matrix4[]>();
        const wallBuckets = new Map<MaterialId, THREE.Matrix4[]>();
        const ceilMatrices: THREE.Matrix4[] = [];
        const ventCeilMatrices: THREE.Matrix4[] = [];
        const ventUpperMatrices: THREE.Matrix4[] = [];
        const aoStripHMatrices: THREE.Matrix4[] = [];
        const aoStripVMatrices: THREE.Matrix4[] = [];
        const baseboardMatrices: THREE.Matrix4[] = [];
        const cornerColMatrices: THREE.Matrix4[] = [];
        const drainMatrices: THREE.Matrix4[] = [];
        const windowMatrices: THREE.Matrix4[] = [];
        const cableTrayMatrices: THREE.Matrix4[] = [];
        const wallPanelMatrices: THREE.Matrix4[] = [];
        const beamHMatrices: THREE.Matrix4[] = [];
        const dadoMatrices: THREE.Matrix4[] = [];
        const pipeMatrices: THREE.Matrix4[] = [];

        const pushTo = (map: Map<MaterialId, THREE.Matrix4[]>, matId: MaterialId, m: THREE.Matrix4) => {
          let arr = map.get(matId);
          if (!arr) {
            arr = [];
            map.set(matId, arr);
          }
          arr.push(m);
        };

        for (let gz = cz; gz < Math.min(GRID_H, cz + CHUNK_SIZE); gz++) {
          for (let gx = cx; gx < Math.min(GRID_W, cx + CHUNK_SIZE); gx++) {
            const idx = cellIdx(gx, gz);
            const cell = grid[idx];
            if (cell === CELL_VOID) continue;

            const wx = gridToWorld(gx);
            const wz = gridToWorld(gz);

            if (cell === CELL_WALL) {
              const matId: MaterialId =
                floor === -1
                  ? 'basement_wall'
                  : (gx <= 9 || gx >= 26) && gz >= 12 && gz <= 32
                  ? 'wallpaper_wall'
                  : 'concrete_wall';
              const m = new THREE.Matrix4().makeTranslation(wx, baseY + ceilH / 2, wz);
              pushTo(wallBuckets, matId, m);
            } else if (cell === CELL_VENT) {
              pushTo(floorBuckets, 'vent_metal', new THREE.Matrix4().makeTranslation(wx, baseY, wz));
              ventCeilMatrices.push(
                new THREE.Matrix4().makeTranslation(wx, baseY + VENT_CEILING_H, wz)
              );
              ventUpperMatrices.push(
                new THREE.Matrix4().makeTranslation(wx, baseY + VENT_CEILING_H + ventUpperH / 2, wz)
              );
            } else if (cell === CELL_FLOOR || cell === CELL_COURTYARD) {
              const surf = surfaces[idx];
              const isCourtyardGrassEdge =
                cell === CELL_COURTYARD &&
                (gx === 10 || gx === 25 || gz === 21 || gz === 29);
              const floorMat: MaterialId = isCourtyardGrassEdge
                ? 'grass_block'
                : surf === 'wood'
                ? 'wood_floor'
                : surf === 'tile'
                ? 'grimy_tile'
                : surf === 'basement_wet'
                ? 'basement_wet'
                : surf === 'stone'
                ? 'courtyard_stone'
                : 'concrete_wall';
              pushTo(floorBuckets, floorMat, new THREE.Matrix4().makeTranslation(wx, baseY, wz));

              if (cell !== CELL_COURTYARD) {
                ceilMatrices.push(new THREE.Matrix4().makeTranslation(wx, baseY + ceilH, wz));
                // Structural overhead ceiling beams every 3 rows (>= 0.025m clearance below ceiling -> zero z-fighting!)
                if (gz % 3 === 1) {
                  beamHMatrices.push(new THREE.Matrix4().makeTranslation(wx, baseY + ceilH - 0.105, wz));
                }
                // Exposed overhead PBR metallic utility pipes & perforated cable trays along main corridors & sublevel
                if ((floor === -1 && gz % 4 === 2) || (floor === 0 && (gz === 16 || gz === 28))) {
                  pipeMatrices.push(new THREE.Matrix4().makeTranslation(wx, baseY + ceilH - 0.17, wz - 0.34));
                  pipeMatrices.push(new THREE.Matrix4().makeTranslation(wx, baseY + ceilH - 0.3, wz - 0.34));
                }
                if ((floor === -1 && (gz === 12 || gz === 29)) || (floor === 0 && (gz === 11 || gz === 31))) {
                  cableTrayMatrices.push(new THREE.Matrix4().makeTranslation(wx, baseY + ceilH - 0.04, wz + 0.32));
                }
              }

              // Corner/Wall-base Ambient Occlusion + Sculpted Stepped Baseboards + Dado Relief + Recessed Windows
              // Every trim maintains >= 0.02m physical offset from walls/floors/ceilings (ZERO z-fighting!)
              const aoYH = baseY + 0.022;
              const aoYV = baseY + 0.026;
              const isIndoor = cell !== CELL_COURTYARD;
              const wallN = gz > 0 && grid[cellIdx(gx, gz - 1)] === CELL_WALL;
              const wallS = gz < GRID_H - 1 && grid[cellIdx(gx, gz + 1)] === CELL_WALL;
              const wallW = gx > 0 && grid[cellIdx(gx - 1, gz)] === CELL_WALL;
              const wallE = gx < GRID_W - 1 && grid[cellIdx(gx + 1, gz)] === CELL_WALL;
              const dadoY = baseY + 1.15;
              const trimOffset = 0.022;
              const dadoCenterOffset = 0.058; // dadoGeo depth 0.075 -> back face sits +0.0205 off wall
              const windowOffset = 0.024;

              if (wallN) {
                aoStripHMatrices.push(new THREE.Matrix4().makeTranslation(wx, aoYH, wz - CELL_SIZE * 0.5 + 0.18));
                if (isIndoor) {
                  baseboardMatrices.push(makeOriented(wx, baseY + 0.02, wz - CELL_SIZE * 0.5 + trimOffset, 0));
                  dadoMatrices.push(makeOriented(wx, dadoY, wz - CELL_SIZE * 0.5 + dadoCenterOffset, 0));
                  // Sparse high barred perimeter window on ground floor north perimeter walls
                  if (
                    floor === 0 &&
                    gz <= 12 &&
                    gx % 5 === 2 &&
                    isWallClearForWindow(wx, wz - CELL_SIZE * 0.5)
                  ) {
                    windowMatrices.push(makeOriented(wx, baseY + 1.92, wz - CELL_SIZE * 0.5 + windowOffset, 0));
                  } else if (
                    (gx + gz) % 7 === 3 &&
                    isWallClearForWindow(wx, wz - CELL_SIZE * 0.5)
                  ) {
                    wallPanelMatrices.push(makeOriented(wx, baseY + 1.72, wz - CELL_SIZE * 0.5 + trimOffset, 0));
                  }
                }
              }
              if (wallS) {
                aoStripHMatrices.push(new THREE.Matrix4().makeTranslation(wx, aoYH, wz + CELL_SIZE * 0.5 - 0.18));
                if (isIndoor) {
                  baseboardMatrices.push(makeOriented(wx, baseY + 0.02, wz + CELL_SIZE * 0.5 - trimOffset, Math.PI));
                  dadoMatrices.push(makeOriented(wx, dadoY, wz + CELL_SIZE * 0.5 - dadoCenterOffset, Math.PI));
                  if (
                    (gx + gz) % 8 === 5 &&
                    isWallClearForWindow(wx, wz + CELL_SIZE * 0.5)
                  ) {
                    wallPanelMatrices.push(makeOriented(wx, baseY + 1.72, wz + CELL_SIZE * 0.5 - trimOffset, Math.PI));
                  }
                }
              }
              if (wallW) {
                aoStripVMatrices.push(new THREE.Matrix4().makeTranslation(wx - CELL_SIZE * 0.5 + 0.18, aoYV, wz));
                if (isIndoor) {
                  baseboardMatrices.push(makeOriented(wx - CELL_SIZE * 0.5 + trimOffset, baseY + 0.023, wz, Math.PI / 2));
                  dadoMatrices.push(makeOriented(wx - CELL_SIZE * 0.5 + dadoCenterOffset, dadoY + 0.005, wz, Math.PI / 2));
                  if (
                    floor === 0 &&
                    gx === 4 &&
                    gz >= 15 &&
                    gz <= 27 &&
                    gz % 6 === 3 &&
                    isWallClearForWindow(wx - CELL_SIZE * 0.5, wz)
                  ) {
                    windowMatrices.push(makeOriented(wx - CELL_SIZE * 0.5 + windowOffset, baseY + 1.92, wz, Math.PI / 2));
                  }
                }
              }
              if (wallE) {
                aoStripVMatrices.push(new THREE.Matrix4().makeTranslation(wx + CELL_SIZE * 0.5 - 0.18, aoYV, wz));
                if (isIndoor) {
                  baseboardMatrices.push(makeOriented(wx + CELL_SIZE * 0.5 - trimOffset, baseY + 0.023, wz, -Math.PI / 2));
                  dadoMatrices.push(makeOriented(wx + CELL_SIZE * 0.5 - dadoCenterOffset, dadoY + 0.005, wz, -Math.PI / 2));
                  if (
                    floor === 0 &&
                    gx === 30 &&
                    gz >= 15 &&
                    gz <= 27 &&
                    gz % 6 === 3 &&
                    isWallClearForWindow(wx + CELL_SIZE * 0.5, wz)
                  ) {
                    windowMatrices.push(makeOriented(wx + CELL_SIZE * 0.5 - windowOffset, baseY + 1.92, wz, -Math.PI / 2));
                  }
                }
              }

              // Chamfered architectural corner pilasters in concave room corners (strictly tucked into wall corner with >=0.02 clearance!)
              if (isIndoor) {
                const halfC = CELL_SIZE * 0.5 - 0.2;
                if (wallN && wallW) cornerColMatrices.push(new THREE.Matrix4().makeTranslation(wx - halfC, baseY + 0.02, wz - halfC));
                if (wallN && wallE) cornerColMatrices.push(new THREE.Matrix4().makeTranslation(wx + halfC, baseY + 0.02, wz - halfC));
                if (wallS && wallW) cornerColMatrices.push(new THREE.Matrix4().makeTranslation(wx - halfC, baseY + 0.02, wz + halfC));
                if (wallS && wallE) cornerColMatrices.push(new THREE.Matrix4().makeTranslation(wx + halfC, baseY + 0.02, wz + halfC));
              }

              // Recessed cast-iron slotted floor drains in wet basement & main facility corridors (pit top >= 0.022 above floor -> zero z-fighting!)
              if (
                !wallN &&
                !wallS &&
                !wallW &&
                !wallE &&
                ((floor === -1 && (gx + gz) % 7 === 0 && gx % 3 === 1) ||
                  (floor === 0 && isIndoor && surf === 'tile' && gx % 6 === 1 && gz % 5 === 2))
              ) {
                drainMatrices.push(new THREE.Matrix4().makeTranslation(wx, baseY - 0.02, wz));
              }
            }
          }
        }

        const chunkGroup = new THREE.Group();
        const addInstanced = (
          geo: THREE.BufferGeometry,
          mat: THREE.Material | THREE.Material[],
          mats: THREE.Matrix4[],
          receiveShadow: boolean
        ) => {
          if (mats.length === 0) return;
          const im = new THREE.InstancedMesh(geo, mat, mats.length);
          for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
          im.instanceMatrix.needsUpdate = true;
          im.receiveShadow = receiveShadow;
          im.computeBoundingSphere();
          chunkGroup.add(im);
        };

        for (const [matId, mats] of floorBuckets) {
          addInstanced(floorTileGeo, this.materialPack.materials[matId], mats, true);
        }
        for (const [matId, mats] of wallBuckets) {
          addInstanced(wallBlockGeo, this.materialPack.materials[matId], mats, true);
        }
        if (ceilMatrices.length > 0) {
          addInstanced(ceilTileGeo, this.materialPack.materials.ceiling_plaster, ceilMatrices, false);
        }
        if (ventCeilMatrices.length > 0) {
          addInstanced(ceilTileGeo, this.materialPack.materials.vent_metal, ventCeilMatrices, false);
        }
        if (ventUpperMatrices.length > 0) {
          addInstanced(
            ventUpperGeo,
            floor === -1 ? this.materialPack.materials.basement_wall : this.materialPack.materials.concrete_wall,
            ventUpperMatrices,
            true
          );
        }
        if (aoStripHMatrices.length > 0) {
          addInstanced(aoStripHGeo, aoStripMat, aoStripHMatrices, false);
        }
        if (aoStripVMatrices.length > 0) {
          addInstanced(aoStripVGeo, aoStripMat, aoStripVMatrices, false);
        }
        if (baseboardMatrices.length > 0) {
          addInstanced(baseboardGeo, sculptedMats, baseboardMatrices, true);
        }
        if (cornerColMatrices.length > 0) {
          addInstanced(cornerColGeo, sculptedMats, cornerColMatrices, true);
        }
        if (drainMatrices.length > 0) {
          addInstanced(drainGeo, sculptedMats, drainMatrices, true);
        }
        if (windowMatrices.length > 0) {
          addInstanced(windowGeo, sculptedMats, windowMatrices, true);
        }
        if (cableTrayMatrices.length > 0) {
          addInstanced(cableTrayGeo, sculptedMats, cableTrayMatrices, false);
        }
        if (wallPanelMatrices.length > 0) {
          addInstanced(wallPanelGeo, sculptedMats, wallPanelMatrices, true);
        }
        if (beamHMatrices.length > 0) {
          addInstanced(beamHGeo, trimMat, beamHMatrices, false);
        }
        if (dadoMatrices.length > 0) {
          addInstanced(dadoGeo, trimMat, dadoMatrices, true);
        }
        if (pipeMatrices.length > 0) {
          addInstanced(overheadPipeGeo, pipeMat, pipeMatrices, false);
        }

        if (chunkGroup.children.length > 0) {
          this.worldGroup.add(chunkGroup);
          chunkTargetList.push(chunkGroup);
        }
      }
    }
  }

  /**
   * 100% Gap-Free Textured 32x32 Voxel Stairway Builder:
   *  - Spans FULL edge-to-edge from `gzBottom * CELL_SIZE` to `(gzTop + 1) * CELL_SIZE` with 18 overlapping thick treads.
   *  - Flush top & bottom threshold landing plates seal every millimeter against Floor 0 and Floor -1 (ZERO transparent step!).
   *  - Solid concrete bulkhead under the low half (z=3..5.5), keeping clear walkable headroom underneath the high half.
   *  - Always visible in worldGroup (never hidden by floor culling!).
   */
  private buildStairwayGeometry(): void {
    const stepMat = this.materialPack.materials.stair_step;
    const shaftWallMat = this.materialPack.materials.basement_wall;
    const railMat = this.materialPack.materials.rusted_metal;
    const stepCount = 18;

    for (const st of this.layout.stairways) {
      const xCenter = ((st.gxMin + st.gxMax + 1) * CELL_SIZE) / 2;
      const width = (st.gxMax - st.gxMin + 1) * CELL_SIZE;
      // Full cell edge-to-edge span so ZERO 0.8m gap can ever exist at top or bottom!
      const zBotEdge = st.gzBottom * CELL_SIZE;
      const zTopEdge = (st.gzTop + 1) * CELL_SIZE;
      const dz = (zTopEdge - zBotEdge) / stepCount;
      const dy = (FLOOR_0_Y - FLOOR_MINUS_1_Y) / stepCount;

      // 18 thick solid textured treads + risers overlapping cleanly
      const stepGeo = this.worldRegistry.trackGeometry(
        new THREE.BoxGeometry(width - 0.08, dy + 0.28, dz + 0.24)
      );
      stepGeo.setAttribute('uv1', stepGeo.attributes.uv);
      const im = new THREE.InstancedMesh(stepGeo, stepMat, stepCount);
      for (let i = 0; i < stepCount; i++) {
        const y = FLOOR_MINUS_1_Y + (i + 0.5) * dy - 0.06;
        const z = zBotEdge + (i + 0.5) * dz;
        this.scratchMat4.makeTranslation(xCenter, y, z);
        im.setMatrixAt(i, this.scratchMat4);
      }
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.worldGroup.add(im);

      // Flush Top & Bottom Threshold Landing Plates sealing the transition cleanly!
      const plateGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(width - 0.04, 0.14, 0.55));
      plateGeo.setAttribute('uv1', plateGeo.attributes.uv);
      const topPlate = new THREE.Mesh(plateGeo, stepMat);
      topPlate.position.set(xCenter, FLOOR_0_Y - 0.07, zTopEdge - 0.12);
      topPlate.receiveShadow = true;
      this.worldGroup.add(topPlate);

      const botPlate = new THREE.Mesh(plateGeo, stepMat);
      botPlate.position.set(xCenter, FLOOR_MINUS_1_Y - 0.07, zBotEdge + 0.12);
      botPlate.receiveShadow = true;
      this.worldGroup.add(botPlate);

      // Solid concrete underside support wedge under the low steps (prevents floating visual gap!)
      for (let i = 0; i < 9; i++) {
        const topY = FLOOR_MINUS_1_Y + (i + 1) * dy - 0.08;
        const colH = Math.max(0.2, topY - FLOOR_MINUS_1_Y);
        const suppGeo = this.worldRegistry.trackGeometry(
          new THREE.BoxGeometry(width - 0.14, colH, dz + 0.06)
        );
        suppGeo.setAttribute('uv1', suppGeo.attributes.uv);
        const supp = new THREE.Mesh(suppGeo, shaftWallMat);
        supp.position.set(xCenter, FLOOR_MINUS_1_Y + colH / 2, zBotEdge + (i + 0.5) * dz);
        this.worldGroup.add(supp);
      }

      // Full-height stairwell side stringer trims sealing the 1m vertical band between Basement ceiling (-1m) and Floor 0 (0m)
      const shaftLen = Math.abs(zTopEdge - zBotEdge) + 0.4;
      const bandGeo = this.worldRegistry.trackGeometry(
        new THREE.BoxGeometry(0.18, 1.35, shaftLen)
      );
      bandGeo.setAttribute('uv1', bandGeo.attributes.uv);
      for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(bandGeo, shaftWallMat);
        trim.position.set(xCenter + side * (width / 2 - 0.04), -0.45, (zTopEdge + zBotEdge) / 2);
        this.worldGroup.add(trim);
      }

      // North-end inter-floor concrete slab fascia sealing the vertical band between Basement ceiling (-0.8m) and Ground Floor (0.0m)
      const northFasciaGeo = this.worldRegistry.trackGeometry(
        new THREE.BoxGeometry(width + 0.16, 1.35, 0.24)
      );
      northFasciaGeo.setAttribute('uv1', northFasciaGeo.attributes.uv);
      const northFascia = new THREE.Mesh(northFasciaGeo, shaftWallMat);
      northFascia.position.set(xCenter, -0.45, zBotEdge - 0.06);
      this.worldGroup.add(northFascia);

      // Overhead stairwell ceiling slab so looking up while descending never sees void!
      const ceilGeo = this.worldRegistry.trackGeometry(
        new THREE.PlaneGeometry(width + 0.4, shaftLen + 1.2)
      );
      ceilGeo.rotateX(Math.PI / 2);
      ceilGeo.setAttribute('uv1', ceilGeo.attributes.uv);
      const ceil = new THREE.Mesh(ceilGeo, this.materialPack.materials.ceiling_plaster);
      ceil.position.set(xCenter, FLOOR_0_Y + GROUND_CEILING_H, (zTopEdge + zBotEdge) / 2);
      this.worldGroup.add(ceil);

      // Solid metal handrails + vertical support posts
      const length = Math.hypot(zTopEdge - zBotEdge, FLOOR_0_Y - FLOOR_MINUS_1_Y);
      const slopeAngle = Math.atan2(FLOOR_0_Y - FLOOR_MINUS_1_Y, zTopEdge - zBotEdge);
      const railGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.1, 0.1, length));
      const postGeo = this.worldRegistry.trackGeometry(new THREE.BoxGeometry(0.1, 0.98, 0.1));
      for (const side of [-1, 1]) {
        const rx = xCenter + side * (width / 2 - 0.12);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(rx, (FLOOR_0_Y + FLOOR_MINUS_1_Y) / 2 + 0.96, (zTopEdge + zBotEdge) / 2);
        rail.rotation.x = -slopeAngle;
        this.worldGroup.add(rail);

        for (const frac of [0.1, 0.5, 0.9]) {
          const post = new THREE.Mesh(postGeo, railMat);
          post.position.set(
            rx,
            FLOOR_MINUS_1_Y + (FLOOR_0_Y - FLOOR_MINUS_1_Y) * frac + 0.48,
            zBotEdge + (zTopEdge - zBotEdge) * frac
          );
          this.worldGroup.add(post);
        }
      }
    }
  }

  private rebuildDustParticles(count: number): void {
    if (this.dustPoints) {
      this.worldGroup.remove(this.dustPoints);
      this.dustPoints.geometry.dispose();
      const prevMat = this.dustPoints.material as THREE.PointsMaterial;
      prevMat.map?.dispose();
      prevMat.dispose();
      this.dustPoints = null;
    }
    const finalCount = this.isSoftwareGl ? Math.min(40, count) : count;
    const positions = new Float32Array(finalCount * 3);
    for (let i = 0; i < finalCount; i++) {
      positions[i * 3] = (Math.random() * 28 + 4) * CELL_SIZE;
      positions[i * 3 + 1] = Math.random() > 0.4 ? Math.random() * 3.0 + 0.3 : -3.6 + Math.random() * 2.5;
      positions[i * 3 + 2] = (Math.random() * 28 + 4) * CELL_SIZE;
    }
    this.dustBasePositions = new Float32Array(positions);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 8;
    dotCanvas.height = 8;
    const dCtx = dotCanvas.getContext('2d')!;
    dCtx.fillStyle = 'rgba(226, 232, 240, 0.92)';
    dCtx.fillRect(2, 2, 4, 4);
    const dotTex = new THREE.CanvasTexture(dotCanvas);
    dotTex.magFilter = THREE.NearestFilter;
    dotTex.minFilter = THREE.NearestFilter;
    dotTex.generateMipmaps = false;

    const mat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      map: dotTex,
      size: 0.085,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(geo, mat);
    this.dustPoints.visible = this.settings.video.volumetricDust;
    this.worldGroup.add(this.dustPoints);
  }

  // ---- INTERACTION & PROGRESSION LOGIC ----

  private interactWithDoor(door: DoorDefinition): void {
    if (door.lockType === 'bunker_blast') {
      this.toggleBunkerDoor(door.id === 'door_bunker_left' ? 'left' : 'right');
      return;
    }

    if (door.isExit) {
      if (!door.planksRemoved) {
        if (this.inventory.includes('crowbar')) {
          door.planksRemoved = true;
          const dv = this.doorVisuals.find((v) => v.def.id === door.id);
          if (dv?.plankGroup) dv.plankGroup.visible = false;
          this.triggerViewmodelAction('crowbar_swing');
          this.audio.playWoodSplinter();
          const doorWorldPos = this.scratchVecC.set(
            (door.gx + (door.axis === 'x' ? 1 : 0.5)) * CELL_SIZE,
            this.py + 1.35,
            (door.gz + (door.axis === 'z' ? 1 : 0.5)) * CELL_SIZE
          );
          this.spawnBurstParticles(doorWorldPos, 0x8b5a2b, 14, 0.065, 3.6);
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, 18, 3, 'door');
          this.showBanner('Tábuas da Saída Principal removidas com o Pé de Cabra!');
          this.emitHud();
          return;
        }
        this.audio.playLockedRattle();
        this.showBanner('Saída bloqueada por tábuas! Encontre ou monte o Pé de Cabra.');
        return;
      }

      if (!door.electronicUnlocked) {
        this.audio.playLockedRattle();
        this.showBanner('Trava eletrônica ativa! Abra o Cofre do Gerador no Subsolo (4 dígitos).');
        return;
      }

      if (!door.isUnlocked) {
        if (this.inventory.includes('master_key')) {
          if (this.finalGateSirenSec <= 0) {
            // Stage 4: 15-second Hydraulic Opening Siren Frenzy — alerts P. Drizzy straight to the Final Gate!
            this.finalGateSirenSec = 15.0;
            this.triggerViewmodelAction('key_turn');
            this.audio.playKeyLockTurn();
            this.audio.playBlackoutPowerDown();
            this.emitNoise(this.px, this.py, this.pz, this.pFloor, 46, 4, 'flare');
            this.showBanner(
              'SIRENE DO PORTÃO ATIVADA (15s)! Pistões hidráulicos abrindo — SOBREVIVA ATÉ O PORTÃO ABRIR!'
            );
            this.emitHud();
            return;
          }
          this.showBanner(
            `PORTÃO HIDRÁULICO ABRINDO (${Math.ceil(this.finalGateSirenSec)}s)... Cuidado com o P. Drizzy!`
          );
          return;
        }
        this.audio.playLockedRattle();
        this.showBanner('Fechadura Mestra trancada! Pegue a Chave Mestra no Cofre.');
        return;
      }
      this.triggerVictoryEscape();
      return;
    }

    if (!door.isUnlocked) {
      if (door.lockType === 'crowbar_planks') {
        if (this.inventory.includes('crowbar')) {
          door.planksRemoved = true;
          door.isUnlocked = true;
          door.isOpen = true;
          const dv = this.doorVisuals.find((v) => v.def.id === door.id);
          if (dv?.plankGroup) dv.plankGroup.visible = false;
          this.triggerViewmodelAction('crowbar_swing');
          this.audio.playWoodSplinter();
          const doorPos = this.scratchVecC.set(
            (door.gx + (door.axis === 'x' ? 1 : 0.5)) * CELL_SIZE,
            this.py + 1.35,
            (door.gz + (door.axis === 'z' ? 1 : 0.5)) * CELL_SIZE
          );
          this.spawnBurstParticles(doorPos, 0x8b5a2b, 14, 0.065, 3.6);
          if (this.moonLight.castShadow) this.moonLight.shadow.needsUpdate = true;
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, 16, 3, 'door');
          this.showBanner(`Tábuas arrancadas: ${door.name} liberada!`);
          this.emitHud();
        } else {
          this.audio.playLockedRattle();
          this.showBanner('Bloqueado com tábuas pregadas. Precisa do Pé de Cabra.');
        }
        return;
      }

      if (door.lockType === 'wire_cutters') {
        if (this.inventory.includes('wire_cutters')) {
          door.isUnlocked = true;
          door.isOpen = true;
          const dv = this.doorVisuals.find((v) => v.def.id === door.id);
          if (dv?.padlockMesh) dv.padlockMesh.visible = false;
          this.triggerViewmodelAction('wire_snip');
          this.audio.playWorkbenchCraft();
          this.audio.playDoorCreak(true);
          const chainPos = this.scratchVecC.set(
            (door.gx + (door.axis === 'x' ? 1 : 0.5)) * CELL_SIZE,
            this.py + 1.25,
            (door.gz + (door.axis === 'z' ? 1 : 0.5)) * CELL_SIZE
          );
          this.spawnBurstParticles(chainPos, 0xfbbf24, 14, 0.042, 4.1);
          if (this.moonLight.castShadow) this.moonLight.shadow.needsUpdate = true;
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, 14, 2, 'door');
          this.showBanner('Correntes cortadas! Câmara Ômega aberta!');
          this.emitHud();
        } else {
          this.audio.playLockedRattle();
          this.showBanner('Grade acorrentada! Precisa do Alicate de Corte.');
        }
        return;
      }

      const requiredKey: ItemType | null =
        door.lockType === 'red_key'
          ? 'red_key'
          : door.lockType === 'blue_key'
          ? 'blue_key'
          : door.lockType === 'basement_key'
          ? 'basement_key'
          : null;

      if (requiredKey && this.inventory.includes(requiredKey)) {
        const doorsToUnlock =
          door.lockType === 'basement_key'
            ? this.layout.doors.filter((d) => d.lockType === 'basement_key')
            : [door];
        // Single-use key consumption: remove the used key from inventory once & unlock permanently
        this.inventory = this.inventory.filter((it) => it !== requiredKey);
        this.activeSlot = Math.max(0, Math.min(this.activeSlot, this.inventory.length - 1));
        for (const targetDoor of doorsToUnlock) {
          targetDoor.isUnlocked = true;
          targetDoor.isOpen = true;
          const dv = this.doorVisuals.find((v) => v.def.id === targetDoor.id);
          if (dv?.padlockMesh) dv.padlockMesh.visible = false;
          this.onWorldSyncEvent?.({
            kind: 'door',
            payload: { doorId: targetDoor.id, open: true, locked: false, isUnlocked: true },
          });
        }
        this.triggerViewmodelAction('key_turn');
        this.audio.playKeyLockTurn();
        this.audio.playDoorCreak(door.lockType === 'basement_key');
        this.emitNoise(this.px, this.py, this.pz, this.pFloor, 14, 2, 'door');

        // Dynamic Blackout Event upon unlocking the Underground!
        if (door.lockType === 'basement_key' && !this.blackoutTriggered) {
          this.blackoutTriggered = true;
          this.blackoutActive = true;
          this.blackoutAlertTimer = 30;
          this.audio.playBlackoutPowerDown();
          this.showBanner(
            'BLECAUTE! Grades do Subsolo abertas, mas o disjuntor caiu! Instale o Fusível na Sala dos Geradores!'
          );
        } else {
          this.showBanner(
            door.lockType === 'basement_key'
              ? 'Grades do Subsolo (Oeste e Leste) destrancadas!'
              : `${door.name} destrancada!`
          );
        }
        this.emitHud();
      } else {
        this.audio.playLockedRattle();
        const keyLabel = requiredKey ? getItemLabel(requiredKey) : 'Chave';
        this.showBanner(`Trancada! Precisa da ${keyLabel}.`);
      }
      return;
    }

    door.isOpen = !door.isOpen;
    this.onWorldSyncEvent?.({
      kind: 'door',
      payload: { doorId: door.id, open: door.isOpen, locked: !door.isUnlocked, isUnlocked: door.isUnlocked },
    });
    if (this.moonLight.castShadow) {
      this.moonLight.shadow.needsUpdate = true;
    }
    const isOiled = this.oiledDoors.has(door.id);
    const isQuiet = this.crouching || isOiled;
    const isSlam = this.sprinting && !isQuiet;
    this.doorSwingSpeed.set(door.id, isQuiet ? 3.2 : isSlam ? 12.2 : 6.5);
    this.triggerViewmodelAction('grab_reach');
    if (!isOiled) {
      this.audio.playDoorCreak(door.lockType === 'basement_key', isQuiet);
      this.emitNoise(
        this.px,
        this.py,
        this.pz,
        this.pFloor,
        isQuiet ? 3.2 : isSlam ? 18.0 : 12.0,
        isQuiet ? 1 : isSlam ? 3 : 2,
        'door'
      );
    }
    this.emitHud();
  }

  private enterHidingSpot(spot: HidingSpotDefinition): void {
    this.preHidePos.set(this.px, this.py, this.pz);
    this.hidingSpot = spot;
    this.hidingTransition = 0;
    this.crouching = false;
    this.sprinting = false;
    this.flashlightOn = false;
    this.enteredHidingThisFrame = true;
    this.yaw = spot.facingYaw;
    this.targetYaw = spot.facingYaw;
    this.pitch = 0;
    this.targetPitch = 0;
    this.audio.playDoorCreak(false, true);
    this.emitNoise(spot.x, spot.y, spot.z, spot.floor, 2.2, 1, 'hiding');
    this.showBanner(
      spot.kind === 'locker'
        ? 'Escondido no armário. Fique em silêncio!'
        : 'Escondido embaixo do móvel. Não chame atenção!'
    );
    this.emitHud();
  }

  private exitHidingSpot(): void {
    if (!this.hidingSpot) return;
    if (this.holdBreath.isActive()) {
      // Bolting out mid-inspection is loud and ends the inspection immediately
      this.holdBreath.cancel();
      this.ai.resolveHidingInspection(false, this.layout);
    }
    this.px = this.preHidePos.x;
    this.py = this.preHidePos.y;
    this.pz = this.preHidePos.z;
    this.pFloor = getFloorFromY(this.py);
    this.hidingSpot = null;
    this.hidingTransition = 0;
    this.audio.playDoorCreak(false, true);
    this.emitHud();
  }

  private clampHidingLook(): void {
    if (!this.hidingSpot) return;
    let delta = this.targetYaw - this.hidingSpot.facingYaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    delta = Math.max(-0.55, Math.min(0.55, delta));
    this.targetYaw = this.hidingSpot.facingYaw + delta;
    this.targetPitch = Math.max(-0.28, Math.min(0.28, this.targetPitch));
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
  }

  private findNearestInteraction(): InteractPrompt | null {
    if (this.hidingSpot) {
      return {
        id: this.hidingSpot.id,
        label: 'Sair do Esconderijo',
        sublabel: this.hidingSpot.kind === 'locker' ? 'Abrir porta do armário' : 'Sair de baixo',
        actionType: 'unhide',
        accent: 'amber',
      };
    }

    let bestDist = 2.65;
    let best: InteractPrompt | null = null;

    // Camera horizontal look unit vector (Three.js forward is (-sin(yaw), -cos(yaw)))
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);
    const scoreInteract = (tx: number, tz: number, maxRange = 2.65, bonus = 0): number => {
      const vx = tx - this.px;
      const vz = tz - this.pz;
      const raw = Math.hypot(vx, vz);
      if (raw > maxRange) return 999;
      if (raw < 0.25) return raw - bonus;
      const dot = (vx * lookX + vz * lookZ) / raw;
      // Strongly penalize targets behind the player's back so facing a monitor/drawer/button always wins!
      const dirAdjust = dot < -0.1 ? 1.85 : dot < 0.35 ? 0.55 : -0.25 * dot;
      return raw + dirAdjust - bonus;
    };

    // 1. Items (items inside hollow drawers are ONLY pickable once their drawer is OPEN — prioritized slightly!)
    for (const item of this.layout.items) {
      if (item.collected || item.insideSafe || item.floor !== this.pFloor) continue;
      let ix = item.x;
      let iz = item.z;
      let priorityBonus = 0;
      if (item.drawerId) {
        const drawer = this.layout.furniture.find((f) => f.id === item.drawerId);
        if (!drawer?.opened) continue;
        // Slid-out drawer world position!
        ix = drawer.x + Math.sin(drawer.facingYaw) * 0.44;
        iz = drawer.z + Math.cos(drawer.facingYaw) * 0.44;
        priorityBonus = 0.45; // Prefer picking up revealed item inside open drawer over closing the drawer!
      }
      const d = scoreInteract(ix, iz, 2.65, priorityBonus);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: item.id,
          label: `Pegar ${item.label}`,
          sublabel: item.drawerId ? 'Dentro da gaveta aberta' : undefined,
          actionType: 'pickup',
          accent:
            item.itemType === 'red_key'
              ? 'red'
              : item.itemType === 'blue_key'
              ? 'blue'
              : item.itemType === 'stun_gun' || item.itemType === 'stun_ammo'
              ? 'amber'
              : 'emerald',
        };
      }
    }

    // 2. Cabine 09-A CCTV Monitor (generous 3.1m reach when looking straight at the dual monitors!)
    if (this.layout.cctvMonitorPos.floor === this.pFloor) {
      const d = scoreInteract(this.layout.cctvMonitorPos.x, this.layout.cctvMonitorPos.z, 3.1, 0.15);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: 'cctv_monitor',
          label: 'Abrir Monitor CCTV (Cabine 09-A)',
          sublabel: `6 Câmeras ao vivo · Energia ${Math.round(this.securityPowerPct)}%`,
          actionType: 'cctv_monitor',
          accent: 'emerald',
        };
      }
    }

    // 3. Cabine 09-A Blast Door Buttons
    for (const btn of this.layout.bunkerButtons) {
      if (btn.floor !== this.pFloor) continue;
      const d = scoreInteract(btn.x, btn.z, 2.65, 0.1);
      if (d < bestDist) {
        bestDist = d;
        const door = this.layout.doors.find((dr) => dr.id === btn.doorId);
        best = {
          id: btn.id,
          label: door?.isOpen
            ? `Fechar Porta Blindada (${btn.side === 'left' ? 'Oeste' : 'Leste'})`
            : `Abrir Porta Blindada (${btn.side === 'left' ? 'Oeste' : 'Leste'})`,
          sublabel: 'Bloqueia P. Drizzy · Consome Energia',
          actionType: 'bunker_door_btn',
          accent: door?.isOpen ? 'amber' : 'red',
        };
      }
    }

    // 4. Craft Workbenches
    for (const wb of this.layout.workbenches) {
      if (wb.floor !== this.pFloor) continue;
      const d = scoreInteract(wb.x, wb.z, 2.75);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: wb.id,
          label: `Usar ${wb.name}`,
          sublabel: 'Combinar peças (Pé de Cabra / Carga Stun)',
          actionType: 'workbench',
          accent: 'amber',
        };
      }
    }

    // 5. Wall Recharge Stations
    for (const st of this.layout.rechargeStations) {
      if (st.floor !== this.pFloor) continue;
      const d = scoreInteract(st.x, st.z, 2.6);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: st.id,
          label: st.name,
          sublabel: st.cooldown > 0 ? `Resfriando (${Math.ceil(st.cooldown)}s)` : 'Recarrega 100% (Faz barulho!)',
          actionType: 'recharge',
          accent: 'emerald',
        };
      }
    }

    // 6. Cassette Tapes (nested cassettes require their hollow drawer to be OPEN!)
    for (const tape of this.layout.cassettes) {
      if (tape.floor !== this.pFloor) continue;
      let tx = tape.x;
      let tz = tape.z;
      let priorityBonus = 0;
      if (tape.drawerId) {
        const drawer = this.layout.furniture.find((f) => f.id === tape.drawerId);
        if (!drawer?.opened) continue;
        tx = drawer.x + Math.sin(drawer.facingYaw) * 0.44;
        tz = drawer.z + Math.cos(drawer.facingYaw) * 0.44;
        priorityBonus = 0.45;
      }
      const d = scoreInteract(tx, tz, 2.65, priorityBonus);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: tape.id,
          label: tape.listened ? `Reouvir ${tape.title}` : `Tocar ${tape.title}`,
          sublabel: tape.drawerId ? 'Fita dentro da gaveta · Áudio-Log' : 'Áudio-Log · História do Complexo',
          actionType: 'cassette',
          accent: 'purple',
        };
      }
    }

    // 7. Interactive Furniture (Drawers, Generator Lever, Translation Board, Secret Terminal)
    for (const prop of this.layout.furniture) {
      if (prop.floor !== this.pFloor) continue;
      if (
        prop.kind !== 'drawer_cabinet' &&
        prop.kind !== 'generator_lever' &&
        prop.kind !== 'translation_board' &&
        prop.kind !== 'secret_terminal' &&
        prop.kind !== 'level2_hatch'
      ) {
        continue;
      }
      const d = scoreInteract(prop.x, prop.z, 2.65);
      if (d < bestDist) {
        bestDist = d;
        if (prop.kind === 'drawer_cabinet') {
          best = {
            id: prop.id,
            label: prop.opened ? 'Fechar Gaveta' : 'Abrir Gaveta',
            sublabel: prop.opened ? 'Fechar gaveta de madeira' : 'Vasculhar interior da gaveta',
            actionType: 'drawer',
            accent: 'default',
          };
        } else if (prop.kind === 'generator_lever') {
          best = {
            id: prop.id,
            label: this.generatorFixed
              ? 'Gerador Principal (Ativo)'
              : !this.fuseInstalled
              ? 'Instalar Fusível no Gerador'
              : 'Puxar Alavanca do Gerador',
            sublabel: this.blackoutActive ? 'Restaura Energia do Apagão!' : 'Energia do Complexo',
            actionType: 'generator_lever',
            accent: this.generatorFixed ? 'emerald' : 'amber',
          };
        } else if (prop.kind === 'translation_board') {
          best = {
            id: prop.id,
            label: 'Ler Quadro de Tradução UV',
            sublabel: 'Mapeia símbolos UV → dígitos',
            actionType: 'translation_board',
            accent: 'purple',
          };
        } else if (prop.kind === 'level2_hatch') {
          const ready =
            this.inventory.includes('wire_cutters') &&
            this.cctvSecretHintSeen &&
            this.layout.cassettes.some((t) => t.listened);
          best = {
            id: prop.id,
            label: ready ? 'Abrir Alçapão Vermelho (Nível -2)' : 'Alçapão Blindado · Nível -2',
            sublabel: ready
              ? 'Resgatar Vigia Marcos (Final Real)'
              : 'Requer Alicate + Pista CCTV + Sinal do Marcos',
            actionType: 'level2_hatch',
            accent: ready ? 'emerald' : 'red',
          };
        } else {
          best = {
            id: prop.id,
            label: 'Terminal Secreto (5 dígitos)',
            sublabel: this.terminalUnlocked ? 'Acesso Liberado' : 'Decifre os símbolos UV',
            actionType: 'secret_terminal',
            accent: 'purple',
          };
        }
      }
    }

    // 8. ARG Visual Clues
    for (const clue of this.layout.clues) {
      if (clue.floor !== this.pFloor) continue;
      const d = Math.hypot(clue.x - this.px, clue.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: clue.id,
          label: clue.discovered ? `Rever Pista #${clue.digitIndex + 1} (${clue.digitValue})` : `Examinar ${clue.title}`,
          sublabel: 'Pista ARG do Cofre',
          actionType: 'clue',
          accent: 'amber',
        };
      }
    }

    // 9. UV Marks (interactable when UV Light is active!)
    if (this.uvMode && this.flashlightOn) {
      for (const mark of this.layout.uvMarks) {
        if (mark.floor !== this.pFloor) continue;
        const d = Math.hypot(mark.x - this.px, mark.z - this.pz);
        if (d < bestDist) {
          bestDist = d;
          best = {
            id: mark.id,
            label: `Registrar Marca UV (${mark.symbolChar})`,
            sublabel: mark.title,
            actionType: 'uv_mark',
            accent: 'purple',
          };
        }
      }
    }

    // 9b. Functional Industrial Wall Light Switches
    for (const sw of this.layout.lightSwitches) {
      if (sw.floor !== this.pFloor) continue;
      const d = scoreInteract(sw.x, sw.z, 2.55);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: sw.id,
          label: sw.isOn ? `Apagar Luzes (${sw.roomName})` : `Acender Luzes (${sw.roomName})`,
          sublabel: sw.isOn ? 'Escurece a sala para furtividade' : 'Restaura iluminação do teto',
          actionType: 'light_switch',
          accent: sw.isOn ? 'amber' : 'emerald',
        };
      }
    }

    // 10. Safe
    if (this.layout.safe.floor === this.pFloor && !this.layout.safe.unlocked) {
      const d = Math.hypot(this.layout.safe.x - this.px, this.layout.safe.z - this.pz);
      if (d < bestDist + 0.2) {
        bestDist = d;
        best = {
          id: this.layout.safe.id,
          label: 'Digitar Código no Cofre',
          sublabel: 'Painel Eletrônico (4 dígitos)',
          actionType: 'safe',
          accent: 'emerald',
        };
      }
    }

    // 10b. Update 2.0 Interactive Setpieces (Garage Escape Car, False Bookshelf, Interactive Piano, Steam Valves)
    const anchors = this.layout.remasterAnchors;
    if (anchors.garageCar.floor === this.pFloor) {
      const d = scoreInteract(anchors.garageCar.x, anchors.garageCar.z, 3.1, 0.15);
      if (d < bestDist) {
        bestDist = d;
        const readyToDrive =
          this.garageBatteryInstalled && this.garageFuelInstalled && this.inventory.includes('garage_key');
        best = {
          id: 'remaster_garage_car',
          label: readyToDrive ? 'Ligar Carro e Fugir (Garagem)' : 'Carro de Fuga (Garagem Leste)',
          sublabel: readyToDrive
            ? 'Motor pronto! Aperte para escapar!'
            : `Bateria: ${this.garageBatteryInstalled ? 'OK' : 'Falta'} · Gasolina: ${this.garageFuelInstalled ? 'OK' : 'Falta'}`,
          actionType: 'garage_car',
          accent: readyToDrive ? 'emerald' : 'amber',
        };
      }
    }
    if (anchors.falseBookshelf.floor === this.pFloor && !this.bookshelfOpened) {
      const d = scoreInteract(anchors.falseBookshelf.x, anchors.falseBookshelf.z, 2.75);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: 'remaster_false_bookshelf',
          label: 'Estante Falsa (Emblemas Sol & Lua)',
          sublabel: `Sol: ${this.bookshelfSunInstalled ? 'OK' : 'Falta'} · Lua: ${this.bookshelfMoonInstalled ? 'OK' : 'Falta'}`,
          actionType: 'false_bookshelf',
          accent: 'purple',
        };
      }
    }
    if (anchors.piano.floor === this.pFloor && this.pianoSequenceStep < 3) {
      const d = scoreInteract(anchors.piano.x, anchors.piano.z, 2.7);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: 'remaster_piano',
          label: `Tocar Piano Vertical (${this.pianoSequenceStep}/3)`,
          sublabel: 'Toca acorde secreto (faz barulho!)',
          actionType: 'piano',
          accent: 'amber',
        };
      }
    }
    if (anchors.steamValves.floor === this.pFloor && this.steamValvesClosed.some((v) => !v)) {
      const d = scoreInteract(anchors.steamValves.x, anchors.steamValves.z, 2.9);
      if (d < bestDist) {
        bestDist = d;
        const closed = this.steamValvesClosed.filter(Boolean).length;
        best = {
          id: 'remaster_steam_valves',
          label: `Fechar Válvula de Vapor (${closed}/3)`,
          sublabel: 'Reduz a pressão das caldeiras do Subsolo',
          actionType: 'steam_valve',
          accent: 'red',
        };
      }
    }

    // 11. Doors & Main Exit
    for (const door of this.layout.doors) {
      if (door.floor !== this.pFloor || door.lockType === 'bunker_blast') continue;
      const halfSpan = (door.spanCells || 2) * 0.5;
      const cx = door.axis === 'x' ? (door.gx + halfSpan) * CELL_SIZE : (door.gx + 0.5) * CELL_SIZE;
      const cz = door.axis === 'x' ? (door.gz + 0.5) * CELL_SIZE : (door.gz + halfSpan) * CELL_SIZE;
      const d = Math.hypot(cx - this.px, cz - this.pz);
      if (d < bestDist + 0.3) {
        bestDist = d;
        let sub = door.isOpen ? 'Fechar porta' : 'Abrir porta';
        if (door.isExit) {
          if (!door.planksRemoved) sub = 'Remover Tábuas (Pé de Cabra)';
          else if (!door.electronicUnlocked) sub = 'Trava Eletrônica (Cofre Subsolo)';
          else sub = 'Destrancar (Chave Mestra)';
        } else if (!door.isUnlocked) {
          sub =
            door.lockType === 'crowbar_planks'
              ? 'Arrancar Tábuas (Pé de Cabra)'
              : door.lockType === 'wire_cutters'
              ? 'Cortar Correntes (Alicate de Corte)'
              : door.lockType === 'red_key'
              ? 'Requer Chave Vermelha'
              : door.lockType === 'blue_key'
              ? 'Requer Chave Azul'
              : 'Requer Chave do Subsolo';
        }
        best = {
          id: door.id,
          label: door.name,
          sublabel: sub,
          actionType: door.isExit ? 'exit' : 'door',
          accent:
            door.lockType === 'red_key'
              ? 'red'
              : door.lockType === 'blue_key'
              ? 'blue'
              : door.isExit
              ? 'emerald'
              : 'amber',
        };
      }
    }

    // 12. Hiding Spots
    for (const spot of this.layout.hidingSpots) {
      if (spot.floor !== this.pFloor) continue;
      const d = Math.hypot(spot.x - this.px, spot.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: spot.id,
          label:
            spot.kind === 'locker'
              ? 'Esconder no Armário'
              : spot.kind === 'under_bed'
              ? 'Esconder Embaixo da Cama'
              : 'Esconder Embaixo da Mesa',
          actionType: 'hide',
          accent: 'default',
        };
      }
    }

    return best;
  }

  // ---- CUTSCENES, JUMPSCARE, VICTORY ----

  private startCutscene(id: CutsceneId): void {
    this.exitPointerLock();
    this.activeCutscene = id;
    this.mode = id === 'intro' ? 'intro_cutscene' : 'ending_cutscene';
    this.cutsceneStepIdx = 0;
    this.cutsceneStepElapsed = 0;

    const script = getCutsceneScript(id);
    const firstCam = script.cameras[0];
    const anchors = script.anchors;
    this.cutsceneCamPos.set(...firstCam.pos);
    this.cutsceneCamLook.set(...firstCam.lookAt);

    // Disable player velocity/gravity during cutscenes so no actor can ever fall into void
    this.vx = 0;
    this.vz = 0;

    // Toggle ONLY the dedicated enclosed 3D cutscene set for this scene
    if (this.cutsceneSets) {
      this.cutsceneSets.sets.gate_road.visible = anchors.setId === 'gate_road';
      this.cutsceneSets.sets.basement_tunnel.visible = anchors.setId === 'basement_tunnel';
      this.cutsceneSets.sets.helipad_roof.visible = anchors.setId === 'helipad_roof';
      this.cutsceneSets.sets.containment_cell.visible = anchors.setId === 'containment_cell';
      this.cutsceneSets.gateLeftPivot.rotation.y = -1.35;
      this.cutsceneSets.gateRightPivot.rotation.y = 1.35;
      this.cutsceneSets.cellDoorPivot.rotation.y = -1.4;
      this.cutsceneSets.helicopterGroup.position.set(180, 6.0, 12.2);
    }

    if (this.diddyRig) {
      this.diddyRig.root.visible = true;
      this.diddyRig.root.position.set(...anchors.diddyStart);
      this.diddyRig.root.rotation.y = anchors.diddyFacingYaw;
    }
    if (this.survivorRig) {
      this.survivorRig.visible = false;
    }
    if (this.cutsceneSurvivorRig) {
      this.cutsceneSurvivorRig.root.visible = script.showSurvivor;
      this.cutsceneSurvivorRig.root.position.set(...anchors.survivorStart);
      this.cutsceneSurvivorRig.root.rotation.y = anchors.survivorFacingYaw;
    }

    this.transitionFade = 0.72;
    const firstStep = script.steps[0];
    if (firstStep?.soundCue) {
      this.audio.playCutsceneCue(firstStep.soundCue);
    }
    this.setBodyState('playing');
    this.emitCutsceneState();
    this.emitHud();
  }

  private emitCutsceneState(): void {
    if (!this.activeCutscene) {
      this.callbacks.onCutsceneUpdate(null);
      return;
    }
    const script = getCutsceneScript(this.activeCutscene);
    const step = script.steps[this.cutsceneStepIdx];
    this.callbacks.onCutsceneUpdate({
      id: this.activeCutscene,
      chapterTitle: script.chapterTitle,
      subtitle: script.subtitle,
      stepIndex: this.cutsceneStepIdx,
      totalSteps: script.steps.length,
      step,
      progress: (this.cutsceneStepIdx + 1) / script.steps.length,
    });
  }

  private finishCutscene(): void {
    const finished = this.activeCutscene;
    this.activeCutscene = null;
    this.callbacks.onCutsceneUpdate(null);
    this.transitionFade = 0.75;

    if (this.galleryReplayMode) {
      this.galleryReplayMode = false;
      this.returnToTitle();
      return;
    }

    if (finished === 'intro') {
      this.enterPlayingState();
    } else if (finished === 'ending_bad') {
      this.mode = 'defeat';
      this.setBodyState('gameover');
      this.emitHud();
    } else if (
      finished === 'ending' ||
      finished === 'ending_good' ||
      finished === 'ending_real' ||
      finished === 'ending_secret'
    ) {
      this.mode = 'victory';
      this.setBodyState('gameover');
      this.emitHud();
    }
  }

  private enterPlayingState(): void {
    this.mode = 'playing';
    this.transitionFade = Math.max(this.transitionFade, 0.58);
    this.camera.fov = this.settings.video.fov;
    this.camera.updateProjectionMatrix();
    if (this.survivorRig) this.survivorRig.visible = false;
    if (this.cutsceneSurvivorRig) this.cutsceneSurvivorRig.root.visible = false;
    if (this.cutsceneSets) {
      this.cutsceneSets.sets.gate_road.visible = false;
      this.cutsceneSets.sets.basement_tunnel.visible = false;
      this.cutsceneSets.sets.helipad_roof.visible = false;
      this.cutsceneSets.sets.containment_cell.visible = false;
    }
    this.ai.reset(this.layout);
    this.setBodyState('playing');
    this.showBanner('Examine o rádio e as placas na Recepção. Use a Sala de Segurança (CCTV), Dutos [C] e Bancada!');
    this.emitHud();
  }

  private finalizeEnding(endingId: EndingId): void {
    const vhsCollected = this.layout.cassettes.filter((t) => t.listened).length;
    const uvCluesCollected = this.layout.uvMarks.filter((u) => u.discovered).length;
    const exploredPct = this.fog.getExploredPercentage(this.layout);

    const res = saveSystem.recordRunResult({
      endingId,
      difficulty: this.difficulty,
      elapsedSec: this.elapsedSec,
      detections: this.runDetections,
      stunsApplied: this.runStunsApplied,
      flaresUsed: this.runFlaresUsed,
      vhsCollected,
      vhsTotal: this.layout.cassettes.length,
      uvCluesCollected,
      uvCluesTotal: this.layout.uvMarks.length,
      exploredPct,
      safeUnlocked: this.layout.safe.unlocked,
      terminalUnlocked: this.terminalUnlocked,
      holdBreathSurvived: this.runHoldBreathSurvived,
      craftsCompleted: this.runCraftsCompleted,
    });

    this.lastEndingId = endingId;
    this.lastMissionReport = res.report;
    this.chapter2JustUnlocked = res.report.chapter2JustUnlocked;
    this.isNewBestTime = res.report.isNewBestTime;
    this.callbacks.onProfileUpdate(res.profile);
    this.callbacks.onProgressionUpdate?.(res.progression);
    for (const toast of res.newlyUnlockedAchievements) {
      this.callbacks.onAchievementUnlocked?.(toast);
    }

    const csId: CutsceneId =
      endingId === 'bad'
        ? 'ending_bad'
        : endingId === 'real'
        ? 'ending_real'
        : endingId === 'secret'
        ? 'ending_secret'
        : 'ending_good';
    this.startCutscene(csId);
  }

  private triggerVictoryEscape(): void {
    this.audio.playEscapeReliefChord();
    const allUvFound = this.layout.uvMarks.every((u) => u.discovered);
    const endingId: EndingId =
      this.terminalUnlocked && (allUvFound || this.translationBoardSeen) ? 'secret' : 'good';
    this.finalizeEnding(endingId);
  }

  private triggerRealEndingEscape(): void {
    this.audio.playEscapeReliefChord();
    this.finalizeEnding('real');
  }

  private triggerJumpscare(): void {
    this.exitPointerLock();
    this.mode = 'jumpscare';
    this.jumpscareTimer = 0;
    this.hidingSpot = null;
    this.keypadOpen = false;
    this.cctvOpen = false;
    this.workbenchOpen = false;
    this.terminalOpen = false;
    this.trauma = 1.0;
    this.damageFlash = 1.0;
    this.audio.playJumpscareImpact();
    this.triggerHaptic(180, 0.9);

    if (this.diddyRig) {
      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      this.diddyRig.root.position.set(
        this.px + fwdX * 0.72,
        this.py - 0.14,
        this.pz + fwdZ * 0.72
      );
      this.diddyRig.root.rotation.y = Math.atan2(-fwdX, -fwdZ);
      this.diddyRig.root.visible = true;
    }

    this.jumpscareLight.visible = true;
    this.emitHud();
  }

  private emitNoise(
    x: number,
    y: number,
    z: number,
    floor: FloorId,
    radius: number,
    priority: number,
    source: NoiseEvent['source']
  ): void {
    this.noiseQueue.push({
      x,
      y,
      z,
      floor,
      radius,
      priority,
      source,
      timestamp: this.elapsedSec,
    });
    const visualSpike = Math.min(1, radius / 22);
    this.noiseLevel = Math.max(this.noiseLevel, visualSpike);
  }

  private showBanner(text: string): void {
    this.statusBanner = text;
    this.statusBannerTimer = 4.4;
  }

  // ---- MAIN SIMULATION LOOP ----

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.rafId = requestAnimationFrame(() => {
        if (this.disposed) return;
        this.timeoutId = window.setTimeout(() => {
          if (!this.disposed) this.tick(performance.now());
        }, 320);
      });
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (nowMs: number): void => {
    if (this.disposed) return;
    if (this.backgroundPaused) {
      this.lastFrameMs = nowMs;
      this.lastRenderMs = nowMs;
      this.scheduleNextFrame();
      return;
    }
    if (!this.isSoftwareGl) {
      const fpsLimit = this.settings.video.fpsLimit ?? 60;
      const minFrameMs = fpsLimit === 30 ? 32.5 : fpsLimit === 60 ? 15.8 : 0;
      if (minFrameMs > 0 && this.lastRenderMs > 0 && nowMs - this.lastRenderMs < minFrameMs) {
        this.scheduleNextFrame();
        return;
      }
      this.lastRenderMs = nowMs;
    }
    const rawDt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const dt = Math.max(0.001, Math.min(rawDt, 0.05));
    if (rawDt > 0.001 && rawDt < 0.5) {
      this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / rawDt) * 0.1;
      this.frameTimeMsSmoothed = this.frameTimeMsSmoothed * 0.9 + rawDt * 1000 * 0.1;
    }
    this.totalTimeSec += dt;

    if (this.mode === 'title') {
      this.tickTitleFlyover(dt);
    } else if (this.mode === 'intro_cutscene' || this.mode === 'ending_cutscene') {
      this.tickCutscene(dt);
    } else if (this.mode === 'playing') {
      this.tickGameplay(dt);
    } else if (this.mode === 'jumpscare') {
      this.tickJumpscare(dt);
    }

    this.transitionFade = Math.max(0, this.transitionFade - dt * 1.85);
    this.updateRemotePeerRigs(dt);
    this.updateDynamicLighting(dt);
    this.updateDustParticles(dt);
    this.updateAtmosphereAnimations(dt);
    this.updateDoorAndFurnitureAnimations(dt);

    // Main Viewport Render (Full EffectComposer on High/Ultra hardware GPU; fast direct pass on Low/Medium!)
    if (this.usePostProcessing && this.composer) {
      if (this.filmPass?.uniforms?.uTime) {
        this.filmPass.uniforms.uTime.value = this.totalTimeSec;
      }
      if (this.filmPass?.uniforms?.uChromatic) {
        const vhsMult = Math.max(0, Math.min(1, this.settings.video.vhsIntensity ?? 0.65));
        const baseChrom = this.settings.graphicsQuality === 'ultra' ? 0.0014 : 0.00085;
        this.filmPass.uniforms.uChromatic.value = (baseChrom + this.chromaticIntensity * 0.0085) * vhsMult;
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Live 15 FPS Cabine 09-A CCTV Render (0 overhead when monitor closed!)
    if (this.mode === 'playing' && this.cctvOpen && this.cctvCanvas) {
      this.cctvRenderAccum += dt;
      const interval = this.isSoftwareGl ? 0.14 : 0.066;
      if (this.cctvRenderAccum >= interval) {
        this.cctvRenderAccum = 0;
        this.renderCctvFrame();
      }
    }

    const hudPeriod = this.isSoftwareGl ? 0.32 : 0.1;
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= hudPeriod) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }

    const mapPeriod = this.isSoftwareGl ? 0.35 : 0.14;
    this.minimapRedrawAccum += dt;
    if (this.minimapRedrawAccum >= mapPeriod) {
      this.minimapRedrawAccum = 0;
      if (this.minimapCanvas) this.drawStrictFogMap(this.minimapCanvas, false);
      if (this.fullMapCanvas) this.drawStrictFogMap(this.fullMapCanvas, true);
    }

    this.scheduleNextFrame();
  };

  /**
   * Renders the active Cabine 09-A Security Camera (CAM 01..06) live from the real 3D scene
   * using ONE reused 480x300 WebGLRenderTarget with boosted bright night-vision + crisp scanlines!
   */
  private renderCctvFrame(): void {
    if (!this.cctvCanvas) return;
    const camDef = this.layout.bunkerCameras[this.cctvActiveCamIndex];
    if (!camDef) return;

    const ctx = this.cctvCanvas.getContext('2d');
    if (!ctx) return;

    // Position reusable CCTV camera
    this.cctvCamera.position.set(camDef.x, camDef.y, camDef.z);
    this.cctvCamera.lookAt(camDef.lookX, camDef.lookY, camDef.lookZ);

    // Save visibility & lighting state, then flood CCTV camera room with bright IR night-vision illumination!
    const prevHeldVis = this.heldItemRig.root.visible;
    const prevHighlightVis = this.aimHighlightBox.visible;
    const prevFogDensity = (this.scene.fog as THREE.FogExp2).density;
    const prevHemiIntensity = this.hemiLight.intensity;
    const prevDirIntensity = this.dirLight.intensity;

    this.heldItemRig.root.visible = false;
    this.aimHighlightBox.visible = false;
    (this.scene.fog as THREE.FogExp2).density = 0.012;
    this.hemiLight.intensity = 1.85;
    this.dirLight.intensity = 0.85;
    this.updateFloorVisibility(camDef.floor, false);
    this.cctvFillLight.position.set(
      (camDef.x + camDef.lookX) * 0.5,
      Math.max(camDef.y - 0.3, camDef.lookY + 1.2),
      (camDef.z + camDef.lookZ) * 0.5
    );
    this.cctvFillLight.visible = true;

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.cctvRenderTarget);
    this.renderer.render(this.scene, this.cctvCamera);
    this.renderer.readRenderTargetPixels(
      this.cctvRenderTarget,
      0,
      0,
      CCTV_W,
      CCTV_H,
      this.cctvPixelBuf
    );
    this.renderer.setRenderTarget(prevTarget);

    // Restore main viewport state cleanly
    this.cctvFillLight.visible = false;
    this.heldItemRig.root.visible = prevHeldVis;
    this.aimHighlightBox.visible = prevHighlightVis;
    (this.scene.fog as THREE.FogExp2).density = prevFogDensity;
    this.hemiLight.intensity = prevHemiIntensity;
    this.dirLight.intensity = prevDirIntensity;
    const nearStairs = getStairHeightAt(this.px, this.pz, this.py).onStair || this.pz < 12 * CELL_SIZE;
    this.updateFloorVisibility(this.pFloor, nearStairs);

    if (!this.cctvImageData || this.cctvImageData.width !== CCTV_W || this.cctvImageData.height !== CCTV_H) {
      this.cctvImageData = ctx.createImageData(CCTV_W, CCTV_H);
    }
    const out = this.cctvImageData.data;
    const src = this.cctvPixelBuf;
    const timeTick = Math.floor(this.totalTimeSec * 24);

    // Flip Y (WebGL bottom-up -> Canvas top-down) + High-Clarity Bright Phosphor Night-Vision CRT!
    for (let y = 0; y < CCTV_H; y++) {
      const srcY = CCTV_H - 1 - y;
      const scanMult = y % 2 === 0 ? 1.04 : 0.88;
      for (let x = 0; x < CCTV_W; x++) {
        const si = (srcY * CCTV_W + x) * 4;
        const di = (y * CCTV_W + x) * 4;
        const r = src[si];
        const g = src[si + 1];
        const b = src[si + 2];
        const lum = r * 0.29 + g * 0.58 + b * 0.13;
        const grain = (((x * 37 + y * 17 + timeTick * 13) ^ 97) & 7) - 3;
        const boosted = Math.max(0, Math.min(255, (lum * 1.75 + 24 + grain) * scanMult));
        // Preserve a subtle touch of red so P. Diddy's glowing eyes & alerts pop clearly on CCTV!
        const redBoost = Math.max(0, r - g * 0.8) * 0.65;
        out[di] = Math.min(255, boosted * 0.42 + redBoost);
        out[di + 1] = Math.min(255, boosted * 1.08);
        out[di + 2] = Math.min(255, boosted * 0.56);
        out[di + 3] = 255;
      }
    }
    ctx.putImageData(this.cctvImageData, 0, 0);
  }

  private syncFlashlightWorldPose(waterPower: number, colorHex: number): void {
    this.camera.updateMatrixWorld();
    this.camera.getWorldPosition(this.scratchFlashPos);
    this.camera.getWorldDirection(this.scratchFlashDir);
    this.scratchFlashUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    this.scratchFlashRight.crossVectors(this.scratchFlashDir, this.scratchFlashUp).normalize();

    // Slightly offset to the right hand & forward so the cone never clips the player's own near plane
    this.scratchFlashPos
      .addScaledVector(this.scratchFlashRight, 0.12)
      .addScaledVector(this.scratchFlashUp, -0.08)
      .addScaledVector(this.scratchFlashDir, 0.08);

    this.flashlight.position.copy(this.scratchFlashPos);
    this.flashlightSpill.position.copy(this.scratchFlashPos);
    this.flashlightTarget.position
      .copy(this.scratchFlashPos)
      .addScaledVector(this.scratchFlashDir, 10.0);
    this.flashlightTarget.updateMatrixWorld();

    this.waterManager?.setFlashlightUniforms(
      this.scratchFlashPos,
      this.scratchFlashDir,
      colorHex,
      waterPower
    );
  }

  private tickTitleFlyover(dt: number): void {
    const cam = getTitleFlyoverCamera(this.totalTimeSec);
    this.camera.position.set(...cam.pos);
    this.camera.lookAt(...cam.lookAt);
    this.flashlight.color.setHex(FLASHLIGHT_CONFIG.color);
    this.flashlightSpill.color.setHex(FLASHLIGHT_CONFIG.color);
    this.flashlight.intensity = 5.5;
    this.flashlightSpill.intensity = 1.2;
    this.syncFlashlightWorldPose(0.45, FLASHLIGHT_CONFIG.color);
    this.heldItemRig.root.visible = false;
    if (this.survivorRig) this.survivorRig.visible = false;
    if (this.cutsceneSurvivorRig) this.cutsceneSurvivorRig.root.visible = false;
    if (this.cutsceneSets) {
      this.cutsceneSets.sets.gate_road.visible = false;
      this.cutsceneSets.sets.basement_tunnel.visible = false;
      this.cutsceneSets.sets.helipad_roof.visible = false;
      this.cutsceneSets.sets.containment_cell.visible = false;
    }

    // Live Guardhouse Main Menu: P. Drizzy silently stalks across the moonlit courtyard corridor!
    if (this.diddyRig) {
      this.diddyRig.root.visible = true;
      const patrolPhase = this.totalTimeSec * 0.36;
      const pxPos = gridToWorld(17.5) + Math.sin(patrolPhase) * 3.8;
      const walkDir = Math.cos(patrolPhase) >= 0 ? Math.PI / 2 : -Math.PI / 2;
      this.diddyRig.root.position.set(pxPos, FLOOR_0_Y, gridToWorld(23.2));
      this.diddyRig.root.rotation.y = walkDir;
      updateDiddyRigAnimation(this.diddyRig, 'patrol', dt);
    }
    this.updateFloorVisibility(0, false);
  }

  private tickCutscene(dt: number): void {
    if (!this.activeCutscene) return;
    const script = getCutsceneScript(this.activeCutscene);
    const step = script.steps[this.cutsceneStepIdx];

    this.heldItemRig.root.visible = false;
    this.flashlight.color.setHex(FLASHLIGHT_CONFIG.color);
    this.flashlightSpill.color.setHex(FLASHLIGHT_CONFIG.color);
    this.flashlight.intensity = 7.5;
    this.flashlightSpill.intensity = 1.6;

    const stepProgress = Math.max(0, Math.min(1, this.cutsceneStepElapsed / Math.max(0.2, step.autoAdvanceSec)));
    const splineState = evaluateCutsceneSpline(
      script,
      this.cutsceneStepIdx,
      stepProgress,
      this.scratchVecA,
      this.scratchVecB
    );
    const k = 1 - Math.exp(-5.4 * dt);
    this.cutsceneCamPos.lerp(this.scratchVecA, k);
    this.cutsceneCamLook.lerp(this.scratchVecB, k);

    const shakeMag = splineState.shake * 0.72;
    const sx = (Math.sin(this.totalTimeSec * 8.7) + Math.sin(this.totalTimeSec * 3.1) * 0.5) * shakeMag;
    const sy = (Math.cos(this.totalTimeSec * 11.3) + Math.cos(this.totalTimeSec * 4.2) * 0.4) * shakeMag;
    this.camera.position.set(
      this.cutsceneCamPos.x + sx,
      this.cutsceneCamPos.y + sy,
      this.cutsceneCamPos.z
    );
    this.camera.lookAt(this.cutsceneCamLook);
    this.syncFlashlightWorldPose(0.55, FLASHLIGHT_CONFIG.color);
    if (splineState.fov) {
      this.camera.fov += (splineState.fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }

    const anchors = script.anchors;
    const totalProgress = Math.max(
      0,
      Math.min(1, (this.cutsceneStepIdx + stepProgress) / Math.max(1, script.steps.length))
    );

    // Choreographed Survivor motion (running through gate, boarding vehicle/helicopter, glancing back)
    if (this.cutsceneSurvivorRig && this.cutsceneSurvivorRig.root.visible) {
      const runT = Math.min(1, totalProgress * 1.25);
      const sxPos = anchors.survivorStart[0] + (anchors.survivorEnd[0] - anchors.survivorStart[0]) * runT;
      const syPos = anchors.survivorStart[1] + (anchors.survivorEnd[1] - anchors.survivorStart[1]) * runT;
      const szPos = anchors.survivorStart[2] + (anchors.survivorEnd[2] - anchors.survivorStart[2]) * runT;
      this.cutsceneSurvivorRig.root.position.set(sxPos, syPos, szPos);
      // Glance back toward P. Drizzy during confrontation steps, otherwise face run direction
      const glanceBack = script.diddyBackdropSteps.includes(this.cutsceneStepIdx) ? 0.55 : 0;
      this.cutsceneSurvivorRig.root.rotation.y = anchors.survivorFacingYaw + glanceBack;
      const survAnim: PeerAnimState =
        anchors.setId === 'containment_cell'
          ? totalProgress > 0.65
            ? 'captured'
            : 'walk'
          : runT < 0.96
          ? 'run'
          : 'idle';
      // Hide survivor once boarded inside helicopter during final takeoff
      if (anchors.setId === 'helipad_roof' && totalProgress > 0.78) {
        this.cutsceneSurvivorRig.root.visible = false;
      }
      updatePeerRigAnimation(this.cutsceneSurvivorRig, survAnim, 0, dt);
    }

    // Choreographed P. Drizzy pursuit -> furious gate pounding
    if (this.diddyRig) {
      const diddyT = Math.min(1, totalProgress * 1.35);
      const dxPos = anchors.diddyStart[0] + (anchors.diddyEnd[0] - anchors.diddyStart[0]) * diddyT;
      const dyPos = anchors.diddyStart[1] + (anchors.diddyEnd[1] - anchors.diddyStart[1]) * diddyT;
      const dzPos = anchors.diddyStart[2] + (anchors.diddyEnd[2] - anchors.diddyStart[2]) * diddyT;
      this.diddyRig.root.position.set(dxPos, dyPos, dzPos);
      this.diddyRig.root.rotation.y = anchors.diddyFacingYaw;
      const diddyAnim =
        this.activeCutscene === 'intro'
          ? 'patrol'
          : diddyT >= 0.92
          ? 'breach_door'
          : 'chase';
      updateDiddyRigAnimation(this.diddyRig, diddyAnim, dt);
    }

    // Animate dedicated 3D Cutscene Set props (gate slam, cell slam, car strobes, helicopter rotors & takeoff)
    if (this.cutsceneSets) {
      if (anchors.setId === 'gate_road') {
        const closeT = Math.max(0, Math.min(1, (totalProgress - 0.22) * 3.2));
        this.cutsceneSets.gateLeftPivot.rotation.y = -1.35 * (1 - closeT);
        this.cutsceneSets.gateRightPivot.rotation.y = 1.35 * (1 - closeT);
        const flash = Math.sin(this.totalTimeSec * 14) > 0;
        (this.cutsceneSets.carBeaconRed.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 4.2 : 0.4;
        (this.cutsceneSets.carBeaconBlue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.4 : 4.2;
      } else if (anchors.setId === 'containment_cell') {
        const slamT = Math.max(0, Math.min(1, (totalProgress - 0.45) * 4.5));
        this.cutsceneSets.cellDoorPivot.rotation.y = -1.4 * (1 - slamT);
        this.cutsceneSets.cellCageLight.intensity = 2.6 + Math.sin(this.totalTimeSec * 23) * 0.55;
      } else if (anchors.setId === 'helipad_roof') {
        this.cutsceneSets.helicopterMainRotor.rotation.y += dt * 26;
        this.cutsceneSets.helicopterTailRotor.rotation.x += dt * 32;
        const blink = Math.sin(this.totalTimeSec * 10) > 0;
        (this.cutsceneSets.strobeRed.material as THREE.MeshStandardMaterial).emissiveIntensity = blink ? 4.5 : 0.3;
        (this.cutsceneSets.strobeBlue.material as THREE.MeshStandardMaterial).emissiveIntensity = blink ? 0.3 : 4.5;
        // Smooth dramatic helicopter takeoff on the final beat!
        const liftT = Math.max(0, (totalProgress - 0.72) / 0.28);
        const smoothLift = liftT * liftT * (3 - 2 * liftT);
        this.cutsceneSets.helicopterGroup.position.set(180, 6.0 + smoothLift * 5.2, 12.2 - smoothLift * 3.5);
        this.cutsceneSets.helicopterGroup.rotation.x = -smoothLift * 0.12;
      }
    }

    this.cutsceneStepElapsed += dt;
    if (this.cutsceneStepElapsed >= step.autoAdvanceSec) {
      this.advanceCutscene();
    }
    this.updateFloorVisibility(anchors.floor, false);
  }

  private tickJumpscare(dt: number): void {
    this.jumpscareTimer += dt;
    this.heldItemRig.root.visible = false;

    if (this.diddyRig) {
      updateDiddyRigAnimation(this.diddyRig, 'jumpscare', dt);
      const shakeAmt = 0.08 * (1 - this.jumpscareTimer / this.jumpscareDuration);
      const targetX = this.diddyRig.root.position.x;
      const targetY = this.diddyRig.root.position.y + 1.82;
      const targetZ = this.diddyRig.root.position.z;

      this.camera.position.set(
        this.px + (Math.random() - 0.5) * shakeAmt,
        this.py + 1.62 + (Math.random() - 0.5) * shakeAmt,
        this.pz + (Math.random() - 0.5) * shakeAmt
      );
      this.camera.lookAt(targetX, targetY, targetZ);
      this.camera.fov = 58 + Math.sin(this.jumpscareTimer * 40) * 4;
      this.camera.updateProjectionMatrix();

      this.jumpscareLight.position.set(
        (this.camera.position.x + targetX) * 0.5,
        targetY,
        (this.camera.position.z + targetZ) * 0.5
      );
      this.jumpscareLight.intensity = 4.2 + Math.sin(this.jumpscareTimer * 55) * 2.5;
    }

    if (this.jumpscareTimer >= this.jumpscareDuration) {
      this.jumpscareLight.visible = false;
      this.finalizeEnding('bad');
    }
  }

  private pollGamepad(dt: number): { moveX: number; moveY: number; sprint: boolean } {
    this.gamepadHoldBreathHeld = false;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return { moveX: 0, moveY: 0, sprint: false };
    }
    const pads = navigator.getGamepads();
    const gp = pads ? Array.from(pads).find((p) => p && p.connected) : null;
    this.gamepadConnected = Boolean(gp);
    if (!gp) {
      this.prevGamepadState = null;
      return { moveX: 0, moveY: 0, sprint: false };
    }

    const dzLeft = this.settings.controls.gamepadDeadzone ?? 0.14;
    const dzRight = this.settings.controls.gamepadDeadzoneRight ?? dzLeft;
    const state = normalizeGamepadState(gp, dzLeft, this.settings.controls.gamepadProfile ?? 'auto', dzRight);
    if (state.anyActive) {
      if (this.inputController.onGamepadInput(gp.id)) {
        this.isMobileTouch = false;
        this.emitHud();
      }
    }

    const prev = this.prevGamepadState;
    const edge = (curr: boolean, prevVal: boolean | undefined) => curr && !prevVal;

    // Allow L1/R1 camera switching & L2/R2 Left/Right Blast Doors while CCTV monitor is open!
    if (this.cctvOpen) {
      if (edge(state.l1, prev?.l1)) {
        this.selectCctvCamera(
          (this.cctvActiveCamIndex - 1 + this.layout.bunkerCameras.length) % this.layout.bunkerCameras.length
        );
      }
      if (edge(state.r1, prev?.r1)) {
        this.selectCctvCamera((this.cctvActiveCamIndex + 1) % this.layout.bunkerCameras.length);
      }
      if (edge(state.l2, prev?.l2)) {
        this.toggleBunkerDoor('left');
      }
      if (edge(state.r2, prev?.r2)) {
        this.toggleBunkerDoor('right');
      }
      if (edge(state.circle, prev?.circle) || edge(state.options, prev?.options)) {
        this.closeCctvMonitor();
      }
      this.prevGamepadState = state;
      return { moveX: 0, moveY: 0, sprint: false };
    }

    if (this.hasActiveModal()) {
      this.prevGamepadState = state;
      return { moveX: 0, moveY: 0, sprint: false };
    }

    // Hold-Breath input when inspecting hiding spot: Cross / A or R2 / RT
    if (this.holdBreath.isActive()) {
      this.gamepadHoldBreathHeld = state.cross || state.r2;
    }

    if (Math.abs(state.lookX) > 0.001 || Math.abs(state.lookY) > 0.001) {
      const crouchMult = this.crouching
        ? Math.max(0.3, Math.min(1.0, this.settings.controls.crouchSensitivityMult ?? 0.7))
        : 1.0;
      const lookSpeedBase =
        2.85 * (this.settings.controls.gamepadSensitivity ?? this.settings.controls.lookSensitivity) * crouchMult;
      const lookSpeedX = lookSpeedBase * (this.settings.controls.lookSensitivityX ?? 1.0);
      const lookSpeedY = lookSpeedBase * (this.settings.controls.lookSensitivityY ?? 1.0);
      const invertSign = this.settings.controls.invertY ? -1 : 1;
      const dYaw = state.lookX * lookSpeedX * dt;
      const dPitch = state.lookY * lookSpeedY * 0.8 * dt * invertSign;
      this.targetYaw -= dYaw;
      this.targetPitch = Math.max(-1.25, Math.min(1.25, this.targetPitch - dPitch));
      if ((this.settings.controls.cameraSmoothing ?? 0) <= 0.01) {
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
      }
      this.handPosSpring.impulse(-dYaw * 0.22, dPitch * 0.18, 0);
      this.handRotSpring.impulse(dPitch * 0.55, -dYaw * 0.65, -dYaw * 0.25);
      if (this.hidingSpot) this.clampHidingLook();
    }

    // Full DS4 / Xbox Playable Mapping:
    // Cross/A = Interact (or Hold-Breath while hiding)
    if (edge(state.cross, prev?.cross) && !this.holdBreath.isActive()) {
      this.triggerInteract();
    }
    // Circle/B or R3 = Toggle Crouch
    if (edge(state.circle, prev?.circle) || edge(state.r3, prev?.r3)) {
      this.toggleCrouch();
    }
    // Square/X = Hold 0.45s to Drop Active Item; quick tap = Interact
    if (state.square) {
      this.squareHoldTimer += dt;
      if (this.squareHoldTimer >= 0.45 && !this.squareDropTriggered) {
        this.squareDropTriggered = true;
        this.dropInventoryItem();
      }
    } else {
      if (prev?.square && !this.squareDropTriggered && !this.holdBreath.isActive()) {
        this.triggerInteract();
      }
      this.squareHoldTimer = 0;
      this.squareDropTriggered = false;
    }
    // Triangle/Y = Toggle Flashlight
    if (edge(state.triangle, prev?.triangle)) {
      this.toggleFlashlight();
    }
    // R2/RT = Contextual Use (UV / Taser / Flare / Can)
    if (edge(state.r2, prev?.r2) && !this.holdBreath.isActive()) {
      this.triggerContextualUse();
    }
    // D-Pad Left/Right & L1/R1 = Hotbar Cycle
    if (edge(state.dpadLeft, prev?.dpadLeft) || edge(state.l1, prev?.l1)) {
      this.selectHotbarSlot((this.activeSlot + 5) % 6);
    }
    if (edge(state.dpadRight, prev?.dpadRight) || edge(state.r1, prev?.r1)) {
      this.selectHotbarSlot((this.activeSlot + 1) % 6);
    }
    // D-Pad Up = Journal, D-Pad Down = Backpack, Touchpad/Share/View = Minimap
    if (edge(state.dpadUp, prev?.dpadUp)) {
      this.callbacks.onToggleJournal?.();
    }
    if (edge(state.dpadDown, prev?.dpadDown)) {
      this.callbacks.onToggleBackpack?.();
    }
    if (edge(state.shareOrTouch, prev?.shareOrTouch)) {
      this.callbacks.onToggleMap?.();
    }
    // Options/Start = Pause
    if (edge(state.options, prev?.options)) {
      this.pauseGame();
    }

    const sprint = state.l2 || state.l3;
    this.prevGamepadState = state;
    return { moveX: state.moveX, moveY: state.moveY, sprint };
  }

  private tickGameplay(dt: number): void {
    if (!this.hasActiveModal()) {
      this.elapsedSec += dt;
      if (this.authoritativeServer) {
        this.authoritativeServer.advance(dt, performance.now());
      }
    }
    this.adrenalineBurstTimer = Math.max(0, this.adrenalineBurstTimer - dt);
    const diffCfg = getDifficultyConfig(this.difficulty);
    this.heldItemRig.root.visible = !this.hidingSpot && !this.cctvOpen;
    if (this.survivorRig) this.survivorRig.visible = false;
    if (this.cutsceneSurvivorRig) this.cutsceneSurvivorRig.root.visible = false;
    if (this.cutsceneSets) {
      this.cutsceneSets.sets.gate_road.visible = false;
      this.cutsceneSets.sets.basement_tunnel.visible = false;
      this.cutsceneSets.sets.helipad_roof.visible = false;
      this.cutsceneSets.sets.containment_cell.visible = false;
    }

    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitleText = null;
    }
    this.drizzyGrowlCooldown = Math.max(0, this.drizzyGrowlCooldown - dt);
    this.flickerBuzzCooldown = Math.max(0, this.flickerBuzzCooldown - dt);

    // Physical Item Grab Animation update (smooth curve into right hand, zero teleport!)
    for (let i = this.activeGrabAnims.length - 1; i >= 0; i--) {
      const ga = this.activeGrabAnims[i];
      ga.t += dt;
      const p = Math.min(1, ga.t / ga.dur);
      const ease = 1 - Math.pow(1 - p, 3);
      const handTarget = this.scratchVecA.set(0.24, -0.22, -0.42).applyMatrix4(this.camera.matrixWorld);
      ga.mesh.position.lerpVectors(ga.startPos, handTarget, ease);
      ga.mesh.position.y += Math.sin(p * Math.PI) * 0.14;
      ga.mesh.rotation.y += dt * 7.5;
      const sc = 1 - ease * 0.55;
      ga.mesh.scale.copy(ga.startScale).multiplyScalar(sc);
      if (p >= 1) {
        finalizeCollectedItemMesh(ga.mesh);
        ga.mesh.scale.copy(ga.startScale);
        this.activeGrabAnims.splice(i, 1);
      }
    }

    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.hitBoostTimer = Math.max(0, this.hitBoostTimer - dt);
    this.equipAnim = Math.max(0, this.equipAnim - dt * 4.2);
    if (this.actionAnimT > 0) {
      this.actionAnimT = Math.max(0, this.actionAnimT - dt * 3.8);
      if (this.actionAnimT <= 0) this.actionAnimType = 'none';
    }
    this.lookSwayX *= Math.exp(-9 * dt);
    this.lookSwayY *= Math.exp(-9 * dt);
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    this.noiseLevel = Math.max(0, this.noiseLevel - dt * 0.65);
    this.ventWarnCooldown = Math.max(0, this.ventWarnCooldown - dt);
    this.stunFlashTimer = Math.max(0, this.stunFlashTimer - dt);
    if (this.blackoutAlertTimer > 0) {
      this.blackoutAlertTimer = Math.max(0, this.blackoutAlertTimer - dt);
    }

    // Recharge station cooldown ticks
    for (const st of this.layout.rechargeStations) {
      if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
      const vis = this.rechargeVisuals.get(st.id);
      if (vis) {
        const ready = st.cooldown <= 0;
        vis.statusMat.color.setHex(ready ? 0x22c55e : 0xf59e0b);
        vis.statusMat.emissive.setHex(ready ? 0x16a34a : 0xb45309);
      }
    }

    // Cabine 09-A Security Power Drain & Auto-Open at 0%
    const leftDoor = this.layout.doors.find((d) => d.id === 'door_bunker_left');
    const rightDoor = this.layout.doors.find((d) => d.id === 'door_bunker_right');
    const closedCount = (leftDoor && !leftDoor.isOpen ? 1 : 0) + (rightDoor && !rightDoor.isOpen ? 1 : 0);
    const bunkerDrainMult = this.hasPerk('fast_hacker') ? 0.85 : 1.0;
    const drainRate = ((this.cctvOpen ? 1.5 : 0) + closedCount * 3.2) * bunkerDrainMult;
    if (drainRate > 0) {
      this.securityPowerPct = Math.max(0, this.securityPowerPct - drainRate * dt);
      if (this.securityPowerPct <= 0) {
        if (leftDoor && !leftDoor.isOpen) leftDoor.isOpen = true;
        if (rightDoor && !rightDoor.isOpen) rightDoor.isOpen = true;
        this.cctvOpen = false;
        this.audio.playBlackoutPowerDown();
        this.updateBunkerVisualIndicators();
        this.showBanner('ENERGIA DA SEGURANÇA ESGOTADA! Portas blindadas abriram!');
      }
    } else if (!this.blackoutActive && this.securityPowerPct < 100) {
      this.securityPowerPct = Math.min(100, this.securityPowerPct + 0.85 * dt);
    }

    // Native Gamepad Polling
    const gpInput = this.pollGamepad(dt);

    // Camera smoothing (live setting: 0 = crisp raw input, up to 0.85 = silky cinematic weight)
    const camSmooth = Math.max(0, Math.min(0.85, this.settings.controls.cameraSmoothing ?? 0.12));
    if (camSmooth > 0.01) {
      const smoothLambda = 36 * (1 - camSmooth * 0.82);
      const alpha = 1 - Math.exp(-smoothLambda * dt);
      this.yaw += (this.targetYaw - this.yaw) * alpha;
      this.pitch += (this.targetPitch - this.pitch) * alpha;
    }

    // 1. Player Movement (with Crouch-Only Vent Traversal & Custom Keybinds!)
    const kb = this.settings.controls.keybinds;
    const kFwd = kb?.moveForward ?? 'KeyW';
    const kBack = kb?.moveBack ?? 'KeyS';
    const kLeft = kb?.moveLeft ?? 'KeyA';
    const kRight = kb?.moveRight ?? 'KeyD';
    const kSprint = kb?.sprint ?? 'ShiftLeft';
    const kCrouch = kb?.crouch ?? 'KeyC';

    let moveForward = 0;
    let moveRight = 0;
    if (!this.hidingSpot && !this.hasActiveModal()) {
      if (this.keysPressed.has(kFwd) || this.keysPressed.has('ArrowUp')) moveForward += 1;
      if (this.keysPressed.has(kBack) || this.keysPressed.has('ArrowDown')) moveForward -= 1;
      if (this.keysPressed.has(kRight) || this.keysPressed.has('ArrowRight')) moveRight += 1;
      if (this.keysPressed.has(kLeft) || this.keysPressed.has('ArrowLeft')) moveRight -= 1;

      if (Math.abs(this.mobileMoveX) > 0.05 || Math.abs(this.mobileMoveY) > 0.05) {
        moveRight += this.mobileMoveX;
        moveForward += -this.mobileMoveY;
      }
      if (Math.abs(gpInput.moveX) > 0.05 || Math.abs(gpInput.moveY) > 0.05) {
        moveRight += gpInput.moveX;
        moveForward += -gpInput.moveY;
      }

      // Hold-to-crouch mode sync (only when not forced inside low vent)
      if (this.settings.gameplay.crouchMode === 'hold') {
        const crouchHeld = this.keysPressed.has(kCrouch) || this.keysPressed.has('ControlLeft');
        if (crouchHeld && !this.crouching) {
          this.crouching = true;
          this.landingDipSpring.impulse(-0.65);
        } else if (!crouchHeld && this.crouching && !this.inVent) {
          this.crouching = false;
        }
      }
    }

    const inputMag = Math.hypot(moveForward, moveRight);
    if (inputMag > 1) {
      moveForward /= inputMag;
      moveRight /= inputMag;
    }

    const sprintKeyActive =
      this.settings.gameplay.sprintMode === 'toggle'
        ? this.sprintToggleActive
        : this.keysPressed.has(kSprint) || this.keysPressed.has('ShiftRight');
    if (inputMag < 0.15) this.sprintToggleActive = false;

    const wantsSprint =
      !this.crouching &&
      !this.hidingSpot &&
      !this.staminaExhausted &&
      inputMag > 0.2 &&
      (sprintKeyActive || this.mobileSprintHeld || gpInput.sprint) &&
      this.stamina > 2;

    this.sprinting = wantsSprint;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - diffCfg.staminaDrainPerSec * dt);
      if (this.stamina <= 0.5) {
        this.staminaExhausted = true;
        this.exhaustedPantCooldown = 0.05;
      }
    } else {
      const staminaRegenMult = this.hasPerk('athlete_lungs') ? 1.15 : 1.0;
      this.stamina = Math.min(100, this.stamina + diffCfg.staminaRegenPerSec * staminaRegenMult * dt);
      if (this.staminaExhausted && this.stamina >= 28) {
        this.staminaExhausted = false;
      }
    }

    if (this.staminaExhausted) {
      this.exhaustedPantCooldown -= dt;
      if (this.exhaustedPantCooldown <= 0) {
        this.audio.playExhaustedPant();
        this.exhaustedPantCooldown = 1.55;
      }
    }

    const hitBoostMult = this.hitBoostTimer > 0 ? 1.35 : 1.0;
    const adrenalineMult = this.adrenalineBurstTimer > 0 ? 1.12 : 1.0;
    const crouchPerkMult = this.crouching && this.hasPerk('steady_hands') ? 1.15 : 1.0;
    const maxSpeed =
      (this.crouching
        ? diffCfg.playerCrouchSpeed * crouchPerkMult
        : this.sprinting
        ? diffCfg.playerSprintSpeed
        : diffCfg.playerWalkSpeed) * hitBoostMult * adrenalineMult;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const wishX = (-sinY * moveForward + cosY * moveRight) * maxSpeed;
    const wishZ = (-cosY * moveForward - sinY * moveRight) * maxSpeed;

    const accelLambda = inputMag > 0.05 ? 14 : 18;
    const blend = 1 - Math.exp(-accelLambda * dt);
    this.vx += (wishX - this.vx) * blend;
    this.vz += (wishZ - this.vz) * blend;

    if (!this.hidingSpot) {
      const prevX = this.px;
      const prevZ = this.pz;
      const resolved = resolveWorldMovement(
        this.layout,
        this.px,
        this.py,
        this.pz,
        this.vx * dt,
        this.vz * dt,
        0.38,
        false,
        this.crouching
      );
      this.px = resolved.x;
      this.py = resolved.y;
      this.pz = resolved.z;
      this.pFloor = resolved.floor;
      this.inVent = isPositionInVent(this.layout, this.px, this.pz, this.pFloor);
      if (this.inVent && !this.wasInVentPrevFrame) {
        this.advanceAndNotifyAchievement('shadow_crawler', 1);
      }
      this.wasInVentPrevFrame = this.inVent;
      // Detect stair step-down velocity for organic spring landing dip
      const dyStep = this.py - this.prevPlayerY;
      if (dyStep < -0.05) {
        this.landingDipSpring.impulse(Math.max(-1.4, dyStep * 6.5));
      }
      this.prevPlayerY = this.py;

      if (resolved.blockedByVentStanding && this.ventWarnCooldown <= 0) {
        this.ventWarnCooldown = 3.0;
        this.showBanner('Duto de ventilação baixo! Agache [C] para entrar (P. Drizzy é largo demais para passar).');
      }

      const movedDist = Math.hypot(this.px - prevX, this.pz - prevZ);
      this.stepDistAccum += movedDist;
      const stride = this.sprinting ? 1.72 : this.crouching ? 1.35 : 1.55;
      if (this.stepDistAccum >= stride) {
        this.stepDistAccum -= stride;
        const surf = this.inVent
          ? 'vent_metal'
          : getSurfaceAt(this.layout, this.px, this.pz, this.pFloor);
        this.audio.playPlayerFootstep(surf, this.sprinting, this.crouching);

        // Living Water Physics: puddle ripples, splash droplets & 8-step soaked wet footprints!
        const waterRes = this.waterManager?.onFootstep(
          this.pFloor,
          this.px,
          this.py,
          this.pz,
          this.yaw,
          this.sprinting,
          true
        );
        if (waterRes?.inWater) {
          this.audio.playWaterSplash(this.sprinting ? 1.0 : this.crouching ? 0.38 : 0.68, this.sprinting);
        }

        const noiseMult =
          (this.hasPerk('silent_steps') ? 0.82 : 1.0) *
          (this.hasPerk('omega_protocol') ? 0.88 : 1.0);
        if (this.inVent && Math.hypot(this.vx, this.vz) > 1.75) {
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, 14 * noiseMult, 2, 'vent_fast');
        } else if (this.sprinting) {
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, (waterRes?.inWater ? 21.5 : 18.5) * noiseMult, 3, 'sprint');
        } else if (!this.crouching) {
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, (waterRes?.inWater ? 9.5 : 6.2) * noiseMult, 1, 'footstep');
        }
      }

      this.fog.revealAround(this.px, this.pz, this.pFloor, 3.6);

      // Granny-style noise props
      for (const np of this.layout.noiseProps) {
        if (np.cooldown > 0) np.cooldown -= dt;
        if (np.floor !== this.pFloor || np.cooldown > 0) continue;
        const d = Math.hypot(np.x - this.px, np.z - this.pz);
        if (d < 0.85 && movedDist > 0.01 && !this.crouching) {
          np.cooldown = 12;
          this.audio.playDroppedObjectCrash(np.kind);
          this.emitNoise(np.x, np.y, np.z, np.floor, 22, 3, 'dropped_object');
          this.showBanner('Você esbarrou em objetos no chão! P. Drizzy ouviu o barulho!');
          const propMesh = this.noisePropMeshes.get(np.id);
          if (propMesh) {
            propMesh.rotation.z = 0.7;
            propMesh.position.y = np.y + 0.05;
          }
        }
      }
    }

    // 1b. Update Thrown Can Projectiles (Distraction Physics!)
    this.tickThrownProjectiles(dt);

    // 2. Flashlight Battery (Normal vs UV 1.45x Drain) & Dynamic UV Mark Illumination!
    if (this.flashlightOn && !this.hidingSpot) {
      const uvMult = this.uvMode ? (this.hasPerk('omega_protocol') ? 1.45 * 0.85 : 1.45) : 1.0;
      this.battery = Math.max(0, this.battery - diffCfg.flashlightDrainPerSec * uvMult * dt);
      if (this.battery <= 0) {
        this.flashlightOn = false;
        this.audio.playFlashlightClick();
        this.showBanner('A bateria da lanterna acabou! Use pilhas ou Estação de Recarga.');
      }
    }

    // Calibrated Modern Physical Flashlight + P. Drizzy EMI Electromagnetic Interference (< 8.5m!)
    const preDiddyDist = diffCfg.diddyActive ? this.ai.getDistanceTo(this.px, this.py, this.pz) : 99;
    const emiProximity =
      diffCfg.diddyActive && this.ai.floor === this.pFloor && preDiddyDist < 8.5
        ? Math.max(0, 1 - preDiddyDist / 8.5)
        : 0;
    this.emiStaticCooldown = Math.max(0, this.emiStaticCooldown - dt);

    let flashIntensity = 0;
    let spillIntensity = 0;
    const activeColorHex =
      this.stunFlashTimer > 0
        ? 0x38bdf8
        : this.uvMode
        ? FLASHLIGHT_CONFIG.uvColor
        : this.flashlightBeamHex;

    if (this.flashlightOn && this.battery > 0) {
      const baseMain = this.uvMode ? FLASHLIGHT_CONFIG.uvIntensity : FLASHLIGHT_CONFIG.intensity;
      const baseSpill = this.uvMode ? FLASHLIGHT_CONFIG.uvSpillIntensity : FLASHLIGHT_CONFIG.spillIntensity;
      let mult = 1.0;
      if (this.battery < 18) {
        const flick = Math.sin(this.totalTimeSec * 38) * Math.sin(this.totalTimeSec * 17);
        mult = flick > 0.3 ? 0.24 : 0.78;
      }
      if (emiProximity > 0.15) {
        const emiWave =
          Math.sin(this.totalTimeSec * 47.0) * Math.sin(this.totalTimeSec * 29.0 + 1.3);
        if (emiWave > 0.64 - emiProximity * 0.25) {
          mult *= Math.max(0.28, 1 - emiProximity * 0.68);
          if (this.emiStaticCooldown <= 0) {
            this.audio.playEmiStaticBurst(emiProximity);
            this.emiStaticCooldown = 1.8 + Math.random() * 2.1;
          }
        }
      }
      flashIntensity = baseMain * mult;
      spillIntensity = baseSpill * mult;
    }

    const isNightmare = this.difficulty === 'nightmare';
    this.flashlight.distance = this.uvMode
      ? FLASHLIGHT_CONFIG.uvDistance
      : isNightmare
      ? 28.0
      : 22.0;
    this.flashlight.angle = this.uvMode
      ? FLASHLIGHT_CONFIG.uvAngle
      : isNightmare
      ? FLASHLIGHT_CONFIG.angle * 1.15
      : FLASHLIGHT_CONFIG.angle;
    this.flashlight.penumbra = this.uvMode ? FLASHLIGHT_CONFIG.uvPenumbra : FLASHLIGHT_CONFIG.penumbra;
    this.flashlight.decay = FLASHLIGHT_CONFIG.decay;
    this.flashlight.intensity = this.stunFlashTimer > 0 ? 24.0 : isNightmare ? flashIntensity * 1.2 : flashIntensity;
    this.flashlight.color.setHex(activeColorHex);

    this.flashlightSpill.distance = this.uvMode
      ? FLASHLIGHT_CONFIG.uvSpillDistance
      : isNightmare
      ? 10.5
      : FLASHLIGHT_CONFIG.spillDistance;
    this.flashlightSpill.angle = FLASHLIGHT_CONFIG.spillAngle;
    this.flashlightSpill.penumbra = FLASHLIGHT_CONFIG.spillPenumbra;
    this.flashlightSpill.intensity = this.stunFlashTimer > 0 ? 5.5 : isNightmare ? spillIntensity * 1.25 : spillIntensity;
    this.flashlightSpill.color.setHex(activeColorHex);

    // Reveal fluorescent UV marks dynamically under UV beam & auto-save after ~0.8s continuous illumination!
    const camFwdX = -Math.sin(this.yaw);
    const camFwdZ = -Math.cos(this.yaw);
    for (const mark of this.layout.uvMarks) {
      const vis = this.uvMarkVisuals.get(mark.id);
      if (!vis) continue;
      let targetOpacity = 0.03;
      let illuminated = false;
      if (this.flashlightOn && this.uvMode && mark.floor === this.pFloor) {
        const dx = mark.x - this.px;
        const dz = mark.z - this.pz;
        const dist = Math.hypot(dx, dz);
        const dot = dist > 0.01 ? (dx * camFwdX + dz * camFwdZ) / dist : 1;
        if (dist < 10.5 && dot > 0.62) {
          targetOpacity = Math.max(0.28, Math.min(0.98, 1.15 - dist / 11));
          if (dist < 5.8 && dot > 0.68 && !mark.discovered) {
            illuminated = true;
            const accum = (this.uvScanTimers.get(mark.id) ?? 0) + dt;
            this.uvScanTimers.set(mark.id, accum);
            if (accum >= 0.8) {
              mark.discovered = true;
              this.uvScanTimers.delete(mark.id);
              this.audio.playJournalClueSaved();
              this.showBanner(`Luz UV registrou: ${mark.title} (${mark.symbolChar}) — Salvo no Diário!`);
            }
          }
        }
      }
      if (!illuminated && this.uvScanTimers.has(mark.id)) {
        const decayed = Math.max(0, (this.uvScanTimers.get(mark.id) ?? 0) - dt * 1.4);
        if (decayed <= 0) this.uvScanTimers.delete(mark.id);
        else this.uvScanTimers.set(mark.id, decayed);
      }
      vis.mat.opacity += (targetOpacity - vis.mat.opacity) * Math.min(1, dt * 8);
    }

    // Update curved parabolic aim trajectory arc when holding Flare or Throwable Can
    this.updateFlareTrajectoryArc();

    // 3. Camera Rig (with smooth stair step-smoothing!)
    const speedHoriz = Math.hypot(this.vx, this.vz);
    this.smoothedPlayerY += (this.py - this.smoothedPlayerY) * (1 - Math.exp(-16 * dt));
    if (!this.hidingSpot) {
      const targetEyeH = this.inVent ? 0.86 : this.crouching ? 1.05 : 1.62;
      this.currentEyeHeight += (targetEyeH - this.currentEyeHeight) * (1 - Math.exp(-10 * dt));

      if (speedHoriz > 0.2) {
        this.headbobPhase += dt * (this.sprinting ? 12.5 : this.crouching ? 5.5 : 8.2);
      }
      const bobScale = this.settings.gameplay.headBobIntensity ?? 1.0;
      const bobAmp =
        speedHoriz > 0.2
          ? (this.sprinting ? 0.062 : this.crouching ? 0.018 : 0.036) * bobScale
          : 0;
      const bobY = Math.sin(this.headbobPhase) * bobAmp;
      const bobX = Math.cos(this.headbobPhase * 0.5) * bobAmp * 0.45;
      const landDip = this.landingDipSpring.step(0, dt) * 0.09;

      const shake = this.trauma * this.trauma * 0.06 * Math.max(0.25, bobScale);
      this.camera.position.set(
        this.px + bobX + (Math.random() - 0.5) * shake,
        this.smoothedPlayerY + this.currentEyeHeight + bobY + landDip + (Math.random() - 0.5) * shake,
        this.pz + (Math.random() - 0.5) * shake
      );

      const targetRoll = -moveRight * 0.022 * bobScale;
      this.currentStrafeRoll += (targetRoll - this.currentStrafeRoll) * (1 - Math.exp(-10 * dt));

      const targetFov = this.settings.video.fov + (this.sprinting ? 6.5 : 0);
      this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-9 * dt));
      if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
      }

      // 2nd-Order Spring-Damper 1st-Person Viewmodel Physics (inertia lag, figure-8 gait, landing dip, adrenaline micro-tremor & tool impulses!)
      const equipDip = this.equipAnim * this.equipAnim * 0.16;
      const crouchTuckY = this.crouching ? -0.025 : 0;
      const idleBreath = Math.sin(this.totalTimeSec * 2.1) * 0.0045;
      const moveWeight = Math.min(1, speedHoriz / 4.2);
      const fig8X = Math.cos(this.headbobPhase * 0.5) * (this.sprinting ? 0.022 : 0.013) * moveWeight * bobScale;
      const fig8Y = Math.abs(Math.sin(this.headbobPhase * 0.5)) * (this.sprinting ? -0.02 : -0.011) * moveWeight * bobScale;

      // Adrenaline proximity micro-tremor when P. Drizzy is stalking close
      const adrenalineAmp = preDiddyDist < 10 ? (1 - preDiddyDist / 10) * 0.0024 : 0;
      const tremorX = adrenalineAmp > 0 ? Math.sin(this.totalTimeSec * 33.0) * adrenalineAmp : 0;
      const tremorY = adrenalineAmp > 0 ? Math.cos(this.totalTimeSec * 41.0) * adrenalineAmp : 0;

      const spPos = this.handPosSpring.step(
        fig8X + this.lookSwayX * 0.55 + tremorX,
        fig8Y + idleBreath + crouchTuckY - equipDip + this.lookSwayY * 0.55 + landDip * 0.45 + tremorY,
        this.sprinting ? 0.025 : 0,
        dt
      );
      const spRot = this.handRotSpring.step(
        this.sprinting ? -0.14 : 0,
        this.sprinting ? 0.16 : 0,
        -moveRight * 0.055,
        dt
      );

      this.heldItemRig.root.position.set(0.31 + spPos.x, -0.26 + spPos.y, -0.5 + spPos.z);

      // Per-tool dynamic use motion layered over spring-damper pose
      let animRx = spRot.x;
      let animRy = spRot.y;
      let animRz = spRot.z;
      let animDz = 0;
      const s = Math.sin(this.actionAnimT * Math.PI);
      if (this.actionAnimType === 'key_turn') {
        animDz = -0.1 * s;
        animRz += s * 1.15;
      } else if (this.actionAnimType === 'crowbar_swing') {
        animRx -= s * 0.85;
        animRy += s * 0.35;
        animDz = -0.09 * s;
      } else if (this.actionAnimType === 'wire_snip') {
        animDz = -0.08 * s;
        animRx -= s * 0.35;
        animRz -= s * 0.3;
      } else if (this.actionAnimType === 'stun_recoil') {
        animRx += s * 0.42;
        animDz = 0.09 * s;
      } else if (this.actionAnimType === 'throw_toss') {
        animRx -= s * 0.65;
        animDz = -0.12 * s;
      } else if (this.actionAnimType === 'flashlight_click') {
        animRx += s * 0.14;
        animDz = -0.025 * s;
      } else if (this.actionAnimType === 'grab_reach') {
        animDz = -0.14 * s;
        animRx -= s * 0.22;
        animRy -= s * 0.18;
      }
      this.heldItemRig.handGroup.position.set(0, 0, animDz);
      this.heldItemRig.handGroup.rotation.set(animRx - equipDip * 1.4, animRy, animRz);
    } else {
      this.hidingTransition = Math.min(1, this.hidingTransition + dt * 3.4);
      const ease = 1 - Math.pow(1 - this.hidingTransition, 3);
      const targetH = this.hidingSpot.kind === 'locker' ? 1.48 : 0.42;
      this.camera.position.set(
        this.preHidePos.x + (this.hidingSpot.x - this.preHidePos.x) * ease,
        this.preHidePos.y + 1.5 + (this.hidingSpot.y + targetH - (this.preHidePos.y + 1.5)) * ease,
        this.preHidePos.z + (this.hidingSpot.z - this.preHidePos.z) * ease
      );
      this.currentStrafeRoll = 0;
    }

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, this.currentStrafeRoll);

    // Sync world-space Flashlight + Spill + Scene Target + Water Reflection Uniforms right after camera finalization!
    const waterFlashPower =
      this.flashlight.intensity > 0.1
        ? Math.min(1.6, this.flashlight.intensity / FLASHLIGHT_CONFIG.intensity)
        : 0;
    this.syncFlashlightWorldPose(waterFlashPower, this.flashlight.color.getHex());

    // 4. Authoritative P. Drizzy AI:
    // - On Host / Solo: executes full organic AI (Context Steering + 210ms Reaction Delay + LKP Search)
    // - On Remote Client (`isRemoteClient === true`): COMPLETELY DISABLES local AI execution and smoothly
    //   interpolates the single authoritative P. Drizzy replicated from the Host GameServer!
    let aiEvents: ReturnType<DiddyAiController['tick']>;
    if (this.isRemoteClient) {
      const prevDx = this.ai.x;
      const prevDz = this.ai.z;
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const sampled = this.remoteDiddyInterp.sample(nowMs);
      if (sampled) {
        this.ai.x = sampled.x;
        this.ai.y = sampled.y;
        this.ai.z = sampled.z;
        this.ai.yaw = sampled.yaw;
        this.ai.floor = sampled.floor;
        this.ai.state = sampled.state;
        this.ai.animState =
          sampled.state === 'stunned'
            ? 'stunned'
            : sampled.actualSpeed > 2.6
            ? 'chase'
            : sampled.actualSpeed > 0.12
            ? 'patrol'
            : 'idle';
      } else if (this.remoteDiddyTarget.initialized) {
        const kD = Math.min(1, dt * 14);
        this.ai.x += (this.remoteDiddyTarget.x - this.ai.x) * kD;
        this.ai.y += (this.remoteDiddyTarget.y - this.ai.y) * kD;
        this.ai.z += (this.remoteDiddyTarget.z - this.ai.z) * kD;
        let dyaw = this.remoteDiddyTarget.yaw - this.ai.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        this.ai.yaw += dyaw * kD;
        this.ai.floor = this.remoteDiddyTarget.floor;
        this.ai.state = this.remoteDiddyTarget.state;
      }
      const moved = Math.hypot(this.ai.x - prevDx, this.ai.z - prevDz);
      const remoteHit =
        diffCfg.diddyActive &&
        !this.hidingSpot &&
        !this.inVent &&
        this.invulnerableTimer <= 0 &&
        this.ai.state !== 'stunned' &&
        this.ai.floor === this.pFloor &&
        Math.hypot(this.px - this.ai.x, this.pz - this.ai.z) < 1.05;
      aiEvents = {
        footstepTriggered: moved > 0.045 && Math.floor(this.elapsedSec * 3.5) !== Math.floor((this.elapsedSec - dt) * 3.5),
        breachedDoor: null,
        spottedPlayer: false,
        hitPlayer: remoteHit,
        pulledFromHidingSpot: null,
        inspectingHidingSpot: null,
      };
      this.enteredHidingThisFrame = false;
      this.noiseQueue.length = 0;
    } else {
      aiEvents = this.ai.tick({
        dt,
        elapsedSec: this.elapsedSec,
        layout: this.layout,
        diff: diffCfg,
        playerX: this.px,
        playerY: this.py,
        playerZ: this.pz,
        playerFloor: this.pFloor,
        playerCrouching: this.crouching,
        playerInVent: this.inVent,
        playerFlashlightOn: this.flashlightOn,
        playerHidingSpot: this.hidingSpot,
        playerEnteredHidingThisFrame: this.enteredHidingThisFrame,
        playerInvulnerable: this.invulnerableTimer > 0,
        blackoutAlertActive: this.blackoutAlertTimer > 0,
        noiseEvents: this.noiseQueue,
      });
      this.enteredHidingThisFrame = false;
      this.noiseQueue.length = 0;
    }

    const drizzyOccludeHz = this.computeDrizzySoundOcclusionHz();

    if (aiEvents.spottedPlayer) {
      this.audio.playSpottedSting();
      this.audio.playDrizzyGrowl3D(this.ai.x, this.ai.y, this.ai.z, this.ai.floor === this.pFloor, 1.0, drizzyOccludeHz);
      this.drizzyGrowlCooldown = 5.5;
      this.showBanner('P. DRIZZY VIU VOCÊ! Corra, entre num duto [C] ou use a Arma de Stun!');
    }
    if (aiEvents.breachedDoor) {
      this.audio.playDoorCreak(aiEvents.breachedDoor.lockType === 'basement_key');
    }
    if (aiEvents.footstepTriggered) {
      this.audio.playDiddyFootstep3D(
        this.ai.x,
        this.ai.y,
        this.ai.z,
        this.ai.floor === this.pFloor,
        this.ai.state === 'chase',
        drizzyOccludeHz
      );
      const stepDist = this.ai.getDistanceTo(this.px, this.py, this.pz);
      // Living Water splashes & oily Compound 09 footprints when P. Drizzy stomps through puddles or wet basement!
      const dWater = this.waterManager?.onFootstep(
        this.ai.floor,
        this.ai.x,
        this.ai.y,
        this.ai.z,
        this.ai.yaw,
        this.ai.state === 'chase',
        false
      );
      if (dWater?.inWater || this.ai.floor === -1) {
        this.drizzyOilyStepsLeft = Math.max(this.drizzyOilyStepsLeft, dWater?.inWater ? 6 : 3);
      }
      if (this.drizzyOilyStepsLeft > 0) {
        this.drizzyOilyStepsLeft--;
        this.stampDrizzyOilyFootprint(this.ai.x, this.ai.y, this.ai.z, this.ai.yaw);
      }
      if (dWater?.inWater && this.ai.floor === this.pFloor && stepDist < 16) {
        const atten = Math.max(0.25, 1 - stepDist / 16);
        this.audio.playWaterSplash(0.88 * atten, this.ai.state === 'chase');
      }
      // Heavy camera proximity micro-tremor + falling ceiling dust flakes when P. Drizzy stomps nearby!
      if (this.ai.floor === this.pFloor && stepDist < 11) {
        const stompShake = (1 - stepDist / 11) * (this.ai.state === 'chase' ? 0.24 : 0.12);
        this.trauma = Math.min(1, Math.max(this.trauma, stompShake));
        if (stepDist < 9.5) {
          this.audio.playCeilingDustRumble(stepDist);
          const ceilY = this.pFloor === 0 ? FLOOR_0_Y + GROUND_CEILING_H - 0.12 : FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.12;
          this.spawnBurstParticles(
            this.scratchVecC.set(this.px + (Math.random() - 0.5) * 1.6, ceilY, this.pz + (Math.random() - 0.5) * 1.6),
            0x94a3b8,
            4,
            0.036,
            0.45,
            2.2
          );
        }
      }
    }
    if (
      diffCfg.diddyActive &&
      this.drizzyGrowlCooldown <= 0 &&
      (this.ai.state === 'chase' || this.ai.state === 'investigate') &&
      this.ai.getDistanceTo(this.px, this.py, this.pz) < 16
    ) {
      this.audio.playDrizzyGrowl3D(
        this.ai.x,
        this.ai.y,
        this.ai.z,
        this.ai.floor === this.pFloor,
        this.ai.state === 'chase' ? 0.95 : 0.65,
        drizzyOccludeHz
      );
      this.drizzyGrowlCooldown = this.ai.state === 'chase' ? 4.8 : 7.5;
    }

    // Distant organic horror ambiance events (pipe steam hiss / wind door creak) while exploring quietly
    if (this.ai.state !== 'chase' && !this.holdBreath.isActive()) {
      this.distantAmbientTimer -= dt;
      if (this.distantAmbientTimer <= 0) {
        this.distantAmbientTimer = 24 + Math.random() * 16;
        const pan = (Math.random() * 1.6 - 0.8);
        if (this.pFloor === -1) this.audio.playDistantPipeSteam(pan);
        else this.audio.playDistantWindDoorCreak(pan);
      }
    }

    // Track detections whenever P. Drizzy transitions into active chase
    const isChasingNow = diffCfg.diddyActive && this.ai.state === 'chase';
    if (isChasingNow && !this.wasChasedPrevFrame) {
      this.runDetections += 1;
    }
    this.wasChasedPrevFrame = isChasingNow;

    // Unseen hiding inspection -> Launch interactive Hold-Breath Minigame instead of unfair auto-hitkill!
    const ironLungs = this.hasPerk('iron_lungs');
    if (aiEvents.inspectingHidingSpot && !this.holdBreath.isActive()) {
      this.holdBreath.start(aiEvents.inspectingHidingSpot.id, this.settings.gameplay.holdBreathAssist, 4.8, ironLungs);
      this.audio.playDrizzyGrowl3D(this.ai.x, this.ai.y, this.ai.z, true, 0.92);
      this.showBanner('P. DRIZZY ESTÁ NA PORTA! SEGURE PARA PRENDER A RESPIRAÇÃO!');
      this.emitHud();
    }

    // Step Hold-Breath Minigame while P. Drizzy listens outside hiding spot
    if (this.holdBreath.isActive()) {
      const holdingBreath =
        this.keysPressed.has('Space') || this.mobileHoldBreathHeld || this.gamepadHoldBreathHeld;
      const hb = this.holdBreath.step(dt, holdingBreath, this.settings.gameplay.holdBreathAssist, ironLungs);
      if (hb.breathPulse) {
        this.audio.playHoldBreathCycle(holdingBreath);
      }
      if (hb.outcome === 'survived') {
        this.ai.resolveHidingInspection(true, this.layout);
        this.runHoldBreathSurvived += 1;
        this.advanceAndNotifyAchievement('breath_of_steel', 1);
        this.showBanner('Você controlou a respiração! P. Drizzy desistiu e foi embora.');
        this.emitHud();
      } else if (hb.outcome === 'caught') {
        this.ai.resolveHidingInspection(false, this.layout);
        this.showBanner('Você perdeu o fôlego! P. Drizzy arrancou a porta!');
        this.triggerJumpscare();
        return;
      }
    }

    if (aiEvents.pulledFromHidingSpot) {
      this.holdBreath.cancel();
      this.showBanner('Ele viu você entrar no esconderijo!');
      this.triggerJumpscare();
      return;
    }

    if (aiEvents.hitPlayer && this.invulnerableTimer <= 0) {
      const isMultiplayerActive = this.isRemoteClient || this.remotePeerRigs.size > 0;
      this.health -= 1;
      this.damageFlash = 1.0;
      this.trauma = 0.9;
      this.triggerHaptic(110, 0.75);
      if (this.health <= 0) {
        if (isMultiplayerActive) {
          // NEVER trigger solo Game Over in Multiplayer! Enter DOWNED (35s crawl + bleedout) -> DEAD_SPECTATING
          this.health = 0;
          this.playerLifeState = 'DOWNED';
          this.bleedoutSec = 35.0;
          this.crouching = true;
          this.sprinting = false;
          this.invulnerableTimer = 3.0;
          this.audio.playJumpscareImpact();
          this.showBanner('VOCÊ CAIU! Engatinhe até um aliado para ser reanimado (35s)!');
          this.emitHud();
        } else {
          this.triggerJumpscare();
          return;
        }
      } else {
        this.invulnerableTimer = 2.6;
        this.hitBoostTimer = 1.8;
        this.stamina = Math.min(100, this.stamina + 45);
        this.audio.playJumpscareImpact();
        this.ai.stun(2.4);

        const awayX = this.px - this.ai.x;
        const awayZ = this.pz - this.ai.z;
        const awayLen = Math.hypot(awayX, awayZ) || 1;
        const push = resolveWorldMovement(
          this.layout,
          this.px,
          this.py,
          this.pz,
          (awayX / awayLen) * 0.9,
          (awayZ / awayLen) * 0.9,
          0.38,
          false,
          this.crouching
        );
        this.px = push.x;
        this.py = push.y;
        this.pz = push.z;
        this.pFloor = push.floor;

        this.showBanner(`Você foi atingido! (${this.health}/${this.maxHealth} vida) — Impulso de fuga ativado!`);
      }
    }

    if (this.diddyRig) {
      this.diddyRig.root.visible = diffCfg.diddyActive;
      if (diffCfg.diddyActive) {
        this.diddyRig.root.position.set(this.ai.x, this.ai.y, this.ai.z);
        this.diddyRig.root.rotation.y = this.ai.yaw;
        updateDiddyRigAnimation(this.diddyRig, this.ai.animState, dt);
        // Smooth organic head/neck tracking toward player when chasing or investigating
        let targetNeckYaw = 0;
        if (
          this.ai.floor === this.pFloor &&
          (this.ai.state === 'chase' || this.ai.state === 'investigate')
        ) {
          const toPlayerYaw = Math.atan2(this.px - this.ai.x, this.pz - this.ai.z);
          let rel = toPlayerYaw - this.ai.yaw;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          targetNeckYaw = Math.max(-0.55, Math.min(0.55, rel));
        }
        this.diddyRig.neck.rotation.y += (targetNeckYaw - this.diddyRig.neck.rotation.y) * Math.min(1, dt * 6.5);
        if (this.stunSparksRig) {
          this.stunSparksRig.visible = this.ai.state === 'stunned';
          if (this.stunSparksRig.visible) {
            this.stunSparksRig.rotation.y += dt * 7.5;
          }
        }
      }
    }

    // 5. Anchored Flush Resting Items + Pulsing Dropped Item Glow Rings (respects gameplay.itemOutline!)
    const showOutlines = this.settings.gameplay.itemOutline !== false;
    for (const item of this.layout.items) {
      if (item.collected || item.insideSafe) continue;
      const mesh = this.itemMeshes.get(item.id);
      if (!mesh) continue;
      if (item.drawerId) {
        const drawer = this.layout.furniture.find((f) => f.id === item.drawerId);
        mesh.visible = Boolean(drawer?.opened);
      } else {
        mesh.rotation.y += dt * 0.9;
        mesh.position.y = item.y;
        const glowRing = mesh.getObjectByName('dropped_glow_ring');
        if (glowRing) {
          glowRing.visible = showOutlines;
          if (showOutlines) {
            const s = 0.92 + Math.sin(this.totalTimeSec * 4.2) * 0.14;
            glowRing.scale.set(s, 1, s);
          }
        }
      }
    }

    // 5b. Subtle 3D Voxel Wireframe Aim Highlight around targeted interactable!
    this.updateAimHighlight();

    // 6. Safe Door animation
    if (this.safeVisual && this.layout.safe.unlocked) {
      this.safeVisual.doorPivot.rotation.y += (-1.75 - this.safeVisual.doorPivot.rotation.y) * Math.min(1, dt * 6);
    }

    // 7. Spatial Audio, Adaptive Music & Line-of-Sight Diddy Tension Check
    const diddyDist = diffCfg.diddyActive
      ? this.ai.getDistanceTo(this.px, this.py, this.pz)
      : 99;
    this.diddyInView = false;
    if (diffCfg.diddyActive && this.ai.floor === this.pFloor && diddyDist < 18) {
      const dx = this.ai.x - this.px;
      const dz = this.ai.z - this.pz;
      const dot = (dx * camFwdX + dz * camFwdZ) / Math.max(0.01, diddyDist);
      if (dot > 0.56 && hasWallLineOfSight(this.layout, this.px, this.pz, this.ai.x, this.ai.z, this.pFloor)) {
        this.diddyInView = true;
      }
    }

    // Tick SecurityBunker lure cooldown, Polaroid cooldown, 15s Final Gate Siren, creaking boards, DOWNED bleedout, Spectator cam & Neural Interference
    if (this.bunkerLureCooldownSec > 0) {
      this.bunkerLureCooldownSec = Math.max(0, this.bunkerLureCooldownSec - dt);
    }
    if (this.polaroidCooldownSec > 0) {
      this.polaroidCooldownSec = Math.max(0, this.polaroidCooldownSec - dt);
    }
    if (this.finalGateSirenSec > 0) {
      const prevSiren = this.finalGateSirenSec;
      this.finalGateSirenSec = Math.max(0, this.finalGateSirenSec - dt);
      if (Math.floor(prevSiren / 3) !== Math.floor(this.finalGateSirenSec / 3) && this.finalGateSirenSec > 0) {
        const fg = this.layout.remasterAnchors.finalGate;
        this.emitNoise(fg.x, fg.y, fg.z, 0, 44, 4, 'flare');
      }
      if (this.finalGateSirenSec <= 0) {
        const exitDoor = this.layout.doors.find((d) => d.isExit);
        if (exitDoor) {
          exitDoor.isUnlocked = true;
          exitDoor.isOpen = true;
          const dv = this.doorVisuals.find((v) => v.def.id === exitDoor.id);
          if (dv?.padlockMesh) dv.padlockMesh.visible = false;
          this.audio.playDoorCreak(true);
          this.showBanner('PORTÃO PRINCIPAL ABERTO! Corra para a saída agora!');
          this.emitHud();
        }
      }
    }
    if (this.creakCooldownSec > 0) {
      this.creakCooldownSec = Math.max(0, this.creakCooldownSec - dt);
    }
    if (this.playerLifeState === 'DOWNED') {
      this.bleedoutSec = Math.max(0, this.bleedoutSec - dt);
      if (this.bleedoutSec <= 0) {
        this.playerLifeState = 'DEAD_SPECTATING';
        this.mpSpectating = true;
        this.showBanner('Você entrou em Modo Espectador. Acompanhe os aliados vivos ou as câmeras da Cabine 09-A!');
        this.emitHud();
      }
    } else if (this.playerLifeState === 'DEAD_SPECTATING' || this.playerLifeState === 'CAPTURED') {
      const alivePeers = Array.from(this.remotePeerRigs.values()).filter((p) => p.rig.root.visible && !p.captured);
      if (alivePeers.length > 0 && !this.cctvOpen) {
        const target = alivePeers[this.spectateTargetIndex % alivePeers.length];
        this.spectateTargetName = target.nickname;
        const tp = target.rig.root.position;
        this.camera.position.set(tp.x - Math.sin(target.targetYaw) * 2.2, tp.y + 1.85, tp.z - Math.cos(target.targetYaw) * 2.2);
        this.camera.lookAt(tp.x, tp.y + 1.35, tp.z);
      }
    }

    // Creaking Floorboards Trap (standing/sprinting emits creak noise; crouching crosses silently!)
    if (this.playerLifeState === 'ALIVE' && !this.crouching && this.creakCooldownSec <= 0 && Math.hypot(this.vx, this.vz) > 0.6) {
      for (const board of CREAKING_FLOORBOARDS) {
        if (board.floor === this.pFloor && Math.hypot(this.px - board.x, this.pz - board.z) <= board.radius) {
          this.creakCooldownSec = 3.2;
          this.audio.playDoorCreak(false, false);
          this.emitNoise(this.px, this.py, this.pz, this.pFloor, 16.5, 3, 'sprint');
          this.showBanner('Tábua rangente! Agache [C] para atravessar em silêncio.');
          break;
        }
      }
    }

    // Neural Interference (CRT static buildup in pitch dark / near P. Drizzy; fades in light or near allies)
    const inDarkNow = !this.flashlightOn || this.blackoutActive;
    const nearDiddyNow = this.ai.floor === this.pFloor && diddyDist < 9.5;
    if (inDarkNow || nearDiddyNow) {
      this.neuralInterference = Math.min(100, this.neuralInterference + ((nearDiddyNow ? 4.5 : 0) + (inDarkNow ? 2.0 : 0)) * dt);
    } else {
      this.neuralInterference = Math.max(0, this.neuralInterference - 5.5 * dt);
    }

    const danger = diffCfg.diddyActive ? Math.max(0, Math.min(1, 1 - (diddyDist - 2.5) / 18)) : 0;
    const holdBreathTension = this.holdBreath.isActive() ? 0.72 : 0;
    const targetChrom = Math.min(
      1,
      Math.max(
        danger > 0.42 ? (danger - 0.42) * 1.45 : 0,
        holdBreathTension,
        this.damageFlash * 0.95,
        this.stunFlashTimer > 0 ? 0.65 : 0
      )
    );
    this.chromaticIntensity += (targetChrom - this.chromaticIntensity) * Math.min(1, dt * 8);

    this.audio.updateListener(this.px, this.py, this.pz, this.yaw);
    this.audio.tickAtmosphere(
      dt,
      danger,
      this.ai.state === 'chase',
      this.hidingSpot !== null,
      this.stamina,
      this.pFloor,
      false
    );

    // 8. Floor Culling (height-aware near stairs — stairs themselves always stay visible!)
    const nearStairs = getStairHeightAt(this.px, this.pz, this.py).onStair || this.pz < 12 * CELL_SIZE;
    this.updateFloorVisibility(this.pFloor, nearStairs);
  }

  private computeDrizzySoundOcclusionHz(): number {
    const sameFloor = this.ai.floor === this.pFloor;
    const hasLos =
      sameFloor &&
      hasWallLineOfSight(this.layout, this.px, this.pz, this.ai.x, this.ai.z, this.pFloor);
    let closedDoorsBetween = 0;
    if (sameFloor) {
      const minX = Math.min(this.px, this.ai.x) - 1.2;
      const maxX = Math.max(this.px, this.ai.x) + 1.2;
      const minZ = Math.min(this.pz, this.ai.z) - 1.2;
      const maxZ = Math.max(this.pz, this.ai.z) + 1.2;
      for (const d of this.layout.doors) {
        if (d.floor !== this.pFloor || d.isOpen) continue;
        const dx = (d.gx + (d.axis === 'x' ? 1 : 0.5)) * CELL_SIZE;
        const dz = (d.gz + (d.axis === 'z' ? 1 : 0.5)) * CELL_SIZE;
        if (dx >= minX && dx <= maxX && dz >= minZ && dz <= maxZ) {
          closedDoorsBetween++;
        }
      }
    }
    return computeSoundOcclusionCutoffHz({
      sameFloor,
      hasLineOfSight: hasLos,
      closedDoorsBetween,
      occlusionEnabled: this.settings.audio.soundOcclusion !== false,
    });
  }

  private stampDrizzyOilyFootprint(x: number, y: number, z: number, yaw: number): void {
    if (this.drizzyFootprintPool.length === 0) return;
    const slot = this.drizzyFootprintPool[this.drizzyFootprintCursor];
    this.drizzyFootprintCursor = (this.drizzyFootprintCursor + 1) % this.drizzyFootprintPool.length;
    this.drizzyStepSide = -this.drizzyStepSide;
    const perpX = Math.cos(yaw) * 0.16 * this.drizzyStepSide;
    const perpZ = -Math.sin(yaw) * 0.16 * this.drizzyStepSide;
    slot.mesh.position.set(x + perpX, y + 0.025, z + perpZ);
    slot.mesh.rotation.y = yaw;
    slot.mesh.visible = true;
    (slot.mesh.material as THREE.MeshStandardMaterial).opacity = 0.72;
    slot.age = 0;
    slot.active = true;
  }

  private updateAimHighlight(): void {
    if (
      this.mode !== 'playing' ||
      this.hasActiveModal() ||
      this.hidingSpot ||
      this.settings.gameplay.itemOutline === false
    ) {
      this.aimHighlightBox.visible = false;
      return;
    }
    const prompt = this.findNearestInteraction();
    if (!prompt) {
      this.aimHighlightBox.visible = false;
      return;
    }

    let hx = 0;
    let hy = 0;
    let hz = 0;
    let sx = 0.6;
    let sy = 0.6;
    let sz = 0.6;
    let found = false;

    if (prompt.actionType === 'pickup') {
      const item = this.layout.items.find((i) => i.id === prompt.id);
      if (item) {
        if (item.drawerId) {
          const drawer = this.layout.furniture.find((f) => f.id === item.drawerId);
          if (drawer) {
            hx = drawer.x + Math.sin(drawer.facingYaw) * 0.44;
            hy = drawer.y + 0.8;
            hz = drawer.z + Math.cos(drawer.facingYaw) * 0.44;
          }
        } else {
          hx = item.x;
          hy = item.y;
          hz = item.z;
        }
        sx = 0.48;
        sy = 0.34;
        sz = 0.48;
        found = true;
      }
    } else if (prompt.actionType === 'drawer') {
      const prop = this.layout.furniture.find((f) => f.id === prompt.id);
      if (prop) {
        hx = prop.x;
        hy = prop.y + 0.79;
        hz = prop.z;
        sx = 0.98;
        sy = 0.44;
        sz = 0.86;
        found = true;
      }
    } else if (prompt.actionType === 'bunker_door_btn') {
      const btn = this.layout.bunkerButtons.find((b) => b.id === prompt.id);
      if (btn) {
        hx = btn.x;
        hy = btn.y;
        hz = btn.z;
        sx = 0.56;
        sy = 0.82;
        sz = 0.32;
        found = true;
      }
    } else if (prompt.actionType === 'cctv_monitor') {
      hx = this.layout.cctvMonitorPos.x;
      hy = this.layout.cctvMonitorPos.y + 0.25;
      hz = this.layout.cctvMonitorPos.z;
      sx = 1.8;
      sy = 0.72;
      sz = 0.85;
      found = true;
    } else if (prompt.actionType === 'clue') {
      const clue = this.layout.clues.find((c) => c.id === prompt.id);
      if (clue) {
        hx = clue.x;
        hy = clue.y;
        hz = clue.z;
        sx = 0.76;
        sy = 0.76;
        sz = 0.16;
        found = true;
      }
    } else if (prompt.actionType === 'cassette') {
      const tape = this.layout.cassettes.find((t) => t.id === prompt.id);
      if (tape) {
        if (tape.drawerId) {
          const drawer = this.layout.furniture.find((f) => f.id === tape.drawerId);
          if (drawer) {
            hx = drawer.x + Math.sin(drawer.facingYaw) * 0.44;
            hy = drawer.y + 0.8;
            hz = drawer.z + Math.cos(drawer.facingYaw) * 0.44;
          }
        } else {
          hx = tape.x;
          hy = tape.y;
          hz = tape.z;
        }
        sx = 0.46;
        sy = 0.24;
        sz = 0.36;
        found = true;
      }
    } else if (prompt.actionType === 'workbench') {
      const wb = this.layout.workbenches.find((w) => w.id === prompt.id);
      if (wb) {
        hx = wb.x;
        hy = wb.y + 0.85;
        hz = wb.z;
        sx = 1.82;
        sy = 1.2;
        sz = 1.02;
        found = true;
      }
    } else if (prompt.actionType === 'safe') {
      hx = this.layout.safe.x;
      hy = this.layout.safe.y + 0.1;
      hz = this.layout.safe.z;
      sx = 1.24;
      sy = 1.36;
      sz = 0.96;
      found = true;
    } else if (prompt.actionType === 'recharge') {
      const st = this.layout.rechargeStations.find((s) => s.id === prompt.id);
      if (st) {
        hx = st.x;
        hy = st.y;
        hz = st.z;
        sx = 0.72;
        sy = 0.88;
        sz = 0.36;
        found = true;
      }
    }

    if (!found) {
      this.aimHighlightBox.visible = false;
      return;
    }

    const pulse = 1 + Math.sin(this.totalTimeSec * 6.5) * 0.035;
    this.aimHighlightBox.visible = true;
    this.aimHighlightBox.position.set(hx, hy, hz);
    this.aimHighlightBox.scale.set(sx * pulse, sy * pulse, sz * pulse);
    const colorHex =
      prompt.accent === 'red'
        ? 0xf87171
        : prompt.accent === 'blue'
        ? 0x60a5fa
        : prompt.accent === 'emerald'
        ? 0x34d399
        : prompt.accent === 'purple'
        ? 0xc084fc
        : 0xfbbf24;
    this.aimHighlightMat.color.setHex(colorHex);
    this.aimHighlightMat.opacity = 0.55 + Math.sin(this.totalTimeSec * 6.5) * 0.22;
  }

  private updateFlareTrajectoryArc(): void {
    if (!this.flareArcPoints) return;
    const activeItem = this.getHotbarSlots()[this.activeSlot]?.itemType ?? 'flashlight';
    const shouldShow =
      this.mode === 'playing' &&
      !this.hidingSpot &&
      !this.hasActiveModal() &&
      ((activeItem === 'flare' && this.flares > 0) ||
        (activeItem === 'throwable_can' && this.throwables > 0));
    this.flareArcPoints.visible = shouldShow;
    if (!shouldShow) return;

    const isFlare = activeItem === 'flare';
    const mat = this.flareArcPoints.material as THREE.PointsMaterial;
    mat.color.setHex(isFlare ? 0xff5a36 : 0x38bdf8);

    const fwdX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
    const sx = this.px + fwdX * 0.58;
    const sy = this.py + this.currentEyeHeight - 0.14;
    const sz = this.pz + fwdZ * 0.58;
    const vx = fwdX * (isFlare ? 10.6 : 11.2);
    const vy = fwdY * (isFlare ? 8.2 : 9.0) + (isFlare ? 2.6 : 2.4);
    const vz = fwdZ * (isFlare ? 10.6 : 11.2);
    const floorMinY = (this.pFloor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y) + 0.08;

    const attr = this.flareArcPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = arr.length / 3;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) * 0.065;
      arr[i * 3] = sx + vx * t;
      arr[i * 3 + 1] = Math.max(floorMinY, sy + vy * t - 0.5 * 15.0 * t * t);
      arr[i * 3 + 2] = sz + vz * t;
    }
    attr.needsUpdate = true;
  }

  private tickThrownProjectiles(dt: number): void {
    for (let i = this.thrownProjectiles.length - 1; i >= 0; i--) {
      const p = this.thrownProjectiles[i];
      p.life -= dt;
      p.vy -= 15.0 * dt;
      const nx = p.x + p.vx * dt;
      const nz = p.z + p.vz * dt;
      const ny = p.y + p.vy * dt;

      const resolved = resolveWorldMovement(
        this.layout,
        p.x,
        p.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y,
        p.z,
        p.vx * dt,
        p.vz * dt,
        0.16,
        false,
        true
      );
      const hitWall = Math.hypot(resolved.x - nx, resolved.z - nz) > 0.05;
      const floorY = (p.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y) + 0.14;
      const hitFloor = ny <= floorY;

      p.x = resolved.x;
      p.z = resolved.z;
      p.y = Math.max(floorY, ny);
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.kind === 'flare') {
        if (hitWall) {
          p.vx *= -0.42;
          p.vz *= -0.42;
        }
        if (hitFloor) {
          p.bounces = (p.bounces ?? 0) + 1;
          if (Math.abs(p.vy) > 1.3 && p.bounces <= 2) {
            p.vy = -p.vy * 0.38;
            p.vx *= 0.65;
            p.vz *= 0.65;
          } else {
            p.vy = 0;
            p.vx *= Math.exp(-6 * dt);
            p.vz *= Math.exp(-6 * dt);
          }
        } else {
          p.mesh.rotation.x += dt * 9;
          p.mesh.rotation.z += dt * 6;
        }

        // Pyrotechnic burn: pulsing dynamic red/amber PointLight + rising sparks + hiss!
        p.burnTimer = (p.burnTimer ?? 3.6) - dt;
        p.hissCooldown = (p.hissCooldown ?? 0.3) - dt;
        if (p.light) {
          p.light.intensity = p.burnTimer < 0.28 ? 14.5 : 4.8 + Math.sin(this.totalTimeSec * 42) * 1.4;
        }
        if (p.hissCooldown <= 0) {
          p.hissCooldown = 0.42;
          const dist = Math.hypot(p.x - this.px, p.z - this.pz);
          if (dist < 18) this.audio.playFlareHiss();
          this.spawnBurstParticles(this.scratchVecC.set(p.x, p.y + 0.1, p.z), 0xf97316, 3, 0.04, 1.8, 3.2);
        }

        if (p.burnTimer <= 0 && !p.detonated) {
          p.detonated = true;
          const distToPlayer = Math.hypot(p.x - this.px, p.z - this.pz);
          this.audio.playFlareDetonation();
          this.emitNoise(p.x, floorY, p.z, p.floor, 42, 4, 'flare');
          this.spawnBurstParticles(this.scratchVecC.set(p.x, p.y + 0.15, p.z), 0xfbbf24, 18, 0.06, 5.2, 7.5);
          this.spawnBurstParticles(this.scratchVecC.set(p.x, p.y + 0.15, p.z), 0xef4444, 12, 0.075, 4.4, 5.5);
          if (distToPlayer < 10) {
            this.trauma = Math.min(1, this.trauma + (1 - distToPlayer / 10) * 0.45);
          }
          const diddyDistToFlare = Math.hypot(this.ai.x - p.x, this.ai.z - p.z);
          const diffCfg = getDifficultyConfig(this.difficulty);
          if (this.ai.floor === p.floor && diddyDistToFlare < 9.5) {
            this.ai.stun(Math.max(5, diffCfg.diddyStunDuration * 0.75));
            this.showBanner('DETONAÇÃO DO SINALIZADOR! P. Drizzy cegado pelo clarão!');
          } else {
            this.showBanner('Sinalizador detonou! O estrondo atraiu o P. Drizzy para longe!');
          }
          this.worldGroup.remove(p.mesh);
          this.thrownProjectiles.splice(i, 1);
        }
      } else {
        p.mesh.rotation.x += dt * 10;
        p.mesh.rotation.z += dt * 7;
        if (hitWall || hitFloor || p.life <= 0) {
          this.audio.playDroppedObjectCrash('tin_cans');
          this.emitNoise(p.x, floorY, p.z, p.floor, 28, 3, 'thrown_object');
          this.worldGroup.remove(p.mesh);
          this.thrownProjectiles.splice(i, 1);
        }
      }
    }

    // Update live Taser darts + glowing copper wires tracking P. Drizzy's chest
    const muzzleWorld = this.scratchVecA.set(0.28, -0.22, -0.58).applyMatrix4(this.camera.matrixWorld);
    for (let i = this.taserVisuals.length - 1; i >= 0; i--) {
      const tv = this.taserVisuals[i];
      tv.age += dt;
      if (tv.age >= tv.maxAge || (tv.attachedToDiddy && this.ai.state !== 'stunned')) {
        this.disposeTaserVisual(tv);
        this.taserVisuals.splice(i, 1);
        continue;
      }
      const targetPos = tv.attachedToDiddy
        ? this.scratchVecB.set(this.ai.x, this.ai.y + 1.32, this.ai.z)
        : tv.hitPoint;
      tv.dartLeft.position.set(targetPos.x - 0.1, targetPos.y + 0.05, targetPos.z);
      tv.dartRight.position.set(targetPos.x + 0.1, targetPos.y - 0.05, targetPos.z);

      const updateWire = (line: THREE.Line, end: THREE.Vector3, sideSign: number) => {
        const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const pts = arr.length / 3;
        for (let k = 0; k < pts; k++) {
          const frac = k / (pts - 1);
          const jitter = Math.sin(this.totalTimeSec * 65 + k * 2.1 + sideSign) * 0.045 * Math.sin(frac * Math.PI);
          const sag = -Math.sin(frac * Math.PI) * 0.14;
          arr[k * 3] = muzzleWorld.x + (end.x - muzzleWorld.x) * frac + jitter;
          arr[k * 3 + 1] = muzzleWorld.y + (end.y - muzzleWorld.y) * frac + sag + jitter * 0.6;
          arr[k * 3 + 2] = muzzleWorld.z + (end.z - muzzleWorld.z) * frac + sideSign * 0.04 * (1 - frac);
        }
        attr.needsUpdate = true;
      };
      updateWire(tv.wireLeft, tv.dartLeft.position, -1);
      updateWire(tv.wireRight, tv.dartRight.position, 1);
    }

    // Update pooled-budget burst particles (wood splinters, metal sparks, ceiling dust, flare embers)
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const bp = this.burstParticles[i];
      bp.age += dt;
      if (bp.age >= bp.maxAge) {
        this.worldGroup.remove(bp.mesh);
        bp.mesh.geometry.dispose();
        (bp.mesh.material as THREE.Material).dispose();
        this.burstParticles.splice(i, 1);
        continue;
      }
      bp.vy -= bp.gravity * dt;
      bp.mesh.position.x += bp.vx * dt;
      bp.mesh.position.y += bp.vy * dt;
      bp.mesh.position.z += bp.vz * dt;
      bp.mesh.rotation.x += bp.rotSpeed * dt;
      bp.mesh.rotation.y += bp.rotSpeed * 0.7 * dt;
      const sc = Math.max(0.05, 1 - bp.age / bp.maxAge);
      bp.mesh.scale.setScalar(sc);
    }
  }

  private disposeTaserVisual(tv: TaserShotVisual): void {
    this.worldGroup.remove(tv.group);
    tv.dartLeft.geometry.dispose();
    (tv.dartLeft.material as THREE.Material).dispose();
    tv.wireLeft.geometry.dispose();
    (tv.wireLeft.material as THREE.Material).dispose();
    tv.wireRight.geometry.dispose();
    (tv.wireRight.material as THREE.Material).dispose();
  }

  private disposeTransientEffects(): void {
    for (const tv of this.taserVisuals) this.disposeTaserVisual(tv);
    this.taserVisuals = [];
    for (const bp of this.burstParticles) {
      this.worldGroup.remove(bp.mesh);
      bp.mesh.geometry.dispose();
      (bp.mesh.material as THREE.Material).dispose();
    }
    this.burstParticles = [];
  }

  private updateFloorVisibility(activeFloor: FloorId, showBothNearStairs: boolean): void {
    const show0 = showBothNearStairs || activeFloor === 0;
    const showMinus1 = showBothNearStairs || activeFloor === -1;
    for (const obj of this.floor0Chunks) obj.visible = show0;
    for (const obj of this.floorMinus1Chunks) obj.visible = showMinus1;
    syncActiveWorldItemVisibility(
      this.layout.items,
      this.itemMeshes,
      activeFloor,
      showBothNearStairs,
      (drawerId) => Boolean(this.layout.furniture.find((f) => f.id === drawerId)?.opened)
    );
  }

  private updateDynamicLighting(dt: number): void {
    const prof = getGraphicsProfile(this.settings.graphicsQuality);
    const activeCount = this.isSoftwareGl
      ? 1
      : Math.min(this.pooledPointLights.length, Math.max(1, prof.maxDynamicLights - 1));
    const camPos = this.camera.position;

    // Synchronize emissive fluorescent tubes + subtle halo with wall light switches, blackout, and physical flicker!
    for (const meta of this.ceilingLightMeta) {
      const switchedOff = meta.roomId !== null && this.disabledLightRooms.has(meta.roomId);
      if (switchedOff) {
        meta.halo.visible = false;
        meta.tubeMat.emissiveIntensity = 0.0;
        continue;
      }
      if (this.blackoutActive && !meta.isSecurityOffice) {
        const pulse = 0.55 + Math.sin(this.totalTimeSec * 4 + meta.flickerSeed) * 0.22;
        meta.halo.visible = true;
        meta.tubeMat.emissive.setHex(0xef4444);
        meta.tubeMat.emissiveIntensity = pulse;
      } else {
        const wave =
          Math.sin(this.totalTimeSec * 9.5 + meta.flickerSeed) *
          Math.sin(this.totalTimeSec * 23.0 + meta.flickerSeed * 2.1);
        const flickDip = wave > 0.72 ? 0.35 : 1.0;
        meta.halo.visible = flickDip > 0.5;
        meta.tubeMat.emissive.setHex(meta.baseColor);
        meta.tubeMat.emissiveIntensity = 2.0 * flickDip;
      }
    }

    const scored = this.layout.ceilingLights
      .filter((l) => {
        const rm = getRoomAt(this.layout, l.x, l.z, l.floor);
        return !rm || !this.disabledLightRooms.has(rm.id);
      })
      .map((l) => ({
        l,
        dSq:
          (l.x - camPos.x) * (l.x - camPos.x) +
          (l.y - camPos.y) * (l.y - camPos.y) * 4 +
          (l.z - camPos.z) * (l.z - camPos.z),
      }))
      .sort((a, b) => a.dSq - b.dSq);

    for (let i = 0; i < this.pooledPointLights.length; i++) {
      const pl = this.pooledPointLights[i];
      if (i >= activeCount || !scored[i]) {
        pl.visible = false;
        continue;
      }
      const { l } = scored[i];
      pl.visible = true;
      pl.position.set(l.x, l.y - 0.08, l.z);

      if (this.blackoutActive && !l.isSecurityOffice) {
        // Eerie dim red emergency glow during Blackout!
        pl.color.setHex(0xef4444);
        pl.intensity = 1.65 + Math.sin(this.totalTimeSec * 4 + l.flickerSeed) * 0.45;
      } else {
        pl.color.setHex(l.color);
        const wave =
          Math.sin(this.totalTimeSec * 9.5 + l.flickerSeed) *
          Math.sin(this.totalTimeSec * 23.0 + l.flickerSeed * 2.1);
        const flickDip = wave > 0.72 ? 0.35 : 1.0;
        pl.intensity = (l.floor === -1 ? 4.8 : 6.4) * flickDip;
        if (i === 0 && flickDip < 0.5 && this.mode === 'playing' && this.flickerBuzzCooldown <= 0) {
          const dist = Math.sqrt(scored[0].dSq);
          if (dist < 11) {
            this.audio.playFluorescentFlickerBuzz(dist);
            this.flickerBuzzCooldown = 2.6 + Math.random() * 2.2;
          }
        }
      }
    }

    // Realistic Midnight-Blue Night Sky vs Cold Greenish-Teal Underground vs Blackout Crimson!
    // Nightmare OLED Floor: NEVER crush HemisphereLight below 0.38 so players always read corridors clearly!
    const targetSky = this.pFloor === -1 ? 0x26626a : this.blackoutActive ? 0x351e2c : 0x4b6fb3;
    const targetBg = this.pFloor === -1 ? 0x07171c : this.blackoutActive ? 0x12090d : 0x0a1326;
    const lerpK = Math.min(1, dt * 3);
    this.scratchColor.setHex(targetSky);
    this.hemiLight.color.lerp(this.scratchColor, lerpK);
    this.hemiLight.intensity = this.blackoutActive ? 0.38 : 0.62;
    this.windowRimLight.intensity = this.pFloor === 0 ? (this.blackoutActive ? 0.32 : 0.46) : 0.28;
    this.moonLight.visible = this.pFloor === 0 && !this.blackoutActive;
    this.scratchColor.setHex(targetBg);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(this.scratchColor, lerpK);
    }

    const diffCfg = getDifficultyConfig(this.difficulty);
    const fogUserMult = Math.max(0.4, Math.min(1.6, this.settings.video.fogDensity ?? 1.0));
    const renderDist = Math.max(0.5, Math.min(1.5, this.settings.video.renderDistance ?? 1.0));
    const targetFog =
      ((this.mode === 'title'
        ? 0.044
        : (this.pFloor === -1 ? 0.068 : this.blackoutActive ? 0.072 : 0.044) * diffCfg.fogDensityMult) *
        fogUserMult) /
      renderDist;
    const fogObj = this.scene.fog as THREE.FogExp2;
    fogObj.color.lerp(this.scratchColor, lerpK);
    fogObj.density += (targetFog - fogObj.density) * Math.min(1, dt * 4);
  }

  private updateAtmosphereAnimations(dt: number): void {
    // 1. Atmospheric Night Sky Dome, 420 Twinkling Stars, Drifting Clouds & Perimeter Beacons
    if (this.nightSkyRig) {
      this.nightSkyRig.update(this.totalTimeSec);
    }

    // 2. Volumetric God Rays gentle shimmer
    for (let i = 0; i < this.godRayMeshes.length; i++) {
      const m = this.godRayMeshes[i];
      const baseOp = Number(m.userData?.baseOpacity ?? 0.1);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = this.blackoutActive
        ? baseOp * 0.25
        : baseOp * (0.86 + Math.sin(this.totalTimeSec * 0.9 + i * 1.7) * 0.14);
    }

    // 3. Living Water Physics Shader + Falling Ceiling Drops -> Concentric Shader Ripples + Droplets!
    this.waterManager?.update(dt);
    const cycleSec = 3.2;
    for (const pv of this.puddleDrips) {
      const prevPhase = pv.phase;
      pv.phase = (pv.phase + dt) % cycleSec;
      const fallDur = 0.65;

      if (pv.phase < fallDur) {
        const t = pv.phase / fallDur;
        pv.dropMesh.visible = true;
        pv.dropMesh.position.y = 2.6 * (1 - t * t);
      } else {
        pv.dropMesh.visible = false;
      }

      if (prevPhase < fallDur && pv.phase >= fallDur) {
        this.waterManager?.triggerRippleAndSplash(pv.floor, pv.x, pv.y, pv.z, 0.72, 3);
        if (this.mode === 'playing' && pv.floor === this.pFloor) {
          const dx = pv.x - this.px;
          const dz = pv.z - this.pz;
          const dist = Math.hypot(dx, dz);
          if (dist < 14) {
            const rightX = Math.cos(this.yaw);
            const rightZ = -Math.sin(this.yaw);
            const pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / Math.max(2, dist)));
            this.audio.playWaterDrip(pan, dist);
          }
        }
      }
    }

    // 4. Rising Underground Pipe Steam Puffs
    for (const sp of this.steamParticles) {
      sp.phase = (sp.phase + dt * 0.42) % 1;
      sp.mesh.position.set(
        sp.baseX + Math.sin(this.totalTimeSec * 1.6 + sp.phase * 6) * 0.14,
        sp.baseY + sp.phase * 1.65,
        sp.baseZ + Math.cos(this.totalTimeSec * 1.2 + sp.phase * 5) * 0.12
      );
      const sc = 0.6 + sp.phase * 1.3;
      sp.mesh.scale.setScalar(sc);
      const mat = sp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(sp.phase * Math.PI) * 0.24;
    }

    // 5. Living Environment Micro-Animations: Spinning Fans, Ticking Clocks, Blinking Servers, Swaying Tarps!
    const fanPower = this.blackoutActive ? 0.18 : 1.0;
    for (const fan of this.animatedFans) {
      if (fan.speed > 4) {
        fan.bladesPivot.rotation.z -= dt * fan.speed * fanPower;
      } else {
        fan.bladesPivot.rotation.y += dt * fan.speed * fanPower;
      }
    }

    const wholeSec = Math.floor(this.totalTimeSec);
    const secTicked = wholeSec !== this.clockTickSec;
    if (secTicked) this.clockTickSec = wholeSec;
    const secAngle = -(wholeSec % 60) * ((Math.PI * 2) / 60);
    const minAngle = -((this.totalTimeSec / 60) % 60) * ((Math.PI * 2) / 60);
    for (const clk of this.wallClocks) {
      clk.secondHand.rotation.z = secAngle;
      clk.minuteHand.rotation.z = minAngle;
      if (secTicked && this.mode === 'playing' && clk.floor === this.pFloor) {
        const dist = Math.hypot(clk.x - this.px, clk.z - this.pz);
        if (dist < 7.5) {
          this.audio.playClockTick(dist);
        }
      }
    }

    for (const srv of this.serverRacks) {
      const emiNear =
        this.ai.floor === srv.floor &&
        Math.hypot(this.ai.x - srv.x, this.ai.z - srv.z) < 8.0;
      for (let i = 0; i < srv.ledMats.length; i++) {
        const mat = srv.ledMats[i];
        if (this.blackoutActive) {
          mat.emissiveIntensity = i === 0 ? 0.8 + Math.sin(this.totalTimeSec * 5) * 0.6 : 0.05;
        } else if (emiNear) {
          mat.emissiveIntensity = Math.sin(this.totalTimeSec * 42 + i * 3.1) > 0 ? 2.6 : 0.15;
        } else {
          const pulse = Math.sin(this.totalTimeSec * (3.2 + i * 1.1) + srv.phaseOffset + i * 1.7);
          mat.emissiveIntensity = pulse > 0.2 ? 1.85 : 0.3;
        }
      }
    }

    for (const tarp of this.swayingTarps) {
      tarp.curtainPivot.rotation.x =
        Math.sin(this.totalTimeSec * 1.35 + tarp.phaseOffset) * 0.07 +
        Math.sin(this.totalTimeSec * 2.7 + tarp.phaseOffset * 1.9) * 0.025;
    }

    // 5b. Update 2.0 Mounted High-Density Micro-Voxel Rigs (zero per-frame allocations!)
    if (this.chandelierRig) {
      this.chandelierRig.chandelierPivot.rotation.z = Math.sin(this.totalTimeSec * 0.85) * 0.032;
      this.chandelierRig.chandelierPivot.rotation.x = Math.cos(this.totalTimeSec * 0.62) * 0.02;
    }
    if (this.fireplaceRig) {
      const flicker = 4.2 + Math.sin(this.totalTimeSec * 11.3) * 0.65 + Math.cos(this.totalTimeSec * 19.7) * 0.35;
      this.fireplaceRig.emberLight.intensity = flicker * 0.55;
      if (this.fireplaceGlowLight) {
        this.fireplaceGlowLight.intensity = flicker;
      }
      for (let i = 0; i < this.fireplaceRig.emberMeshes.length; i++) {
        const em = this.fireplaceRig.emberMeshes[i];
        em.scale.y = 0.85 + Math.sin(this.totalTimeSec * 14 + i * 1.9) * 0.25;
      }
    }
    if (this.grandfatherClockRig) {
      this.grandfatherClockRig.pendulumPivot.rotation.z = Math.sin(this.totalTimeSec * Math.PI) * 0.22;
    }
    this.bunkerSetpieceRig?.update(
      this.totalTimeSec,
      Math.max(0, Math.min(1, this.securityPowerPct / 100)),
      this.bunkerLureCooldownSec > 0
    );
    if (this.garageCarRig) {
      this.garageCarRig.batterySlot.visible = this.garageBatteryInstalled;
      const targetHood = this.garageBatteryInstalled ? 0 : -0.68;
      this.garageCarRig.hoodPivot.rotation.x +=
        (targetHood - this.garageCarRig.hoodPivot.rotation.x) * Math.min(1, dt * 5);
      const carReady = this.garageBatteryInstalled && this.garageFuelInstalled;
      for (let i = 0; i < this.garageCarRig.headlights.length; i++) {
        const mat = this.garageCarRig.headlights[i].material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = carReady ? 1.85 : 0.15;
      }
    }
    if (this.steamValvesRig) {
      const closedCount = this.steamValvesClosed.filter(Boolean).length;
      this.steamValvesRig.update(this.totalTimeSec, 1 - closedCount / 3);
    }
    if (this.falseBookshelfRig) {
      const targetRot = this.bookshelfOpened ? -1.45 : 0;
      this.falseBookshelfRig.shelfPivot.rotation.y +=
        (targetRot - this.falseBookshelfRig.shelfPivot.rotation.y) * Math.min(1, dt * 4.5);
      this.falseBookshelfRig.emblemSunSlot.visible = this.bookshelfSunInstalled;
      this.falseBookshelfRig.emblemMoonSlot.visible = this.bookshelfMoonInstalled;
    }
    if (this.fourStageFinalGateRig) {
      const exitDoor = this.layout.doors.find((d) => d.isExit);
      const sirenActive = this.finalGateSirenSec > 0;
      const gateOpenProg = exitDoor?.openProgress ?? (sirenActive ? 1 - this.finalGateSirenSec / 15 : 0);
      this.fourStageFinalGateRig.update(this.totalTimeSec, sirenActive, gateOpenProg);
      for (const cg of this.fourStageFinalGateRig.chainGroups) {
        cg.visible = !(exitDoor?.planksRemoved ?? false);
      }
    }

    // 6. Courtyard Light Drizzle Rain + Ambient Puddle Ripples
    if (this.courtyardRainLines && this.courtyardRainData && this.courtyardRainLines.visible) {
      const posAttr = this.courtyardRainLines.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = this.courtyardRainData.length / 4;
      for (let i = 0; i < count; i++) {
        const rx = this.courtyardRainData[i * 4];
        let ry = this.courtyardRainData[i * 4 + 1] - this.courtyardRainData[i * 4 + 3] * dt;
        const rz = this.courtyardRainData[i * 4 + 2];
        if (ry < FLOOR_0_Y + 0.08) {
          ry = FLOOR_0_Y + 5.6 + (i % 7) * 0.18;
        }
        this.courtyardRainData[i * 4 + 1] = ry;
        arr[i * 6] = rx;
        arr[i * 6 + 1] = ry;
        arr[i * 6 + 2] = rz;
        arr[i * 6 + 3] = rx - 0.04;
        arr[i * 6 + 4] = ry - 0.36;
        arr[i * 6 + 5] = rz - 0.03;
      }
      posAttr.needsUpdate = true;
      this.rainRippleCooldown -= dt;
      if (this.rainRippleCooldown <= 0 && this.waterManager) {
        this.rainRippleCooldown = 0.34;
        const cyPuddles = this.layout.puddles.filter((p) => p.floor === 0 && p.z > 20 * CELL_SIZE && p.z < 30 * CELL_SIZE);
        if (cyPuddles.length > 0) {
          const p = cyPuddles[Math.floor(Math.random() * cyPuddles.length)];
          this.waterManager.spawnAmbientRainRipple(
            p.x + (Math.random() - 0.5) * p.radius * 0.7,
            p.z + (Math.random() - 0.5) * p.radius * 0.7
          );
        }
      }
    }

    // 7. Fade out P. Drizzy oily Compound 09 footprints smoothly
    for (const fp of this.drizzyFootprintPool) {
      if (!fp.active) continue;
      fp.age += dt;
      if (fp.age >= fp.maxAge) {
        fp.active = false;
        fp.mesh.visible = false;
      } else {
        const fade = 1 - fp.age / fp.maxAge;
        (fp.mesh.material as THREE.MeshStandardMaterial).opacity = fade * 0.72;
      }
    }
  }

  private updateDustParticles(dt: number): void {
    if (!this.dustPoints || !this.dustBasePositions) return;
    const attr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = arr.length / 3;
    for (let i = 0; i < count; i++) {
      arr[i * 3] = this.dustBasePositions[i * 3] + Math.sin(this.totalTimeSec * 0.4 + i) * 0.25;
      arr[i * 3 + 1] = this.dustBasePositions[i * 3 + 1] + Math.cos(this.totalTimeSec * 0.35 + i * 1.3) * 0.18;
    }
    attr.needsUpdate = true;
    const pMat = this.dustPoints.material as THREE.PointsMaterial;
    pMat.color.setHex(this.uvMode ? 0xd8b4fe : 0xe2e8f0);
    pMat.opacity = this.flashlightOn ? 0.54 : 0.24;
    void dt;
  }

  private updateDoorAndFurnitureAnimations(dt: number): void {
    let anyDoorMoved = false;
    for (const dv of this.doorVisuals) {
      const target = dv.def.isOpen ? 1 : 0;
      const speed =
        dv.def.lockType === 'bunker_blast'
          ? 11.5
          : this.doorSwingSpeed.get(dv.def.id) ?? 6.5;
      const delta = target - dv.def.openProgress;
      if (Math.abs(delta) > 0.005) anyDoorMoved = true;
      dv.def.openProgress += delta * Math.min(1, dt * speed);
      if (dv.blastPanel) {
        // Cabine 09-A Blast Door slides vertically UP into the ceiling housing!
        dv.blastPanel.position.y = dv.def.openProgress * (dv.doorHeight - 0.18);
      } else {
        dv.leafPivot.rotation.y = -dv.def.openProgress * 1.52;
      }
    }
    if (anyDoorMoved && this.moonLight.castShadow) {
      this.moonLight.shadow.needsUpdate = true;
    }

    for (const hv of this.hidingVisuals) {
      if (!hv.doorPivot) continue;
      const isPlayerHere = this.hidingSpot?.id === hv.def.id;
      const targetAngle = isPlayerHere ? -0.14 : 0;
      hv.doorPivot.rotation.y += (targetAngle - hv.doorPivot.rotation.y) * Math.min(1, dt * 8);
    }

    // Animated hollow sliding drawers (and nested contents visibility!) + generator power lever
    for (const fv of this.furnitureVisuals) {
      if (!fv.animatedPart) continue;
      if (fv.def.kind === 'drawer_cabinet') {
        const target = fv.def.opened ? 0.44 : 0.02;
        fv.animatedPart.position.z += (target - fv.animatedPart.position.z) * Math.min(1, dt * 9);
        const progress = (fv.animatedPart.position.z - 0.02) / 0.42;
        fv.def.openProgress = Math.max(0, Math.min(1, progress));
        if (fv.contentsAnchor) {
          for (const tape of this.layout.cassettes) {
            if (tape.drawerId === fv.def.id) {
              const vis = this.cassetteVisuals.get(tape.id);
              if (vis) vis.group.visible = progress > 0.08;
            }
          }
          for (const item of this.layout.items) {
            if (item.drawerId === fv.def.id) {
              const mesh = this.itemMeshes.get(item.id);
              if (mesh) mesh.visible = !item.collected && progress > 0.08;
            }
          }
        }
      } else if (fv.def.kind === 'generator_lever') {
        const targetRot = this.generatorFixed ? 0.65 : -0.6;
        fv.animatedPart.rotation.x += (targetRot - fv.animatedPart.rotation.x) * Math.min(1, dt * 8);
      }
    }
  }

  // ---- ARCHITECTURAL VECTOR MINIMAP & FULL MAP (STRICT FOG-OF-WAR, ZERO SPOILERS!) ----

  private drawStrictFogMap(canvas: HTMLCanvasElement, isFullMap: boolean): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Tactical blueprint slate base
    ctx.fillStyle = '#070b11';
    ctx.fillRect(0, 0, w, h);

    // Subtle architectural grid lines
    const gridStep = isFullMap ? 24 : 18;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += gridStep) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += gridStep) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    const floor = this.pFloor;
    const grid = floor === 0 ? this.layout.floor0 : this.layout.floorMinus1;
    const fogGrid = floor === 0 ? this.fog.floor0 : this.fog.floorMinus1;

    const pGx = this.px / CELL_SIZE;
    const pGz = this.pz / CELL_SIZE;

    const scale = isFullMap ? Math.min(w, h) / (GRID_W + 2) : w / 16.5;
    const offsetX = isFullMap ? (w - GRID_W * scale) / 2 : w / 2 - pGx * scale;
    const offsetY = isFullMap ? (h - GRID_H * scale) / 2 : h / 2 - pGz * scale;

    // 1. Revealed Floor & Structural Blocks
    for (let gz = 0; gz < GRID_H; gz++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const idx = cellIdx(gx, gz);
        if (fogGrid[idx] !== 1) continue;
        const cell = grid[idx];
        if (cell === CELL_VOID) continue;

        const sx = offsetX + gx * scale;
        const sy = offsetY + gz * scale;
        if (sx + scale < 0 || sx > w || sy + scale < 0 || sy > h) continue;

        if (cell === CELL_WALL) {
          ctx.fillStyle = floor === 0 ? '#1b2433' : '#13262c';
        } else if (cell === CELL_STAIR) {
          ctx.fillStyle = '#92400e';
        } else if (cell === CELL_VENT) {
          ctx.fillStyle = '#334155';
        } else if (cell === CELL_COURTYARD) {
          ctx.fillStyle = '#101d29';
        } else {
          ctx.fillStyle = floor === 0 ? '#0f1622' : '#0b191e';
        }
        ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(scale), Math.ceil(scale));
      }
    }

    // 2. Crisp Architectural Vector Wall Contours (only along revealed walkable-to-wall boundaries!)
    ctx.strokeStyle = floor === 0 ? '#64748b' : '#2dd4bf';
    ctx.lineWidth = isFullMap ? 1.5 : 1.8;
    ctx.beginPath();
    for (let gz = 0; gz < GRID_H; gz++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const idx = cellIdx(gx, gz);
        if (fogGrid[idx] !== 1) continue;
        const cell = grid[idx];
        if (cell === CELL_VOID || cell === CELL_WALL) continue;

        const sx = offsetX + gx * scale;
        const sy = offsetY + gz * scale;
        if (sx + scale < 0 || sx > w || sy + scale < 0 || sy > h) continue;

        if (gz > 0 && grid[cellIdx(gx, gz - 1)] === CELL_WALL) {
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + scale, sy);
        }
        if (gz < GRID_H - 1 && grid[cellIdx(gx, gz + 1)] === CELL_WALL) {
          ctx.moveTo(sx, sy + scale);
          ctx.lineTo(sx + scale, sy + scale);
        }
        if (gx > 0 && grid[cellIdx(gx - 1, gz)] === CELL_WALL) {
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx, sy + scale);
        }
        if (gx < GRID_W - 1 && grid[cellIdx(gx + 1, gz)] === CELL_WALL) {
          ctx.moveTo(sx + scale, sy);
          ctx.lineTo(sx + scale, sy + scale);
        }
      }
    }
    ctx.stroke();

    // 3. Live Color-Coded Doors (only if adjacent cell is revealed in Fog of War -> ZERO spoilers!)
    for (const d of this.layout.doors) {
      if (d.floor !== floor) continue;
      const gx = Math.floor(d.gx);
      const gz = Math.floor(d.gz);
      const revealed =
        (gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_H && fogGrid[cellIdx(gx, gz)] === 1) ||
        (gx + 1 < GRID_W && fogGrid[cellIdx(gx + 1, gz)] === 1) ||
        (gz + 1 < GRID_H && fogGrid[cellIdx(gx, gz + 1)] === 1);
      if (!revealed) continue;

      const dx = offsetX + (d.gx + (d.axis === 'x' ? 1 : 0.5)) * scale;
      const dy = offsetY + (d.gz + (d.axis === 'z' ? 1 : 0.5)) * scale;
      ctx.strokeStyle = d.isExit
        ? '#ef4444'
        : d.lockType === 'bunker_blast'
        ? '#38bdf8'
        : !d.isUnlocked
        ? '#f59e0b'
        : d.isOpen
        ? '#22c55e'
        : '#94a3b8';
      ctx.lineWidth = isFullMap ? 2.4 : 2.8;
      ctx.beginPath();
      if (d.axis === 'x') {
        ctx.moveTo(dx - scale * 0.65, dy);
        ctx.lineTo(dx + scale * 0.65, dy);
      } else {
        ctx.moveTo(dx, dy - scale * 0.65);
        ctx.lineTo(dx, dy + scale * 0.65);
      }
      ctx.stroke();
    }

    // 4. Revealed Safe Marker (Generator Room) & Room Labels on Full Map
    if (floor === -1) {
      const sgx = Math.floor(this.layout.safe.x / CELL_SIZE);
      const sgz = Math.floor(this.layout.safe.z / CELL_SIZE);
      if (sgx >= 0 && sgx < GRID_W && sgz >= 0 && sgz < GRID_H && fogGrid[cellIdx(sgx, sgz)] === 1) {
        const sx = offsetX + (this.layout.safe.x / CELL_SIZE) * scale;
        const sy = offsetY + (this.layout.safe.z / CELL_SIZE) * scale;
        ctx.fillStyle = this.layout.safe.unlocked ? '#22c55e' : '#f59e0b';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
    }

    if (isFullMap) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX, offsetY, GRID_W * scale, GRID_H * scale);
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
      for (const rm of this.layout.rooms) {
        if (rm.floor !== floor) continue;
        const cx = Math.floor((rm.x0 + rm.x1) / 2);
        const cz = Math.floor((rm.z0 + rm.z1) / 2);
        if (fogGrid[cellIdx(cx, cz)] !== 1) continue;
        const label = rm.name.split('·')[0].trim().toUpperCase();
        ctx.fillText(label, offsetX + (cx + 0.5) * scale, offsetY + (cz + 0.5) * scale);
      }
    }

    // 5. Player Vision Cone + Crisp Directional Chevron Arrow
    const pxScreen = offsetX + pGx * scale;
    const pzScreen = offsetY + pGz * scale;
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const angle = Math.atan2(fwdZ, fwdX);

    ctx.save();
    ctx.translate(pxScreen, pzScreen);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, isFullMap ? scale * 2.8 : scale * 2.4, angle - 0.52, angle + 0.52);
    ctx.closePath();
    ctx.fillStyle = this.uvMode ? 'rgba(192, 132, 252, 0.28)' : 'rgba(245, 158, 11, 0.22)';
    ctx.fill();

    // Directional tactical chevron
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(isFullMap ? 6.5 : 5.5, 0);
    ctx.lineTo(isFullMap ? -4.5 : -3.8, isFullMap ? -4.2 : -3.5);
    ctx.lineTo(isFullMap ? -2.2 : -1.8, 0);
    ctx.lineTo(isFullMap ? -4.5 : -3.8, isFullMap ? 4.2 : 3.5);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#090d14';
    ctx.stroke();
    ctx.restore();
  }

  // ---- HUD SNAPSHOT BUILDER ----

  private buildSlotInfo(slotIndex: number): HotbarSlotInfo {
    const itemType = this.inventory[slotIndex] ?? null;
    return {
      slotIndex,
      itemType,
      label: itemType ? getItemLabel(itemType) : '',
      description: itemType ? getItemDescription(itemType) : undefined,
      droppable: itemType !== null && itemType !== 'flashlight',
      count:
        itemType === 'flare'
          ? this.flares
          : itemType === 'stun_gun'
          ? this.stunAmmo
          : itemType === 'throwable_can'
          ? this.throwables
          : undefined,
      chargePct: itemType === 'flashlight' ? Math.round(this.battery) : undefined,
    };
  }

  private getHotbarSlots(): HotbarSlotInfo[] {
    const slots: HotbarSlotInfo[] = [];
    for (let i = 0; i < 6; i++) {
      slots.push(this.buildSlotInfo(i));
    }
    return slots;
  }

  private getBackpackSlots(): HotbarSlotInfo[] {
    const slots: HotbarSlotInfo[] = [];
    for (let i = 0; i < BACKPACK_CAPACITY; i++) {
      slots.push(this.buildSlotInfo(i));
    }
    return slots;
  }

  private getObjectiveText(): string {
    const exitDoor = this.layout.doors.find((d) => d.isExit);
    if (!exitDoor) return 'Explore o Complexo Craft do Setor 09 e encontre a saída.';

    if (this.blackoutActive) {
      return !this.fuseInstalled
        ? 'APAGÃO · Encontre o Fusível e instale na Sala dos Geradores (Subsolo)!'
        : 'APAGÃO · Puxe a Alavanca do Gerador para religar a energia!';
    }

    const hasOpener =
      this.inventory.includes('red_key') ||
      this.inventory.includes('blue_key') ||
      this.inventory.includes('crowbar');

    if (!hasOpener) {
      return '1/4 · Explore Pátio/Refeitório/Oficina pela 1ª Chave ou peças do Pé de Cabra.';
    }

    if (!this.inventory.includes('basement_key') && !this.layout.safe.unlocked) {
      return '2/4 · Destranque Arquivo Morto / Enfermaria para a Chave do Subsolo.';
    }

    if (!this.layout.safe.unlocked) {
      const found = this.layout.clues.filter((c) => c.discovered).length;
      if (found < 4) {
        return `3/4 · Reúna as Pistas (${found}/4) e abra o Cofre na Sala dos Geradores.`;
      }
      return '3/4 · Digite o código de 4 dígitos no Cofre do Gerador (Subsolo).';
    }

    if (!exitDoor.planksRemoved) {
      return '4/4 · Arrancando as tábuas: use o Pé de Cabra no Portão de Saída (Norte)!';
    }

    if (!this.inventory.includes('master_key')) {
      return '4/4 · Pegue a Chave Mestra no Cofre para destrancar a Saída!';
    }

    return '4/4 · Corra ao Portão de Saída (Norte) e escape agora!';
  }

  private emitHud(): void {
    const diffCfg = getDifficultyConfig(this.difficulty);
    const room = getRoomAt(this.layout, this.px, this.pz, this.pFloor);
    const diddyDist = diffCfg.diddyActive
      ? this.ai.getDistanceTo(this.px, this.py, this.pz)
      : 99;
    const danger = diffCfg.diddyActive
      ? Math.max(0, Math.min(1, 1 - (diddyDist - 2.5) / 18))
      : 0;
    const exitDoor = this.layout.doors.find((d) => d.isExit);
    const leftBunker = this.layout.doors.find((d) => d.id === 'door_bunker_left');
    const rightBunker = this.layout.doors.find((d) => d.id === 'door_bunker_right');

    const safeCodeHintDigits: (string | null)[] = [null, null, null, null];
    for (const c of this.layout.clues) {
      if (c.discovered) safeCodeHintDigits[c.digitIndex] = c.digitValue;
    }

    const activePrompt =
      this.mode === 'playing' && !this.hasActiveModal() ? this.findNearestInteraction() : null;
    let reticleState: ReticleState = 'idle';
    if (activePrompt) {
      if (activePrompt.actionType === 'pickup') {
        reticleState = 'pickup';
      } else if (activePrompt.actionType === 'hide' || activePrompt.actionType === 'unhide') {
        reticleState = 'hide';
      } else if (
        (activePrompt.actionType === 'door' || activePrompt.actionType === 'exit') &&
        activePrompt.sublabel &&
        /Requer|Trava|Tábuas|Correntes|Destrancar/.test(activePrompt.sublabel)
      ) {
        reticleState = 'locked';
      } else {
        reticleState = 'interact';
      }
    }

    const cassettesFound = this.layout.cassettes.filter((t) => t.listened).length;
    const dossiersUnlockedCount = this.terminalUnlocked
      ? OMEGA_DOSSIERS.length
      : Math.min(2, Math.floor(cassettesFound / 2) + (this.layout.safe.unlocked ? 1 : 0));

    const hbSnap = this.holdBreath.getSnapshot();
    const hud: HudSnapshot = {
      mode: this.mode,
      difficulty: this.difficulty,
      floor: this.pFloor,
      roomName: this.inVent
        ? 'Duto de Ventilação'
        : room
        ? room.name
        : this.pFloor === 0
        ? 'Térreo · Corredor'
        : 'Subsolo · Túneis',
      elapsedSec: this.elapsedSec,
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: Math.round(this.stamina),
      battery: Math.round(this.battery),
      flashlightOn: this.flashlightOn,
      uvMode: this.uvMode,
      crouching: this.crouching,
      inVent: this.inVent,
      sprinting: this.sprinting,
      hiding: this.hidingSpot !== null,
      hidingKind: this.hidingSpot?.kind ?? null,
      noiseLevel: this.noiseLevel,
      diddyDistance: Math.round(diddyDist),
      diddyState: this.ai.state,
      dangerIntensity: danger,
      damageFlash: this.damageFlash,
      activeSlot: this.activeSlot,
      hotbar: this.getHotbarSlots(),
      backpackItems: this.getBackpackSlots(),
      backpackCapacity: BACKPACK_CAPACITY,
      canDropActiveItem: Boolean(
        this.inventory[this.activeSlot] && this.inventory[this.activeSlot] !== 'flashlight'
      ),
      collectedKeys: this.inventory.filter((i) => i !== 'flashlight' && i !== 'flare'),
      stunAmmo: this.stunAmmo,
      throwables: this.throwables,
      cluesFound: this.layout.clues.filter((c) => c.discovered).length,
      cluesTotal: this.layout.clues.length,
      uvCluesFound: this.layout.uvMarks.filter((u) => u.discovered).length,
      cassettesFound,
      cassettesTotal: this.layout.cassettes.length,
      dossiersUnlockedCount,
      safeUnlocked: this.layout.safe.unlocked,
      blackoutActive: this.blackoutActive,
      generatorFixed: this.generatorFixed,
      fuseInstalled: this.fuseInstalled,
      terminalUnlocked: this.terminalUnlocked,
      exitProgress: {
        planksRemoved: Boolean(exitDoor?.planksRemoved),
        electronicUnlocked: Boolean(exitDoor?.electronicUnlocked),
        masterUnlocked: Boolean(exitDoor?.isUnlocked),
      },
      securityPowerPct: Math.round(this.securityPowerPct),
      securityLeftClosed: Boolean(leftBunker && !leftBunker.isOpen),
      securityRightClosed: Boolean(rightBunker && !rightBunker.isOpen),
      cctvOpen: this.cctvOpen,
      cctvActiveCamIndex: this.cctvActiveCamIndex,
      cctvCameras: this.layout.bunkerCameras.map((c) => ({
        id: c.id,
        label: c.label,
        roomName: c.roomName,
      })),
      workbenchOpen: this.workbenchOpen,
      terminalOpen: this.terminalOpen,
      quickInspect: this.quickInspect,
      objectiveText: this.getObjectiveText(),
      statusBanner: this.statusBanner,
      interactPrompt: activePrompt,
      reticleState,
      contextualUseLabel: this.getContextualUseLabel(),
      exploredPct: this.fog.getExploredPercentage(this.layout),
      keypadOpen: this.keypadOpen,
      safeCodeHintDigits,
      isMobileTouch: this.inputController.getMode() === 'touch',
      inputMode: this.inputController.getMode(),
      gamepadStyle: this.inputController.getGamepadStyle(),
      gamepadConnected: this.gamepadConnected,
      diddyInView: this.diddyInView,
      transitionFade: this.transitionFade,
      graphicsQuality: this.settings.graphicsQuality,
      fps: Math.round(this.fpsSmoothed),
      frameTimeMs: Math.round(this.frameTimeMsSmoothed * 10) / 10,
      pingMs: this.mpPingMs,
      spectating: this.mpSpectating,
      playerLifeState: this.playerLifeState,
      bleedoutSec: this.bleedoutSec,
      spectateTargetName: this.spectateTargetName,
      bunkerLureCooldownSec: this.bunkerLureCooldownSec,
      neuralInterference: Math.round(this.neuralInterference),
      finalGateSirenSec: this.finalGateSirenSec,
      subtitleText: this.settings.audio.subtitles ? this.subtitleText : null,
      chapter2JustUnlocked: this.chapter2JustUnlocked,
      isNewBestTime: this.isNewBestTime,
      holdBreathActive: hbSnap.active,
      holdBreathProgress: hbSnap.progress,
      holdBreathGauge: hbSnap.gauge,
      holdBreathZoneMin: hbSnap.zoneMin,
      holdBreathZoneMax: hbSnap.zoneMax,
      holdBreathHolding: hbSnap.holding,
      holdBreathWarning: hbSnap.warning,
      chromaticIntensity: this.chromaticIntensity,
      staminaExhausted: this.staminaExhausted,
      maxBattery: this.maxBattery,
      activePerks: [...this.activePerks],
      lastEndingId: this.lastEndingId,
      lastMissionReport: this.lastMissionReport,
    };

    this.callbacks.onHudUpdate(hud);
  }

  // ---- EVENTS, POINTER LOCK, RESIZE / ORIENTATIONCHANGE ----

  private handleResize = (): void => {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.inputController.onKeyboardInput()) {
      this.isMobileTouch = false;
      this.emitHud();
    }
    if (this.mode === 'intro_cutscene' || this.mode === 'ending_cutscene') {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.advanceCutscene();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.skipCutscene();
      }
      return;
    }

    if (this.mode === 'playing') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (this.quickInspect) this.closeQuickInspect();
        else if (this.keypadOpen) this.closeSafeKeypad();
        else if (this.cctvOpen) this.closeCctvMonitor();
        else if (this.workbenchOpen) this.closeWorkbench();
        else if (this.terminalOpen) this.closeSecretTerminal();
        else this.pauseGame();
        return;
      }
      if (this.quickInspect && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.closeQuickInspect();
        return;
      }
      if (this.hasActiveModal()) return;

      this.keysPressed.add(e.code);
      const kb = this.settings.controls.keybinds;
      const kInteract = kb?.interact ?? 'KeyE';
      const kFlash = kb?.flashlight ?? 'KeyF';
      const kUv = kb?.uv ?? 'KeyV';
      const kDrop = kb?.drop ?? 'KeyG';
      const kCrouch = kb?.crouch ?? 'KeyC';
      const kSprint = kb?.sprint ?? 'ShiftLeft';

      if (e.code === kInteract) {
        e.preventDefault();
        this.triggerInteract();
      } else if (e.code === kFlash) {
        e.preventDefault();
        this.toggleFlashlight();
      } else if (e.code === kUv) {
        e.preventDefault();
        this.toggleUvMode();
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        this.triggerContextualUse();
      } else if (e.code === kDrop || e.code === 'KeyX') {
        e.preventDefault();
        this.dropInventoryItem();
      } else if (e.code === kCrouch || e.code === 'ControlLeft') {
        e.preventDefault();
        if (this.settings.gameplay.crouchMode !== 'hold') {
          this.toggleCrouch();
          this.landingDipSpring.impulse(this.crouching ? -0.65 : 0.45);
        }
      } else if ((e.code === kSprint || e.code === 'ShiftRight') && !e.repeat && this.settings.gameplay.sprintMode === 'toggle') {
        this.sprintToggleActive = !this.sprintToggleActive;
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.useFlare();
      } else if (e.code.startsWith('Digit')) {
        const num = Number(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 6) this.selectHotbarSlot(num - 1);
      }
    } else if (this.mode === 'paused') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.resumeGame();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keysPressed.clear();
    this.mobileMoveX = 0;
    this.mobileMoveY = 0;
    this.mobileSprintHeld = false;
    this.mouseDragging = false;
  };

  private handleCanvasClick = (): void => {
    if (this.mode !== 'playing' || this.hasActiveModal() || this.inputController.getMode() === 'touch') return;
    this.audio.unlock();
    if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch {
        // Fallback to drag-look if pointer lock restricted
      }
    }
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private handleTouchStart = (): void => {
    if (this.inputController.onTouchInput(performance.now())) {
      this.isMobileTouch = true;
      this.emitHud();
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (this.mode !== 'playing' || this.hasActiveModal()) return;
    if (this.inputController.onMouseInput(performance.now(), 4)) {
      this.isMobileTouch = false;
      this.emitHud();
    }
    if (Math.abs(e.deltaY) < 4) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.selectHotbarSlot((this.activeSlot + dir + 6) % 6);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.inputController.onMouseInput(performance.now(), 4)) {
      this.isMobileTouch = false;
      this.emitHud();
    }
    if (this.mode !== 'playing' || this.hasActiveModal() || this.inputController.getMode() === 'touch') return;
    if (e.button === 2) {
      // Right-click triggers contextual item use (Stun Gun fire / Throw Can / UV Toggle)
      e.preventDefault();
      this.triggerContextualUse();
      return;
    }
    if (e.button === 0 && !this.pointerLocked) {
      this.mouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.mode === 'playing') e.preventDefault();
  };

  private handleMouseUp = (): void => {
    this.mouseDragging = false;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const moveMag = Math.abs(e.movementX) + Math.abs(e.movementY);
    if (moveMag > 1 && this.inputController.onMouseInput(performance.now(), moveMag)) {
      this.isMobileTouch = false;
      this.emitHud();
    }
    if (this.mode !== 'playing' || this.hasActiveModal()) return;
    if (!this.pointerLocked && !this.mouseDragging) return;
    const dx = this.pointerLocked ? e.movementX : e.clientX - this.lastMouseX;
    const dy = this.pointerLocked ? e.movementY : e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    const crouchMult = this.crouching
      ? Math.max(0.3, Math.min(1.0, this.settings.controls.crouchSensitivityMult ?? 0.7))
      : 1.0;
    const baseSens = 0.0022 * this.settings.controls.lookSensitivity * crouchMult;
    const sensX = baseSens * (this.settings.controls.lookSensitivityX ?? 1.0);
    const sensY = baseSens * (this.settings.controls.lookSensitivityY ?? 1.0);
    const invertSign = this.settings.controls.invertY ? -1 : 1;
    this.targetYaw -= dx * sensX;
    this.targetPitch = Math.max(-1.25, Math.min(1.25, this.targetPitch - dy * sensY * invertSign));
    if ((this.settings.controls.cameraSmoothing ?? 0) <= 0.01) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    }
    this.handPosSpring.impulse(-dx * 0.00085, dy * 0.00068, 0);
    this.handRotSpring.impulse(dy * 0.0028, -dx * 0.0036, -dx * 0.0018);
    this.lookSwayX = Math.max(-0.045, Math.min(0.045, this.lookSwayX - dx * 0.00038));
    this.lookSwayY = Math.max(-0.035, Math.min(0.035, this.lookSwayY + dy * 0.0003));
    if (this.hidingSpot) this.clampHidingLook();
  };

  private exitPointerLock(): void {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.pointerLocked = false;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.addEventListener('click', this.handleCanvasClick);
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubI18n?.();
    this.unsubI18n = null;
    tapeAudioPlayer.stop(false);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.removeEventListener('click', this.handleCanvasClick);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);

    for (const entry of this.remotePeerRigs.values()) {
      this.scene.remove(entry.rig.root);
    }
    this.remotePeerRigs.clear();
    this.worldRegistry.disposeAll();
    if (this.waterManager) {
      this.waterManager.dispose();
      this.waterManager = null;
    }
    this.disposeTransientEffects();
    clearSculptedCache(false);
    this.aimHighlightBox.geometry.dispose();
    this.aimHighlightMat.dispose();
    this.materialPack.dispose();
    this.envRenderTarget.dispose();
    this.cctvRenderTarget.dispose();
    this.bloomPass?.dispose();
    this.filmPass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
    this.flashlight.dispose();
    this.flashlightSpill.dispose();
    this.pmremGen.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__diddyQA;
    }
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
