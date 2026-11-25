import { doesDifficultyUnlockChapter2 } from './difficulty';
import type {
  ActiveRunSnapshotV3,
  CustomKeybinds,
  Difficulty,
  GamepadProfile,
  GameSettings,
  GraphicsQuality,
  HoldToggleMode,
  HudControlId,
  HudControlLayout,
  HudCustomLayout,
  JoystickMode,
  MinimapSizeOption,
  ProfileProgress,
  SaveDataV3,
  ShadowQualityLevel,
  SubtitleSize,
  TextureQualityLevel,
} from './types';

export const DEFAULT_KEYBINDS: CustomKeybinds = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  interact: 'KeyE',
  flashlight: 'KeyF',
  uv: 'KeyV',
  crouch: 'KeyC',
  sprint: 'ShiftLeft',
  drop: 'KeyG',
  journal: 'KeyJ',
  map: 'KeyM',
};

export const HUD_CONTROL_IDS: HudControlId[] = [
  'joystick',
  'interact',
  'sprint',
  'crouch',
  'flashlight',
  'uv',
  'drop',
  'backpack',
  'pause',
];

export const DEFAULT_HUD_LAYOUT: Record<HudControlId, HudControlLayout> = {
  joystick: { xPct: 12, yPct: 74, scale: 1.0, opacity: 0.85 },
  interact: { xPct: 87, yPct: 68, scale: 1.0, opacity: 0.92 },
  sprint: { xPct: 74, yPct: 77, scale: 1.0, opacity: 0.85 },
  crouch: { xPct: 87, yPct: 84, scale: 1.0, opacity: 0.85 },
  flashlight: { xPct: 90, yPct: 33, scale: 1.0, opacity: 0.85 },
  uv: { xPct: 90, yPct: 48, scale: 1.0, opacity: 0.85 },
  drop: { xPct: 77, yPct: 50, scale: 1.0, opacity: 0.82 },
  backpack: { xPct: 12, yPct: 34, scale: 1.0, opacity: 0.85 },
  pause: { xPct: 93, yPct: 11, scale: 1.0, opacity: 0.85 },
};

export const DATASTORE_KEY = 'diddycraft_datastore';
export const CURRENT_SAVE_VERSION = 3 as const;

// Legacy storage keys preserved & migrated losslessly
export const LEGACY_SETTINGS_KEY = 'diddycraft_settings_v2';
export const LEGACY_CHAPTER_PROGRESS_KEY = 'diddycraft_chapter_progress_v1';
export const LEGACY_BEST_TIME_KEY = 'diddycraft_best_escape_sec_v2';
export const LEGACY_CAMPAIGN_SAVE_KEY = 'diddycraft_campaign_save_v2';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function createDefaultSettings(isMobileHint = false): GameSettings {
  const defaultQuality: GraphicsQuality = isMobileHint ? 'medium' : 'high';
  return {
    graphicsQuality: defaultQuality,
    audio: {
      master: 0.85,
      music: 0.65,
      sfx: 0.9,
      voiceTapes: 0.95,
      chaseHeartbeat: 0.9,
      soundOcclusion: true,
      subtitles: true,
      subtitleSize: 'md',
      muted: false,
    },
    controls: {
      lookSensitivity: 1.0,
      lookSensitivityX: 1.0,
      lookSensitivityY: 1.0,
      touchSensitivity: 1.1,
      gamepadSensitivity: 1.0,
      gamepadDeadzone: 0.14,
      gamepadDeadzoneRight: 0.14,
      gamepadProfile: 'auto',
      cameraSmoothing: 0.25,
      rumble: true,
      invertY: false,
      joystickMode: 'fixed',
      hudScale: 1.0,
      hudOpacity: 0.92,
      minimapSize: 'md',
      minimapOpacity: 0.88,
      dynamicCrosshair: true,
      mobileButtonScale: 1.0,
      mobileButtonOpacity: 0.82,
      hudCustomLayout: {},
      keybinds: { ...DEFAULT_KEYBINDS },
    },
    video: {
      fov: 76,
      brightness: 1.0,
      contrast: 1.0,
      fogDensity: 1.0,
      resolutionScale: 1.0,
      textureQuality: isMobileHint ? 'medium' : 'high',
      shadowsLevel: isMobileHint ? 'medium' : 'high',
      shadowsOverride: 'auto',
      waterReflections: true,
      waterQuality: isMobileHint ? 'low' : 'high',
      postProcessingOverride: 'auto',
      volumetricDust: true,
      rainParticles: true,
      showFps: false,
    },
    gameplay: {
      headBobIntensity: 1.0,
      vignetteIntensity: 1.0,
      sprintMode: 'hold',
      crouchMode: 'toggle',
      itemOutline: true,
      holdBreathAssist: false,
      visualAudioCues: true,
      showNoiseIndicator: true,
      showObjectiveHints: true,
      showSpeedrunTimer: false,
    },
  };
}

