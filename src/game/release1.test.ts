import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_RENDERABLE_ITEM_IDS, renderAllItemIcons } from './itemRenderCache';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  getLocalizedItemDesc,
  getLocalizedItemName,
  getTranslationKeys,
  t,
} from '../i18n/translations';
import { voiceDubbing } from './voiceDubbing';
import {
  AuthStore,
  RoomManager,
  generateRoomCode,
  hashPassword,
  isValidEmail,
  verifyPassword,
} from '../../server';
import { INTERP_DELAY_MS, PeerInterpolationBuffer } from '../network/MultiplayerClient';
import { createDefaultSaveV4, mergeCloudSaveData } from './saveSystem';
import type { WorldPickupType } from './types';

test('Release 1.0: 3D Item Render Cache covers all 17 collectible items + flashlight_uv + cassette', () => {
  const requiredItems: WorldPickupType[] = [
    'flashlight',
    'stun_gun',
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
    'stun_ammo',
  ];

  for (const id of requiredItems) {
    assert.ok(
      ALL_RENDERABLE_ITEM_IDS.includes(id),
      `ALL_RENDERABLE_ITEM_IDS must include ${id}`
    );
  }
  assert.ok(ALL_RENDERABLE_ITEM_IDS.includes('flashlight_uv'));
  assert.ok(ALL_RENDERABLE_ITEM_IDS.includes('cassette'));

  // Headless safe fallback returns a complete keyed map without throwing
  const emptyMap = renderAllItemIcons(null as never, null);
  assert.equal(Object.keys(emptyMap).length, ALL_RENDERABLE_ITEM_IDS.length);
});

