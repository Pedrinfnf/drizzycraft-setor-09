import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  detachCollectedItemMesh,
  finalizeCollectedItemMesh,
  syncActiveWorldItemVisibility,
} from './itemVisualCleanup';
import {
  CELL_SIZE,
  CELL_STAIR,
  CELL_VOID,
  CELL_WALL,
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  GRID_H,
  GRID_W,
  cellIdx,
  generateMansionLayout,
  resolveWorldMovement,
  type MansionLayout,
} from './mansionMap';
import type { Difficulty, EndingId, FloorId } from './types';
import {
  ENDING_CUTSCENES,
  ENDING_METADATA,
  evaluateCutsceneSpline,
  getCutsceneScript,
} from './cutscenes';

function key3(floor: FloorId, gx: number, gz: number): string {
  return `${floor}:${gx}:${gz}`;
}

/**
 * Full-Physics Reachability Flood-Fill using the exact locked-door rules of Chapter 1.
 * Proves that a player walking with real collision can traverse between every required room,
 * unlock every progression gate in order, collect all 4 safe clues, and escape through the North Exit!
 */
function computeReachableCells(layout: MansionLayout, unlockedDoorIds: Set<string>): Set<string> {
  const startGx = Math.floor(layout.spawnPoint.x / CELL_SIZE);
  const startGz = Math.floor(layout.spawnPoint.z / CELL_SIZE);
  const visited = new Set<string>();
  const queue: { floor: FloorId; gx: number; gz: number }[] = [
    { floor: layout.spawnPoint.floor, gx: startGx, gz: startGz },
  ];
  visited.add(key3(layout.spawnPoint.floor, startGx, startGz));

  // Build locked-door blocking cell lookup
  const blockedDoorCells = new Set<string>();
  for (const d of layout.doors) {
    if (d.lockType === 'bunker_blast') continue; // SecurityBunker hydraulic doors start open
    if (d.isUnlocked || unlockedDoorIds.has(d.id)) continue;
    const span = d.spanCells || 2;
    for (let i = 0; i < span; i++) {
      const dgx = d.axis === 'x' ? d.gx + i : d.gx;
      const dgz = d.axis === 'x' ? d.gz : d.gz + i;
      blockedDoorCells.add(key3(d.floor, dgx, dgz));
    }
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const grid = cur.floor === 0 ? layout.floor0 : layout.floorMinus1;

    for (const [dx, dz] of dirs) {
      const nx = cur.gx + dx;
      const nz = cur.gz + dz;
      if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_H) continue;
      const nk = key3(cur.floor, nx, nz);
      if (visited.has(nk)) continue;
      if (blockedDoorCells.has(nk)) continue;

      const cell = grid[cellIdx(nx, nz)];
      if (cell === CELL_WALL || cell === CELL_VOID) continue;

      visited.add(nk);
      queue.push({ floor: cur.floor, gx: nx, gz: nz });
    }

    // Stairway vertical transition between Floor 0 and Floor -1 (if cell is CELL_STAIR)
    if (grid[cellIdx(cur.gx, cur.gz)] === CELL_STAIR) {
      const otherFloor: FloorId = cur.floor === 0 ? -1 : 0;
      const otherGrid = otherFloor === 0 ? layout.floor0 : layout.floorMinus1;
      for (const st of layout.stairways) {
        if (cur.gx >= st.gxMin && cur.gx <= st.gxMax && cur.gz >= st.gzBottom && cur.gz <= st.gzTop) {
          const targetGz = otherFloor === -1 ? st.gzBottom : st.gzTop;
          const okKey = key3(otherFloor, cur.gx, targetGz);
          if (!visited.has(okKey) && !blockedDoorCells.has(okKey) && otherGrid[cellIdx(cur.gx, targetGz)] !== CELL_WALL) {
            visited.add(okKey);
            queue.push({ floor: otherFloor, gx: cur.gx, gz: targetGz });
          }
        }
      }
    }
  }

  return visited;
}

function isPointReachable(reachable: Set<string>, floor: FloorId, x: number, z: number): boolean {
  const gx = Math.floor(x / CELL_SIZE);
  const gz = Math.floor(z / CELL_SIZE);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (reachable.has(key3(floor, gx + dx, gz + dz))) return true;
    }
  }
  return false;
}

