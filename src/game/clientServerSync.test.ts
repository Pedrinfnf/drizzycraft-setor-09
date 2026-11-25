import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer, BASEMENT_CELL_POS } from './server/GameServer';
import {
  BROADCAST_INTERVAL_TICKS,
  KEY_PROGRESSION_ITEMS,
  SELF_HEAL_SNAPSHOT_TICKS,
  SERVER_TICK_SEC,
  type CompactDeltaPacket,
  type GameWorldState,
} from './server/types';
import {
  ClientInputPredictor,
  INTERP_DELAY_MS,
  PeerInterpolationBuffer,
} from '../network/MultiplayerClient';
import {
  CELL_SIZE,
  CHAPTER1_DIARY_PAGES,
  CHAPTER1_DUBBED_TAPES,
  CREAKING_FLOORBOARDS,
  ROOMS,
  generateMansionLayout,
  resolveWorldMovement,
} from './mansionMap';
import {
  DiddyAiController,
  compute3DProximityDistance,
  computeContextSteeringDirection,
  findDualFloorPath,
  hasLineOfSight,
} from './ai';
import { getDifficultyConfig } from './difficulty';
import { CloudSyncManager } from './cloudSync';
import { createDefaultSaveV4, mergeCloudSaveData } from './saveSystem';
import { ENDING_CUTSCENES, INTRO_CUTSCENE } from './cutscenes';
import { computeVoiceSpatialParams, VOICE_ICE_SERVERS } from '../network/ProximityVoice';

test('Solo Mode runs on deterministic 10ms GameServer across all 4 ending routes', async () => {
  // 1. Bad Ending: Solo player captured into cell -> GameServer triggers 'bad' ending
  {
    const srv = new GameServer(202601, 'hard');
    const p1 = srv.addPlayer({ id: 'solo_1', nickname: 'AgenteSolo', platform: 'pc' });
    srv.advance(0.05); // 5 ticks @ 10ms
    assert.equal(srv.state.tick, 5);
    assert.ok(Math.abs(srv.state.elapsedSec - 0.05) < 1e-6);

    const capP = srv.enqueueIntent(p1.id, { type: 'capture_player', targetPlayerId: p1.id });
    srv.stepTick();
    const cap = await capP;
    assert.equal(cap.ok, true);
    assert.equal(srv.state.phase, 'ended');
    assert.equal(srv.state.endingId, 'bad');
  }

  // 2. Good Ending: Crowbar + Safe Code + Master Key -> North Exit
  {
    const srv = new GameServer(202602, 'easy');
    const p1 = srv.addPlayer({ id: 'solo_1', nickname: 'AgenteSolo', platform: 'touch' });
    p1.inventory.push('crowbar');

    const safeP = srv.enqueueIntent(p1.id, { type: 'submit_safe_code', code: srv.layout.safe.code });
    srv.stepTick();
    assert.equal((await safeP).ok, true);
    assert.equal(srv.state.safeUnlocked, true);
    assert.ok(p1.inventory.includes('master_key'));

    const exitDoor = srv.layout.doors.find((d) => d.isExit)!;
    // Remove planks then escape
    const p1Exit1 = srv.enqueueIntent(p1.id, { type: 'interact_door', doorId: exitDoor.id });
    const p1Exit2 = srv.enqueueIntent(p1.id, { type: 'interact_door', doorId: exitDoor.id });
    srv.stepTick();
    assert.equal((await p1Exit1).code, 'PLANKS_REMOVED');
    assert.equal((await p1Exit2).code, 'ESCAPED');
    assert.equal(srv.state.phase, 'ended');
    assert.equal(srv.state.endingId, 'good');
  }

  // 3. Real Ending: Wire Cutters + CCTV Hint + Marcos Cassette -> Red Hatch
  {
    const srv = new GameServer(202603, 'hard');
    const p1 = srv.addPlayer({ id: 'solo_1', nickname: 'AgenteSolo', platform: 'gamepad' });
    p1.inventory.push('wire_cutters');

    // Blocked before CCTV hint & cassette
    const blocked = srv.enqueueIntent(p1.id, { type: 'interact_hatch' });
    srv.stepTick();
    assert.equal((await blocked).ok, false);

    srv.enqueueIntentSync(p1.id, { type: 'seen_cctv_hint' });
    srv.enqueueIntentSync(p1.id, { type: 'interact_cassette', tapeId: srv.layout.cassettes[0].id });
    const openHatch = srv.enqueueIntent(p1.id, { type: 'interact_hatch' });
    srv.stepTick();
    assert.equal((await openHatch).code, 'REAL_ENDING');
    assert.equal(srv.state.phase, 'ended');
    assert.equal(srv.state.endingId, 'real');
  }

  // 4. Secret Ending: Translation Board + UV + 5-digit Secret Terminal + North Exit
  {
    const srv = new GameServer(202604, 'nightmare');
    const p1 = srv.addPlayer({ id: 'solo_1', nickname: 'AgenteSolo', platform: 'pc' });
    p1.inventory.push('crowbar');

    srv.enqueueIntentSync(p1.id, { type: 'interact_translation_board' });
    srv.enqueueIntentSync(p1.id, { type: 'submit_terminal_code', code: srv.layout.secretTerminalCode });
    srv.enqueueIntentSync(p1.id, { type: 'submit_safe_code', code: srv.layout.safe.code });
    const exitDoor = srv.layout.doors.find((d) => d.isExit)!;
    srv.enqueueIntentSync(p1.id, { type: 'interact_door', doorId: exitDoor.id });
    const esc = srv.enqueueIntent(p1.id, { type: 'interact_door', doorId: exitDoor.id });
    srv.stepTick();
    assert.equal((await esc).code, 'ESCAPED');
    assert.equal(srv.state.phase, 'ended');
    assert.equal(srv.state.endingId, 'secret');
  }
});

