import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';

// ============================================================================
// Pure Auth & Crypto Helpers
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no O/0/I/1
const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_WS_PAYLOAD_BYTES = 256 * 1024;
const TICK_RATE_MS = 50; // 20 Hz

export type AuthProvider = 'email' | 'google' | 'guest';
export type Difficulty = 'practice' | 'easy' | 'hard' | 'nightmare';
export type PlayerPlatform = 'touch' | 'pc' | 'gamepad';
export type RoomVisibility = 'public' | 'private';
export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface PublicUser {
  id: string;
  nickname: string;
  email: string;
  provider: AuthProvider;
  avatarUrl?: string;
}

interface StoredUserRecord extends PublicUser {
  passwordHash?: string;
  googleId?: string;
  cloudSave: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateRoomCode(existingCodes?: Set<string>): string {
  for (let attempt = 0; attempt < 256; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
    }
    if (!existingCodes || !existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error('Unable to allocate unique 5-character room code');
}

// ============================================================================
// AuthStore (In-Memory + Optional JSON File Persistence)
// ============================================================================

export interface AuthStoreOptions {
  persistPath?: string | null;
  tokenSecret?: string;
}

export interface AuthActionResult {
  token: string;
  user: PublicUser;
  cloudSave: Record<string, unknown> | null;
}

export class AuthStore {
  private usersById = new Map<string, StoredUserRecord>();
  private userIdByEmail = new Map<string, string>();
  private userIdByGoogleId = new Map<string, string>();
  private activeTokens = new Map<string, string>(); // token -> userId
  private readonly persistPath: string | null;
  private readonly tokenSecret: string;

  constructor(options: AuthStoreOptions = {}) {
    this.persistPath = options.persistPath === undefined ? null : options.persistPath;
    this.tokenSecret =
      options.tokenSecret ||
      process.env.AUTH_TOKEN_SECRET ||
      crypto.randomBytes(32).toString('hex');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const parsed = JSON.parse(raw) as { users?: StoredUserRecord[] };
      if (!Array.isArray(parsed.users)) return;
      for (const rec of parsed.users) {
        if (!rec || !rec.id || !rec.email) continue;
        this.usersById.set(rec.id, rec);
        this.userIdByEmail.set(rec.email.toLowerCase(), rec.id);
        if (rec.googleId) {
          this.userIdByGoogleId.set(rec.googleId, rec.id);
        }
      }
    } catch {
      // Ignore corrupt persistence file and start fresh in memory
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const payload = JSON.stringify({ users: Array.from(this.usersById.values()) }, null, 2);
      fs.writeFileSync(this.persistPath, payload, 'utf8');
    } catch {
      // Non-fatal in read-only filesystems
    }
  }

  private toPublicUser(rec: StoredUserRecord): PublicUser {
    const pub: PublicUser = {
      id: rec.id,
      nickname: rec.nickname,
      email: rec.email,
      provider: rec.provider,
    };
    if (rec.avatarUrl) pub.avatarUrl = rec.avatarUrl;
    return pub;
  }

  createToken(userId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now(), n: nonce })).toString(
      'base64url',
    );
    const sig = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('base64url');
    const token = `${payload}.${sig}`;
    this.activeTokens.set(token, userId);
    return token;
  }

  verifyToken(token: string): StoredUserRecord | null {
    if (!token || typeof token !== 'string') return null;
    const directUserId = this.activeTokens.get(token);
    if (directUserId) {
      return this.usersById.get(directUserId) ?? null;
    }
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('base64url');
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expectedSig);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        uid?: string;
      };
      if (!decoded.uid) return null;
      return this.usersById.get(decoded.uid) ?? null;
    } catch {
      return null;
    }
  }

  revokeToken(token: string): void {
    this.activeTokens.delete(token);
  }

  signUp(input: {
    nickname: string;
    email: string;
    password: string;
    guestSave?: Record<string, unknown> | null;
  }): AuthActionResult {
    const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (nickname.length < 2 || nickname.length > 24) {
      throw new Error('Nickname deve ter entre 2 e 24 caracteres.');
    }
    if (!isValidEmail(email)) {
      throw new Error('Email inválido.');
    }
    if (password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres.');
    }
    if (this.userIdByEmail.has(email)) {
      throw new Error('Este email já está cadastrado.');
    }

    const now = Date.now();
    const id = `usr_${crypto.randomBytes(10).toString('hex')}`;
    const cloudSave =
      input.guestSave && typeof input.guestSave === 'object' ? { ...input.guestSave } : null;

    const record: StoredUserRecord = {
      id,
      nickname,
      email,
      passwordHash: hashPassword(password),
      provider: 'email',
      cloudSave,
      createdAt: now,
      updatedAt: now,
    };

    this.usersById.set(id, record);
    this.userIdByEmail.set(email, id);
    this.saveToDisk();

    const token = this.createToken(id);
    return {
      token,
      user: this.toPublicUser(record),
      cloudSave: record.cloudSave,
    };
  }

  login(input: {
    email: string;
    password: string;
    guestSave?: Record<string, unknown> | null;
  }): AuthActionResult {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!isValidEmail(email) || !password) {
      throw new Error('Credenciais inválidas.');
    }
    const userId = this.userIdByEmail.get(email);
    if (!userId) {
      throw new Error('Email ou senha incorretos.');
    }
    const record = this.usersById.get(userId);
    if (!record || !record.passwordHash || !verifyPassword(password, record.passwordHash)) {
      throw new Error('Email ou senha incorretos.');
    }

    if (!record.cloudSave && input.guestSave && typeof input.guestSave === 'object') {
      record.cloudSave = { ...input.guestSave };
      record.updatedAt = Date.now();
      this.saveToDisk();
    }

    const token = this.createToken(record.id);
    return {
      token,
      user: this.toPublicUser(record),
      cloudSave: record.cloudSave,
    };
  }

  upsertGoogleUser(input: {
    googleId: string;
    email: string;
    nickname: string;
    avatarUrl?: string;
  }): AuthActionResult {
    const email = input.email.trim().toLowerCase();
    const existingId =
      this.userIdByGoogleId.get(input.googleId) ?? this.userIdByEmail.get(email);

    const now = Date.now();
    let record: StoredUserRecord;
    if (existingId && this.usersById.has(existingId)) {
      record = this.usersById.get(existingId)!;
      record.googleId = input.googleId;
      record.avatarUrl = input.avatarUrl || record.avatarUrl;
      record.updatedAt = now;
    } else {
      const id = `usr_${crypto.randomBytes(10).toString('hex')}`;
      record = {
        id,
        nickname: (input.nickname || email.split('@')[0] || 'Sobrevivente').slice(0, 24),
        email,
        provider: 'google',
        avatarUrl: input.avatarUrl,
        googleId: input.googleId,
        cloudSave: null,
        createdAt: now,
        updatedAt: now,
      };
      this.usersById.set(id, record);
      this.userIdByEmail.set(email, id);
      this.userIdByGoogleId.set(input.googleId, id);
    }

    this.saveToDisk();
    const token = this.createToken(record.id);
    return {
      token,
      user: this.toPublicUser(record),
      cloudSave: record.cloudSave,
    };
  }

  getMe(token: string): { user: PublicUser; cloudSave: Record<string, unknown> | null } | null {
    const rec = this.verifyToken(token);
    if (!rec) return null;
    return {
      user: this.toPublicUser(rec),
      cloudSave: rec.cloudSave,
    };
  }

  saveCloudSave(
    token: string,
    saveData: Record<string, unknown>,
  ): { cloudSave: Record<string, unknown>; updatedAt: number } | null {
    const rec = this.verifyToken(token);
    if (!rec) return null;
    rec.cloudSave = { ...saveData };
    rec.updatedAt = Date.now();
    this.saveToDisk();
    return { cloudSave: rec.cloudSave, updatedAt: rec.updatedAt };
  }

  getCloudSave(token: string): Record<string, unknown> | null {
    const rec = this.verifyToken(token);
    if (!rec) return null;
    return rec.cloudSave;
  }
}

