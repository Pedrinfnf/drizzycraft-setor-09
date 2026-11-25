import * as THREE from 'three';
import type { FloorId } from './types';

export interface OrganicPuddleSpec {
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  radius: number;
}

export interface RippleSlot {
  x: number;
  z: number;
  startTime: number;
  intensity: number;
}

interface SplashDroplet {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  size: number;
}

interface WetFootprintMark {
  active: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  age: number;
  maxAge: number;
  scaleX: number;
  scaleZ: number;
  isMiniPuddle: boolean;
}

export const MAX_RIPPLES = 8;
const MAX_DROPLETS = 56;
const MAX_WET_MARKS = 72;

/**
 * Deterministic multi-lobed organic puddle polygon geometry (ZERO circular disks/cylinders).
 * Encodes radial alpha feathering in vertex color `r` so edges melt naturally into wet concrete.
 */
export function buildOrganicPuddleGeometry(
  radius: number,
  seedIdx: number,
  radialSegments = 28,
  ringCount = 3
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const p1 = (seedIdx * 1.73 + 0.4) % (Math.PI * 2);
  const p2 = (seedIdx * 2.91 + 1.1) % (Math.PI * 2);
  const p3 = (seedIdx * 4.17 + 2.3) % (Math.PI * 2);

  const lobeRadius = (angle: number): number => {
    const h1 = Math.sin(angle * 2 + p1) * 0.19;
    const h2 = Math.cos(angle * 3 - p2) * 0.14;
    const h3 = Math.sin(angle * 5 + p3) * 0.08;
    return radius * Math.max(0.55, 1.0 + h1 + h2 + h3);
  };

  // Center vertex (idx 0)
  positions.push(0, 0, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  colors.push(1.0, 1.0, 1.0);

  const ringFactors = [0.42, 0.78, 1.0];
  const ringAlphas = [0.96, 0.76, 0.04];

  for (let r = 0; r < ringCount; r++) {
    const rf = ringFactors[r] ?? 1.0;
    const alpha = ringAlphas[r] ?? 0.05;
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * Math.PI * 2;
      const dist = lobeRadius(angle) * rf;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      positions.push(x, 0, z);
      normals.push(0, 1, 0);
      uvs.push(0.5 + x / (radius * 2.2), 0.5 + z / (radius * 2.2));
      colors.push(alpha, alpha, alpha);
    }
  }

  // Inner fan triangles
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    indices.push(0, 1 + next, 1 + s);
  }

  // Concentric rings
  for (let r = 1; r < ringCount; r++) {
    const prevBase = 1 + (r - 1) * radialSegments;
    const currBase = 1 + r * radialSegments;
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      const a = prevBase + s;
      const b = prevBase + next;
      const c = currBase + s;
      const d = currBase + next;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export interface LivingWaterUniforms {
  uTime: { value: number };
  uRipples: { value: THREE.Vector4[] };
  uWaterNormalMap: { value: THREE.Texture };
  uFlashPos: { value: THREE.Vector3 };
  uFlashDir: { value: THREE.Vector3 };
  uFlashColor: { value: THREE.Color };
  uFlashPower: { value: number };
}

/**
 * Living PBR Water Material enhanced via `MeshPhysicalMaterial` + `onBeforeCompile`:
 * - Physical clearcoat (1.0), ultra-low roughness (0.03), metallic sheen (0.2) for crisp PBR reflections
 * - Dual-Panning Opposing Cross-Rippling Water Normals (always alive even when still)
 * - 8-slot dynamic concentric ripple normal waves (`uRipples[8]`)
 * - Schlick Fresnel grazing-angle reflection of Night Sky, Moon, Corridor Lamps & live Player Flashlight Beam
 * - Deep dark watery center fading smoothly into feathered transparent edges (zero hard geometric cut!)
 */
export function createLivingWaterMaterial(
  waterNormalTex: THREE.Texture,
  floor: FloorId
): { material: THREE.MeshPhysicalMaterial; uniforms: LivingWaterUniforms } {
  const rippleVecs: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_RIPPLES; i++) {
    rippleVecs.push(new THREE.Vector4(0, 0, -999, 0));
  }

  const uniforms: LivingWaterUniforms = {
    uTime: { value: 0 },
    uRipples: { value: rippleVecs },
    uWaterNormalMap: { value: waterNormalTex },
    uFlashPos: { value: new THREE.Vector3(0, 1.6, 0) },
    uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
    uFlashColor: { value: new THREE.Color(0xfff1d6) },
    uFlashPower: { value: 0 },
  };

  const material = new THREE.MeshPhysicalMaterial({
    color: floor === -1 ? 0x0e1a22 : 0x12222e,
    roughness: 0.03,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.95,
    envMapIntensity: 1.35,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uRipples = uniforms.uRipples;
    shader.uniforms.uWaterNormalMap = uniforms.uWaterNormalMap;
    shader.uniforms.uFlashPos = uniforms.uFlashPos;
    shader.uniforms.uFlashDir = uniforms.uFlashDir;
    shader.uniforms.uFlashColor = uniforms.uFlashColor;
    shader.uniforms.uFlashPower = uniforms.uFlashPower;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWaterWorldPos;
        varying float vEdgeAlpha;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 waterWp = modelMatrix * vec4(transformed, 1.0);
        vWaterWorldPos = waterWp.xyz;
        #ifdef USE_COLOR
          vEdgeAlpha = color.r;
        #else
          vEdgeAlpha = 0.85;
        #endif`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec4 uRipples[${MAX_RIPPLES}];
        uniform sampler2D uWaterNormalMap;
        uniform vec3 uFlashPos;
        uniform vec3 uFlashDir;
        uniform vec3 uFlashColor;
        uniform float uFlashPower;
        varying vec3 vWaterWorldPos;
        varying float vEdgeAlpha;`
      )
      .replace(
        '#include <color_fragment>',
        `// Deep dark center fading smoothly to translucent shallow perimeter
        float depthMask = smoothstep(0.06, 0.92, vEdgeAlpha);
        diffuseColor.rgb = mix(diffuseColor.rgb * 1.18, diffuseColor.rgb * 0.42, depthMask);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec2 wpUvA = vWaterWorldPos.xz * 0.48 + vec2(uTime * 0.042, uTime * 0.029);
        vec2 wpUvB = vWaterWorldPos.xz * 1.24 + vec2(-uTime * 0.064, uTime * 0.048);
        vec3 nA = texture2D(uWaterNormalMap, wpUvA).xyz * 2.0 - 1.0;
        vec3 nB = texture2D(uWaterNormalMap, wpUvB).xyz * 2.0 - 1.0;
        vec2 rippleSlope = vec2(0.0);
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 rp = uRipples[i];
          float age = uTime - rp.z;
          if (age > 0.0 && age < 2.6 && rp.w > 0.01) {
            vec2 delta = vWaterWorldPos.xz - rp.xy;
            float dist = length(delta);
            float waveRadius = age * 2.65;
            float band = exp(-abs(dist - waveRadius) * 4.4);
            float fade = (1.0 - age / 2.6) * rp.w;
            float wave = cos((dist - waveRadius) * 18.0) * band * fade;
            vec2 dir = dist > 0.001 ? delta / dist : vec2(0.0);
            rippleSlope += dir * wave * 0.72;
          }
        }
        vec2 totalSlope = (nA.xy * 0.24 + nB.xy * 0.18) + rippleSlope;
        vec3 waterNormalW = normalize(vec3(totalSlope.x * 0.45, 1.0, totalSlope.y * 0.45));
        normal = normalize(normal + vec3(totalSlope.x * 0.36, 0.0, totalSlope.y * 0.36));`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 viewDirW = normalize(cameraPosition - vWaterWorldPos);
        // Schlick Fresnel (F0 = 0.04 for water) with rippled normal perturbation
        float ndv = clamp(dot(viewDirW, waterNormalW), 0.0, 1.0);
        float schlick = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);

        // Cool Moonlight + overhead corridor specular reflection
        vec3 moonDirW = normalize(vec3(-0.34, 0.74, -0.58));
        vec3 moonHalf = normalize(moonDirW + viewDirW);
        float moonSpec = pow(max(dot(waterNormalW, moonHalf), 0.0), 72.0) * 0.48;

        // Live Player Flashlight Beam shimmering specular reflection on water ripples!
        vec3 flashSpecColor = vec3(0.0);
        if (uFlashPower > 0.01) {
          vec3 toPuddle = vWaterWorldPos - uFlashPos;
          float fDist = length(toPuddle);
          if (fDist > 0.25 && fDist < 18.0) {
            vec3 lightRay = toPuddle / fDist;
            float coneDot = dot(lightRay, normalize(uFlashDir));
            float coneMask = smoothstep(0.68, 0.94, coneDot);
            float atten = 1.0 / (1.0 + 0.12 * fDist * fDist);
            vec3 flashHalf = normalize(-lightRay + viewDirW);
            float spec = pow(max(dot(waterNormalW, flashHalf), 0.0), 48.0);
            float diffuseGlint = max(dot(waterNormalW, -lightRay), 0.0) * 0.22;
            flashSpecColor = uFlashColor * (spec * 1.15 + diffuseGlint) * coneMask * atten * uFlashPower;
          }
        }

        vec3 skyReflectTint = vec3(0.11, 0.19, 0.30);
        gl_FragColor.rgb += skyReflectTint * schlick * 0.85 + vec3(0.62, 0.78, 1.0) * moonSpec + flashSpecColor;
        float softEdge = smoothstep(0.03, 0.86, vEdgeAlpha);
        gl_FragColor.a = clamp(softEdge * (0.72 + schlick * 0.26), 0.0, 0.94);
        #include <dithering_fragment>`
      );
  };

  material.customProgramCacheKey = () => `sector09_living_water_v2_${floor}`;
  return { material, uniforms };
}

