import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  VoxelMat,
  VoxelSculptor,
  clearSculptedCache,
  inspectObjectGeometry,
} from './voxelSculptor';
import {
  createAnimatedFanVisual,
  createCassetteRecorderVisual,
  createCctvSecretSignVisual,
  createCluePlaqueVisual,
  createCourtyardPillarVisual,
  createDiddyArticulatedRig,
  createDirtyGlassWindowVisual,
  createDoorVisual,
  createFnafDoorButtonVisual,
  createFurnitureVisual,
  createHeldItemViewmodelRig,
  createHidingSpotVisual,
  createNoisePropVisual,
  createOmegaDirectorRig,
  createOmegaScientistRig,
  createRechargeStationVisual,
  createSafeVisual,
  createSecurityCameraVisual,
  createServerRackVisual,
  createSwayingTarpVisual,
  createTutorialPlaqueVisual,
  createVigiaMarcosRig,
  createVoxelItemModel,
  createVoxelSurvivorRig,
  createWallClockVisual,
  createWallLightSwitchVisual,
  createWorkbenchVisual,
} from './models';
import {
  buildSculptedBaseboardGeo,
  buildSculptedCableTrayGeo,
  buildSculptedCeilingLuminaireGeo,
  buildSculptedCornerColumnGeo,
  buildSculptedFloorDrainGeo,
  buildSculptedRecessedWindowGeo,
  buildSculptedWallPanelGeo,
} from './sculptedArchitecture';
import type { MaterialId, MaterialPack } from './textures';
import type {
  DoorLockType,
  FurnitureKind,
  HidingSpotKind,
  WorldPickupType,
} from './types';

function createHeadlessMockPack(): MaterialPack {
  const matIds: MaterialId[] = [
    'concrete_wall',
    'wallpaper_wall',
    'basement_wall',
    'wood_floor',
    'grimy_tile',
    'basement_wet',
    'courtyard_stone',
    'grass_block',
    'oak_log',
    'ceiling_plaster',
    'door_wood',
    'door_red',
    'door_blue',
    'door_iron',
    'door_exit',
    'fnaf_blast_door',
    'crate_wood',
    'rusted_metal',
    'vent_metal',
    'plank_wood',
    'monitor_crt',
    'stair_step',
  ];
  const materials = {} as Record<MaterialId, THREE.MeshStandardMaterial>;
  for (const id of matIds) {
    materials[id] = new THREE.MeshStandardMaterial({ color: 0x808080 });
  }
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  return {
    materials,
    diddyFaceTex: tex as unknown as THREE.CanvasTexture,
    diddySuitTex: tex as unknown as THREE.CanvasTexture,
    contactShadowTex: tex as unknown as THREE.CanvasTexture,
    glowHaloTex: tex as unknown as THREE.CanvasTexture,
    moonTex: tex as unknown as THREE.CanvasTexture,
    cobwebTex: tex as unknown as THREE.CanvasTexture,
    grassTuftTex: tex as unknown as THREE.CanvasTexture,
    waterDripRingTex: tex as unknown as THREE.CanvasTexture,
    waterNormalTex: tex as unknown as THREE.CanvasTexture,
    flashlightLensTex: tex as unknown as THREE.CanvasTexture,
    survivorFaceTex: tex as unknown as THREE.CanvasTexture,
    dirtyGlassMap: tex as unknown as THREE.CanvasTexture,
    dirtyGlassAlphaMap: tex as unknown as THREE.CanvasTexture,
    clawMarksTex: tex as unknown as THREE.CanvasTexture,
    oozeSeepTex: tex as unknown as THREE.CanvasTexture,
    cellScribbleTex: tex as unknown as THREE.CanvasTexture,
    drizzyFootprintTex: tex as unknown as THREE.CanvasTexture,
    setParallaxEnabled: () => {},
    setTextureQuality: () => {},
    dispose: () => {
      tex.dispose();
      for (const id of matIds) materials[id].dispose();
    },
  };
}

const MIN_TRIANGLES = 180;