test('3 Remote Clients Stress Test: Zero Item Duplication when racing in same millisecond (FIFO)', async () => {
  const srv = new GameServer(202610, 'hard');
  const p1 = srv.addPlayer({ id: 'cli_1', nickname: 'Mobile4G', platform: 'touch' });
  const p2 = srv.addPlayer({ id: 'cli_2', nickname: 'PC120Hz', platform: 'pc' });
  const p3 = srv.addPlayer({ id: 'cli_3', nickname: 'Gamepad5G', platform: 'gamepad' });

  // Pick a real non-safe world item on floor 0
  const targetItem = Object.values(srv.state.items).find(
    (it) => !it.insideSafe && !it.collected && it.floor === 0 && it.itemType !== 'battery'
  )!;
  assert.ok(targetItem, 'Must find a floor-0 collectible item');

  // Place all 3 clients right next to the same item simultaneously
  for (const p of [p1, p2, p3]) {
    p.x = targetItem.x;
    p.y = targetItem.y;
    p.z = targetItem.z;
    p.floor = targetItem.floor;
  }

  // All 3 clients send pickup_item in the EXACT SAME 10ms tick!
  const r1 = srv.enqueueIntent(p1.id, { type: 'pickup_item', itemId: targetItem.id });
  const r2 = srv.enqueueIntent(p2.id, { type: 'pickup_item', itemId: targetItem.id });
  const r3 = srv.enqueueIntent(p3.id, { type: 'pickup_item', itemId: targetItem.id });
  srv.stepTick();

  const results = await Promise.all([r1, r2, r3]);
  const winners = results.filter((r) => r.ok);
  assert.equal(winners.length, 1, 'Exactly ONE client must win the contested item (0 duplication)');
  assert.equal(results[0].ok, true, 'First FIFO arrival wins');
  assert.equal(results[1].code, 'ALREADY_COLLECTED');
  assert.equal(results[2].code, 'ALREADY_COLLECTED');
});

test('Lag Compensation Ring Buffer (300ms): Stun Gun validates hitbox at client ping tick', async () => {
  const srv = new GameServer(202620, 'hard');
  const shooter = srv.addPlayer({ id: 'cli_1', nickname: 'Sniper80ms', platform: 'pc' });
  shooter.inventory.push('stun_gun');
  shooter.stunAmmo = 2;
  shooter.pingMs = 80; // 40ms one-way -> 4 ticks rewind inside 300ms ring buffer

  // Place shooter & Diddy in clear line-of-sight on Floor 0
  const startX = srv.layout.spawnPoint.x;
  const startZ = srv.layout.spawnPoint.z;
  shooter.x = startX;
  shooter.z = startZ;
  shooter.floor = 0;

  // Record 6 ticks with Diddy directly in front (-Z) at tick 1..4, then moved far away at tick 6
  srv.state.diddy.floor = 0;
  for (let i = 0; i < 6; i++) {
    if (i < 4) {
      srv.state.diddy.x = startX;
      srv.state.diddy.y = 0;
      srv.state.diddy.z = startZ - 3.0;
    } else {
      // Diddy moved behind/away on latest server ticks
      srv.state.diddy.x = startX + 12.0;
      srv.state.diddy.z = startZ + 12.0;
    }
    // Step tick without AI overwriting our controlled test position
    srv.stepTick();
    if (i < 4) {
      // Keep recorded history frame aligned with our controlled test coordinates
      const frame = srv.getLagCompFrame(srv.state.tick);
      if (frame) {
        frame.diddyX = startX;
        frame.diddyY = 0;
        frame.diddyZ = startZ - 3.0;
        frame.diddyFloor = 0;
      }
    }
  }

  // Shooter aims straight -Z (yaw = 0) with 80ms ping (rewinds 4 ticks -> hits Diddy at tick 2!)
  const shot = srv.enqueueIntent(shooter.id, {
    type: 'fire_stun_gun',
    yaw: 0,
    pitch: 0,
    clientTick: 2,
  });
  srv.stepTick();
  const res = await shot;
  assert.equal(res.ok, true);
  assert.equal(res.code, 'STUN_HIT', 'Lag-compensated Stun Gun must register hit from 300ms ring buffer');
  assert.equal(srv.state.diddy.state, 'stunned');
});