export function createDefaultProfile(): ProfileProgress {
  return {
    chaptersUnlocked: [1],
    completedDifficulties: {},
    bestTimesSec: {},
    totalEscapes: 0,
    totalPlaytimeSec: 0,
    argSecretsSolved: [],
  };
}

export function createDefaultSaveData(isMobileHint = false): SaveDataV3 {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    updatedAt: Date.now(),
    profile: createDefaultProfile(),
    settings: createDefaultSettings(isMobileHint),
    activeRun: null,
  };
}

/**
 * Single source of truth for Chapter 2 unlock status:
 * Chapter 2 is ONLY unlocked if Chapter 1 was genuinely beaten on Hard or Nightmare.
 * Practice and Easy completions NEVER unlock Chapter 2.
 */
export function isChapter2UnlockedFromProfile(profile: ProfileProgress): boolean {
  const ch1Done = profile.completedDifficulties['ch1'] ?? [];
  return ch1Done.some((d) => doesDifficultyUnlockChapter2(d));
}

function normalizeGraphicsQuality(raw: unknown, fallback: GraphicsQuality): GraphicsQuality {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'ultra') return raw;
  if (raw === 'very_low') return 'low';
  if (raw === 'custom') return 'high';
  return fallback;
}

function normalizeTriState(raw: unknown): 'auto' | 'on' | 'off' {
  if (raw === 'on' || raw === 'off' || raw === 'auto') return raw;
  return 'auto';
}

function normalizeJoystickMode(raw: unknown): JoystickMode {
  return raw === 'floating' ? 'floating' : 'fixed';
}

function normalizeGamepadProfile(raw: unknown): GamepadProfile {
  if (raw === 'standard' || raw === 'ds4_android' || raw === 'auto') return raw;
  return 'auto';
}

export function sanitizeHudCustomLayout(raw: unknown): HudCustomLayout {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  const out: HudCustomLayout = {};
  for (const id of HUD_CONTROL_IDS) {
    const entry = src[id];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const base = DEFAULT_HUD_LAYOUT[id];
    out[id] = {
      xPct: Math.round(clamp(Number(e.xPct ?? base.xPct), 4, 96) * 10) / 10,
      yPct: Math.round(clamp(Number(e.yPct ?? base.yPct), 6, 94) * 10) / 10,
      scale: Math.round(clamp(Number(e.scale ?? base.scale), 0.7, 1.5) * 100) / 100,
      opacity: Math.round(clamp(Number(e.opacity ?? base.opacity), 0.3, 1.0) * 100) / 100,
    };
  }
  return out;
}

function normalizeShadowLevel(
  raw: unknown,
  override: 'auto' | 'on' | 'off',
  quality: GraphicsQuality
): ShadowQualityLevel {
  if (raw === 'off' || raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'ultra') {
    return raw;
  }
  if (override === 'off') return 'off';
  if (quality === 'low') return override === 'on' ? 'low' : 'off';
  return quality;
}

function normalizeTextureQuality(raw: unknown, fallback: TextureQualityLevel): TextureQualityLevel {
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  return fallback;
}

