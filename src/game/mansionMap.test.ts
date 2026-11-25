import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL_SIZE,
  CELL_VENT,
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  StrictFogOfWar,
  cellIdx,
  generateMansionLayout,
  getStairHeightAt,
  gridToWorld,
  hasWallLineOfSight,
  isCellSolidForActor,
  isDoorBlockingCell,
  isPositionInVent,
  resolveWorldMovement,
  verifyLayoutSolvable,
  worldToGrid,
} from './mansionMap';

test('strict 3-layer RNG + BFS zero-softlock solver validates 220+ consecutive seeds with 0 softlocks (including craftable Crowbar & Fuse)', () => {
  for (let seed = 1; seed <= 220; seed++) {
    const layout = generateMansionLayout(seed * 997 + 13, 'hard');
    assert.equal(layout.clues.length, 4, `seed ${seed} must place 4 ARG clues`);
    assert.equal(layout.safe.code.length, 4, `seed ${seed} must generate 4-digit safe code`);
    assert.equal(layout.uvMarks.length, 5, `seed ${seed} must place 5 UV secret cipher marks`);
    assert.equal(layout.secretTerminalCode.length, 5, `seed ${seed} must generate 5-digit secret terminal code`);
    assert.equal(layout.cassettes.length, 4, `seed ${seed} must place 4 lore cassette decks`);
    assert.equal(layout.fnafCameras.length, 6, `seed ${seed} must place 6 CCTV cameras`);
    assert.equal(layout.vents.length, 3, `seed ${seed} must place 3 crouch-only ventilation ducts`);
    assert.ok(layout.workbenches.length >= 2, `seed ${seed} must place craft workbenches`);
    assert.ok(layout.rechargeStations.length >= 2, `seed ${seed} must place flashlight recharge stations`);

    const keyZones: Record<'red_key' | 'blue_key' | 'basement_key' | 'crowbar' | 'master_key', string> = {
      red_key: '',
      blue_key: '',
      basement_key: '',
      crowbar: '',
      master_key: '',
    };
    let rodZone = '';
    let hookZone = '';
    let fuseZone = '';
    for (const item of layout.items) {
      if (item.itemType in keyZones) {
        keyZones[item.itemType as keyof typeof keyZones] = item.zoneId;
      }
      if (item.itemType === 'crowbar_rod') rodZone = item.zoneId;
      if (item.itemType === 'crowbar_hook') hookZone = item.zoneId;
      if (item.itemType === 'fuse') fuseZone = item.zoneId;
    }

    assert.ok(rodZone && hookZone, `Seed ${seed} must place both craftable crowbar parts`);
    assert.ok(fuseZone, `Seed ${seed} must place the Industrial Fuse for Blackout recovery`);

    // Layer 0 ('start') MUST always have at least one immediate opener (red_key, blue_key, or crowbar)
    const hasLayer0Opener =
      keyZones.red_key === 'start' ||
      keyZones.blue_key === 'start' ||
      keyZones.crowbar === 'start';
    assert.equal(hasLayer0Opener, true, `Seed ${seed} lacks a Layer 0 opening key/tool!`);

    // Zero self-locks & zero premature basement placement
    assert.notEqual(keyZones.red_key, 'red_wing');
    assert.notEqual(keyZones.blue_key, 'blue_wing');
    assert.notEqual(keyZones.basement_key, 'basement');
    assert.notEqual(keyZones.basement_key, 'basement_depot');
    assert.notEqual(keyZones.crowbar, 'basement_depot');

    const solvable = verifyLayoutSolvable({
      keyZones,
      craftCrowbarZones: [rodZone, hookZone],
      fuseZone,
      clueZones: layout.clues.map((c) => c.zoneId),
      safeZone: layout.safe.zoneId,
      safeRewardItem: 'master_key',
    });
    assert.equal(solvable, true, `Seed ${seed} produced an unsolvable softlock!`);
  }
});

