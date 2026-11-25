import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  createDiddyArticulatedRig,
  createHeldItemViewmodelRig,
  createOmegaDirectorRig,
  createOmegaScientistRig,
  createVigiaMarcosRig,
  createVoxelItemModel,
  createVoxelSurvivorRig,
  updateDiddyRigAnimation,
  type DiddyArticulatedRig,
} from '../game/models';
import { createProceduralMaterialPack, type MaterialPack } from '../game/textures';
import {
  getDiddySkinCosmetic,
  getFlashlightCosmetic,
  getGloveCosmetic,
} from '../game/saveSystem';
import type { CharacterPortraitId } from '../game/portraitRenderer';
import type { DiddySkinId, FlashlightColorId, GloveSkinId } from '../game/types';

export interface Stage3DViewportProps {
  mode: 'flashlight' | 'gloves' | 'diddy' | 'character';
  flashlightId?: FlashlightColorId;
  gloveId?: GloveSkinId;
  diddySkinId?: DiddySkinId;
  characterId?: CharacterPortraitId;
  className?: string;
  label?: string;
}

function disposeObject3D(root: THREE.Object3D, skipTextures?: Set<THREE.Texture>): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        materials.add(m);
        const std = m as THREE.MeshStandardMaterial;
        const maps = [
          std.map,
          std.normalMap,
          std.bumpMap,
          std.aoMap,
          std.roughnessMap,
          std.metalnessMap,
          std.emissiveMap,
          std.alphaMap,
        ];
        for (const t of maps) {
          if (t && (!skipTextures || !skipTextures.has(t))) {
            textures.add(t);
          }
        }
      }
    }
  });

  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) t.dispose();
}

function collectPackTextures(pack: MaterialPack): Set<THREE.Texture> {
  const set = new Set<THREE.Texture>([
    pack.contactShadowTex,
    pack.flashlightLensTex,
    pack.cobwebTex,
    pack.grassTuftTex,
    pack.moonTex,
    pack.glowHaloTex,
    pack.waterDripRingTex,
    pack.waterNormalTex,
    pack.diddyFaceTex,
    pack.diddySuitTex,
    pack.survivorFaceTex,
    pack.dirtyGlassMap,
    pack.dirtyGlassAlphaMap,
    pack.clawMarksTex,
    pack.oozeSeepTex,
    pack.cellScribbleTex,
    pack.drizzyFootprintTex,
  ]);
  for (const mat of Object.values(pack.materials)) {
    if (mat.map) set.add(mat.map);
    if (mat.normalMap) set.add(mat.normalMap);
    if (mat.bumpMap) set.add(mat.bumpMap);
    if (mat.roughnessMap) set.add(mat.roughnessMap);
    if (mat.metalnessMap) set.add(mat.metalnessMap);
    if (mat.emissiveMap) set.add(mat.emissiveMap);
  }
  return set;
}

interface FramingSpec {
  targetY: number;
  baseDist: number;
  basePitch: number;
  rimHex: number;
}

function getFramingSpec(
  mode: Stage3DViewportProps['mode'],
  flashlightId: FlashlightColorId,
  gloveId: GloveSkinId,
  diddySkinId: DiddySkinId,
  characterId: CharacterPortraitId
): FramingSpec {
  if (mode === 'flashlight') {
    const def = getFlashlightCosmetic(flashlightId);
    return { targetY: 0.72, baseDist: 2.1, basePitch: 0.22, rimHex: def.coneHex };
  }
  if (mode === 'gloves') {
    const def = getGloveCosmetic(gloveId);
    return { targetY: 0.72, baseDist: 1.95, basePitch: 0.24, rimHex: def.knuckleHex };
  }
  if (mode === 'diddy' || (mode === 'character' && characterId === 'diddy')) {
    const def = getDiddySkinCosmetic(diddySkinId);
    return { targetY: 1.15, baseDist: 3.35, basePitch: 0.14, rimHex: def.eyeHex };
  }
  const rimByChar: Record<CharacterPortraitId, number> = {
    survivor: 0x38bdf8,
    marcos: 0x34d399,
    diddy: 0xef4444,
    scientist: 0xa855f7,
    director: 0xf59e0b,
  };
  return {
    targetY: 0.94,
    baseDist: 2.85,
    basePitch: 0.14,
    rimHex: rimByChar[characterId] ?? 0x38bdf8,
  };
}