// ============================================================================
// RoomManager (5-Char Codes, Lobby, Votes, Chat, World Sync, Rescue/Spectator)
// ============================================================================

export interface RoomPlayer {
  id: string;
  nickname: string;
  platform: PlayerPlatform;
  perks: string[];
  avatarId?: string;
  ready: boolean;
  isHost: boolean;
  captured: boolean;
  spectating: boolean;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouching: boolean;
  flashlightOn: boolean;
  uvOn: boolean;
  heldItem: string | null;
  lastUpdateAt: number;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface RoomDoorState {
  open: boolean;
  locked: boolean;
  updatedBy: string;
  updatedAt: number;
}

export interface RoomItemState {
  collected: boolean;
  holderId: string | null;
  x?: number;
  y?: number;
  z?: number;
  updatedAt: number;
}

export interface RoomGeneratorState {
  powered: boolean;
  fuseInserted: boolean;
  progress: number;
  updatedBy?: string;
  updatedAt: number;
}

export interface RoomPingMarker {
  id: string;
  senderId: string;
  senderName: string;
  kind: 'danger' | 'item' | 'help' | 'move';
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface PublicRoomSummary {
  code: string;
  name: string;
  hostName: string;
  chapter: number;
  difficulty: Difficulty;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  allowLobbyVote: boolean;
}

export interface RoomSnapshot {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  chapter: number;
  difficulty: Difficulty;
  allowLobbyVote: boolean;
  maxPlayers: number;
  visibility: RoomVisibility;
  status: RoomStatus;
  seed: number;
  players: RoomPlayer[];
  chat: RoomChatMessage[];
  doors: Record<string, RoomDoorState>;
  items: Record<string, RoomItemState>;
  generator: RoomGeneratorState;
  pings: RoomPingMarker[];
}

export interface CreateRoomInput {
  hostId?: string;
  hostName: string;
  hostPlatform?: PlayerPlatform;
  hostPerks?: string[];
  hostAvatarId?: string;
  name?: string;
  chapter?: number;
  difficulty?: Difficulty;
  allowLobbyVote?: boolean;
  maxPlayers?: number;
  visibility?: RoomVisibility;
}

export interface JoinRoomPlayerInput {
  id?: string;
  nickname: string;
  platform?: PlayerPlatform;
  perks?: string[];
  avatarId?: string;
}

export interface PlayerStateUpdate {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  crouching?: boolean;
  flashlightOn?: boolean;
  uvOn?: boolean;
  heldItem?: string | null;
}

interface InternalRoom {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  chapter: number;
  difficulty: Difficulty;
  allowLobbyVote: boolean;
  maxPlayers: number;
  visibility: RoomVisibility;
  status: RoomStatus;
  seed: number;
  createdAt: number;
  players: Map<string, RoomPlayer>;
  votes: Map<string, { chapter?: number; difficulty?: Difficulty }>;
  chat: RoomChatMessage[];
  doors: Record<string, RoomDoorState>;
  items: Record<string, RoomItemState>;
  generator: RoomGeneratorState;
  pings: RoomPingMarker[];
}

const VALID_DIFFICULTIES: readonly Difficulty[] = ['practice', 'easy', 'hard', 'nightmare'];
const VALID_PLATFORMS: readonly PlayerPlatform[] = ['touch', 'pc', 'gamepad'];

function clampNumber(val: number, min: number, max: number, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function normalizeDifficulty(raw: unknown): Difficulty {
  if (typeof raw === 'string' && (VALID_DIFFICULTIES as readonly string[]).includes(raw)) {
    return raw as Difficulty;
  }
  return 'easy';
}

function normalizePlatform(raw: unknown): PlayerPlatform {
  if (typeof raw === 'string' && (VALID_PLATFORMS as readonly string[]).includes(raw)) {
    return raw as PlayerPlatform;
  }
  return 'pc';
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();

  private toSnapshot(room: InternalRoom): RoomSnapshot {
    return {
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      hostName: room.hostName,
      chapter: room.chapter,
      difficulty: room.difficulty,
      allowLobbyVote: room.allowLobbyVote,
      maxPlayers: room.maxPlayers,
      visibility: room.visibility,
      status: room.status,
      seed: room.seed,
      players: Array.from(room.players.values()).map((p) => ({ ...p, perks: [...p.perks] })),
      chat: room.chat.map((c) => ({ ...c })),
      doors: { ...room.doors },
      items: { ...room.items },
      generator: { ...room.generator },
      pings: room.pings.map((p) => ({ ...p })),
    };
  }

  private getInternalRoom(code: string): InternalRoom {
    const normalized = String(code || '').trim().toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) {
      throw new Error(`Sala "${normalized}" não encontrada.`);
    }
    return room;
  }

  createRoom(input: CreateRoomInput): { room: RoomSnapshot; playerId: string } {
    const existing = new Set(this.rooms.keys());
    const code = generateRoomCode(existing);
    const hostId = input.hostId || `plr_${crypto.randomBytes(8).toString('hex')}`;
    const hostName = (input.hostName || 'Sobrevivente').trim().slice(0, 24) || 'Sobrevivente';
    const maxPlayers = Math.round(clampNumber(input.maxPlayers ?? 4, 2, 5, 4));
    const chapter = Math.round(clampNumber(input.chapter ?? 1, 1, 2, 1));
    const difficulty = normalizeDifficulty(input.difficulty);
    const visibility: RoomVisibility = input.visibility === 'private' ? 'private' : 'public';
    const name = (input.name || `Setor 09 · ${hostName}`).trim().slice(0, 36);
    const now = Date.now();

    const hostPlayer: RoomPlayer = {
      id: hostId,
      nickname: hostName,
      platform: normalizePlatform(input.hostPlatform),
      perks: Array.isArray(input.hostPerks) ? input.hostPerks.slice(0, 4).map(String) : [],
      avatarId: input.hostAvatarId,
      ready: true,
      isHost: true,
      captured: false,
      spectating: false,
      alive: true,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      crouching: false,
      flashlightOn: true,
      uvOn: false,
      heldItem: 'flashlight',
      lastUpdateAt: now,
    };

    const room: InternalRoom = {
      code,
      name,
      hostId,
      hostName,
      chapter,
      difficulty,
      allowLobbyVote: Boolean(input.allowLobbyVote),
      maxPlayers,
      visibility,
      status: 'lobby',
      seed: crypto.randomInt(100000, 999999999),
      createdAt: now,
      players: new Map([[hostId, hostPlayer]]),
      votes: new Map(),
      chat: [],
      doors: {},
      items: {},
      generator: { powered: false, fuseInserted: false, progress: 0, updatedAt: now },
      pings: [],
    };

    this.rooms.set(code, room);
    return { room: this.toSnapshot(room), playerId: hostId };
  }

  listPublicRooms(): PublicRoomSummary[] {
    const out: PublicRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.visibility !== 'public' || room.status === 'ended') continue;
      out.push({
        code: room.code,
        name: room.name,
        hostName: room.hostName,
        chapter: room.chapter,
        difficulty: room.difficulty,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        allowLobbyVote: room.allowLobbyVote,
      });
    }
    return out;
  }