test('BFS solver rejects an intentionally softlocked layout', () => {
  const unsolvable = verifyLayoutSolvable({
    keyZones: {
      red_key: 'red_wing', // Red key locked inside its own red wing -> softlock!
      blue_key: 'red_wing',
      basement_key: 'blue_wing',
      crowbar: 'basement_depot',
      master_key: 'safe_reward',
    },
    clueZones: ['start', 'red_wing', 'blue_wing', 'basement'],
    safeZone: 'basement',
    safeRewardItem: 'master_key',
  });
  assert.equal(unsolvable, false);
});

test('100% gap-free locked doors: player CANNOT walk through or squeeze past ANY locked door edge', () => {
  const layout = generateMansionLayout(42, 'hard');
  const lockedDoors = layout.doors.filter((d) => !d.isUnlocked);
  assert.ok(lockedDoors.length >= 6, 'Expected at least 6 locked progression doors');

  for (const door of lockedDoors) {
    const span = door.spanCells || 2;
    // Every cell along door's span MUST be blocked while locked
    for (let i = 0; i < span; i++) {
      const gx = door.axis === 'x' ? door.gx + i : door.gx;
      const gz = door.axis === 'x' ? door.gz : door.gz + i;
      assert.ok(
        isDoorBlockingCell(layout.doors, gx, gz, door.floor, false),
        `Door ${door.id} failed to block cell (${gx}, ${gz})`
      );
    }

    // Attempt pushing directly into left edge, center, and right edge of the locked door!
    const y = door.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    const offsets = [0.25, span * 0.5, span - 0.25];
    for (const off of offsets) {
      if (door.axis === 'x') {
        const startX = (door.gx + off) * CELL_SIZE;
        const doorZ = (door.gz + 0.5) * CELL_SIZE;
        const startZ = doorZ + CELL_SIZE * 0.85;
        let curX = startX;
        let curZ = startZ;
        let curY = y;
        for (let step = 0; step < 25; step++) {
          const res = resolveWorldMovement(layout, curX, curY, curZ, 0, -0.22, 0.38, false);
          curX = res.x;
          curY = res.y;
          curZ = res.z;
        }
        assert.ok(
          curZ > doorZ,
          `Bypass leak on x-axis locked door ${door.id} at offset ${off}: curZ=${curZ.toFixed(2)} crossed doorZ=${doorZ.toFixed(2)}`
        );
      } else {
        const doorX = (door.gx + 0.5) * CELL_SIZE;
        const startX = doorX + (door.gx < 18 ? CELL_SIZE * 0.85 : -CELL_SIZE * 0.85);
        const pushDir = door.gx < 18 ? -1 : 1;
        const startZ = (door.gz + off) * CELL_SIZE;
        let curX = startX;
        let curZ = startZ;
        let curY = y;
        for (let step = 0; step < 25; step++) {
          const res = resolveWorldMovement(layout, curX, curY, curZ, pushDir * 0.22, 0, 0.38, false);
          curX = res.x;
          curY = res.y;
          curZ = res.z;
        }
        if (pushDir < 0) {
          assert.ok(
            curX > doorX,
            `Bypass leak on z-axis locked door ${door.id} at offset ${off}: curX=${curX.toFixed(2)} crossed doorX=${doorX.toFixed(2)}`
          );
        } else {
          assert.ok(
            curX < doorX,
            `Bypass leak on z-axis locked door ${door.id} at offset ${off}: curX=${curX.toFixed(2)} crossed doorX=${doorX.toFixed(2)}`
          );
        }
      }
    }
  }
});

