import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATASTORE_KEY,
  LEGACY_BEST_TIME_KEY,
  LEGACY_CHAPTER_PROGRESS_KEY,
  LEGACY_SETTINGS_KEY,
  type StorageLike,
} from './saveManager';
import {
  ACHIEVEMENT_CATALOG,
  MAX_EQUIPPED_PERKS,
  PERK_CATALOG,
  SAVE_V4_KEY,
  SAVE_V4_VERSION,
  SaveSystem,
  calculateMissionReport,
  exportSaveBackupCode,
  getPerkRequirementStatus,
  importSaveBackupCode,
  migrateStorageToV4,
} from './saveSystem';

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

test('Save v4: migrates v3 datastore and legacy keys cleanly without losing progress or settings', () => {
  const storage = new MemoryStorage();
  storage.setItem(
    DATASTORE_KEY,
    JSON.stringify({
      saveVersion: 3,
      updatedAt: 1700000000000,
      profile: {
        chaptersUnlocked: [1, 2],
        completedDifficulties: { ch1: ['easy', 'hard'] },
        bestTimesSec: { ch1: { easy: 290.5, hard: 215.2 } },
        totalEscapes: 2,
        totalPlaytimeSec: 505.7,
        argSecretsSolved: ['ch1_safe_code'],
      },
      settings: {
        graphicsQuality: 'high',
        video: { fov: 84, showFps: true },
        gameplay: { showSpeedrunTimer: true },
      },
      activeRun: null,
    })
  );

  const { data, migrated } = migrateStorageToV4(storage, false);
  assert.equal(migrated, true);
  assert.equal(data.saveVersion, SAVE_V4_VERSION);
  assert.deepEqual(data.profile.chaptersUnlocked, [1, 2]);
  assert.ok(data.progression.soloDifficultiesBeaten.includes('easy'));
  assert.ok(data.progression.soloDifficultiesBeaten.includes('hard'));
  assert.ok(data.progression.unlockedEndings.includes('good'));
  assert.equal(data.settings.video.fov, 84);
  assert.equal(data.settings.gameplay.showSpeedrunTimer, true);
});

test('Save v4: falls back safely on corrupted JSON in localStorage', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_V4_KEY, '{corrupted_v4_json!!!');
  storage.setItem(DATASTORE_KEY, '{corrupted_v3');
  storage.setItem(LEGACY_SETTINGS_KEY, 'broken');
  storage.setItem(LEGACY_CHAPTER_PROGRESS_KEY, 'broken');
  storage.setItem(LEGACY_BEST_TIME_KEY, 'NaN');

  const { data } = migrateStorageToV4(storage, true);
  assert.equal(data.saveVersion, 4);
  assert.equal(data.progression.survivalCoins, 0);
  assert.deepEqual(data.progression.equippedPerks, []);
  assert.equal(data.progression.cosmetics.equippedFlashlight, 'halogen');
});

test('Save v4: backup export and import round-trips cleanly and rejects tampered codes', () => {
  const storage = new MemoryStorage();
  const sys = new SaveSystem(storage);
  sys.recordRunResult({
    endingId: 'good',
    difficulty: 'hard',
    elapsedSec: 230,
    detections: 0,
    stunsApplied: 2,
    flaresUsed: 1,
    vhsCollected: 3,
    vhsTotal: 4,
    uvCluesCollected: 3,
    uvCluesTotal: 3,
    exploredPct: 88,
    safeUnlocked: true,
    terminalUnlocked: false,
    holdBreathSurvived: 1,
    craftsCompleted: 1,
  });

  const code = exportSaveBackupCode(sys.load());
  assert.ok(code.startsWith('DC09V4:'));

  const imported = importSaveBackupCode(code);
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.data.saveVersion, 4);
    assert.ok(imported.data.progression.survivalCoins > 0);
    assert.ok(imported.data.progression.unlockedEndings.includes('good'));
  }

  const bad = importSaveBackupCode('DC09V4:not_valid_base64!!!');
  assert.equal(bad.ok, false);
});