test('Anti-Softlock Key Drop, Basement Cell Rescue, Compact 33Hz Broadcast, 2s Self-Heal & Host Migration', async () => {
  const srv = new GameServer(202630, 'hard');
  const deltas: CompactDeltaPacket[] = [];
  const snapshots: GameWorldState[] = [];
  srv.onBroadcastDelta = (d) => deltas.push(d);
  srv.onSelfHealSnapshot = (s) => snapshots.push(s);

  const host = srv.addPlayer({ id: 'host_1', nickname: 'HostPC', platform: 'pc' });
  const ally = srv.addPlayer({ id: 'ally_2', nickname: 'Ally4G', platform: 'touch' });
  const third = srv.addPlayer({ id: 'ally_3', nickname: 'AllyPad', platform: 'gamepad' });

  // Give ally key progression items
  ally.inventory.push('red_key', 'crowbar');
  const itemsBefore = Object.keys(srv.state.items).length;

  // Capture ally into basement cell -> key items MUST auto-drop on ground!
  const capRes = srv.enqueueIntent(host.id, { type: 'capture_player', targetPlayerId: ally.id });
  srv.stepTick();
  assert.equal((await capRes).code, 'CAPTURED');
  assert.equal(ally.capturedInCell, true);
  assert.equal(ally.spectating, true);
  assert.equal(srv.state.phase, 'playing', 'Match continues while teammates are still free');

  // Verify dropped key items exist in world & removed from captured player
  assert.equal(ally.inventory.some((i) => KEY_PROGRESSION_ITEMS.includes(i)), false);
  assert.equal(Object.keys(srv.state.items).length, itemsBefore + 2);

  // Move third teammate to basement cell and rescue ally
  third.x = BASEMENT_CELL_POS.x + 1.0;
  third.y = BASEMENT_CELL_POS.y;
  third.z = BASEMENT_CELL_POS.z;
  third.floor = BASEMENT_CELL_POS.floor;
  const rescueRes = srv.enqueueIntent(third.id, { type: 'rescue_ally', targetPlayerId: ally.id });
  srv.stepTick();
  assert.equal((await rescueRes).code, 'RESCUED');
  assert.equal(ally.capturedInCell, false);
  assert.equal(ally.spectating, false);
  assert.equal(ally.alive, true);

  // Step 200 ticks (2.0s) -> must emit compact 33Hz deltas AND at least 1 self-heal snapshot!
  for (let i = 0; i < SELF_HEAL_SNAPSHOT_TICKS; i++) {
    srv.stepTick();
  }
  assert.ok(
    deltas.length >= Math.floor(SELF_HEAL_SNAPSHOT_TICKS / BROADCAST_INTERVAL_TICKS) - 1,
    'Must broadcast compact deltas at ~33Hz'
  );
  assert.ok(snapshots.length >= 1, 'Must emit 2.0s self-heal reconciliation snapshot');

  // Host disconnects while holding master_key -> Anti-Softlock drops master_key AND Host Migration restores server!
  host.inventory.push('master_key');
  srv.removePlayer(host.id);
  assert.equal(host.connected, false);
  assert.equal(host.inventory.includes('master_key'), false);

  const migratedSnapshot = srv.exportSnapshot();
  const newHostServer = GameServer.fromSnapshot(migratedSnapshot);
  assert.equal(newHostServer.state.tick, srv.state.tick);
  assert.equal(newHostServer.state.seed, srv.state.seed);
  assert.equal(newHostServer.state.players[ally.id].alive, true);
  assert.ok(
    Object.values(newHostServer.state.items).some((it) => it.itemType === 'master_key' && !it.collected),
    'Dropped master_key must survive Host Migration'
  );
});

test('Client-Side Prediction + Server Reconciliation (inputSeq) & 50ms Interpolation Out-of-Order Drop', () => {
  // 1. Client-Side Prediction & Reconciliation
  const predictor = new ClientInputPredictor();
  predictor.reset(10, 20);
  const c1 = predictor.recordAndPredict(0.5, 0, 0);
  const c2 = predictor.recordAndPredict(0.5, 0, 0);
  const c3 = predictor.recordAndPredict(0.5, 0, 0);
  assert.equal(c1.seq, 1);
  assert.equal(c3.seq, 3);
  assert.ok(Math.abs(predictor.predictedX - 11.5) < 1e-6);

  // Server confirms seq=2 at x=10.8 (slight wall collision clamp), client discards seq<=2 and replays only seq=3
  const rec = predictor.reconcile(10.8, 20, 2);
  assert.equal(rec.pendingCount, 1);
  assert.ok(Math.abs(rec.x - 11.3) < 1e-6);

  // 2. 50ms Interpolation Buffer discards out-of-order packets (packet.tick <= lastTick) & never extrapolates
  assert.equal(INTERP_DELAY_MS, 50);
  const buf = new PeerInterpolationBuffer(INTERP_DELAY_MS);
  const baseSnap = {
    y: 0,
    yaw: 0,
    pitch: 0,
    crouching: false,
    flashlightOn: true,
    uvOn: false,
    heldItem: null,
    captured: false,
    spectating: false,
    alive: true,
  };
  assert.equal(buf.push({ ...baseSnap, tick: 10, timestamp: 1000, x: 0, z: 0 }), true);
  assert.equal(buf.push({ ...baseSnap, tick: 13, timestamp: 1090, x: 9, z: 0 }), true);
  // Out-of-order delayed packet (tick 11 <= 13) MUST be discarded!
  assert.equal(buf.push({ ...baseSnap, tick: 11, timestamp: 1030, x: 3, z: 0 }), false);

  // Sample at renderNow=1095ms -> delayed time = 1045ms -> exact midpoint x=4.5
  const mid = buf.sample(1095);
  assert.ok(mid);
  assert.ok(Math.abs(mid!.x - 4.5) < 0.05);

  // Far future -> clamped to x=9 (ZERO extrapolation through walls!)
  const future = buf.sample(2000);
  assert.equal(future!.x, 9);
  assert.equal(SERVER_TICK_SEC, 0.01);
  assert.ok(CELL_SIZE > 0);
});