test('crouch-only CELL_VENT ducts block standing player & ALWAYS block P. Diddy, while crouching player passes cleanly', () => {
  const layout = generateMansionLayout(42, 'hard');
  // Vent west connects Refeitório (gx=7, gz=26) <-> Pátio (gx=10, gz=26) via vent cells gx=8..9, gz=26
  assert.equal(layout.floor0[cellIdx(8, 26)], CELL_VENT);
  assert.equal(layout.floor0[cellIdx(9, 26)], CELL_VENT);

  // Direct cell solidity rules
  const standingCell = isCellSolidForActor(layout, 8, 26, 0, false, false);
  assert.equal(standingCell.solid, true);
  assert.equal(standingCell.blockedByVentStanding, true);

  const crouchingCell = isCellSolidForActor(layout, 8, 26, 0, false, true);
  assert.equal(crouchingCell.solid, false);
  assert.equal(crouchingCell.blockedByVentStanding, false);

  const enemyCell = isCellSolidForActor(layout, 8, 26, 0, true, true);
  assert.equal(enemyCell.solid, true);

  // Standing movement push from Courtyard (gx=10) west into vent (gx=9) MUST be blocked with blockedByVentStanding=true
  let sx = gridToWorld(10.2);
  const sz = gridToWorld(26);
  let sawVentStandingBlock = false;
  for (let i = 0; i < 15; i++) {
    const res = resolveWorldMovement(layout, sx, FLOOR_0_Y, sz, -0.2, 0, 0.36, false, false);
    sx = res.x;
    if (res.blockedByVentStanding) sawVentStandingBlock = true;
  }
  assert.equal(sawVentStandingBlock, true, 'Standing player must trigger blockedByVentStanding at vent entrance');
  assert.equal(isPositionInVent(layout, sx, sz, 0), false);

  // Crouching movement push from Courtyard (gx=10) west into vent MUST enter vent cleanly
  let cx = gridToWorld(10.2);
  for (let i = 0; i < 15; i++) {
    const res = resolveWorldMovement(layout, cx, FLOOR_0_Y, sz, -0.2, 0, 0.36, false, true);
    cx = res.x;
  }
  assert.equal(isPositionInVent(layout, cx, sz, 0), true, 'Crouching player must enter ventilation duct cleanly');
});

test('FNAF armored blast doors block BOTH player and P. Diddy when powered closed, and block Stun Gun LOS', () => {
  const layout = generateMansionLayout(42, 'hard');
  const rightBlast = layout.doors.find((d) => d.id === 'door_fnaf_right')!;
  const leftBlast = layout.doors.find((d) => d.id === 'door_fnaf_left')!;
  assert.ok(rightBlast && leftBlast, 'Both FNAF lateral blast doors must exist');

  // Open by default -> passable & clear LOS
  assert.equal(rightBlast.isOpen, true);
  assert.equal(isDoorBlockingCell(layout.doors, rightBlast.gx, rightBlast.gz, 0, true), null);
  assert.equal(
    hasWallLineOfSight(
      layout,
      gridToWorld(rightBlast.gx - 1),
      gridToWorld(rightBlast.gz),
      gridToWorld(rightBlast.gx + 1),
      gridToWorld(rightBlast.gz),
      0
    ),
    true
  );

  // Closed -> blocks player, blocks P. Diddy, AND blocks Stun Gun LOS!
  rightBlast.isOpen = false;
  rightBlast.openProgress = 0;
  assert.ok(isDoorBlockingCell(layout.doors, rightBlast.gx, rightBlast.gz, 0, false));
  assert.ok(isDoorBlockingCell(layout.doors, rightBlast.gx, rightBlast.gz, 0, true));
  assert.equal(
    hasWallLineOfSight(
      layout,
      gridToWorld(rightBlast.gx - 1),
      gridToWorld(rightBlast.gz),
      gridToWorld(rightBlast.gx + 1),
      gridToWorld(rightBlast.gz),
      0
    ),
    false
  );
});

