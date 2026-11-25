import * as THREE from 'three';

/**
 * Multi-channel PBR material slots packed into a single sculpted BufferGeometry
 * via BufferGeometry groups (`geometry.addGroup`).
 */
export enum VoxelMat {
  Empty = 0,
  /** Matte painted wood, concrete, plastic, paper, plaster */
  Matte = 1,
  /** Reflective brushed steel, brass, chrome, copper, forged iron */
  Metal = 2,
  /** Self-lit emissive screens, LEDs, coils, tubes, glowing Compound 09 */
  Emissive = 3,
  /** Translucent glass panes, lenses, cracked frames, specimen cylinders */
  Glass = 4,
  /** Soft high-roughness cloth, rubber grips, mattress sheets, moss/soil */
  Fabric = 5,
}

export interface SculptBuildOptions {
  /** Custom anchor in voxel coordinates (defaults to bottom-center: [sx/2, 0, sz/2]) */
  anchor?: [number, number, number];
  /** Override subtle shade intensity (0 = no AO/wear, 1 = standard tactile voxel AO + edge wear) */
  aoStrength?: number;
}

export interface SculptBuildStats {
  filledVoxels: number;
  naiveFaces: number;
  culledFaces: number;
  mergedQuads: number;
  triangles: number;
  channelCount: number;
}

export interface SculptMeshResult {
  geometry: THREE.BufferGeometry;
  stats: SculptBuildStats;
}

/**
 * Shade lookup multipliers for 6 discrete vertex AO + convex edge wear levels:
 * 0..3 = classic Minecraft/Teardown 3-neighbor corner AO
 * 4    = exposed straight convex edge highlight (subtle wear)
 * 5    = exposed sharp convex corner highlight (tactile bevel edge wear)
 */
const SHADE_TABLE = [0.46, 0.67, 0.84, 1.0, 1.055, 1.11] as const;

interface FaceDirSpec {
  /** Outward normal axis (0=X, 1=Y, 2=Z) */
  axis: 0 | 1 | 2;
  /** Outward sign (+1 or -1) */
  sign: 1 | -1;
  /** First in-plane axis U (0=X, 1=Y, 2=Z) chosen so U x V = outward normal */
  uAxis: 0 | 1 | 2;
  /** Second in-plane axis V (0=X, 1=Y, 2=Z) chosen so U x V = outward normal */
  vAxis: 0 | 1 | 2;
  normal: [number, number, number];
  /** Slight directional daylight bias per face for extra 3D readability */
  dirShade: number;
}

const FACE_DIRS: readonly FaceDirSpec[] = [
  // +X: U=+Y, V=+Z -> (0,1,0)x(0,0,1) = (+1,0,0)
  { axis: 0, sign: 1, uAxis: 1, vAxis: 2, normal: [1, 0, 0], dirShade: 0.94 },
  // -X: U=+Z, V=+Y -> (0,0,1)x(0,1,0) = (-1,0,0)
  { axis: 0, sign: -1, uAxis: 2, vAxis: 1, normal: [-1, 0, 0], dirShade: 0.88 },
  // +Y: U=+Z, V=+X -> (0,0,1)x(1,0,0) = (0,+1,0)
  { axis: 1, sign: 1, uAxis: 2, vAxis: 0, normal: [0, 1, 0], dirShade: 1.04 },
  // -Y: U=+X, V=+Z -> (1,0,0)x(0,0,1) = (0,-1,0)
  { axis: 1, sign: -1, uAxis: 0, vAxis: 2, normal: [0, -1, 0], dirShade: 0.72 },
  // +Z: U=+X, V=+Y -> (1,0,0)x(0,1,0) = (0,0,+1)
  { axis: 2, sign: 1, uAxis: 0, vAxis: 1, normal: [0, 0, 1], dirShade: 0.97 },
  // -Z: U=+Y, V=+X -> (0,1,0)x(1,0,0) = (0,0,-1)
  { axis: 2, sign: -1, uAxis: 1, vAxis: 0, normal: [0, 0, -1], dirShade: 0.91 },
];

const _tmpColor = new THREE.Color();