test('Solid Furniture Colliders (CanCollide = true): block BOTH Player and P. Drizzy from walking through desks/tables/cabinets', () => {
  const layout = generateMansionLayout(202699, 'hard');
  assert.ok(layout.furnitureColliders.length >= 15, 'Must generate solid colliders for mansion furniture');

  const desk = layout.furnitureColliders.find(
    (c) => c.floor === 0 && (c.kind === 'dining_table' || c.kind === 'desk_monitor' || c.kind === 'drawer_cabinet')
  )!;
  assert.ok(desk, 'Must find a solid table/desk/cabinet collider on floor 0');

  const cx = (desk.minX + desk.maxX) * 0.5;
  const cz = (desk.minZ + desk.maxZ) * 0.5;
  const startX = desk.minX - 0.65;
  const startZ = cz;

  // Player attempting to walk straight through the solid furniture is physically stopped!
  const playerMove = resolveWorldMovement(layout, startX, 0, startZ, 1.4, 0, 0.36, false, false);
  assert.equal(playerMove.hitWall, true, 'Player must collide with solid furniture');
  assert.ok(playerMove.x < cx, 'Player must NOT walk through the center of the solid furniture');

  // P. Drizzy attempting to walk straight through the solid furniture is ALSO physically stopped!
  const diddyMove = resolveWorldMovement(layout, startX, 0, startZ, 1.4, 0, 0.42, true, false);
  assert.equal(diddyMove.hitWall, true, 'P. Drizzy must collide with solid furniture');
  assert.ok(diddyMove.x < cx, 'P. Drizzy must NOT walk through solid furniture');
});

