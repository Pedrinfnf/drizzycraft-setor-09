import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  decodeHatSwitchAxis,
  normalizeGamepadState,
  type GamepadLike,
} from './inputManager';
import {
  computeSliderNextValue,
  findSpatialNextIndex,
  MenuRepeatController,
} from './gamepadNav';
import { HoldBreathMinigame } from './holdBreath';
import { DiddyAiController } from './ai';
import { generateMansionLayout, FLOOR_0_Y, FLOOR_MINUS_1_Y } from './mansionMap';
import { getDifficultyConfig } from './difficulty';
import {
  buildOrganicPuddleGeometry,
  MAX_RIPPLES,
  WaterPhysicsManager,
} from './waterSystem';
import { createDefaultSettings, sanitizeSettings } from './saveManager';

function makeButtons(count: number, pressedIndices: number[] = []): { pressed: boolean; value: number }[] {
  return Array.from({ length: count }, (_, idx) => ({
    pressed: pressedIndices.includes(idx),
    value: pressedIndices.includes(idx) ? 1 : 0,
  }));
}

test('Polish Audit: Dual-Profile Gamepad normalizes Standard W3C & Raw Android Bluetooth DS4', () => {
  // 1. Standard W3C Xbox Controller
  const xboxGp: GamepadLike = {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    mapping: 'standard',
    axes: [0.85, -0.5, 0.75, -0.6],
    buttons: makeButtons(16, [0, 3, 7, 12]), // A (cross), Y (triangle), RT (r2), D-Up
  };
  const stdState = normalizeGamepadState(xboxGp, 0.14, 'auto');
  assert.equal(stdState.resolvedProfile, 'standard');
  assert.equal(stdState.style, 'xbox');
  assert.ok(stdState.moveX > 0.5, 'Standard moveX should register');
  assert.ok(stdState.lookX > 0.3, 'Standard lookX should register');
  assert.equal(stdState.cross, true);
  assert.equal(stdState.triangle, true);
  assert.equal(stdState.r2, true);
  assert.equal(stdState.dpadUp, true);

  // 2. Raw Android Bluetooth DualShock 4 (mapping: '', axes[2]/axes[5] look, axes[3]/axes[4] triggers, axes[9] hat)
  const rawDs4: GamepadLike = {
    id: 'Sony Interactive Entertainment DualShock 4 (054c-09cc)',
    mapping: '',
    axes: [
      0.0, // 0: L-Stick X
      -0.9, // 1: L-Stick Y
      0.9, // 2: R-Stick X
      1.0, // 3: L2 analog full pull (+1.0 => 1.0)
      0.8, // 4: R2 analog pull (+0.8 => 0.9)
      -0.85, // 5: R-Stick Y (raw DS4!)
      0,
      0,
      0,
      -0.429, // 9: Hat-switch Right
    ],
    buttons: makeButtons(14, [1, 3, 4]), // Raw DS4: 1=Cross, 3=Triangle, 4=L1
  };
  const ds4State = normalizeGamepadState(rawDs4, 0.14, 'auto');
  assert.equal(ds4State.resolvedProfile, 'ds4_android');
  assert.equal(ds4State.style, 'playstation');
  assert.ok(ds4State.lookX > 0.5 && ds4State.lookY < -0.5, 'Raw Android DS4 must read axes[2] & axes[5]');
  assert.ok(ds4State.l2Value > 0.95 && ds4State.l2, 'Raw Android DS4 L2 on axes[3] must map -1..+1 -> 0..1');
  assert.ok(ds4State.r2Value > 0.85 && ds4State.r2, 'Raw Android DS4 R2 on axes[4] must map -1..+1 -> 0..1');
  assert.equal(ds4State.cross, true, 'Raw DS4 button[1] must map to Cross');
  assert.equal(ds4State.triangle, true, 'Raw DS4 button[3] must map to Triangle');
  assert.equal(ds4State.l1, true);
  assert.equal(ds4State.dpadRight, true, 'Raw DS4 axes[9] hat-switch right must decode');
  assert.equal(ds4State.dpadLeft, false);

  // 3. Hat-Switch full cardinal decode + neutral (> 1.05)
  assert.deepEqual(decodeHatSwitchAxis(-1.0), { up: true, down: false, left: false, right: false });
  assert.deepEqual(decodeHatSwitchAxis(-0.429), { up: false, down: false, left: false, right: true });
  assert.deepEqual(decodeHatSwitchAxis(0.143), { up: false, down: true, left: false, right: false });
  assert.deepEqual(decodeHatSwitchAxis(0.714), { up: false, down: false, left: true, right: false });
  assert.deepEqual(decodeHatSwitchAxis(1.2857), { up: false, down: false, left: false, right: false });
});