/**
 * Pure simulation + 3D InstancedMesh manager for organic puddles, ripples, voxel droplets,
 * and dynamic spreading wet footprints / mini-puddles that dry out over 18 seconds.
 */
export class WaterPhysicsManager {
  readonly puddles: OrganicPuddleSpec[] = [];
  readonly group = new THREE.Group();
  private uniformsByFloor: Record<FloorId, LivingWaterUniforms>;
  private materialsByFloor: Record<FloorId, THREE.MeshPhysicalMaterial>;
  private waterMats: THREE.MeshPhysicalMaterial[] = [];
  private rimMat: THREE.MeshStandardMaterial;
  private dropletMesh: THREE.InstancedMesh;
  private wetMarkMesh: THREE.InstancedMesh;
  private droplets: SplashDroplet[] = [];
  private wetMarks: WetFootprintMark[] = [];
  private rippleCursor = 0;
  private ripples: RippleSlot[] = [];
  private soakedStepsRemaining = 0;
  private soakedFloor: FloorId = 0;
  private lastFootSide = 1;
  private elapsedSec = 0;
  private dummy = new THREE.Object3D();
  private tempColor = new THREE.Color();

  constructor(puddles: OrganicPuddleSpec[], waterNormalTex: THREE.Texture, floorYFn: (f: FloorId) => number) {
    this.puddles = puddles;
    this.group.name = 'sector09_water_system';

    const mat0 = createLivingWaterMaterial(waterNormalTex, 0);
    const matM1 = createLivingWaterMaterial(waterNormalTex, -1);
    this.waterMats.push(mat0.material, matM1.material);
    this.uniformsByFloor = {
      0: mat0.uniforms,
      [-1]: matM1.uniforms,
    };
    this.materialsByFloor = {
      0: mat0.material,
      [-1]: matM1.material,
    };

    // Darkened wet concrete absorption rim around each puddle (low roughness for damp sheen!)
    this.rimMat = new THREE.MeshStandardMaterial({
      color: 0x090e14,
      roughness: 0.14,
      metalness: 0.12,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    puddles.forEach((p, idx) => {
      const baseY = floorYFn(p.floor);
      const rimGeo = buildOrganicPuddleGeometry(p.radius * 1.22, idx, 24, 2);
      const rimMesh = new THREE.Mesh(rimGeo, this.rimMat);
      rimMesh.position.set(p.x, baseY + 0.02, p.z);
      rimMesh.renderOrder = 1;
      this.group.add(rimMesh);

      const waterGeo = buildOrganicPuddleGeometry(p.radius, idx, 28, 3);
      const waterMat = p.floor === -1 ? matM1.material : mat0.material;
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.set(p.x, baseY + 0.026, p.z);
      waterMesh.renderOrder = 2;
      this.group.add(waterMesh);
    });

    // Pooled voxel splash droplets
    const dropGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xaad4f0,
      roughness: 0.08,
      metalness: 0.25,
      transparent: true,
      opacity: 0.82,
      envMapIntensity: 1.2,
    });
    this.dropletMesh = new THREE.InstancedMesh(dropGeo, dropMat, MAX_DROPLETS);
    this.dropletMesh.frustumCulled = false;
    this.dropletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.dropletMesh);