export const Stage3DViewport: React.FC<Stage3DViewportProps> = ({
  mode,
  flashlightId = 'halogen',
  gloveId = 'urban_default',
  diddySkinId = 'classic_s09',
  characterId = 'survivor',
  className = '',
  label,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Orbit & zoom interaction state stored in refs to avoid React re-renders during 60 FPS drag
  const yawRef = useRef<number>(-0.42);
  const pitchRef = useRef<number>(0.18);
  const zoomRef = useRef<number>(1.0);
  const draggingRef = useRef<{ active: boolean; pointerId: number; lastX: number; lastY: number }>({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  });
  const pauseAutoRotateUntilRef = useRef<number>(0);

  // Persistent Three.js scene objects across prop updates
  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    pack: MaterialPack;
    packTextures: Set<THREE.Texture>;
    turntableGroup: THREE.Group;
    pedestalRingMat: THREE.MeshStandardMaterial;
    rimLight: THREE.DirectionalLight;
    underLight: THREE.PointLight;
    activeModel: THREE.Object3D | null;
    activeDiddyRig: DiddyArticulatedRig | null;
    framing: FramingSpec;
    rafId: number;
  } | null>(null);

  // 1. Initialize WebGLRenderer, 3-point lighting, pedestal & animation loop ONCE
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();

    const width = Math.max(120, container.clientWidth || 320);
    const height = Math.max(120, container.clientHeight || 260);
    renderer.setSize(width, height, false);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 30);

    // 3-Point Studio Lighting + Tactical Rim
    const hemi = new THREE.HemisphereLight(0xb8c9e0, 0x111827, 1.25);
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.8);
    keyLight.position.set(2.4, 3.8, 3.2);
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
    fillLight.position.set(-2.6, 2.0, 2.2);
    const rimLight = new THREE.DirectionalLight(0xf59e0b, 3.4);
    rimLight.position.set(-2.2, 2.8, -2.6);
    const underLight = new THREE.PointLight(0xf59e0b, 1.2, 4.5, 1.8);
    underLight.position.set(0, 0.25, 0.5);

    scene.add(hemi, keyLight, fillLight, rimLight, underLight);

    // Tactical Dark Pedestal Ring
    const pedestalGroup = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(0.92, 1.06, 0.12, 24);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0d111a,
      roughness: 0.65,
      metalness: 0.45,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.06;
    pedestalGroup.add(baseMesh);

    const innerPlateGeo = new THREE.CylinderGeometry(0.76, 0.78, 0.02, 24);
    const innerPlateMat = new THREE.MeshStandardMaterial({
      color: 0x161d2c,
      roughness: 0.5,
      metalness: 0.55,
    });
    const innerPlate = new THREE.Mesh(innerPlateGeo, innerPlateMat);
    innerPlate.position.y = 0.01;
    pedestalGroup.add(innerPlate);

    const ringGeo = new THREE.TorusGeometry(0.84, 0.018, 10, 40);
    const pedestalRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.6,
    });
    const ringMesh = new THREE.Mesh(ringGeo, pedestalRingMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.015;
    pedestalGroup.add(ringMesh);

    scene.add(pedestalGroup);

    const turntableGroup = new THREE.Group();
    scene.add(turntableGroup);

    // Medium quality procedural material pack (disposed cleanly on unmount)
    const pack = createProceduralMaterialPack(256, 2);
    const packTextures = collectPackTextures(pack);

    const framing = getFramingSpec(mode, flashlightId, gloveId, diddySkinId, characterId);
    pitchRef.current = framing.basePitch;

    const state = {
      renderer,
      scene,
      camera,
      pack,
      packTextures,
      turntableGroup,
      pedestalRingMat,
      rimLight,
      underLight,
      activeModel: null as THREE.Object3D | null,
      activeDiddyRig: null as DiddyArticulatedRig | null,
      framing,
      rafId: 0,
    };
    engineRef.current = state;

    const handleResize = () => {
      if (!containerRef.current || !engineRef.current) return;
      const w = Math.max(120, containerRef.current.clientWidth || 320);
      const h = Math.max(120, containerRef.current.clientHeight || 260);
      engineRef.current.camera.aspect = w / h;
      engineRef.current.camera.updateProjectionMatrix();
      engineRef.current.renderer.setSize(w, h, false);
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(container);
    }
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();
    const tick = (now: number) => {
      const eng = engineRef.current;
      if (!eng) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Smooth auto-turntable rotation when not dragging
      if (!draggingRef.current.active && now > pauseAutoRotateUntilRef.current) {
        yawRef.current += dt * 0.42;
      }

      eng.turntableGroup.rotation.y = yawRef.current;

      // Gentle idle animation for P. Drizzy rig
      if (eng.activeDiddyRig) {
        updateDiddyRigAnimation(eng.activeDiddyRig, 'idle', dt);
      }

      // Position camera based on framing + zoom + subtle pitch
      const dist = eng.framing.baseDist / zoomRef.current;
      const pitch = Math.max(-0.18, Math.min(0.62, pitchRef.current));
      const targetY = eng.framing.targetY;
      eng.camera.position.set(
        0,
        targetY + Math.sin(pitch) * dist,
        Math.cos(pitch) * dist
      );
      eng.camera.lookAt(0, targetY, 0);

      eng.renderer.render(eng.scene, eng.camera);
      eng.rafId = requestAnimationFrame(tick);
    };

    state.rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(state.rafId);
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);

      if (state.activeModel) {
        state.turntableGroup.remove(state.activeModel);
        disposeObject3D(state.activeModel, state.packTextures);
        state.activeModel = null;
      }
      state.activeDiddyRig = null;

      disposeObject3D(pedestalGroup);
      state.pack.dispose();
      state.renderer.renderLists.dispose();
      state.renderer.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Rebuild preview model whenever mode or selected cosmetic/character changes
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;

    // Cleanly dispose previous model before swapping
    if (eng.activeModel) {
      eng.turntableGroup.remove(eng.activeModel);
      disposeObject3D(eng.activeModel, eng.packTextures);
      eng.activeModel = null;
    }
    eng.activeDiddyRig = null;

    const framing = getFramingSpec(mode, flashlightId, gloveId, diddySkinId, characterId);
    eng.framing = framing;
    pitchRef.current = framing.basePitch;
    zoomRef.current = 1.0;

    eng.rimLight.color.setHex(framing.rimHex);
    eng.underLight.color.setHex(framing.rimHex);
    eng.pedestalRingMat.color.setHex(framing.rimHex);
    eng.pedestalRingMat.emissive.setHex(framing.rimHex);

    let nextModel: THREE.Object3D;

    if (mode === 'flashlight') {
      const def = getFlashlightCosmetic(flashlightId);
      const wrap = new THREE.Group();
      const fl = createVoxelItemModel('flashlight', true);
      fl.scale.setScalar(2.6);
      fl.position.set(0, 0.72, 0.1);
      fl.rotation.set(-0.18, 0.35, 0.12);

      // Tint flashlight lens if present
      const lens = fl.getObjectByName('flashlight_lens') as THREE.Mesh | undefined;
      if (lens && lens.material instanceof THREE.MeshStandardMaterial) {
        lens.material.color.setHex(def.lensHex);
        lens.material.emissive.setHex(def.beamHex);
        lens.material.emissiveIntensity = 1.65;
      }

      // Colored volumetric light cone projecting from flashlight head
      const coneGeo = new THREE.CylinderGeometry(0.06, 0.42, 1.35, 20, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: def.coneHex,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, 0, -0.78);
      fl.add(cone);

      const coreGeo = new THREE.CylinderGeometry(0.03, 0.2, 1.15, 16, 1, true);
      const coreMat = new THREE.MeshBasicMaterial({
        color: def.beamHex,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.rotation.x = Math.PI / 2;
      core.position.set(0, 0, -0.68);
      fl.add(core);

      wrap.add(fl);
      nextModel = wrap;
    } else if (mode === 'gloves') {
      const wrap = new THREE.Group();
      // Pass gloveId (supported by Phase 2 models.ts, safely ignored if older signature)
      const rig = (createHeldItemViewmodelRig as (g?: GloveSkinId) => ReturnType<typeof createHeldItemViewmodelRig>)(
        gloveId
      );
      rig.setActiveItem('flashlight');
      rig.root.position.set(0, 0.72, 0.05);
      rig.root.rotation.set(0.08, -0.35, 0);
      rig.root.scale.setScalar(2.65);
      wrap.add(rig.root);
      nextModel = wrap;
    } else if (mode === 'diddy') {
      const rig = (
        createDiddyArticulatedRig as (p: MaterialPack, s?: DiddySkinId) => DiddyArticulatedRig
      )(eng.pack, diddySkinId);
      rig.root.position.set(0, 0.02, 0);
      eng.activeDiddyRig = rig;
      nextModel = rig.root;
    } else {
      // mode === 'character'
      switch (characterId) {
        case 'survivor':
          nextModel = createVoxelSurvivorRig(eng.pack);
          nextModel.position.set(0, 0.02, 0);
          break;
        case 'marcos':
          nextModel = createVigiaMarcosRig(eng.pack);
          nextModel.position.set(0, 0.02, 0);
          break;
        case 'scientist':
          nextModel = createOmegaScientistRig(eng.pack);
          nextModel.position.set(0, 0.02, 0);
          break;
        case 'director':
          nextModel = createOmegaDirectorRig(eng.pack);
          nextModel.position.set(0, 0.02, 0);
          break;
        case 'diddy':
        default: {
          const rig = (
            createDiddyArticulatedRig as (p: MaterialPack, s?: DiddySkinId) => DiddyArticulatedRig
          )(eng.pack, diddySkinId);
          rig.root.position.set(0, 0.02, 0);
          eng.activeDiddyRig = rig;
          nextModel = rig.root;
          break;
        }
      }
    }

    eng.turntableGroup.add(nextModel);
    eng.activeModel = nextModel;
  }, [mode, flashlightId, gloveId, diddySkinId, characterId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = {
      active: true,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    yawRef.current += dx * 0.011;
    pitchRef.current = Math.max(-0.14, Math.min(0.58, pitchRef.current + dy * 0.006));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current.pointerId === e.pointerId) {
      draggingRef.current.active = false;
      draggingRef.current.pointerId = -1;
      pauseAutoRotateUntilRef.current = performance.now() + 1800;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomRef.current = Math.max(0.65, Math.min(1.75, zoomRef.current + delta));
  };

  const adjustZoom = (delta: number) => {
    zoomRef.current = Math.max(0.65, Math.min(1.75, zoomRef.current + delta));
  };

  const resetView = () => {
    yawRef.current = -0.42;
    pitchRef.current = engineRef.current?.framing.basePitch ?? 0.18;
    zoomRef.current = 1.0;
    pauseAutoRotateUntilRef.current = 0;
  };

  return (
    <div
      ref={containerRef}
      data-testid="stage-3d-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
      className={`relative overflow-hidden border border-slate-700/80 bg-[radial-gradient(circle_at_50%_38%,rgba(30,41,59,0.62)_0%,rgba(6,9,15,0.96)_78%)] select-none touch-none cursor-grab active:cursor-grabbing ${className}`}
    >
      {/* Subtle tactical crosshair corner marks */}
      <div className="pointer-events-none absolute inset-2 border border-slate-500/15" />
      <div className="pointer-events-none absolute top-2 left-2.5 flex items-center gap-1.5 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] font-tech uppercase tracking-[0.16em] text-slate-300/90">
          {label ?? 'INSPETOR 3D · ARRASTE 360°'}
        </span>
      </div>

      {webglUnavailable ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
          <div className="text-xs font-horror uppercase tracking-wider text-amber-300">
            Visualização 3D Indisponível
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            WebGL não detectado neste dispositivo.
          </div>
        </div>
      ) : (
        <canvas ref={canvasRef} className="w-full h-full block" />
      )}

      {/* Zoom & Reset Controls */}
      <div
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => adjustZoom(0.18)}
          aria-label="Aproximar zoom 3D"
          className="horror-btn p-1.5 text-slate-200 cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => adjustZoom(-0.18)}
          aria-label="Afastar zoom 3D"
          className="horror-btn p-1.5 text-slate-200 cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Resetar câmera 3D"
          className="horror-btn p-1.5 text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2.5 z-10 text-[9px] font-tech uppercase tracking-widest text-slate-500">
        DRAG 360° · ZOOM
      </div>
    </div>
  );
};
