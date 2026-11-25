import test from 'node:test';
import assert from 'node:assert/strict';
import { DiddyAiController, findDualFloorPath } from './ai';
import { getDifficultyConfig } from './difficulty';
import { FLOOR_0_Y, FLOOR_MINUS_1_Y, generateMansionLayout, gridToWorld } from './mansionMap';

test('Dual-Floor 3D A* routes from Ground Floor down unlocked stairs to Underground Floor', () => {
  const layout = generateMansionLayout(101, 'hard');
  // Unlock West Basement Gate so Diddy can descend to the Underground
  const gate = layout.doors.find((d) => d.id === 'door_basement_gate')!;
  gate.isUnlocked = true;
  gate.isOpen = true;
  gate.openProgress = 1;

  const path = findDualFloorPath(
    layout,
    gridToWorld(17.5),
    0,
    gridToWorld(14),
    gridToWorld(17.5),
    -1,
    gridToWorld(13.5),
    2200
  );

  assert.ok(path.length > 5, 'Expected valid multi-step path to basement');
  const last = path[path.length - 1];
  assert.equal(last.floor, -1, 'Path must reach Underground Floor (-1)');
  assert.ok(Math.hypot(last.x - gridToWorld(17.5), last.z - gridToWorld(13.5)) < 2.2);
});

test('strict 5.0s initial delay: P. Diddy stays dormant and does not chase during first 5 seconds', () => {
  const layout = generateMansionLayout(55, 'hard');
  const diff = getDifficultyConfig('hard');
  const ai = new DiddyAiController();
  ai.reset(layout);

  const startX = ai.x;
  const startZ = ai.z;

  // Tick 4.5s even if player were right next to him
  for (let i = 0; i < 45; i++) {
    const ev = ai.tick({
      dt: 0.1,
      elapsedSec: i * 0.1,
      layout,
      diff,
      playerX: startX + 1.2,
      playerY: FLOOR_0_Y,
      playerZ: startZ,
      playerFloor: 0,
      playerCrouching: false,
      playerFlashlightOn: true,
      playerHidingSpot: null,
      playerEnteredHidingThisFrame: false,
      noiseEvents: [],
    });
    assert.equal(ev.hitPlayer, false);
    assert.equal(ev.spottedPlayer, false);
  }
  assert.equal(ai.x, startX);
  assert.equal(ai.z, startZ);
  assert.equal(ai.state, 'patrol');
});

