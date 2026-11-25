import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASEMENT_CEILING_H,
  CELL_COURTYARD,
  CELL_FLOOR,
  CELL_SIZE,
  CELL_STAIR,
  CELL_WALL,
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  GRID_H,
  GRID_W,
  GROUND_CEILING_H,
  cellIdx,
  collectFloorObstacleBoxes,
  computeLightSwitchBox3,
  generateMansionLayout,
  getStairHeightAt,
  gridToWorld,
  resolveWorldMovement,
} from './mansionMap';

test('World Audit: 100% indoor ceilings & Option B Courtyard pillars flush to 3.6m pergola', () => {
  const layout = generateMansionLayout(202601, 'hard');

  assert.equal(layout.courtyardPillars.length, 4, 'Courtyard must have all 4 structural pillars');
  for (const pillar of layout.courtyardPillars) {
    assert.equal(
      pillar.height,
      GROUND_CEILING_H,
      `Courtyard pillar at (${pillar.x}, ${pillar.z}) must reach flush to GROUND_CEILING_H (${GROUND_CEILING_H}m)`
    );
  }

  let floor0IndoorCount = 0;
  let courtyardCount = 0;
  let floorMinus1Count = 0;
  for (let gz = 0; gz < GRID_H; gz++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const c0 = layout.floor0[cellIdx(gx, gz)];
      if (c0 === CELL_FLOOR) floor0IndoorCount++;
      if (c0 === CELL_COURTYARD) courtyardCount++;
      const cm1 = layout.floorMinus1[cellIdx(gx, gz)];
      if (cm1 === CELL_FLOOR) floorMinus1Count++;
    }
  }
  assert.ok(floor0IndoorCount > 150, 'Ground floor must have substantial indoor ceiling-covered area');
  assert.ok(courtyardCount > 80, 'Courtyard must have open skylight pergola bay cells');
  assert.ok(floorMinus1Count > 150, 'Basement must have substantial indoor ceiling-covered area');
  assert.ok(BASEMENT_CEILING_H >= 2.8, 'Basement ceiling height must provide realistic headroom');
});

test('World Audit: Stairways unobstructed, full-span, and zero under-stair upward teleport', () => {
  const layout = generateMansionLayout(202602, 'hard');
  assert.equal(layout.stairways.length, 2, 'Map must have West & East basement stairways');

  // Unlock basement gates so movement physics tests actual stair traversal
  for (const d of layout.doors) {
    if (d.lockType === 'basement_key') {
      d.isUnlocked = true;
      d.isOpen = true;
    }
  }

  for (const st of layout.stairways) {
    const xCenter = ((st.gxMin + st.gxMax + 1) * CELL_SIZE) / 2;
    const zTopApproach = (st.gzTop + 1.5) * CELL_SIZE;
    const zMid = ((st.gzTop + st.gzBottom + 1) * CELL_SIZE) / 2;
    const zBotExit = (st.gzBottom - 0.5) * CELL_SIZE;

    // 1. Top landing must be walkable Floor 0 (not blocked by a wall)
    const gxMid = Math.floor((st.gxMin + st.gxMax) / 2);
    assert.notEqual(
      layout.floor0[cellIdx(gxMid, st.gzTop + 1)],
      CELL_WALL,
      `Top landing of ${st.id} must not be walled off`
    );
    assert.equal(
      layout.floor0[cellIdx(gxMid, st.gzTop)],
      CELL_STAIR,
      `Top stair cell of ${st.id} must be CELL_STAIR`
    );

    // 2. Smooth descent from Floor 0 down to Floor -1 using real movement resolver
    let px = xCenter;
    let py = FLOOR_0_Y;
    let pz = zTopApproach;
    let floor: -1 | 0 = 0;
    for (let step = 0; step < 60; step++) {
      const r = resolveWorldMovement(layout, px, py, pz, 0, -0.22, 0.36, false, false);
      px = r.x;
      py = r.y;
      pz = r.z;
      floor = r.floor;
      if (pz <= zBotExit) break;
    }
    assert.equal(floor, -1, `Player must descend ${st.id} all the way into Floor -1`);
    assert.ok(Math.abs(py - FLOOR_MINUS_1_Y) < 0.08, `Player must reach FLOOR_MINUS_1_Y cleanly on ${st.id}`);

    // 3. Walking UNDERNEATH the high half of the stairs on Floor -1 must NEVER teleport player up!
    const underCheck = getStairHeightAt(xCenter, (st.gzTop - 0.2) * CELL_SIZE, FLOOR_MINUS_1_Y);
    assert.equal(
      underCheck.onStair,
      false,
      `Standing on Floor -1 underneath high steps of ${st.id} must NOT snap player onto stair slope`
    );
    assert.equal(underCheck.y, FLOOR_MINUS_1_Y);

    // Verify real movement under high half stays firmly on Floor -1
    const underMove = resolveWorldMovement(
      layout,
      xCenter,
      FLOOR_MINUS_1_Y,
      zMid + 1.2,
      0,
      0.35,
      0.36,
      false,
      false
    );
    assert.equal(underMove.floor, -1, `Walking under high stairs of ${st.id} must keep player on Floor -1`);
    assert.equal(underMove.y, FLOOR_MINUS_1_Y, `Walking under high stairs of ${st.id} must NOT teleport Y upward`);
  }
});

