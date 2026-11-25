import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InputModeController,
  applyStickResponseCurve,
  computeMobileHudLayout,
  getDeviceGlyphs,
} from './inputManager';
import { GRAPHICS_PROFILES } from './settings';

test('UI Audit: Zero mobile HUD overlap across Portrait & Landscape viewports', () => {
  const viewports: { name: string; w: number; h: number; scales: number[] }[] = [
    { name: 'iPhone 14 Portrait', w: 390, h: 844, scales: [0.85, 1.0, 1.15] },
    { name: 'Small Android Portrait', w: 360, h: 740, scales: [0.85, 1.0] },
    { name: 'Large Android Portrait', w: 412, h: 915, scales: [0.85, 1.0, 1.2] },
    { name: 'iPhone 14 Landscape', w: 844, h: 390, scales: [0.85, 1.0, 1.15] },
    { name: 'Large Android Landscape', w: 915, h: 412, scales: [0.85, 1.0, 1.2] },
    { name: 'Compact Landscape', w: 740, h: 360, scales: [0.85, 1.0] },
  ];

  for (const vp of viewports) {
    for (const scale of vp.scales) {
      const res = computeMobileHudLayout(vp.w, vp.h, scale);
      assert.equal(
        res.hasOverlap,
        false,
        `${vp.name} (${vp.w}x${vp.h}, scale=${scale}) has overlapping HUD elements: ${JSON.stringify(
          res.overlapPairs
        )}`
      );
      for (const box of res.boxes) {
        assert.ok(box.x >= 0 && box.y >= 0, `${vp.name}: ${box.id} must stay inside left/top viewport`);
        assert.ok(
          box.x + box.w <= vp.w && box.y + box.h <= vp.h,
          `${vp.name}: ${box.id} must stay inside right/bottom viewport`
        );
      }
    }
  }
});

test('UI Audit: InputModeController auto-switches Touch <-> PC <-> Gamepad with 650ms ghost-mouse suppression', () => {
  const ctrl = new InputModeController(true);
  assert.equal(ctrl.getMode(), 'touch');

  // Touch event at t=1000ms
  ctrl.onTouchInput(1000);
  assert.equal(ctrl.getMode(), 'touch');

  // Synthetic browser mousemove at t=1150ms (within 650ms guard) MUST BE IGNORED!
  const ghostChanged = ctrl.onMouseInput(1150, 8);
  assert.equal(ghostChanged, false, 'Synthetic mousemove within 650ms of touch must be suppressed');
  assert.equal(ctrl.getMode(), 'touch');

  // Genuine mouse move at t=1750ms (> 650ms) switches cleanly to PC
  const realMouseChanged = ctrl.onMouseInput(1750, 6);
  assert.equal(realMouseChanged, true);
  assert.equal(ctrl.getMode(), 'pc');

  // PlayStation DualSense gamepad detection
  const psChanged = ctrl.onGamepadInput('Sony Interactive Entertainment DualSense Wireless Controller (054c)');
  assert.equal(psChanged, true);
  assert.equal(ctrl.getMode(), 'gamepad');
  assert.equal(ctrl.getGamepadStyle(), 'playstation');

  // Xbox controller detection
  const xboxChanged = ctrl.onGamepadInput('Xbox Wireless Controller (STANDARD GAMEPAD)');
  assert.equal(xboxChanged, true);
  assert.equal(ctrl.getMode(), 'gamepad');
  assert.equal(ctrl.getGamepadStyle(), 'xbox');

  // Keyboard press switches immediately back to PC
  assert.equal(ctrl.onKeyboardInput(), true);
  assert.equal(ctrl.getMode(), 'pc');

  // Touch tap switches immediately back to Touch
  assert.equal(ctrl.onTouchInput(5000), true);
  assert.equal(ctrl.getMode(), 'touch');
});