test('Prestige Perks enforce Nightmare & All-4-Difficulties solo requirements + Survival Coins', () => {
  const storage = new MemoryStorage();
  const sys = new SaveSystem(storage);

  // Give plenty of coins first to verify skill requirements still block purchase
  const state = sys.load();
  state.progression.survivalCoins = 5000;
  sys.persist(state);

  // 1. Instinto do Pesadelo requires Nightmare solo
  assert.equal(getPerkRequirementStatus(sys.getProgression(), 'nightmare_instinct').met, false);
  const blockedNm = sys.buyPerk('nightmare_instinct');
  assert.equal(blockedNm.ok, false);

  // 2. Protocolo Ômega requires all 4 difficulties solo
  assert.equal(getPerkRequirementStatus(sys.getProgression(), 'omega_protocol').met, false);
  const blockedOmega = sys.buyPerk('omega_protocol');
  assert.equal(blockedOmega.ok, false);

  // Beat Nightmare solo -> unlocks Nightmare Instinct, but NOT Omega Protocol yet
  sys.recordRunResult({
    endingId: 'good',
    difficulty: 'nightmare',
    elapsedSec: 310,
    detections: 1,
    stunsApplied: 1,
    flaresUsed: 0,
    vhsCollected: 1,
    vhsTotal: 4,
    uvCluesCollected: 1,
    uvCluesTotal: 3,
    exploredPct: 70,
    safeUnlocked: true,
    terminalUnlocked: false,
    holdBreathSurvived: 0,
    craftsCompleted: 0,
  });
  assert.equal(getPerkRequirementStatus(sys.getProgression(), 'nightmare_instinct').met, true);
  assert.equal(getPerkRequirementStatus(sys.getProgression(), 'omega_protocol').met, false);

  const coinsBeforeNm = sys.getProgression().survivalCoins;
  const boughtNm = sys.buyPerk('nightmare_instinct');
  assert.equal(boughtNm.ok, true);
  assert.equal(sys.getProgression().survivalCoins, coinsBeforeNm - 800);

  // Beat the remaining 3 difficulties solo (practice, easy, hard) -> unlocks Protocolo Ômega
  for (const diff of ['practice', 'easy', 'hard'] as const) {
    sys.recordRunResult({
      endingId: 'real',
      difficulty: diff,
      elapsedSec: 280,
      detections: 0,
      stunsApplied: 0,
      flaresUsed: 0,
      vhsCollected: 2,
      vhsTotal: 4,
      uvCluesCollected: 2,
      uvCluesTotal: 3,
      exploredPct: 75,
      safeUnlocked: true,
      terminalUnlocked: false,
      holdBreathSurvived: 0,
      craftsCompleted: 0,
    });
  }

  assert.equal(getPerkRequirementStatus(sys.getProgression(), 'omega_protocol').met, true);
  const coinsBeforeOmega = sys.getProgression().survivalCoins;
  const boughtOmega = sys.buyPerk('omega_protocol');
  assert.equal(boughtOmega.ok, true);
  assert.equal(sys.getProgression().survivalCoins, coinsBeforeOmega - 2500);
});

