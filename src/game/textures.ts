import * as THREE from 'three';

export type MaterialId =
  | 'wood_floor'
  | 'concrete_wall'
  | 'wallpaper_wall'
  | 'grimy_tile'
  | 'basement_wall'
  | 'basement_wet'
  | 'courtyard_stone'
  | 'grass_block'
  | 'oak_log'
  | 'ceiling_plaster'
  | 'rusted_metal'
  | 'vent_metal'
  | 'bunker_blast_door'
  | 'door_wood'
  | 'door_red'
  | 'door_blue'
  | 'door_iron'
  | 'door_exit'
  | 'plank_wood'
  | 'bookshelf_voxel'
  | 'crate_wood'
  | 'monitor_crt'
  | 'stair_step';

export interface MaterialPack {
  materials: Record<MaterialId, THREE.MeshStandardMaterial>;
  contactShadowTex: THREE.CanvasTexture;
  flashlightLensTex: THREE.CanvasTexture;
  cobwebTex: THREE.CanvasTexture;
  grassTuftTex: THREE.CanvasTexture;
  moonTex: THREE.CanvasTexture;
  glowHaloTex: THREE.CanvasTexture;
  waterDripRingTex: THREE.CanvasTexture;
  waterNormalTex: THREE.CanvasTexture;
  diddyFaceTex: THREE.CanvasTexture;
  diddySuitTex: THREE.CanvasTexture;
  survivorFaceTex: THREE.CanvasTexture;
  dirtyGlassMap: THREE.CanvasTexture;
  dirtyGlassAlphaMap: THREE.CanvasTexture;
  clawMarksTex: THREE.CanvasTexture;
  oozeSeepTex: THREE.CanvasTexture;
  cellScribbleTex: THREE.CanvasTexture;
  drizzyFootprintTex: THREE.CanvasTexture;
  setParallaxEnabled(enabled: boolean, strength?: number): void;
  setTextureQuality(quality: 'low' | 'medium' | 'high'): void;
  dispose(): void;
}

export class ResourceRegistry {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();

  trackGeometry<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.add(g);
    return g;
  }

  trackMaterial<T extends THREE.Material>(m: T): T {
    this.materials.add(m);
    return m;
  }

  trackTexture<T extends THREE.Texture>(t: T): T {
    this.textures.add(t);
    return t;
  }

  trackObject3D(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) this.geometries.add(mesh.geometry);
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          this.materials.add(m);
          const std = m as THREE.MeshStandardMaterial;
          if (std.map) this.textures.add(std.map);
          if (std.normalMap) this.textures.add(std.normalMap);
          if (std.bumpMap) this.textures.add(std.bumpMap);
          if (std.aoMap) this.textures.add(std.aoMap);
          if (std.roughnessMap) this.textures.add(std.roughnessMap);
          if (std.metalnessMap) this.textures.add(std.metalnessMap);
          if (std.emissiveMap) this.textures.add(std.emissiveMap);
        }
      }
    });
  }

  disposeAll(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}

function hashPx(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

interface VoxelPixelResult {
  r: number;
  g: number;
  b: number;
  height?: number;
  roughness?: number;
  metalness?: number;
  emissive?: [number, number, number];
}

interface ParallaxBinding {
  material: THREE.MeshStandardMaterial;
  uniformScale: { value: number };
}

/**
 * Pure Crisp 32x32 Pixel-Art PBR Voxel Texture Generator.
 * Generates paired 32x32 `map` + `normalMap` (Sobel relief from heightmap) + `aoMap` (deep mortar/crack shadow)
 * + `roughnessMap` + `metalnessMap` + optional per-pixel `emissiveMap`, all strictly using THREE.NearestFilter
 * and generateMipmaps=false (ZERO blur/smooth!).
 * Optionally registers UV-clamped Parallax Mapping (activated ONLY on High/Ultra presets).
 */
function buildPixelVoxelMaterial32(
  pixelFn: (x: number, y: number) => VoxelPixelResult,
  options: {
    metalness?: number;
    roughness?: number;
    bumpScale?: number;
    normalStrength?: number;
    repeatX?: number;
    repeatY?: number;
    emissive?: number;
    emissiveIntensity?: number;
    useEmissiveMap?: boolean;
    moistureGradient?: boolean;
    parallax?: boolean;
    worldSpaceFloorWeathering?: boolean;
    doubleSide?: boolean;
  } = {}
): {
  material: THREE.MeshStandardMaterial;
  textures: THREE.CanvasTexture[];
  parallaxBinding?: ParallaxBinding;
} {
  const pixelRes = 32;
  const colorCanvas = document.createElement('canvas');
  const heightCanvas = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const aoCanvas = document.createElement('canvas');
  const metalCanvas = document.createElement('canvas');
  const emissiveCanvas = document.createElement('canvas');

  for (const c of [colorCanvas, heightCanvas, normalCanvas, roughCanvas, aoCanvas, metalCanvas, emissiveCanvas]) {
    c.width = pixelRes;
    c.height = pixelRes;
  }

  const cCtx = colorCanvas.getContext('2d')!;
  const hCtx = heightCanvas.getContext('2d')!;
  const nCtx = normalCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const aCtx = aoCanvas.getContext('2d')!;
  const mCtx = metalCanvas.getContext('2d')!;
  const eCtx = emissiveCanvas.getContext('2d')!;

  const cImg = cCtx.createImageData(pixelRes, pixelRes);
  const hImg = hCtx.createImageData(pixelRes, pixelRes);
  const nImg = nCtx.createImageData(pixelRes, pixelRes);
  const rImg = rCtx.createImageData(pixelRes, pixelRes);
  const aImg = aCtx.createImageData(pixelRes, pixelRes);
  const mImg = mCtx.createImageData(pixelRes, pixelRes);
  const eImg = eCtx.createImageData(pixelRes, pixelRes);

  const heights = new Float32Array(pixelRes * pixelRes);
  let hasPixelEmissive = false;
  const baseRough = options.roughness ?? 0.85;
  const baseMetal = options.metalness ?? 0.04;

  for (let y = 0; y < pixelRes; y++) {
    for (let x = 0; x < pixelRes; x++) {
      const res = pixelFn(x, y);
      const i = (y * pixelRes + x) * 4;
      const hVal = Math.max(0, Math.min(255, Math.round(res.height ?? 140)));
      heights[y * pixelRes + x] = hVal / 255;

      // Subtle abandoned moisture/dirt darkening near the bottom edge (lower ~40cm of wall tiles)
      let dampMult = 1.0;
      let dampRoughMod = 0;
      if (options.moistureGradient && y >= 22) {
        const t = (y - 22) / 9; // 0..1 towards bottom
        dampMult = 1.0 - t * 0.28;
        dampRoughMod = -t * 0.14; // slightly damper sheen near floor
      }

      // Deep crevice albedo darkening so mortar joints & cracks read as genuine sunken holes
      const creviceAo = hVal < 95 ? 0.72 + (hVal / 95) * 0.28 : 1.0;
      const shade = dampMult * (0.86 + creviceAo * 0.14);

      cImg.data[i] = Math.max(0, Math.min(255, Math.round(res.r * shade)));
      cImg.data[i + 1] = Math.max(0, Math.min(255, Math.round(res.g * shade)));
      cImg.data[i + 2] = Math.max(0, Math.min(255, Math.round(res.b * shade)));
      cImg.data[i + 3] = 255;

      hImg.data[i] = hImg.data[i + 1] = hImg.data[i + 2] = hVal;
      hImg.data[i + 3] = 255;

      // Crevices/cracks are ultra-matte (high roughness), raised wet/tile surfaces catch specular glint
      const pxRough = Math.max(
        0.12,
        Math.min(0.98, (res.roughness ?? baseRough) + (hVal < 90 ? 0.16 : 0) + dampRoughMod)
      );
      const rByte = Math.round(pxRough * 255);
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = rByte;
      rImg.data[i + 3] = 255;

      // Ambient occlusion map: deep cracks & bottom border darkened
      const aoVal = Math.max(0.32, Math.min(1.0, (0.48 + (hVal / 255) * 0.56) * dampMult));
      const aoByte = Math.round(aoVal * 255);
      aImg.data[i] = aImg.data[i + 1] = aImg.data[i + 2] = aoByte;
      aImg.data[i + 3] = 255;

      const pxMetal = Math.max(0, Math.min(1, res.metalness ?? (hVal < 85 ? baseMetal * 0.25 : baseMetal)));
      const mByte = Math.round(pxMetal * 255);
      mImg.data[i] = mImg.data[i + 1] = mImg.data[i + 2] = mByte;
      mImg.data[i + 3] = 255;

      if (res.emissive) {
        hasPixelEmissive = true;
        eImg.data[i] = Math.max(0, Math.min(255, Math.round(res.emissive[0])));
        eImg.data[i + 1] = Math.max(0, Math.min(255, Math.round(res.emissive[1])));
        eImg.data[i + 2] = Math.max(0, Math.min(255, Math.round(res.emissive[2])));
        eImg.data[i + 3] = 255;
      } else {
        eImg.data[i] = eImg.data[i + 1] = eImg.data[i + 2] = 0;
        eImg.data[i + 3] = 255;
      }
    }
  }

  // Compute crisp 32x32 Tangent-Space Sobel Normal Map from heightfield
  const nStrength = options.normalStrength ?? 2.6;
  const sampleH = (sx: number, sy: number) =>
    heights[((sy + pixelRes) % pixelRes) * pixelRes + ((sx + pixelRes) % pixelRes)];

  for (let y = 0; y < pixelRes; y++) {
    for (let x = 0; x < pixelRes; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * nStrength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * nStrength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const i = (y * pixelRes + x) * 4;
      nImg.data[i] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      nImg.data[i + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      nImg.data[i + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      nImg.data[i + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  aCtx.putImageData(aImg, 0, 0);
  mCtx.putImageData(mImg, 0, 0);
  if (hasPixelEmissive) eCtx.putImageData(eImg, 0, 0);

  const repX = options.repeatX ?? 1;
  const repY = options.repeatY ?? 1;

  const makeCrispTex = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  };

  const map = makeCrispTex(colorCanvas, true);
  const normalMap = makeCrispTex(normalCanvas, false);
  const roughnessMap = makeCrispTex(roughCanvas, false);
  const aoMap = makeCrispTex(aoCanvas, false);
  aoMap.channel = 0; // Explicit Three.js r187 channel contract so ALL 32x32 voxel props & world chunks sample UV0!
  const metalnessMap = makeCrispTex(metalCanvas, false);
  const heightMap = makeCrispTex(heightCanvas, false);
  const textures: THREE.CanvasTexture[] = [map, normalMap, roughnessMap, aoMap, metalnessMap, heightMap];

  let emissiveMap: THREE.CanvasTexture | undefined;
  if (hasPixelEmissive) {
    emissiveMap = makeCrispTex(emissiveCanvas, true);
    textures.push(emissiveMap);
  }

  const matParams: THREE.MeshStandardMaterialParameters = {
    color: 0xffffff,
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    aoMap,
    aoMapIntensity: 0.72,
    roughnessMap,
    roughness: 1.0, // Driven per-pixel by roughnessMap!
    metalnessMap,
    metalness: baseMetal > 0.05 ? 1.0 : baseMetal,
    emissive: hasPixelEmissive
      ? new THREE.Color(0xffffff)
      : options.emissive !== undefined
      ? new THREE.Color(options.emissive)
      : new THREE.Color(0x000000),
    emissiveIntensity: hasPixelEmissive ? options.emissiveIntensity ?? 1.15 : options.emissiveIntensity ?? 0,
    side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  };
  if (emissiveMap) {
    matParams.emissiveMap = emissiveMap;
  }
  const material = new THREE.MeshStandardMaterial(matParams);

  // Combined safe UV-Clamped Parallax Mapping + World-Space Floor Wetness/Grime Variation Shader
  // Breaks up repeating grid tiles organically across worldPosition.xz at near-zero mobile GPU cost!
  let parallaxBinding: ParallaxBinding | undefined;
  const useWorldWeather = Boolean(options.worldSpaceFloorWeathering);
  if (options.parallax || useWorldWeather) {
    const uniformScale = { value: 0.0 };
    material.onBeforeCompile = (shader) => {
      if (options.parallax) {
        shader.uniforms.uParallaxHeight = { value: heightMap };
        shader.uniforms.uParallaxScale = uniformScale;
      }
      if (useWorldWeather) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nvarying vec3 vFloorWorldPos;`)
          .replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
            vec4 fwp = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
              fwp = instanceMatrix * fwp;
            #endif
            fwp = modelMatrix * fwp;
            vFloorWorldPos = fwp.xyz;`
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vFloorWorldPos;
          float floorHash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          float floorNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = floorHash21(i);
            float b = floorHash21(i + vec2(1.0, 0.0));
            float c = floorHash21(i + vec2(0.0, 1.0));
            float d = floorHash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }`
        );
      }
      if (options.parallax) {
        shader.fragmentShader =
          `uniform sampler2D uParallaxHeight;\nuniform float uParallaxScale;\n` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          #ifdef USE_MAP
            vec2 pUv = vMapUv;
            if (uParallaxScale > 0.0001) {
              float h0 = texture2D(uParallaxHeight, vMapUv).r;
              vec3 viewDir = normalize(vViewPosition);
              vec2 tileFloor = floor(vMapUv);
              vec2 tileFrac = fract(vMapUv);
              vec2 shift = clamp(viewDir.xy * ((0.55 - h0) * uParallaxScale), vec2(-0.025), vec2(0.025));
              vec2 clampedFrac = clamp(tileFrac + shift, vec2(0.02), vec2(0.98));
              pUv = tileFloor + clampedFrac;
            }
            vec4 sampledDiffuseColor = texture2D( map, pUv );
            diffuseColor *= sampledDiffuseColor;
          #endif
          `
        );
      }
      if (useWorldWeather) {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float wMacro = floorNoise(vFloorWorldPos.xz * 0.22);
            float wDetail = floorNoise(vFloorWorldPos.xz * 0.85 + vec2(7.3, 13.1));
            float wWetPatch = smoothstep(0.56, 0.84, wMacro * 0.72 + wDetail * 0.28);
            float wGrime = smoothstep(0.62, 0.90, floorNoise(vFloorWorldPos.xz * 0.42 + vec2(19.4, 3.7)));
            // Subtle macro tone drift + damp darkening + organic moss/sludge tint in worn patches
            diffuseColor.rgb *= mix(0.84, 1.09, wMacro * 0.65 + wDetail * 0.35);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66, 0.74, 0.78), wWetPatch * 0.58);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10, 0.16, 0.12), wGrime * 0.32);`
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            float rWet = smoothstep(0.56, 0.84, floorNoise(vFloorWorldPos.xz * 0.22) * 0.72 + floorNoise(vFloorWorldPos.xz * 0.85 + vec2(7.3, 13.1)) * 0.28);
            roughnessFactor = mix(roughnessFactor, max(0.14, roughnessFactor * 0.32), rWet * 0.75);`
          );
      }
    };
    const keyTag = `${options.parallax ? 'p' : ''}${useWorldWeather ? 'w' : ''}`;
    material.customProgramCacheKey = () => `voxel_pbr_${keyTag}_v2`;
    if (options.parallax) {
      parallaxBinding = { material, uniformScale };
    }
  }

  return { material, textures, parallaxBinding };
}

