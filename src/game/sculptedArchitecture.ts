import * as THREE from 'three';
import {
  ArgCluePlacement,
  DoorDefinition,
  BunkerCameraDefinition,
  HidingSpotDefinition,
  RechargeStationDefinition,
  SafeDefinition,
  TutorialPlaqueDefinition,
  WorkbenchDefinition,
} from './types';
import {
  MaterialPack,
  createArgClueTexture,
  createCctvSecretSignTexture,
  createFacilitySignTexture,
  createBunkerButtonLabelTexture,
  createTutorialBoardTexture,
} from './textures';
import {
  VoxelMat,
  VoxelSculptor,
  createSculptedMesh,
  getCachedSculptedGeometry,
  getSharedSculptedMaterials,
} from './voxelSculptor';

// ============================================================================
// 1. SCULPTED DOORS (DOUBLE JAMBS, HINGES, LEVER HANDLE, VIEWPORT, PLANKS, BLAST)
// ============================================================================

function getDoorPalette(lockType: DoorDefinition['lockType']): {
  leaf: number;
  panel: number;
  trim: number;
  jamb: number;
  barred: boolean;
  accent: number;
} {
  switch (lockType) {
    case 'red_key':
      return { leaf: 0x7f1d1d, panel: 0x5c1414, trim: 0x991b1b, jamb: 0x292524, barred: false, accent: 0xef4444 };
    case 'blue_key':
      return { leaf: 0x1e3a8a, panel: 0x172554, trim: 0x2563eb, jamb: 0x1e293b, barred: false, accent: 0x38bdf8 };
    case 'basement_key':
      return { leaf: 0x1f2937, panel: 0x111827, trim: 0x334155, jamb: 0x1f2937, barred: true, accent: 0x22c55e };
    case 'wire_cutters':
      return { leaf: 0x334155, panel: 0x1e293b, trim: 0x475569, jamb: 0x1e293b, barred: true, accent: 0xa855f7 };
    case 'master_exit':
      return { leaf: 0x451a03, panel: 0x2c1002, trim: 0x78350f, jamb: 0x1c1917, barred: false, accent: 0xf59e0b };
    case 'bunker_blast':
      return { leaf: 0x334155, panel: 0x1e293b, trim: 0x475569, jamb: 0x1e293b, barred: false, accent: 0x22c55e };
    default:
      return { leaf: 0x6b4b32, panel: 0x523723, trim: 0x3d2817, jamb: 0x2b1d12, barred: false, accent: 0x94a3b8 };
  }
}

function buildDoorFrameGeo(spanCells: number, cellSize: number, doorH: number, jambCol: number): THREE.BufferGeometry {
  const widthM = spanCells * cellSize;
  const vs = 0.08;
  const sx = Math.max(22, Math.round((widthM + 0.24) / vs));
  const sy = Math.max(28, Math.round((doorH + 0.28) / vs));
  const sz = 8;
  const v = new VoxelSculptor(sx, sy, sz, vs);

  // Thick double stepped outer & inner jambs on left & right sides
  v.fillBeveledBox(0, 0, 1, 2, sy - 1, 6, jambCol, VoxelMat.Matte, 'vertical');
  v.fillBeveledBox(sx - 3, 0, 1, sx - 1, sy - 1, 6, jambCol, VoxelMat.Matte, 'vertical');
  // Recessed inner doorstop rabbet step
  v.fillBox(2, 0, 2, 3, sy - 3, 5, 0x18181b, VoxelMat.Metal);
  v.fillBox(sx - 4, 0, 2, sx - 3, sy - 3, 5, 0x18181b, VoxelMat.Metal);

  // Heavy stepped top lintel header + steel reinforcement plates + rivets
  v.fillBeveledBox(0, sy - 4, 0, sx - 1, sy - 1, 7, jambCol, VoxelMat.Matte, 'horizontal');
  v.fillBox(2, sy - 3, 0, sx - 3, sy - 2, 0, 0x475569, VoxelMat.Metal);
  v.fillBox(2, sy - 3, 7, sx - 3, sy - 2, 7, 0x475569, VoxelMat.Metal);
  for (let x = 3; x < sx - 3; x += 4) {
    v.set(x, sy - 2, 0, 0x94a3b8, VoxelMat.Metal);
    v.set(x, sy - 2, 7, 0x94a3b8, VoxelMat.Metal);
  }
  // Base metal kick-shoes on both jamb bottoms + hinge knuckles
  v.fillBox(0, 0, 1, 3, 2, 6, 0x475569, VoxelMat.Metal);
  v.fillBox(sx - 4, 0, 1, sx - 1, 2, 6, 0x475569, VoxelMat.Metal);
  for (const hy of [6, Math.floor(sy * 0.48), sy - 8]) {
    v.fillBox(2, hy, 5, 3, hy + 2, 7, 0x64748b, VoxelMat.Metal);
  }
  // Threshold sill plate flush on floor
  v.fillBox(3, 0, 2, sx - 4, 0, 5, 0x334155, VoxelMat.Metal);

  v.applyTactileGrain(201, 0.05);
  return v.build({ anchor: [sx * 0.5, 0, sz * 0.5] }).geometry;
}

function buildDoorLeafGeo(
  spanCells: number,
  cellSize: number,
  doorH: number,
  lockType: DoorDefinition['lockType']
): THREE.BufferGeometry {
  const pal = getDoorPalette(lockType);
  const widthM = spanCells * cellSize - 0.14;
  const vs = 0.055;
  const sx = Math.max(24, Math.round(widthM / vs));
  const sy = Math.max(36, Math.round(doorH / vs));
  const sz = 6;
  const v = new VoxelSculptor(sx, sy, sz, vs);

  if (pal.barred) {
    // Heavy steel perimeter gate frame + crossbars + vertical iron prison bars + lockbox
    v.fillBox(0, 0, 1, sx - 1, sy - 1, 4, pal.leaf, VoxelMat.Metal);
    v.carveBox(3, 3, 0, sx - 4, sy - 4, 5);
    // Mid horizontal lock rail
    const midY = Math.floor(sy * 0.46);
    v.fillBox(2, midY - 1, 1, sx - 3, midY + 2, 4, pal.trim, VoxelMat.Metal);
    // Vertical forged iron bars with bolted collars
    for (let x = 5; x <= sx - 6; x += 3) {
      v.fillBox(x, 3, 2, x + 1, sy - 4, 3, 0x475569, VoxelMat.Metal);
      v.fillBox(x, midY - 2, 1, x + 1, midY + 3, 4, 0x64748b, VoxelMat.Metal);
    }
    // Reinforced lock box on handle side
    v.fillBeveledBox(sx - 7, midY - 3, 0, sx - 2, midY + 4, 5, 0x1e293b, VoxelMat.Metal, 'all');
    v.fillBox(sx - 5, midY, 0, sx - 4, midY + 1, 5, pal.accent, VoxelMat.Emissive);
  } else {
    // Solid sculpted industrial/facility door leaf with recessed lower panels, upper barred glass viewport,
    // pinned barrel hinges on left (x=0), lever handle & keyhole escutcheon on right (x=sx-4)
    v.fillBox(0, 0, 1, sx - 1, sy - 1, 4, pal.leaf, VoxelMat.Matte);
    // Steel bottom kickplate
    v.fillBox(1, 0, 0, sx - 2, 4, 5, 0x334155, VoxelMat.Metal);

    // Lower recessed beveled panel(s) carved on both front & back faces
    const lowTop = Math.floor(sy * 0.44);
    v.carveBox(4, 6, 1, sx - 5, lowTop, 1);
    v.carveBox(4, 6, 4, sx - 5, lowTop, 4);
    v.fillBox(5, 7, 1, sx - 6, lowTop - 1, 1, pal.panel, VoxelMat.Matte);
    v.fillBox(5, 7, 4, sx - 6, lowTop - 1, 4, pal.panel, VoxelMat.Matte);
    // Center stile divider if double-wide door
    if (sx >= 36) {
      const mx = Math.floor(sx / 2);
      v.fillBox(mx - 1, 5, 1, mx + 1, sy - 3, 4, pal.trim, VoxelMat.Matte);
    }

    // Upper recessed glass viewport window with perimeter frame & vertical safety bars!
    const winY0 = Math.floor(sy * 0.58);
    const winY1 = sy - 6;
    const winX0 = Math.max(5, Math.floor(sx * 0.22));
    const winX1 = Math.min(sx - 6, Math.floor(sx * 0.78));
    // Raised metallic viewport bezel on both sides
    v.fillBox(winX0 - 1, winY0 - 1, 0, winX1 + 1, winY1 + 1, 5, 0x334155, VoxelMat.Metal);
    v.carveBox(winX0, winY0, 0, winX1, winY1, 5);
    // Translucent cracked glass pane inside viewport
    v.fillBox(winX0, winY0, 2, winX1, winY1, 3, 0x94a3b8, VoxelMat.Glass);
    // Safety steel bars across glass
    for (let bx = winX0 + 3; bx < winX1 - 1; bx += 4) {
      v.fillBox(bx, winY0, 2, bx, winY1, 3, 0x1e293b, VoxelMat.Metal);
    }
    // Subtle diagonal crack highlight on glass
    v.fillLine(winX0 + 1, winY1 - 1, 3, winX0 + 4, winY1 - 4, 3, 0xe2e8f0, VoxelMat.Glass, 0);

    // Pinned steel barrel hinges on left edge (x = 0..1)
    for (const hy of [6, Math.floor(sy * 0.48), sy - 8]) {
      v.fillBox(0, hy, 0, 1, hy + 3, 5, 0x64748b, VoxelMat.Metal);
      v.set(0, hy + 4, 5, 0x94a3b8, VoxelMat.Metal);
    }

    // Lever handle + escutcheon lockplate + keyhole on right side (both faces!)
    const handleY = Math.floor(sy * 0.46);
    const hx = sx - 4;
    // Brass/steel escutcheon backing plate
    v.fillBox(hx - 1, handleY - 3, 0, hx + 1, handleY + 3, 0, 0x94a3b8, VoxelMat.Metal);
    v.fillBox(hx - 1, handleY - 3, 5, hx + 1, handleY + 3, 5, 0x94a3b8, VoxelMat.Metal);
    // Dark keyhole slot below lever
    v.fillBox(hx, handleY - 2, 0, hx, handleY - 1, 0, 0x090d14, VoxelMat.Matte);
    v.fillBox(hx, handleY - 2, 5, hx, handleY - 1, 5, 0x090d14, VoxelMat.Matte);
    // Protruding horizontal lever handle
    v.fillBox(hx - 4, handleY + 1, 0, hx, handleY + 1, 0, 0xf59e0b, VoxelMat.Metal);
    v.fillBox(hx - 4, handleY + 1, 5, hx, handleY + 1, 5, 0xf59e0b, VoxelMat.Metal);

    // Metallic identification nameplate above lock (accent colored border)
    const pMid = Math.floor(sx * 0.5);
    v.fillBox(pMid - 4, winY0 - 4, 0, pMid + 4, winY0 - 2, 0, pal.accent, VoxelMat.Metal);
    v.fillBox(pMid - 4, winY0 - 4, 5, pMid + 4, winY0 - 2, 5, pal.accent, VoxelMat.Metal);
  }

  v.applyTactileGrain(202 + lockType.length, 0.05);
  // Anchor at left-bottom-center so leafPivot rotates naturally around x=0!
  return v.build({ anchor: [0, 0, sz * 0.5] }).geometry;
}

