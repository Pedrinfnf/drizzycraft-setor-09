import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDiddyFootstepParams,
  didGaitStepTrigger,
  DIDDY_FOOTSTEP_MAX_RANGE,
} from './spatialAudioMath';

test('Diddy footsteps grow heavier, deeper, and brighter as he approaches player', () => {
  const player = { x: 32, y: 1, z: 40 };
  const far = computeDiddyFootstepParams(player, 0, { x: 32, y: 1, z: 16 }, false, false);
  const mid = computeDiddyFootstepParams(player, 0, { x: 32, y: 1, z: 28 }, false, false);
  const close = computeDiddyFootstepParams(player, 0, { x: 32, y: 1, z: 36 }, false, false);
  const closeChase = computeDiddyFootstepParams(player, 0, { x: 32, y: 1, z: 36 }, true, true);
  const outOfRange = computeDiddyFootstepParams(
    player,
    0,
    { x: 32, y: 1, z: 40 - DIDDY_FOOTSTEP_MAX_RANGE - 2 },
    true,
    false,
  );

  assert.equal(outOfRange.audible, false);
  assert.equal(outOfRange.subGain, 0);

  assert.equal(far.audible, true);
  assert.ok(close.closeness > mid.closeness && mid.closeness > far.closeness);
  assert.ok(close.subGain > mid.subGain && mid.subGain > far.subGain, 'sub-bass stomp gain increases as distance shrinks');
  assert.ok(close.subStartFreq < far.subStartFreq, 'closer footsteps pitch deeper and heavier');
  assert.ok(close.lowpassFreq > far.lowpassFreq, 'distant footsteps stay muffled while close ones open up');
  assert.ok(close.cameraMicroShake > 0 && far.cameraMicroShake === 0, 'close stomps trigger micro ground tremor');
  assert.ok(closeChase.subGain > close.subGain, 'chasing/enraged footsteps hit harder');
});

test('3D stereo pan accurately places Diddy to player left, right, front, and back', () => {
  const player = { x: 32, y: 1, z: 32 };
  // yaw = 0 looks toward -Z, so +X is right (+1) and -X is left (-1)
  const onRight = computeDiddyFootstepParams(player, 0, { x: 40, y: 1, z: 32 }, false, false);
  const onLeft = computeDiddyFootstepParams(player, 0, { x: 24, y: 1, z: 32 }, false, false);
  const ahead = computeDiddyFootstepParams(player, 0, { x: 32, y: 1, z: 24 }, false, false);
  const behind = computeDiddyFootstepParams(player, 0, { x: 32, y: 1, z: 40 }, false, false);

  assert.ok(onRight.stereoPan > 0.95);
  assert.ok(onLeft.stereoPan < -0.95);
  assert.ok(Math.abs(ahead.stereoPan) < 0.05 && ahead.frontDot > 0.95);
  assert.ok(Math.abs(behind.stereoPan) < 0.05 && behind.frontDot < -0.95);
  assert.ok(behind.lowpassFreq < ahead.lowpassFreq, 'footsteps behind the player have slight rear acoustic darkening');
});

test('gait step trigger fires once per PI stride and ignores zero movement', () => {
  assert.equal(didGaitStepTrigger(0.2, 0.2), false);
  assert.equal(didGaitStepTrigger(2.9, 3.1), false);
  assert.equal(didGaitStepTrigger(3.0, 3.2), true);
  assert.equal(didGaitStepTrigger(6.1, 6.4), true);
});