function normalizeSubtitleSize(raw: unknown): SubtitleSize {
  if (raw === 'sm' || raw === 'md' || raw === 'lg') return raw;
  return 'md';
}

function normalizeMinimapSize(raw: unknown): MinimapSizeOption {
  if (raw === 'sm' || raw === 'md' || raw === 'lg') return raw;
  return 'md';
}

function normalizeHoldToggle(raw: unknown, fallback: HoldToggleMode): HoldToggleMode {
  if (raw === 'hold' || raw === 'toggle') return raw;
  return fallback;
}

function sanitizeKeybinds(raw: unknown): CustomKeybinds {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_KEYBINDS };
  const r = raw as Record<string, unknown>;
  const pick = (k: keyof CustomKeybinds): string => {
    const val = r[k];
    if (typeof val === 'string' && val.trim().length > 0 && val.length <= 24) {
      return val.trim();
    }
    return DEFAULT_KEYBINDS[k];
  };
  return {
    moveForward: pick('moveForward'),
    moveBack: pick('moveBack'),
    moveLeft: pick('moveLeft'),
    moveRight: pick('moveRight'),
    interact: pick('interact'),
    flashlight: pick('flashlight'),
    uv: pick('uv'),
    crouch: pick('crouch'),
    sprint: pick('sprint'),
    drop: pick('drop'),
    journal: pick('journal'),
    map: pick('map'),
  };
}

