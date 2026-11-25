import * as THREE from 'three';
import { createCassetteRecorderVisual, createVoxelItemModel } from './models';
import type { CassetteTapeDefinition, WorldPickupType } from './types';

export type ItemRenderId = WorldPickupType | 'flashlight_uv' | 'cassette';

export const ALL_RENDERABLE_ITEM_IDS: readonly ItemRenderId[] = [
  'flashlight',
  'stun_gun',
  'throwable_can',
  'red_key',
  'blue_key',
  'basement_key',
  'crowbar',
  'crowbar_rod',
  'crowbar_hook',
  'stun_coil',
  'stun_cell',
  'fuse',
  'wire_cutters',
  'master_key',
  'flare',
  'battery',
  'stun_ammo',
  'flashlight_uv',
  'cassette',
] as const;

const ICON_SIZE = 128;

interface ItemAngleSpec {
  rotX: number;
  rotY: number;
  rotZ: number;
  rimColor: number;
  rimIntensity: number;
  padFactor?: number;
}

const DEFAULT_SPEC: ItemAngleSpec = {
  rotX: 0.36,
  rotY: 0.62,
  rotZ: -0.14,
  rimColor: 0x38bdf8,
  rimIntensity: 3.4,
  padFactor: 1.12,
};

function getItemSpec(id: ItemRenderId): ItemAngleSpec {
  switch (id) {
    case 'flashlight':
      return { rotX: 0.28, rotY: 2.35, rotZ: -0.22, rimColor: 0xfef08a, rimIntensity: 3.8, padFactor: 1.08 };
    case 'flashlight_uv':
      return { rotX: 0.28, rotY: 2.35, rotZ: -0.22, rimColor: 0xa855f7, rimIntensity: 4.8, padFactor: 1.08 };
    case 'stun_gun':
      return { rotX: 0.24, rotY: 2.28, rotZ: -0.12, rimColor: 0x38bdf8, rimIntensity: 4.0, padFactor: 1.08 };
    case 'red_key':
      return { rotX: 0.44, rotY: 0.55, rotZ: -0.32, rimColor: 0xef4444, rimIntensity: 3.8, padFactor: 1.08 };
    case 'blue_key':
      return { rotX: 0.44, rotY: 0.55, rotZ: -0.32, rimColor: 0x3b82f6, rimIntensity: 3.8, padFactor: 1.08 };
    case 'basement_key':
      return { rotX: 0.44, rotY: 0.55, rotZ: -0.32, rimColor: 0x10b981, rimIntensity: 3.8, padFactor: 1.08 };
    case 'master_key':
      return { rotX: 0.44, rotY: 0.55, rotZ: -0.32, rimColor: 0xf59e0b, rimIntensity: 4.2, padFactor: 1.08 };
    case 'crowbar':
    case 'crowbar_rod':
    case 'crowbar_hook':
      return { rotX: 0.32, rotY: 0.52, rotZ: -0.45, rimColor: 0xf97316, rimIntensity: 3.6, padFactor: 1.06 };
    case 'flare':
      return { rotX: 0.34, rotY: 0.48, rotZ: -0.36, rimColor: 0xfb923c, rimIntensity: 4.2, padFactor: 1.1 };
    case 'fuse':
    case 'battery':
    case 'stun_ammo':
    case 'stun_cell':
    case 'stun_coil':
      return { rotX: 0.38, rotY: 0.65, rotZ: -0.16, rimColor: 0x38bdf8, rimIntensity: 3.8, padFactor: 1.12 };
    case 'wire_cutters':
      return { rotX: 0.42, rotY: 0.58, rotZ: -0.3, rimColor: 0xf59e0b, rimIntensity: 3.6, padFactor: 1.08 };
    case 'throwable_can':
      return { rotX: 0.32, rotY: 0.55, rotZ: -0.18, rimColor: 0x94a3b8, rimIntensity: 3.4, padFactor: 1.14 };
    case 'cassette':
      return { rotX: 0.46, rotY: 0.58, rotZ: -0.08, rimColor: 0xef4444, rimIntensity: 3.8, padFactor: 1.12 };
    default:
      return DEFAULT_SPEC;
  }
}

function createEmptyItemRenderMap(): Record<ItemRenderId, string> {
  const empty = {} as Record<ItemRenderId, string>;
  for (const id of ALL_RENDERABLE_ITEM_IDS) {
    empty[id] = '';
  }
  return empty;
}

const DUMMY_CASSETTE_DEF: CassetteTapeDefinition = {
  id: 'icon_cassette',
  title: '',
  roomName: '',
  floor: 0,
  x: 0,
  y: 0,
  z: 0,
  transcript: '',
  listened: false,
};

/**
 * Renders 128x128 transparent-background 3D hero icons for every collectible & equippable item
 * using the EXISTING WebGLRenderer (0 extra GPU contexts, cached once at startup, 0 gameplay FPS cost).
 */