test('ZERO wallhack / path prediction: loses aggro after 4.0s without LOS and leaves area', () => {
  const layout = generateMansionLayout(77, 'hard');
  const diff = getDifficultyConfig('hard');
  const ai = new DiddyAiController();
  ai.reset(layout);

  // Advance past 5.0s initial delay
  for (let i = 0; i < 55; i++) {
    ai.tick({
      dt: 0.1,
      elapsedSec: i * 0.1,
      layout,
      diff,
      playerX: layout.spawnPoint.x,
      playerY: FLOOR_0_Y,
      playerZ: layout.spawnPoint.z,
      playerFloor: 0,
      playerCrouching: true,
      playerFlashlightOn: false,
      playerHidingSpot: null,
      playerEnteredHidingThisFrame: false,
      noiseEvents: [],
    });
  }

  // Place Diddy & player in direct LOS in the Courtyard
  ai.x = gridToWorld(15);
  ai.y = FLOOR_0_Y;
  ai.z = gridToWorld(25);
  ai.floor = 0;

  ai.tick({
    dt: 0.05,
    elapsedSec: 6.0,
    layout,
    diff,
    playerX: gridToWorld(19),
    playerY: FLOOR_0_Y,
    playerZ: gridToWorld(25),
    playerFloor: 0,
    playerCrouching: false,
    playerFlashlightOn: true,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  assert.equal(ai.state, 'chase');

  // Now player moves out of LOS into another room (South Gatehouse behind solid wall) and stays quiet
  for (let i = 0; i < 45; i++) {
    ai.tick({
      dt: 0.1,
      elapsedSec: 6.1 + i * 0.1,
      layout,
      diff,
      playerX: gridToWorld(17.5),
      playerY: FLOOR_0_Y,
      playerZ: gridToWorld(32.5),
      playerFloor: 0,
      playerCrouching: true,
      playerFlashlightOn: false,
      playerHidingSpot: null,
      playerEnteredHidingThisFrame: false,
      noiseEvents: [],
    });
  }

  // After 4.5s with ZERO LOS, Diddy MUST have given up chase (not wallhack-chasing forever!)
  assert.equal(ai.state, 'patrol');
});

test('100% fair hiding spots: unseen hide NEVER triggers pull-out; seen hide DOES trigger search_hiding', () => {
  const layout = generateMansionLayout(88, 'hard');
  const diff = getDifficultyConfig('hard');
  const ai = new DiddyAiController();
  ai.reset(layout);

  // Advance past 5.0s initial delay
  for (let i = 0; i < 55; i++) {
    ai.tick({
      dt: 0.1,
      elapsedSec: i * 0.1,
      layout,
      diff,
      playerX: layout.spawnPoint.x,
      playerY: FLOOR_0_Y,
      playerZ: layout.spawnPoint.z,
      playerFloor: 0,
      playerCrouching: true,
      playerFlashlightOn: false,
      playerHidingSpot: null,
      playerEnteredHidingThisFrame: false,
      noiseEvents: [],
    });
  }

  const spot = layout.hidingSpots.find((s) => s.id === 'hide_corridor_locker')!;

  // 1. Player hides while Diddy is far away with NO line of sight
  ai.x = gridToWorld(5.5);
  ai.y = FLOOR_0_Y;
  ai.z = gridToWorld(11.0);
  ai.floor = 0;

  ai.tick({
    dt: 0.05,
    elapsedSec: 6.0,
    layout,
    diff,
    playerX: spot.x,
    playerY: FLOOR_0_Y,
    playerZ: spot.z,
    playerFloor: 0,
    playerCrouching: false,
    playerFlashlightOn: false,
    playerHidingSpot: spot,
    playerEnteredHidingThisFrame: true,
    noiseEvents: [],
  });
  assert.notEqual(ai.state, 'search_hiding');

  // Even when Diddy later walks right past the locker, he CANNOT pull the hidden player out!
  ai.x = spot.x - 1.2;
  ai.z = spot.z;
  for (let i = 0; i < 20; i++) {
    const ev = ai.tick({
      dt: 0.1,
      elapsedSec: 7.0 + i * 0.1,
      layout,
      diff,
      playerX: spot.x,
      playerY: FLOOR_0_Y,
      playerZ: spot.z,
      playerFloor: 0,
      playerCrouching: false,
      playerFlashlightOn: false,
      playerHidingSpot: spot,
      playerEnteredHidingThisFrame: false,
      noiseEvents: [],
    });
    assert.equal(ev.pulledFromHidingSpot, null);
    assert.equal(ev.hitPlayer, false);
  }

  // 2. Now player enters the hiding spot RIGHT IN FRONT of Diddy with direct LOS -> MUST search!
  ai.x = spot.x - 1.5;
  ai.y = FLOOR_0_Y;
  ai.z = spot.z;
  ai.floor = 0;

  ai.tick({
    dt: 0.05,
    elapsedSec: 10.0,
    layout,
    diff,
    playerX: spot.x,
    playerY: FLOOR_0_Y,
    playerZ: spot.z,
    playerFloor: 0,
    playerCrouching: false,
    playerFlashlightOn: true,
    playerHidingSpot: spot,
    playerEnteredHidingThisFrame: true,
    noiseEvents: [],
  });
  assert.equal(ai.state, 'search_hiding');

  // 3. Stun with flare -> enters 'stunned' and recovers to 'patrol'
  ai.stun(2.0);
  assert.equal(ai.state, 'stunned');
  ai.tick({
    dt: 2.2,
    elapsedSec: 13.0,
    layout,
    diff,
    playerX: gridToWorld(17.5),
    playerY: FLOOR_MINUS_1_Y,
    playerZ: gridToWorld(25),
    playerFloor: -1,
    playerCrouching: true,
    playerFlashlightOn: false,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  assert.equal(ai.state, 'patrol');
});

test('Phase 1 Stun Gun durations scale fairly by difficulty (Easy=12s, Hard=9s, Nightmare=6s)', () => {
  assert.equal(getDifficultyConfig('practice').diddyStunDuration, 12.0);
  assert.equal(getDifficultyConfig('easy').diddyStunDuration, 12.0);
  assert.equal(getDifficultyConfig('hard').diddyStunDuration, 9.0);
  assert.equal(getDifficultyConfig('nightmare').diddyStunDuration, 6.0);

  const layout = generateMansionLayout(123, 'hard');
  const diff = getDifficultyConfig('hard');
  const ai = new DiddyAiController();
  ai.reset(layout);
  ai.stun(diff.diddyStunDuration);
  assert.equal(ai.state, 'stunned');
  // After 8.0s (< 9.0s Hard stun) P. Diddy must STILL be stunned
  ai.tick({
    dt: 8.0,
    elapsedSec: 15.0,
    layout,
    diff,
    playerX: layout.spawnPoint.x,
    playerY: FLOOR_0_Y,
    playerZ: layout.spawnPoint.z,
    playerFloor: 0,
    playerCrouching: true,
    playerFlashlightOn: false,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  assert.equal(ai.state, 'stunned');
  // After another 1.5s (> 9.0s total) P. Diddy recovers to patrol
  ai.tick({
    dt: 1.5,
    elapsedSec: 16.5,
    layout,
    diff,
    playerX: layout.spawnPoint.x,
    playerY: FLOOR_0_Y,
    playerZ: layout.spawnPoint.z,
    playerFloor: 0,
    playerCrouching: true,
    playerFlashlightOn: false,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  assert.equal(ai.state, 'patrol');
});

test('P. Diddy A* NEVER enters CELL_VENT ducts and CANNOT breach closed SecurityBunker hydraulic doors', () => {
  const layout = generateMansionLayout(101, 'hard');

  // Seal BOTH lateral SecurityBunker (Cabine 09-A) blast doors
  const leftDoor = layout.doors.find((d) => d.id === 'door_bunker_left')!;
  const rightDoor = layout.doors.find((d) => d.id === 'door_bunker_right')!;
  leftDoor.isOpen = false;
  leftDoor.openProgress = 0;
  rightDoor.isOpen = false;
  rightDoor.openProgress = 0;

  // Attempt routing from Reception (gx=17, gz=31) into sealed Security Office (gx=11, gz=31)
  const sealedPath = findDualFloorPath(
    layout,
    gridToWorld(17),
    0,
    gridToWorld(31),
    gridToWorld(11),
    0,
    gridToWorld(31),
    1200
  );
  // A* may walk up to the outside of the door, but MUST NEVER produce a node inside Security Office (x=9..13, z=30..33)!
  for (const node of sealedPath) {
    const ngx = Math.floor(node.x / 1.6);
    const ngz = Math.floor(node.z / 1.6);
    const insideOffice = ngx >= 9 && ngx <= 13 && ngz >= 30 && ngz <= 33;
    assert.equal(
      insideOffice,
      false,
      `Closed SecurityBunker hydraulic doors MUST seal P. Diddy completely out of Security Office (breached at gx=${ngx}, gz=${ngz})`
    );
  }

  // Attempt routing from Courtyard (gx=11, gz=26) into Refeitório (gx=6, gz=26) — MUST go around via normal corridor, NEVER stepping into CELL_VENT (gx=8..9, gz=26)!
  const ventPath = findDualFloorPath(
    layout,
    gridToWorld(11),
    0,
    gridToWorld(26),
    gridToWorld(6),
    0,
    gridToWorld(26),
    1200
  );
  assert.ok(ventPath.length > 0, 'Expected alternate corridor path around vent');
  for (const node of ventPath) {
    const ngx = Math.floor(node.x / 1.6);
    const ngz = Math.floor(node.z / 1.6);
    const inVent = ngz === 26 && (ngx === 8 || ngx === 9);
    assert.equal(inVent, false, `P. Diddy A* MUST never route through CELL_VENT (stepped into gx=${ngx}, gz=${ngz})`);
  }
});