/**
 * Realistic 64x64 Parabolic Flashlight Optics Lens Texture (`SpotLight.map`):
 * Warm bright parabolic core + subtle Fresnel optical ring + smooth falloff to black border.
 */
function createFlashlightLensTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.49);
  grad.addColorStop(0.0, 'rgba(255, 253, 246, 1.0)');
  grad.addColorStop(0.45, 'rgba(255, 250, 236, 0.98)');
  grad.addColorStop(0.62, 'rgba(242, 236, 222, 0.86)');
  grad.addColorStop(0.73, 'rgba(255, 252, 240, 0.95)'); // crisp parabolic Fresnel optic ring
  grad.addColorStop(0.86, 'rgba(215, 210, 198, 0.56)');
  grad.addColorStop(0.96, 'rgba(95, 92, 86, 0.14)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle inner reflector ring micro-variation
  ctx.strokeStyle = 'rgba(255, 248, 226, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Crisp 32x32 Pixel-Art Cobweb Texture for abandoned room ceiling corners */
function createCobwebTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = 'rgba(220, 228, 238, 0.55)';
  // Diagonal anchor strands from top-left corner (0,0)
  for (let i = 0; i < 30; i++) {
    ctx.fillRect(i, 0, 1, 1);
    ctx.fillRect(0, i, 1, 1);
    if (i < 26) ctx.fillRect(i, i, 1, 1);
    if (i < 24) ctx.fillRect(i, Math.floor(i * 0.45), 1, 1);
    if (i < 24) ctx.fillRect(Math.floor(i * 0.45), i, 1, 1);
  }
  // Concentric pixel silk arcs
  for (const r of [7, 13, 20, 26]) {
    for (let a = 0; a <= 24; a++) {
      const ang = (a / 24) * (Math.PI / 2);
      const px = Math.round(Math.cos(ang) * r);
      const py = Math.round(Math.sin(ang) * r);
      if (px < 31 && py < 31) ctx.fillRect(px, py, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Crisp 32x32 Pixel-Art Weeds & Dry Autumn Leaves for Courtyard floor cracks */
function createGrassTuftTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  const blades = [
    { x: 6, h: 14, col: '#2d5a34' },
    { x: 9, h: 20, col: '#3a7242' },
    { x: 13, h: 16, col: '#284e2e' },
    { x: 17, h: 22, col: '#45804c' },
    { x: 21, h: 15, col: '#34663c' },
    { x: 25, h: 12, col: '#2b5231' },
  ];
  for (const b of blades) {
    ctx.fillStyle = b.col;
    for (let y = 0; y < b.h; y++) {
      const bend = y > b.h * 0.6 ? (b.x < 16 ? -1 : 1) : 0;
      ctx.fillRect(b.x + bend, 31 - y, 2, 1);
    }
  }
  // Dry fallen brownish-amber leaves at base
  ctx.fillStyle = '#7c512c';
  ctx.fillRect(4, 29, 4, 2);
  ctx.fillRect(19, 30, 5, 2);
  ctx.fillStyle = '#9a6838';
  ctx.fillRect(11, 30, 3, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Crisp 64x64 Pixel-Art Cratered Full Moon with Maria Seas, Crater Rims & Lunar Limb Shading */
function createMoonTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = 31.5;
  const cy = 31.5;
  const rad = 26.5;

  const maria: [number, number, number][] = [
    [22, 23, 8.2],
    [39, 25, 6.8],
    [29, 39, 7.6],
    [43, 38, 5.2],
    [19, 36, 4.4],
  ];
  const craters: [number, number, number][] = [
    [21, 21, 3.6],
    [40, 35, 3.1],
    [28, 46, 2.7],
    [35, 18, 2.5],
    [16, 33, 2.2],
    [45, 24, 2.1],
    [31, 30, 1.9],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > rad) continue;

      const normD = d / rad;
      // Directional lunar illumination from upper-left + realistic limb darkening
      const lightBias = (-dx * 0.011 - dy * 0.009) + (1 - normD * normD) * 0.12;
      const grain = (hashPx(x, y, 709) - 0.5) * 0.09;
      let lum = 0.78 + lightBias + grain;

      // Dark basalt Maria plains
      for (const [mx, my, mr] of maria) {
        const md = Math.hypot(x - mx, y - my);
        if (md < mr) {
          lum -= 0.24 * (1 - md / mr);
        }
      }

      // Crisp impact craters with recessed shadow + sunlit rim
      for (const [kx, ky, kr] of craters) {
        const kd = Math.hypot(x - kx, y - ky);
        if (kd < kr * 0.82) {
          lum -= 0.25;
        } else if (kd >= kr * 0.82 && kd <= kr * 1.18) {
          const rimLit = (x - kx) + (y - ky) > 0 ? 0.12 : -0.07;
          lum += rimLit;
        }
      }

      if (normD > 0.84) lum -= (normD - 0.84) * 1.35;
      lum = Math.max(0.38, Math.min(0.95, lum));

      const r = Math.round(205 * lum + 18);
      const g = Math.round(218 * lum + 18);
      const b = Math.round(240 * lum + 14);
      ctx.fillStyle = `rgb(${Math.min(248, r)},${Math.min(250, g)},${Math.min(255, b)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Seamless 64x64 Tileable Procedural Wave Normal Map for Living Water Shader */
function createWaterNormalTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);

  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * tau;
      const v = (y / size) * tau;
      const h =
        Math.sin(u * 2 + v * 1) * 0.34 +
        Math.cos(u * 3 - v * 2) * 0.28 +
        Math.sin(u * 5 + v * 4) * 0.16 +
        Math.cos(u * 1 - v * 5) * 0.14 +
        (hashPx(x, y, 911) - 0.5) * 0.08;
      heights[y * size + x] = h;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = (x + size - 1) % size;
      const xr = (x + 1) % size;
      const yu = (y + size - 1) % size;
      const yd = (y + 1) % size;
      const dx = (heights[y * size + xr] - heights[y * size + xl]) * 1.45;
      const dy = (heights[yd * size + x] - heights[yu * size + x]) * 1.45;
      const len = Math.hypot(dx, dy, 1.0);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1.0 / len;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Soft Radial Glow Sprite Texture for Fake Bloom (P. Diddy Eyes, Lamps, UV & Dropped Items) */
function createGlowHaloTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Pixel-Art Expanding Water Drip Ripple Ring */
function createWaterDripRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = 'rgba(180, 224, 255, 0.85)';
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5);
      if (Math.abs(d - 12.5) < 1.35) ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(2, 2, 12, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(4, 4, 8, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Crisp 32x32 pixel-art face texture for P. Drizzy (Sujeito 09):
 * Cracked dark sunglasses with crimson-amber glowing eyes behind lenses, stern brow, faint Composto 09 oil streak.
 */
function createDiddyFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = hashPx(x, y, 401);
      const cheekShadow = x < 3 || x > 28 ? 0.82 : 1.0;
      const shade = (0.89 + n * 0.14) * cheekShadow;
      ctx.fillStyle = `rgb(${Math.round(108 * shade)},${Math.round(68 * shade)},${Math.round(48 * shade)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Crisp fade haircut
  ctx.fillStyle = '#121014';
  ctx.fillRect(0, 0, 32, 6);
  ctx.fillRect(0, 6, 2, 6);
  ctx.fillRect(30, 6, 2, 6);
  ctx.fillStyle = '#201c24';
  for (let x = 2; x < 30; x += 3) ctx.fillRect(x, 1, 1, 3);

  // Stern furrowed eyebrows
  ctx.fillStyle = '#0e0b0e';
  ctx.fillRect(4, 8, 10, 2);
  ctx.fillRect(18, 8, 10, 2);
  ctx.fillRect(12, 10, 2, 2);
  ctx.fillRect(18, 10, 2, 2);

  // Cracked heavy dark sunglasses
  ctx.fillStyle = '#05070b';
  ctx.fillRect(2, 10, 12, 8);
  ctx.fillRect(18, 10, 12, 8);
  ctx.fillRect(14, 12, 4, 2);
  // Crisp pixel glass crack diagonally across left lens!
  ctx.fillStyle = '#64748b';
  ctx.fillRect(4, 11, 2, 1);
  ctx.fillRect(6, 12, 1, 2);
  ctx.fillRect(7, 14, 2, 1);
  ctx.fillRect(9, 15, 1, 2);
  ctx.fillStyle = '#334155';
  ctx.fillRect(19, 11, 3, 1);

  // Glowing red-amber mutated eyes piercing behind the cracked lenses
  ctx.fillStyle = '#ff2a14';
  ctx.fillRect(6, 12, 4, 4);
  ctx.fillRect(22, 12, 4, 4);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(7, 13, 2, 2);
  ctx.fillRect(23, 13, 2, 2);

  // Dark-green Composto 09 serum vein streaks along left temple & jaw
  ctx.fillStyle = '#134e4a';
  ctx.fillRect(2, 19, 2, 5);
  ctx.fillRect(4, 22, 2, 3);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(3, 20, 1, 3);

  // Nose bridge & nostrils
  ctx.fillStyle = '#4e2e1e';
  ctx.fillRect(14, 18, 4, 4);
  ctx.fillStyle = '#2e1a10';
  ctx.fillRect(13, 21, 2, 1);
  ctx.fillRect(17, 21, 2, 1);

  // Heavy beard/goatee & tense scowl
  ctx.fillStyle = '#131014';
  ctx.fillRect(7, 22, 18, 10);
  ctx.fillRect(10, 21, 12, 2);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(10, 25, 12, 2);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(13, 25, 1, 2);
  ctx.fillRect(16, 25, 1, 2);
  ctx.fillRect(19, 25, 1, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Crisp 32x32 pixel-art dark security foreman coat stained with glossy black-green Composto 09 oil & Sector 09 badge.
 */
function createDiddySuitTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = hashPx(x, y, 503);
      const v = Math.round(18 + n * 10);
      ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Torn dark work shirt & rugged collar
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(11, 0, 10, 12);
  ctx.fillRect(13, 12, 6, 4);

  // Heavy industrial coat lapels
  ctx.fillStyle = '#27303f';
  ctx.fillRect(8, 0, 3, 13);
  ctx.fillRect(21, 0, 3, 13);
  ctx.fillRect(10, 13, 3, 5);
  ctx.fillRect(19, 13, 3, 5);

  // Glossy black-green Composto 09 oil splatters across chest & shoulder!
  ctx.fillStyle = '#052e2b';
  ctx.fillRect(18, 4, 7, 9);
  ctx.fillRect(20, 13, 5, 8);
  ctx.fillRect(6, 17, 6, 7);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(20, 6, 3, 5);
  ctx.fillRect(22, 15, 2, 4);
  ctx.fillRect(8, 19, 2, 3);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(21, 7, 1, 2);
  ctx.fillRect(9, 20, 1, 1);

  // Heavy steel chain & Setor 09 Foreman badge on left chest
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(10, 3, 2, 7);
  ctx.fillRect(20, 3, 2, 7);
  ctx.fillRect(12, 9, 8, 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(4, 9, 4, 4);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(5, 10, 2, 2);

  // Utility belt & brass buckle
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 26, 32, 4);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(13, 26, 6, 4);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(15, 27, 2, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Crisp 32x32 pixel-art survivor face for cutscenes.
 */
function createSurvivorFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = hashPx(x, y, 607);
      const s = 0.93 + n * 0.11;
      ctx.fillStyle = `rgb(${Math.round(216 * s)},${Math.round(166 * s)},${Math.round(128 * s)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = '#2d1d14';
  ctx.fillRect(0, 0, 32, 7);
  ctx.fillRect(0, 7, 3, 6);
  ctx.fillRect(29, 7, 3, 6);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 14, 6, 4);
  ctx.fillRect(20, 14, 6, 4);
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(8, 14, 3, 4);
  ctx.fillRect(21, 14, 3, 4);

  ctx.fillStyle = '#8b573b';
  ctx.fillRect(11, 24, 10, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 32x32 Dirty, Cracked, Dust-Smudged Glass Albedo + Alpha Pair (NearestFilter).
 * Designed for high-FPS MeshStandardMaterial (transparent + PMREM reflections, zero heavy transmission!).
 */
function createDirtyGlassTextures(): { map: THREE.CanvasTexture; alphaMap: THREE.CanvasTexture } {
  const size = 32;
  const cCanvas = document.createElement('canvas');
  const aCanvas = document.createElement('canvas');
  cCanvas.width = aCanvas.width = size;
  cCanvas.height = aCanvas.height = size;
  const cCtx = cCanvas.getContext('2d')!;
  const aCtx = aCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(size, size);
  const aImg = aCtx.createImageData(size, size);

  // Diagonal crack coordinates across glass pane
  const isCrack = (x: number, y: number): boolean => {
    const d1 = Math.abs(x - (y * 0.85 + 3));
    const d2 = x > 14 && Math.abs((y - 16) - (x - 14) * 0.45) < 0.7;
    const d3 = x < 16 && y > 14 && Math.abs((y - 15) + (x - 15) * 0.65) < 0.7;
    return (d1 < 0.65 && y >= 2 && y <= 26) || d2 || d3;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n = hashPx(x, y, 821);
      const borderDist = Math.min(x, y, size - 1 - x, size - 1 - y);
      const cornerDust = borderDist < 4 ? (4 - borderDist) * 0.14 : 0;
      const streak = x % 7 === 2 && y > 6 && n > 0.35 ? 0.18 : 0;
      const smudge = Math.hypot(x - 21, y - 12) < 5.5 ? 0.12 : 0;
      const crack = isCrack(x, y);

      if (crack) {
        cImg.data[idx] = 210;
        cImg.data[idx + 1] = 232;
        cImg.data[idx + 2] = 246;
        cImg.data[idx + 3] = 255;
        aImg.data[idx] = aImg.data[idx + 1] = aImg.data[idx + 2] = 235;
        aImg.data[idx + 3] = 255;
      } else {
        const grime = Math.min(1, cornerDust + streak + smudge + n * 0.08);
        cImg.data[idx] = Math.round(135 - grime * 58);
        cImg.data[idx + 1] = Math.round(172 - grime * 66);
        cImg.data[idx + 2] = Math.round(188 - grime * 72);
        cImg.data[idx + 3] = 255;
        // Center stays cleanly see-through (~0.24 alpha) so P. Drizzy's silhouette is unmistakably visible!
        const alphaByte = Math.round(Math.min(0.76, 0.22 + grime * 0.56) * 255);
        aImg.data[idx] = aImg.data[idx + 1] = aImg.data[idx + 2] = alphaByte;
        aImg.data[idx + 3] = 255;
      }
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  aCtx.putImageData(aImg, 0, 0);

  const map = new THREE.CanvasTexture(cCanvas);
  const alphaMap = new THREE.CanvasTexture(aCanvas);
  for (const t of [map, alphaMap]) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, alphaMap };
}

/** 32x32 Environmental Storytelling Decal: Violent Claw / Pry Gouges near vents & Cell 09 */
function createClawMarksTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  const slashes = [
    { x0: 6, y0: 4, x1: 14, y1: 27 },
    { x0: 12, y0: 3, x1: 20, y1: 28 },
    { x0: 18, y0: 5, x1: 26, y1: 26 },
    { x0: 23, y0: 8, x1: 29, y1: 22 },
  ];
  for (const s of slashes) {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = Math.round(s.x0 + (s.x1 - s.x0) * t + Math.sin(t * 5) * 0.8);
      const y = Math.round(s.y0 + (s.y1 - s.y0) * t);
      ctx.fillStyle = 'rgba(20, 12, 10, 0.88)';
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = 'rgba(110, 36, 28, 0.55)';
      ctx.fillRect(x - 1, y, 1, 1);
    }
  }
  return finalizePixelCanvas(canvas);
}

/** 32x32 Environmental Storytelling Decal: Viscous Black-Green Compound 09 Ooze seeping under doors */
function createOozeSeepTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x - 15.5) / 14;
      const dy = (y - 6) / 22;
      const lobe = Math.sin(x * 0.55) * 0.18 + (hashPx(x, y, 853) - 0.5) * 0.16;
      const d = Math.hypot(dx, Math.max(0, dy)) + lobe;
      if (d < 0.82 && y >= 2) {
        const core = d < 0.45;
        ctx.fillStyle = core ? 'rgba(6, 36, 26, 0.92)' : 'rgba(18, 86, 52, 0.68)';
        ctx.fillRect(x, y, 1, 1);
        if (core && hashPx(x, y, 857) > 0.88) {
          ctx.fillStyle = 'rgba(74, 222, 128, 0.52)';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  return finalizePixelCanvas(canvas);
}

/** 32x32 Environmental Storytelling Decal: Scratched Cell Tally Marks & Desperate Graffiti */
function createCellScribbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 48);

  // Scratched white/chalk tally groups
  ctx.fillStyle = 'rgba(218, 214, 200, 0.72)';
  for (let g = 0; g < 3; g++) {
    const gx = 6 + g * 18;
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(gx + k * 3, 8, 1, 12);
    }
    for (let d = 0; d < 12; d++) {
      ctx.fillRect(gx + d, 18 - d, 1, 1);
    }
  }
  ctx.fillStyle = 'rgba(185, 38, 38, 0.78)';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('SUJEITO 09', 6, 33);
  ctx.fillStyle = 'rgba(220, 226, 234, 0.65)';
  ctx.font = 'bold 7px monospace';
  ctx.fillText('NAO OLHE TRAS', 4, 43);
  return finalizePixelCanvas(canvas);
}

/** 32x32 Viscous Compound 09 Heavy Boot Footprint left by P. Drizzy after stepping in puddles */
function createDrizzyFootprintTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  // Heavy industrial boot sole (toe tread + heel block) stained in dark oily Compound 09
  ctx.fillStyle = 'rgba(7, 26, 18, 0.92)';
  ctx.fillRect(10, 3, 12, 13);
  ctx.fillRect(11, 20, 10, 9);
  // Tread grooves
  ctx.fillStyle = 'rgba(22, 101, 52, 0.65)';
  for (let y = 5; y <= 14; y += 3) {
    ctx.fillRect(11, y, 10, 1);
  }
  ctx.fillRect(12, 23, 8, 1);
  ctx.fillRect(12, 26, 8, 1);
  // Faint luminescent green chemical edge speck
  ctx.fillStyle = 'rgba(52, 211, 153, 0.48)';
  ctx.fillRect(11, 6, 2, 1);
  ctx.fillRect(19, 12, 2, 1);
  ctx.fillRect(13, 24, 2, 1);

  return finalizePixelCanvas(canvas);
}

/**
 * Generates ALL 22 procedural 32x32 Pixel-Art Voxel materials with strict THREE.NearestFilter!
 */
export function createProceduralMaterialPack(
  _textureSize: number,
  _maxAnisotropy: number
): MaterialPack {
  const allTextures: THREE.CanvasTexture[] = [];
  const allMaterials: THREE.MeshStandardMaterial[] = [];
  const parallaxBindings: ParallaxBinding[] = [];

  const register = (
    res: { material: THREE.MeshStandardMaterial; textures: THREE.CanvasTexture[]; parallaxBinding?: ParallaxBinding }
  ) => {
    allMaterials.push(res.material);
    allTextures.push(...res.textures);
    if (res.parallaxBinding) parallaxBindings.push(res.parallaxBinding);
    return res.material;
  };

  // 1. Dark Craft Oak Wood Planks (32x32 with plank seams, subtle wood grain & iron nails)
  const wood_floor = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const plankRow = Math.floor(y / 8);
        const yIn = y % 8;
        const seamX = (x + plankRow * 16) % 32 === 0;
        const seamY = yIn === 0;
        const n = hashPx(x, y, 11);
        const grain = Math.sin(x * 0.45 + plankRow * 2.1) * 7 + (n - 0.5) * 14;
        const isNail = (yIn === 2 || yIn === 6) && ((x + plankRow * 16) % 32 === 2 || (x + plankRow * 16) % 32 === 30);
        if (isNail) return { r: 42, g: 38, b: 36, height: 105 };
        if (seamX || seamY) return { r: 36, g: 24, b: 16, height: 55 };
        const knot = (x === 12 + plankRow * 4 && yIn === 4) ? -18 : 0;
        return {
          r: 102 + grain + knot,
          g: 68 + grain * 0.72 + knot,
          b: 44 + grain * 0.5 + knot,
          height: 155 + grain,
        };
      },
      { roughness: 0.84, bumpScale: 0.04, worldSpaceFloorWeathering: true }
    )
  );

  // 2. Cracked Craft Stone Bricks (32x32 PBR with deep mortar, moisture gradient, micro-cracks, moss & Parallax!)
  const concrete_wall = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const row = Math.floor(y / 8);
        const ox = (x + (row % 2) * 8) % 16;
        const oy = y % 8;
        const n = hashPx(x, y, 22);
        const mortar = ox === 0 || oy === 0;
        const crack =
          (row === 1 && ox === 9 && oy >= 2 && oy <= 6) ||
          (row === 2 && oy === 4 && ox >= 4 && ox <= 7) ||
          (row === 3 && ox === 12 && oy >= 1 && oy <= 5);
        const moss = y > 22 && hashPx(x, y, 29) > 0.58;
        if (mortar || crack) return { r: 24, g: 28, b: 35, height: 32, roughness: 0.96 };
        if (moss) return { r: 46 + n * 16, g: 82 + n * 24, b: 42 + n * 12, height: 152, roughness: 0.92 };
        const bevel = oy === 1 || ox === 1 ? 15 : oy === 7 || ox === 15 ? -15 : 0;
        const base = 90 + (n - 0.5) * 20 + bevel;
        return { r: base, g: base + 4, b: base + 10, height: 175 + bevel * 2 };
      },
      { roughness: 0.86, normalStrength: 3.1, repeatY: 2, moistureGradient: true, parallax: true }
    )
  );

  // 3. Peeling Abandoned Plaster & Cracked Brick Underneath (32x32 PBR + moisture gradient + Parallax!)
  const wallpaper_wall = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const n = hashPx(x, y, 33);
        const trim = y < 4 || y >= 28;
        const stripe = x % 4 === 0;
        // Peeling patch revealing underlying cracked stone brick!
        const peelMask =
          (x >= 18 && x <= 26 && y >= 11 && y <= 21) ||
          hashPx(Math.floor(x / 2), Math.floor(y / 2), 37) > 0.89;
        if (trim) return { r: 42 + n * 10, g: 31 + n * 8, b: 25 + n * 6, height: 192, roughness: 0.82 };
        if (peelMask) {
          const mortar = y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0;
          if (mortar) return { r: 28, g: 25, b: 24, height: 42, roughness: 0.97 };
          return { r: 86 + n * 14, g: 58 + n * 10, b: 50 + n * 8, height: 112, roughness: 0.92 };
        }
        const base = stripe ? 64 : 78;
        return {
          r: base + n * 12,
          g: base - 7 + n * 10,
          b: base - 8 + n * 10,
          height: stripe ? 142 : 168,
        };
      },
      { roughness: 0.86, normalStrength: 2.7, repeatY: 2, moistureGradient: true, parallax: true }
    )
  );

  // 4. Grimy Checkered Laboratory / Hospital / Cafeteria Tile (32x32 specular tile + matte grout)
  const grimy_tile = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const grout = x % 8 === 0 || y % 8 === 0;
        const checker = ((Math.floor(x / 8) + Math.floor(y / 8)) & 1) === 0;
        const n = hashPx(x, y, 44);
        const grime = hashPx(x, y, 49) > 0.84 ? -24 : 0;
        if (grout) return { r: 26, g: 32, b: 36, height: 48, roughness: 0.96 };
        const b = (checker ? 128 : 82) + (n - 0.5) * 14 + grime;
        return { r: b - 4, g: b + 2, b: b + 6, height: 168, roughness: grime < 0 ? 0.85 : 0.42 };
      },
      { roughness: 0.55, normalStrength: 2.3, worldSpaceFloorWeathering: true }
    )
  );

  // 5. Cold Underground Deepslate / Industrial Concrete Wall (32x32 PBR + moisture + sludge + Parallax!)
  const basement_wall = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const row = Math.floor(y / 8);
        const ox = (x + (row % 2) * 8) % 16;
        const oy = y % 8;
        const n = hashPx(x, y, 55);
        const seam = ox === 0 || oy === 0;
        const drip = x % 7 === 0 && y > 10 && hashPx(x, y, 59) > 0.45;
        const sludge = y > 24 && hashPx(x, y, 61) > 0.52;
        if (seam) return { r: 16, g: 24, b: 28, height: 34, roughness: 0.97 };
        if (sludge) return { r: 24 + n * 10, g: 52 + n * 16, b: 44 + n * 12, height: 138, roughness: 0.36 };
        const base = 54 + (n - 0.5) * 16 + (oy === 1 ? 10 : 0);
        return {
          r: base - (drip ? 8 : 0),
          g: base + 14,
          b: base + 16,
          height: 168,
          roughness: drip ? 0.38 : 0.86,
        };
      },
      { roughness: 0.84, normalStrength: 3.1, repeatY: 2, moistureGradient: true, parallax: true }
    )
  );

  // 6. Wet Underground Drain Stone Floor (32x32 reflective puddles + dark sludge + steel grate)
  const basement_wet = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const n = hashPx(x, y, 66);
        const seam = x % 16 === 0 || y % 16 === 0;
        const puddle = hashPx(Math.floor(x / 3), Math.floor(y / 3), 69) > 0.6;
        const sludgeRing = !puddle && hashPx(Math.floor(x / 3), Math.floor(y / 3), 69) > 0.52;
        if (seam) return { r: 14, g: 22, b: 26, height: 36, roughness: 0.94, metalness: 0.25 };
        if (puddle) return { r: 30 + n * 10, g: 64 + n * 14, b: 72 + n * 14, height: 78, roughness: 0.14, metalness: 0.22 };
        if (sludgeRing) return { r: 30 + n * 10, g: 54 + n * 14, b: 42 + n * 10, height: 125, roughness: 0.72 };
        return { r: 48 + n * 16, g: 64 + n * 16, b: 66 + n * 16, height: 165, roughness: 0.78 };
      },
      { roughness: 0.52, metalness: 0.18, normalStrength: 2.6, parallax: true, worldSpaceFloorWeathering: true }
    )
  );

  // 7. Mossy Cobblestone Courtyard (32x32 Craft classic with deep joints, moss & Parallax!)
  const courtyard_stone = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const bx = x % 8;
        const by = y % 8;
        const cellN = hashPx(Math.floor(x / 8), Math.floor(y / 8), 77);
        const pxN = hashPx(x, y, 78);
        const edge = bx === 0 || by === 0;
        if (edge) return { r: 22, g: 28, b: 32, height: 34, roughness: 0.96 };
        const mossy = cellN > 0.62 && pxN > 0.34;
        if (mossy) return { r: 44 + pxN * 18, g: 92 + pxN * 24, b: 46 + pxN * 14, height: 158, roughness: 0.92 };
        const damp = cellN < 0.22;
        const shade = 78 + cellN * 34 + (pxN - 0.5) * 14 + (by === 1 ? 10 : 0);
        return {
          r: shade - (damp ? 10 : 0),
          g: shade + 2,
          b: shade + 8,
          height: 174,
          roughness: damp ? 0.38 : 0.86,
        };
      },
      { roughness: 0.84, normalStrength: 3.0, parallax: true, worldSpaceFloorWeathering: true }
    )
  );

  // 8. Dark Voxel Grass Block (32x32 lush pixel blades)
  const grass_block = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const n = hashPx(x, y, 81);
        const tuft = hashPx(Math.floor(x / 2), Math.floor(y / 2), 83);
        const gBase = 68 + n * 34 + tuft * 18;
        return { r: 32 + n * 14, g: gBase, b: 28 + n * 10, height: 140 + n * 35 };
      },
      { roughness: 0.92, normalStrength: 2.2 }
    )
  );

  // 9. Dark Oak Log Bark (32x32 vertical grain + lower moisture moss hints)
  const oak_log = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const ridge = x % 4 === 0 || (x % 4 === 1 && hashPx(x, y, 86) > 0.5);
        const n = hashPx(x, y, 87);
        const b = (ridge ? 44 : 68) + (n - 0.5) * 14;
        return { r: b, g: b * 0.72, b: b * 0.48, height: ridge ? 115 : 172 };
      },
      { roughness: 0.9, normalStrength: 2.8 }
    )
  );

  // 10. Industrial Ceiling Slabs (32x32 with water infiltration stains & dark seams)
  const ceiling_plaster = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const seam = x === 0 || y === 0 || x === 16 || y === 16;
        const n = hashPx(x, y, 88);
        const stainDist = Math.hypot(x - 10, y - 21);
        const waterStain = stainDist < 7.5 && hashPx(x, y, 91) > 0.28;
        if (seam) return { r: 22, g: 24, b: 30, height: 65, roughness: 0.96 };
        if (waterStain) return { r: 34 + n * 8, g: 40 + n * 10, b: 38 + n * 8, height: 118, roughness: 0.52 };
        const b = 48 + n * 12;
        return { r: b, g: b + 1, b: b + 5, height: 148, roughness: 0.92 };
      },
      { roughness: 0.92, normalStrength: 2.0 }
    )
  );

  // 11. Rusted Riveted Metal Plate (32x32 for lockers, safe, pipes)
  const rusted_metal = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const border = x === 0 || y === 0 || x === 31 || y === 31;
        const rivet = (x === 3 || x === 28) && (y === 3 || y === 28);
        const n = hashPx(x, y, 99);
        const rust = hashPx(Math.floor(x / 2), Math.floor(y / 2), 101) > 0.64;
        if (border) return { r: 30, g: 34, b: 40, height: 85, roughness: 0.72, metalness: 0.45 };
        if (rivet) return { r: 156, g: 164, b: 176, height: 215, roughness: 0.16, metalness: 0.98 };
        if (rust) return { r: 124 + n * 26, g: 64 + n * 14, b: 36 + n * 10, height: 128, roughness: 0.88, metalness: 0.08 };
        const base = 82 + (n - 0.5) * 16;
        return { r: base, g: base + 5, b: base + 12, height: 162, roughness: 0.24 + n * 0.14, metalness: 0.92 };
      },
      { roughness: 1.0, metalness: 1.0, bumpScale: 0.04 }
    )
  );

  // 12. Corrugated Ventilation Duct Metal (32x32 galvanized ribs & screw bolts — true PBR metal!)
  const vent_metal = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const rib = y % 4 === 0;
        const seam = x === 0 || x === 31;
        const bolt = (x === 2 || x === 29) && (y === 2 || y === 16 || y === 29);
        const n = hashPx(x, y, 108);
        if (seam) return { r: 34, g: 40, b: 46, height: 70, roughness: 0.78, metalness: 0.35 };
        if (bolt) return { r: 172, g: 180, b: 190, height: 210, roughness: 0.15, metalness: 1.0 };
        const base = (rib ? 78 : 106) + (n - 0.5) * 14;
        return {
          r: base,
          g: base + 4,
          b: base + 10,
          height: rib ? 120 : 175,
          roughness: rib ? 0.36 : 0.20 + n * 0.12,
          metalness: 0.94,
        };
      },
      { roughness: 1.0, metalness: 1.0, bumpScale: 0.045 }
    )
  );

  // 13. Cabine 09-A Heavy Armored Security Blast Door (32x32 hazard stripes + steel plates + per-pixel LEDs!)
  const bunker_blast_door = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const n = hashPx(x, y, 114);
        // Per-pixel glowing amber/red indicator LEDs on armored blast door!
        if ((x === 5 || x === 26) && (y === 4 || y === 5)) {
          return { r: 255, g: 90, b: 50, height: 195, roughness: 0.18, metalness: 0.1, emissive: [255, 75, 45] };
        }
        // Bottom hazard yellow/black stripes!
        if (y >= 24) {
          const stripe = ((x + y) >> 2) & 1;
          return stripe
            ? { r: 218, g: 168, b: 24, height: 155, roughness: 0.42, metalness: 0.18 }
            : { r: 24, g: 24, b: 28, height: 145, roughness: 0.74, metalness: 0.15 };
        }
        const seam = x === 0 || x === 31 || y === 0 || y === 12 || y === 23;
        if (seam) return { r: 26, g: 30, b: 38, height: 65, roughness: 0.85, metalness: 0.32 };
        const rust = hashPx(Math.floor(x / 2), Math.floor(y / 2), 119) > 0.86;
        if (rust) return { r: 108 + n * 18, g: 56 + n * 10, b: 36 + n * 8, height: 145, roughness: 0.88, metalness: 0.06 };
        const base = 84 + (n - 0.5) * 14;
        return { r: base, g: base + 6, b: base + 14, height: 170, roughness: 0.22 + n * 0.14, metalness: 0.94 };
      },
      { roughness: 1.0, metalness: 1.0, normalStrength: 2.6, useEmissiveMap: true, emissiveIntensity: 1.35 }
    )
  );

  // 14-18. Crisp 32x32 Door Panels (wood, red, blue, iron, exit)
  const makeDoorMat = (rBase: number, gBase: number, bBase: number, seed: number, isMetallic = false) =>
    register(
      buildPixelVoxelMaterial32(
        (x, y) => {
          const frame = x < 3 || x > 28 || y < 3 || y > 28;
          const recess =
            (x >= 6 && x <= 25 && y >= 6 && y <= 14) ||
            (x >= 6 && x <= 25 && y >= 18 && y <= 26);
          const n = hashPx(x, y, seed);
          const mult = frame ? 0.7 : recess ? 1.14 : 0.96;
          return {
            r: rBase * mult + (n - 0.5) * 14,
            g: gBase * mult + (n - 0.5) * 12,
            b: bBase * mult + (n - 0.5) * 12,
            height: frame ? 185 : recess ? 122 : 160,
            roughness: isMetallic ? (frame ? 0.22 : 0.28 + n * 0.12) : 0.78 + n * 0.12,
            metalness: isMetallic ? (frame ? 0.96 : 0.88) : 0.02,
          };
        },
        { roughness: 1.0, metalness: isMetallic ? 1.0 : 0.04, bumpScale: 0.045 }
      )
    );

  const door_wood = makeDoorMat(114, 74, 46, 111, false);
  const door_red = makeDoorMat(162, 42, 42, 122, false);
  const door_blue = makeDoorMat(44, 86, 162, 133, false);
  const door_iron = makeDoorMat(96, 104, 116, 144, true);
  const door_exit = makeDoorMat(122, 92, 48, 155, true);

  // 19. Boarded Crowbar Wooden Planks (32x32)
  const plank_wood = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const nail = (x === 4 || x === 27) && (y === 10 || y === 22);
        const n = hashPx(x, y, 166);
        if (nail) return { r: 36, g: 38, b: 44, height: 215 };
        const grain = Math.sin(x * 0.5 + y * 0.1) * 10 + (n - 0.5) * 16;
        return { r: 142 + grain, g: 100 + grain * 0.75, b: 56 + grain * 0.5, height: 155 };
      },
      { roughness: 0.88, bumpScale: 0.04 }
    )
  );

  // 20. Voxel Bookshelf (32x32 multi-colored pixel books on oak shelves!)
  const bookshelf_voxel = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const shelf = y < 3 || y >= 29 || (y >= 14 && y <= 17);
        const side = x < 2 || x > 29;
        const n = hashPx(x, y, 177);
        if (shelf || side) return { r: 96 + n * 14, g: 64 + n * 10, b: 40 + n * 8, height: 185 };
        const bookIdx = Math.floor(x / 3);
        const palette = [
          [148, 44, 44],
          [44, 84, 142],
          [48, 116, 68],
          [168, 132, 48],
          [112, 62, 128],
          [138, 84, 52],
        ];
        const col = palette[(bookIdx + (y > 16 ? 3 : 0)) % palette.length];
        const spineEdge = x % 3 === 0 ? 0.72 : 1.0;
        const goldBand = y === 6 || y === 21 ? 1.25 : 1.0;
        return {
          r: col[0] * spineEdge * goldBand,
          g: col[1] * spineEdge * goldBand,
          b: col[2] * spineEdge * goldBand,
          height: x % 3 === 0 ? 110 : 165,
        };
      },
      { roughness: 0.84, bumpScale: 0.04 }
    )
  );

  // 21. Voxel Industrial Wooden Crate (32x32 diagonal brace & frame)
  const crate_wood = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const frame = x < 4 || x > 27 || y < 4 || y > 27;
        const diag = Math.abs(x - y) < 3;
        const n = hashPx(x, y, 188);
        if (frame || diag) return { r: 122 + n * 16, g: 86 + n * 12, b: 48 + n * 8, height: 185 };
        return { r: 94 + n * 14, g: 66 + n * 10, b: 38 + n * 8, height: 130 };
      },
      { roughness: 0.86, bumpScale: 0.042 }
    )
  );

  // 22. Glowing Security CRT Monitor Screen (32x32 scanlines + per-pixel emissive radar blip & REC LED!)
  const monitor_crt = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const border = x < 2 || x > 29 || y < 2 || y > 29;
        if (border) {
          if (x >= 25 && x <= 27 && y === 30) {
            return { r: 245, g: 60, b: 60, height: 185, emissive: [255, 45, 45] };
          }
          return { r: 22, g: 26, b: 32, height: 175, roughness: 0.6 };
        }
        const scan = y % 2 === 0 ? 1.15 : 0.72;
        const grid = x % 8 === 0 || y % 8 === 0;
        const blip = x >= 19 && x <= 21 && y >= 11 && y <= 13;
        const n = hashPx(x, y, 199);
        if (blip) return { r: 120, g: 255, b: 190, height: 145, roughness: 0.18, emissive: [90, 255, 180] };
        const g = (grid ? 128 : 74) * scan + n * 24;
        return {
          r: 16,
          g,
          b: 44 + n * 16,
          height: 140,
          roughness: 0.2,
          emissive: [12, g * 0.85, 38],
        };
      },
      { roughness: 0.22, metalness: 0.12, useEmissiveMap: true, emissiveIntensity: 1.05 }
    )
  );

  // 23. High-Contrast 32x32 Stone Stair Tread (crisp concrete blocks + yellow/amber safety nosing edge!)
  const stair_step = register(
    buildPixelVoxelMaterial32(
      (x, y) => {
        const n = hashPx(x, y, 211);
        // High-visibility safety grip stripe along step edge so every stair is 100% readable in the dark
        if (y >= 26 && y <= 29) {
          const hazard = ((x >> 2) & 1) === 0;
          return hazard
            ? { r: 214, g: 162, b: 42, height: 195 }
            : { r: 58, g: 64, b: 74, height: 165 };
        }
        const mortar = y === 0 || y === 15 || x === 0 || x === 16;
        if (mortar) return { r: 42, g: 48, b: 56, height: 80 };
        const base = 112 + (n - 0.5) * 20;
        const grip = y % 4 === 2 ? -10 : 6;
        return { r: base + grip, g: base + grip + 4, b: base + grip + 10, height: 165 + grip };
      },
      { roughness: 0.78, metalness: 0.08, bumpScale: 0.055 }
    )
  );

  // Make ceiling_plaster DoubleSide + subtle water infiltration stains so ceilings NEVER disappear from below!
  ceiling_plaster.side = THREE.DoubleSide;

  const contactShadowTex = createContactShadowTexture();
  const flashlightLensTex = createFlashlightLensTexture();
  const cobwebTex = createCobwebTexture();
  const grassTuftTex = createGrassTuftTexture();
  const moonTex = createMoonTexture();
  const glowHaloTex = createGlowHaloTexture();
  const waterDripRingTex = createWaterDripRingTexture();
  const waterNormalTex = createWaterNormalTexture();
  const diddyFaceTex = createDiddyFaceTexture();
  const diddySuitTex = createDiddySuitTexture();
  const survivorFaceTex = createSurvivorFaceTexture();
  const dirtyGlass = createDirtyGlassTextures();
  const clawMarksTex = createClawMarksTexture();
  const oozeSeepTex = createOozeSeepTexture();
  const cellScribbleTex = createCellScribbleTexture();
  const drizzyFootprintTex = createDrizzyFootprintTexture();
  allTextures.push(
    contactShadowTex,
    flashlightLensTex,
    cobwebTex,
    grassTuftTex,
    moonTex,
    glowHaloTex,
    waterDripRingTex,
    waterNormalTex,
    diddyFaceTex,
    diddySuitTex,
    survivorFaceTex,
    dirtyGlass.map,
    dirtyGlass.alphaMap,
    clawMarksTex,
    oozeSeepTex,
    cellScribbleTex,
    drizzyFootprintTex
  );

  return {
    materials: {
      wood_floor,
      concrete_wall,
      wallpaper_wall,
      grimy_tile,
      basement_wall,
      basement_wet,
      courtyard_stone,
      grass_block,
      oak_log,
      ceiling_plaster,
      rusted_metal,
      vent_metal,
      bunker_blast_door,
      door_wood,
      door_red,
      door_blue,
      door_iron,
      door_exit,
      plank_wood,
      bookshelf_voxel,
      crate_wood,
      monitor_crt,
      stair_step,
    },
    contactShadowTex,
    flashlightLensTex,
    cobwebTex,
    grassTuftTex,
    moonTex,
    glowHaloTex,
    waterDripRingTex,
    waterNormalTex,
    diddyFaceTex,
    diddySuitTex,
    survivorFaceTex,
    dirtyGlassMap: dirtyGlass.map,
    dirtyGlassAlphaMap: dirtyGlass.alphaMap,
    clawMarksTex,
    oozeSeepTex,
    cellScribbleTex,
    drizzyFootprintTex,
    setParallaxEnabled(enabled: boolean, strength = 0.022) {
      const target = enabled ? strength : 0.0;
      for (const b of parallaxBindings) {
        b.uniformScale.value = target;
      }
    },
    setTextureQuality(quality: 'low' | 'medium' | 'high') {
      const normalMult = quality === 'low' ? 0.55 : quality === 'medium' ? 0.95 : 1.35;
      const aoMult = quality === 'low' ? 0.38 : quality === 'medium' ? 0.65 : 0.82;
      for (const m of allMaterials) {
        if (m.normalScale) m.normalScale.set(normalMult, normalMult);
        m.aoMapIntensity = aoMult;
      }
    },
    dispose() {
      for (const m of allMaterials) m.dispose();
      for (const t of allTextures) t.dispose();
    },
  };
}

/**
 * Generates crisp pixel-art ARG clue wall paper texture (NearestFilter).
 */
function createHeadlessFallbackTexture(r = 128, g = 128, b = 128): THREE.Texture {
  const data = new Uint8Array([r, g, b, 255, r, g, b, 255, r, g, b, 255, r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function finalizePixelCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createArgClueTexture(
  digitIndex: number,
  digitValue: string,
  title: string
): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(210, 196, 168);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#ddd0b2';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#c8b896';
  ctx.fillRect(4, 4, 56, 56);
  ctx.strokeStyle = '#3b2c1a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 60, 60);

  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(6, 6, 52, 12);
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`PISTA #${digitIndex + 1}`, 32, 15);

  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(digitValue, 32, 46);

  ctx.fillStyle = '#292524';
  ctx.font = 'bold 6px monospace';
  ctx.fillText(title.slice(0, 12).toUpperCase(), 32, 58);

  return finalizePixelCanvas(canvas);
}

/**
 * Generates Poppy Playtime-style crisp pixel-art Tutorial Plaque texture for Reception walls!
 */
export function createTutorialBoardTexture(
  title: string,
  lines: string[]
): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(24, 30, 44);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#181e2c';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 92);

  ctx.fillStyle = '#b45309';
  ctx.fillRect(6, 6, 116, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), 64, 18);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';
  lines.forEach((line, idx) => {
    ctx.fillText(line, 10, 36 + idx * 14);
  });

  return finalizePixelCanvas(canvas);
}

/**
 * Generates crisp pixel-art UV Fluorescent Wall Mark texture (glows vibrant purple/cyan under UV Light!).
 */
export function createUvMarkTexture(
  symbolChar: string,
  label: string
): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(192, 132, 252);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 56, 56);

  ctx.fillStyle = '#e879f9';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(symbolChar, 32, 38);

  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 8px monospace';
  ctx.fillText(label.slice(0, 10).toUpperCase(), 32, 54);

  return finalizePixelCanvas(canvas);
}

/**
 * Generates crisp pixel-art Symbol-to-Digit Translation Board texture (for Real/Secret ARG layer).
 */
export function createTranslationBoardTexture(
  pairs: { symbol: string; digit: string }[]
): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(20, 24, 36);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 92);

  ctx.fillStyle = '#581c87';
  ctx.fillRect(6, 6, 116, 15);
  ctx.fillStyle = '#f3e8ff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CIFRA UV · SETOR 09', 64, 17);

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  pairs.forEach((p, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 14 + col * 56;
    const y = 38 + row * 19;
    ctx.fillStyle = '#e879f9';
    ctx.fillText(p.symbol, x, y);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('=', x + 15, y);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(p.digit, x + 28, y);
  });

  return finalizePixelCanvas(canvas);
}

/**
 * Generates crisp pixel-art CCTV-only secret code plaque on the Secret Cell wall!
 */
export function createCctvSecretSignTexture(code: string): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(22, 163, 74);
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, 96, 48);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 92, 44);

  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CAM-06 CODIGO', 48, 15);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(code, 48, 38);

  return finalizePixelCanvas(canvas);
}