test('Polish Audit: HoldBreathMinigame safe feathering wins, over-holding catches, Assist Mode widens safe zone', () => {
  const hb = new HoldBreathMinigame();

  // Normal mode survival by feathering around 50%
  hb.start('locker_01', false, 4.2);
  assert.equal(hb.isActive(), true);
  let outcome: 'none' | 'survived' | 'caught' = 'none';
  for (let i = 0; i < 120 && outcome === 'none'; i++) {
    const snap = hb.getSnapshot();
    const shouldHold = snap.gauge < 50;
    outcome = hb.step(0.05, shouldHold, false).outcome;
  }
  assert.equal(outcome, 'survived', 'Feathering inside safe zone must survive the inspection');
  assert.equal(hb.isActive(), false);

  // Over-holding continuously must eventually trigger caught
  hb.start('locker_01', false, 4.8);
  outcome = 'none';
  for (let i = 0; i < 120 && outcome === 'none'; i++) {
    outcome = hb.step(0.05, true, false).outcome;
  }
  assert.equal(outcome, 'caught', 'Pinning breath gauge past upper limit must trigger caught');

  // Assist mode widens safe zone to [22, 80]
  hb.start('locker_02', true, 4.8);
  const assistSnap = hb.getSnapshot();
  assert.equal(assistSnap.zoneMin, 22);
  assert.equal(assistSnap.zoneMax, 80);
});

test('Polish Audit: Unseen hiding spot triggers Hold-Breath inspection and NEVER auto-hitkills', () => {
  const layout = generateMansionLayout(1337, 'hard');
  const ai = new DiddyAiController();
  ai.reset(layout);

  const spot = layout.hidingSpots[0];
  assert.ok(spot, 'Layout must contain hiding spots');

  // Place P. Drizzy right near the spot while player is already hidden UNSEEN
  ai.x = spot.x + Math.sin(spot.facingYaw) * 2.1;
  ai.y = spot.y;
  ai.z = spot.z + Math.cos(spot.facingYaw) * 2.1;
  ai.floor = spot.floor;
  ai.state = 'patrol';

  // Run several ticks past grace period — he must inspect, NEVER pull player out automatically!
  let inspected = false;
  let pulledOut = false;
  const diff = getDifficultyConfig('hard');
  for (let i = 0; i < 40; i++) {
    const ev = ai.tick({
      dt: 0.05,
      elapsedSec: 12 + i * 0.05,
      layout,
      diff,
      playerX: spot.x,
      playerY: spot.y,
      playerZ: spot.z,
      playerFloor: spot.floor,
      playerCrouching: true,
      playerFlashlightOn: false,
      playerHidingSpot: spot,
      playerEnteredHidingThisFrame: false,
      noiseEvents: [],
    });
    if (ev.inspectingHidingSpot) inspected = true;
    if (ev.pulledFromHidingSpot) pulledOut = true;
  }

  assert.equal(pulledOut, false, 'Unseen hiding spot must NEVER auto-pull/hitkill player');
  assert.equal(inspected, true, 'P. Drizzy passing closely by an occupied spot should trigger Hold-Breath inspection');
  assert.equal(ai.state, 'inspecting_hiding');

  // Surviving the Hold-Breath Minigame safely dismisses P. Drizzy back to distant patrol
  ai.resolveHidingInspection(true, layout);
  assert.equal(ai.state, 'patrol');
});