export function sanitizeSettings(raw: unknown, isMobileHint = false): GameSettings {
  const def = createDefaultSettings(isMobileHint);
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;
  const audioRaw = (r.audio && typeof r.audio === 'object' ? r.audio : {}) as Record<string, unknown>;
  const controlsRaw = (r.controls && typeof r.controls === 'object' ? r.controls : {}) as Record<string, unknown>;
  const videoRaw = (r.video && typeof r.video === 'object' ? r.video : {}) as Record<string, unknown>;
  const gameplayRaw = (r.gameplay && typeof r.gameplay === 'object' ? r.gameplay : {}) as Record<string, unknown>;

  const graphicsQuality = normalizeGraphicsQuality(r.graphicsQuality ?? r.preset, def.graphicsQuality);
  const shadowsOverride = normalizeTriState(videoRaw.shadowsOverride);
  const shadowsLevel = normalizeShadowLevel(videoRaw.shadowsLevel, shadowsOverride, graphicsQuality);
  const lookX = clamp(
    Number(controlsRaw.lookSensitivityX ?? controlsRaw.lookSensitivity ?? r.mouseSensitivity ?? def.controls.lookSensitivityX),
    0.3,
    2.5
  );
  const lookY = clamp(
    Number(controlsRaw.lookSensitivityY ?? controlsRaw.lookSensitivity ?? r.mouseSensitivity ?? def.controls.lookSensitivityY),
    0.3,
    2.5
  );
  const deadzoneLeft = clamp(Number(controlsRaw.gamepadDeadzone ?? def.controls.gamepadDeadzone), 0.05, 0.35);
  const deadzoneRight = clamp(
    Number(controlsRaw.gamepadDeadzoneRight ?? controlsRaw.gamepadDeadzone ?? def.controls.gamepadDeadzoneRight),
    0.05,
    0.35
  );

  return {
    graphicsQuality,
    audio: {
      master: clamp(Number(audioRaw.master ?? r.masterVolume ?? def.audio.master), 0, 1),
      music: clamp(Number(audioRaw.music ?? r.ambientVolume ?? def.audio.music), 0, 1),
      sfx: clamp(Number(audioRaw.sfx ?? r.sfxVolume ?? def.audio.sfx), 0, 1),
      voiceTapes: clamp(Number(audioRaw.voiceTapes ?? def.audio.voiceTapes), 0, 1),
      chaseHeartbeat: clamp(Number(audioRaw.chaseHeartbeat ?? def.audio.chaseHeartbeat), 0, 1),
      soundOcclusion:
        audioRaw.soundOcclusion !== undefined ? Boolean(audioRaw.soundOcclusion) : def.audio.soundOcclusion,
      subtitles: audioRaw.subtitles !== undefined ? Boolean(audioRaw.subtitles) : def.audio.subtitles,
      subtitleSize: normalizeSubtitleSize(audioRaw.subtitleSize),
      muted: Boolean(audioRaw.muted ?? def.audio.muted),
    },
    controls: {
      lookSensitivity: lookX,
      lookSensitivityX: lookX,
      lookSensitivityY: lookY,
      touchSensitivity: clamp(Number(controlsRaw.touchSensitivity ?? r.touchSensitivity ?? def.controls.touchSensitivity), 0.4, 2.5),
      gamepadSensitivity: clamp(Number(controlsRaw.gamepadSensitivity ?? def.controls.gamepadSensitivity), 0.3, 2.5),
      gamepadDeadzone: deadzoneLeft,
      gamepadDeadzoneRight: deadzoneRight,
      gamepadProfile: normalizeGamepadProfile(controlsRaw.gamepadProfile),
      cameraSmoothing: Math.round(clamp(Number(controlsRaw.cameraSmoothing ?? def.controls.cameraSmoothing), 0, 1) * 100) / 100,
      rumble: controlsRaw.rumble !== undefined ? Boolean(controlsRaw.rumble) : def.controls.rumble,
      invertY: Boolean(controlsRaw.invertY ?? r.invertY ?? def.controls.invertY),
      joystickMode: normalizeJoystickMode(controlsRaw.joystickMode),
      hudScale: Math.round(clamp(Number(controlsRaw.hudScale ?? def.controls.hudScale), 0.75, 1.25) * 100) / 100,
      hudOpacity: Math.round(clamp(Number(controlsRaw.hudOpacity ?? def.controls.hudOpacity), 0.4, 1.0) * 100) / 100,
      minimapSize: normalizeMinimapSize(controlsRaw.minimapSize),
      minimapOpacity: Math.round(clamp(Number(controlsRaw.minimapOpacity ?? def.controls.minimapOpacity), 0.4, 1.0) * 100) / 100,
      dynamicCrosshair:
        controlsRaw.dynamicCrosshair !== undefined ? Boolean(controlsRaw.dynamicCrosshair) : def.controls.dynamicCrosshair,
      mobileButtonScale: clamp(Number(controlsRaw.mobileButtonScale ?? def.controls.mobileButtonScale), 0.85, 1.3),
      mobileButtonOpacity: clamp(Number(controlsRaw.mobileButtonOpacity ?? def.controls.mobileButtonOpacity), 0.35, 1.0),
      hudCustomLayout: sanitizeHudCustomLayout(controlsRaw.hudCustomLayout),
      keybinds: sanitizeKeybinds(controlsRaw.keybinds),
    },
    video: {
      fov: Math.round(clamp(Number(videoRaw.fov ?? r.fov ?? def.video.fov), 60, 105)),
      brightness: Math.round(clamp(Number(videoRaw.brightness ?? def.video.brightness), 0.65, 1.5) * 100) / 100,
      contrast: Math.round(clamp(Number(videoRaw.contrast ?? def.video.contrast), 0.75, 1.35) * 100) / 100,
      fogDensity: Math.round(clamp(Number(videoRaw.fogDensity ?? def.video.fogDensity), 0.5, 1.6) * 100) / 100,
      resolutionScale: Math.round(clamp(Number(videoRaw.resolutionScale ?? def.video.resolutionScale), 0.5, 1.25) * 100) / 100,
      textureQuality: normalizeTextureQuality(videoRaw.textureQuality, def.video.textureQuality),
      shadowsLevel,
      shadowsOverride,
      waterReflections:
        videoRaw.waterReflections !== undefined ? Boolean(videoRaw.waterReflections) : def.video.waterReflections,
      waterQuality: videoRaw.waterQuality === 'low' || videoRaw.waterQuality === 'high'
        ? videoRaw.waterQuality
        : def.video.waterQuality,
      postProcessingOverride: normalizeTriState(videoRaw.postProcessingOverride),
      volumetricDust: videoRaw.volumetricDust !== undefined ? Boolean(videoRaw.volumetricDust) : def.video.volumetricDust,
      rainParticles: videoRaw.rainParticles !== undefined ? Boolean(videoRaw.rainParticles) : def.video.rainParticles,
      showFps: Boolean(videoRaw.showFps ?? def.video.showFps),
    },
    gameplay: {
      headBobIntensity: Math.round(clamp(Number(gameplayRaw.headBobIntensity ?? def.gameplay.headBobIntensity), 0, 1.5) * 100) / 100,
      vignetteIntensity: Math.round(clamp(Number(gameplayRaw.vignetteIntensity ?? def.gameplay.vignetteIntensity), 0, 1.5) * 100) / 100,
      sprintMode: normalizeHoldToggle(gameplayRaw.sprintMode, def.gameplay.sprintMode),
      crouchMode: normalizeHoldToggle(gameplayRaw.crouchMode, def.gameplay.crouchMode),
      itemOutline: gameplayRaw.itemOutline !== undefined ? Boolean(gameplayRaw.itemOutline) : def.gameplay.itemOutline,
      holdBreathAssist: gameplayRaw.holdBreathAssist !== undefined ? Boolean(gameplayRaw.holdBreathAssist) : def.gameplay.holdBreathAssist,
      visualAudioCues: gameplayRaw.visualAudioCues !== undefined ? Boolean(gameplayRaw.visualAudioCues) : def.gameplay.visualAudioCues,
      showNoiseIndicator: gameplayRaw.showNoiseIndicator !== undefined ? Boolean(gameplayRaw.showNoiseIndicator) : def.gameplay.showNoiseIndicator,
      showObjectiveHints: gameplayRaw.showObjectiveHints !== undefined ? Boolean(gameplayRaw.showObjectiveHints) : def.gameplay.showObjectiveHints,
      showSpeedrunTimer: gameplayRaw.showSpeedrunTimer !== undefined ? Boolean(gameplayRaw.showSpeedrunTimer) : def.gameplay.showSpeedrunTimer,
    },
  };
}