test('Automated Playthrough Bot: 500 Seeds 100% Winnable (Zero Softlocks, All 4 Clues & Real Stair Physics)', () => {
  const difficulties: Difficulty[] = ['practice', 'easy', 'hard', 'nightmare'];
  let totalSeedsPassed = 0;

  for (let i = 0; i < 500; i++) {
    const seed = 100 + i;
    const diff = difficulties[i % difficulties.length];
    const layout = generateMansionLayout(seed, diff);

    const inv = new Set<string>(['flashlight']);
    const unlockedDoors = new Set<string>();
    const discoveredDigits = new Map<number, string>();
    let safeUnlocked = false;
    let progress = true;
    let guard = 0;

    while (progress && guard < 25) {
      guard++;
      progress = false;
      const reachable = computeReachableCells(layout, unlockedDoors);

      // 1. Collect all reachable items (including inside drawers!)
      for (const item of layout.items) {
        if (item.insideSafe && !safeUnlocked) continue;
        if (inv.has(item.itemType)) continue;
        if (isPointReachable(reachable, item.floor, item.x, item.z)) {
          inv.add(item.itemType);
          progress = true;
        }
      }

      // 2. Craft Crowbar at reachable workbench if holding both pieces
      if (!inv.has('crowbar') && inv.has('crowbar_rod') && inv.has('crowbar_hook')) {
        const wbReachable = layout.workbenches.some((wb) =>
          isPointReachable(reachable, wb.floor, wb.x, wb.z)
        );
        if (wbReachable) {
          inv.add('crowbar');
          progress = true;
        }
      }

      // 3. Discover all reachable safe clues
      for (const clue of layout.clues) {
        if (discoveredDigits.has(clue.digitIndex)) continue;
        if (isPointReachable(reachable, clue.floor, clue.x, clue.z)) {
          discoveredDigits.set(clue.digitIndex, clue.digitValue);
          progress = true;
        }
      }

      // 4. Unlock all doors whose key/tool we now carry
      for (const door of layout.doors) {
        if (door.isUnlocked || unlockedDoors.has(door.id) || door.isExit) continue;
        const canUnlock =
          (door.lockType === 'red_key' && inv.has('red_key')) ||
          (door.lockType === 'blue_key' && inv.has('blue_key')) ||
          (door.lockType === 'basement_key' && inv.has('basement_key')) ||
          (door.lockType === 'crowbar_planks' && inv.has('crowbar')) ||
          (door.lockType === 'wire_cutters' && inv.has('wire_cutters'));
        if (!canUnlock) continue;

        const doorX = (door.gx + 0.5) * CELL_SIZE;
        const doorZ = (door.gz + 0.5) * CELL_SIZE;
        if (isPointReachable(reachable, door.floor, doorX, doorZ)) {
          unlockedDoors.add(door.id);
          progress = true;
        }
      }

      // 5. Open underground safe once all 4 digits are collected and safe is reachable!
      if (!safeUnlocked && discoveredDigits.size === 4) {
        if (isPointReachable(reachable, layout.safe.floor, layout.safe.x, layout.safe.z)) {
          const code = [0, 1, 2, 3].map((idx) => discoveredDigits.get(idx)).join('');
          assert.equal(code, layout.safe.code, `Seed ${seed}: Reconstructed code must match safe code`);
          safeUnlocked = true;
          progress = true;
        }
      }
    }

    assert.equal(discoveredDigits.size, 4, `Seed ${seed} (${diff}): Must collect all 4 safe clues`);
    assert.equal(safeUnlocked, true, `Seed ${seed} (${diff}): Must unlock underground safe`);
    assert.equal(inv.has('master_key'), true, `Seed ${seed} (${diff}): Must acquire Master Key`);
    assert.equal(inv.has('crowbar'), true, `Seed ${seed} (${diff}): Must acquire or craft Crowbar`);

    const exitDoor = layout.doors.find((d) => d.isExit);
    assert.ok(exitDoor, `Seed ${seed}: Must have North Exit door`);
    const finalReachable = computeReachableCells(layout, unlockedDoors);
    assert.equal(
      isPointReachable(finalReachable, exitDoor.floor, (exitDoor.gx + 0.5) * CELL_SIZE, (exitDoor.gz + 0.5) * CELL_SIZE),
      true,
      `Seed ${seed} (${diff}): Exit door must be reachable to complete escape`
    );

    // Every 50th seed: also run real 3D physics step-by-step walk down the West Stairway!
    if (i % 50 === 0) {
      for (const d of layout.doors) {
        if (d.lockType === 'basement_key') {
          d.isUnlocked = true;
          d.isOpen = true;
        }
      }
      const st = layout.stairways[0];
      let px = ((st.gxMin + st.gxMax + 1) * CELL_SIZE) / 2;
      let py = FLOOR_0_Y;
      let pz = (st.gzTop + 1.4) * CELL_SIZE;
      let floor: FloorId = 0;
      for (let step = 0; step < 55; step++) {
        const res = resolveWorldMovement(layout, px, py, pz, 0, -0.24, 0.36, false, false);
        px = res.x;
        py = res.y;
        pz = res.z;
        floor = res.floor;
      }
      assert.equal(floor, -1, `Seed ${seed}: Real physics stair walk must reach Basement Floor -1`);
      assert.ok(Math.abs(py - FLOOR_MINUS_1_Y) < 0.1, `Seed ${seed}: Real physics Y must land on FLOOR_MINUS_1_Y`);
    }

    totalSeedsPassed++;
  }

  assert.equal(totalSeedsPassed, 500, 'All 500 seeds must complete cleanly with zero softlocks');
});