  getRoom(code: string): RoomSnapshot | null {
    const normalized = String(code || '').trim().toUpperCase();
    const room = this.rooms.get(normalized);
    return room ? this.toSnapshot(room) : null;
  }

  joinRoom(
    code: string,
    player: JoinRoomPlayerInput,
  ): { room: RoomSnapshot; playerId: string } {
    const room = this.getInternalRoom(code);
    if (room.status === 'ended') {
      throw new Error('Esta partida já foi encerrada.');
    }

    const playerId = player.id || `plr_${crypto.randomBytes(8).toString('hex')}`;
    if (!room.players.has(playerId) && room.players.size >= room.maxPlayers) {
      throw new Error('Sala cheia.');
    }

    const nickname = (player.nickname || 'Sobrevivente').trim().slice(0, 24) || 'Sobrevivente';
    const now = Date.now();
    const existing = room.players.get(playerId);

    const joinedPlayer: RoomPlayer = existing ?? {
      id: playerId,
      nickname,
      platform: normalizePlatform(player.platform),
      perks: Array.isArray(player.perks) ? player.perks.slice(0, 4).map(String) : [],
      avatarId: player.avatarId,
      ready: false,
      isHost: false,
      captured: false,
      spectating: false,
      alive: true,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      crouching: false,
      flashlightOn: true,
      uvOn: false,
      heldItem: 'flashlight',
      lastUpdateAt: now,
    };

    joinedPlayer.nickname = nickname;
    joinedPlayer.lastUpdateAt = now;
    room.players.set(playerId, joinedPlayer);

    return { room: this.toSnapshot(room), playerId };
  }

  leaveRoom(code: string, playerId: string): RoomSnapshot | null {
    const normalized = String(code || '').trim().toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) return null;

    room.players.delete(playerId);
    room.votes.delete(playerId);

    if (room.players.size === 0) {
      this.rooms.delete(normalized);
      return null;
    }