/**
 * High-density discrete 3D micro-voxel sculptor with:
 * - Hidden Face Culling (zero hidden interior faces)
 * - 2D Greedy Meshing per slice (merges coplanar identical quads)
 * - Baked 3-neighbor Vertex Ambient Occlusion (AO) + AO-aware diagonal flip
 * - Convex Outer Edge Wear highlighting baked directly into vertex colors
 * - Multi-channel PBR BufferGeometry groups (Matte, Metal, Emissive, Glass, Fabric)
 */
export class VoxelSculptor {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly voxelSize: number;

  private readonly channels: Uint8Array;
  private readonly colors: Uint32Array;
  private readonly strideY: number;
  private readonly strideZ: number;

  constructor(sx: number, sy: number, sz: number, voxelSize: number) {
    this.sx = Math.max(1, Math.floor(sx));
    this.sy = Math.max(1, Math.floor(sy));
    this.sz = Math.max(1, Math.floor(sz));
    this.voxelSize = voxelSize;
    this.strideY = this.sx;
    this.strideZ = this.sx * this.sy;
    const total = this.sx * this.sy * this.sz;
    this.channels = new Uint8Array(total);
    this.colors = new Uint32Array(total);
  }

  private idx(x: number, y: number, z: number): number {
    return x + y * this.strideY + z * this.strideZ;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.sx && y >= 0 && y < this.sy && z >= 0 && z < this.sz;
  }

  getChannel(x: number, y: number, z: number): VoxelMat {
    if (!this.inBounds(x, y, z)) return VoxelMat.Empty;
    return this.channels[this.idx(x, y, z)] as VoxelMat;
  }

  getColor(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.colors[this.idx(x, y, z)];
  }

  private isOpaque(x: number, y: number, z: number): boolean {
    const ch = this.getChannel(x, y, z);
    return ch !== VoxelMat.Empty && ch !== VoxelMat.Glass;
  }

  set(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte
  ): this {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    if (!this.inBounds(ix, iy, iz)) return this;
    const i = this.idx(ix, iy, iz);
    this.channels[i] = channel;
    this.colors[i] = colorHex & 0xffffff;
    return this;
  }

  clear(x: number, y: number, z: number): this {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    if (!this.inBounds(ix, iy, iz)) return this;
    const i = this.idx(ix, iy, iz);
    this.channels[i] = VoxelMat.Empty;
    this.colors[i] = 0;
    return this;
  }

