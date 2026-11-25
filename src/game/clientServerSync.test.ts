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
import { CELL_SIZE } from './mansionMap';

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