test('Anti-Wallhack LOS: P. Drizzy vision raycast is blocked by solid furniture & does NOT detect crouched player behind cover', () => {
  const layout = generateMansionLayout(202699, 'hard');
  const cover = layout.furnitureColliders.find(
    (c) => c.floor === 0 && c.blocksLos && c.height >= 0.9
  )!;
  assert.ok(cover, 'Must find a LOS-blocking solid furniture collider');

  const midZ = (cover.minZ + cover.maxZ) * 0.5;
  const diddyX = cover.minX - 1.1;
  const playerX = cover.maxX + 1.1;

  // Crouched eye height (0.82m) behind solid cover (>= 0.9m) MUST block LOS!
  const losBlocked = hasLineOfSight(layout, diddyX, midZ, playerX, midZ, 0, 0.82);
  assert.equal(losBlocked, false, 'P. Drizzy LOS must be blocked by solid furniture when player crouches behind it');

  // Tick DiddyAiController with player crouched behind the solid cover -> MUST NOT spot or chase!
  const ai = new DiddyAiController();
  ai.reset(layout);
  ai.x = diddyX;
  ai.y = 0;
  ai.z = midZ;
  ai.floor = 0;
  const ev = ai.tick({
    dt: 0.05,
    elapsedSec: 12.0,
    layout,
    diff: getDifficultyConfig('hard'),
    playerX,
    playerY: 0,
    playerZ: midZ,
    playerFloor: 0,
    playerCrouching: true,
    playerFlashlightOn: false,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  assert.equal(ev.spottedPlayer, false, 'Hidden crouched player behind solid furniture must NOT be spotted');
  assert.notEqual(ai.state, 'chase', 'P. Drizzy must NOT enter chase through solid furniture (zero wallhack)');
});

test('Cloud Sync Manager builds keepalive:true authenticated Bearer requests for Supabase & Firebase', () => {
  const save = createDefaultSaveV4(false);
  save.progression.survivalCoins = 1200;

  const supaMgr = new CloudSyncManager({
    provider: 'supabase',
    authorizedDomain: 'pedrinfnf.github.io',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon_public_key_12345678901234567890',
    firebaseApiKey: '',
    firebaseAuthDomain: '',
    firebaseProjectId: '',
  });
  const req = supaMgr.buildUploadRequest(save, { uid: 'u_123', accessToken: 'tok_abc' });
  assert.ok(req);
  assert.equal(req!.init.keepalive, true);
  assert.equal((req!.init.headers as Record<string, string>)['Authorization'], 'Bearer tok_abc');
  assert.ok(req!.url.includes('/rest/v1/user_saves'));
});

test('Lossless Local-to-Cloud Migration preserves max coins, endings, perks and cosmetics across local + server saves', () => {
  const localSave = createDefaultSaveV4(false);
  localSave.progression.survivalCoins = 1200;
  localSave.progression.unlockedEndings = ['good', 'real'];
  localSave.progression.unlockedPerks = ['silent_steps', 'iron_lungs'];

  const remoteSave = createDefaultSaveV4(false);
  remoteSave.progression.survivalCoins = 600;
  remoteSave.progression.unlockedEndings = ['secret'];
  remoteSave.progression.unlockedPerks = ['adrenaline_burst'];

  const merged = mergeCloudSaveData(localSave, remoteSave);
  assert.equal(merged.progression.survivalCoins, 1200);
  assert.deepEqual([...merged.progression.unlockedEndings].sort(), ['good', 'real', 'secret']);
  assert.deepEqual([...merged.progression.unlockedPerks].sort(), [
    'adrenaline_burst',
    'iron_lungs',
    'silent_steps',
  ]);
});

test('Locked Door Single-Use Key Rule: unlocking consumes key ONCE and door NEVER re-locks', async () => {
  const srv = new GameServer(202611, 'hard');
  const p = srv.addPlayer({ id: 'host', nickname: 'Host', platform: 'pc' });
  const redDoor = srv.layout.doors.find((d) => d.lockType === 'red_key')!;
  assert.ok(redDoor, 'Layout must have a red_key locked door');
  assert.equal(srv.state.doors[redDoor.id].locked, true);
  assert.equal(srv.state.doors[redDoor.id].isOpen, false);

  // Give player red_key & interact -> MUST unlock permanently, open door, and CONSUME red_key
  p.inventory.push('red_key');
  p.floor = redDoor.floor;
  const unlockP = srv.enqueueIntent('host', { type: 'interact_door', doorId: redDoor.id });
  srv.stepTick();
  const unlockRes = await unlockP;
  assert.equal(unlockRes.ok, true);
  assert.equal(unlockRes.code, 'UNLOCKED');
  assert.equal(p.inventory.includes('red_key'), false, 'red_key MUST be consumed once on unlock');
  assert.equal(srv.state.doors[redDoor.id].locked, false);
  assert.equal(srv.state.doors[redDoor.id].isUnlocked, true);
  assert.equal(srv.state.doors[redDoor.id].isOpen, true);

  // Closing and re-opening WITHOUT key MUST succeed freely and NEVER re-lock!
  const closeP = srv.enqueueIntent('host', { type: 'interact_door', doorId: redDoor.id });
  srv.stepTick();
  const closeRes = await closeP;
  assert.equal(closeRes.code, 'CLOSED');
  assert.equal(srv.state.doors[redDoor.id].locked, false);
  assert.equal(srv.state.doors[redDoor.id].isOpen, false);

  const reopenP = srv.enqueueIntent('host', { type: 'interact_door', doorId: redDoor.id });
  srv.stepTick();
  const reopenRes = await reopenP;
  assert.equal(reopenRes.code, 'OPENED');
  assert.equal(srv.state.doors[redDoor.id].locked, false);
  assert.equal(srv.state.doors[redDoor.id].isOpen, true);
});

test('Organic P. Drizzy AI: 12-Whisker Context Steering avoids furniture, respects 180-250ms reaction delay & accesses Underground', () => {
  const layout = generateMansionLayout(202622, 'hard');
  const diff = getDifficultyConfig('hard');
  const ai = new DiddyAiController();
  ai.reset(layout);

  // 1. Reaction delay must be strictly within 180ms–250ms (humanized juke window)
  assert.ok(
    ai.reactionDelaySec >= 0.18 && ai.reactionDelaySec <= 0.25,
    `Expected reactionDelaySec in [0.18, 0.25], got ${ai.reactionDelaySec}`
  );

  // 2. Context Steering detects a solid furniture collider directly ahead and steers around it
  const furniture = layout.furnitureColliders.find(
    (c) => c.floor === 0 && c.height >= 0.5 && c.maxX - c.minX >= 0.6
  )!;
  assert.ok(furniture, 'Must find a solid furniture obstacle');
  const cx = (furniture.minX + furniture.maxX) * 0.5;
  const cz = (furniture.minZ + furniture.maxZ) * 0.5;
  const startX = furniture.minX - 0.75;
  const steered = computeContextSteeringDirection(layout, startX, cz, 0, cx - startX, 0, 1.85);
  assert.equal(steered.blockedDirectly, true, 'Whiskers must detect furniture directly ahead');
  assert.ok(
    Math.abs(steered.dirZ) > 0.15 || steered.dirX < 0.95,
    'Context Steering must deflect smoothly around solid furniture instead of ramming straight'
  );

  // 3. Underground access via unlocked stairs produces smooth dual-floor path down to Floor -1
  for (const d of layout.doors) {
    if (d.lockType === 'basement_key') {
      d.isUnlocked = true;
      d.isOpen = true;
    }
  }
  const pathToBasement = findDualFloorPath(
    layout,
    layout.spawnPoint.x,
    0,
    layout.spawnPoint.z,
    layout.patrolWaypoints.find((w) => w.floor === -1)!.x,
    -1,
    layout.patrolWaypoints.find((w) => w.floor === -1)!.z,
    2400
  );
  assert.ok(pathToBasement.length > 5, 'Must compute path from Ground Floor to Underground');
  assert.equal(pathToBasement[pathToBasement.length - 1].floor, -1, 'Path must reach Underground Floor (-1)');
  // Ensure reaction delay lag during sudden player juke (does not instantly snap LKP at dt=0.05s)
  ai.x = 26;
  ai.y = 0;
  ai.z = 38;
  ai.floor = 0;
  ai.tick({
    dt: 0.05,
    elapsedSec: 10.0,
    layout,
    diff,
    playerX: 28,
    playerY: 0,
    playerZ: 38,
    playerFloor: 0,
    playerCrouching: false,
    playerFlashlightOn: true,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  const firstPerceived = ai.getPerceivedTarget();
  ai.tick({
    dt: 0.05,
    elapsedSec: 10.05,
    layout,
    diff,
    playerX: 31,
    playerY: 0,
    playerZ: 40,
    playerFloor: 0,
    playerCrouching: false,
    playerFlashlightOn: true,
    playerHidingSpot: null,
    playerEnteredHidingThisFrame: false,
    noiseEvents: [],
  });
  const after50ms = ai.getPerceivedTarget();
  assert.ok(firstPerceived && after50ms);
  assert.equal(after50ms!.x, firstPerceived!.x, 'Perceived target must lag behind sudden juke (<210ms)');
});

test('Real 3D Floor-Aware Proximity & Proximity Voice Spatialization prevent false cross-floor alerts', () => {
  // Same X, Z directly on top of each other, but Ground Floor (y=0) vs Basement (y=-4.0)
  const crossFloorDist = compute3DProximityDistance(28.0, 0.0, 35.0, 28.0, -4.0, 35.0);
  assert.ok(
    crossFloorDist > 20.0,
    `Cross-floor distance via stairs must be > 20m (not 2D 0m!), got ${crossFloorDist.toFixed(2)}m`
  );

  // Same floor 3m apart -> exact 3.0m
  const sameFloorDist = compute3DProximityDistance(28.0, 0.0, 35.0, 31.0, 0.0, 35.0);
  assert.ok(Math.abs(sameFloorDist - 3.0) < 0.01);

  // Proximity Voice Chat attenuation: 100% <= 4m, smooth falloff 4m..22m, muted > 22m
  assert.ok(VOICE_ICE_SERVERS.length >= 3, 'Must configure Google + Cloudflare STUN servers');
  const near = computeVoiceSpatialParams({ x: 10, y: 0, z: 10, yaw: 0 }, { x: 13, y: 0, z: 10 });
  assert.equal(near.gain, 1.0, 'Voice gain must be 100% within 4m');
  assert.equal(near.audible, true);

  const mid = computeVoiceSpatialParams({ x: 10, y: 0, z: 10, yaw: 0 }, { x: 23, y: 0, z: 10 });
  assert.ok(mid.gain > 0.05 && mid.gain < 0.95, `Mid-range (13m) voice must attenuate smoothly, got ${mid.gain}`);

  const far = computeVoiceSpatialParams({ x: 10, y: 0, z: 10, yaw: 0 }, { x: 35, y: 0, z: 10 });
  assert.equal(far.gain, 0, 'Voice must be completely muted beyond 22m');
  assert.equal(far.audible, false);
});

test('Dedicated 3D Cutscene Sets & Anchors: all 4 endings + intro have valid bounded 3D coordinates (ZERO void)', () => {
  const allDefs = [INTRO_CUTSCENE, ...Object.values(ENDING_CUTSCENES)];
  assert.equal(allDefs.length, 5);

  for (const def of allDefs) {
    const { bounds, survivorStart, survivorEnd, diddyStart, diddyEnd, groundY } = def.anchors;
    assert.ok(bounds.maxX > bounds.minX && bounds.maxZ > bounds.minZ, `${def.id} bounds must be valid`);

    const checkInside = (label: string, pt: [number, number, number]) => {
      assert.ok(
        pt[0] >= bounds.minX && pt[0] <= bounds.maxX && pt[2] >= bounds.minZ && pt[2] <= bounds.maxZ,
        `${def.id} ${label} (${pt.join(',')}) must lie strictly inside its enclosed 3D cutscene set bounds`
      );
      assert.ok(
        pt[1] >= groundY - 0.5 && pt[1] <= groundY + 12.0,
        `${def.id} ${label} Y=${pt[1]} must stay above solid set groundY=${groundY}`
      );
    };

    checkInside('survivorStart', survivorStart);
    checkInside('survivorEnd', survivorEnd);
    checkInside('diddyStart', diddyStart);
    checkInside('diddyEnd', diddyEnd);

    for (let i = 0; i < def.cameras.length; i++) {
      checkInside(`camera[${i}].pos`, def.cameras[i].pos);
      checkInside(`camera[${i}].lookAt`, def.cameras[i].lookAt);
    }
  }
});

test('Multiplayer Match Lifecycle: DOWNED (35s) -> REVIVED (4s/2s Medkit) & DEAD_SPECTATING (no solo Game Over), ENDED_WIPEOUT only when ALL fall', async () => {
  const srv = new GameServer(202655, 'hard');
  const p1 = srv.addPlayer({ id: 'p1', nickname: 'Alice', platform: 'pc' });
  const p2 = srv.addPlayer({ id: 'p2', nickname: 'Bob', platform: 'touch' });

  // Open a door first so we verify revives NEVER reset world state
  const redDoor = srv.layout.doors.find((d) => d.lockType === 'red_key')!;
  p1.inventory.push('red_key');
  p1.floor = redDoor.floor;
  const u = srv.enqueueIntent('p1', { type: 'interact_door', doorId: redDoor.id });
  srv.stepTick();
  await u;
  assert.equal(srv.state.doors[redDoor.id].isUnlocked, true);

  // 1. P1 takes lethal damage (2 hits on Hard) -> enters DOWNED (35s bleedout), match MUST remain PLAYING!
  srv.applyDamageToPlayer('p1');
  srv.applyDamageToPlayer('p1');
  assert.equal(p1.lifeState, 'DOWNED');
  assert.equal(p1.bleedoutSec, 35.0);
  assert.equal(srv.state.matchPhase, 'PLAYING', '1 downed player MUST NOT end Multiplayer match');

  // 2. P2 revives P1 with Medkit in 2.0s -> restores ALIVE without resetting doors!
  p2.x = p1.x + 1.0;
  p2.z = p1.z;
  p2.floor = p1.floor;
  p2.inventory.push('medkit');
  const rev1 = srv.enqueueIntent('p2', { type: 'revive_ally', targetPlayerId: 'p1', dtSec: 1.0 });
  srv.stepTick();
  assert.equal((await rev1).code, 'REVIVING');
  const rev2 = srv.enqueueIntent('p2', { type: 'revive_ally', targetPlayerId: 'p1', dtSec: 1.1 });
  srv.stepTick();
  assert.equal((await rev2).code, 'REVIVED');
  assert.equal(p1.lifeState, 'ALIVE');
  assert.equal(p2.inventory.includes('medkit'), false, 'Medkit consumed on fast 2s revive');
  assert.equal(srv.state.doors[redDoor.id].isUnlocked, true, 'Revive must NEVER reset unlocked doors');

  // 3. P1 goes DOWNED again and bleeds out for 35s -> transitions to DEAD_SPECTATING (cannot interact, match stays PLAYING!)
  p1.health = 1;
  srv.applyDamageToPlayer('p1');
  assert.equal(p1.lifeState, 'DOWNED');
  for (let i = 0; i < 3550; i++) srv.stepTick();
  assert.equal(p1.lifeState, 'DEAD_SPECTATING');
  assert.equal(p1.spectating, true);
  assert.equal(srv.state.matchPhase, 'PLAYING', '1 DEAD_SPECTATING player MUST NOT end MP match while P2 lives');

  const blocked = srv.enqueueIntent('p1', { type: 'interact_door', doorId: redDoor.id });
  srv.stepTick();
  assert.equal((await blocked).ok, false, 'DEAD_SPECTATING player CANNOT interact with doors/items');

  // 4. Now P2 also dies -> ALL players eliminated -> ENDED_WIPEOUT triggers!
  p2.health = 1;
  srv.applyDamageToPlayer('p2');
  assert.equal(p2.lifeState, 'DOWNED');
  for (let i = 0; i < 3550; i++) srv.stepTick();
  assert.equal(p2.lifeState, 'DEAD_SPECTATING');
  assert.equal(srv.state.matchPhase, 'ENDED_WIPEOUT');
  assert.equal(srv.state.endingId, 'bad');
});

test('SecurityBunker (Cabine 09-A), 25-Room Mansion Expansion, New Puzzles, Tools & 4-Stage 15s Final Escape Protocol', async () => {
  const srv = new GameServer(202677, 'hard');
  const p1 = srv.addPlayer({ id: 'p1', nickname: 'Host', platform: 'pc' });
  const p2 = srv.addPlayer({ id: 'p2', nickname: 'Ally', platform: 'touch' });

  // 1. Mansion Expansion: 20+ rooms (25 rooms!), creaking floorboards, 4 diary pages, 2 dubbed tapes & 6s Intro
  assert.ok(ROOMS.length >= 20, `Expected 20+ rooms in Chapter 1 overhaul, got ${ROOMS.length}`);
  assert.ok(ROOMS.some((r) => r.id === 'outer_garden'));
  assert.ok(ROOMS.some((r) => r.id === 'garage'));
  assert.ok(ROOMS.some((r) => r.id === 'secret_attic'));
  assert.ok(ROOMS.some((r) => r.id === 'owner_archives'));
  assert.ok(CREAKING_FLOORBOARDS.length >= 4);
  assert.equal(CHAPTER1_DIARY_PAGES.length, 4);
  assert.equal(CHAPTER1_DUBBED_TAPES.length, 2);
  const introTotalSec = INTRO_CUTSCENE.steps.reduce((s, st) => s + st.autoAdvanceSec, 0);
  assert.equal(introTotalSec, 6.0, 'Intro cutscene must be crisp 6.0s');

  // 2. SecurityBunker (Cabine 09-A): 4+ cameras, hydraulic door battery drain, Remote Acoustic Lure (25s cooldown)
  assert.ok(srv.layout.bunkerCameras.length >= 4);
  const lure1 = srv.enqueueIntent('p1', { type: 'trigger_bunker_lure' });
  srv.stepTick();
  assert.equal((await lure1).code, 'LURE_FIRED');
  assert.ok(srv.state.bunkerLureCooldownSec >= 24.5);
  const lureCooldown = srv.enqueueIntent('p1', { type: 'trigger_bunker_lure' });
  srv.stepTick();
  assert.equal((await lureCooldown).code, 'COOLDOWN');

  // 3. New Puzzles & Tools: False Bookshelf (2 emblems), Piano 4-note sequence, 3 Steam Valves, Polaroid, Oil Can, Freq Pills, Co-op Give Item
  p1.inventory.push('emblem_sun', 'emblem_moon', 'polaroid_camera', 'oil_can', 'freq_pills');
  const b1 = srv.enqueueIntent('p1', { type: 'place_bookshelf_emblem', emblem: 'emblem_sun' });
  const b2 = srv.enqueueIntent('p1', { type: 'place_bookshelf_emblem', emblem: 'emblem_moon' });
  srv.stepTick();
  await b1;
  assert.equal((await b2).code, 'BOOKSHELF_OPENED');
  assert.equal(srv.state.puzzles.bookshelfOpened, true);

  for (const note of ['C', 'E', 'G', 'B']) {
    const np = srv.enqueueIntent('p1', { type: 'input_piano_note', note });
    srv.stepTick();
    await np;
  }
  assert.equal(srv.state.puzzles.pianoSolved, true);

  for (const v of [2, 1, 3] as const) {
    const vp = srv.enqueueIntent('p1', { type: 'turn_steam_valve', valveIndex: v });
    srv.stepTick();
    await vp;
  }
  assert.equal(srv.state.puzzles.steamSolved, true);

  const pol = srv.enqueueIntent('p1', { type: 'fire_polaroid', yaw: 0, pitch: 0 });
  srv.stepTick();
  assert.equal((await pol).ok, true);
  assert.equal(srv.state.puzzles.polaroidClueRevealed, true);

  p1.neuralInterference = 72;
  const pills = srv.enqueueIntent('p1', { type: 'use_freq_pills' });
  srv.stepTick();
  assert.equal((await pills).code, 'INTERFERENCE_CLEARED');
  assert.equal(p1.neuralInterference, 0);

  // Co-op Give Item hand-off
  p2.x = p1.x + 1.0;
  p2.z = p1.z;
  p2.floor = p1.floor;
  const oilIdx = p1.inventory.indexOf('oil_can');
  const giveP = srv.enqueueIntent('p1', { type: 'give_item', targetPlayerId: 'p2', slotIndex: oilIdx });
  srv.stepTick();
  assert.equal((await giveP).code, 'GIVEN');
  assert.equal(p2.inventory.includes('oil_can'), true);

  // 4. Hard 4-Stage Final Gate Protocol + 15s Siren Survival -> ENDED_VICTORY!
  p1.inventory.push('fuse', 'fuse', 'wire_cutters', 'master_key');
  const f1 = srv.enqueueIntent('p1', { type: 'final_gate_install_fuse' });
  const f2 = srv.enqueueIntent('p1', { type: 'final_gate_install_fuse' });
  srv.stepTick();
  await f1;
  assert.equal((await f2).code, 'STAGE_1_COMPLETE');

  const c1 = srv.enqueueIntent('p1', { type: 'final_gate_cut_chain' });
  const c2 = srv.enqueueIntent('p1', { type: 'final_gate_cut_chain' });
  srv.stepTick();
  await c1;
  assert.equal((await c2).code, 'STAGE_2_COMPLETE');

  const codeP = srv.enqueueIntent('p1', {
    type: 'final_gate_submit_master_code',
    code: srv.state.finalGate.sixDigitCode,
  });
  srv.stepTick();
  assert.equal((await codeP).code, 'STAGE_3_COMPLETE');

  // Pull hydraulic lever in co-op (2 players = 2x speed, 1.0s instead of 2.0s!) -> starts 15s siren!
  const levP = srv.enqueueIntent('p1', { type: 'final_gate_pull_lever', dtSec: 1.0, helpersCount: 2 });
  srv.stepTick();
  assert.equal((await levP).code, 'SIREN_15S_STARTED');
  assert.equal(srv.state.finalGate.sirenActive, true);
  assert.equal(srv.state.matchPhase, 'PLAYING');

  // Survive 15.0 seconds (1500 ticks @ 10ms) -> Gate opens & triggers ENDED_VICTORY!
  for (let i = 0; i < 1510; i++) srv.stepTick();
  assert.equal(srv.state.finalGate.gateFullyOpen, true);
  assert.equal(srv.state.matchPhase, 'ENDED_VICTORY');
});