/**
 * Generates crisp 64x64 pixel-art (rendered on a crisp 128x128 grid) framed paintings,
 * Sector 09 blueprints, Subject 09 portrait, biohazard warnings & clinical charts.
 */
export function createWallPosterTexture(variant: number): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(30, 41, 59);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Helper to paint crisp 2x2 pixel-art cells on a 64x64 art canvas
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
  };

  const v = ((variant % 6) + 6) % 6;
  if (v === 0) {
    // Torn red-stamped INTERDITADO — SETOR 09 notice with hazard striping & aged stains
    px(0, 0, 64, 64, '#dfd8c8');
    px(2, 2, 60, 60, '#ece6d8');
    // Aged paper moisture spots
    px(48, 38, 10, 12, '#cbbda4');
    px(6, 42, 8, 8, '#d4c6ae');
    // Top & bottom hazard stripe bars
    for (let sx = 2; sx < 62; sx += 6) {
      px(sx, 2, 3, 4, '#eab308');
      px(sx + 3, 2, 3, 4, '#18181b');
      px(sx, 58, 3, 4, '#eab308');
      px(sx + 3, 58, 3, 4, '#18181b');
    }
    // Red official banner
    px(4, 8, 56, 12, '#b91c1c');
    px(5, 9, 54, 10, '#dc2626');
    // Torn corner shadow
    px(0, 50, 10, 14, '#1c1917');
    px(10, 56, 6, 8, '#1c1917');
    // Biohazard stamp icon in center
    px(26, 26, 12, 12, '#7f1d1d');
    px(29, 29, 6, 6, '#ece6d8');
    px(30, 30, 4, 4, '#b91c1c');
    px(31, 24, 2, 4, '#b91c1c');
    px(24, 35, 4, 2, '#b91c1c');
    px(36, 35, 4, 2, '#b91c1c');
    // Stamp border
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 44, 104, 48);
    ctx.fillStyle = '#fef2f2';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INTERDITADO', 64, 33);
    ctx.fillStyle = '#7f1d1d';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('SETOR 09', 64, 86);
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('RISCO BIOLOGICO', 64, 105);
  } else if (v === 1) {
    // Atmospheric Dark Portrait — Diretor / Sujeito 09 (layered shading + cracked glasses!)
    px(0, 0, 64, 64, '#090d14');
    // Moody vignette wallpaper backdrop
    px(3, 3, 58, 50, '#162033');
    px(6, 6, 52, 44, '#1e293b');
    px(10, 8, 44, 36, '#273549');
    // Broad coat shoulders + collar lapels
    px(10, 36, 44, 17, '#0f172a');
    px(14, 34, 36, 19, '#111827');
    px(26, 36, 12, 16, '#334155'); // shirt front
    px(30, 37, 4, 14, '#7f1d1d'); // dark tie
    // Toxic Composto 09 splash on lapel
    px(39, 39, 5, 7, '#16a34a');
    px(40, 41, 3, 4, '#4ade80');
    // Neck & shadowed head silhouette
    px(27, 30, 10, 6, '#3f2e24');
    px(21, 11, 22, 21, '#4a3528');
    px(22, 12, 20, 18, '#5c4232');
    // Dramatic left-side rim light & dark shadow on right side
    px(21, 13, 3, 16, '#7a5944');
    px(36, 12, 7, 19, '#2b1e16');
    // Hood / hair crown
    px(20, 9, 24, 6, '#0b0f17');
    px(20, 11, 4, 7, '#0b0f17');
    px(40, 11, 4, 7, '#0b0f17');
    // Signature cracked dark glasses with eerie red/amber glint
    px(22, 18, 9, 6, '#020617');
    px(33, 18, 9, 6, '#020617');
    px(31, 20, 2, 2, '#475569');
    px(24, 20, 4, 2, '#dc2626');
    px(35, 20, 4, 2, '#dc2626');
    px(25, 20, 2, 1, '#fbbf24');
    px(36, 20, 2, 1, '#fbbf24');
    // Diagonal crack across right lens
    px(39, 18, 1, 2, '#cbd5e1');
    px(38, 20, 1, 2, '#cbd5e1');
    px(37, 22, 1, 2, '#cbd5e1');
    // Brass museum nameplate at bottom
    px(8, 54, 48, 8, '#78350f');
    px(9, 55, 46, 6, '#b45309');
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SUJEITO 09 · DRIZZY', 64, 118);
  } else if (v === 2) {
    // Detailed Sector 09 Architectural Floorplan Blueprint (64x64 pixel precision)
    px(0, 0, 64, 64, '#091f38');
    // Blueprint grid lines
    for (let i = 4; i < 64; i += 6) {
      px(i, 0, 1, 64, '#113358');
      px(0, i, 64, 1, '#113358');
    }
    // Outer complex walls
    px(6, 8, 52, 2, '#60a5fa');
    px(6, 48, 52, 2, '#60a5fa');
    px(6, 8, 2, 42, '#60a5fa');
    px(56, 8, 2, 42, '#60a5fa');
    // West Wing (Refeitorio), East Wing (Oficina), Courtyard, Security Cabine 09-A, Archive, Infirmary
    px(16, 10, 2, 38, '#38bdf8');
    px(46, 10, 2, 38, '#38bdf8');
    px(18, 22, 28, 2, '#38bdf8');
    px(18, 36, 28, 2, '#38bdf8');
    px(31, 10, 2, 12, '#38bdf8');
    // Room fills (subtle cyan/emerald highlights)
    px(20, 25, 24, 10, '#103c59'); // Courtyard
    px(20, 39, 10, 8, '#1e3a5f');  // Security Cabine 09-A
    px(34, 12, 11, 9, '#173854');  // Infirmary (blue)
    px(19, 12, 11, 9, '#3b1c2c');  // Archive (red)
    // Door markers & North Exit beacon
    px(30, 7, 4, 4, '#ef4444');    // Exit gate
    px(23, 36, 4, 2, '#22c55e');   // Security door
    px(46, 28, 2, 4, '#f59e0b');   // Workshop door
    // Camera dots
    px(21, 26, 2, 2, '#4ade80');
    px(31, 18, 2, 2, '#4ade80');
    px(10, 16, 2, 2, '#4ade80');
    px(51, 16, 2, 2, '#4ade80');
    // Legend footer
    px(4, 52, 56, 10, '#071629');
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PLANTA · SETOR 09', 64, 117);
  } else if (v === 3) {
    // Projeto Omega — Composto 09 Containment & Glowing Vial Chart
    px(0, 0, 64, 64, '#051510');
    px(2, 2, 60, 60, '#09221a');
    px(3, 3, 58, 58, '#051510');
    // Glowing green sample vial on left
    px(10, 16, 12, 28, '#1e293b');
    px(12, 12, 8, 4, '#64748b');
    px(11, 24, 10, 18, '#16a34a');
    px(12, 26, 4, 14, '#4ade80');
    px(14, 22, 2, 2, '#86efac');
    px(17, 29, 2, 2, '#bbf7d0');
    // Rising toxicity bar chart on right
    px(28, 38, 5, 8, '#059669');
    px(35, 32, 5, 14, '#10b981');
    px(42, 23, 5, 23, '#4ade80');
    px(49, 15, 5, 31, '#ef4444');
    px(49, 13, 5, 2, '#fca5a5');
    // Warning header & footer
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PROJETO OMEGA', 64, 22);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('COMPOSTO 09', 64, 114);
  } else if (v === 4) {
    // Enfermaria Patient 09 Clinical ECG Monitor Printout
    px(0, 0, 64, 64, '#071422');
    for (let i = 4; i < 64; i += 6) {
      px(i, 12, 1, 40, '#0e293d');
      px(2, i, 60, 1, '#0e293d');
    }
    px(3, 3, 58, 9, '#0c2d42');
    // Normal cyan heartbeat -> violent red mutation spike
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 70);
    ctx.lineTo(28, 70);
    ctx.lineTo(36, 44);
    ctx.lineTo(44, 88);
    ctx.lineTo(52, 70);
    ctx.lineTo(68, 70);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(68, 70);
    ctx.lineTo(78, 28);
    ctx.lineTo(88, 98);
    ctx.lineTo(98, 32);
    ctx.lineTo(108, 92);
    ctx.lineTo(120, 64);
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PACIENTE 09 · ECG', 64, 19);
    ctx.fillStyle = '#f87171';
    ctx.fillText('BPM: 214 CRITICO', 64, 116);
  } else {
    // Oficina Workbench Blueprint — Crowbar + Stun Gun Schematic
    px(0, 0, 64, 64, '#0f253d');
    for (let i = 6; i < 64; i += 6) {
      px(i, 0, 1, 64, '#17385c');
      px(0, i, 64, 1, '#17385c');
    }
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 116, 116);
    // Pixel-art crowbar rod + red claw hook
    px(10, 22, 20, 4, '#cbd5e1');
    px(10, 22, 20, 1, '#f8fafc');
    px(33, 21, 4, 6, '#f59e0b'); // '+' sign
    px(34, 20, 2, 8, '#f59e0b');
    px(40, 20, 12, 4, '#ef4444');
    px(48, 20, 4, 10, '#ef4444');
    // Stun coil + cell schematic row
    px(12, 36, 14, 7, '#b45309');
    px(14, 37, 2, 5, '#38bdf8');
    px(18, 37, 2, 5, '#38bdf8');
    px(22, 37, 2, 5, '#38bdf8');
    px(33, 37, 4, 5, '#f59e0b');
    px(41, 36, 12, 7, '#0284c7');
    px(43, 38, 8, 3, '#7dd3fc');
    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OFICINA · CRAFT', 64, 24);
    ctx.fillText('HASTE + GANCHO', 64, 112);
  }

  return finalizePixelCanvas(canvas);
}