export function renderAllItemIcons(
  renderer: THREE.WebGLRenderer,
  envTexture?: THREE.Texture | null
): Record<ItemRenderId, string> {
  const result = createEmptyItemRenderMap();
  if (typeof document === 'undefined') return result;

  let rt: THREE.WebGLRenderTarget | null = null;
  const prevTarget = renderer.getRenderTarget();
  const prevClearColor = new THREE.Color();
  renderer.getClearColor(prevClearColor);
  const prevClearAlpha = renderer.getClearAlpha();
  const prevAutoClear = renderer.autoClear;

  const studioScene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 1.45);
  const keyLight = new THREE.DirectionalLight(0xfff7ed, 3.35);
  keyLight.position.set(1.8, 2.4, 2.6);
  const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.45);
  fillLight.position.set(-1.9, 1.1, 2.0);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.6);
  rimLight.position.set(-1.8, 2.0, -2.1);

  const studioCam = new THREE.PerspectiveCamera(32, 1, 0.02, 24);
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  const center = new THREE.Vector3();

  try {
    rt = new THREE.WebGLRenderTarget(ICON_SIZE, ICON_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });

    const outCanvas = document.createElement('canvas');
    outCanvas.width = ICON_SIZE;
    outCanvas.height = ICON_SIZE;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return result;

    const pixelBuf = new Uint8Array(ICON_SIZE * ICON_SIZE * 4);
    const imgData = outCtx.createImageData(ICON_SIZE, ICON_SIZE);

    if (envTexture) {
      studioScene.environment = envTexture;
      studioScene.environmentIntensity = 1.15;
    }
    studioScene.add(hemi, keyLight, fillLight, rimLight);

    const halfFovSin = Math.sin(THREE.MathUtils.degToRad(studioCam.fov * 0.5));

    for (const id of ALL_RENDERABLE_ITEM_IDS) {
      const spec = getItemSpec(id);
      const pivot = new THREE.Group();
      const disposableGeos: THREE.BufferGeometry[] = [];
      const disposableMats: THREE.Material[] = [];

      let model: THREE.Group;
      if (id === 'cassette') {
        const built = createCassetteRecorderVisual(DUMMY_CASSETTE_DEF);
        model = built.group;
        disposableMats.push(built.ledMat);
        // Track only the non-cached LED mesh geometry (keep shared prop_cassette_recorder cached geo intact)
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && mesh.material === built.ledMat && mesh.geometry) {
            disposableGeos.push(mesh.geometry);
          }
        });
      } else {
        const pickupType: WorldPickupType = id === 'flashlight_uv' ? 'flashlight' : id;
        model = createVoxelItemModel(pickupType, true);

        if (id === 'flashlight_uv') {
          model.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh && mesh.name === 'flashlight_lens') {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.color && mat.emissive) {
                mat.color.setHex(0xc084fc);
                mat.emissive.setHex(0xa855f7);
                mat.emissiveIntensity = 2.4;
              }
            }
          });
        }

        // Track non-cached standalone materials & local flashlight_lens geometry for clean disposal
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (mesh.name === 'flashlight_lens' && mesh.geometry) {
            disposableGeos.push(mesh.geometry);
          }
          if (Array.isArray(mesh.material)) {
            for (const m of mesh.material) disposableMats.push(m);
          } else if (mesh.material) {
            disposableMats.push(mesh.material);
          }
        });
      }

      // Apply hero isometric angle and auto-center via bounding box/sphere
      pivot.add(model);
      pivot.rotation.set(spec.rotX, spec.rotY, spec.rotZ);
      pivot.updateMatrixWorld(true);

      box.setFromObject(pivot);
      box.getCenter(center);
      box.getBoundingSphere(sphere);

      // Re-center pivot so model's bounding center sits cleanly at world origin
      pivot.position.sub(center);
      pivot.updateMatrixWorld(true);

      const radius = Math.max(0.04, sphere.radius);
      const pad = spec.padFactor ?? 1.12;
      const dist = (radius / halfFovSin) * pad;

      studioCam.position.set(0, 0, dist);
      studioCam.lookAt(0, 0, 0);
      studioCam.near = Math.max(0.01, dist - radius * 3);
      studioCam.far = dist + radius * 4;
      studioCam.updateProjectionMatrix();
      studioCam.updateMatrixWorld(true);

      rimLight.color.setHex(spec.rimColor);
      rimLight.intensity = spec.rimIntensity;

      studioScene.add(pivot);

      renderer.autoClear = true;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(studioScene, studioCam);
      renderer.readRenderTargetPixels(rt, 0, 0, ICON_SIZE, ICON_SIZE, pixelBuf);

      // Flip Y from WebGL bottom-up pixels onto transparent 2D canvas
      const dst = imgData.data;
      for (let y = 0; y < ICON_SIZE; y++) {
        const srcRow = (ICON_SIZE - 1 - y) * ICON_SIZE * 4;
        const dstRow = y * ICON_SIZE * 4;
        for (let x = 0; x < ICON_SIZE * 4; x++) {
          dst[dstRow + x] = pixelBuf[srcRow + x];
        }
      }
      outCtx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
      outCtx.putImageData(imgData, 0, 0);
      result[id] = outCanvas.toDataURL('image/png');

      studioScene.remove(pivot);
      for (const geo of disposableGeos) geo.dispose();
      for (const mat of disposableMats) mat.dispose();
    }
  } catch {
    // Graceful empty-string fallback if headless WebGL readPixels fails
  } finally {
    studioScene.clear();
    hemi.dispose();
    keyLight.dispose();
    fillLight.dispose();
    rimLight.dispose();
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.autoClear = prevAutoClear;
    rt?.dispose();
  }

  return result;
}