function buildBunkerBlastPanelGeo(spanCells: number, cellSize: number, doorH: number): THREE.BufferGeometry {
  const widthM = spanCells * cellSize - 0.1;
  const vs = 0.065;
  const sx = Math.max(20, Math.round(widthM / vs));
  const sy = Math.max(32, Math.round(doorH / vs));
  const sz = 6;
  const v = new VoxelSculptor(sx, sy, sz, vs);

  // Heavy corrugated bunker steel core
  v.fillBox(0, 0, 1, sx - 1, sy - 1, 4, 0x334155, VoxelMat.Metal);
  // Recessed armor bays between thick horizontal blast ribs
  for (let y = 5; y < sy - 4; y += 6) {
    v.carveBox(3, y, 1, sx - 4, y + 3, 1);
    v.carveBox(3, y, 4, sx - 4, y + 3, 4);
    v.fillBox(3, y, 2, sx - 4, y + 3, 3, 0x1e293b, VoxelMat.Metal);
    // Rivet row along rib flange
    for (let x = 2; x < sx - 2; x += 3) {
      v.set(x, y + 4, 0, 0x94a3b8, VoxelMat.Metal);
      v.set(x, y + 4, 5, 0x94a3b8, VoxelMat.Metal);
    }
  }
  // Yellow/black industrial hazard chevron bumper along bottom edge
  for (let x = 1; x < sx - 1; x++) {
    for (let y = 0; y <= 3; y++) {
      const isYellow = ((x + y) % 4) < 2;
      v.set(x, y, 0, isYellow ? 0xfacc15 : 0x0f172a, VoxelMat.Matte);
      v.set(x, y, 5, isYellow ? 0xfacc15 : 0x0f172a, VoxelMat.Matte);
    }
  }
  // Heavy locking bolts protruding from left & right edges
  for (const by of [8, Math.floor(sy * 0.5), sy - 8]) {
    v.fillBox(0, by, 2, 1, by + 2, 3, 0xcbd5e1, VoxelMat.Metal);
    v.fillBox(sx - 2, by, 2, sx - 1, by + 2, 3, 0xcbd5e1, VoxelMat.Metal);
  }
  return v.build({ anchor: [sx * 0.5, sy * 0.5, sz * 0.5] }).geometry;
}

function buildBarricadePlanksGeo(widthM: number): THREE.BufferGeometry {
  const vs = 0.045;
  const sx = Math.max(26, Math.round((widthM + 0.18) / vs));
  const sy = 28;
  const sz = 6;
  const v = new VoxelSculptor(sx, sy, sz, vs);

  // 3 rough-hewn splintered barricade boards nailed diagonally/horizontally across door!
  const planks: [number, number, number][] = [
    [3, 7, 0x854d0e],
    [12, 16, 0x713f12],
    [21, 25, 0x92400e],
  ];
  planks.forEach(([y0, y1, col], idx) => {
    const tilt = idx === 1 ? 1 : -1;
    for (let x = 1; x < sx - 1; x++) {
      const dy = Math.round(((x - sx * 0.5) / sx) * 3 * tilt);
      const roughTop = y1 + dy - ((x * 7 + idx) % 5 === 0 ? 1 : 0);
      const roughBot = y0 + dy;
      v.fillBox(x, roughBot, 1, x, roughTop, 4, col, VoxelMat.Matte);
    }
    // Protruding rusted iron nail heads at both board ends
    v.fillBox(3, y0 + 1, 0, 4, y0 + 2, 5, 0x475569, VoxelMat.Metal);
    v.fillBox(sx - 5, y0 + 2, 0, sx - 4, y0 + 3, 5, 0x475569, VoxelMat.Metal);
  });

  v.applyTactileGrain(210, 0.08, 2);
  return v.build({ anchor: [sx * 0.5, sy * 0.5, sz * 0.5] }).geometry;
}

function buildPadlockGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(16, 22, 10, 0.017);
  // Steel U-shackle arch on top
  v.fillBox(3, 12, 4, 5, 19, 6, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(10, 12, 4, 12, 19, 6, 0xcbd5e1, VoxelMat.Metal);
  v.fillBeveledBox(3, 18, 4, 12, 21, 6, 0xe2e8f0, VoxelMat.Metal, 'top');
  // Heavy riveted brass lock body
  v.fillBeveledBox(1, 1, 1, 14, 12, 8, 0xd97706, VoxelMat.Metal, 'all');
  // Side armor bands & rivets
  v.fillBox(1, 3, 1, 14, 4, 8, 0xb45309, VoxelMat.Metal);
  v.fillBox(1, 9, 1, 14, 10, 8, 0xb45309, VoxelMat.Metal);
  // Recessed dark keyhole on front & back
  v.fillBox(7, 4, 1, 8, 8, 1, 0x0f172a, VoxelMat.Matte);
  v.fillBox(6, 7, 1, 9, 8, 1, 0x0f172a, VoxelMat.Matte);
  v.fillBox(7, 4, 8, 8, 8, 8, 0x0f172a, VoxelMat.Matte);
  return v.build({ anchor: [7.5, 10, 4.5] }).geometry;
}

export interface SculptedDoorVisual {
  def: DoorDefinition;
  group: THREE.Group;
  leafPivot: THREE.Group;
  blastPanel: THREE.Group | null;
  plankGroup: THREE.Group | null;
  padlockMesh: THREE.Mesh | null;
  ledMesh: THREE.Mesh | null;
  doorHeight: number;
}

export function createSculptedDoorVisual(
  door: DoorDefinition,
  _pack: MaterialPack,
  cellSize: number
): SculptedDoorVisual {
  const group = new THREE.Group();
  const width = door.spanCells * cellSize;
  const doorHeight = door.floor === -1 ? 2.58 : 2.88;

  const baseY = door.floor === 0 ? 0 : -4.0;
  if (door.axis === 'x') {
    group.position.set((door.gx + door.spanCells * 0.5) * cellSize, baseY, (door.gz + 0.5) * cellSize);
  } else {
    group.position.set((door.gx + 0.5) * cellSize, baseY, (door.gz + door.spanCells * 0.5) * cellSize);
    group.rotation.y = Math.PI / 2;
  }

  const pal = getDoorPalette(door.lockType);
  const frameKey = `door_frame_${door.spanCells}_${door.floor}_${door.lockType}`;
  const frameMesh = createSculptedMesh(frameKey, () =>
    buildDoorFrameGeo(door.spanCells, cellSize, doorHeight, pal.jamb)
  );
  group.add(frameMesh);

  // Sculpted hinged leaf pivot
  const leafPivot = new THREE.Group();
  leafPivot.position.set(-(width - 0.14) / 2, 0, 0);

  let blastPanel: THREE.Group | null = null;
  if (door.lockType === 'bunker_blast') {
    blastPanel = new THREE.Group();
    const blastMesh = createSculptedMesh(`door_blast_${door.spanCells}_${door.floor}`, () =>
      buildBunkerBlastPanelGeo(door.spanCells, cellSize, doorHeight)
    );
    blastMesh.position.set(0, doorHeight / 2, 0);
    blastPanel.add(blastMesh);
    group.add(blastPanel);
  } else {
    const leafMesh = createSculptedMesh(`door_leaf_${door.spanCells}_${door.floor}_${door.lockType}`, () =>
      buildDoorLeafGeo(door.spanCells, cellSize, doorHeight, door.lockType)
    );
    leafPivot.add(leafMesh);
    group.add(leafPivot);
  }

  // Barricade planks for crowbar_planks & master_exit
  let plankGroup: THREE.Group | null = null;
  if (door.lockType === 'crowbar_planks' || door.lockType === 'master_exit') {
    plankGroup = new THREE.Group();
    const planks = createSculptedMesh(`door_planks_${door.spanCells}`, () =>
      buildBarricadePlanksGeo(width)
    );
    planks.position.set(0, doorHeight * 0.48, 0.2);
    plankGroup.add(planks);
    group.add(plankGroup);
  }

  // Sculpted brass/steel padlock on barred gates
  let padlockMesh: THREE.Mesh | null = null;
  if (door.lockType === 'wire_cutters' || door.lockType === 'basement_key') {
    padlockMesh = createSculptedMesh('door_padlock', buildPadlockGeo);
    padlockMesh.position.set(0, doorHeight * 0.46, 0.19);
    group.add(padlockMesh);
  }

  // Dynamic status LED beacon over lockable / blast / exit doors
  let ledMesh: THREE.Mesh | null = null;
  if (
    door.lockType === 'master_exit' ||
    door.lockType === 'bunker_blast' ||
    door.lockType === 'red_key' ||
    door.lockType === 'blue_key' ||
    door.lockType === 'basement_key'
  ) {
    const ledColor =
      door.lockType === 'red_key'
        ? 0xef4444
        : door.lockType === 'blue_key'
        ? 0x38bdf8
        : door.lockType === 'basement_key'
        ? 0x22c55e
        : 0xf59e0b;
    ledMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.14, 0.16),
      new THREE.MeshStandardMaterial({
        color: ledColor,
        emissive: ledColor,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );
    ledMesh.position.set(0, doorHeight + 0.18, 0.24);
    group.add(ledMesh);
  }

  return {
    def: door,
    group,
    leafPivot,
    blastPanel,
    plankGroup,
    padlockMesh,
    ledMesh,
    doorHeight,
  };
}

// ============================================================================
// 2. SCULPTED HIDING SPOTS (LOUVERED LOCKER, TRUSSED TABLE, TUBULAR BED)
// ============================================================================

function buildLockerCarcassGeo(): THREE.BufferGeometry {
  // 20x42x18 industrial steel locker carcass with sloped dust top, interior shelf,
  // hanging hooks, corner foot pads, and side structural stampings
  const v = new VoxelSculptor(20, 42, 18, 0.056);

  // Hollow steel carcass (open front at z = 16..17)
  v.fillBox(1, 2, 1, 18, 39, 16, 0x334155, VoxelMat.Metal);
  v.carveBox(2, 3, 2, 17, 38, 16);
  // Sloped industrial dust-hood cap on top (y = 39..41)
  v.fillBox(1, 39, 1, 18, 39, 16, 0x475569, VoxelMat.Metal);
  v.fillBox(1, 40, 1, 18, 40, 12, 0x475569, VoxelMat.Metal);
  v.fillBox(1, 41, 1, 18, 41, 7, 0x64748b, VoxelMat.Metal);

  // 4 reinforced steel feet + recessed kick base
  for (const [fx, fz] of [[1, 1], [17, 1], [1, 14], [17, 14]]) {
    v.fillBox(fx, 0, fz, fx + 1, 2, fz + 2, 0x1e293b, VoxelMat.Metal);
  }
  // Interior hat shelf + rear coat hooks + bottom grime shadow
  v.fillBox(2, 31, 2, 17, 31, 14, 0x475569, VoxelMat.Metal);
  for (const hx of [5, 10, 14]) {
    v.fillBox(hx, 28, 2, hx, 29, 3, 0x94a3b8, VoxelMat.Metal);
    v.set(hx, 30, 3, 0xcbd5e1, VoxelMat.Metal);
  }
  // Recessed side stamping ribs on outer walls
  v.carveBox(1, 6, 4, 1, 35, 5);
  v.carveBox(18, 6, 4, 18, 35, 5);
  v.fillBox(2, 6, 4, 2, 35, 5, 0x1e293b, VoxelMat.Metal);
  v.fillBox(17, 6, 4, 17, 35, 5, 0x1e293b, VoxelMat.Metal);

  v.applyTactileGrain(301, 0.05);
  return v.build({ anchor: [10, 0, 9] }).geometry;
}

