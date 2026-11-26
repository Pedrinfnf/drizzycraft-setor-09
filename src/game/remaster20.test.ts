import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CELL_COURTYARD,
  CELL_FLOOR,
  CELL_SIZE,
  GRID_H,
  GRID_W,
  cellIdx,
  generateMansionLayout,
  getItemLabel,
  worldToGrid,
} from './mansionMap';
import {
  MICRO_VOXEL_TOOL_IDS,
  NEW_MICRO_VOXEL_BUILDERS,
  countMeshSubPieces,
} from './microVoxelProps';
import {
  createArticulatedPeerRig,
  updatePeerRigAnimation,
} from './cutsceneSets';
import { DIDDY_COLLISION_RADIUS } from './ai';
import { GameServer } from './server/GameServer';
import { SERVER_MAX_FRAME_DT } from './server/types';
import { DrizzyInterpolationBuffer } from '../network/MultiplayerClient';
import { i18nStore } from '../i18n/i18n';
import { getTapeAudioUrl } from '../audio/TapeAudioPlayer';

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      if (!entry.name.endsWith('.test.ts')) {
        out.push(full);
      }
    }
  }
  return out;
}

test('Update 2.0 Static Hygiene: ZERO FNAF references, ZERO speechSynthesis, BASE_URL audio & real neural MP3 tapes on disk', () => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = walkSourceFiles(srcDir);
  assert.ok(files.length >= 25, 'Should scan all TypeScript source files');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(
      /fnaf/i.test(content),
      false,
      `Forbidden "FNAF" reference found in ${path.relative(process.cwd(), file)}`
    );
    assert.equal(
      /speechSynthesis/i.test(content),
      false,
      `Forbidden robotic "speechSynthesis" found in ${path.relative(process.cwd(), file)}`
    );
  }

  // Verify all 6 pre-generated neural MP3 cassette tapes exist & are non-trivial (>100KB)
  for (const lang of ['pt', 'en', 'es'] as const) {
    for (const num of [1, 2] as const) {
      const mp3Path = path.resolve(process.cwd(), `public/audio/tapes/${lang}/tape_0${num}.mp3`);
      assert.ok(fs.existsSync(mp3Path), `Missing neural tape file: ${mp3Path}`);
      const stat = fs.statSync(mp3Path);
      assert.ok(stat.size > 100_000, `Neural tape ${mp3Path} too small (${stat.size} bytes)`);

      const url = getTapeAudioUrl(lang, num);
      assert.ok(
        url.endsWith(`audio/tapes/${lang}/tape_0${num}.mp3`),
        `Unexpected TapeAudioPlayer URL: ${url}`
      );
    }
  }
});

test('Update 2.0 High-Density Micro-Voxel Audit: all 29 builders >= 6 sub-pieces & sculpted articulated survivor rig', () => {
  const entries = Object.entries(NEW_MICRO_VOXEL_BUILDERS);
  assert.ok(entries.length >= 25, `Expected >=25 micro-voxel builders, got ${entries.length}`);

  for (const [name, build] of entries) {
    const obj = build();
    const meshCount = countMeshSubPieces(obj);
    assert.ok(
      meshCount >= 6,
      `Micro-voxel builder "${name}" has only ${meshCount} meshes (must be >= 6)`
    );
  }

  // Sculpted articulated player rig (replaces blocky dummy!)
  const rig = createArticulatedPeerRig(true);
  const rigMeshes = countMeshSubPieces(rig.root);
  assert.ok(rigMeshes >= 10, `Sculpted survivor rig should have >= 10 meshes, got ${rigMeshes}`);
  assert.ok(rig.leftForeArm && rig.rightForeArm, 'Rig must have articulated elbows/forearms');
  assert.ok(rig.leftShin && rig.rightShin, 'Rig must have articulated knees/shins');

  for (const st of ['idle', 'walk', 'run', 'crouch_walk', 'downed_crawl'] as const) {
    updatePeerRigAnimation(rig, st, 0, 0.05);
    assert.ok(Number.isFinite(rig.pelvis.position.y), `NaN pelvis.y in state ${st}`);
    assert.ok(Number.isFinite(rig.leftForeArm.rotation.x), `NaN elbow rotation in state ${st}`);
    assert.ok(Number.isFinite(rig.leftShin.rotation.x), `NaN knee rotation in state ${st}`);
  }
});