    if (room.hostId === playerId) {
      const nextHost = room.players.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        nextHost.ready = true;
        room.hostId = nextHost.id;
        room.hostName = nextHost.nickname;
      }
    }

    return this.toSnapshot(room);
  }

  toggleReady(code: string, playerId: string, ready?: boolean): RoomSnapshot {
    const room = this.getInternalRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new Error('Jogador não encontrado na sala.');
    player.ready = typeof ready === 'boolean' ? ready : !player.ready;
    return this.toSnapshot(room);
  }

  castVote(
    code: string,
    playerId: string,
    vote: { chapter?: number; difficulty?: Difficulty },
  ): RoomSnapshot {
    const room = this.getInternalRoom(code);
    if (!room.players.has(playerId)) throw new Error('Jogador não encontrado na sala.');
    if (!room.allowLobbyVote) {
      return this.toSnapshot(room);
    }

    const sanitized: { chapter?: number; difficulty?: Difficulty } = {};
    if (vote.chapter !== undefined) {
      sanitized.chapter = Math.round(clampNumber(vote.chapter, 1, 2, room.chapter));
    }
    if (vote.difficulty !== undefined) {
      sanitized.difficulty = normalizeDifficulty(vote.difficulty);
    }
    room.votes.set(playerId, sanitized);

    // Tally majority votes for chapter & difficulty
    const chapterCounts = new Map<number, number>();
    const diffCounts = new Map<Difficulty, number>();
    for (const v of room.votes.values()) {
      if (v.chapter !== undefined) {
        chapterCounts.set(v.chapter, (chapterCounts.get(v.chapter) ?? 0) + 1);
      }
      if (v.difficulty !== undefined) {
        diffCounts.set(v.difficulty, (diffCounts.get(v.difficulty) ?? 0) + 1);
      }
    }

    let topChapter = room.chapter;
    let topChapterVotes = 0;
    for (const [ch, count] of chapterCounts.entries()) {
      if (count > topChapterVotes) {
        topChapter = ch;
        topChapterVotes = count;
      }
    }
    room.chapter = topChapter;

    let topDiff = room.difficulty;
    let topDiffVotes = 0;
    for (const [d, count] of diffCounts.entries()) {
      if (count > topDiffVotes) {
        topDiff = d;
        topDiffVotes = count;
      }
    }
    room.difficulty = topDiff;

    return this.toSnapshot(room);
  }

  addChatMessage(code: string, playerId: string, text: string): RoomChatMessage {
    const room = this.getInternalRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new Error('Jogador não encontrado na sala.');
    const cleanText = String(text || '').trim().slice(0, 240);
    if (!cleanText) throw new Error('Mensagem vazia.');

    const msg: RoomChatMessage = {
      id: `msg_${crypto.randomBytes(6).toString('hex')}`,
      senderId: player.id,
      senderName: player.nickname,
      text: cleanText,
      timestamp: Date.now(),
    };
    room.chat.push(msg);
    if (room.chat.length > 60) {
      room.chat.splice(0, room.chat.length - 60);
    }
    return msg;
  }

  startMatch(code: string, requesterId: string, seed?: number): RoomSnapshot {
    const room = this.getInternalRoom(code);
    if (room.hostId !== requesterId) {
      throw new Error('Apenas o anfitrião pode iniciar a partida.');
    }
    room.status = 'playing';
    if (typeof seed === 'number' && Number.isFinite(seed)) {
      room.seed = Math.abs(Math.floor(seed)) || room.seed;
    }
    for (const p of room.players.values()) {
      p.captured = false;
      p.spectating = false;
      p.alive = true;
    }
    return this.toSnapshot(room);
  }

  updatePlayerState(
    code: string,
    playerId: string,
    state: PlayerStateUpdate,
  ): RoomPlayer {
    const room = this.getInternalRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new Error('Jogador não encontrado na sala.');

    player.x = clampNumber(state.x, -200, 200, player.x);
    player.y = clampNumber(state.y, -20, 30, player.y);
    player.z = clampNumber(state.z, -200, 200, player.z);
    player.yaw = clampNumber(state.yaw, -Math.PI * 4, Math.PI * 4, player.yaw);
    if (state.pitch !== undefined) {
      player.pitch = clampNumber(state.pitch, -Math.PI / 2, Math.PI / 2, player.pitch);
    }
    if (typeof state.crouching === 'boolean') player.crouching = state.crouching;
    if (typeof state.flashlightOn === 'boolean') player.flashlightOn = state.flashlightOn;
    if (typeof state.uvOn === 'boolean') player.uvOn = state.uvOn;
    if (state.heldItem !== undefined) {
      player.heldItem = state.heldItem === null ? null : String(state.heldItem).slice(0, 40);
    }
    player.lastUpdateAt = Date.now();
    return { ...player, perks: [...player.perks] };
  }

  syncDoor(
    code: string,
    playerId: string,
    doorId: string,
    state: { open: boolean; locked?: boolean },
  ): RoomDoorState {
    const room = this.getInternalRoom(code);
    if (!room.players.has(playerId)) throw new Error('Jogador não encontrado na sala.');
    const safeDoorId = String(doorId || '').slice(0, 64);
    const prev = room.doors[safeDoorId];
    const next: RoomDoorState = {
      open: Boolean(state.open),
      locked: state.locked !== undefined ? Boolean(state.locked) : (prev?.locked ?? false),
      updatedBy: playerId,
      updatedAt: Date.now(),
    };
    room.doors[safeDoorId] = next;
    return { ...next };
  }

  syncItem(
    code: string,
    playerId: string,
    itemId: string,
    state: { collected: boolean; holderId?: string | null; x?: number; y?: number; z?: number },
  ): RoomItemState {
    const room = this.getInternalRoom(code);
    if (!room.players.has(playerId)) throw new Error('Jogador não encontrado na sala.');
    const safeItemId = String(itemId || '').slice(0, 64);
    const next: RoomItemState = {
      collected: Boolean(state.collected),
      holderId: state.holderId !== undefined ? state.holderId : state.collected ? playerId : null,
      x: state.x !== undefined ? clampNumber(state.x, -200, 200, 0) : undefined,
      y: state.y !== undefined ? clampNumber(state.y, -20, 30, 0) : undefined,
      z: state.z !== undefined ? clampNumber(state.z, -200, 200, 0) : undefined,
      updatedAt: Date.now(),
    };
    room.items[safeItemId] = next;
    return { ...next };
  }

  syncGenerator(
    code: string,
    playerId: string,
    state: { powered?: boolean; fuseInserted?: boolean; progress?: number },
  ): RoomGeneratorState {
    const room = this.getInternalRoom(code);
    if (!room.players.has(playerId)) throw new Error('Jogador não encontrado na sala.');
    if (typeof state.powered === 'boolean') room.generator.powered = state.powered;
    if (typeof state.fuseInserted === 'boolean') room.generator.fuseInserted = state.fuseInserted;
    if (typeof state.progress === 'number') {
      room.generator.progress = clampNumber(state.progress, 0, 100, room.generator.progress);
    }
    room.generator.updatedBy = playerId;
    room.generator.updatedAt = Date.now();
    return { ...room.generator };
  }

  syncPing(
    code: string,
    playerId: string,
    ping: { kind?: 'danger' | 'item' | 'help' | 'move'; x: number; y: number; z: number },
  ): RoomPingMarker {
    const room = this.getInternalRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new Error('Jogador não encontrado na sala.');
    const validKinds = ['danger', 'item', 'help', 'move'] as const;
    const kind =
      ping.kind && (validKinds as readonly string[]).includes(ping.kind) ? ping.kind : 'move';
    const marker: RoomPingMarker = {
      id: `png_${crypto.randomBytes(6).toString('hex')}`,
      senderId: player.id,
      senderName: player.nickname,
      kind,
      x: clampNumber(ping.x, -200, 200, 0),
      y: clampNumber(ping.y, -20, 30, 0),
      z: clampNumber(ping.z, -200, 200, 0),
      timestamp: Date.now(),
    };
    room.pings.push(marker);
    if (room.pings.length > 20) {
      room.pings.splice(0, room.pings.length - 20);
    }
    return { ...marker };
  }

  capturePlayer(code: string, targetPlayerId: string): RoomSnapshot {
    const room = this.getInternalRoom(code);
    const player = room.players.get(targetPlayerId);
    if (!player) throw new Error('Jogador não encontrado na sala.');
    player.captured = true;
    player.spectating = true;
    player.alive = false;
    return this.toSnapshot(room);
  }

  rescuePlayer(code: string, rescuerId: string, targetPlayerId: string): RoomSnapshot {
    const room = this.getInternalRoom(code);
    if (!room.players.has(rescuerId)) throw new Error('Resgatador não encontrado na sala.');
    const target = room.players.get(targetPlayerId);
    if (!target) throw new Error('Jogador capturado não encontrado na sala.');
    target.captured = false;
    target.spectating = false;
    target.alive = true;
    return this.toSnapshot(room);
  }

  getActiveRoomCodes(): string[] {
    return Array.from(this.rooms.keys());
  }
}