function buildLockerDoorGeo(): THREE.BufferGeometry {
  // 18x37x4 louvered steel locker door with voxel-by-voxel carved vent slats,
  // raised pin hinges, recessed handle pocket, keyed lock cylinder, and ID card frame
  const v = new VoxelSculptor(18, 37, 4, 0.056);

  // Main door steel panel with outer flange lip
  v.fillBox(0, 0, 1, 17, 36, 2, 0x475569, VoxelMat.Metal);
  v.fillBox(1, 1, 2, 16, 35, 2, 0x3f4e63, VoxelMat.Metal);

  // Upper & lower genuine carved voxel louver ventilation slats (look straight through!)
  v.carveLouvers(3, 27, 0, 14, 33, 3, 2);
  v.carveLouvers(3, 3, 0, 14, 9, 3, 2);
  // Angled metal slat hoods protruding slightly on front (z = 3)
  for (const y of [28, 30, 32, 4, 6, 8]) {
    v.fillBox(3, y, 3, 14, y, 3, 0x64748b, VoxelMat.Metal);
  }

  // Embossed nameplate frame near top center
  v.fillBox(6, 22, 3, 11, 24, 3, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(7, 23, 3, 10, 23, 3, 0xfef3c7, VoxelMat.Matte);

  // Recessed handle pocket + chrome pull handle + brass keyed cylinder lock (right side)
  v.carveBox(13, 14, 2, 15, 20, 2);
  v.fillBox(14, 15, 3, 15, 19, 3, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(14, 21, 3, 15, 22, 3, 0xf59e0b, VoxelMat.Metal); // lock cylinder
  v.set(14, 21, 3, 0x0f172a, VoxelMat.Matte); // keyhole

  // 3 raised pin barrel hinges along left edge (x = 0)
  for (const hy of [5, 18, 31]) {
    v.fillBox(0, hy, 2, 1, hy + 2, 3, 0x94a3b8, VoxelMat.Metal);
  }

  return v.build({ anchor: [0, 0, 1.5] }).geometry;
}

function buildHidingTableGeo(): THREE.BufferGeometry {
  // 32x18x20 sturdy hiding desk: beveled thick planked top, recessed apron,
  // half-open drawer with brass handle & manila folders inside, trussed legs with shoes
  const v = new VoxelSculptor(32, 18, 20, 0.06);

  // Thick planked beveled tabletop (y = 15..17) with plank seam lines
  v.fillBeveledBox(0, 15, 0, 31, 17, 19, 0x6b472b, VoxelMat.Matte, 'top');
  for (const pz of [5, 10, 14]) {
    v.fillBox(1, 17, pz, 30, 17, pz, 0x4a2f1a, VoxelMat.Matte);
  }

  // Structural recessed apron frame beneath top (leaving ample hollow hiding bay below!)
  v.fillBox(2, 12, 2, 29, 14, 17, 0x52341d, VoxelMat.Matte);
  v.carveBox(4, 12, 4, 27, 14, 17);

  // Half-open top drawer on left side with protruding brass pull & manila folder peeking out!
  v.fillBox(4, 12, 16, 14, 14, 19, 0x7c5333, VoxelMat.Matte);
  v.carveBox(5, 13, 15, 13, 14, 18);
  v.fillBox(7, 13, 19, 11, 13, 19, 0xf59e0b, VoxelMat.Metal); // brass pull
  v.fillBox(6, 13, 16, 11, 14, 18, 0xe7d6b4, VoxelMat.Matte); // manila folder

  // 4 thick chamfered legs with lower steel shoes & diagonal corner brace trusses
  for (const [lx, lz] of [[2, 2], [28, 2], [2, 16], [28, 16]]) {
    v.fillBox(lx, 2, lz, lx + 1, 14, lz + 1, 0x4a2f1a, VoxelMat.Matte);
    v.fillBox(lx, 0, lz, lx + 1, 1, lz + 1, 0x334155, VoxelMat.Metal); // floor shoe
  }
  // Side & rear stretcher cross-bars (front kept completely open for crawling underneath!)
  v.fillBox(2, 4, 2, 3, 5, 17, 0x3f2614, VoxelMat.Matte);
  v.fillBox(28, 4, 2, 29, 5, 17, 0x3f2614, VoxelMat.Matte);
  v.fillBox(3, 4, 2, 28, 5, 3, 0x3f2614, VoxelMat.Matte);

  // Scattered desk clutter on top (clipboard & rusted desk lamp base)
  v.fillBox(20, 18, 5, 26, 18, 12, 0xd6ccb8, VoxelMat.Matte);
  v.fillBox(22, 18, 5, 24, 18, 6, 0x94a3b8, VoxelMat.Metal);

  v.applyTactileGrain(302, 0.06);
  return v.build({ anchor: [16, 0, 10] }).geometry;
}

function buildHospitalBedGeo(): THREE.BufferGeometry {
  // 34x22x18 tubular metal medical/cell bed: swivel caster wheels, tubular corner posts,
  // slatted headboard/footboard, cross-braced frame, crumpled uneven relief mattress with stains & pillow!
  const v = new VoxelSculptor(34, 22, 18, 0.06);

  // 4 Swivel caster wheels + tubular vertical steel legs (clear space underneath for hiding!)
  for (const [lx, lz] of [[2, 2], [31, 2], [2, 15], [31, 15]]) {
    // Rubber caster wheel + chrome fork
    v.fillBox(lx, 0, lz, lx, 1, lz + 1, 0x0f172a, VoxelMat.Fabric);
    v.fillBox(lx, 2, lz, lx, 2, lz, 0x94a3b8, VoxelMat.Metal);
    // Vertical tubular frame post up to headboard (left) / footboard (right)
    const topY = lx < 10 ? 20 : 16;
    v.fillBox(lx, 3, lz, lx, topY, lz, 0x64748b, VoxelMat.Metal);
  }
  // Tubular headboard rails & vertical spindles (x = 2)
  v.fillBox(2, 20, 2, 2, 21, 15, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(2, 13, 2, 2, 13, 15, 0x64748b, VoxelMat.Metal);
  for (let z = 5; z <= 13; z += 3) {
    v.fillBox(2, 13, z, 2, 20, z, 0x64748b, VoxelMat.Metal);
  }
  // Tubular footboard rails (x = 31)
  v.fillBox(31, 16, 2, 31, 16, 15, 0x94a3b8, VoxelMat.Metal);
  for (let z = 5; z <= 13; z += 3) {
    v.fillBox(31, 10, z, 31, 16, z, 0x64748b, VoxelMat.Metal);
  }
  // Side frame rails & rusted spring deck at y = 9..10 (leaving 0..8 open for hiding under bed!)
  v.fillBox(2, 9, 2, 31, 10, 3, 0x475569, VoxelMat.Metal);
  v.fillBox(2, 9, 14, 31, 10, 15, 0x475569, VoxelMat.Metal);
  for (let x = 5; x <= 28; x += 3) {
    v.fillBox(x, 9, 3, x, 9, 14, 0x334155, VoxelMat.Metal);
  }
  // Folded side safety guardrail along back side (z = 2)
  v.fillBox(8, 15, 2, 24, 15, 2, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(10, 11, 2, 10, 15, 2, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(22, 11, 2, 22, 15, 2, 0x94a3b8, VoxelMat.Metal);

  // Crumpled uneven voxel mattress & stained clinical sheet (y = 11..14)
  v.fillBeveledBox(3, 11, 3, 30, 13, 14, 0xcbd5e1, VoxelMat.Fabric, 'top');
  // Draped rumpled blanket folds & organic uneven peaks on upper half
  v.fillBeveledBox(11, 13, 3, 29, 14, 15, 0x93c5fd, VoxelMat.Fabric, 'top');
  // Hanging sheet corner drooping off front edge
  v.fillBox(16, 10, 15, 23, 13, 16, 0x7aaee8, VoxelMat.Fabric);
  v.fillBox(18, 8, 16, 21, 10, 16, 0x6b9fd9, VoxelMat.Fabric);
  // Subtle dry dark stain / rust spots on sheet for horror storytelling
  v.fillBox(13, 14, 6, 17, 14, 9, 0x7f1d1d, VoxelMat.Fabric);
  v.fillBox(14, 14, 7, 16, 14, 8, 0x5c1414, VoxelMat.Fabric);
  // Crumpled sunken pillow at head end
  v.fillBeveledBox(4, 13, 5, 10, 16, 12, 0xf1f5f9, VoxelMat.Fabric, 'all');
  v.carveBox(6, 16, 7, 8, 16, 10); // head indentation!

  v.applyTactileGrain(303, 0.05);
  return v.build({ anchor: [17, 0, 9] }).geometry;
}

export interface SculptedHidingSpotVisual {
  def: HidingSpotDefinition;
  group: THREE.Group;
  doorPivot: THREE.Group | null;
}

export function createSculptedHidingSpotVisual(
  spot: HidingSpotDefinition,
  _pack: MaterialPack
): SculptedHidingSpotVisual {
  const group = new THREE.Group();
  group.position.set(spot.x, spot.y, spot.z);
  group.rotation.y = spot.facingYaw;

  let doorPivot: THREE.Group | null = null;
  if (spot.kind === 'locker') {
    const carcass = createSculptedMesh('hide_locker_carcass', buildLockerCarcassGeo, {
      castShadow: true,
      receiveShadow: true,
    });
    group.add(carcass);

    doorPivot = new THREE.Group();
    doorPivot.position.set(-0.504, 0.112, 0.42);
    const doorMesh = createSculptedMesh('hide_locker_door', buildLockerDoorGeo, {
      castShadow: true,
      receiveShadow: true,
    });
    doorPivot.add(doorMesh);
    group.add(doorPivot);
  } else if (spot.kind === 'under_table') {
    group.add(
      createSculptedMesh('hide_under_table', buildHidingTableGeo, {
        castShadow: true,
        receiveShadow: true,
      })
    );
  } else {
    group.add(
      createSculptedMesh('hide_under_bed', buildHospitalBedGeo, {
        castShadow: true,
        receiveShadow: true,
      })
    );
  }

  return { def: spot, group, doorPivot };
}

// ============================================================================
// 3. SAFE, WORKBENCH, RECHARGE STATION, CCTV CAMERA, Cabine 09-A BUTTON, PILLAR, PLAQUES
// ============================================================================

function buildSafeBodyGeo(): THREE.BufferGeometry {
  // 22x26x20 armored vault safe body with beveled steel edges, corner bolts, feet & hollow front bay
  const v = new VoxelSculptor(22, 26, 20, 0.055);
  v.fillBeveledBox(1, 2, 1, 20, 24, 18, 0x1e293b, VoxelMat.Metal, 'all');
  // Hollow vault cavity facing +Z
  v.carveBox(4, 5, 14, 17, 21, 18);
  // Heavy steel plinth feet
  for (const [fx, fz] of [[2, 2], [17, 2], [2, 15], [17, 15]]) {
    v.fillBox(fx, 0, fz, fx + 2, 2, fz + 2, 0x0f172a, VoxelMat.Metal);
  }
  // Armored corner reinforcement straps & rivets
  for (const y of [4, 22]) {
    v.fillBox(0, y, 2, 21, y + 1, 17, 0x334155, VoxelMat.Metal);
  }
  // Top warning nameplate
  v.fillBox(6, 25, 6, 15, 25, 13, 0x475569, VoxelMat.Metal);
  v.applyTactileGrain(401, 0.04);
  return v.build({ anchor: [11, 0, 10] }).geometry;
}

function buildSafeDoorGeo(): THREE.BufferGeometry {
  // Heavy bolted vault door with 3-spoke brass wheel, numeric keypad bezel & raised barrel hinges
  const v = new VoxelSculptor(16, 19, 6, 0.055);
  v.fillBeveledBox(0, 0, 1, 15, 18, 3, 0x334155, VoxelMat.Metal, 'vertical');
  // Recessed inner armor plate
  v.fillBox(2, 2, 3, 13, 16, 3, 0x1e293b, VoxelMat.Metal);
  // Raised hinges on left edge
  v.fillBox(0, 3, 3, 1, 6, 4, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(0, 12, 3, 1, 15, 4, 0x94a3b8, VoxelMat.Metal);
  // Sculpted brass 3-spoke vault wheel (centered at x=7, y=8)
  v.fillCylinderZ(7, 8, 3, 5, 3.3, 0xd97706, VoxelMat.Metal, 2.0);
  v.fillCylinderZ(7, 8, 3, 5, 1.3, 0xf59e0b, VoxelMat.Metal);
  v.fillLine(7, 8, 5, 7, 11, 5, 0xfbbf24, VoxelMat.Metal, 0);
  v.fillLine(7, 8, 5, 10, 6, 5, 0xfbbf24, VoxelMat.Metal, 0);
  v.fillLine(7, 8, 5, 4, 6, 5, 0xfbbf24, VoxelMat.Metal, 0);
  // Recessed digital keypad module above wheel
  v.fillBox(10, 12, 3, 14, 16, 4, 0x0f172a, VoxelMat.Matte);
  for (let ky = 13; ky <= 15; ky++) {
    for (let kx = 11; kx <= 13; kx++) {
      v.set(kx, ky, 4, 0x94a3b8, VoxelMat.Metal);
    }
  }
  return v.build({ anchor: [0, 9.5, 2] }).geometry;
}

export function createSculptedSafeVisual(
  safe: SafeDefinition,
  _pack: MaterialPack
): {
  group: THREE.Group;
  doorPivot: THREE.Group;
  screenMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  group.position.set(safe.x, safe.y - 0.55, safe.z);
  group.rotation.y = safe.facingYaw;

  group.add(createSculptedMesh('prop_safe_body', buildSafeBodyGeo, { castShadow: true, receiveShadow: true }));

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.42, 0.72, 0.44);
  doorPivot.add(createSculptedMesh('prop_safe_door', buildSafeDoorGeo, { castShadow: true, receiveShadow: true }));

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), screenMat);
  led.position.set(0.66, 0.36, 0.15);
  doorPivot.add(led);

  group.add(doorPivot);
  return { group, doorPivot, screenMat };
}

function buildWorkbenchGeo(): THREE.BufferGeometry {
  // 34x28x18 industrial workshop craft bench: thick planked tabletop, lower tool shelf,
  // cast-iron bench vise with handle bar, pegged rear tool board with wrenches/hammer,
  // glowing amber articulated gooseneck lamp, blue technical blueprint & tool parts
  const v = new VoxelSculptor(34, 28, 18, 0.055);

  // 4 Heavy timber legs with steel angle brackets & floor shoes
  for (const [lx, lz] of [[2, 2], [30, 2], [2, 14], [30, 14]]) {
    v.fillBox(lx, 2, lz, lx + 1, 15, lz + 1, 0x4a2f1a, VoxelMat.Matte);
    v.fillBox(lx, 0, lz, lx + 1, 1, lz + 1, 0x334155, VoxelMat.Metal);
  }
  // Lower slatted storage shelf + red steel toolbox & jerrycan resting underneath!
  v.fillBox(2, 4, 2, 31, 5, 15, 0x5c3c24, VoxelMat.Matte);
  v.fillBeveledBox(5, 6, 5, 13, 10, 11, 0xb91c1c, VoxelMat.Metal, 'top'); // red toolbox
  v.fillBox(7, 11, 8, 11, 11, 8, 0xcbd5e1, VoxelMat.Metal); // toolbox handle
  v.fillBeveledBox(20, 6, 5, 25, 12, 10, 0x166534, VoxelMat.Metal, 'top'); // oil jerrycan
  v.fillBox(21, 13, 7, 23, 13, 8, 0xfacc15, VoxelMat.Matte); // cap

  // Thick planked workbench top (y = 16..18) with front edge lip & wood grain seams
  v.fillBeveledBox(0, 16, 0, 33, 18, 17, 0x7c5333, VoxelMat.Matte, 'top');
  for (const pz of [4, 9, 13]) {
    v.fillBox(1, 18, pz, 32, 18, pz, 0x52341d, VoxelMat.Matte);
  }

  // Rear perforated steel pegboard backdrop (z = 1..2, y = 19..27) with hanging tools!
  v.fillBox(2, 19, 1, 31, 27, 2, 0x334155, VoxelMat.Metal);
  for (let px = 4; px <= 29; px += 3) {
    for (let py = 21; py <= 26; py += 2) {
      v.set(px, py, 2, 0x0f172a, VoxelMat.Matte); // pegboard holes
    }
  }
  // Hanging steel wrench, hammer & screwdriver on pegboard
  v.fillBox(7, 20, 3, 8, 25, 3, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(6, 25, 3, 9, 26, 3, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(14, 20, 3, 14, 24, 3, 0x92400e, VoxelMat.Matte);
  v.fillBox(12, 24, 3, 16, 25, 3, 0x64748b, VoxelMat.Metal);
  v.fillBox(20, 21, 3, 20, 25, 3, 0xdc2626, VoxelMat.Matte);
  v.fillBox(20, 20, 3, 20, 20, 3, 0xe2e8f0, VoxelMat.Metal);

  // Cast-iron bench vise bolted to front-left corner (x = 2..8, z = 12..17)
  v.fillBeveledBox(2, 19, 12, 7, 22, 16, 0x1e3a8a, VoxelMat.Metal, 'top');
  v.fillBox(3, 21, 14, 6, 22, 14, 0x94a3b8, VoxelMat.Metal); // steel jaws
  v.fillBox(2, 20, 17, 7, 20, 17, 0xcbd5e1, VoxelMat.Metal); // vise crank bar

  // Blue technical blueprint spread out on bench center with white diagram lines
  v.fillBox(11, 19, 5, 24, 19, 13, 0x1d4ed8, VoxelMat.Matte);
  v.fillBox(13, 19, 7, 21, 19, 7, 0xbae6fd, VoxelMat.Emissive);
  v.fillBox(13, 19, 10, 19, 19, 10, 0xbae6fd, VoxelMat.Emissive);

  // Articulated gooseneck workshop lamp on right side glowing warm amber!
  v.fillCylinderY(28, 19, 20, 5, 2.2, 0x1e293b, VoxelMat.Metal);
  v.fillLine(28, 20, 5, 29, 25, 5, 0x64748b, VoxelMat.Metal, 0);
  v.fillLine(29, 25, 5, 26, 27, 8, 0x64748b, VoxelMat.Metal, 0);
  v.fillBeveledBox(24, 25, 7, 28, 27, 11, 0x334155, VoxelMat.Metal, 'top');
  v.fillBox(25, 24, 8, 27, 25, 10, 0xfef08a, VoxelMat.Emissive);

  v.applyTactileGrain(402, 0.05);
  return v.build({ anchor: [17, 0, 9] }).geometry;
}

export function createSculptedWorkbenchVisual(
  wb: WorkbenchDefinition,
  _pack: MaterialPack
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(wb.x, wb.y, wb.z);
  group.rotation.y = wb.facingYaw;
  group.add(
    createSculptedMesh('prop_workbench', buildWorkbenchGeo, {
      castShadow: true,
      receiveShadow: true,
    })
  );
  return group;
}

function buildRechargeStationGeo(): THREE.BufferGeometry {
  // 20x26x10 wall-mounted high-voltage charger cabinet with cooling fins, analog gauge,
  // armored top conduit, and recessed rubber flashlight cradle dock
  const v = new VoxelSculptor(20, 26, 10, 0.036);
  v.fillBeveledBox(1, 2, 0, 18, 23, 6, 0x334155, VoxelMat.Metal, 'all');
  // Top & bottom armored steel conduit stubs
  v.fillCylinderY(6, 23, 25, 3, 1.5, 0x64748b, VoxelMat.Metal);
  v.fillCylinderY(13, 23, 25, 3, 1.5, 0x64748b, VoxelMat.Metal);
  v.fillCylinderY(9.5, 0, 2, 3, 1.8, 0x475569, VoxelMat.Metal);
  // Side cooling heatsink fins
  for (let y = 5; y <= 20; y += 3) {
    v.fillBox(0, y, 1, 1, y + 1, 5, 0x1e293b, VoxelMat.Metal);
    v.fillBox(18, y, 1, 19, y + 1, 5, 0x1e293b, VoxelMat.Metal);
  }
  // Recessed voltmeter dial + glass face
  v.fillBox(3, 13, 6, 16, 17, 7, 0x0f172a, VoxelMat.Matte);
  v.fillBox(4, 14, 7, 15, 16, 7, 0xe2e8f0, VoxelMat.Glass);
  v.fillLine(9, 14, 6, 12, 16, 6, 0xef4444, VoxelMat.Emissive, 0);
  // Protruding rubberized flashlight charging dock cradle (bottom half)
  v.fillBeveledBox(4, 4, 6, 15, 10, 9, 0x111827, VoxelMat.Fabric, 'all');
  v.carveBox(6, 6, 6, 13, 10, 8);
  // Twin brass charging contacts inside cradle
  v.fillBox(7, 5, 7, 8, 6, 8, 0xf59e0b, VoxelMat.Metal);
  v.fillBox(11, 5, 7, 12, 6, 8, 0xf59e0b, VoxelMat.Metal);
  // Yellow hazard stripe across bottom edge
  for (let x = 2; x <= 17; x += 2) {
    v.set(x, 3, 6, x % 4 === 0 ? 0xfacc15 : 0x0f172a, VoxelMat.Matte);
  }
  return v.build({ anchor: [10, 13, 3] }).geometry;
}

export function createSculptedRechargeStationVisual(
  st: RechargeStationDefinition,
  _pack: MaterialPack
): { group: THREE.Group; statusMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.position.set(st.x, st.y, st.z);
  group.rotation.y = st.facingYaw;

  group.add(createSculptedMesh('prop_recharge_station', buildRechargeStationGeo));

  const statusMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.06), statusMat);
  led.position.set(0, 0.25, 0.15);
  group.add(led);

  return { group, statusMat };
}

function buildSecurityCameraMountGeo(): THREE.BufferGeometry {
  // Articulated ceiling/wall bracket arm with bolted base plate, knuckle joint & cable loop
  const v = new VoxelSculptor(14, 16, 14, 0.022);
  v.fillBeveledBox(3, 13, 3, 10, 15, 10, 0x334155, VoxelMat.Metal, 'vertical');
  // Corner mounting bolts
  for (const [bx, bz] of [[4, 4], [9, 4], [4, 9], [9, 9]]) {
    v.set(bx, 12, bz, 0x94a3b8, VoxelMat.Metal);
  }
  // Vertical articulated strut + pivot knuckle
  v.fillBox(6, 5, 6, 7, 13, 7, 0x475569, VoxelMat.Metal);
  v.fillBeveledBox(5, 3, 5, 8, 6, 8, 0x1e293b, VoxelMat.Metal, 'all');
  // Coiled power cable curving down bracket
  v.fillLine(9, 13, 7, 10, 8, 8, 0x0f172a, VoxelMat.Fabric, 0);
  v.fillLine(10, 8, 8, 8, 5, 7, 0x0f172a, VoxelMat.Fabric, 0);
  return v.build({ anchor: [7, 4, 7] }).geometry;
}

function buildSecurityCameraHeadGeo(): THREE.BufferGeometry {
  // 16x14x24 weatherproof CCTV camera housing: stepped white/slate chassis, overhanging sun-visor hood,
  // side cooling vents, layered metallic lens barrel + dark translucent optical glass + IR LED ring + REC LED
  const v = new VoxelSculptor(16, 14, 24, 0.022);

  // Main stepped aluminum camera body
  v.fillBeveledBox(3, 2, 3, 12, 11, 18, 0xdbe4ee, VoxelMat.Matte, 'all');
  // Overhanging dark-rimmed top sun-visor hood extending past the lens!
  v.fillBox(2, 11, 2, 13, 12, 23, 0x334155, VoxelMat.Metal);
  v.fillBox(2, 9, 18, 2, 11, 22, 0x334155, VoxelMat.Metal);
  v.fillBox(13, 9, 18, 13, 11, 22, 0x334155, VoxelMat.Metal);
  // Side ventilation louvers
  v.carveLouvers(3, 4, 6, 3, 9, 13, 2);
  v.carveLouvers(12, 4, 6, 12, 9, 13, 2);
  // Rear cable gland + antenna stub
  v.fillCylinderZ(7.5, 6.5, 0, 3, 2.0, 0x1e293b, VoxelMat.Fabric);
  v.fillBox(10, 12, 4, 10, 13, 4, 0x64748b, VoxelMat.Metal);

  // Layered stepped black steel lens barrel protruding forward (z = 18..22)
  v.fillCylinderZ(7.5, 6.2, 18, 21, 3.6, 0x111827, VoxelMat.Metal);
  v.fillCylinderZ(7.5, 6.2, 21, 22, 3.8, 0x475569, VoxelMat.Metal, 2.6);
  // Translucent dark cyan optical lens dome + inner aperture ring
  v.fillCylinderZ(7.5, 6.2, 20, 21, 2.4, 0x0c4a6e, VoxelMat.Glass);
  v.fillCylinderZ(7.5, 6.2, 19, 19, 1.4, 0x020617, VoxelMat.Metal);

  // Infrared night-vision micro-LED ring + bright red REC status indicator
  v.set(4, 6, 19, 0x7f1d1d, VoxelMat.Emissive);
  v.set(11, 6, 19, 0x7f1d1d, VoxelMat.Emissive);
  v.fillBox(10, 9, 19, 11, 10, 19, 0xef4444, VoxelMat.Emissive);

  return v.build({ anchor: [7.5, 6.5, 11] }).geometry;
}

export function createSculptedSecurityCameraVisual(cam: BunkerCameraDefinition): THREE.Group {
  const group = new THREE.Group();
  group.position.set(cam.x, cam.y, cam.z);

  group.add(createSculptedMesh('prop_cctv_mount', buildSecurityCameraMountGeo));

  const head = new THREE.Group();
  head.add(createSculptedMesh('prop_cctv_head', buildSecurityCameraHeadGeo));
  head.lookAt(cam.lookX, cam.lookY, cam.lookZ);
  group.add(head);

  return group;
}

function buildBunkerButtonBoxGeo(): THREE.BufferGeometry {
  // 18x26x8 armored steel door-control switchboard with hazard top/bottom bumpers,
  // protective button side shrouds, conduit stub & bolted bezel
  const v = new VoxelSculptor(18, 26, 8, 0.029);
  v.fillBeveledBox(1, 2, 0, 16, 23, 5, 0x1e293b, VoxelMat.Metal, 'vertical');
  // Top & bottom yellow/black hazard bumper rails
  for (let x = 1; x <= 16; x++) {
    const col = x % 4 < 2 ? 0xfacc15 : 0x0f172a;
    v.fillBox(x, 1, 0, x, 2, 6, col, VoxelMat.Matte);
    v.fillBox(x, 23, 0, x, 24, 6, col, VoxelMat.Matte);
  }
  // Armored power conduit entering top
  v.fillCylinderY(8.5, 24, 25, 2.5, 1.8, 0x475569, VoxelMat.Metal);
  // Protective U-shroud guard around lower push button so guard can't bump it accidentally
  v.fillBox(3, 4, 5, 4, 11, 7, 0x475569, VoxelMat.Metal);
  v.fillBox(13, 4, 5, 14, 11, 7, 0x475569, VoxelMat.Metal);
  v.fillBox(3, 4, 5, 14, 5, 7, 0x334155, VoxelMat.Metal);
  // Corner hex bolts
  for (const [bx, by] of [[2, 4], [15, 4], [2, 21], [15, 21]]) {
    v.set(bx, by, 5, 0x94a3b8, VoxelMat.Metal);
  }
  return v.build({ anchor: [9, 13, 2.5] }).geometry;
}

export function createSculptedBunkerDoorButtonVisual(btn: {
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  side: 'left' | 'right';
}): { group: THREE.Group; buttonMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.position.set(btn.x, btn.y, btn.z);
  group.rotation.y = btn.facingYaw;

  group.add(createSculptedMesh('prop_bunker_btn_box', buildBunkerButtonBoxGeo));

  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 1.85,
    roughness: 0.2,
  });
  const btnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.1), buttonMat);
  btnMesh.position.set(0, -0.14, 0.12);
  group.add(btnMesh);

  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), buttonMat);
  beacon.position.set(0, 0.27, 0.11);
  group.add(beacon);

  const labelTex = createBunkerButtonLabelTexture(btn.side);
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.025),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: labelTex,
      emissive: 0x333333,
      emissiveIntensity: 0.45,
      roughness: 0.6,
    })
  );
  plaque.position.set(0, 0.12, 0.11);
  group.add(plaque);

  return { group, buttonMat };
}