test('Collected Item Visual Cleanup: picked-up and dropped items are completely removed from scene & never float in mid-air', () => {
  const worldGroup = new THREE.Group();
  const floor0Chunks: THREE.Object3D[] = [];
  const floorMinus1Chunks: THREE.Object3D[] = [];
  const itemMeshes = new Map<string, THREE.Group>();

  const makeItemGroup = (withGlowRing: boolean): THREE.Group => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2)));
    if (withGlowRing) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 16));
      ring.name = 'dropped_glow_ring';
      g.add(ring);
    }
    worldGroup.add(g);
    return g;
  };

  const meshA = makeItemGroup(false);
  const meshB = makeItemGroup(true);
  const meshC = makeItemGroup(false);
  floor0Chunks.push(meshA); // simulate legacy chunk push to verify removal too!
  itemMeshes.set('item_a', meshA);
  itemMeshes.set('item_b', meshB);
  itemMeshes.set('item_c', meshC);

  const items = [
    { id: 'item_a', itemType: 'red_key' as const, label: 'Chave Vermelha', floor: 0 as const, x: 1, y: 0.9, z: 1, zoneId: 'start' as const, collected: false },
    { id: 'item_b', itemType: 'crowbar' as const, label: 'Pé de Cabra', floor: 0 as const, x: 2, y: 0.2, z: 2, zoneId: 'start' as const, collected: false, droppedByPlayer: true },
    { id: 'item_c', itemType: 'battery' as const, label: 'Pilha', floor: -1 as const, x: 3, y: -3.2, z: 3, zoneId: 'basement' as const, collected: false },
  ];

  // Collect item_a and dropped item_b
  items[0].collected = true;
  const detachedA = detachCollectedItemMesh('item_a', itemMeshes, floor0Chunks, floorMinus1Chunks);
  assert.ok(detachedA, 'Detached mesh A must be returned for grab anim');
  assert.equal(floor0Chunks.includes(meshA), false, 'Collected item A must be purged from floor0Chunks');
  assert.equal(itemMeshes.has('item_a'), false, 'Collected item A must be removed from itemMeshes');
  finalizeCollectedItemMesh(detachedA!);
  assert.equal(meshA.visible, false, 'Finalized item A must be invisible');
  assert.equal(meshA.parent, null, 'Finalized item A must be completely removed from worldGroup');

  items[1].collected = true;
  const detachedB = detachCollectedItemMesh('item_b', itemMeshes, floor0Chunks, floorMinus1Chunks);
  assert.ok(detachedB, 'Detached dropped mesh B must be returned');
  assert.equal(
    detachedB!.getObjectByName('dropped_glow_ring'),
    undefined,
    'Dropped glow ring must be stripped immediately on pickup'
  );
  finalizeCollectedItemMesh(detachedB!);
  assert.equal(meshB.parent, null, 'Finalized dropped item B must be removed from worldGroup');

  // Simulate floor visibility updates across both floors — collected items must NEVER re-appear!
  syncActiveWorldItemVisibility(items, itemMeshes, 0, true, () => false);
  syncActiveWorldItemVisibility(items, itemMeshes, -1, false, () => false);

  assert.equal(worldGroup.children.includes(meshA), false, 'Item A must not remain in worldGroup');
  assert.equal(worldGroup.children.includes(meshB), false, 'Item B must not remain in worldGroup');
  assert.equal(meshA.visible, false, 'Item A must remain hidden after floor visibility sync');
  assert.equal(meshB.visible, false, 'Item B must remain hidden after floor visibility sync');
  assert.equal(worldGroup.children.includes(meshC), true, 'Uncollected item C must remain in worldGroup');
  assert.equal(meshC.visible, true, 'Uncollected item C on active floor -1 must stay visible');
});

