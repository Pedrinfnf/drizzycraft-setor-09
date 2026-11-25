import test from 'node:test';
import assert from 'node:assert/strict';
import { getDifficultyConfig, doesDifficultyUnlockChapter2 } from './difficulty';
import {
  CURRENT_SAVE_VERSION,
  DATASTORE_KEY,
  LEGACY_BEST_TIME_KEY,
  LEGACY_CAMPAIGN_SAVE_KEY,
  LEGACY_CHAPTER_PROGRESS_KEY,
  LEGACY_SETTINGS_KEY,
  applyChapter1CompletionToProfile,
  createDefaultProfile,
  isChapter2UnlockedFromProfile,
  migrateFromStorage,
  sanitizeHudCustomLayout,
  sanitizeProfile,
  sanitizeSettings,
  type StorageLike,
} from './saveManager';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

test('migrates legacy v1/v2 keys into saveVersion 3 without losing unlocks, records, or settings', () => {
  const storage = new MemoryStorage();
  storage.setItem(
    LEGACY_SETTINGS_KEY,
    JSON.stringify({
      preset: 'ultra',
      masterVolume: 0.72,
      ambientVolume: 0.44,
      sfxVolume: 0.91,
      mouseSensitivity: 1.4,
      touchSensitivity: 1.6,
      invertY: true,
      fov: 86,
      mobileLayout: { buttonScale: 1.2, opacity: 0.75 },
    })
  );
  storage.setItem(
    LEGACY_CHAPTER_PROGRESS_KEY,
    JSON.stringify({
      chapter1Completed: true,
      chapter1CompletedHard: true,
      chapter2Unlocked: true,
      bestTimes: { easy: 185.4, hard: 142.8 },
    })
  );
  storage.setItem(LEGACY_BEST_TIME_KEY, '130.5');
  storage.setItem(
    LEGACY_CAMPAIGN_SAVE_KEY,
    JSON.stringify({
      version: 2,
      argSolved: true,
      playerX: 40,
      playerZ: 40,
    })
  );

  const { data, migrated } = migrateFromStorage(storage, false);

  assert.equal(migrated, true);
  assert.equal(data.saveVersion, CURRENT_SAVE_VERSION);
  assert.deepEqual(data.profile.chaptersUnlocked, [1, 2]);
  assert.ok(data.profile.completedDifficulties['ch1']?.includes('easy'));
  assert.ok(data.profile.completedDifficulties['ch1']?.includes('hard'));
  assert.equal(data.profile.bestTimesSec['ch1']?.easy, 185.4);
  assert.equal(data.profile.bestTimesSec['ch1']?.hard, 130.5);
  assert.equal(data.settings.graphicsQuality, 'ultra');
  assert.equal(data.settings.audio.master, 0.72);
  assert.equal(data.settings.audio.music, 0.44);
  assert.equal(data.settings.audio.sfx, 0.91);
  assert.equal(data.settings.controls.lookSensitivity, 1.4);
  assert.equal(data.settings.controls.invertY, true);
  assert.equal(data.settings.controls.mobileButtonScale, 1.2);
  assert.equal(data.settings.controls.mobileButtonOpacity, 0.75);
  assert.equal(data.settings.video.fov, 86);
  assert.equal(data.activeRun, null);
  assert.ok(data.profile.argSecretsSolved.includes('legacy_sector09'));
});

test('Practice and Easy victories NEVER unlock Chapter 2; ONLY Hard or Nightmare unlock Chapter 2', () => {
  assert.equal(doesDifficultyUnlockChapter2('practice'), false);
  assert.equal(doesDifficultyUnlockChapter2('easy'), false);
  assert.equal(doesDifficultyUnlockChapter2('hard'), true);
  assert.equal(doesDifficultyUnlockChapter2('nightmare'), true);

  let profile = createDefaultProfile();

  // Win on Practice -> MUST NOT unlock Chapter 2
  const resPractice = applyChapter1CompletionToProfile(profile, 'practice', 120.5, true);
  assert.equal(resPractice.chapter2JustUnlocked, false);
  assert.deepEqual(resPractice.profile.chaptersUnlocked, [1]);
  assert.equal(isChapter2UnlockedFromProfile(resPractice.profile), false);
  assert.ok(resPractice.profile.completedDifficulties['ch1']?.includes('practice'));

  // Win on Easy -> MUST NOT unlock Chapter 2
  profile = resPractice.profile;
  const resEasy = applyChapter1CompletionToProfile(profile, 'easy', 140.2, true);
  assert.equal(resEasy.chapter2JustUnlocked, false);
  assert.deepEqual(resEasy.profile.chaptersUnlocked, [1]);
  assert.equal(isChapter2UnlockedFromProfile(resEasy.profile), false);
  assert.ok(resEasy.profile.completedDifficulties['ch1']?.includes('easy'));

  // Win on Hard -> MUST unlock Chapter 2
  profile = resEasy.profile;
  const resHard = applyChapter1CompletionToProfile(profile, 'hard', 155.8, true);
  assert.equal(resHard.chapter2JustUnlocked, true);
  assert.deepEqual(resHard.profile.chaptersUnlocked, [1, 2]);
  assert.equal(isChapter2UnlockedFromProfile(resHard.profile), true);

  // Win on Nightmare from fresh profile -> MUST unlock Chapter 2
  const resNightmare = applyChapter1CompletionToProfile(createDefaultProfile(), 'nightmare', 110.0, true);
  assert.equal(resNightmare.chapter2JustUnlocked, true);
  assert.deepEqual(resNightmare.profile.chaptersUnlocked, [1, 2]);
  assert.equal(isChapter2UnlockedFromProfile(resNightmare.profile), true);
});