  /** Inclusive integer box fill */
  fillBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte
  ): this {
    const minX = Math.max(0, Math.round(Math.min(x0, x1)));
    const maxX = Math.min(this.sx - 1, Math.round(Math.max(x0, x1)));
    const minY = Math.max(0, Math.round(Math.min(y0, y1)));
    const maxY = Math.min(this.sy - 1, Math.round(Math.max(y0, y1)));
    const minZ = Math.max(0, Math.round(Math.min(z0, z1)));
    const maxZ = Math.min(this.sz - 1, Math.round(Math.max(z0, z1)));
    const col = colorHex & 0xffffff;
    for (let z = minZ; z <= maxZ; z++) {
      const zOff = z * this.strideZ;
      for (let y = minY; y <= maxY; y++) {
        const yOff = zOff + y * this.strideY;
        for (let x = minX; x <= maxX; x++) {
          this.channels[yOff + x] = channel;
          this.colors[yOff + x] = col;
        }
      }
    }
    return this;
  }

  /** Inclusive integer box carve (sets to Empty) */
  carveBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number
  ): this {
    return this.fillBox(x0, y0, z0, x1, y1, z1, 0, VoxelMat.Empty);
  }

  /**
   * Stepped-bevel solid box: fills the box and carves outer 1-voxel edge bevels
   * on the requested axes for authentic micro-voxel chamfers.
   */
  fillBeveledBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte,
    bevelMode: 'all' | 'vertical' | 'top' | 'horizontal' = 'all'
  ): this {
    const minX = Math.max(0, Math.round(Math.min(x0, x1)));
    const maxX = Math.min(this.sx - 1, Math.round(Math.max(x0, x1)));
    const minY = Math.max(0, Math.round(Math.min(y0, y1)));
    const maxY = Math.min(this.sy - 1, Math.round(Math.max(y0, y1)));
    const minZ = Math.max(0, Math.round(Math.min(z0, z1)));
    const maxZ = Math.min(this.sz - 1, Math.round(Math.max(z0, z1)));
    const col = colorHex & 0xffffff;

    for (let z = minZ; z <= maxZ; z++) {
      const onZ = z === minZ || z === maxZ;
      for (let y = minY; y <= maxY; y++) {
        const onY = y === minY || y === maxY;
        const onTop = y === maxY;
        for (let x = minX; x <= maxX; x++) {
          const onX = x === minX || x === maxX;
          let skip = false;
          if (bevelMode === 'all') {
            skip = (onX && onY) || (onY && onZ) || (onX && onZ);
          } else if (bevelMode === 'vertical') {
            skip = onX && onZ;
          } else if (bevelMode === 'top') {
            skip = onTop && (onX || onZ);
          } else if (bevelMode === 'horizontal') {
            skip = (onX && onY) || (onZ && onY);
          }
          if (!skip) {
            const i = this.idx(x, y, z);
            this.channels[i] = channel;
            this.colors[i] = col;
          }
        }
      }
    }
    return this;
  }

  /** Hollow framed box (outer shell thickness `t`, interior carved empty) */
  fillHollowBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    thickness: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte
  ): this {
    this.fillBox(x0, y0, z0, x1, y1, z1, colorHex, channel);
    const minX = Math.min(x0, x1) + thickness;
    const maxX = Math.max(x0, x1) - thickness;
    const minY = Math.min(y0, y1) + thickness;
    const maxY = Math.max(y0, y1) - thickness;
    const minZ = Math.min(z0, z1) + thickness;
    const maxZ = Math.max(z0, z1) - thickness;
    if (minX <= maxX && minY <= maxY && minZ <= maxZ) {
      this.carveBox(minX, minY, minZ, maxX, maxY, maxZ);
    }
    return this;
  }

  /** Vertical cylinder along Y */
  fillCylinderY(
    cx: number,
    y0: number,
    y1: number,
    cz: number,
    radius: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte,
    innerRadius = 0
  ): this {
    const minY = Math.max(0, Math.round(Math.min(y0, y1)));
    const maxY = Math.min(this.sy - 1, Math.round(Math.max(y0, y1)));
    const rOutSq = radius * radius;
    const rInSq = innerRadius > 0 ? innerRadius * innerRadius : -1;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.sx - 1, Math.ceil(cx + radius));
    const minZ = Math.max(0, Math.floor(cz - radius));
    const maxZ = Math.min(this.sz - 1, Math.ceil(cz + radius));
    const col = colorHex & 0xffffff;

    for (let z = minZ; z <= maxZ; z++) {
      const dz = z - cz;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dz * dz;
        if (d2 <= rOutSq + 0.15 && d2 >= rInSq) {
          for (let y = minY; y <= maxY; y++) {
            const i = this.idx(x, y, z);
            this.channels[i] = channel;
            this.colors[i] = col;
          }
        }
      }
    }
    return this;
  }

  /** Horizontal cylinder along Z */
  fillCylinderZ(
    cx: number,
    cy: number,
    z0: number,
    z1: number,
    radius: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte,
    innerRadius = 0
  ): this {
    const minZ = Math.max(0, Math.round(Math.min(z0, z1)));
    const maxZ = Math.min(this.sz - 1, Math.round(Math.max(z0, z1)));
    const rOutSq = radius * radius;
    const rInSq = innerRadius > 0 ? innerRadius * innerRadius : -1;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.sx - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.sy - 1, Math.ceil(cy + radius));
    const col = colorHex & 0xffffff;

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 <= rOutSq + 0.15 && d2 >= rInSq) {
          for (let z = minZ; z <= maxZ; z++) {
            const i = this.idx(x, y, z);
            this.channels[i] = channel;
            this.colors[i] = col;
          }
        }
      }
    }
    return this;
  }

  /** Horizontal cylinder along X */
  fillCylinderX(
    x0: number,
    x1: number,
    cy: number,
    cz: number,
    radius: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte,
    innerRadius = 0
  ): this {
    const minX = Math.max(0, Math.round(Math.min(x0, x1)));
    const maxX = Math.min(this.sx - 1, Math.round(Math.max(x0, x1)));
    const rOutSq = radius * radius;
    const rInSq = innerRadius > 0 ? innerRadius * innerRadius : -1;
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.sy - 1, Math.ceil(cy + radius));
    const minZ = Math.max(0, Math.floor(cz - radius));
    const maxZ = Math.min(this.sz - 1, Math.ceil(cz + radius));
    const col = colorHex & 0xffffff;

    for (let z = minZ; z <= maxZ; z++) {
      const dz = z - cz;
      for (let y = minY; y <= maxY; y++) {
        const dy = y - cy;
        const d2 = dy * dy + dz * dz;
        if (d2 <= rOutSq + 0.15 && d2 >= rInSq) {
          for (let x = minX; x <= maxX; x++) {
            const i = this.idx(x, y, z);
            this.channels[i] = channel;
            this.colors[i] = col;
          }
        }
      }
    }
    return this;
  }

  /** 3D voxel line segment with configurable brush radius (cables, hooks, spokes, bent bars) */
  fillLine(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    colorHex: number,
    channel: VoxelMat = VoxelMat.Matte,
    radius = 0
  ): this {
    const dist = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const steps = Math.max(1, Math.ceil(dist * 2));
    const rInt = Math.ceil(radius);
    const rSq = radius * radius + 0.15;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const cz = z0 + (z1 - z0) * t;
      if (rInt <= 0) {
        this.set(cx, cy, cz, colorHex, channel);
      } else {
        for (let dz = -rInt; dz <= rInt; dz++) {
          for (let dy = -rInt; dy <= rInt; dy++) {
            for (let dx = -rInt; dx <= rInt; dx++) {
              if (dx * dx + dy * dy + dz * dz <= rSq) {
                this.set(cx + dx, cy + dy, cz + dz, colorHex, channel);
              }
            }
          }
        }
      }
    }
    return this;
  }

  /** Carves horizontal louvered ventilation slots (e.g. metal locker doors, PC grilles) */
  carveLouvers(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    stepY = 2
  ): this {
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    for (let y = minY; y <= maxY; y += stepY) {
      this.carveBox(x0, y, z0, x1, y, z1);
    }
    return this;
  }

  /**
   * Adds deterministic subtle tonal wear/grain across Matte & Fabric voxels
   * (quantized into 3 micro-levels so Greedy Meshing still merges effectively!).
   */
  applyTactileGrain(seed: number, strength = 0.06, yPlankBands = 0): this {
    const total = this.channels.length;
    for (let z = 0; z < this.sz; z++) {
      for (let y = 0; y < this.sy; y++) {
        for (let x = 0; x < this.sx; x++) {
          const i = this.idx(x, y, z);
          if (i >= total) continue;
          const ch = this.channels[i] as VoxelMat;
          if (ch !== VoxelMat.Matte && ch !== VoxelMat.Fabric) continue;
          // Deterministic hash in -1..+1
          const h = (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (seed * 2654435761)) >>> 0) % 100;
          let delta = 0;
          if (h < 18) delta = -strength;
          else if (h > 82) delta = strength * 0.7;
          if (yPlankBands > 0 && y % yPlankBands === 0) {
            delta -= strength * 0.55;
          }
          if (delta === 0) continue;
          const col = this.colors[i];
          const r = Math.max(0, Math.min(255, Math.round(((col >> 16) & 0xff) * (1 + delta))));
          const g = Math.max(0, Math.min(255, Math.round(((col >> 8) & 0xff) * (1 + delta))));
          const b = Math.max(0, Math.min(255, Math.round((col & 0xff) * (1 + delta))));
          this.colors[i] = (r << 16) | (g << 8) | b;
        }
      }
    }
    return this;
  }

  /** Mirrors the X half `[0..mid)` onto the opposite half */
  mirrorX(): this {
    const mid = Math.floor(this.sx / 2);
    for (let z = 0; z < this.sz; z++) {
      for (let y = 0; y < this.sy; y++) {
        for (let x = 0; x < mid; x++) {
          const src = this.idx(x, y, z);
          const dst = this.idx(this.sx - 1 - x, y, z);
          this.channels[dst] = this.channels[src];
          this.colors[dst] = this.colors[src];
        }
      }
    }
    return this;
  }

  /**
   * Compiles the discrete 3D voxel grid into a single ultra-light multi-material
   * `BufferGeometry` using Hidden Face Culling + 2D Greedy Meshing + Baked Vertex AO.
   */
  build(options: SculptBuildOptions = {}): SculptMeshResult {
    const dims: [number, number, number] = [this.sx, this.sy, this.sz];
    const anchor = options.anchor ?? [this.sx * 0.5, 0, this.sz * 0.5];
    const aoStrength = options.aoStrength ?? 1.0;
    const vs = this.voxelSize;

    // Count filled voxels for stats
    let filledVoxels = 0;
    for (let i = 0; i < this.channels.length; i++) {
      if (this.channels[i] !== VoxelMat.Empty) filledVoxels++;
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    // Index buckets per material slot (0..4 matching VoxelMat 1..5)
    const channelIndices: number[][] = [[], [], [], [], []];

    let culledFaces = 0;
    let mergedQuads = 0;

    // Reusable coordinate vector for neighbor sampling
    const p: [number, number, number] = [0, 0, 0];
    const pN: [number, number, number] = [0, 0, 0];

    const cornerOffsets: readonly [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    const computeCornerShade = (
      x: number,
      y: number,
      z: number,
      spec: FaceDirSpec,
      su: number,
      sv: number,
      channel: VoxelMat
    ): number => {
      // Emissive and Glass voxels stay uniformly bright (no dark AO smudge on glowing LEDs/screens)
      if (channel === VoxelMat.Emissive || channel === VoxelMat.Glass || aoStrength <= 0) {
        return 3;
      }
      // Step 1 voxel outside along face normal
      pN[0] = x + spec.normal[0];
      pN[1] = y + spec.normal[1];
      pN[2] = z + spec.normal[2];

      const uA = spec.uAxis;
      const vA = spec.vAxis;

      // Side 1 neighbor in outer plane
      const s1p: [number, number, number] = [pN[0], pN[1], pN[2]];
      s1p[uA] += su;
      const s1 = this.isOpaque(s1p[0], s1p[1], s1p[2]) ? 1 : 0;

      // Side 2 neighbor in outer plane
      const s2p: [number, number, number] = [pN[0], pN[1], pN[2]];
      s2p[vA] += sv;
      const s2 = this.isOpaque(s2p[0], s2p[1], s2p[2]) ? 1 : 0;

      // Corner neighbor in outer plane
      const cp: [number, number, number] = [pN[0], pN[1], pN[2]];
      cp[uA] += su;
      cp[vA] += sv;
      const c = this.isOpaque(cp[0], cp[1], cp[2]) ? 1 : 0;

      const aoLevel = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
      if (aoLevel < 3) return aoLevel;

      // Convex outer edge wear check on the voxel's own slice
      const e1p: [number, number, number] = [x, y, z];
      e1p[uA] += su;
      const e1Empty = !this.isOpaque(e1p[0], e1p[1], e1p[2]);

      const e2p: [number, number, number] = [x, y, z];
      e2p[vA] += sv;
      const e2Empty = !this.isOpaque(e2p[0], e2p[1], e2p[2]);

      if (e1Empty && e2Empty) return 5;
      if (e1Empty || e2Empty) return 4;
      return 3;
    };

    // Sweep each of the 6 cardinal face directions
    for (const spec of FACE_DIRS) {
      const nLen = dims[spec.axis];
      const uLen = dims[spec.uAxis];
      const vLen = dims[spec.vAxis];
      const sliceSize = uLen * vLen;

      // 2D slice mask: channel, color, and packed 4-corner shade (12 bits)
      const maskCh = new Uint8Array(sliceSize);
      const maskCol = new Uint32Array(sliceSize);
      const maskShade = new Uint16Array(sliceSize);

      for (let d = 0; d < nLen; d++) {
        maskCh.fill(0);
        let anyInSlice = false;

        // 1. Populate slice mask with Hidden Face Culling & Baked Corner AO
        for (let v = 0; v < vLen; v++) {
          for (let u = 0; u < uLen; u++) {
            p[spec.axis] = d;
            p[spec.uAxis] = u;
            p[spec.vAxis] = v;

            const ch = this.getChannel(p[0], p[1], p[2]);
            if (ch === VoxelMat.Empty) continue;

            // Hidden Face Culling against neighbor in outward normal direction
            const nx = p[0] + spec.normal[0];
            const ny = p[1] + spec.normal[1];
            const nz = p[2] + spec.normal[2];
            const neighborCh = this.getChannel(nx, ny, nz);

            // Cull if neighbor is opaque, OR if both are glass
            if (
              (neighborCh !== VoxelMat.Empty && neighborCh !== VoxelMat.Glass) ||
              (ch === VoxelMat.Glass && neighborCh === VoxelMat.Glass)
            ) {
              continue;
            }

            culledFaces++;
            anyInSlice = true;

            const s0 = computeCornerShade(p[0], p[1], p[2], spec, cornerOffsets[0][0], cornerOffsets[0][1], ch);
            const s1 = computeCornerShade(p[0], p[1], p[2], spec, cornerOffsets[1][0], cornerOffsets[1][1], ch);
            const s2 = computeCornerShade(p[0], p[1], p[2], spec, cornerOffsets[2][0], cornerOffsets[2][1], ch);
            const s3 = computeCornerShade(p[0], p[1], p[2], spec, cornerOffsets[3][0], cornerOffsets[3][1], ch);

            const mi = u + v * uLen;
            maskCh[mi] = ch;
            maskCol[mi] = this.getColor(p[0], p[1], p[2]);
            maskShade[mi] = s0 | (s1 << 3) | (s2 << 6) | (s3 << 9);
          }
        }

        if (!anyInSlice) continue;

        // 2. 2D Greedy Meshing across (u, v)
        const slicePlane = spec.sign > 0 ? d + 1 : d;

        for (let v = 0; v < vLen; v++) {
          for (let u = 0; u < uLen; ) {
            const mi = u + v * uLen;
            const ch = maskCh[mi];
            if (ch === 0) {
              u++;
              continue;
            }
            const col = maskCol[mi];
            const sh = maskShade[mi];

            // Expand width along U
            let w = 1;
            while (
              u + w < uLen &&
              maskCh[mi + w] === ch &&
              maskCol[mi + w] === col &&
              maskShade[mi + w] === sh
            ) {
              w++;
            }

            // Expand height along V
            let h = 1;
            outerH: while (v + h < vLen) {
              const rowOff = (v + h) * uLen + u;
              for (let k = 0; k < w; k++) {
                if (
                  maskCh[rowOff + k] !== ch ||
                  maskCol[rowOff + k] !== col ||
                  maskShade[rowOff + k] !== sh
                ) {
                  break outerH;
                }
              }
              h++;
            }

            // Clear consumed rectangle from mask
            for (let dv = 0; dv < h; dv++) {
              const rowOff = (v + dv) * uLen + u;
              for (let du = 0; du < w; du++) {
                maskCh[rowOff + du] = 0;
              }
            }

            // Emit merged quad with baked vertex AO + convex edge wear + AO-aware diagonal flip
            mergedQuads++;
            const baseVert = positions.length / 3;
            const s0 = sh & 7;
            const s1 = (sh >> 3) & 7;
            const s2 = (sh >> 6) & 7;
            const s3 = (sh >> 9) & 7;
            const cornerShades = [s0, s1, s2, s3];

            _tmpColor.setHex(col);
            // Convert sRGB hex into linear working color space for Three.js vertexColors
            _tmpColor.convertSRGBToLinear();

            const quadUV: readonly [number, number][] = [
              [u, v],
              [u + w, v],
              [u + w, v + h],
              [u, v + h],
            ];
            const texUV: readonly [number, number][] = [
              [0, 0],
              [w, 0],
              [w, h],
              [0, h],
            ];

            for (let ci = 0; ci < 4; ci++) {
              p[spec.axis] = slicePlane;
              p[spec.uAxis] = quadUV[ci][0];
              p[spec.vAxis] = quadUV[ci][1];

              positions.push(
                (p[0] - anchor[0]) * vs,
                (p[1] - anchor[1]) * vs,
                (p[2] - anchor[2]) * vs
              );
              normals.push(spec.normal[0], spec.normal[1], spec.normal[2]);
              uvs.push(texUV[ci][0], texUV[ci][1]);

              const rawMult = SHADE_TABLE[cornerShades[ci]];
              const aoMult = 1 + (rawMult - 1) * aoStrength;
              const finalMult =
                ch === VoxelMat.Emissive
                  ? 1.12
                  : ch === VoxelMat.Glass
                  ? 1.0
                  : aoMult * spec.dirShade;
              colors.push(
                Math.min(1.4, _tmpColor.r * finalMult),
                Math.min(1.4, _tmpColor.g * finalMult),
                Math.min(1.4, _tmpColor.b * finalMult)
              );
            }

            const bucket = channelIndices[ch - 1];
            // AO-aware diagonal flip prevents smooth-shading interpolation artifacts
            if (s0 + s2 >= s1 + s3) {
              bucket.push(baseVert, baseVert + 1, baseVert + 2, baseVert, baseVert + 2, baseVert + 3);
            } else {
              bucket.push(baseVert + 1, baseVert + 2, baseVert + 3, baseVert + 1, baseVert + 3, baseVert);
            }

            u += w;
          }
        }
      }
    }

    // Flatten channel index buckets and assign multi-material geometry groups
    const totalIndices = channelIndices.reduce((acc, arr) => acc + arr.length, 0);
    const vertCount = positions.length / 3;
    const indexArray =
      vertCount > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

    const geometry = new THREE.BufferGeometry();
    let offset = 0;
    let channelCount = 0;
    for (let matIdx = 0; matIdx < channelIndices.length; matIdx++) {
      const arr = channelIndices[matIdx];
      if (arr.length === 0) continue;
      indexArray.set(arr, offset);
      geometry.addGroup(offset, arr.length, matIdx);
      offset += arr.length;
      channelCount++;
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    const uvAttr = new THREE.Float32BufferAttribute(uvs, 2);
    geometry.setAttribute('uv', uvAttr);
    geometry.setAttribute('uv1', uvAttr);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return {
      geometry,
      stats: {
        filledVoxels,
        naiveFaces: filledVoxels * 6,
        culledFaces,
        mergedQuads,
        triangles: mergedQuads * 2,
        channelCount,
      },
    };
  }
}

let _metalMapsCache: { rough: THREE.Texture; metal: THREE.Texture } | null = null;

function getSculptedMetalPbrMaps(): { rough: THREE.Texture; metal: THREE.Texture } | null {
  if (_metalMapsCache) return _metalMapsCache;
  if (typeof document === 'undefined') return null;
  const size = 32;
  const rCanvas = document.createElement('canvas');
  const mCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  mCanvas.width = size;
  mCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');
  const mCtx = mCanvas.getContext('2d');
  if (!rCtx || !mCtx) return null;

  const rImg = rCtx.createImageData(size, size);
  const mImg = mCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const streak = ((y * 17 + 7) % 13) / 13;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const frac = hash - Math.floor(hash);
      // Varied metallic roughness 0.14..0.38 with subtle horizontal brushed grain
      const roughVal = Math.round((0.14 + streak * 0.14 + frac * 0.10) * 255);
      // High metallic reflectance 0.85..1.00
      const metalVal = Math.round((0.85 + frac * 0.15) * 255);
      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
      mImg.data[idx] = metalVal;
      mImg.data[idx + 1] = metalVal;
      mImg.data[idx + 2] = metalVal;
      mImg.data[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);
  mCtx.putImageData(mImg, 0, 0);

  const rough = new THREE.CanvasTexture(rCanvas);
  const metal = new THREE.CanvasTexture(mCanvas);
  for (const t of [rough, metal]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
  _metalMapsCache = { rough, metal };
  return _metalMapsCache;
}

/**
 * Creates a fresh 5-slot multi-channel PBR material array matching VoxelMat 1..5:
 *   [0] Matte, [1] Metal (True PBR metalness=1.0 + metalnessMap/roughnessMap), [2] Emissive, [3] Glass, [4] Fabric
 */
export function createSculptedMaterialSet(): THREE.Material[] {
  const metalMaps = getSculptedMetalPbrMaps();
  return [
    // 0: Matte wood / paint / concrete / plastic (zero metallic sheen)
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.0,
      envMapIntensity: 0.55,
    }),
    // 1: Brushed / reflective metal (steel, brass, chrome, copper, rebar, taser electrodes)
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: metalMaps ? 1.0 : 0.22,
      metalness: 1.0,
      roughnessMap: metalMaps?.rough ?? null,
      metalnessMap: metalMaps?.metal ?? null,
      envMapIntensity: 1.18,
    }),
    // 2: Emissive self-lit LEDs / screens / neon Compound 09 / coils
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    }),
    // 3: Translucent optical glass / lenses / cracked frames / cylinders
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.06,
      metalness: 0.16,
      envMapIntensity: 1.32,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
    // 4: Fabric / crumpled bedding / rubberized grips / organic soil
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.42,
    }),
  ];
}