const VALID_DIFFS = new Set<Difficulty>(['practice', 'easy', 'hard', 'nightmare']);

function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && VALID_DIFFS.has(v as Difficulty);
}

export function sanitizeProfile(raw: unknown): ProfileProgress {
  const def = createDefaultProfile();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;

  const completedDifficulties: Record<string, Difficulty[]> = {};
  if (r.completedDifficulties && typeof r.completedDifficulties === 'object') {
    for (const [k, arr] of Object.entries(r.completedDifficulties as Record<string, unknown>)) {
      if (Array.isArray(arr)) {
        const clean = Array.from(new Set(arr.filter(isDifficulty)));
        if (clean.length > 0) completedDifficulties[k] = clean;
      }
    }
  }

  const bestTimesSec: Record<string, Partial<Record<Difficulty, number>>> = {};
  if (r.bestTimesSec && typeof r.bestTimesSec === 'object') {
    for (const [chKey, diffMap] of Object.entries(r.bestTimesSec as Record<string, unknown>)) {
      if (diffMap && typeof diffMap === 'object') {
        const cleanMap: Partial<Record<Difficulty, number>> = {};
        for (const [dKey, secVal] of Object.entries(diffMap as Record<string, unknown>)) {
          const sec = Number(secVal);
          if (isDifficulty(dKey) && Number.isFinite(sec) && sec > 0) {
            cleanMap[dKey] = Math.round(sec * 10) / 10;
          }
        }
        if (Object.keys(cleanMap).length > 0) bestTimesSec[chKey] = cleanMap;
      }
    }
  }

  // STRICT ENFORCEMENT:
  // Chapter 2 is ONLY unlocked if ch1 completedDifficulties includes 'hard' or 'nightmare'.
  // Any stale/buggy chaptersUnlocked containing 2 from Practice/Easy is automatically corrected.
  const chaptersSet = new Set<number>([1]);
  const ch1Done = completedDifficulties['ch1'] ?? [];
  if (ch1Done.some((d) => doesDifficultyUnlockChapter2(d))) {
    chaptersSet.add(2);
  }

  const argSecretsSolved = Array.isArray(r.argSecretsSolved)
    ? Array.from(new Set(r.argSecretsSolved.filter((s): s is string => typeof s === 'string')))
    : [];

  return {
    chaptersUnlocked: Array.from(chaptersSet).sort((a, b) => a - b),
    completedDifficulties,
    bestTimesSec,
    totalEscapes: Math.max(0, Math.floor(Number(r.totalEscapes ?? 0) || 0)),
    totalPlaytimeSec: Math.max(0, Number(r.totalPlaytimeSec ?? 0) || 0),
    argSecretsSolved,
  };
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Pure migration function: upgrades v1/v2 legacy keys or partial v3 objects into a
 * validated SaveDataV3 envelope without losing unlocked chapters, completed difficulties,
 * best escape times, or user settings.
 * Enforces Hard/Nightmare requirement for Chapter 2 unlocks.
 */
export function migrateFromStorage(storage: StorageLike, isMobileHint = false): {
  data: SaveDataV3;
  migrated: boolean;
} {
  const existingRaw = safeParseJson(storage.getItem(DATASTORE_KEY));
  if (existingRaw && typeof existingRaw === 'object') {
    const obj = existingRaw as Record<string, unknown>;
    if (obj.saveVersion === CURRENT_SAVE_VERSION) {
      const sanitized: SaveDataV3 = {
        saveVersion: CURRENT_SAVE_VERSION,
        updatedAt: Number(obj.updatedAt) || Date.now(),
        profile: sanitizeProfile(obj.profile),
        settings: sanitizeSettings(obj.settings, isMobileHint),
        activeRun:
          obj.activeRun && typeof obj.activeRun === 'object'
            ? (obj.activeRun as ActiveRunSnapshotV3)
            : null,
      };
      return { data: sanitized, migrated: false };
    }
  }

  // Migrate from legacy v1/v2 keys
  const base = createDefaultSaveData(isMobileHint);
  let migrated = false;

  // 1. Legacy Settings (`diddycraft_settings_v2`)
  const legacySettings = safeParseJson(storage.getItem(LEGACY_SETTINGS_KEY));
  if (legacySettings && typeof legacySettings === 'object') {
    const ls = legacySettings as Record<string, unknown>;
    const mobileLayout = (ls.mobileLayout && typeof ls.mobileLayout === 'object'
      ? ls.mobileLayout
      : {}) as Record<string, unknown>;
    base.settings = sanitizeSettings(
      {
        preset: ls.preset,
        masterVolume: ls.masterVolume,
        ambientVolume: ls.ambientVolume,
        sfxVolume: ls.sfxVolume,
        mouseSensitivity: ls.mouseSensitivity,
        touchSensitivity: ls.touchSensitivity,
        invertY: ls.invertY,
        fov: ls.fov,
        controls: {
          mobileButtonScale: mobileLayout.buttonScale ?? 1.0,
          mobileButtonOpacity: mobileLayout.opacity ?? 0.82,
        },
      },
      isMobileHint
    );
    migrated = true;
  }

  // 2. Legacy Chapter Progress (`diddycraft_chapter_progress_v1`)
  const legacyProgress = safeParseJson(storage.getItem(LEGACY_CHAPTER_PROGRESS_KEY));
  if (legacyProgress && typeof legacyProgress === 'object') {
    const lp = legacyProgress as Record<string, unknown>;
    const ch1Diffs = new Set<Difficulty>();
    const ch1Best: Partial<Record<Difficulty, number>> = {};

    if (lp.bestTimes && typeof lp.bestTimes === 'object') {
      for (const [k, v] of Object.entries(lp.bestTimes as Record<string, unknown>)) {
        const sec = Number(v);
        if (isDifficulty(k) && Number.isFinite(sec) && sec > 0) {
          ch1Best[k] = Math.round(sec * 10) / 10;
          ch1Diffs.add(k);
        }
      }
    }
    // Only grant Hard completion if legacy explicitly recorded Hard completion
    if (lp.chapter1CompletedHard === true) {
      ch1Diffs.add('hard');
    } else if (lp.chapter1Completed === true && ch1Diffs.size === 0) {
      ch1Diffs.add('easy');
    }

    if (ch1Diffs.size > 0) {
      base.profile.completedDifficulties['ch1'] = Array.from(ch1Diffs);
      base.profile.totalEscapes = Math.max(1, ch1Diffs.size);
    }
    if (Object.keys(ch1Best).length > 0) {
      base.profile.bestTimesSec['ch1'] = ch1Best;
    }
    migrated = true;
  }

  // 3. Legacy single best escape time (`diddycraft_best_escape_sec_v2`)
  // Preserve time record under 'easy' if no hard/nightmare completion exists,
  // so legacy Easy/Practice runs never accidentally unlock Chapter 2!
  const legacyBestRaw = storage.getItem(LEGACY_BEST_TIME_KEY);
  if (legacyBestRaw) {
    const sec = Number(legacyBestRaw);
    if (Number.isFinite(sec) && sec > 0) {
      const ch1Best = base.profile.bestTimesSec['ch1'] ?? {};
      const done = new Set<Difficulty>(base.profile.completedDifficulties['ch1'] ?? []);
      const targetDiff: Difficulty = done.has('hard') ? 'hard' : 'easy';
      const existingTime = ch1Best[targetDiff];
      if (existingTime === undefined || sec < existingTime) {
        ch1Best[targetDiff] = Math.round(sec * 10) / 10;
      }
      base.profile.bestTimesSec['ch1'] = ch1Best;
      done.add(targetDiff);
      base.profile.completedDifficulties['ch1'] = Array.from(done);
      base.profile.totalEscapes = Math.max(base.profile.totalEscapes, 1);
      migrated = true;
    }
  }

  // 4. Legacy v2 mid-run campaign snapshot: preserve ARG solved badge only
  const legacyRun = safeParseJson(storage.getItem(LEGACY_CAMPAIGN_SAVE_KEY));
  if (legacyRun && typeof legacyRun === 'object') {
    const lr = legacyRun as Record<string, unknown>;
    if (lr.argSolved === true && !base.profile.argSecretsSolved.includes('legacy_sector09')) {
      base.profile.argSecretsSolved.push('legacy_sector09');
    }
    base.activeRun = null;
    migrated = true;
  }

  base.profile = sanitizeProfile(base.profile);
  return { data: base, migrated };
}

// Optional non-blocking IndexedDB backup mirror (browser only)
const IDB_NAME = 'diddycraft_datastore_idb';
const IDB_STORE = 'saves';

function mirrorToIndexedDb(data: SaveDataV3): void {
  if (typeof indexedDB === 'undefined') return;
  try {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(data, DATASTORE_KEY);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      } catch {
        // Ignore IDB quota/private-browsing restrictions
      }
    };
  } catch {
    // Ignore IDB unavailable
  }
}