test('World Audit: All 4 safe clues across 100 seeds are clear of obstacles and reconstruct full 4-digit code', () => {
  for (let s = 1; s <= 100; s++) {
    const layout = generateMansionLayout(1000 + s * 13, 'hard');
    assert.equal(layout.clues.length, 4, `Seed ${s} must spawn exactly 4 safe clues`);
    assert.equal(layout.safe.code.length, 4, `Seed ${s} safe code must be 4 digits`);

    const digits = new Array<string | null>(4).fill(null);
    for (const clue of layout.clues) {
      digits[clue.digitIndex] = clue.digitValue;
      // Ensure zero overlap with UV marks on the same wall
      for (const uv of layout.uvMarks) {
        if (uv.floor !== clue.floor) continue;
        const dist = Math.hypot(uv.x - clue.x, uv.z - clue.z);
        assert.ok(
          dist >= 0.85,
          `Seed ${s}: Clue ${clue.id} overlaps UV mark ${uv.id} (dist=${dist.toFixed(2)}m)`
        );
      }
      // Ensure zero overlap with tall wall-mounted furniture frames/drawers on same floor
      for (const furn of layout.furniture) {
        if (furn.floor !== clue.floor) continue;
        if (furn.kind === 'wall_frame' || furn.kind === 'bookshelf' || furn.kind === 'drawer_cabinet') {
          const dist = Math.hypot(furn.x - clue.x, furn.z - clue.z);
          assert.ok(
            dist >= 0.85,
            `Seed ${s}: Clue ${clue.id} overlaps furniture ${furn.id} (dist=${dist.toFixed(2)}m)`
          );
        }
      }
    }

    assert.equal(
      digits.join(''),
      layout.safe.code,
      `Seed ${s}: Clues [${digits.join('')}] must exactly reconstruct safe code ${layout.safe.code}`
    );
  }
});