test('VoxelSculptor performs Hidden Face Culling, 2D Greedy Meshing, Multi-Material Groups, and Baked Vertex AO', () => {
  // 1. Solid 4x4x4 cube should cull all internal faces (384 raw -> 96 exposed) and greedy-merge to 6 quads (12 tris)!
  const solid = new VoxelSculptor(4, 4, 4, 0.1);
  solid.fillBox(0, 0, 0, 3, 3, 3, 0xaabbcc, VoxelMat.Matte);
  const solidRes = solid.build({ aoStrength: 0 });
  assert.equal(solidRes.stats.filledVoxels, 64);
  assert.equal(solidRes.stats.naiveFaces, 384);
  assert.equal(solidRes.stats.culledFaces, 96);
  assert.equal(solidRes.stats.mergedQuads, 6);
  assert.equal(solidRes.stats.triangles, 12);
  solidRes.geometry.dispose();

  // 2. Concave L-corner should bake darker Vertex AO in interior crease than on convex outer edge!
  const step = new VoxelSculptor(6, 6, 4, 0.1);
  step.fillBox(0, 0, 0, 5, 1, 3, 0xffffff, VoxelMat.Matte); // horizontal floor
  step.fillBox(0, 2, 0, 1, 5, 3, 0xffffff, VoxelMat.Matte); // vertical wall creating concave crease at (x=2, y=2)
  const stepRes = step.build({ aoStrength: 1.0 });
  const colorAttr = stepRes.geometry.getAttribute('color') as THREE.BufferAttribute;
  assert.ok(colorAttr && colorAttr.count > 0, 'Baked vertex color attribute must exist');
  let minLum = Infinity;
  let maxLum = -Infinity;
  for (let i = 0; i < colorAttr.count; i++) {
    const lum = (colorAttr.getX(i) + colorAttr.getY(i) + colorAttr.getZ(i)) / 3;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }
  assert.ok(
    maxLum - minLum > 0.2,
    `Expected clear AO contrast between concave crease and outer edge, got min=${minLum.toFixed(3)}, max=${maxLum.toFixed(3)}`
  );
  stepRes.geometry.dispose();

  // 3. Multi-material groups generated accurately
  const multi = new VoxelSculptor(6, 4, 4, 0.1);
  multi.fillBox(0, 0, 0, 1, 3, 3, 0x777777, VoxelMat.Matte);
  multi.fillBox(2, 0, 0, 3, 3, 3, 0xcbd5e1, VoxelMat.Metal);
  multi.fillBox(4, 0, 0, 4, 3, 3, 0x38bdf8, VoxelMat.Emissive);
  multi.fillBox(5, 0, 0, 5, 3, 3, 0xbae6fd, VoxelMat.Glass);
  const multiRes = multi.build();
  assert.ok(
    multiRes.geometry.groups.length >= 4,
    `Expected >= 4 material groups, got ${multiRes.geometry.groups.length}`
  );
  multiRes.geometry.dispose();
});

test('Anti-Simplification Audit: ALL 37 FurnitureKinds are high-density sculpted (>= 180 triangles, never a plain box)', () => {
  clearSculptedCache(true);
  const pack = createHeadlessMockPack();

  const allFurnitureKinds: FurnitureKind[] = [
    'bookshelf',
    'desk_monitor',
    'crate',
    'barrel',
    'pipe_cluster',
    'bed_medical',
    'dining_table',
    'side_table',
    'drawer_cabinet',
    'wall_frame',
    'potted_plant',
    'cable_conduit',
    'standing_lamp',
    'translation_board',
    'generator_lever',
    'secret_terminal',
    'interdiction_board',
    'radio_desk',
    'coffee_spill',
    'vent_grate_loose',
    'iv_stand',
    'chemical_barrel_ooze',
    'specimen_cylinder',
    'cell_sign_09',
    'level2_hatch',
    'bench_broken',
    'wing_sign',
    'wall_cctv',
    'filing_toppled',
    'workbench_schematic',
    'fuse_box_busted',
    'exit_pry_marks',
    'marcos_badge',
    'broken_glass_counter',
    'cafeteria_trays',
    'cell_bent_bars',
    'swivel_chair',
  ];

  const failures: string[] = [];
  for (const kind of allFurnitureKinds) {
    const fv = createFurnitureVisual(
      {
        id: `audit_${kind}`,
        kind,
        floor: 0,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        variant: 1,
        label: 'Audit',
      },
      pack
    );
    const stats = inspectObjectGeometry(fv.group);
    if (stats.isPlainSingleBox || stats.triangles < MIN_TRIANGLES) {
      failures.push(
        `Furniture '${kind}': triangles=${stats.triangles}, meshes=${stats.meshCount}, plainBox=${stats.isPlainSingleBox}`
      );
    }
    if (kind === 'drawer_cabinet') {
      assert.ok(fv.animatedPart, 'drawer_cabinet must expose animatedPart');
      assert.ok(fv.contentsAnchor, 'drawer_cabinet must expose contentsAnchor');
    }
    if (kind === 'generator_lever') {
      assert.ok(fv.animatedPart, 'generator_lever must expose animatedPart');
      assert.ok(fv.statusMat, 'generator_lever must expose statusMat');
    }
    if (kind === 'secret_terminal') {
      assert.ok(fv.statusMat, 'secret_terminal must expose statusMat');
    }
  }

  pack.dispose();
  clearSculptedCache(true);
  assert.deepEqual(failures, [], `Furniture audit failures:\n${failures.join('\n')}`);
});

