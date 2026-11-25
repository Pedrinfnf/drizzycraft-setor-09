import { Vec3 } from './types';

export const DIDDY_FOOTSTEP_MAX_RANGE = 32;
export const DIDDY_FOOTSTEP_REF_DISTANCE = 2.4;

export interface DiddyFootstepSpatialParams {
  audible: boolean;
  distance: number;
  /** 0 (at max range) to 1 (right beside player) */
  closeness: number;
  /** -1 (hard left) to +1 (hard right) relative to player's facing yaw */
  stereoPan: number;
  /** -1 (directly behind) to +1 (directly in front) */
  frontDot: number;
  /** Sub-bass stomp gain (grows nonlinearly heavier as Diddy approaches) */
  subGain: number;
  /** Deep impact starting frequency in Hz (drops deeper & heavier up close) */
  subStartFreq: number;
  /** Mid-low heavy leather/stone boot body knock gain */
  thudGain: number;
  /** Gravel/ground crunch noise gain */
  gritGain: number;
  /** Low-pass cutoff frequency in Hz (muffled far away, sharp & looming close up) */
  lowpassFreq: number;
  /** Subtle ground-tremor camera trauma when Diddy stomps very close (< 9m) */
  cameraMicroShake: number;
}

/**
 * Pure 3D spatialization & proximity heaviness calculation for P. Diddy's footsteps.
 * Decoupled from Web Audio nodes so attenuation curves, stereo direction, and
 * stride heaviness can be unit-tested deterministically.
 */
export function computeDiddyFootstepParams(
  playerPos: Vec3,
  playerYaw: number,
  diddyPos: Vec3,
  chasing: boolean,
  enraged: boolean,
): DiddyFootstepSpatialParams {
  const dx = diddyPos.x - playerPos.x;
  const dy = diddyPos.y - playerPos.y;
  const dz = diddyPos.z - playerPos.z;
  const distance = Math.hypot(dx, dy, dz);

  if (distance >= DIDDY_FOOTSTEP_MAX_RANGE) {
    return {
      audible: false,
      distance,
      closeness: 0,
      stereoPan: 0,
      frontDot: 0,
      subGain: 0,
      subStartFreq: 86,
      thudGain: 0,
      gritGain: 0,
      lowpassFreq: 220,
      cameraMicroShake: 0,
    };
  }

  // Forward matches VoxelEngine convention: yaw=0 looks along -Z, right is +X
  const sinY = Math.sin(playerYaw);
  const cosY = Math.cos(playerYaw);
  const fwdX = -sinY;
  const fwdZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  const horizDist = Math.hypot(dx, dz);
  const dirX = horizDist > 0.001 ? dx / horizDist : 0;
  const dirZ = horizDist > 0.001 ? dz / horizDist : 0;

  const stereoPan = Math.max(-1, Math.min(1, dirX * rightX + dirZ * rightZ));
  const frontDot = Math.max(-1, Math.min(1, dirX * fwdX + dirZ * fwdZ));

  // Smooth closeness curve (0 at 32m, 1 at <= 2.4m)
  const linearClose = Math.max(
    0,
    Math.min(1, 1 - (distance - DIDDY_FOOTSTEP_REF_DISTANCE) / (DIDDY_FOOTSTEP_MAX_RANGE - DIDDY_FOOTSTEP_REF_DISTANCE)),
  );
  // Power curve makes steps swell dramatically heavier as he closes in
  const weightCurve = linearClose * linearClose;
  const aggressionMult = (chasing ? 1.28 : 1.0) * (enraged ? 1.15 : 1.0);

  // Behind-the-player subtle acoustic occlusion (slightly darker when behind head)
  const behindFactor = frontDot < 0 ? 0.85 : 1.0;

  const subGain = Math.min(0.95, (0.08 + weightCurve * 0.68) * aggressionMult);
  // Closer steps drop lower in pitch for heavy, booming horror footsteps
  const subStartFreq = 86 - linearClose * 30 - (chasing ? 6 : 0);
  const thudGain = Math.min(0.8, (0.06 + linearClose * 0.44) * aggressionMult);
  const gritGain = Math.min(0.65, (0.04 + weightCurve * 0.4) * aggressionMult);
  const lowpassFreq = (240 + weightCurve * 1450) * behindFactor;

  // Ground-tremor micro camera shake when P. Diddy stomps within 9 blocks
  let cameraMicroShake = 0;
  if (distance < 9) {
    const tremor = 1 - distance / 9;
    cameraMicroShake = tremor * tremor * (chasing ? 0.22 : 0.12);
  }

  return {
    audible: true,
    distance,
    closeness: linearClose,
    stereoPan,
    frontDot,
    subGain,
    subStartFreq,
    thudGain,
    gritGain,
    lowpassFreq,
    cameraMicroShake,
  };
}

/**
 * Returns true whenever Diddy's gaitPhase crosses a foot-plant boundary (every PI radians,
 * matching left & right leg peak extension in the 3D rig).
 */
export function didGaitStepTrigger(prevGaitPhase: number, nextGaitPhase: number): boolean {
  if (nextGaitPhase <= prevGaitPhase) return false;
  return Math.floor(nextGaitPhase / Math.PI) > Math.floor(prevGaitPhase / Math.PI);
}