/**
 * Crisp pixel-art laminated Security ID Badge for Vigia Marcos (#09-M) in Reception!
 */
export function createMarcosBadgeTexture(): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(226, 232, 240);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 64, 96);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 64, 18);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 61, 93);

  // Pixel portrait box
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(14, 24, 36, 34);
  ctx.fillStyle = '#334155';
  ctx.fillRect(20, 44, 24, 14);
  ctx.fillStyle = '#d6a47c';
  ctx.fillRect(24, 28, 16, 16);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(24, 27, 16, 5);
  ctx.fillRect(27, 34, 3, 2);
  ctx.fillRect(34, 34, 3, 2);

  // Coffee/blood smudge on lower corner
  ctx.fillStyle = 'rgba(127, 29, 29, 0.55)';
  ctx.fillRect(42, 66, 14, 14);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SETOR 09', 32, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('MARCOS', 32, 70);
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 7px monospace';
  ctx.fillText('VIGIA #09-M', 32, 81);

  // Barcode stripes
  ctx.fillStyle = '#0f172a';
  for (let x = 10; x < 54; x += 4) {
    ctx.fillRect(x, 85, x % 8 === 0 ? 2 : 1, 7);
  }

  return finalizePixelCanvas(canvas);
}

/**
 * Crisp pixel-art industrial signage for rooms, cells ("CELA 09 — P. DRIZZY"), wing signs & Nível -2 hatch.
 */
export function createFacilitySignTexture(
  title: string,
  subtitle: string,
  accentHex = '#f59e0b',
  bgHex = '#11161f'
): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(17, 22, 31);
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 56;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 160, 56);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 156, 52);

  // Corner bolts
  ctx.fillStyle = '#64748b';
  ctx.fillRect(6, 6, 3, 3);
  ctx.fillRect(151, 6, 3, 3);
  ctx.fillRect(6, 47, 3, 3);
  ctx.fillRect(151, 47, 3, 3);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 80, 24);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(subtitle, 80, 42);

  return finalizePixelCanvas(canvas);
}

/**
 * Crisp pixel-art label for the SecurityBunker (Cabine 09-A) physical wall door buttons.
 */
export function createBunkerButtonLabelTexture(side: 'left' | 'right'): THREE.Texture {
  if (typeof document === 'undefined') return createHeadlessFallbackTexture(9, 14, 26);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#090e1a';
  ctx.fillRect(0, 0, 128, 48);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 44);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PORTA', 64, 20);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(side === 'left' ? 'OESTE' : 'LESTE', 64, 39);

  return finalizePixelCanvas(canvas);
}