test('UI Audit: Gamepad non-linear stick deadzone curve & Device Glyphs', () => {
  // Inside deadzone -> exact zero (zero drift)
  const inside = applyStickResponseCurve(0.08, -0.09, 0.14, 1.75);
  assert.equal(inside.x, 0);
  assert.equal(inside.y, 0);
  assert.equal(inside.magnitude, 0);

  // Mid deflection -> smooth fine control (< linear)
  const mid = applyStickResponseCurve(0.55, 0, 0.14, 1.75);
  assert.ok(mid.x > 0 && mid.x < 0.4, `Mid deflection should curve smoothly for precision (got ${mid.x})`);

  // Full deflection -> full 1.0 turn speed
  const full = applyStickResponseCurve(1.0, 0, 0.14, 1.75);
  assert.ok(Math.abs(full.x - 1.0) < 1e-6);

  // Dynamic glyphs check (G drop for PC, HOLD □ for PS, HOLD X for Xbox, DROPAR for Touch; △/Y for Flashlight)
  assert.equal(getDeviceGlyphs('pc', 'xbox').drop, 'G');
  assert.equal(getDeviceGlyphs('gamepad', 'playstation').drop, 'HOLD □');
  assert.equal(getDeviceGlyphs('gamepad', 'xbox').drop, 'HOLD X');
  assert.equal(getDeviceGlyphs('gamepad', 'playstation').flashlight, '△');
  assert.equal(getDeviceGlyphs('gamepad', 'xbox').flashlight, 'Y');
  assert.equal(getDeviceGlyphs('touch', 'xbox').drop, 'DROPAR');
});

test('UI Audit: 4-Tier Graphics Presets preserve 60 FPS Mobile split vs High/Ultra Realism', () => {
  // Low & Medium: 0 or 1 dynamic shadow, NO parallax, NO EffectComposer (60 FPS Mobile!)
  assert.equal(GRAPHICS_PROFILES.low.dualMoonShadow, false);
  assert.equal(GRAPHICS_PROFILES.low.parallaxEnabled, false);
  assert.equal(GRAPHICS_PROFILES.low.postProcessingEnabled, false);

  assert.equal(GRAPHICS_PROFILES.medium.shadowsEnabled, true);
  assert.equal(GRAPHICS_PROFILES.medium.dualMoonShadow, false);
  assert.equal(GRAPHICS_PROFILES.medium.parallaxEnabled, false);
  assert.equal(GRAPHICS_PROFILES.medium.postProcessingEnabled, false);

  // High & Ultra: Dual Shadow Maps + UV-clamped Parallax + Full EffectComposer!
  assert.equal(GRAPHICS_PROFILES.high.dualMoonShadow, true);
  assert.equal(GRAPHICS_PROFILES.high.parallaxEnabled, true);
  assert.equal(GRAPHICS_PROFILES.high.postProcessingEnabled, true);

  assert.equal(GRAPHICS_PROFILES.ultra.dualMoonShadow, true);
  assert.equal(GRAPHICS_PROFILES.ultra.parallaxEnabled, true);
  assert.equal(GRAPHICS_PROFILES.ultra.postProcessingEnabled, true);
});

test('Stack Audit: Zero deprecated Three.js r187 APIs (PCFSoftShadowMap removed in favor of PCFShadowMap)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const THREE = await import('three');

  assert.equal(THREE.ColorManagement.enabled, true, 'Three.js r187 ColorManagement must be enabled');
  assert.equal(typeof THREE.PCFShadowMap, 'number', 'Modern THREE.PCFShadowMap must be exported');

  const engineSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/HorrorEngine.ts'), 'utf8');
  assert.equal(
    engineSrc.includes('PCFSoftShadowMap'),
    false,
    'HorrorEngine.ts must NOT use removed/deprecated PCFSoftShadowMap'
  );
  assert.equal(
    engineSrc.includes('THREE.PCFShadowMap'),
    true,
    'HorrorEngine.ts must use modern Three.js r182+ THREE.PCFShadowMap'
  );
});

test('Audio & Lore Audit: Zero 8-bit square/sawtooth oscillators in audio.ts & 3 Omega Dossiers defined', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { OMEGA_DOSSIERS } = await import('./mansionMap');

  assert.equal(OMEGA_DOSSIERS.length, 3, 'Must define exactly 3 classified Projeto Ômega dossiers');
  for (const d of OMEGA_DOSSIERS) {
    assert.ok(d.title.length > 4 && d.body.length > 30, `Dossier ${d.id} must have complete lore content`);
  }

  const audioSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/audio.ts'), 'utf8');
  assert.equal(
    /\.type\s*=\s*['"](square|sawtooth)['"]/.test(audioSrc),
    false,
    'audio.ts must NOT use dry 8-bit square or sawtooth oscillator waveforms'
  );
});