// Per-world geometry + shared material cache (safely cleared whenever worldRegistry.disposeAll() runs!)
const _geometryCache = new Map<string, THREE.BufferGeometry>();
let _sharedWorldMaterials: THREE.Material[] | null = null;

/**
 * Returns the shared world sculpted multi-material array.
 * Cleared cleanly when `clearSculptedCache()` is called alongside `worldRegistry.disposeAll()`.
 */
export function getSharedSculptedMaterials(): THREE.Material[] {
  if (!_sharedWorldMaterials) {
    _sharedWorldMaterials = createSculptedMaterialSet();
  }
  return _sharedWorldMaterials;
}

/**
 * Builds or retrieves a cached sculpted `BufferGeometry` so identical props across the
 * mansion share a single GPU buffer (60 FPS on mobile + tiny VRAM footprint).
 */
export function getCachedSculptedGeometry(
  cacheKey: string,
  builder: () => THREE.BufferGeometry
): THREE.BufferGeometry {
  let geo = _geometryCache.get(cacheKey);
  if (!geo) {
    geo = builder();
    _geometryCache.set(cacheKey, geo);
  }
  return geo;
}

/**
 * Helper to create a sculpted THREE.Mesh using either the shared world cache
 * or fresh standalone materials (for camera-mounted viewmodels that outlive world rebuilds).
 */
