import * as THREE from 'three';

/**
 * Pure 2nd-Order Spring-Damper Physics (F = -k*(x - target) - c*v)
 * Used for organic 1st-person hand/flashlight sway, camera-turn inertia lag,
 * landing impact dip, tool recoil, and adrenaline proximity micro-tremor.
 *
 * Uses sub-stepped semi-implicit Euler integration for rock-solid unconditional
 * stability across 24–144 FPS framerates (including mobile lag spikes).
 */
export class SpringDamper1D {
  value: number;
  velocity: number;
  target: number;
  stiffness: number; // k
  damping: number; // c

  constructor(stiffness = 140, damping = 18, initial = 0) {
    this.stiffness = stiffness;
    this.damping = damping;
    this.value = initial;
    this.target = initial;
    this.velocity = 0;
  }

  addImpulse(impulse: number): void {
    this.velocity += impulse;
  }

  impulse(impulse: number): void {
    this.addImpulse(impulse);
  }

  reset(value = 0): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  step(dt: number, target?: number): number {
    if (target !== undefined) this.target = target;
    const clampedDt = Math.max(0, Math.min(0.08, dt));
    if (clampedDt <= 0) return this.value;

    // Substep if dt > 16ms so high stiffness never explodes on mobile frame drops
    const substeps = clampedDt > 0.018 ? Math.ceil(clampedDt / 0.016) : 1;
    const h = clampedDt / substeps;
    for (let i = 0; i < substeps; i++) {
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

export class SpringDamper3D {
  readonly x: SpringDamper1D;
  readonly y: SpringDamper1D;
  readonly z: SpringDamper1D;

  constructor(stiffness = 150, damping = 19, initial: [number, number, number] = [0, 0, 0]) {
    this.x = new SpringDamper1D(stiffness, damping, initial[0]);
    this.y = new SpringDamper1D(stiffness, damping, initial[1]);
    this.z = new SpringDamper1D(stiffness, damping, initial[2]);
  }

  addImpulse(ix: number, iy: number, iz: number): void {
    this.x.addImpulse(ix);
    this.y.addImpulse(iy);
    this.z.addImpulse(iz);
  }

  impulse(ix: number, iy: number, iz: number): void {
    this.addImpulse(ix, iy, iz);
  }

  reset(x = 0, y = 0, z = 0): void {
    this.x.reset(x);
    this.y.reset(y);
    this.z.reset(z);
  }

  step(dt: number, tx: number, ty: number, tz: number, out?: THREE.Vector3): THREE.Vector3 {
    const rx = this.x.step(dt, tx);
    const ry = this.y.step(dt, ty);
    const rz = this.z.step(dt, tz);
    if (out) {
      out.set(rx, ry, rz);
      return out;
    }
    return new THREE.Vector3(rx, ry, rz);
  }
}

/**
 * Pure Acoustic Sound Occlusion Low-Pass Cutoff Calculator (Hz).
 * Returns crisp unoccluded brightness when player has line-of-sight or when
 * occlusion is disabled in Settings, and realistically muffles audio behind walls/doors/floors.
 */
export function computeSoundOcclusionCutoffHz(params: {
  sameFloor: boolean;
  hasLineOfSight: boolean;
  closedDoorsBetween: number;
  occlusionEnabled: boolean;
  isChasing?: boolean;
}): number {
  if (!params.occlusionEnabled) {
    return params.sameFloor ? 16000 : 2800;
  }
  if (!params.sameFloor) {
    return 290;
  }
  if (params.hasLineOfSight && params.closedDoorsBetween <= 0) {
    return params.isChasing ? 16000 : 12500;
  }
  if (params.closedDoorsBetween > 0 && params.hasLineOfSight) {
    return Math.max(420, 920 - (params.closedDoorsBetween - 1) * 240);
  }
  // Blocked by concrete/brick walls (plus any closed doors)
  return Math.max(320, (params.isChasing ? 740 : 580) - params.closedDoorsBetween * 140);
}