test('P. Diddy spawns far opposite the player (>= 25m away) and never blocks the start corridor', () => {
  const layout = generateMansionLayout(99, 'hard');
  const dist = Math.hypot(
    layout.diddySpawnPoint.x - layout.spawnPoint.x,
    layout.diddySpawnPoint.z - layout.spawnPoint.z
  );
  assert.ok(dist >= 25, `Expected Diddy spawn >= 25m from player, got ${dist.toFixed(1)}m`);
});

test('stair ramp smoothly interpolates height between Ground Floor (0.0m) and Underground (-4.0m)', () => {
  const xWestStair = gridToWorld(5.5);
  const top = getStairHeightAt(xWestStair, gridToWorld(8));
  const mid = getStairHeightAt(xWestStair, gridToWorld(5.5));
  const bot = getStairHeightAt(xWestStair, gridToWorld(3));

  assert.equal(top.onStair, true);
  assert.equal(bot.onStair, true);
  assert.ok(Math.abs(top.y - FLOOR_0_Y) < 0.05);
  assert.ok(Math.abs(mid.y - -2.0) < 0.35);
  assert.ok(Math.abs(bot.y - FLOOR_MINUS_1_Y) < 0.05);
});

test('player spawns in open Reception and moves smoothly into Craft Courtyard without wall snagging', () => {
  const layout = generateMansionLayout(42, 'hard');
  const sp = layout.spawnPoint;
  const moved = resolveWorldMovement(layout, sp.x, sp.y, sp.z, 0, -1.2, 0.38, false);
  assert.equal(moved.hitWall, false);
  assert.ok(moved.z < sp.z - 1.0);
  assert.equal(moved.floor, 0);
});

test('strict Fog of War isolates Ground Floor and Underground Floor and serializes cleanly', () => {
  const fog = new StrictFogOfWar();
  const wx = gridToWorld(17);
  const wz = gridToWorld(25);
  fog.revealAround(wx, wz, 0, 2.5);

  const gx = worldToGrid(wx);
  const gz = worldToGrid(wz);
  assert.equal(fog.isExplored(gx, gz, 0), true);
  assert.equal(fog.isExplored(gx, gz, -1), false);

  const encoded = fog.toBase64(0);
  const fog2 = new StrictFogOfWar();
  fog2.fromBase64(0, encoded);
  assert.equal(fog2.isExplored(gx, gz, 0), true);
  assert.equal(fog2.isExplored(gx, gz, -1), false);
});

test('stairs descent from Ground Floor to Underground is 100% unobstructed and connects to Generator Room & Maintenance Tunnel', () => {
  const layout = generateMansionLayout(42, 'hard');
  // Unlock both basement gates
  for (const door of layout.doors) {
    if (door.id === 'door_basement_gate' || door.id === 'door_east_gate') {
      door.isUnlocked = true;
      door.isOpen = true;
      door.openProgress = 1;
    }
  }

  // Walk down West stairs from top (gz=9.2) to bottom (gz=2.2), then east into Sala dos Geradores
  let x = gridToWorld(5.5);
  let y = FLOOR_0_Y;
  let z = gridToWorld(9.2);
  for (let i = 0; i < 65; i++) {
    const res = resolveWorldMovement(layout, x, y, z, 0, -0.22, 0.36, false);
    x = res.x;
    y = res.y;
    z = res.z;
  }
  assert.ok(z < gridToWorld(3.0), `Player failed to descend West stairs freely: z=${z.toFixed(2)}`);
  assert.ok(Math.abs(y - FLOOR_MINUS_1_Y) < 0.05, `Player should reach FLOOR_MINUS_1_Y (-4.0), got y=${y.toFixed(2)}`);

  // Walk east out of stair bottom landing into Sala dos Geradores (gx=9..12)
  for (let i = 0; i < 35; i++) {
    const res = resolveWorldMovement(layout, x, y, z, 0.22, 0, 0.36, false);
    x = res.x;
    y = res.y;
    z = res.z;
  }
  assert.ok(worldToGrid(x) >= 8, `Blocked exiting West stair bottom into Underground: gx=${worldToGrid(x)}`);
  assert.equal(y, FLOOR_MINUS_1_Y);

  // Walk down East stairs (gx=29..30) from top (gz=9.2) to bottom (gz=2.2), then west into Túnel de Manutenção (gx=28)
  let ex = gridToWorld(29.5);
  let ey = FLOOR_0_Y;
  let ez = gridToWorld(9.2);
  for (let i = 0; i < 65; i++) {
    const res = resolveWorldMovement(layout, ex, ey, ez, 0, -0.22, 0.36, false);
    ex = res.x;
    ey = res.y;
    ez = res.z;
  }
  assert.ok(ez < gridToWorld(3.0), `Player failed to descend East stairs freely: ez=${ez.toFixed(2)}`);
  assert.ok(Math.abs(ey - FLOOR_MINUS_1_Y) < 0.05, `East stairs should reach -4.0, got ${ey.toFixed(2)}`);

  for (let i = 0; i < 20; i++) {
    const res = resolveWorldMovement(layout, ex, ey, ez, -0.22, 0, 0.36, false);
    ex = res.x;
    ey = res.y;
    ez = res.z;
  }
  assert.ok(worldToGrid(ex) <= 28, `Blocked exiting East stair bottom into Underground tunnel: gx=${worldToGrid(ex)}`);
  assert.equal(ey, FLOOR_MINUS_1_Y);
});