export function createSculptedMesh(
  cacheKey: string | null,
  builder: () => THREE.BufferGeometry,
  options?: { castShadow?: boolean; receiveShadow?: boolean; standalone?: boolean }
): THREE.Mesh {
  const geo =
    cacheKey && !options?.standalone
      ? getCachedSculptedGeometry(cacheKey, builder)
      : builder();
  const mats = options?.standalone ? createSculptedMaterialSet() : getSharedSculptedMaterials();
  const mesh = new THREE.Mesh(geo, mats);
  if (options?.castShadow) mesh.castShadow = true;
  if (options?.receiveShadow !== false) mesh.receiveShadow = true;
  return mesh;
}

/**
 * Clears cached references after `worldRegistry.disposeAll()` so next scene build
 * allocates fresh WebGL buffers without reusing disposed resources.
 */
export function clearSculptedCache(disposeNow = false): void {
  if (disposeNow) {
    for (const geo of _geometryCache.values()) geo.dispose();
    if (_sharedWorldMaterials) {
      for (const m of _sharedWorldMaterials) m.dispose();
    }
  }
  _geometryCache.clear();
  _sharedWorldMaterials = null;
}

/**
 * Geometric audit utility used by `modelAudit.test.ts` to verify triangle density
 * and reject single plain BoxGeometry placeholders.
 */
export function inspectObjectGeometry(root: THREE.Object3D): {
  triangles: number;
  meshCount: number;
  isPlainSingleBox: boolean;
} {
  let triangles = 0;
  let meshCount = 0;
  let onlyBoxGeometry = true;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshCount++;
    const geo = mesh.geometry;
    if (!(geo instanceof THREE.BoxGeometry)) {
      onlyBoxGeometry = false;
    }
    if (geo.index) {
      triangles += geo.index.count / 3;
    } else if (geo.attributes.position) {
      triangles += geo.attributes.position.count / 3;
    }
  });

  const isPlainSingleBox = meshCount <= 1 && onlyBoxGeometry && triangles <= 12;
  return { triangles: Math.round(triangles), meshCount, isPlainSingleBox };
}