test('Release 1.0: Auth (scrypt+salt Sign Up, Login, Email validation & Guest Save Migration)', () => {
  assert.equal(isValidEmail('agent@sector09.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);

  const hash = hashPassword('OmegaPass2026!');
  const hash2 = hashPassword('OmegaPass2026!');
  assert.notEqual(hash, hash2, 'Password hash must use a unique random salt per hash');
  assert.notEqual(hash, 'OmegaPass2026!', 'Password must never be stored in plaintext');
  assert.equal(verifyPassword('OmegaPass2026!', hash), true);
  assert.equal(verifyPassword('WrongPass!', hash), false);

  const store = new AuthStore();
  const guestSave = createDefaultSaveV4(false);
  guestSave.progression.survivalCoins = 950;
  guestSave.progression.unlockedEndings = ['good', 'real'];

  const signupRes = store.signUp({
    nickname: 'AgenteMarcos',
    email: 'marcos@sector09.com',
    password: 'StrongPassword99',
    guestSave: guestSave as unknown as Record<string, unknown>,
  });
  assert.ok(signupRes.token);
  assert.equal(signupRes.user.nickname, 'AgenteMarcos');
  assert.equal(
    (signupRes.cloudSave as unknown as typeof guestSave)?.progression.survivalCoins,
    950
  );

  // Duplicate email rejected
  assert.throws(() => {
    store.signUp({
      nickname: 'Outro',
      email: 'marcos@sector09.com',
      password: 'StrongPassword99',
    });
  });

  // Login works with valid password and throws on wrong password
  assert.throws(() => {
    store.login({ email: 'marcos@sector09.com', password: 'wrong' });
  });

  const okLogin = store.login({ email: 'marcos@sector09.com', password: 'StrongPassword99' });
  assert.ok(okLogin.token);
  assert.equal(store.getMe(okLogin.token)?.user.email, 'marcos@sector09.com');

  // Guest-to-Cloud lossless merge preserves max coins & union of endings
  const cloudSave = createDefaultSaveV4(false);
  cloudSave.progression.survivalCoins = 400;
  cloudSave.progression.unlockedEndings = ['secret'];
  const merged = mergeCloudSaveData(guestSave, cloudSave);
  assert.equal(merged.progression.survivalCoins, 950);
  assert.deepEqual(
    [...merged.progression.unlockedEndings].sort(),
    ['good', 'real', 'secret']
  );
});

test('Release 1.0: Translations PT-BR / EN-US / ES-ES have 100% key parity & voiceDubbing safe fallback', () => {
  assert.equal(SUPPORTED_LANGUAGES.length, 3);
  const baseKeys = getTranslationKeys();
  assert.ok(baseKeys.length >= 100, 'Must have comprehensive translation dictionary');

  for (const lang of ['pt-BR', 'en-US', 'es-ES'] as const) {
    const dict = TRANSLATIONS[lang];
    for (const k of baseKeys) {
      assert.ok(
        typeof dict[k] === 'string' && dict[k].trim().length > 0,
        `Missing translation for key "${k}" in ${lang}`
      );
    }
    assert.ok(getLocalizedItemName(lang, 'crowbar').length > 0);
    assert.ok(getLocalizedItemDesc(lang, 'wire_cutters').length > 0);
  }

  assert.notEqual(t('pt-BR', 'item.crowbar.name'), t('en-US', 'item.crowbar.name'));
  assert.notEqual(t('en-US', 'item.crowbar.name'), t('es-ES', 'item.crowbar.name'));

  // Voice dubbing never throws in Node / headless browsers
  voiceDubbing.configure({ language: 'en-US', enabled: true, volume: 0.8, muted: false });
  assert.doesNotThrow(() => voiceDubbing.speak('Sector 09 containment breach', 'marcos'));
  assert.doesNotThrow(() => voiceDubbing.stop());
});

test('Release 1.0: Multiplayer Room Creation (5-char code), Join, Ready & 60ms Interpolation Buffer', () => {
  const code = generateRoomCode();
  assert.equal(code.length, 5);
  assert.match(code, /^[A-Z2-9]{5}$/);

  const rm = new RoomManager();
  const created = rm.createRoom({
    hostId: 'p1',
    hostName: 'HostOne',
    hostPlatform: 'pc',
    hostPerks: ['silent_steps'],
    name: 'Esquadrão Setor 09',
    chapter: 1,
    difficulty: 'hard',
    allowLobbyVote: true,
    maxPlayers: 4,
    visibility: 'public',
  });
  assert.equal(created.room.code.length, 5);
  assert.equal(rm.listPublicRooms().length, 1);

  const joined = rm.joinRoom(created.room.code, {
    id: 'p2',
    nickname: 'MobileScout',
    platform: 'touch',
    perks: ['iron_lungs'],
  });
  assert.equal(joined.room.players.length, 2);

  // Invalid room code rejected
  assert.throws(() => {
    rm.joinRoom('ZZZZZ', { id: 'p3', nickname: 'X', platform: 'pc', perks: [] });
  });

  // 50ms interpolation buffer interpolates smoothly between real server snapshots and NEVER extrapolates
  assert.equal(INTERP_DELAY_MS, 50);
  const buf = new PeerInterpolationBuffer();
  buf.push({
    timestamp: 1000,
    x: 10,
    y: 0,
    z: 20,
    yaw: 0,
    pitch: 0,
    crouching: false,
    flashlightOn: true,
    uvOn: false,
    heldItem: null,
    captured: false,
    spectating: false,
    alive: true,
  });
  buf.push({
    timestamp: 1100,
    x: 20,
    y: 0,
    z: 30,
    yaw: 1,
    pitch: 0,
    crouching: false,
    flashlightOn: true,
    uvOn: false,
    heldItem: null,
    captured: false,
    spectating: false,
    alive: true,
  });

  // At renderNow = 1100ms -> delayed sample time = 1050ms -> exact midpoint (15, 25)
  const mid = buf.sample(1100);
  assert.ok(mid);
  assert.ok(Math.abs(mid!.x - 15) < 0.01);
  assert.ok(Math.abs(mid!.z - 25) < 0.01);

  // Far in the future (renderNow = 1500ms) -> clamped strictly to latest real coord (20, 30), ZERO extrapolation!
  const clamped = buf.sample(1500);
  assert.ok(clamped);
  assert.equal(clamped!.x, 20);
  assert.equal(clamped!.z, 30);
});

test('Release 1.0 Audit: Zero DEBUG / PREVIEW / WIP / BETA / PROTOTYPE strings exposed in UI components', () => {
  const compDir = path.resolve(process.cwd(), 'src/components');
  const files = fs.readdirSync(compDir).filter((f) => f.endsWith('.tsx'));
  const forbiddenVisible =
    />[^<{}\n]*(?:\bDEBUG\b|\bPREVIEW\b|\bWIP\b|\bBETA\b|\bPROTOTYPE\b|EM PRODUÇÃO|EM DESENVOLVIMENTO)[^<{}\n]*</gi;

  for (const file of files) {
    const content = fs.readFileSync(path.join(compDir, file), 'utf8');
    const matches = content.match(forbiddenVisible);
    assert.equal(
      matches,
      null,
      `Found forbidden prototype/debug UI string in ${file}: ${JSON.stringify(matches)}`
    );
  }
});