test('walking underneath stairs on Underground floor NEVER teleports the player upward', () => {
  const layout = generateMansionLayout(42, 'hard');
  const xUnderWest = gridToWorld(5.5);
  const zHighPart = gridToWorld(8.2); // Under upper half of West stair where stairY would be ~0m

  // Direct height query with currentY = FLOOR_MINUS_1_Y must NOT snap up to the stair above
  const underQuery = getStairHeightAt(xUnderWest, zHighPart, FLOOR_MINUS_1_Y);
  assert.equal(underQuery.onStair, false, 'Walking underneath high part of stair must not capture player onto stair above');
  assert.equal(underQuery.y, FLOOR_MINUS_1_Y);

  // Simulate walking from south of stair (gz=10) northward underneath the stair (gz=8.5 -> 7.0) on Floor -1
  let px = xUnderWest;
  let py = FLOOR_MINUS_1_Y;
  let pz = gridToWorld(9.2);
  for (let step = 0; step < 18; step++) {
    const res = resolveWorldMovement(layout, px, py, pz, 0, -0.18, 0.36, false);
    px = res.x;
    py = res.y;
    pz = res.z;
    assert.equal(res.floor, -1, `Teleported to floor ${res.floor} at step ${step} (z=${pz.toFixed(2)})`);
    assert.equal(py, FLOOR_MINUS_1_Y, `Teleported vertically to y=${py.toFixed(2)} under stairs`);
  }
});