test('Polish Audit: WaterPhysicsManager organic puddles, 8-slot ripple ring buffer & 8-step soaked wet footprints', () => {
  // 1. Multi-lobed non-circular geometry check
  const geo = buildOrganicPuddleGeometry(1.6, 3, 28, 3);
  const pos = geo.getAttribute('position');
  let minOuterR = Infinity;
  let maxOuterR = 0;
  // Outer ring starts at 1 + 2 * 28 = 57
  for (let i = 57; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    minOuterR = Math.min(minOuterR, r);
    maxOuterR = Math.max(maxOuterR, r);
  }
  assert.ok(
    maxOuterR - minOuterR > 0.35,
    `Organic puddle silhouette must be irregular/multi-lobed, not a circle (spread=${(maxOuterR - minOuterR).toFixed(2)})`
  );
  geo.dispose();

  // 2. Ripple ring buffer + soaked shoes + drying over 22 seconds
  const dummyTex = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  const water = new WaterPhysicsManager(
    [{ id: 'puddle_test', floor: 0, x: 5, z: 5, radius: 1.5 }],
    dummyTex,
    (f) => (f === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y)
  );

  // Trigger 10 ripples -> ring buffer wraps cleanly across 8 slots
  for (let i = 0; i < 10; i++) {
    water.update(0.1);
    water.triggerRippleAndSplash(0, 5 + i * 0.05, FLOOR_0_Y, 5, 1.0, 2);
  }
  assert.equal(water.getRippleSlots().length, MAX_RIPPLES);
  assert.ok(water.getRippleSlots().every((slot) => slot.intensity > 0), 'All 8 ripple slots should be active');

  // Step inside puddle -> soaks shoes for 8 steps
  const inPuddle = water.onFootstep(0, 5.1, FLOOR_0_Y, 5.0, 0, true, true);
  assert.equal(inPuddle.inWater, true);
  assert.equal(inPuddle.splashed, true);
  assert.equal(water.getSoakedStepsRemaining(), 8);

  // Walk 8 steps outside puddle -> leaves 8 dynamic wet marks
  for (let s = 0; s < 8; s++) {
    const res = water.onFootstep(0, 10 + s * 0.7, FLOOR_0_Y, 5.0, 0, s < 3, true);
    assert.equal(res.inWater, false);
    assert.equal(res.spawnedWetMark, true, `Soaked step ${s + 1} must spawn a dynamic wet footprint/mini-puddle`);
  }
  assert.equal(water.getSoakedStepsRemaining(), 0);
  assert.equal(water.getActiveWetMarkCount(), 8);

  // 9th step outside puddle leaves no wet mark
  const dryStep = water.onFootstep(0, 18, FLOOR_0_Y, 5.0, 0, false, true);
  assert.equal(dryStep.spawnedWetMark, false);

  // Advance 23 seconds -> all wet footprints evaporate cleanly
  for (let t = 0; t < 230; t++) {
    water.update(0.1);
  }
  assert.equal(water.getActiveWetMarkCount(), 0, 'Wet footprints must evaporate cleanly after 15-21s');

  water.dispose();
  dummyTex.dispose();
});

test('Polish Audit: 5-Tab Settings sanitization & legacy save backwards-compatibility', () => {
  const defaults = createDefaultSettings(false);
  // Simulate an old v1 save missing all newly added fields
  const legacyRaw = {
    preset: 'medium',
    masterVolume: 0.75,
    fov: 80,
  };
  const migrated = sanitizeSettings(legacyRaw);
  assert.equal(migrated.graphicsQuality, 'medium');
  assert.equal(migrated.audio.master, 0.75);
  assert.equal(migrated.video.fov, 80);
  assert.equal(migrated.controls.gamepadProfile, defaults.controls.gamepadProfile);
  assert.equal(migrated.gameplay.vignetteIntensity, defaults.gameplay.vignetteIntensity);
  assert.equal(migrated.gameplay.holdBreathAssist, false);
  assert.equal(migrated.gameplay.visualAudioCues, true);
  assert.equal(migrated.gameplay.headBobIntensity, 1.0);
  assert.equal(migrated.gameplay.showNoiseIndicator, true);
  assert.equal(migrated.gameplay.showObjectiveHints, true);

  // Out-of-bounds clamping check
  const clamped = sanitizeSettings({
    controls: {
      gamepadProfile: 'ds4_android',
      joystickMode: 'floating',
    },
    gameplay: {
      vignetteIntensity: 9.9,
      holdBreathAssist: true,
    },
  });
  assert.equal(clamped.gameplay.vignetteIntensity, 1.5);
  assert.equal(clamped.controls.gamepadProfile, 'ds4_android');
  assert.equal(clamped.gameplay.holdBreathAssist, true);
  assert.equal(clamped.controls.joystickMode, 'floating');
});