test('Update 2.0 Real Physical Chapter 1 Map Expansion: 5 new rooms carved into floor0 & all 7 new tools spawned with valid (x,y,z)', () => {
  const newRoomIds = ['outer_garden', 'tool_shed', 'garage', 'owner_archives', 'secret_attic'] as const;

  for (const seed of [2026, 4096, 8888, 13370]) {
    const layout = generateMansionLayout(seed, 'hard');

    // 1. Every new room MUST have physical walkable floor cells in floor0!
    for (const rid of newRoomIds) {
      const room = layout.rooms.find((r) => r.id === rid);
      assert.ok(room, `Seed ${seed}: Room "${rid}" missing from layout.rooms`);
      let walkableCount = 0;
      for (let gz = room!.z0; gz <= room!.z1; gz++) {
        for (let gx = room!.x0; gx <= room!.x1; gx++) {
          const cell = layout.floor0[cellIdx(gx, gz)];
          if (cell === CELL_FLOOR || cell === CELL_COURTYARD) walkableCount++;
        }
      }
      assert.ok(
        walkableCount >= 6,
        `Seed ${seed}: Room "${rid}" is NOT physically carved into floor0 (walkable=${walkableCount})`
      );
    }

    // 2. BFS from spawnPoint through floor0 (ignoring locked doors) reaches EVERY newly carved room!
    const visited = new Uint8Array(GRID_W * GRID_H);
    const sx = worldToGrid(layout.spawnPoint.x);
    const sz = worldToGrid(layout.spawnPoint.z);
    const queue: [number, number][] = [[sx, sz]];
    visited[cellIdx(sx, sz)] = 1;
    while (queue.length > 0) {
      const [cx, cz] = queue.shift()!;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_H) continue;
        const idx = cellIdx(nx, nz);
        if (visited[idx]) continue;
        const c = layout.floor0[idx];
        if (c === CELL_FLOOR || c === CELL_COURTYARD) {
          visited[idx] = 1;
          queue.push([nx, nz]);
        }
      }
    }
    for (const rid of newRoomIds) {
      const room = layout.rooms.find((r) => r.id === rid)!;
      let anyReachable = false;
      for (let gz = room.z0; gz <= room.z1 && !anyReachable; gz++) {
        for (let gx = room.x0; gx <= room.x1; gx++) {
          if (visited[cellIdx(gx, gz)] === 1) {
            anyReachable = true;
            break;
          }
        }
      }
      assert.equal(
        anyReachable,
        true,
        `Seed ${seed}: Newly carved room "${rid}" is disconnected / unreachable from spawn!`
      );
    }

    // 3. Every one of the 7 new tools MUST physically exist in layout.items with valid (x,y,z)!
    for (const toolId of MICRO_VOXEL_TOOL_IDS) {
      const spawn = layout.items.find((it) => it.itemType === toolId);
      assert.ok(spawn, `Seed ${seed}: Tool "${toolId}" missing from layout.items`);
      assert.ok(Number.isFinite(spawn!.x) && Number.isFinite(spawn!.y) && Number.isFinite(spawn!.z));
      const gx = worldToGrid(spawn!.x);
      const gz = worldToGrid(spawn!.z);
      assert.ok(gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_H);
      assert.ok(CELL_SIZE > 0);
    }

    // 4. Key puzzle items (Garage Key, Sun/Moon Emblems, Medkit, Freq Pills) physically spawned
    for (const extra of ['garage_key', 'emblem_sun', 'emblem_moon', 'medkit', 'freq_pills'] as const) {
      assert.ok(
        layout.items.some((it) => it.itemType === extra),
        `Seed ${seed}: Puzzle/survival item "${extra}" missing from layout.items`
      );
    }
  }
});