class SaveManager {
  private cache: SaveDataV3 | null = null;

  private getStorage(): StorageLike | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private detectMobileHint(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth <= 920 ||
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    );
  }

  load(): SaveDataV3 {
    if (this.cache) return this.cache;
    const storage = this.getStorage();
    const isMobile = this.detectMobileHint();
    if (!storage) {
      this.cache = createDefaultSaveData(isMobile);
      return this.cache;
    }
    try {
      const { data, migrated } = migrateFromStorage(storage, isMobile);
      this.cache = data;
      if (migrated || !storage.getItem(DATASTORE_KEY)) {
        this.persist(data);
      }
      return data;
    } catch {
      this.cache = createDefaultSaveData(isMobile);
      return this.cache;
    }
  }

  persist(data: SaveDataV3): void {
    const next: SaveDataV3 = {
      ...data,
      profile: sanitizeProfile(data.profile),
      saveVersion: CURRENT_SAVE_VERSION,
      updatedAt: Date.now(),
    };
    this.cache = next;
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(DATASTORE_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota errors
      }
    }
    mirrorToIndexedDb(next);
  }

  getSettings(): GameSettings {
    return this.load().settings;
  }

  updateSettings(patch: GameSettings): GameSettings {
    const current = this.load();
    const clean = sanitizeSettings(patch, this.detectMobileHint());
    this.persist({ ...current, settings: clean });
    return clean;
  }

  resetSettings(): GameSettings {
    const current = this.load();
    const fresh = createDefaultSettings(this.detectMobileHint());
    this.persist({ ...current, settings: fresh });
    return fresh;
  }

  getProfile(): ProfileProgress {
    return this.load().profile;
  }

  isChapter2Unlocked(): boolean {
    return isChapter2UnlockedFromProfile(this.load().profile);
  }

  /**
   * Pure helper (also exported below for direct unit testing) that records a Chapter 1 win
   * and ONLY unlocks Chapter 2 when difficulty is 'hard' or 'nightmare'.
   */
  recordChapter1Completion(
    difficulty: Difficulty,
    clearTimeSec: number,
    argSolved: boolean
  ): {
    profile: ProfileProgress;
    chapter2JustUnlocked: boolean;
    isNewBestTime: boolean;
  } {
    const current = this.load();
    const res = applyChapter1CompletionToProfile(
      current.profile,
      difficulty,
      clearTimeSec,
      argSolved
    );

    this.persist({
      ...current,
      profile: res.profile,
      activeRun: null,
    });

    return {
      profile: this.load().profile,
      chapter2JustUnlocked: res.chapter2JustUnlocked,
      isNewBestTime: res.isNewBestTime,
    };
  }

  saveActiveRun(snapshot: ActiveRunSnapshotV3): void {
    const current = this.load();
    this.persist({ ...current, activeRun: snapshot });
  }

  clearActiveRun(): void {
    const current = this.load();
    if (current.activeRun !== null) {
      this.persist({ ...current, activeRun: null });
    }
  }
}