test('Anti-Simplification Audit: ALL 17 Collectible Items & ALL 15 1st-Person Held Tools (>= 180 triangles)', () => {
  clearSculptedCache(true);

  const allItems: WorldPickupType[] = [
    'flashlight',
    'stun_gun',
    'stun_ammo',
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
  ];

  const failures: string[] = [];
  for (const itemType of allItems) {
    const model = createVoxelItemModel(itemType, false);
    const stats = inspectObjectGeometry(model);
    if (stats.isPlainSingleBox || stats.triangles < MIN_TRIANGLES) {
      failures.push(
        `Item '${itemType}': triangles=${stats.triangles}, meshes=${stats.meshCount}, plainBox=${stats.isPlainSingleBox}`
      );
    }
  }

  // Verify 1st-person held viewmodel rig (including sculpted forearm/glove/watch + UV lens switch)
  const rig = createHeldItemViewmodelRig();
  const handOnly = rig.handGroup.children.find((c) => c !== rig.itemAnchor);
  assert.ok(handOnly, '1st-person viewmodel must contain sculpted hand mesh');
  const handStats = inspectObjectGeometry(handOnly);
  assert.ok(
    !handStats.isPlainSingleBox && handStats.triangles >= 160,
    `1st-person sculpted arm/hand must be micro-voxel detailed (got ${handStats.triangles} tris)`
  );
  for (const [k, m] of Object.entries(rig.models)) {
    const stats = inspectObjectGeometry(m);
    if (stats.isPlainSingleBox || stats.triangles < MIN_TRIANGLES) {
      failures.push(
        `Held tool '${k}': triangles=${stats.triangles}, meshes=${stats.meshCount}, plainBox=${stats.isPlainSingleBox}`
      );
    }
  }
  const lens = rig.models.flashlight.getObjectByName('flashlight_lens') as THREE.Mesh | undefined;
  assert.ok(lens, 'Held flashlight must expose named flashlight_lens for UV mode toggle');
  rig.setUvMode(true);
  assert.equal((lens.material as THREE.MeshStandardMaterial).color.getHex(), 0xe879f9);
  rig.setUvMode(false);
  assert.equal((lens.material as THREE.MeshStandardMaterial).color.getHex(), 0xfff8dc);

  clearSculptedCache(true);
  assert.deepEqual(failures, [], `Item audit failures:\n${failures.join('\n')}`);
});