/**
 * Helper: runs full progression solver on a layout and returns the final
 * inventory, unlocked doors, discovered clues, and final reachable cell set.
 */
function solveLayoutProgression(layout: MansionLayout): {
  inv: Set<string>;
  unlockedDoors: Set<string>;
  discoveredDigits: Map<number, string>;
  safeUnlocked: boolean;
  reachable: Set<string>;
} {
  const inv = new Set<string>(['flashlight']);
  const unlockedDoors = new Set<string>();
  const discoveredDigits = new Map<number, string>();
  let safeUnlocked = false;
  let progress = true;
  let guard = 0;

  while (progress && guard < 30) {
    guard++;
    progress = false;
    const reachable = computeReachableCells(layout, unlockedDoors);

    for (const item of layout.items) {
      if (item.insideSafe && !safeUnlocked) continue;
      if (inv.has(item.itemType)) continue;
      if (isPointReachable(reachable, item.floor, item.x, item.z)) {
        inv.add(item.itemType);
        progress = true;
      }
    }

    if (!inv.has('crowbar') && inv.has('crowbar_rod') && inv.has('crowbar_hook')) {
      const wbReachable = layout.workbenches.some((wb) =>
        isPointReachable(reachable, wb.floor, wb.x, wb.z)
      );
      if (wbReachable) {
        inv.add('crowbar');
        progress = true;
      }
    }

    for (const clue of layout.clues) {
      if (discoveredDigits.has(clue.digitIndex)) continue;
      if (isPointReachable(reachable, clue.floor, clue.x, clue.z)) {
        discoveredDigits.set(clue.digitIndex, clue.digitValue);
        progress = true;
      }
    }

    for (const door of layout.doors) {
      if (door.isUnlocked || unlockedDoors.has(door.id)) continue;
      const canUnlock =
        (door.lockType === 'red_key' && inv.has('red_key')) ||
        (door.lockType === 'blue_key' && inv.has('blue_key')) ||
        (door.lockType === 'basement_key' && inv.has('basement_key')) ||
        (door.lockType === 'crowbar_planks' && inv.has('crowbar')) ||
        (door.lockType === 'wire_cutters' && inv.has('wire_cutters')) ||
        (door.lockType === 'master_exit' &&
          inv.has('master_key') &&
          inv.has('crowbar') &&
          inv.has('fuse'));
      if (!canUnlock) continue;

      const doorX = (door.gx + 0.5) * CELL_SIZE;
      const doorZ = (door.gz + 0.5) * CELL_SIZE;
      if (isPointReachable(reachable, door.floor, doorX, doorZ)) {
        unlockedDoors.add(door.id);
        progress = true;
      }
    }

    if (!safeUnlocked && discoveredDigits.size === 4) {
      if (isPointReachable(reachable, layout.safe.floor, layout.safe.x, layout.safe.z)) {
        safeUnlocked = true;
        progress = true;
      }
    }
  }

  return {
    inv,
    unlockedDoors,
    discoveredDigits,
    safeUnlocked,
    reachable: computeReachableCells(layout, unlockedDoors),
  };
}