test('World Audit: Zero floating items/cassettes & valid abandoned atmosphere anchors', () => {
  const layout = generateMansionLayout(4242, 'hard');
  const drawerIds = new Set(layout.furniture.filter((f) => f.kind === 'drawer_cabinet').map((f) => f.id));

  for (const item of layout.items) {
    const baseFloorY = item.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    if (item.drawerId) {
      assert.ok(drawerIds.has(item.drawerId), `Item ${item.id} references valid drawer ${item.drawerId}`);
    } else {
      const relY = item.y - baseFloorY;
      assert.ok(
        relY >= 0.05 && relY <= 1.45,
        `Item ${item.id} (${item.itemType}) has suspicious floating height relY=${relY.toFixed(2)}m`
      );
    }
    const gx = Math.floor(item.x / CELL_SIZE);
    const gz = Math.floor(item.z / CELL_SIZE);
    assert.ok(gx >= 1 && gx < GRID_W - 1 && gz >= 1 && gz < GRID_H - 1, `Item ${item.id} within map bounds`);
  }

  for (const tape of layout.cassettes) {
    const baseFloorY = tape.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    if (tape.drawerId) {
      assert.ok(drawerIds.has(tape.drawerId), `Cassette ${tape.id} references valid drawer ${tape.drawerId}`);
    } else {
      const relY = tape.y - baseFloorY;
      assert.ok(
        relY >= 0.65 && relY <= 1.25,
        `Cassette ${tape.id} must rest flush on a surface (relY=${relY.toFixed(2)}m)`
      );
    }
  }

  // Abandoned atmosphere props exist and are within valid world coordinates
  assert.ok(layout.puddles.length >= 6, 'Must include abandoned reflective puddles');
  assert.ok(layout.cobwebs.length >= 8, 'Must include ceiling corner cobwebs');
  assert.ok(layout.grassTufts.length >= 8, 'Must include courtyard grass tufts');
  assert.ok(layout.steamVents.length >= 3, 'Must include underground steam vents');

  const maxX = gridToWorld(GRID_W);
  const maxZ = gridToWorld(GRID_H);
  for (const p of layout.puddles) {
    assert.ok(p.x > 0 && p.x < maxX && p.z > 0 && p.z < maxZ, `Puddle ${p.id} inside world bounds`);
  }
  for (const cw of layout.cobwebs) {
    assert.ok(cw.x > 0 && cw.x < maxX && cw.z > 0 && cw.z < maxZ, `Cobweb ${cw.id} inside world bounds`);
  }
});

test('World Audit: 100% Clear Doorways — Zero lockers, cabinets, or furniture blocking ANY door', () => {
  const layout = generateMansionLayout(202509, 'hard');
  const obstacles: { id: string; kind: string; floor: number; x: number; z: number }[] = [
    ...layout.hidingSpots.map((h) => ({ id: h.id, kind: `hiding:${h.kind}`, floor: h.floor, x: h.x, z: h.z })),
    ...layout.furniture
      .filter((f) => f.kind !== 'wall_frame' && f.kind !== 'cable_conduit' && f.kind !== 'translation_board')
      .map((f) => ({ id: f.id, kind: `furn:${f.kind}`, floor: f.floor, x: f.x, z: f.z })),
    ...layout.workbenches.map((w) => ({ id: w.id, kind: 'workbench', floor: w.floor, x: w.x, z: w.z })),
    ...layout.rechargeStations.map((r) => ({ id: r.id, kind: 'recharge', floor: r.floor, x: r.x, z: r.z })),
  ];

  for (const door of layout.doors) {
    const doorCx =
      door.axis === 'x'
        ? ((door.gx + door.spanCells * 0.5) * CELL_SIZE)
        : gridToWorld(door.gx);
    const doorCz =
      door.axis === 'z'
        ? ((door.gz + door.spanCells * 0.5) * CELL_SIZE)
        : gridToWorld(door.gz);

    for (const obs of obstacles) {
      if (obs.floor !== door.floor) continue;
      const dist = Math.hypot(obs.x - doorCx, obs.z - doorCz);
      // Every doorway must keep a full 2.2m clearance radius so no locker/cabinet blocks passage or steals the [E] prompt!
      assert.ok(
        dist >= 2.2,
        `Obstacle ${obs.id} (${obs.kind}) is blocking doorway ${door.id} (${door.name}) at dist=${dist.toFixed(2)}m`
      );
    }
  }
});

test('World Audit: Wall light switches mounted on clear jambs with ZERO Box3 overlap against any prop/furniture', () => {
  for (const seed of [101, 202601, 9009]) {
    const layout = generateMansionLayout(seed, 'hard');
    assert.ok(layout.lightSwitches.length >= 4, `Seed ${seed}: expected at least 4 wall light switches`);
    const obs0 = collectFloorObstacleBoxes(layout, 0);
    const obsM1 = collectFloorObstacleBoxes(layout, -1);

    for (const sw of layout.lightSwitches) {
      const swBox = computeLightSwitchBox3(sw);
      const boxes = sw.floor === 0 ? obs0 : obsM1;
      for (let i = 0; i < boxes.length; i++) {
        const obsBox = boxes[i];
        assert.equal(
          swBox.intersectsBox(obsBox),
          false,
          `Seed ${seed}: Wall switch ${sw.id} (${sw.roomName}) intersects obstacle Box3 #${i}`
        );
      }
    }
  }
});