export function applyChapter1CompletionToProfile(
  existingProfile: ProfileProgress,
  difficulty: Difficulty,
  clearTimeSec: number,
  argSolved: boolean
): {
  profile: ProfileProgress;
  chapter2JustUnlocked: boolean;
  isNewBestTime: boolean;
} {
  const cleanExisting = sanitizeProfile(existingProfile);
  const wasCh2Unlocked = isChapter2UnlockedFromProfile(cleanExisting);

  const ch1Done = new Set<Difficulty>(cleanExisting.completedDifficulties['ch1'] ?? []);
  ch1Done.add(difficulty);

  const roundedTime = Math.max(1, Math.round(clearTimeSec * 10) / 10);
  const ch1Times = { ...(cleanExisting.bestTimesSec['ch1'] ?? {}) };
  const prevBest = ch1Times[difficulty];
  const isNewBestTime = prevBest === undefined || roundedTime < prevBest;
  if (isNewBestTime) {
    ch1Times[difficulty] = roundedTime;
  }

  const argSecretsSolved = [...cleanExisting.argSecretsSolved];
  if (argSolved && !argSecretsSolved.includes('ch1_safe_code')) {
    argSecretsSolved.push('ch1_safe_code');
  }

  const updatedProfile = sanitizeProfile({
    ...cleanExisting,
    completedDifficulties: {
      ...cleanExisting.completedDifficulties,
      ch1: Array.from(ch1Done),
    },
    bestTimesSec: {
      ...cleanExisting.bestTimesSec,
      ch1: ch1Times,
    },
    totalEscapes: cleanExisting.totalEscapes + 1,
    totalPlaytimeSec: cleanExisting.totalPlaytimeSec + roundedTime,
    argSecretsSolved,
  });

  const nowCh2Unlocked = isChapter2UnlockedFromProfile(updatedProfile);
  return {
    profile: updatedProfile,
    chapter2JustUnlocked: !wasCh2Unlocked && nowCh2Unlocked && doesDifficultyUnlockChapter2(difficulty),
    isNewBestTime,
  };
}

export const saveManager = new SaveManager();