    for (let i = 0; i < MAX_DROPLETS; i++) {
      this.droplets.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.5,
        size: 1,
      });
    }

    // Pooled dynamic reflective wet footprints & mini spreading puddles
    const markGeo = buildOrganicPuddleGeometry(0.24, 99, 14, 2);
    const markMat = new THREE.MeshStandardMaterial({
      color: 0x162632,
      roughness: 0.08,
      metalness: 0.32,
      envMapIntensity: 1.15,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.wetMarkMesh = new THREE.InstancedMesh(markGeo, markMat, MAX_WET_MARKS);
    this.wetMarkMesh.frustumCulled = false;
    this.wetMarkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wetMarkMesh.renderOrder = 2;
    this.group.add(this.wetMarkMesh);

    for (let i = 0; i < MAX_WET_MARKS; i++) {
      this.wetMarks.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        yaw: 0,
        age: 0,
        maxAge: 18,
        scaleX: 1,
        scaleZ: 1,
        isMiniPuddle: false,
      });
    }

    for (let i = 0; i < MAX_RIPPLES; i++) {
      this.ripples.push({ x: 0, z: 0, startTime: -999, intensity: 0 });
    }
    this.syncInstances();
  }

  /** Returns the puddle if (x,z) on floor is inside a puddle footprint, else null. */
  findPuddleAt(floor: FloorId, x: number, z: number): OrganicPuddleSpec | null {
    for (let i = 0; i < this.puddles.length; i++) {
      const p = this.puddles[i];
      if (p.floor !== floor) continue;
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz <= p.radius * p.radius * 1.05) {
        return p;
      }
    }
    return null;
  }

  /** Injects a concentric ripple wave + jumping voxel splash droplets into the pool. */
  triggerRippleAndSplash(
    floor: FloorId,
    x: number,
    y: number,
    z: number,
    intensity = 1.0,
    dropletCount = 6
  ): void {
    const slot = this.ripples[this.rippleCursor];
    slot.x = x;
    slot.z = z;
    slot.startTime = this.elapsedSec;
    slot.intensity = Math.max(0.25, Math.min(1.6, intensity));

    const vec = this.uniformsByFloor[floor].uRipples.value[this.rippleCursor];
    if (vec) {
      vec.set(slot.x, slot.z, slot.startTime, slot.intensity);
    }
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES;

    let spawned = 0;
    for (let i = 0; i < this.droplets.length && spawned < dropletCount; i++) {
      const d = this.droplets[i];
      if (d.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.75 + Math.random() * 1.45) * Math.max(0.65, intensity);
      d.active = true;
      d.x = x + (Math.random() - 0.5) * 0.25;
      d.y = y + 0.05;
      d.z = z + (Math.random() - 0.5) * 0.25;
      d.vx = Math.cos(angle) * speed;
      d.vy = (1.55 + Math.random() * 1.4) * Math.max(0.7, intensity);
      d.vz = Math.sin(angle) * speed;
      d.age = 0;
      d.maxAge = 0.32 + Math.random() * 0.26;
      d.size = 0.65 + Math.random() * 0.85;
      spawned++;
    }
  }

  /**
   * Called on every player or P. Drizzy footstep.
   * - If stepping inside a puddle: emits ripple + droplets + soaks player shoes for 8 steps.
   * - If player has soaked shoes outside a puddle: spawns a dynamic wet footprint / mini spreading puddle!
   */
  onFootstep(
    floor: FloorId,
    x: number,
    floorY: number,
    z: number,
    yaw: number,
    isRunning: boolean,
    isPlayer: boolean
  ): { inWater: boolean; splashed: boolean; spawnedWetMark: boolean } {
    const puddle = this.findPuddleAt(floor, x, z);
    if (puddle) {
      const intensity = isRunning ? 1.35 : 0.82;
      this.triggerRippleAndSplash(floor, x, floorY, z, intensity, isRunning ? 9 : 5);
      if (isPlayer) {
        this.soakedStepsRemaining = 8;
        this.soakedFloor = floor;
      }
      return { inWater: true, splashed: true, spawnedWetMark: false };
    }

    if (isPlayer && this.soakedStepsRemaining > 0 && this.soakedFloor === floor) {
      this.soakedStepsRemaining--;
      const freshness = (this.soakedStepsRemaining + 1) / 8;
      this.lastFootSide *= -1;
      const sideOffset = 0.16 * this.lastFootSide;
      const fx = x + Math.cos(yaw) * sideOffset;
      const fz = z - Math.sin(yaw) * sideOffset;
      const isMiniPuddle = isRunning && freshness >= 0.55;
      this.spawnWetMark(fx, floorY + 0.013, fz, yaw, freshness, isMiniPuddle);
      return { inWater: false, splashed: false, spawnedWetMark: true };
    }

    return { inWater: false, splashed: false, spawnedWetMark: false };
  }

  spawnWetMark(
    x: number,
    y: number,
    z: number,
    yaw: number,
    freshness: number,
    isMiniPuddle: boolean
  ): void {
    let target: WetFootprintMark | null = null;
    let oldestAge = -1;
    for (let i = 0; i < this.wetMarks.length; i++) {
      const m = this.wetMarks[i];
      if (!m.active) {
        target = m;
        break;
      }
      if (m.age > oldestAge) {
        oldestAge = m.age;
        target = m;
      }
    }
    if (!target) return;
    target.active = true;
    target.x = x;
    target.y = y;
    target.z = z;
    target.yaw = yaw;
    target.age = 0;
    target.maxAge = 15 + freshness * 6; // 15-21 seconds to evaporate cleanly
    target.isMiniPuddle = isMiniPuddle;
    target.scaleX = isMiniPuddle ? 1.15 + freshness * 0.75 : 0.62 + freshness * 0.35;
    target.scaleZ = isMiniPuddle ? 1.25 + freshness * 0.85 : 1.08 + freshness * 0.42;
  }

  getSoakedStepsRemaining(): number {
    return this.soakedStepsRemaining;
  }

  getActiveWetMarkCount(): number {
    let count = 0;
    for (let i = 0; i < this.wetMarks.length; i++) {
      if (this.wetMarks[i].active) count++;
    }
    return count;
  }

  getRippleSlots(): readonly RippleSlot[] {
    return this.ripples;
  }

  /**
   * Live runtime water quality & reflection toggle driven directly by Settings!
   */
  setWaterSettings(reflectionsEnabled: boolean, quality: 'low' | 'high'): void {
    const floors: FloorId[] = [0, -1];
    for (const fl of floors) {
      const mat = this.materialsByFloor[fl];
      if (!mat) continue;
      mat.envMapIntensity = reflectionsEnabled ? (quality === 'high' ? 1.4 : 0.95) : 0.12;
      mat.clearcoat = reflectionsEnabled ? (quality === 'high' ? 1.0 : 0.55) : 0.0;
      mat.roughness = reflectionsEnabled ? (quality === 'high' ? 0.03 : 0.1) : 0.35;
      mat.needsUpdate = true;
    }
    this.dropletMesh.visible = quality === 'high';
  }

  /**
   * Triggers a subtle ambient rain micro-ripple on a Floor 0 courtyard puddle.
   */
  spawnAmbientRainRipple(x: number, z: number): void {
    this.triggerRippleAndSplash(0, x, 0.02, z, 0.34, 0);
  }

  /**
   * Feeds the live player flashlight world position, forward direction, tint and intensity
   * into the water shader so puddles reflect the flashlight beam realistically as the camera moves.
   */
  setFlashlightUniforms(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    colorHex: number,
    power: number
  ): void {
    this.tempColor.setHex(colorHex);
    const floors: FloorId[] = [0, -1];
    for (const fl of floors) {
      const u = this.uniformsByFloor[fl];
      u.uFlashPos.value.copy(pos);
      u.uFlashDir.value.copy(dir);
      u.uFlashColor.value.copy(this.tempColor);
      u.uFlashPower.value = power;
    }
  }

  update(dt: number): void {
    const clampedDt = Math.min(Math.max(dt, 0), 0.1);
    this.elapsedSec += clampedDt;
    this.uniformsByFloor[0].uTime.value = this.elapsedSec;
    this.uniformsByFloor[-1].uTime.value = this.elapsedSec;

    for (let i = 0; i < this.droplets.length; i++) {
      const d = this.droplets[i];
      if (!d.active) continue;
      d.age += clampedDt;
      if (d.age >= d.maxAge) {
        d.active = false;
        continue;
      }
      d.vy -= 9.8 * clampedDt;
      d.x += d.vx * clampedDt;
      d.y += d.vy * clampedDt;
      d.z += d.vz * clampedDt;
    }

    for (let i = 0; i < this.wetMarks.length; i++) {
      const m = this.wetMarks[i];
      if (!m.active) continue;
      m.age += clampedDt;
      if (m.age >= m.maxAge) {
        m.active = false;
      }
    }

    this.syncInstances();
  }

  private syncInstances(): void {
    for (let i = 0; i < this.droplets.length; i++) {
      const d = this.droplets[i];
      if (!d.active) {
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.set(0.0001, 0.0001, 0.0001);
        this.dummy.rotation.set(0, 0, 0);
      } else {
        const life = 1 - d.age / d.maxAge;
        const s = d.size * Math.max(0.15, life);
        this.dummy.position.set(d.x, d.y, d.z);
        this.dummy.scale.set(s, s * 1.15, s);
        this.dummy.rotation.set(d.age * 6, d.age * 4, 0);
      }
      this.dummy.updateMatrix();
      this.dropletMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.dropletMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.wetMarks.length; i++) {
      const m = this.wetMarks[i];
      if (!m.active) {
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.set(0.0001, 0.0001, 0.0001);
        this.dummy.rotation.set(0, 0, 0);
      } else {
        const dryRatio = 1 - m.age / m.maxAge;
        // Shrinks smoothly as it evaporates over 15-20s
        const shrink = 0.25 + dryRatio * 0.75;
        this.dummy.position.set(m.x, m.y, m.z);
        this.dummy.rotation.set(0, m.yaw, 0);
        this.dummy.scale.set(m.scaleX * shrink, 1, m.scaleZ * shrink);
        this.tempColor.setRGB(
          0.16 + dryRatio * 0.25,
          0.26 + dryRatio * 0.34,
          0.35 + dryRatio * 0.38
        );
        this.wetMarkMesh.setColorAt(i, this.tempColor);
      }
      this.dummy.updateMatrix();
      this.wetMarkMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.wetMarkMesh.instanceMatrix.needsUpdate = true;
    if (this.wetMarkMesh.instanceColor) {
      this.wetMarkMesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
  }
}