// ============================================================================
// Pure RFC 6455 WebSocket Frame Codec (Zero external dependencies)
// ============================================================================

export function encodeWsFrame(payload: string | Buffer, opcode = 0x1): Buffer {
  const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  const len = data.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

interface DecodedWsFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

function decodeWsFrames(buffer: Buffer): { frames: DecodedWsFrame[]; remaining: Buffer } {
  const frames: DecodedWsFrame[] = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      const bigLen = buffer.readBigUInt64BE(offset + 2);
      if (bigLen > BigInt(MAX_WS_PAYLOAD_BYTES)) {
        throw new Error('WebSocket payload too large');
      }
      payloadLen = Number(bigLen);
      headerLen = 10;
    }

    if (payloadLen > MAX_WS_PAYLOAD_BYTES) {
      throw new Error('WebSocket payload too large');
    }

    const maskLen = masked ? 4 : 0;
    const totalLen = headerLen + maskLen + payloadLen;
    if (offset + totalLen > buffer.length) break;

    const payloadStart = offset + headerLen + maskLen;
    const payload = Buffer.allocUnsafe(payloadLen);
    if (masked) {
      const maskKey = buffer.subarray(offset + headerLen, offset + headerLen + 4);
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = buffer[payloadStart + i] ^ maskKey[i & 3];
      }
    } else {
      buffer.copy(payload, 0, payloadStart, payloadStart + payloadLen);
    }

    frames.push({ fin, opcode, payload });
    offset += totalLen;
  }

  return { frames, remaining: buffer.subarray(offset) };
}

interface WsClientConnection {
  id: string;
  socket: Duplex;
  roomCode: string | null;
  playerId: string | null;
  buffer: Buffer;
  closed: boolean;
  sendJson: (msg: Record<string, unknown>) => void;
}

// ============================================================================
// Express App + HTTP Server + 20Hz WebSocket Hub Factory
// ============================================================================