test('Anti-Simplification Audit: ALL Doors, Hiding Spots, Safe, Workbench, Electronics, Plaques & Noise Props (>= 180 triangles)', () => {
  clearSculptedCache(true);
  const pack = createHeadlessMockPack();
  const failures: string[] = [];

  const check = (label: string, obj: THREE.Object3D) => {
    const stats = inspectObjectGeometry(obj);
    if (stats.isPlainSingleBox || stats.triangles < MIN_TRIANGLES) {
      failures.push(
        `${label}: triangles=${stats.triangles}, meshes=${stats.meshCount}, plainBox=${stats.isPlainSingleBox}`
      );
    }
  };

  // All 8 DoorLockTypes
  const lockTypes: DoorLockType[] = [
    'none',
    'red_key',
    'blue_key',
    'basement_key',
    'crowbar_planks',
    'wire_cutters',
    'master_exit',
    'fnaf_blast',
  ];
  for (const lockType of lockTypes) {
    const dv = createDoorVisual(
      {
        id: `door_${lockType}`,
        name: lockType,
        floor: lockType === 'crowbar_planks' || lockType === 'wire_cutters' ? -1 : 0,
        gx: 10,
        gz: 10,
        spanCells: 2,
        axis: 'x',
        lockType,
        zoneA: 'start',
        zoneB: 'start',
        isOpen: false,
        isUnlocked: lockType === 'none',
        isExit: lockType === 'master_exit',
        openProgress: 0,
      },
      pack,
      1.6
    );
    check(`Door '${lockType}'`, dv.group);
    if (lockType === 'fnaf_blast') {
      assert.ok(dv.blastPanel, 'fnaf_blast door must have blastPanel');
      assert.ok(dv.ledMesh, 'fnaf_blast door must have ledMesh');
    }
  }

  // All 3 HidingSpotKinds
  const hideKinds: HidingSpotKind[] = ['locker', 'under_table', 'under_bed'];
  for (const kind of hideKinds) {
    const hv = createHidingSpotVisual(
      { id: `hide_${kind}`, kind, floor: 0, x: 0, y: 0, z: 0, facingYaw: 0, roomId: 'test' },
      pack
    );
    check(`HidingSpot '${kind}'`, hv.group);
    if (kind === 'locker') {
      assert.ok(hv.doorPivot, 'locker hiding spot must expose doorPivot');
    }
  }

  // Safe
  const safeVis = createSafeVisual(
    { id: 'safe', name: 'Cofre', zoneId: 'basement', floor: -1, x: 0, y: -3.45, z: 0, facingYaw: 0, code: '1234', unlocked: false, rewardItemId: 'master_key' },
    pack
  );
  check('Safe', safeVis.group);
  assert.ok(safeVis.doorPivot && safeVis.screenMat);

  // Workbench
  check(
    'Workbench',
    createWorkbenchVisual({ id: 'wb', name: 'Bancada', floor: 0, x: 0, y: 0, z: 0, facingYaw: 0 }, pack)
  );

  // Recharge Station
  const rc = createRechargeStationVisual(
    { id: 'rc', name: 'Recarga', floor: 0, x: 0, y: 1.35, z: 0, facingYaw: 0, cooldown: 0 },
    pack
  );
  check('RechargeStation', rc.group);
  assert.ok(rc.statusMat);

  // Cassette Recorder
  const tape = createCassetteRecorderVisual({
    id: 'tape_1',
    title: 'Fita #1',
    roomName: 'Segurança',
    floor: 0,
    x: 0,
    y: 0,
    z: 0,
    transcript: 'Teste',
    listened: false,
  });
  check('CassetteRecorder', tape.group);
  assert.ok(tape.ledMat);

  // Security Camera
  check(
    'SecurityCamera',
    createSecurityCameraVisual({
      id: 'cam_01',
      label: 'CAM 01',
      roomName: 'Pátio',
      floor: 0,
      x: 0,
      y: 2.6,
      z: 0,
      lookX: 4,
      lookY: 1,
      lookZ: 4,
    })
  );

  // FNAF Door Buttons
  for (const side of ['left', 'right'] as const) {
    const btn = createFnafDoorButtonVisual({ x: 0, y: 1.4, z: 0, facingYaw: 0, side });
    check(`FnafDoorButton '${side}'`, btn.group);
    assert.ok(btn.buttonMat);
  }

  // Courtyard Pillars (lantern & plain)
  check('CourtyardPillar (lantern)', createCourtyardPillarVisual({ x: 0, z: 0, height: 3.6, hasLantern: true }, pack));
  check('CourtyardPillar (plain)', createCourtyardPillarVisual({ x: 0, z: 0, height: 3.6, hasLantern: false }, pack));

  // Clue Plaque, Tutorial Plaque, CCTV Secret Sign
  check(
    'CluePlaque',
    createCluePlaqueVisual({
      id: 'clue_1',
      digitIndex: 0,
      digitValue: '7',
      title: 'NOTA #1',
      roomId: 'reception',
      roomName: 'Recepção',
      flavorText: 'Nota de auditoria',
      zoneId: 'start',
      floor: 0,
      x: 0,
      y: 1.5,
      z: 0,
      facingYaw: 0,
      discovered: false,
    })
  );
  check(
    'TutorialPlaque',
    createTutorialPlaqueVisual({
      id: 'tut_1',
      title: 'LANTERNA',
      lines: ['[F] Ligar', '[V] UV'],
      floor: 0,
      x: 0,
      y: 1.65,
      z: 0,
      facingYaw: 0,
    })
  );
  check('CctvSecretSign', createCctvSecretSignVisual(0, 1.8, 0, '942'));

  // Noise Props
  check('NoiseProp bottles', createNoisePropVisual({ id: 'np1', kind: 'bottles', floor: 0, x: 0, y: 0, z: 0, triggered: false, cooldown: 0 }));
  check('NoiseProp tin_cans', createNoisePropVisual({ id: 'np2', kind: 'tin_cans', floor: 0, x: 0, y: 0, z: 0, triggered: false, cooldown: 0 }));

  // Reworked Wall Light Switch, Sculpted Survivor Rig, Living Environment Props & Dirty Cracked Glass
  const wallSw = createWallLightSwitchVisual({ x: 0, y: 1.35, z: 0, facingYaw: 0, isOn: true });
  check('WallLightSwitch', wallSw.group);
  assert.ok(wallSw.lever && wallSw.ledMat, 'WallLightSwitch must expose pivoting lever & ledMat');

  check('VoxelSurvivorRig', createVoxelSurvivorRig(pack));

  const ceilFan = createAnimatedFanVisual('ceiling');
  check('AnimatedFan (ceiling)', ceilFan.group);
  assert.ok(ceilFan.bladePivot, 'Ceiling fan must expose bladePivot');
  const deskFan = createAnimatedFanVisual('desk');
  check('AnimatedFan (desk)', deskFan.group);
  assert.ok(deskFan.bladePivot, 'Desk fan must expose bladePivot');

  const wallClock = createWallClockVisual();
  check('WallClock', wallClock.group);
  assert.ok(wallClock.minuteHand && wallClock.secondHand, 'WallClock must expose animated hands');

  const serverRack = createServerRackVisual();
  check('ServerRack', serverRack.group);
  assert.ok(serverRack.ledMats.length >= 6, 'ServerRack must expose blinking LED materials');

  const tarp = createSwayingTarpVisual();
  const tarpStats = inspectObjectGeometry(tarp.group);
  assert.ok(!tarpStats.isPlainSingleBox && tarpStats.triangles >= 100, `SwayingTarp must be sculpted (got ${tarpStats.triangles} tris)`);
  assert.ok(tarp.swayPivot, 'SwayingTarp must expose swayPivot');

  const dirtyGlass = createDirtyGlassWindowVisual(1.5, 1.25, pack);
  const glassStats = inspectObjectGeometry(dirtyGlass);
  assert.ok(!glassStats.isPlainSingleBox && glassStats.triangles >= 80, `DirtyGlassWindow must be sculpted (got ${glassStats.triangles} tris)`);

  // Architectural 3D Relief Geometries (verify non-trivial sculpted relief)
  const reliefChecks: [string, THREE.BufferGeometry, number][] = [
    ['CeilingLuminaire', buildSculptedCeilingLuminaireGeo(), 80],
    ['CornerColumn', buildSculptedCornerColumnGeo(3.6), 40],
    ['FloorDrain', buildSculptedFloorDrainGeo(), 80],
    ['Baseboard', buildSculptedBaseboardGeo(1.6), 24],
    ['RecessedWindow', buildSculptedRecessedWindowGeo(), 120],
    ['CableTray', buildSculptedCableTrayGeo(2.0), 100],
    ['WallPanel', buildSculptedWallPanelGeo(), 60],
  ];
  for (const [name, geo, minTris] of reliefChecks) {
    const tris = geo.index ? geo.index.count / 3 : geo.getAttribute('position').count / 3;
    geo.dispose();
    if (tris < minTris) {
      failures.push(`ArchitecturalRelief '${name}': triangles=${tris} < ${minTris}`);
    }
  }

  pack.dispose();
  clearSculptedCache(true);
  assert.deepEqual(failures, [], `Architecture/prop audit failures:\n${failures.join('\n')}`);
});