function buildCourtyardPillarGeo(height: number, hasLantern: boolean): THREE.BufferGeometry {
  const vs = 0.09;
  const sy = Math.max(36, Math.round(height / vs));
  const v = new VoxelSculptor(18, sy, 14, vs);

  // Stepped mossy stone plinth base (y = 0..4)
  v.fillBeveledBox(2, 0, 2, 11, 2, 11, 0x475569, VoxelMat.Matte, 'vertical');
  v.fillBeveledBox(3, 3, 3, 10, 4, 10, 0x64748b, VoxelMat.Matte, 'vertical');
  // Moss patches creeping up plinth corners
  v.fillBox(2, 0, 2, 4, 2, 3, 0x166534, VoxelMat.Fabric);
  v.fillBox(9, 0, 9, 11, 1, 11, 0x15803d, VoxelMat.Fabric);

  // Fluted chamfered stone column shaft (y = 5..sy-5)
  v.fillBeveledBox(4, 5, 4, 9, sy - 5, 9, 0x64748b, VoxelMat.Matte, 'vertical');
  // Vertical fluting grooves on all 4 faces
  v.carveBox(6, 7, 4, 7, sy - 7, 4);
  v.carveBox(6, 7, 9, 7, sy - 7, 9);
  v.carveBox(4, 7, 6, 4, sy - 7, 7);
  v.carveBox(9, 7, 6, 9, sy - 7, 7);
  // Decorative stone banding rings
  v.fillBox(3, Math.floor(sy * 0.45), 3, 10, Math.floor(sy * 0.45) + 1, 10, 0x475569, VoxelMat.Matte);

  // Stepped corbel capital flush to pergola beam (y = sy-4..sy-1)
  v.fillBeveledBox(3, sy - 4, 3, 10, sy - 3, 10, 0x475569, VoxelMat.Matte, 'vertical');
  v.fillBeveledBox(2, sy - 2, 2, 11, sy - 1, 11, 0x334155, VoxelMat.Matte, 'vertical');

  if (hasLantern) {
    // Forged iron scroll bracket & caged voxel street lantern hanging on +X side
    const ly = sy - 8;
    v.fillBox(10, ly + 2, 6, 15, ly + 2, 7, 0x1e293b, VoxelMat.Metal);
    v.fillLine(10, ly - 1, 6.5, 13, ly + 2, 6.5, 0x1e293b, VoxelMat.Metal, 0);
    // Lantern roof cap + iron corner cage + warm amber glowing glass core
    v.fillBeveledBox(13, ly, 5, 17, ly + 1, 8, 0x1e293b, VoxelMat.Metal, 'top');
    v.fillBox(13, ly - 4, 5, 17, ly - 4, 8, 0x1e293b, VoxelMat.Metal);
    v.fillBox(14, ly - 3, 6, 16, ly - 1, 7, 0xfef08a, VoxelMat.Emissive);
    for (const [cx, cz] of [[13, 5], [17, 5], [13, 8], [17, 8]]) {
      v.fillBox(cx, ly - 3, cz, cx, ly - 1, cz, 0x0f172a, VoxelMat.Metal);
    }
  }

  v.applyTactileGrain(405, 0.06);
  return v.build({ anchor: [6.5, 0, 6.5] }).geometry;
}