test('Polish Audit: Map Light Switches & PBR Environment Map integration', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const layout = generateMansionLayout(42, 'hard');

  assert.ok(layout.lightSwitches.length >= 4, 'Map must include functional wall light switches');
  assert.ok(layout.puddles.length >= 6, 'Map must include organic water puddles across floors');

  const engineSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/HorrorEngine.ts'), 'utf8');
  assert.equal(
    engineSrc.includes('PMREMGenerator'),
    true,
    'HorrorEngine.ts must build a procedural Sector 09 environment map with PMREMGenerator'
  );
  assert.equal(
    engineSrc.includes('WaterPhysicsManager'),
    true,
    'HorrorEngine.ts must integrate WaterPhysicsManager'
  );
  assert.equal(
    engineSrc.includes('HoldBreathMinigame'),
    true,
    'HorrorEngine.ts must integrate HoldBreathMinigame'
  );
});

test('Polish Audit: Native Console 2D Spatial Focus, Slider Stepping & Auto-Repeat', () => {
  // 1. 3x3 Keypad grid layout (indices 0..8 representing digits 1..9)
  const keypadRects = [
    { x: 0, y: 0, w: 80, h: 50 },   // 0: '1'
    { x: 90, y: 0, w: 80, h: 50 },  // 1: '2'
    { x: 180, y: 0, w: 80, h: 50 }, // 2: '3'
    { x: 0, y: 60, w: 80, h: 50 },  // 3: '4'
    { x: 90, y: 60, w: 80, h: 50 }, // 4: '5'
    { x: 180, y: 60, w: 80, h: 50 },// 5: '6'
    { x: 0, y: 120, w: 80, h: 50 }, // 6: '7'
    { x: 90, y: 120, w: 80, h: 50 },// 7: '8'
    { x: 180, y: 120, w: 80, h: 50 }// 8: '9'
  ];

  assert.equal(findSpatialNextIndex(keypadRects, 0, 'down'), 3, '1 -> down -> 4');
  assert.equal(findSpatialNextIndex(keypadRects, 3, 'right'), 4, '4 -> right -> 5');
  assert.equal(findSpatialNextIndex(keypadRects, 4, 'down'), 7, '5 -> down -> 8');
  assert.equal(findSpatialNextIndex(keypadRects, 7, 'up'), 4, '8 -> up -> 5');
  assert.equal(findSpatialNextIndex(keypadRects, 4, 'left'), 3, '5 -> left -> 4');

  // 2. Native range slider stepping (0..100 moves by 5, FOV 60..100 step 2 moves by 2, clamps at bounds)
  assert.equal(computeSliderNextValue(80, 0, 100, 1, 'right'), 85);
  assert.equal(computeSliderNextValue(80, 0, 100, 1, 'left'), 75);
  assert.equal(computeSliderNextValue(98, 0, 100, 1, 'right'), 100);
  assert.equal(computeSliderNextValue(76, 60, 100, 2, 'right'), 78);
  assert.equal(computeSliderNextValue(60, 60, 100, 2, 'left'), 60);

  // 3. Console auto-repeat timer (instant press -> 0.26s hold -> 0.095s cadence -> reset on release)
  const rep = new MenuRepeatController();
  assert.equal(rep.update(0.016, 'right'), 'right', 'Initial press fires immediately');
  assert.equal(rep.update(0.15, 'right'), null, 'Does not repeat before 0.26s initial delay');
  assert.equal(rep.update(0.12, 'right'), 'right', 'Fires first repeat past 0.26s');
  assert.equal(rep.update(0.05, 'right'), null, 'Waits 0.095s cadence');
  assert.equal(rep.update(0.05, 'right'), 'right', 'Fires fast repeat at 0.095s cadence');
  assert.equal(rep.update(0.016, null), null, 'Release resets repeater');
  assert.equal(rep.update(0.016, 'left'), 'left', 'New direction fires immediately');
});