test('Lore Characters Audit: ALL 5 story characters are high-density sculpted micro-voxel models with PBR materials', () => {
  clearSculptedCache(true);
  const pack = createHeadlessMockPack();

  const characterChecks: Array<[string, THREE.Object3D, number]> = [
    ['Protagonista (Survivor)', createVoxelSurvivorRig(pack), 350],
    ['Vigia Marcos', createVigiaMarcosRig(pack), 350],
    ['P. Drizzy (Refined Close-Up)', createDiddyArticulatedRig(pack).root, 350],
    ['Dra. Helena Vasconcelos', createOmegaScientistRig(pack), 350],
    ['Diretor Artur Neves', createOmegaDirectorRig(pack), 350],
  ];

  const failures: string[] = [];
  for (const [label, obj, minTris] of characterChecks) {
    const stats = inspectObjectGeometry(obj);
    let hasMetal = false;
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mats = Array.isArray((child as THREE.Mesh).material)
          ? ((child as THREE.Mesh).material as THREE.Material[])
          : [(child as THREE.Mesh).material as THREE.Material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if (typeof std.metalness === 'number' && std.metalness >= 0.8) {
            hasMetal = true;
          }
        }
      }
    });
    if (stats.isPlainSingleBox || stats.triangles < minTris) {
      failures.push(`${label}: triangles=${stats.triangles} < ${minTris}, plainBox=${stats.isPlainSingleBox}`);
    }
    if (!hasMetal) {
      failures.push(`${label}: missing PBR metallic material (metalness >= 0.8)`);
    }
  }

  pack.dispose();
  clearSculptedCache(true);
  assert.deepEqual(failures, [], `Character audit failures:\n${failures.join('\n')}`);
});