export function createSculptedCourtyardPillarVisual(
  pillar: { x: number; y?: number; z: number; height: number; hasLantern?: boolean },
  pack: MaterialPack
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(pillar.x, pillar.y ?? 0, pillar.z);

  const key = `courtyard_pillar_${Math.round(pillar.height * 10)}_${pillar.hasLantern ? 'L' : 'N'}`;
  group.add(
    createSculptedMesh(key, () => buildCourtyardPillarGeo(pillar.height, Boolean(pillar.hasLantern)), {
      castShadow: true,
      receiveShadow: true,
    })
  );

  if (pillar.hasLantern) {
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: pack.glowHaloTex,
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.position.set(0.75, pillar.height - 0.85, 0);
    halo.scale.set(1.25, 1.25, 1);
    group.add(halo);
  }
  return group;
}

/**
 * Shared 3-layer sculpted wall frame geometry (used by paintings, clues, tutorials, signs).
 * Thick stepped beveled frame with corner brackets & hanging wire + subtle cracked glass!
 */
export function buildSculptedWallFrameGeo(
  widthM: number,
  heightM: number,
  frameHex = 0x4a2f1a,
  bracketHex = 0x94a3b8,
  withGlass = true
): THREE.BufferGeometry {
  const vs = 0.04;
  const sx = Math.max(18, Math.round(widthM / vs));
  const sy = Math.max(14, Math.round(heightM / vs));
  const sz = 4;
  const v = new VoxelSculptor(sx, sy, sz, vs);

  // Backing board (z = 0)
  v.fillBox(1, 1, 0, sx - 2, sy - 2, 0, 0x1c1917, VoxelMat.Matte);
  // Outer thick stepped frame lip (z = 0..3)
  v.fillBox(0, 0, 0, sx - 1, sy - 1, 3, frameHex, VoxelMat.Matte);
  v.carveBox(2, 2, 1, sx - 3, sy - 3, 3);
  // Inner gold/metallic stepped rabbet molding (z = 1..2)
  v.fillBox(2, 2, 1, sx - 3, sy - 3, 2, 0x785a3a, VoxelMat.Matte);
  v.carveBox(3, 3, 1, sx - 4, sy - 4, 3);
  // Corner L-brackets with rivets
  for (const [cx, cy] of [
    [0, 0],
    [sx - 3, 0],
    [0, sy - 3],
    [sx - 3, sy - 3],
  ]) {
    v.fillBox(cx, cy, 3, cx + 2, cy + 2, 3, bracketHex, VoxelMat.Metal);
  }
  // Optional subtle cracked glass strips in upper/lower corners (never obscuring center artwork!)
  if (withGlass) {
    v.fillLine(3, sy - 4, 2, 7, sy - 7, 2, 0xe2e8f0, VoxelMat.Glass, 0);
    v.fillLine(sx - 4, 3, 2, sx - 7, 6, 2, 0xcbd5e1, VoxelMat.Glass, 0);
  }

  v.applyTactileGrain(410, 0.05);
  return v.build({ anchor: [sx * 0.5, sy * 0.5, 0] }).geometry;
}

