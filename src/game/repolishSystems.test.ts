import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpringDamper1D, SpringDamper3D, computeSoundOcclusionCutoffHz } from './springPhysics';
import { ENDING_CUTSCENE, INTRO_CUTSCENE, evaluateCutsceneSpline } from './cutscenes';

test('SpringDamper1D & SpringDamper3D converge stably under high/low dt and respond to impulses', () => {
  const s = new SpringDamper1D(160, 20, 0);
  s.addImpulse(2.5);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    const v = s.step(1 / 60, 0);
    if (v > peak) peak = v;
  }
  assert.ok(peak > 0.05, 'Impulse must produce visible spring overshoot');
  assert.ok(Math.abs(s.value) < 0.01, `Spring must damp cleanly back to target (got ${s.value})`);

  // Stress test mobile lag spike (dt = 0.08s) — must never diverge to NaN/Infinity
  const s3 = new SpringDamper3D(220, 18);
  const out = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    s3.step(0.08, 1.0, -0.5, 0.25, out);
  }
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z));
  assert.ok(Math.abs(out.x - 1.0) < 0.05);
  assert.ok(Math.abs(out.y + 0.5) < 0.05);
  assert.ok(Math.abs(out.z - 0.25) < 0.05);
});

test('Sound Occlusion cutoff accurately muffles walls, closed doors, and different floors', () => {
  const openHz = computeSoundOcclusionCutoffHz({
    sameFloor: true,
    hasLineOfSight: true,
    closedDoorsBetween: 0,
    occlusionEnabled: true,
  });
  const doorHz = computeSoundOcclusionCutoffHz({
    sameFloor: true,
    hasLineOfSight: true,
    closedDoorsBetween: 1,
    occlusionEnabled: true,
  });
  const wallHz = computeSoundOcclusionCutoffHz({
    sameFloor: true,
    hasLineOfSight: false,
    closedDoorsBetween: 0,
    occlusionEnabled: true,
  });
  const diffFloorHz = computeSoundOcclusionCutoffHz({
    sameFloor: false,
    hasLineOfSight: false,
    closedDoorsBetween: 0,
    occlusionEnabled: true,
  });
  const disabledHz = computeSoundOcclusionCutoffHz({
    sameFloor: true,
    hasLineOfSight: false,
    closedDoorsBetween: 2,
    occlusionEnabled: false,
  });

  assert.ok(openHz >= 10000, 'Open LOS should remain crisp');
  assert.ok(doorHz < 1200 && doorHz > 400, 'Closed door should muffle highs');
  assert.ok(wallHz < 800 && wallHz > 300, 'Concrete wall should strongly muffle highs');
  assert.ok(diffFloorHz <= 320, 'Different floor should heavily muffle audio');
  assert.ok(disabledHz >= 12000, 'Disabled occlusion setting must bypass wall muffling');
});

test('CatmullRomCurve3 Cutscene Splines produce smooth finite trajectories & dynamic FOV', () => {
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const look = new THREE.Vector3();

  for (const def of [INTRO_CUTSCENE, ENDING_CUTSCENE]) {
    for (let s = 0; s < def.steps.length; s++) {
      const r0 = evaluateCutsceneSpline(def, s, 0.0, posA, look);
      const r1 = evaluateCutsceneSpline(def, s, 0.5, posB, look);
      assert.ok(Number.isFinite(posA.x) && Number.isFinite(posB.x));
      assert.ok(Number.isFinite(look.x) && Number.isFinite(look.z));
      assert.ok(r0.fov >= 40 && r0.fov <= 90, `Cutscene ${def.id} step ${s} FOV out of cinematic bounds`);
      assert.ok(r1.fov >= 40 && r1.fov <= 90);
    }
  }
});