test('Perk equip enforces max 3 active perks and Cosmetics purchase/equip persists', () => {
  const storage = new MemoryStorage();
  const sys = new SaveSystem(storage);
  const st = sys.load();
  st.progression.survivalCoins = 4000;
  sys.persist(st);

  // Catalog sanity: at least 9 base perks + 2 prestige perks = 11+
  assert.ok(PERK_CATALOG.length >= 11);

  assert.equal(sys.buyPerk('silent_steps').ok, true);
  assert.equal(sys.buyPerk('iron_lungs').ok, true);
  assert.equal(sys.buyPerk('fast_hacker').ok, true);
  assert.equal(sys.buyPerk('extended_battery').ok, true);

  assert.equal(sys.toggleEquipPerk('silent_steps').ok, true);
  assert.equal(sys.toggleEquipPerk('iron_lungs').ok, true);
  assert.equal(sys.toggleEquipPerk('fast_hacker').ok, true);
  assert.equal(sys.getEquippedPerks().length, MAX_EQUIPPED_PERKS);

  // 4th equip must be rejected until one is unequipped
  assert.equal(sys.toggleEquipPerk('extended_battery').ok, false);
  assert.equal(sys.toggleEquipPerk('iron_lungs').ok, true);
  assert.equal(sys.toggleEquipPerk('extended_battery').ok, true);
  assert.equal(sys.getEquippedPerks().length, 3);

  // Cosmetics
  assert.equal(sys.buyOrEquipFlashlight('night_vision').ok, true);
  assert.equal(sys.getCosmetics().equippedFlashlight, 'night_vision');
  assert.equal(sys.buyOrEquipGloves('omega_carbon').ok, true);
  assert.equal(sys.getCosmetics().equippedGloves, 'omega_carbon');
  assert.equal(sys.buyOrEquipDiddySkin('unstable_exp').ok, true);
  assert.equal(sys.getCosmetics().equippedDiddySkin, 'unstable_exp');
});

test('Rank S-C calculation, Personal Best, and 24-Achievement progression + coin claiming', () => {
  assert.ok(ACHIEVEMENT_CATALOG.length >= 20, 'Must have 20+ achievements in catalog');

  // S-Rank Secret Ending fast ghost run on Nightmare
  const rankS = calculateMissionReport(
    {
      endingId: 'secret',
      difficulty: 'nightmare',
      elapsedSec: 210,
      detections: 0,
      stunsApplied: 2,
      flaresUsed: 1,
      vhsCollected: 4,
      vhsTotal: 4,
      uvCluesCollected: 3,
      uvCluesTotal: 3,
      exploredPct: 95,
      safeUnlocked: true,
      terminalUnlocked: true,
      holdBreathSurvived: 2,
      craftsCompleted: 1,
    },
    300,
    100,
    true
  );
  assert.equal(rankS.rank, 'S');
  assert.equal(rankS.isNewBestTime, true);
  assert.ok(rankS.coinsEarned >= 500);

  // C-Rank Bad Ending
  const rankC = calculateMissionReport(
    {
      endingId: 'bad',
      difficulty: 'easy',
      elapsedSec: 95,
      detections: 4,
      stunsApplied: 0,
      flaresUsed: 0,
      vhsCollected: 0,
      vhsTotal: 4,
      uvCluesCollected: 0,
      uvCluesTotal: 3,
      exploredPct: 22,
      safeUnlocked: false,
      terminalUnlocked: false,
      holdBreathSurvived: 0,
      craftsCompleted: 0,
    },
    undefined,
    100,
    false
  );
  assert.equal(rankC.rank, 'C');
  assert.equal(rankC.isNewBestTime, false);
  assert.ok(rankC.coinsEarned >= 15);

  // Incremental achievement progress & coin claim
  const sys = new SaveSystem(new MemoryStorage());
  for (let i = 0; i < 9; i++) {
    assert.equal(sys.advanceAchievement('taser_specialist', 1), null);
  }
  const unlockedToast = sys.advanceAchievement('taser_specialist', 1);
  assert.ok(unlockedToast, '10th stun must unlock taser_specialist achievement');
  assert.equal(unlockedToast!.id, 'taser_specialist');

  const claim = sys.claimAchievementReward('taser_specialist');
  assert.equal(claim.ok, true);
  assert.equal(claim.coinsAwarded, unlockedToast!.rewardCoins);
  assert.equal(sys.getProgression().survivalCoins, unlockedToast!.rewardCoins);
  // Double claim must be blocked
  assert.equal(sys.claimAchievementReward('taser_specialist').ok, false);
});