test('Update 2.0 Authoritative Netcode, 100ms Drizzy Interpolation & Anti-Stuck AI Constants', () => {
  assert.equal(SERVER_MAX_FRAME_DT, 0.05);
  assert.equal(DIDDY_COLLISION_RADIUS, 0.35);

  // Server MUST include full doors state in every 30Hz CompactDeltaPacket so locked/unlocked doors never desync
  const srv = new GameServer(202609, 'hard');
  srv.addPlayer({ id: 'host', nickname: 'Host', platform: 'pc' });
  let capturedDelta: import('./server/types').CompactDeltaPacket | null = null;
  srv.onBroadcastDelta = (d) => {
    capturedDelta = d;
  };
  for (let i = 0; i < 5; i++) srv.stepTick();
  assert.ok(capturedDelta, 'GameServer must emit 30Hz CompactDeltaPacket');
  const doorsDict = (capturedDelta as import('./server/types').CompactDeltaPacket).e?.doors;
  assert.ok(doorsDict, '30Hz CompactDeltaPacket must ALWAYS include authoritative doors dictionary');
  assert.ok(Object.keys(doorsDict!).length >= 6, 'Doors dictionary must include all mansion doors');

  // 100ms DrizzyInterpolationBuffer smoothly interpolates & computes actualSpeed without teleporting
  const interp = new DrizzyInterpolationBuffer(100, 32);
  assert.equal(interp.delayMs, 100);
  assert.equal(
    interp.push({ x: 10, y: 0, z: 20, yaw: 0, floor: 0, state: 'chase', timestamp: 1000, tick: 1 }),
    true
  );
  assert.equal(
    interp.push({ x: 14, y: 0, z: 20, yaw: 0.4, floor: 0, state: 'chase', timestamp: 1100, tick: 4 }),
    true
  );
  // Out-of-order tick must be ignored
  assert.equal(
    interp.push({ x: 99, y: 0, z: 99, yaw: 0, floor: 0, state: 'chase', timestamp: 1050, tick: 2 }),
    false
  );
  // At nowMs=1150, renderTime = 1050 (exact midpoint between 1000 and 1100)
  const mid = interp.sample(1150);
  assert.ok(mid);
  assert.ok(Math.abs(mid!.x - 12.0) < 0.05, `Expected x≈12.0, got ${mid!.x}`);
  assert.ok(mid!.actualSpeed > 1.0, `Expected positive actualSpeed, got ${mid!.actualSpeed}`);
});

test('Update 2.0 Global Reactive i18nStore switches PT/EN/ES live and updates item labels', () => {
  let notifications = 0;
  const unsub = i18nStore.subscribe(() => {
    notifications++;
  });

  i18nStore.setLang('en-US');
  assert.equal(i18nStore.getLang(), 'en');
  const enCam = getItemLabel('polaroid_camera');
  assert.ok(enCam.toLowerCase().includes('polaroid'), `Expected EN Polaroid label, got "${enCam}"`);

  i18nStore.setLang('es-ES');
  assert.equal(i18nStore.getLang(), 'es');
  const esCam = getItemLabel('polaroid_camera');
  assert.ok(esCam.toLowerCase().includes('polaroid'), `Expected ES Polaroid label, got "${esCam}"`);

  i18nStore.setLang('pt-BR');
  assert.equal(i18nStore.getLang(), 'pt');
  const ptCam = getItemLabel('polaroid_camera');
  assert.ok(ptCam.toLowerCase().includes('polaroid'), `Expected PT Polaroid label, got "${ptCam}"`);

  assert.ok(notifications >= 2, 'i18nStore must notify reactive subscribers on language switch');
  unsub();
});