export function createSculptedCluePlaqueVisual(clue: ArgCluePlacement): THREE.Group {
  const group = new THREE.Group();
  group.position.set(clue.x, clue.y, clue.z);
  group.rotation.y = clue.facingYaw ?? 0;

  const frame = createSculptedMesh('frame_clue_plaque', () =>
    buildSculptedWallFrameGeo(0.9, 0.9, 0x5c3c24, 0xd97706, true)
  );
  group.add(frame);

  const tex = createArgClueTexture(clue.digitIndex, clue.digitValue, clue.title);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      emissive: 0x3b2c1a,
      emissiveIntensity: 0.45,
      roughness: 0.8,
    })
  );
  art.position.z = 0.055;
  group.add(art);
  return group;
}

export function createSculptedTutorialPlaqueVisual(plaque: TutorialPlaqueDefinition): THREE.Group {
  const group = new THREE.Group();
  group.position.set(plaque.x, plaque.y, plaque.z);
  group.rotation.y = plaque.facingYaw;

  const frame = createSculptedMesh('frame_tutorial_plaque', () =>
    buildSculptedWallFrameGeo(1.52, 1.12, 0x334155, 0xf59e0b, false)
  );
  group.add(frame);

  const tex = createTutorialBoardTexture(plaque.title, plaque.lines);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.92),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      emissive: 0x3b2f18,
      emissiveIntensity: 0.48,
      roughness: 0.72,
    })
  );
  art.position.z = 0.055;
  group.add(art);
  return group;
}

export function createSculptedCctvSecretSignVisual(
  x: number,
  y: number,
  z: number,
  code: string
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const frame = createSculptedMesh('frame_cctv_secret', () =>
    buildSculptedWallFrameGeo(1.58, 0.84, 0x1e293b, 0x22c55e, false)
  );
  group.add(frame);

  const tex = createCctvSecretSignTexture(code);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(1.36, 0.64),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      emissive: 0x16a34a,
      emissiveIntensity: 1.4,
      roughness: 0.35,
    })
  );
  art.position.z = 0.055;
  group.add(art);
  return group;
}

export function createSculptedSignPlate(
  cacheKey: string,
  widthM: number,
  heightM: number,
  title: string,
  subtitle: string,
  accentHex: string,
  bgHex: string,
  frameHex = 0x334155,
  bracketHex = 0x94a3b8
): THREE.Group {
  const group = new THREE.Group();
  const frame = createSculptedMesh(cacheKey, () =>
    buildSculptedWallFrameGeo(widthM, heightM, frameHex, bracketHex, true)
  );
  group.add(frame);

  const tex = createFacilitySignTexture(title, subtitle, accentHex, bgHex);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM - 0.18, heightM - 0.16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      emissive: 0x1e293b,
      emissiveIntensity: 0.42,
      roughness: 0.62,
    })
  );
  art.position.z = 0.055;
  group.add(art);
  return group;
}

// ============================================================================
// 4. 3D ARCHITECTURAL SURFACE RELIEF GEOMETRIES (FOR HorrorEngine InstancedMesh)
// ============================================================================

/**
 * Sculpted industrial ceiling trough fluorescent luminaire:
 * twin ceiling suspension rods, stepped ballast box, angled reflector hood, protruding glowing twin tubes!
 */
export function buildSculptedCeilingLuminaireGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(24, 10, 10, 0.038);
  // Twin ceiling mounting plates & hanger rods
  v.fillBox(4, 7, 4, 5, 9, 5, 0x475569, VoxelMat.Metal);
  v.fillBox(18, 7, 4, 19, 9, 5, 0x475569, VoxelMat.Metal);
  v.fillBox(3, 9, 3, 6, 9, 6, 0x334155, VoxelMat.Metal);
  v.fillBox(17, 9, 3, 20, 9, 6, 0x334155, VoxelMat.Metal);
  // Central ballast housing box + angled industrial reflector trough wings
  v.fillBeveledBox(2, 4, 2, 21, 6, 7, 0x334155, VoxelMat.Metal, 'horizontal');
  v.fillBox(1, 3, 1, 22, 4, 8, 0x64748b, VoxelMat.Metal);
  v.carveBox(2, 3, 2, 21, 3, 7);
  // End-cap socket tombstones
  v.fillBox(2, 1, 2, 3, 3, 7, 0x1e293b, VoxelMat.Matte);
  v.fillBox(20, 1, 2, 21, 3, 7, 0x1e293b, VoxelMat.Matte);
  // Twin protruding glowing fluorescent tubes
  v.fillBox(4, 1, 3, 19, 2, 3, 0xf8fafc, VoxelMat.Emissive);
  v.fillBox(4, 1, 6, 19, 2, 6, 0xe0f2fe, VoxelMat.Emissive);
  return v.build({ anchor: [12, 9, 5] }).geometry;
}

/**
 * Chamfered room-corner architectural column with stepped base plinth and ceiling capital molding.
 */
export function buildSculptedCornerColumnGeo(ceilH: number): THREE.BufferGeometry {
  const vs = 0.08;
  const sy = Math.max(28, Math.round(ceilH / vs));
  const v = new VoxelSculptor(6, sy, 6, vs);
  // Stepped base plinth
  v.fillBeveledBox(0, 0, 0, 5, 3, 5, 0x334155, VoxelMat.Matte, 'vertical');
  // Chamfered vertical pilaster shaft
  v.fillBeveledBox(1, 4, 1, 4, sy - 4, 4, 0x475569, VoxelMat.Matte, 'vertical');
  // Mid-height horizontal dado band & bolted collar
  const midY = Math.floor(sy * 0.42);
  v.fillBox(0, midY, 0, 5, midY + 1, 5, 0x334155, VoxelMat.Metal);
  // Stepped ceiling capital
  v.fillBeveledBox(0, sy - 3, 0, 5, sy - 1, 5, 0x334155, VoxelMat.Matte, 'vertical');
  return v.build({ anchor: [3, 0, 3] }).geometry;
}

/**
 * Recessed slotted cast-iron industrial floor drain grate (adds 3D micro-relief to corridors & basement!).
 */
export function buildSculptedFloorDrainGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(14, 2, 14, 0.042);
  // Outer bolted cast-iron flange rim
  v.fillBox(0, 0, 0, 13, 1, 13, 0x334155, VoxelMat.Metal);
  v.carveBox(2, 1, 2, 11, 1, 11);
  // Dark sunken pit floor underneath grate
  v.fillBox(2, 0, 2, 11, 0, 11, 0x05080d, VoxelMat.Matte);
  // Slotted iron grate bars
  for (let x = 3; x <= 10; x += 2) {
    v.fillBox(x, 1, 2, x, 1, 11, 0x475569, VoxelMat.Metal);
  }
  v.fillBox(2, 1, 6, 11, 1, 7, 0x475569, VoxelMat.Metal);
  // Corner hex bolts
  for (const [bx, bz] of [[1, 1], [12, 1], [1, 12], [12, 12]]) {
    v.set(bx, 1, bz, 0x94a3b8, VoxelMat.Metal);
  }
  return v.build({ anchor: [7, 0, 7] }).geometry;
}

/**
 * Stepped architectural baseboard molding segment (replaces flat BoxGeometry baseboard in HorrorEngine).
 */
export function buildSculptedBaseboardGeo(cellSize: number): THREE.BufferGeometry {
  const vs = 0.04;
  const sx = Math.max(20, Math.round(cellSize / vs));
  const v = new VoxelSculptor(sx, 5, 3, vs);
  // Bottom kick plinth (depth 3)
  v.fillBox(0, 0, 0, sx - 1, 1, 2, 0x2b1d12, VoxelMat.Matte);
  // Mid stepped molding (depth 2)
  v.fillBox(0, 2, 0, sx - 1, 3, 1, 0x3f2a1d, VoxelMat.Matte);
  // Upper quarter-round cap lip
  v.fillBox(0, 4, 0, sx - 1, 4, 0, 0x523726, VoxelMat.Matte);
  return v.build({ anchor: [sx * 0.5, 0, 0] }).geometry;
}

/**
 * Recessed industrial wall window frame with deep stepped sill, vertical security bars & frosted glass.
 */
export function buildSculptedRecessedWindowGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(22, 18, 5, 0.065);
  // Heavy outer concrete/steel casing
  v.fillBox(1, 2, 0, 20, 17, 3, 0x334155, VoxelMat.Matte);
  v.carveBox(3, 4, 1, 18, 15, 3);
  // Deep protruding beveled windowsill at bottom
  v.fillBeveledBox(0, 0, 0, 21, 2, 4, 0x475569, VoxelMat.Matte, 'top');
  // Recessed dusty moonlight-tinted glass pane
  v.fillBox(3, 4, 1, 18, 15, 1, 0x38bdf8, VoxelMat.Glass);
  // Iron mullion crossbars + security bars
  v.fillBox(3, 9, 2, 18, 10, 2, 0x1e293b, VoxelMat.Metal);
  for (const bx of [6, 10, 11, 15]) {
    v.fillBox(bx, 4, 2, bx, 15, 2, 0x1e293b, VoxelMat.Metal);
  }
  return v.build({ anchor: [11, 9, 0] }).geometry;
}

/**
 * Overhead perforated industrial cable tray with bundled copper/amber/black conduits
 * (instanced across corridors & subsolo ceilings for architectural depth).
 */
export function buildSculptedCableTrayGeo(lengthM = 2.0): THREE.BufferGeometry {
  const vs = 0.055;
  const sz = Math.max(24, Math.round(lengthM / vs));
  const v = new VoxelSculptor(10, 4, sz, vs);
  // Perforated galvanized steel side rails & cross rungs
  v.fillBox(0, 0, 0, 1, 3, sz - 1, 0x475569, VoxelMat.Metal);
  v.fillBox(8, 0, 0, 9, 3, sz - 1, 0x475569, VoxelMat.Metal);
  for (let z = 0; z < sz; z += 4) {
    v.fillBox(1, 0, z, 8, 0, z, 0x334155, VoxelMat.Metal);
  }
  // Insulated bundled power & data cables running inside the tray
  v.fillBox(2, 1, 0, 3, 2, sz - 1, 0x1e293b, VoxelMat.Fabric);
  v.fillBox(4, 1, 0, 5, 1, sz - 1, 0xb45309, VoxelMat.Matte);
  v.fillBox(6, 1, 0, 7, 2, sz - 1, 0x0f766e, VoxelMat.Matte);
  // Ceiling hanger brackets at both ends
  v.fillBox(0, 3, 2, 0, 3, 3, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(9, 3, 2, 9, 3, 3, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(0, 3, sz - 4, 0, 3, sz - 3, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(9, 3, sz - 4, 9, 3, sz - 3, 0x94a3b8, VoxelMat.Metal);
  return v.build({ anchor: [5, 3, sz * 0.5] }).geometry;
}

/**
 * Recessed architectural wall wainscoting / structural relief panel (instanced on corridor walls).
 */
export function buildSculptedWallPanelGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(22, 16, 3, 0.072);
  // Outer beveled steel/concrete frame
  v.fillBeveledBox(0, 0, 0, 21, 15, 2, 0x334155, VoxelMat.Matte, 'horizontal');
  // Recessed center coffer
  v.carveBox(2, 2, 2, 19, 13, 2);
  v.fillBox(2, 2, 1, 19, 13, 1, 0x263142, VoxelMat.Matte);
  // Inner horizontal dado molding bar & corner rivets
  v.fillBox(2, 6, 1, 19, 7, 2, 0x475569, VoxelMat.Metal);
  for (const [rx, ry] of [[1, 1], [20, 1], [1, 14], [20, 14]]) {
    v.set(rx, ry, 2, 0x94a3b8, VoxelMat.Metal);
  }
  return v.build({ anchor: [11, 8, 0] }).geometry;
}

/**
 * High-Density Micro-Voxel Industrial Wall Light Switch & Conduit Assembly
 * (replaces old 5-BoxGeometry switch with beveled cast-iron housing, corner bolts,
 * protective rocker guard rails, clamped conduit riser, pivoting lever & emissive LED).
 */
export function createSculptedWallLightSwitchVisual(sw: {
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  isOn: boolean;
}): {
  group: THREE.Group;
  lever: THREE.Mesh;
  ledMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  group.position.set(sw.x, sw.y, sw.z);
  group.rotation.y = sw.facingYaw;

  const bodyMesh = createSculptedMesh('arch_wall_light_switch_v2', () => {
    const v = new VoxelSculptor(14, 34, 6, 0.018);
    // Cast-iron beveled breaker enclosure box (y=0..18)
    v.fillBeveledBox(1, 0, 0, 12, 18, 3, 0x475569, VoxelMat.Metal, 'vertical');
    // Recessed faceplate & dark gasket lip
    v.fillBox(2, 2, 3, 11, 16, 4, 0x1e293b, VoxelMat.Metal);
    v.carveBox(4, 4, 4, 9, 11, 4);
    v.fillBox(4, 4, 3, 9, 11, 3, 0x0f172a, VoxelMat.Matte);
    // Side protective switch guard rails
    v.fillBox(3, 4, 4, 3, 11, 5, 0x64748b, VoxelMat.Metal);
    v.fillBox(10, 4, 4, 10, 11, 5, 0x64748b, VoxelMat.Metal);
    // Hazard yellow caution label strip along bottom bevel
    v.fillBox(3, 1, 4, 10, 1, 4, 0xd97706, VoxelMat.Matte);
    v.set(5, 1, 4, 0x1e293b, VoxelMat.Matte);
    v.set(8, 1, 4, 0x1e293b, VoxelMat.Matte);
    // Corner hex mounting screws
    for (const [bx, by] of [[2, 2], [11, 2], [2, 16], [11, 16]]) {
      v.set(bx, by, 4, 0xcbd5e1, VoxelMat.Metal);
    }
    // LED lens bezel housing at y=13..15
    v.fillBox(5, 13, 4, 8, 15, 4, 0x334155, VoxelMat.Metal);
    // Top steel conduit gland nut & vertical steel conduit pipe with wall clamp collars
    v.fillBox(5, 18, 1, 8, 19, 3, 0x64748b, VoxelMat.Metal);
    v.fillBox(6, 19, 1, 7, 33, 2, 0x475569, VoxelMat.Metal);
    for (const cy of [23, 29]) {
      v.fillBox(4, cy, 0, 9, cy + 1, 3, 0x94a3b8, VoxelMat.Metal);
    }
    return v.build({ anchor: [7, 9, 0] }).geometry;
  });
  group.add(bodyMesh);

  // Pivoting micro-voxel breaker lever handle
  const leverGeo = getCachedSculptedGeometry('arch_wall_switch_lever_v2', () => {
    const lv = new VoxelSculptor(6, 7, 6, 0.015);
    lv.fillBox(2, 2, 0, 3, 4, 3, 0x94a3b8, VoxelMat.Metal);
    lv.fillBeveledBox(0, 1, 3, 5, 5, 5, 0xcbd5e1, VoxelMat.Metal, 'all');
    lv.fillBox(1, 2, 5, 4, 4, 5, 0xd97706, VoxelMat.Matte);
    return lv.build({ anchor: [3, 3, 0] }).geometry;
  });
  const lever = new THREE.Mesh(leverGeo, getSharedSculptedMaterials());
  lever.position.set(0, -0.025, 0.064);
  lever.rotation.x = sw.isOn ? -0.45 : 0.45;
  group.add(lever);

  const ledMat = new THREE.MeshStandardMaterial({
    color: sw.isOn ? 0x4ade80 : 0xef4444,
    emissive: sw.isOn ? 0x22c55e : 0xdc2626,
    emissiveIntensity: 2.1,
    roughness: 0.18,
  });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.022), ledMat);
  led.position.set(0, 0.09, 0.082);
  group.add(led);

  return { group, lever, ledMat };
}

// ============================================================================
// 5. LIVING ENVIRONMENT PROPS & DIRTY CRACKED REFLECTIVE GLASS WINDOWS
// ============================================================================

/**
 * Animated Industrial Ceiling or Desk Fan (rotating blades + sculpted motor housing & safety cage).
 */
export function createSculptedAnimatedFanVisual(kind: 'ceiling' | 'desk'): {
  group: THREE.Group;
  bladePivot: THREE.Group;
} {
  const group = new THREE.Group();
  const bladePivot = new THREE.Group();

  if (kind === 'ceiling') {
    const mount = createSculptedMesh('living_ceiling_fan_mount_v1', () => {
      const v = new VoxelSculptor(14, 16, 14, 0.036);
      // Ceiling canopy & bolted flange
      v.fillCylinderY(6.5, 13, 15, 6.5, 3.4, 0x334155, VoxelMat.Metal);
      // Vertical steel downrod
      v.fillCylinderY(6.5, 5, 13, 6.5, 1.1, 0x475569, VoxelMat.Metal);
      // Heavy louvered motor drum
      v.fillCylinderY(6.5, 1, 6, 6.5, 4.8, 0x3f4c5e, VoxelMat.Metal);
      v.fillCylinderY(6.5, 2, 5, 6.5, 5.2, 0x1e293b, VoxelMat.Metal, 4.4);
      // Bottom brass finial cap
      v.fillCylinderY(6.5, 0, 1, 6.5, 2.0, 0xb45309, VoxelMat.Metal);
      return v.build({ anchor: [7, 16, 7] }).geometry;
    });
    group.add(mount);

    const blades = createSculptedMesh('living_ceiling_fan_blades_v1', () => {
      const v = new VoxelSculptor(32, 4, 32, 0.044);
      // Central hub collar
      v.fillCylinderY(15.5, 1, 2, 15.5, 3.2, 0x475569, VoxelMat.Metal);
      // 4 sculpted pitched industrial steel blades with mounting arms
      v.fillBox(14, 1, 2, 17, 2, 12, 0x334155, VoxelMat.Metal);
      v.fillBox(15, 2, 3, 16, 2, 11, 0x475569, VoxelMat.Metal);
      v.fillBox(14, 1, 19, 17, 2, 29, 0x334155, VoxelMat.Metal);
      v.fillBox(15, 2, 20, 16, 2, 28, 0x475569, VoxelMat.Metal);
      v.fillBox(2, 1, 14, 12, 2, 17, 0x334155, VoxelMat.Metal);
      v.fillBox(3, 2, 15, 11, 2, 16, 0x475569, VoxelMat.Metal);
      v.fillBox(19, 1, 14, 29, 2, 17, 0x334155, VoxelMat.Metal);
      v.fillBox(20, 2, 15, 28, 2, 16, 0x475569, VoxelMat.Metal);
      // Worn yellow tip accents
      v.fillBox(14, 1, 2, 17, 2, 3, 0xb45309, VoxelMat.Matte);
      v.fillBox(14, 1, 28, 17, 2, 29, 0xb45309, VoxelMat.Matte);
      v.fillBox(2, 1, 14, 3, 2, 17, 0xb45309, VoxelMat.Matte);
      v.fillBox(28, 1, 14, 29, 2, 17, 0xb45309, VoxelMat.Matte);
      return v.build({ anchor: [16, 1.5, 16] }).geometry;
    });
    bladePivot.position.set(0, -0.44, 0);
    bladePivot.add(blades);
    group.add(bladePivot);
  } else {
    // Vintage Guardhouse Desk Fan (Cabine 09-A homage!)
    const body = createSculptedMesh('living_desk_fan_body_v1', () => {
      const v = new VoxelSculptor(16, 18, 14, 0.024);
      // Heavy cast-iron base + push buttons
      v.fillBeveledBox(2, 0, 2, 13, 2, 11, 0x1e293b, VoxelMat.Metal, 'top');
      v.set(5, 2, 10, 0xef4444, VoxelMat.Matte);
      v.set(7, 2, 10, 0x94a3b8, VoxelMat.Metal);
      v.set(9, 2, 10, 0x94a3b8, VoxelMat.Metal);
      // Neck stem + motor rear housing
      v.fillBox(6, 2, 5, 9, 8, 7, 0x334155, VoxelMat.Metal);
      v.fillCylinderZ(7.5, 11, 2, 7, 2.8, 0x1f2937, VoxelMat.Metal);
      // Protective circular wire cage ring
      v.fillCylinderZ(7.5, 11, 8, 10, 6.2, 0x475569, VoxelMat.Metal, 5.2);
      v.fillBox(7, 5, 11, 8, 17, 11, 0x64748b, VoxelMat.Metal);
      v.fillBox(2, 11, 11, 13, 12, 11, 0x64748b, VoxelMat.Metal);
      return v.build({ anchor: [8, 0, 7] }).geometry;
    });
    group.add(body);

    const deskBlades = createSculptedMesh('living_desk_fan_blades_v1', () => {
      const v = new VoxelSculptor(12, 12, 3, 0.022);
      v.fillBox(5, 5, 0, 6, 6, 2, 0x94a3b8, VoxelMat.Metal);
      v.fillBox(5, 1, 1, 6, 4, 1, 0x334155, VoxelMat.Metal);
      v.fillBox(5, 7, 1, 6, 10, 1, 0x334155, VoxelMat.Metal);
      v.fillBox(1, 5, 1, 4, 6, 1, 0x334155, VoxelMat.Metal);
      v.fillBox(7, 5, 1, 10, 6, 1, 0x334155, VoxelMat.Metal);
      return v.build({ anchor: [6, 6, 1.5] }).geometry;
    });
    bladePivot.position.set(0, 0.265, 0.045);
    bladePivot.add(deskBlades);
    group.add(bladePivot);
  }

  return { group, bladePivot };
}