export interface CreateServerAppOptions {
  authPersistPath?: string | null;
  tokenSecret?: string;
  serveStaticDir?: string | null;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function createServerApp(options: CreateServerAppOptions = {}) {
  const app = express();
  const authStore = new AuthStore({
    persistPath: options.authPersistPath ?? null,
    tokenSecret: options.tokenSecret,
  });
  const roomManager = new RoomManager();

  app.use(express.json({ limit: '2mb' }));

  // Permissive CORS for local dev / cross-origin clients
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, time: Date.now() });
  });

  // ---- Auth & Cloud Save Routes ----

  app.post('/api/auth/signup', (req: Request, res: Response) => {
    try {
      const { nickname, email, password, guestSave } = req.body ?? {};
      const result = authStore.signUp({ nickname, email, password, guestSave });
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta.';
      res.status(400).json({ ok: false, error: message });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password, guestSave } = req.body ?? {};
      const result = authStore.login({ email, password, guestSave });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar.';
      res.status(401).json({ ok: false, error: message });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) authStore.revokeToken(token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Token ausente.' });
      return;
    }
    const me = authStore.getMe(token);
    if (!me) {
      res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' });
      return;
    }
    res.json({ ok: true, ...me });
  });

  app.get('/api/cloud-save', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Token ausente.' });
      return;
    }
    const me = authStore.getMe(token);
    if (!me) {
      res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' });
      return;
    }
    res.json({ ok: true, cloudSave: me.cloudSave });
  });

  app.put('/api/cloud-save', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Token ausente.' });
      return;
    }
    const saveData = req.body?.saveData ?? req.body;
    if (!saveData || typeof saveData !== 'object') {
      res.status(400).json({ ok: false, error: 'Payload de save inválido.' });
      return;
    }
    const saved = authStore.saveCloudSave(token, saveData as Record<string, unknown>);
    if (!saved) {
      res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' });
      return;
    }
    res.json({ ok: true, ...saved });
  });

  // ---- Google OAuth 2.0 ----

  app.get('/api/auth/google', (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(501).json({
        ok: false,
        configured: false,
        message: 'Google OAuth requer GOOGLE_CLIENT_ID configurado no servidor.',
      });
      return;
    }

    const origin =
      process.env.PUBLIC_ORIGIN ||
      `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
    const state = crypto.randomBytes(12).toString('hex');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    if (req.query.mode === 'json' || req.headers.accept?.includes('application/json')) {
      res.json({ ok: true, configured: true, authUrl });
      return;
    }
    res.redirect(authUrl);
  });

  app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(501).json({
        ok: false,
        configured: false,
        message: 'Google OAuth requer GOOGLE_CLIENT_ID configurado no servidor.',
      });
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.status(400).json({ ok: false, error: 'Código OAuth ausente.' });
      return;
    }

    try {
      const origin =
        process.env.PUBLIC_ORIGIN ||
        `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenResp.ok) {
        res.status(502).json({ ok: false, error: 'Falha ao trocar token com o Google.' });
        return;
      }
      const tokenData = (await tokenResp.json()) as { access_token?: string };
      if (!tokenData.access_token) {
        res.status(502).json({ ok: false, error: 'Access token Google ausente.' });
        return;
      }

      const profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileResp.ok) {
        res.status(502).json({ ok: false, error: 'Falha ao obter perfil Google.' });
        return;
      }
      const profile = (await profileResp.json()) as {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
      };

      const session = authStore.upsertGoogleUser({
        googleId: profile.sub,
        email: profile.email,
        nickname: profile.name || profile.email.split('@')[0],
        avatarUrl: profile.picture,
      });

      const appRedirect = process.env.FRONTEND_URL || '/';
      res.redirect(`${appRedirect}#auth_token=${encodeURIComponent(session.token)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no callback Google OAuth.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // ---- Multiplayer REST Routes ----

  app.get('/api/rooms', (_req: Request, res: Response) => {
    res.json({ ok: true, rooms: roomManager.listPublicRooms() });
  });

  app.post('/api/rooms', (req: Request, res: Response) => {
    try {
      const created = roomManager.createRoom(req.body ?? {});
      res.status(201).json({ ok: true, ...created });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar sala.';
      res.status(400).json({ ok: false, error: message });
    }
  });

  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const room = roomManager.getRoom(req.params.code);
    if (!room) {
      res.status(404).json({ ok: false, error: 'Sala não encontrada.' });
      return;
    }
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:code/join', (req: Request, res: Response) => {
    try {
      const joined = roomManager.joinRoom(req.params.code, req.body ?? {});
      res.json({ ok: true, ...joined });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar na sala.';
      res.status(400).json({ ok: false, error: message });
    }
  });

  // Optional static serving for production build
  if (options.serveStaticDir && fs.existsSync(options.serveStaticDir)) {
    app.use(express.static(options.serveStaticDir));
  }

  // ---- HTTP Server + RFC 6455 WebSocket Endpoint (/ws) ----

  const server = http.createServer(app);
  const clients = new Set<WsClientConnection>();

  function broadcastToRoom(
    roomCode: string,
    payload: Record<string, unknown>,
    excludeClientId?: string,
  ): void {
    const encoded = encodeWsFrame(JSON.stringify(payload), 0x1);
    for (const c of clients) {
      if (c.closed || c.roomCode !== roomCode) continue;
      if (excludeClientId && c.id === excludeClientId) continue;
      try {
        c.socket.write(encoded);
      } catch {
        // Ignore write errors on closing sockets
      }
    }
  }

  function handleWsMessage(client: WsClientConnection, rawText: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      client.sendJson({ type: 'error', error: 'JSON inválido.' });
      return;
    }

    const type = String(msg.type || '');
    try {
      switch (type) {
        case 'ping': {
          client.sendJson({
            type: 'pong',
            clientTime: msg.clientTime ?? Date.now(),
            serverTime: Date.now(),
          });
          break;
        }
        case 'list_rooms': {
          client.sendJson({ type: 'rooms_list', rooms: roomManager.listPublicRooms() });
          break;
        }
        case 'create_room': {
          if (client.roomCode && client.playerId) {
            const prev = roomManager.leaveRoom(client.roomCode, client.playerId);
            if (prev) broadcastToRoom(client.roomCode, { type: 'room_update', room: prev });
          }
          const payload = (msg.payload ?? msg) as CreateRoomInput;
          const created = roomManager.createRoom(payload);
          client.roomCode = created.room.code;
          client.playerId = created.playerId;
          client.sendJson({
            type: 'room_joined',
            room: created.room,
            playerId: created.playerId,
          });
          break;
        }
        case 'join_room': {
          const code = String(msg.code || '').trim().toUpperCase();
          const player = (msg.player ?? msg) as JoinRoomPlayerInput;
          if (client.roomCode && client.playerId && client.roomCode !== code) {
            const prev = roomManager.leaveRoom(client.roomCode, client.playerId);
            if (prev) broadcastToRoom(client.roomCode, { type: 'room_update', room: prev });
          }
          const joined = roomManager.joinRoom(code, player);
          client.roomCode = joined.room.code;
          client.playerId = joined.playerId;
          client.sendJson({
            type: 'room_joined',
            room: joined.room,
            playerId: joined.playerId,
          });
          broadcastToRoom(joined.room.code, { type: 'room_update', room: joined.room }, client.id);
          break;
        }
        case 'leave_room': {
          if (client.roomCode && client.playerId) {
            const code = client.roomCode;
            const updated = roomManager.leaveRoom(code, client.playerId);
            client.roomCode = null;
            client.playerId = null;
            client.sendJson({ type: 'room_left', code });
            if (updated) {
              broadcastToRoom(code, { type: 'room_update', room: updated });
            }
          }
          break;
        }
        case 'toggle_ready': {
          if (!client.roomCode || !client.playerId) return;
          const room = roomManager.toggleReady(
            client.roomCode,
            client.playerId,
            typeof msg.ready === 'boolean' ? msg.ready : undefined,
          );
          broadcastToRoom(client.roomCode, { type: 'room_update', room });
          break;
        }
        case 'cast_vote': {
          if (!client.roomCode || !client.playerId) return;
          const room = roomManager.castVote(client.roomCode, client.playerId, {
            chapter: typeof msg.chapter === 'number' ? msg.chapter : undefined,
            difficulty: typeof msg.difficulty === 'string' ? (msg.difficulty as Difficulty) : undefined,
          });
          broadcastToRoom(client.roomCode, { type: 'room_update', room });
          break;
        }
        case 'chat': {
          if (!client.roomCode || !client.playerId) return;
          const message = roomManager.addChatMessage(
            client.roomCode,
            client.playerId,
            String(msg.text || ''),
          );
          broadcastToRoom(client.roomCode, { type: 'chat_message', message });
          break;
        }
        case 'start_match': {
          if (!client.roomCode || !client.playerId) return;
          const seed = typeof msg.seed === 'number' ? msg.seed : undefined;
          const room = roomManager.startMatch(client.roomCode, client.playerId, seed);
          broadcastToRoom(client.roomCode, {
            type: 'match_started',
            room,
            seed: room.seed,
          });
          break;
        }
        case 'player_state': {
          if (!client.roomCode || !client.playerId) return;
          roomManager.updatePlayerState(client.roomCode, client.playerId, {
            x: Number(msg.x),
            y: Number(msg.y),
            z: Number(msg.z),
            yaw: Number(msg.yaw),
            pitch: msg.pitch !== undefined ? Number(msg.pitch) : undefined,
            crouching: typeof msg.crouching === 'boolean' ? msg.crouching : undefined,
            flashlightOn: typeof msg.flashlightOn === 'boolean' ? msg.flashlightOn : undefined,
            uvOn: typeof msg.uvOn === 'boolean' ? msg.uvOn : undefined,
            heldItem:
              msg.heldItem === null || typeof msg.heldItem === 'string'
                ? (msg.heldItem as string | null)
                : undefined,
          });
          break;
        }
        case 'sync_door': {
          if (!client.roomCode || !client.playerId) return;
          const doorId = String(msg.doorId || '');
          const state = roomManager.syncDoor(client.roomCode, client.playerId, doorId, {
            open: Boolean(msg.open),
            locked: typeof msg.locked === 'boolean' ? msg.locked : undefined,
          });
          broadcastToRoom(client.roomCode, { type: 'door_synced', doorId, state });
          break;
        }
        case 'sync_item': {
          if (!client.roomCode || !client.playerId) return;
          const itemId = String(msg.itemId || '');
          const state = roomManager.syncItem(client.roomCode, client.playerId, itemId, {
            collected: Boolean(msg.collected),
            holderId:
              msg.holderId === null || typeof msg.holderId === 'string'
                ? (msg.holderId as string | null)
                : undefined,
            x: typeof msg.x === 'number' ? msg.x : undefined,
            y: typeof msg.y === 'number' ? msg.y : undefined,
            z: typeof msg.z === 'number' ? msg.z : undefined,
          });
          broadcastToRoom(client.roomCode, { type: 'item_synced', itemId, state });
          break;
        }
        case 'sync_generator': {
          if (!client.roomCode || !client.playerId) return;
          const generator = roomManager.syncGenerator(client.roomCode, client.playerId, {
            powered: typeof msg.powered === 'boolean' ? msg.powered : undefined,
            fuseInserted: typeof msg.fuseInserted === 'boolean' ? msg.fuseInserted : undefined,
            progress: typeof msg.progress === 'number' ? msg.progress : undefined,
          });
          broadcastToRoom(client.roomCode, { type: 'generator_synced', generator });
          break;
        }
        case 'sync_ping': {
          if (!client.roomCode || !client.playerId) return;
          const ping = roomManager.syncPing(client.roomCode, client.playerId, {
            kind: typeof msg.kind === 'string' ? (msg.kind as 'danger' | 'item' | 'help' | 'move') : 'move',
            x: Number(msg.x),
            y: Number(msg.y),
            z: Number(msg.z),
          });
          broadcastToRoom(client.roomCode, { type: 'ping_synced', ping });
          break;
        }
        case 'capture_player': {
          if (!client.roomCode) return;
          const targetId = String(msg.targetPlayerId || client.playerId || '');
          const room = roomManager.capturePlayer(client.roomCode, targetId);
          broadcastToRoom(client.roomCode, {
            type: 'player_captured',
            targetPlayerId: targetId,
            room,
          });
          break;
        }
        case 'rescue_player': {
          if (!client.roomCode || !client.playerId) return;
          const targetId = String(msg.targetPlayerId || '');
          const room = roomManager.rescuePlayer(client.roomCode, client.playerId, targetId);
          broadcastToRoom(client.roomCode, {
            type: 'player_rescued',
            targetPlayerId: targetId,
            rescuerId: client.playerId,
            room,
          });
          break;
        }
        default: {
          client.sendJson({ type: 'error', error: `Tipo de mensagem desconhecido: ${type}` });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro interno de sala.';
      client.sendJson({ type: 'error', error: message });
    }
  }

  function cleanupClient(client: WsClientConnection): void {
    if (client.closed) return;
    client.closed = true;
    clients.delete(client);
    if (client.roomCode && client.playerId) {
      const code = client.roomCode;
      const updated = roomManager.leaveRoom(code, client.playerId);
      client.roomCode = null;
      client.playerId = null;
      if (updated) {
        broadcastToRoom(code, { type: 'room_update', room: updated });
      }
    }
  }

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const upgrade = String(req.headers.upgrade || '').toLowerCase();
    const wsKey = req.headers['sec-websocket-key'];
    if (upgrade !== 'websocket' || typeof wsKey !== 'string' || !wsKey) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(wsKey + WS_MAGIC_GUID)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n',
      ].join('\r\n'),
    );

    const client: WsClientConnection = {
      id: `ws_${crypto.randomBytes(6).toString('hex')}`,
      socket,
      roomCode: null,
      playerId: null,
      buffer: head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0),
      closed: false,
      sendJson(payload: Record<string, unknown>) {
        if (this.closed) return;
        try {
          this.socket.write(encodeWsFrame(JSON.stringify(payload), 0x1));
        } catch {
          // Ignore write errors
        }
      },
    };
    clients.add(client);

    const processBuffer = () => {
      try {
        const { frames, remaining } = decodeWsFrames(client.buffer);
        client.buffer = remaining;
        for (const frame of frames) {
          if (frame.opcode === 0x8) {
            // Close frame
            try {
              socket.write(encodeWsFrame(Buffer.alloc(0), 0x8));
            } catch {
              // ignore
            }
            cleanupClient(client);
            socket.end();
            return;
          }
          if (frame.opcode === 0x9) {
            // Ping -> Pong
            try {
              socket.write(encodeWsFrame(frame.payload, 0xa));
            } catch {
              // ignore
            }
            continue;
          }
          if (frame.opcode === 0xa) {
            // Pong
            continue;
          }
          if (frame.opcode === 0x1) {
            handleWsMessage(client, frame.payload.toString('utf8'));
          }
        }
      } catch {
        cleanupClient(client);
        socket.destroy();
      }
    };

    if (client.buffer.length > 0) {
      processBuffer();
    }

    socket.on('data', (chunk: Buffer) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      processBuffer();
    });
    socket.on('close', () => cleanupClient(client));
    socket.on('end', () => cleanupClient(client));
    socket.on('error', () => cleanupClient(client));
  });

  // 20Hz authoritative state broadcast tick
  const tickInterval = setInterval(() => {
    if (clients.size === 0) return;
    const now = Date.now();
    const activeRooms = new Set<string>();
    for (const c of clients) {
      if (!c.closed && c.roomCode) activeRooms.add(c.roomCode);
    }
    for (const code of activeRooms) {
      const snap = roomManager.getRoom(code);
      if (!snap || snap.status !== 'playing') continue;
      broadcastToRoom(code, {
        type: 'state_snapshot',
        roomCode: code,
        serverTime: now,
        players: snap.players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          pitch: p.pitch,
          crouching: p.crouching,
          flashlightOn: p.flashlightOn,
          uvOn: p.uvOn,
          heldItem: p.heldItem,
          captured: p.captured,
          spectating: p.spectating,
          alive: p.alive,
        })),
      });
    }
  }, TICK_RATE_MS);
  if (typeof tickInterval.unref === 'function') {
    tickInterval.unref();
  }

  function close(): Promise<void> {
    clearInterval(tickInterval);
    for (const c of Array.from(clients)) {
      try {
        c.socket.destroy();
      } catch {
        // ignore
      }
      cleanupClient(c);
    }
    return new Promise((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
  }

  return { app, server, authStore, roomManager, close };
}

// Guard auto-listen so importing server.ts in tests never binds a port
const isMainModule = (() => {
  try {
    if (typeof process === 'undefined' || !process.argv[1]) return false;
    return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const port = Number(process.env.PORT) || 3001;
  const persistPath = path.resolve(process.cwd(), '.data', 'users.json');
  const distDir = path.resolve(process.cwd(), 'dist');
  const { server } = createServerApp({
    authPersistPath: persistPath,
    serveStaticDir: distDir,
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`[Setor 09 Server] Listening on http://0.0.0.0:${port} (WS /ws @ 20Hz)`);
  });
}