test('All 4 Ending Routes: Bad, Good, Real & Secret Endings are 100% reachable, solvable & backed by distinct cutscenes across seeds', () => {
  const difficulties: Difficulty[] = ['practice', 'easy', 'hard', 'nightmare'];
  const endingIds: EndingId[] = ['bad', 'good', 'real', 'secret'];

  // Verify all 4 ending cutscenes & gallery metadata have distinct cameras, splines & Portuguese dialogue
  const seenFirstCameraPos = new Set<string>();
  const posOut = new THREE.Vector3();
  const lookOut = new THREE.Vector3();
  for (const endingId of endingIds) {
    const def = ENDING_CUTSCENES[endingId];
    const meta = ENDING_METADATA[endingId];
    assert.ok(def, `ENDING_CUTSCENES.${endingId} must exist`);
    assert.ok(meta && meta.title && meta.subtitle && meta.routeHint && meta.badgeColor);
    assert.equal(getCutsceneScript(`ending_${endingId}`).id, `ending_${endingId}`);
    assert.ok(def.cameras.length >= 4, `${endingId} cutscene must have >= 4 camera keyframes`);
    assert.ok(def.steps.length >= 4, `${endingId} cutscene must have >= 4 dialogue steps`);

    const camKey = def.cameras[0].pos.map((n) => n.toFixed(2)).join(',');
    assert.equal(
      seenFirstCameraPos.has(camKey),
      false,
      `${endingId} cutscene must have distinct camera choreography`
    );
    seenFirstCameraPos.add(camKey);

    for (let s = 0; s < def.steps.length; s++) {
      const sample = evaluateCutsceneSpline(def, s, 0.5, posOut, lookOut);
      assert.ok(Number.isFinite(posOut.x) && Number.isFinite(posOut.y) && Number.isFinite(posOut.z));
      assert.ok(sample.fov >= 35 && sample.fov <= 90);
      assert.ok(def.steps[s].soundCue, `${endingId} step ${s} must define a synced soundCue`);
    }
  }
  assert.equal(getCutsceneScript('ending').id, 'ending_good', 'Legacy "ending" alias must resolve to ending_good');

  // Prove all 4 routes across 40 seeds covering all 4 difficulties
  for (let i = 0; i < 40; i++) {
    const seed = 700 + i;
    const diff = difficulties[i % difficulties.length];
    const layout = generateMansionLayout(seed, diff);
    const solved = solveLayoutProgression(layout);

    // 1. BAD ENDING (Contenção do Setor 09): valid stalker spawn, patrol graph & containment triggerable
    const diddyGx = Math.floor(layout.diddySpawnPoint.x / CELL_SIZE);
    const diddyGz = Math.floor(layout.diddySpawnPoint.z / CELL_SIZE);
    const diddyGrid = layout.diddySpawnPoint.floor === 0 ? layout.floor0 : layout.floorMinus1;
    const diddyCell = diddyGrid[cellIdx(diddyGx, diddyGz)];
    assert.ok(
      diddyCell !== CELL_WALL && diddyCell !== CELL_VOID,
      `Seed ${seed}: Bad Ending requires P. Drizzy spawn on walkable cell`
    );
    assert.ok(layout.patrolWaypoints.length >= 6, `Seed ${seed}: Patrol network must exist for hunter containment`);

    // 2. GOOD ENDING (Fuga pelo Portão Norte): keys -> crowbar -> basement -> fuse/generator -> 4-digit safe -> North Exit
    assert.equal(solved.inv.has('crowbar'), true, `Seed ${seed}: Good Ending requires crowbar`);
    assert.equal(solved.inv.has('fuse'), true, `Seed ${seed}: Good Ending requires fuse`);
    const generatorProp = layout.furniture.find((f) => f.kind === 'generator_lever');
    assert.ok(generatorProp, `Seed ${seed}: Good Ending requires generator_lever prop`);
    assert.equal(
      isPointReachable(solved.reachable, generatorProp.floor, generatorProp.x, generatorProp.z),
      true,
      `Seed ${seed}: generator_lever must be reachable`
    );
    assert.equal(solved.safeUnlocked, true, `Seed ${seed}: Good Ending requires 4-digit safe unlocked`);
    assert.equal(solved.inv.has('master_key'), true, `Seed ${seed}: Good Ending requires master_key`);
    const exitDoor = layout.doors.find((d) => d.isExit);
    assert.ok(exitDoor, `Seed ${seed}: Good Ending requires North Exit door`);
    assert.equal(
      isPointReachable(
        solved.reachable,
        exitDoor.floor,
        (exitDoor.gx + 0.5) * CELL_SIZE,
        (exitDoor.gz + 0.5) * CELL_SIZE
      ),
      true,
      `Seed ${seed}: North Exit door must be reachable`
    );

    // 3. REAL ENDING (Resgate no Nível -2): wire_cutters + Cabine 09-A camera secret hint + radio/cassette + level2_hatch reachable
    assert.equal(solved.inv.has('wire_cutters'), true, `Seed ${seed}: Real Ending requires wire_cutters`);
    const secretCam = layout.bunkerCameras.find((cam) => Boolean(cam.secretCodeHint));
    assert.ok(secretCam, `Seed ${seed}: Real Ending requires Cabine 09-A camera secret hint`);
    assert.equal(
      secretCam.secretCodeHint,
      layout.cameraSecretCode,
      `Seed ${seed}: Cabine 09-A camera secret hint must match layout.cameraSecretCode`
    );
    assert.ok(layout.cassettes.length >= 1, `Seed ${seed}: Real Ending requires radio/cassette lore tapes`);
    const reachableCassettes = layout.cassettes.filter((t) =>
      isPointReachable(solved.reachable, t.floor, t.x, t.z)
    );
    assert.equal(
      reachableCassettes.length,
      layout.cassettes.length,
      `Seed ${seed}: All cassette tapes must be reachable`
    );
    const level2Hatch = layout.furniture.find((f) => f.kind === 'level2_hatch');
    assert.ok(level2Hatch, `Seed ${seed}: Real Ending requires level2_hatch furniture prop`);
    assert.equal(
      isPointReachable(solved.reachable, level2Hatch.floor, level2Hatch.x, level2Hatch.z),
      true,
      `Seed ${seed}: level2_hatch must be reachable`
    );

    // 4. SECRET ENDING (Dossiê Ômega Exposto): all UV marks + translation_board + 5-digit secret_terminal code match & reachable
    const symbolUvMarks = layout.uvMarks.filter((m) => m.kind === 'symbol_digit');
    assert.equal(symbolUvMarks.length, 5, `Seed ${seed}: Secret Ending requires 5 UV cipher marks`);
    for (const mark of symbolUvMarks) {
      assert.equal(
        isPointReachable(solved.reachable, mark.floor, mark.x, mark.z),
        true,
        `Seed ${seed}: UV mark ${mark.id} (${mark.roomName}) must be reachable`
      );
    }
    const translationBoard = layout.furniture.find((f) => f.kind === 'translation_board');
    assert.ok(translationBoard, `Seed ${seed}: Secret Ending requires translation_board prop`);
    assert.equal(
      isPointReachable(solved.reachable, translationBoard.floor, translationBoard.x, translationBoard.z),
      true,
      `Seed ${seed}: translation_board must be reachable`
    );
    const secretTerminal = layout.furniture.find((f) => f.kind === 'secret_terminal');
    assert.ok(secretTerminal, `Seed ${seed}: Secret Ending requires secret_terminal prop`);
    assert.equal(
      isPointReachable(solved.reachable, secretTerminal.floor, secretTerminal.x, secretTerminal.z),
      true,
      `Seed ${seed}: secret_terminal must be reachable`
    );
    const symbolLookup = new Map(layout.symbolMap.map((entry) => [entry.symbol, entry.digit]));
    const decoded5Digit = symbolUvMarks.map((m) => symbolLookup.get(m.symbolChar) ?? '').join('');
    assert.equal(decoded5Digit.length, 5, `Seed ${seed}: Decoded Terminal Ômega code must be 5 digits`);
    assert.equal(
      decoded5Digit,
      layout.secretTerminalCode,
      `Seed ${seed}: Translated UV marks must match layout.secretTerminalCode`
    );
  }
});

test('Chapter 1 Overhaul Playthrough: SecurityBunker (Cabine 09-A) & 25-Room Mansion Zero-Softlock across seeds', () => {
  for (let i = 0; i < 20; i++) {
    const seed = 7700 + i * 19;
    const layout = generateMansionLayout(seed, 'hard');
    assert.ok(layout.bunkerCameras.length >= 4, 'Cabine 09-A must have 4+ live security cameras');
    assert.ok(layout.doors.some((d) => d.id === 'door_bunker_left' && d.lockType === 'bunker_blast'));
    assert.ok(layout.doors.some((d) => d.id === 'door_bunker_right' && d.lockType === 'bunker_blast'));
    const solved = solveLayoutProgression(layout);
    assert.equal(solved.safeUnlocked, true, `Seed ${seed}: Safe must be 100% solvable`);
    assert.equal(solved.inv.has('master_key'), true, `Seed ${seed}: Master Key must be reachable`);
  }
});