/**
 * Ticking Institutional Wall Clock with sculpted brass-rimmed dial and animated second/minute hands.
 */
export function createSculptedWallClockVisual(): {
  group: THREE.Group;
  minuteHand: THREE.Group;
  secondHand: THREE.Group;
} {
  const group = new THREE.Group();
  const housing = createSculptedMesh('living_wall_clock_v1', () => {
    const v = new VoxelSculptor(16, 16, 4, 0.026);
    // Outer industrial dark steel octagonal rim
    v.fillCylinderZ(7.5, 7.5, 0, 2, 7.4, 0x1e293b, VoxelMat.Metal);
    v.fillCylinderZ(7.5, 7.5, 2, 3, 7.2, 0x475569, VoxelMat.Metal, 5.8);
    // Aged cream institutional clock face
    v.fillCylinderZ(7.5, 7.5, 1, 2, 5.8, 0xd6d3c4, VoxelMat.Matte);
    // 12/3/6/9 hour markers + brass center pin
    v.fillBox(7, 12, 2, 8, 13, 2, 0x0f172a, VoxelMat.Matte);
    v.fillBox(7, 2, 2, 8, 3, 2, 0x0f172a, VoxelMat.Matte);
    v.fillBox(2, 7, 2, 3, 8, 2, 0x0f172a, VoxelMat.Matte);
    v.fillBox(12, 7, 2, 13, 8, 2, 0x0f172a, VoxelMat.Matte);
    v.set(7, 7, 3, 0xb45309, VoxelMat.Metal);
    // Dust-hazed front glass
    v.fillCylinderZ(7.5, 7.5, 3, 3, 5.7, 0x94a3b8, VoxelMat.Glass);
    return v.build({ anchor: [8, 8, 0] }).geometry;
  });
  group.add(housing);

  const handMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
  const secMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });

  const minuteHand = new THREE.Group();
  minuteHand.position.set(0, 0, 0.066);
  const mBar = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.125, 0.008), handMat);
  mBar.position.y = 0.052;
  minuteHand.add(mBar);
  group.add(minuteHand);

  const secondHand = new THREE.Group();
  secondHand.position.set(0, 0, 0.072);
  const sBar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.14, 0.006), secMat);
  sBar.position.y = 0.058;
  secondHand.add(sBar);
  group.add(secondHand);

  return { group, minuteHand, secondHand };
}

/**
 * Omega Project Blinking Server / Telemetry Rack (sequential blinking LEDs + sculpted louvered cabinet).
 */
export function createSculptedServerRackVisual(): {
  group: THREE.Group;
  ledMats: THREE.MeshStandardMaterial[];
} {
  const group = new THREE.Group();
  const rack = createSculptedMesh('living_server_rack_v1', () => {
    const v = new VoxelSculptor(16, 32, 14, 0.056);
    // Heavy riveted steel cabinet chassis
    v.fillBeveledBox(0, 0, 0, 15, 31, 13, 0x1e293b, VoxelMat.Metal, 'vertical');
    // Recessed front rack bay
    v.carveBox(2, 2, 11, 13, 29, 13);
    v.fillBox(2, 2, 10, 13, 29, 11, 0x0f172a, VoxelMat.Metal);
    // Individual 2U/4U server blades with ventilation grilles & handles
    for (let y = 3; y <= 27; y += 4) {
      v.fillBox(2, y, 11, 13, y + 2, 12, 0x334155, VoxelMat.Metal);
      v.fillBox(4, y + 1, 12, 11, y + 1, 12, 0x0b1120, VoxelMat.Matte);
      // Rack pull handles
      v.fillBox(2, y, 13, 2, y + 2, 13, 0x94a3b8, VoxelMat.Metal);
      v.fillBox(13, y, 13, 13, y + 2, 13, 0x94a3b8, VoxelMat.Metal);
    }
    // Side louvered cooling vents
    v.carveLouvers(0, 6, 3, 0, 26, 10, 3);
    v.carveLouvers(15, 6, 3, 15, 26, 10, 3);
    // Overhead braided power conduit rising from top
    v.fillBox(6, 31, 4, 9, 31, 7, 0x475569, VoxelMat.Metal);
    // Copper patch cables along left rail
    v.fillLine(3, 5, 12, 3, 25, 12, 0xb45309, VoxelMat.Matte, 0);
    return v.build({ anchor: [8, 0, 7] }).geometry;
  });
  group.add(rack);

  const ledColors = [0x22c55e, 0x38bdf8, 0xf59e0b, 0xef4444, 0x22c55e, 0x38bdf8];
  const ledMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const col = ledColors[i];
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    ledMats.push(mat);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 0.025), mat);
    led.position.set(-0.22 + (i % 3) * 0.14, 0.34 + i * 0.24, 0.365);
    group.add(led);
  }

  return { group, ledMats };
}

/**
 * Gently Swaying Biohazard Quarantine Plastic Tarp Curtain (high overhead rail + swaying strips).
 */
export function createSculptedSwayingTarpVisual(): {
  group: THREE.Group;
  swayPivot: THREE.Group;
} {
  const group = new THREE.Group();
  const rail = createSculptedMesh('living_tarp_rail_v1', () => {
    const v = new VoxelSculptor(22, 4, 4, 0.06);
    v.fillBox(0, 2, 1, 21, 3, 2, 0x475569, VoxelMat.Metal);
    for (let x = 2; x <= 19; x += 4) {
      v.fillBox(x, 0, 1, x + 1, 2, 2, 0x94a3b8, VoxelMat.Metal);
    }
    return v.build({ anchor: [11, 3, 2] }).geometry;
  });
  group.add(rail);

  const swayPivot = new THREE.Group();
  swayPivot.position.set(0, -0.08, 0);
  const curtain = createSculptedMesh('living_tarp_curtain_v1', () => {
    const v = new VoxelSculptor(20, 22, 3, 0.062);
    // 4 heavy semi-translucent industrial quarantine tarp strips with ragged hems & warning stripe
    for (let s = 0; s < 4; s++) {
      const x0 = s * 5;
      const x1 = x0 + 3;
      const bottomY = s % 2 === 0 ? 0 : 2;
      v.fillBox(x0, bottomY, 1, x1, 21, 1, 0x8fa89b, VoxelMat.Glass);
      // Hazard yellow/black tape band across mid-strip
      v.fillBox(x0, 9, 1, x1, 10, 1, s % 2 === 0 ? 0xd97706 : 0x1e293b, VoxelMat.Fabric);
      // Reinforced upper grommet header
      v.fillBox(x0, 20, 0, x1, 21, 2, 0x334155, VoxelMat.Fabric);
    }
    return v.build({ anchor: [10, 21, 1.5] }).geometry;
  });
  swayPivot.add(curtain);
  group.add(swayPivot);

  return { group, swayPivot };
}

/**
 * Dirty, Cracked, Reflective Partition Window (Guardhouse Cabine 09-A observation glass, Infirmary, Display Cases).
 * Uses optimized MeshStandardMaterial (transparent + PMREM envMapIntensity + 32x32 procedural grime/cracks,
 * ZERO heavy physical transmission!) so P. Drizzy's silhouette is visibly seen passing behind the glass!
 */
export function createSculptedDirtyGlassWindowVisual(
  widthM: number,
  heightM: number,
  pack: MaterialPack
): THREE.Group {
  const group = new THREE.Group();
  const vs = 0.065;
  const sx = Math.max(14, Math.round(widthM / vs));
  const sy = Math.max(12, Math.round(heightM / vs));
  const cacheKey = `arch_dirty_glass_frame_${sx}x${sy}_v1`;

  const frame = createSculptedMesh(cacheKey, () => {
    const v = new VoxelSculptor(sx, sy, 5, vs);
    // Outer deep steel frame with stepped sill & lintel
    v.fillBox(0, 0, 0, sx - 1, sy - 1, 3, 0x2a3444, VoxelMat.Metal);
    v.carveBox(2, 2, 0, sx - 3, sy - 3, 3);
    // Protruding beveled lower sill
    v.fillBeveledBox(0, 0, 0, sx - 1, 1, 4, 0x475569, VoxelMat.Metal, 'top');
    // Center structural mullion bar + corner rivets
    const midX = Math.floor(sx * 0.5);
    v.fillBox(midX, 2, 1, midX, sy - 3, 2, 0x334155, VoxelMat.Metal);
    for (const [rx, ry] of [[1, 1], [sx - 2, 1], [1, sy - 2], [sx - 2, sy - 2]]) {
      v.set(rx, ry, 3, 0x94a3b8, VoxelMat.Metal);
    }
    return v.build({ anchor: [sx * 0.5, sy * 0.5, 2] }).geometry;
  });
  group.add(frame);

  // Optimized dirty, cracked, reflective glass pane (ZERO transmission!)
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xcfe8f7,
    map: pack.dirtyGlassMap,
    alphaMap: pack.dirtyGlassAlphaMap,
    transparent: true,
    opacity: 0.92,
    roughness: 0.11,
    metalness: 0.18,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(0.4, widthM - 0.24), Math.max(0.4, heightM - 0.24)),
    glassMat
  );
  pane.renderOrder = 2;
  group.add(pane);

  return group;
}