test('ZERO floating items/cassettes: drawer contents anchored, non-drawer items resting on furniture, wall clues have facingYaw', () => {
  const layout = generateMansionLayout(42, 'hard');

  // Verify FNAF tape_1 is inside furn_drawer_fnaf (never floating beside PC!)
  const tape1 = layout.cassettes.find((c) => c.id === 'tape_1');
  assert.ok(tape1, 'tape_1 must exist');
  assert.equal(tape1.drawerId, 'furn_drawer_fnaf', 'tape_1 must be stored inside furn_drawer_fnaf drawer');

  // Verify reception battery_0 is inside furn_drawer_reception
  const bat0 = layout.items.find((i) => i.id === 'battery_0');
  assert.ok(bat0, 'battery_0 must exist');
  assert.equal(bat0.drawerId, 'furn_drawer_reception', 'battery_0 must be stored inside furn_drawer_reception drawer');

  // Verify every drawerId referenced by items or cassettes matches a real drawer_cabinet prop
  const drawerIds = new Set(layout.furniture.filter((f) => f.kind === 'drawer_cabinet').map((f) => f.id));
  assert.ok(drawerIds.size >= 6, `Expected at least 6 functional drawer cabinets, got ${drawerIds.size}`);
  for (const item of layout.items) {
    if (item.drawerId) {
      assert.ok(drawerIds.has(item.drawerId), `Item ${item.id} references missing drawer ${item.drawerId}`);
    }
  }
  for (const tape of layout.cassettes) {
    if (tape.drawerId) {
      assert.ok(drawerIds.has(tape.drawerId), `Cassette ${tape.id} references missing drawer ${tape.drawerId}`);
    }
  }

  // Verify every non-drawer, non-safe world item rests on a nearby supporting prop (table, crate, barrel, workbench, desk, bookshelf)
  const supportProps = [
    ...layout.furniture.filter((f) =>
      ['side_table', 'dining_table', 'desk_monitor', 'crate', 'barrel', 'bookshelf', 'bed_medical', 'drawer_cabinet'].includes(f.kind)
    ),
    ...layout.workbenches.map((w) => ({ floor: w.floor, x: w.x, z: w.z, kind: 'workbench' })),
  ];
  for (const item of layout.items) {
    if (item.insideSafe || item.drawerId) continue;
    const baseY = item.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    const heightAboveFloor = item.y - baseY;
    if (heightAboveFloor > 0.25) {
      const hasSupport = supportProps.some(
        (p) => p.floor === item.floor && Math.hypot(p.x - item.x, p.z - item.z) <= 1.25
      );
      assert.equal(
        hasSupport,
        true,
        `Floating item detected: ${item.id} (${item.itemType}) at (${item.x.toFixed(2)}, ${item.y.toFixed(2)}, ${item.z.toFixed(2)}) has no furniture support!`
      );
    }
  }

  // Verify all ARG wall clues have explicit wall-mount facingYaw
  for (const clue of layout.clues) {
    assert.equal(typeof clue.facingYaw, 'number', `Clue ${clue.id} must specify facingYaw to mount flush on a wall`);
  }
});

test('FNAF Security Office has prominent physical wall buttons beside BOTH lateral blast doors', () => {
  const layout = generateMansionLayout(42, 'hard');
  const leftBtn = layout.fnafButtons.find((b) => b.id === 'btn_fnaf_left');
  const rightBtn = layout.fnafButtons.find((b) => b.id === 'btn_fnaf_right');
  assert.ok(leftBtn, 'Left FNAF blast door wall button must exist');
  assert.ok(rightBtn, 'Right FNAF blast door wall button must exist');
  assert.equal(leftBtn.doorId, 'door_fnaf_left');
  assert.equal(rightBtn.doorId, 'door_fnaf_right');
  // Both must sit inside Security Office corridor (x between 16 and 28 in world coords, z ~ 60)
  assert.ok(leftBtn.x < rightBtn.x, 'Left button must be west of right button');
  assert.ok(Math.abs(leftBtn.z - rightBtn.z) < 0.6, 'Both buttons should align cleanly inside the FNAF office');
});

test('RNG room dispersion spreads key items across multiple rooms without bunching across 35 seeds', () => {
  for (let seed = 10; seed < 45; seed++) {
    const layout = generateMansionLayout(seed * 733 + 19, 'hard');
    const worldItems = layout.items.filter((i) => !i.insideSafe && !i.drawerId);
    // Check no two non-drawer world items occupy the exact same spot (< 1.4m apart on same floor)
    for (let i = 0; i < worldItems.length; i++) {
      for (let j = i + 1; j < worldItems.length; j++) {
        const a = worldItems[i];
        const b = worldItems[j];
        if (a.floor !== b.floor) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        assert.ok(
          d >= 1.35,
          `Seed ${seed}: items ${a.id} and ${b.id} bunched too closely (${d.toFixed(2)}m apart)`
        );
      }
    }
  }
});