test('sanitizeProfile strips stale buggy Chapter 2 unlock if Hard/Nightmare was never completed', () => {
  const buggySave = {
    chaptersUnlocked: [1, 2],
    completedDifficulties: { ch1: ['practice', 'easy'] },
    bestTimesSec: { ch1: { easy: 200 } },
    totalEscapes: 2,
    argSecretsSolved: [],
  };
  const healed = sanitizeProfile(buggySave);
  assert.deepEqual(healed.chaptersUnlocked, [1]);
  assert.equal(isChapter2UnlockedFromProfile(healed), false);
  assert.deepEqual(healed.completedDifficulties['ch1'], ['practice', 'easy']);
});

test('difficulty HP fairness: Easy=3 hits, Hard=2 hits, Nightmare=1 hit', () => {
  assert.equal(getDifficultyConfig('easy').playerMaxHealth, 3);
  assert.equal(getDifficultyConfig('hard').playerMaxHealth, 2);
  assert.equal(getDifficultyConfig('nightmare').playerMaxHealth, 1);
});

test('handles corrupted JSON safely without crashing or losing valid defaults', () => {
  const storage = new MemoryStorage();
  storage.setItem(DATASTORE_KEY, '{broken_json');
  storage.setItem(LEGACY_SETTINGS_KEY, 'not-json');

  const { data } = migrateFromStorage(storage, true);
  assert.equal(data.saveVersion, 3);
  assert.deepEqual(data.profile.chaptersUnlocked, [1]);
  assert.equal(data.settings.graphicsQuality, 'medium');
  assert.equal(data.settings.video.fov, 76);
});

test('sanitizes 4-tab GameSettings ranges and clamps custom mobile HUD layout bounds', () => {
  const sanitized = sanitizeSettings({
    graphicsQuality: 'high',
    audio: { master: 5, music: -1, sfx: 0.7, voiceTapes: 2, subtitles: false, muted: false },
    controls: {
      lookSensitivity: 10,
      touchSensitivity: 0.01,
      gamepadSensitivity: 9,
      gamepadDeadzone: 0.99,
      invertY: true,
      joystickMode: 'floating',
      mobileButtonScale: 5,
      mobileButtonOpacity: 0.05,
      hudCustomLayout: {
        joystick: { xPct: -20, yPct: 120, scale: 9, opacity: 0.01 },
        interact: { xPct: 82, yPct: 65, scale: 1.1, opacity: 0.9 },
      },
    },
    video: {
      fov: 180,
      brightness: 5,
      resolutionScale: 0.1,
      shadowsOverride: 'on',
      postProcessingOverride: 'off',
      volumetricDust: false,
      showFps: true,
    },
    gameplay: {
      headBobIntensity: 4,
      showNoiseIndicator: false,
      showObjectiveHints: false,
    },
  });

  assert.equal(sanitized.audio.master, 1);
  assert.equal(sanitized.audio.music, 0);
  assert.equal(sanitized.audio.voiceTapes, 1);
  assert.equal(sanitized.audio.subtitles, false);
  assert.equal(sanitized.controls.joystickMode, 'floating');
  assert.equal(sanitized.controls.gamepadDeadzone, 0.35);
  assert.equal(sanitized.video.fov, 105);
  assert.equal(sanitized.video.brightness, 1.5);
  assert.equal(sanitized.video.resolutionScale, 0.5);
  assert.equal(sanitized.video.shadowsOverride, 'on');
  assert.equal(sanitized.video.postProcessingOverride, 'off');
  assert.equal(sanitized.video.showFps, true);
  assert.equal(sanitized.gameplay.headBobIntensity, 1.5);
  assert.equal(sanitized.gameplay.showNoiseIndicator, false);

  const hud = sanitizeHudCustomLayout({
    joystick: { xPct: -15, yPct: 140, scale: 3, opacity: 0.1 },
    unknown_id: { xPct: 50, yPct: 50, scale: 1, opacity: 1 },
  });
  assert.equal(hud.joystick?.xPct, 4);
  assert.equal(hud.joystick?.yPct, 94);
  assert.equal(hud.joystick?.scale, 1.5);
  assert.equal(hud.joystick?.opacity, 0.3);
  assert.equal(Object.keys(hud).length, 1);
});

