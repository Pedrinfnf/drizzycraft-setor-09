import type { Difficulty } from '../game/types';
import { OnlineRelayTransport, RELAY_PREFIX } from './OnlineRelayTransport';

// ============================================================================
// Constants & Types
// ============================================================================

export const INTERP_DELAY_MS = 60;
export const SEND_RATE_HZ = 20;
export const SEND_INTERVAL_MS = 1000 / SEND_RATE_HZ; // 50ms

const LOCAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type PlayerPlatform = 'touch' | 'pc' | 'gamepad';
export type RoomVisibility = 'public' | 'private';
export type RoomStatus = 'lobby' | 'playing' | 'ended';
export type MultiplayerConnectionMode = 'online' | 'local' | 'connecting' | 'disconnected';

export interface PeerTransformSnapshot {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouching?: boolean;
  flashlightOn?: boolean;
  uvOn?: boolean;
  heldItem?: string | null;
  captured?: boolean;
  spectating?: boolean;
  alive?: boolean;
}

export interface RoomPlayerInfo {
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
  pingMs?: number;
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
  players: RoomPlayerInfo[];
  chat: RoomChatMessage[];
  doors: Record<string, { open: boolean; locked: boolean; updatedBy: string; updatedAt: number }>;
  items: Record<
    string,
    { collected: boolean; holderId: string | null; x?: number; y?: number; z?: number; updatedAt: number }
  >;
  generator: { powered: boolean; fuseInserted: boolean; progress: number; updatedAt: number };
  pings: Array<{
    id: string;
    senderId: string;
    senderName: string;
    kind: 'danger' | 'item' | 'help' | 'move';
    x: number;
    y: number;
    z: number;
    timestamp: number;
  }>;
}

export interface CreateRoomParams {
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

export interface JoinRoomParams {
  nickname: string;
  platform?: PlayerPlatform;
  perks?: string[];
  avatarId?: string;
}

// ============================================================================
// PeerInterpolationBuffer (Pure Testable Class — Zero Extrapolation!)
// ============================================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Buffers timestamped server snapshots for a remote peer and linearly interpolates
 * between two real server coordinates (t0 <= renderTime <= t1) with ~60ms delay.
 * NEVER extrapolates past the latest real server coordinate (zero wall clipping).
 */
export class PeerInterpolationBuffer {
  public readonly delayMs: number;
  private readonly maxSnapshots: number;
  private snapshots: PeerTransformSnapshot[] = [];

  constructor(delayMs: number = INTERP_DELAY_MS, maxSnapshots = 32) {
    this.delayMs = Math.max(0, delayMs);
    this.maxSnapshots = Math.max(2, maxSnapshots);
  }

  push(snapshot: PeerTransformSnapshot): void {
    const copy: PeerTransformSnapshot = { ...snapshot };
    const len = this.snapshots.length;
    if (len === 0 || copy.timestamp > this.snapshots[len - 1].timestamp) {
      this.snapshots.push(copy);
    } else if (copy.timestamp === this.snapshots[len - 1].timestamp) {
      this.snapshots[len - 1] = copy;
    } else {
      // Insert in ascending timestamp order
      let idx = this.snapshots.findIndex((s) => s.timestamp >= copy.timestamp);
      if (idx === -1) {
        this.snapshots.push(copy);
      } else if (this.snapshots[idx].timestamp === copy.timestamp) {
        this.snapshots[idx] = copy;
      } else {
        this.snapshots.splice(idx, 0, copy);
      }
    }

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    }
  }

  sample(nowMs: number): PeerTransformSnapshot | null {
    const len = this.snapshots.length;
    if (len === 0) return null;
    if (len === 1) return { ...this.snapshots[0] };

    const renderTime = nowMs - this.delayMs;

    // Clamp to earliest real snapshot (no backward extrapolation)
    if (renderTime <= this.snapshots[0].timestamp) {
      return { ...this.snapshots[0] };
    }

    // Clamp to latest real snapshot (NEVER extrapolate past latest real server coordinate!)
    const latest = this.snapshots[len - 1];
    if (renderTime >= latest.timestamp) {
      return { ...latest };
    }

    // Find bracketing snapshots: t0 <= renderTime <= t1
    for (let i = 0; i < len - 1; i++) {
      const s0 = this.snapshots[i];
      const s1 = this.snapshots[i + 1];
      if (renderTime >= s0.timestamp && renderTime <= s1.timestamp) {
        const span = s1.timestamp - s0.timestamp;
        const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTime - s0.timestamp) / span)) : 1;
        const discrete = alpha < 0.5 ? s0 : s1;
        return {
          timestamp: renderTime,
          x: lerp(s0.x, s1.x, alpha),
          y: lerp(s0.y, s1.y, alpha),
          z: lerp(s0.z, s1.z, alpha),
          yaw: lerpAngle(s0.yaw, s1.yaw, alpha),
          pitch: lerp(s0.pitch, s1.pitch, alpha),
          crouching: discrete.crouching,
          flashlightOn: discrete.flashlightOn,
          uvOn: discrete.uvOn,
          heldItem: discrete.heldItem,
          captured: discrete.captured,
          spectating: discrete.spectating,
          alive: discrete.alive,
        };
      }
    }

    return { ...latest };
  }

  getLatest(): PeerTransformSnapshot | null {
    if (this.snapshots.length === 0) return null;
    return { ...this.snapshots[this.snapshots.length - 1] };
  }

  clear(): void {
    this.snapshots = [];
  }

  get length(): number {
    return this.snapshots.length;
  }
}

// ============================================================================
// MultiplayerClient (WebSocket 20Hz + Graceful Local-Lobby Fallback)
// ============================================================================

export type MultiplayerEventType =
  | 'room_update'
  | 'chat_message'
  | 'match_started'
  | 'state_snapshot'
  | 'door_synced'
  | 'item_synced'
  | 'generator_synced'
  | 'ping_synced'
  | 'player_captured'
  | 'player_rescued'
  | 'connection_change'
  | 'ping_update'
  | 'error';

type EventHandler = (payload: unknown) => void;

function generateLocalRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += LOCAL_CODE_ALPHABET[Math.floor(Math.random() * LOCAL_CODE_ALPHABET.length)];
  }
  return code;
}

export interface MultiplayerClientOptions {
  wsUrl?: string;
  apiBase?: string;
  connectTimeoutMs?: number;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private relay: OnlineRelayTransport | null = null;
  private transport: 'none' | 'server' | 'relay' = 'none';
  private relayPublicRooms = new Map<string, PublicRoomSummary & { updatedAt: number }>();
  private relayHostHeartbeat: ReturnType<typeof setInterval> | null = null;
  private relayRoomTopic: string | null = null;
  private relayUnsubMsg: (() => void) | null = null;
  private isRelayHost = false;
  private readonly customWsUrl?: string;
  private readonly apiBase: string;
  private readonly connectTimeoutMs: number;
  private listeners = new Map<MultiplayerEventType, Set<EventHandler>>();
  private peerBuffers = new Map<string, PeerInterpolationBuffer>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastStateSentAt = 0;
  private pendingJoinResolve:
    | ((res: { ok: boolean; room?: RoomSnapshot; playerId?: string; error?: string }) => void)
    | null = null;

  public mode: MultiplayerConnectionMode = 'disconnected';
  public pingMs: number | null = null;
  public currentRoom: RoomSnapshot | null = null;
  public playerId: string | null = null;

  constructor(options: MultiplayerClientOptions = {}) {
    this.customWsUrl = options.wsUrl;
    this.apiBase = options.apiBase ?? '';
    this.connectTimeoutMs = options.connectTimeoutMs ?? 1500;
  }

  on(event: MultiplayerEventType, handler: EventHandler): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  private emit(event: MultiplayerEventType, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch {
        // Isolate subscriber errors
      }
    }
  }

  private setMode(next: MultiplayerConnectionMode): void {
    if (this.mode === next) return;
    this.mode = next;
    this.emit('connection_change', { mode: next });
  }

  private resolveWsUrl(): string | null {
    if (this.customWsUrl) return this.customWsUrl;
    if (typeof window === 'undefined' || !window.location) return null;
    // On static hosts like GitHub Pages (*.github.io), skip dead /ws probe and go straight to Global Online Relay
    const host = window.location.hostname || '';
    if (host.endsWith('.github.io') || host.endsWith('.pages.dev') || host.endsWith('.netlify.app')) {
      return null;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private async connectGlobalRelay(): Promise<boolean> {
    if (this.relay && this.relay.isConnected()) {
      this.transport = 'relay';
      this.setMode('online');
      return true;
    }
    const relay = new OnlineRelayTransport();
    relay.onPingUpdate = (ms) => {
      this.pingMs = ms;
      this.emit('ping_update', { pingMs: ms });
    };
    relay.onDisconnect = () => {
      if (this.transport === 'relay') {
        this.transport = 'none';
        this.setMode('disconnected');
      }
    };
    const ok = await relay.connect(4000);
    if (!ok) return false;

    this.relay = relay;
    this.transport = 'relay';
    this.pingMs = relay.pingMs;
    this.relayUnsubMsg?.();
    this.relayUnsubMsg = relay.onMessage((topic, payload) => {
      this.handleRelayMessage(topic, payload);
    });
    relay.subscribe(`${RELAY_PREFIX}/public/+`);
    this.setMode('online');
    return true;
  }

  async connect(): Promise<'online' | 'local'> {
    if (this.transport === 'server' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.setMode('online');
      return 'online';
    }
    if (this.transport === 'relay' && this.relay && this.relay.isConnected()) {
      this.setMode('online');
      return 'online';
    }
    if (typeof WebSocket === 'undefined') {
      this.setMode('local');
      return 'local';
    }

    this.setMode('connecting');
    const url = this.resolveWsUrl();
    if (url) {
      const serverOk = await new Promise<boolean>((resolve) => {
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          this.cleanupSocket();
          resolve(false);
        };
        const timeout = setTimeout(fail, this.connectTimeoutMs);
        try {
          const ws = new WebSocket(url);
          this.ws = ws;
          ws.onopen = () => {
            if (settled) {
              ws.close();
              return;
            }
            settled = true;
            clearTimeout(timeout);
            this.transport = 'server';
            this.setMode('online');
            this.startPingLoop();
            resolve(true);
          };
          ws.onmessage = (ev) => {
            this.handleRawMessage(String(ev.data || ''));
          };
          ws.onerror = () => {
            clearTimeout(timeout);
            fail();
          };
          ws.onclose = () => {
            clearTimeout(timeout);
            if (!settled) {
              fail();
              return;
            }
            this.stopPingLoop();
            this.ws = null;
            if (this.transport === 'server') {
              this.transport = 'none';
              this.setMode('disconnected');
            }
          };
        } catch {
          clearTimeout(timeout);
          fail();
        }
      });
      if (serverOk) return 'online';
    }

    // Connect to Global Online WSS Relay (real internet crossplay anywhere in the world!)
    const relayOk = await this.connectGlobalRelay();
    if (relayOk) return 'online';

    this.setMode('local');
    return 'local';
  }

  private stopRelayHostHeartbeat(): void {
    if (this.relayHostHeartbeat) {
      clearInterval(this.relayHostHeartbeat);
      this.relayHostHeartbeat = null;
    }
  }

  private publishRelayPublicListing(clear = false): void {
    if (!this.relay || !this.currentRoom || !this.isRelayHost) return;
    if (this.currentRoom.visibility !== 'public') return;
    const topic = `${RELAY_PREFIX}/public/${this.currentRoom.code}`;
    if (clear) {
      this.relay.publish(topic, '', true);
      return;
    }
    const summary: PublicRoomSummary & { updatedAt: number } = {
      code: this.currentRoom.code,
      name: this.currentRoom.name,
      hostName: this.currentRoom.hostName,
      chapter: this.currentRoom.chapter,
      difficulty: this.currentRoom.difficulty,
      playerCount: this.currentRoom.players.length,
      maxPlayers: this.currentRoom.maxPlayers,
      status: this.currentRoom.status,
      allowLobbyVote: this.currentRoom.allowLobbyVote,
      updatedAt: Date.now(),
    };
    this.relay.publish(topic, summary, true);
  }

  private broadcastRelayRoom(payload: Record<string, unknown>): boolean {
    if (!this.relay || !this.relayRoomTopic) return false;
    return this.relay.publish(this.relayRoomTopic, {
      ...payload,
      senderId: this.playerId,
      ts: Date.now(),
    });
  }

  private handleRelayMessage(topic: string, rawPayload: string): void {
    const publicPrefix = `${RELAY_PREFIX}/public/`;
    if (topic.startsWith(publicPrefix)) {
      const code = topic.slice(publicPrefix.length).trim().toUpperCase();
      if (!rawPayload || rawPayload.trim() === '') {
        this.relayPublicRooms.delete(code);
        return;
      }
      try {
        const summary = JSON.parse(rawPayload) as PublicRoomSummary & { updatedAt?: number };
        if (summary && summary.code && summary.status === 'lobby') {
          this.relayPublicRooms.set(summary.code, {
            ...summary,
            updatedAt: Number(summary.updatedAt) || Date.now(),
          });
        } else {
          this.relayPublicRooms.delete(code);
        }
      } catch {
        // ignore malformed listing
      }
      return;
    }

    if (!this.relayRoomTopic || topic !== this.relayRoomTopic) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      return;
    }
    const senderId = typeof msg.senderId === 'string' ? msg.senderId : '';
    if (senderId && senderId === this.playerId) return;

    const type = String(msg.type || '');
    const now = Date.now();

    if (type === 'join_req' && this.isRelayHost && this.currentRoom) {
      const reqPlayer = msg.player as JoinRoomParams | undefined;
      const reqId = String(msg.reqPlayerId || '');
      if (!reqPlayer || !reqId) return;
      if (this.currentRoom.status !== 'lobby') {
        this.broadcastRelayRoom({ type: 'join_nak', targetId: reqId, error: 'Partida já iniciada.' });
        return;
      }
      if (this.currentRoom.players.length >= this.currentRoom.maxPlayers) {
        this.broadcastRelayRoom({ type: 'join_nak', targetId: reqId, error: 'Sala cheia.' });
        return;
      }
      const existing = this.currentRoom.players.find((p) => p.id === reqId);
      if (!existing) {
        const newPlayer: RoomSnapshot['players'][number] = {
          id: reqId,
          nickname: (reqPlayer.nickname || 'Sobrevivente').trim().slice(0, 24) || 'Sobrevivente',
          platform: reqPlayer.platform ?? 'pc',
          perks: reqPlayer.perks ? [...reqPlayer.perks] : [],
          avatarId: reqPlayer.avatarId,
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
        this.currentRoom = {
          ...this.currentRoom,
          players: [...this.currentRoom.players, newPlayer],
        };
      }
      this.publishRelayPublicListing(false);
      this.emit('room_update', this.currentRoom);
      this.broadcastRelayRoom({ type: 'join_ack', targetId: reqId, room: this.currentRoom });
      this.broadcastRelayRoom({ type: 'room_snapshot', room: this.currentRoom });
      return;
    }

    if (type === 'join_ack' && String(msg.targetId || '') === this.playerId && msg.room) {
      this.currentRoom = msg.room as RoomSnapshot;
      this.emit('room_update', this.currentRoom);
      if (this.pendingJoinResolve) {
        const fn = this.pendingJoinResolve;
        this.pendingJoinResolve = null;
        fn({ ok: true, room: this.currentRoom, playerId: this.playerId ?? undefined });
      }
      return;
    }

    if (type === 'join_nak' && String(msg.targetId || '') === this.playerId) {
      if (this.pendingJoinResolve) {
        const fn = this.pendingJoinResolve;
        this.pendingJoinResolve = null;
        fn({ ok: false, error: String(msg.error || 'Não foi possível entrar na sala.') });
      }
      return;
    }

    if (type === 'room_snapshot' && msg.room) {
      this.currentRoom = msg.room as RoomSnapshot;
      this.emit('room_update', this.currentRoom);
      return;
    }

    if (type === 'toggle_ready' && this.isRelayHost && this.currentRoom && senderId) {
      const players = this.currentRoom.players.map((p) =>
        p.id === senderId ? { ...p, ready: typeof msg.ready === 'boolean' ? msg.ready : !p.ready } : p
      );
      this.currentRoom = { ...this.currentRoom, players };
      this.emit('room_update', this.currentRoom);
      this.broadcastRelayRoom({ type: 'room_snapshot', room: this.currentRoom });
      return;
    }

    if (type === 'cast_vote' && this.isRelayHost && this.currentRoom && this.currentRoom.allowLobbyVote) {
      this.currentRoom = {
        ...this.currentRoom,
        chapter: typeof msg.chapter === 'number' ? msg.chapter : this.currentRoom.chapter,
        difficulty: (msg.difficulty as Difficulty) ?? this.currentRoom.difficulty,
      };
      this.publishRelayPublicListing(false);
      this.emit('room_update', this.currentRoom);
      this.broadcastRelayRoom({ type: 'room_snapshot', room: this.currentRoom });
      return;
    }

    if (type === 'leave_room' && this.isRelayHost && this.currentRoom && senderId) {
      this.peerBuffers.delete(senderId);
      this.currentRoom = {
        ...this.currentRoom,
        players: this.currentRoom.players.filter((p) => p.id !== senderId),
      };
      this.publishRelayPublicListing(false);
      this.emit('room_update', this.currentRoom);
      this.broadcastRelayRoom({ type: 'room_snapshot', room: this.currentRoom });
      return;
    }

    if (type === 'chat' && msg.message) {
      const chatMsg = msg.message as RoomChatMessage;
      if (this.currentRoom) {
        this.currentRoom = {
          ...this.currentRoom,
          chat: [...this.currentRoom.chat.slice(-59), chatMsg],
        };
      }
      this.emit('chat_message', chatMsg);
      return;
    }

    if (type === 'match_started' && msg.room) {
      this.currentRoom = msg.room as RoomSnapshot;
      this.emit('match_started', { room: this.currentRoom, seed: Number(msg.seed) || this.currentRoom.seed });
      return;
    }

    if (type === 'player_state' && senderId) {
      let buf = this.peerBuffers.get(senderId);
      if (!buf) {
        buf = new PeerInterpolationBuffer(INTERP_DELAY_MS);
        this.peerBuffers.set(senderId, buf);
      }
      buf.push({
        timestamp: Number(msg.ts) || now,
        x: Number(msg.x) || 0,
        y: Number(msg.y) || 0,
        z: Number(msg.z) || 0,
        yaw: Number(msg.yaw) || 0,
        pitch: Number(msg.pitch) || 0,
        crouching: Boolean(msg.crouching),
        flashlightOn: Boolean(msg.flashlightOn),
        uvOn: Boolean(msg.uvOn),
        heldItem: typeof msg.heldItem === 'string' ? msg.heldItem : null,
        captured: Boolean(msg.captured),
        spectating: Boolean(msg.spectating),
        alive: msg.alive !== false,
      });
      return;
    }

    if (type === 'sync_door') this.emit('door_synced', msg);
    else if (type === 'sync_item') this.emit('item_synced', msg);
    else if (type === 'sync_generator') this.emit('generator_synced', msg);
    else if (type === 'sync_ping') this.emit('ping_synced', msg);
    else if (type === 'capture_player') this.emit('player_captured', msg);
    else if (type === 'rescue_player') this.emit('player_rescued', msg);
  }

  disconnect(): void {
    this.leaveRoom();
    this.cleanupSocket();
    this.relayUnsubMsg?.();
    this.relayUnsubMsg = null;
    this.relay?.disconnect();
    this.relay = null;
    this.transport = 'none';
    this.peerBuffers.clear();
    this.pingMs = null;
    this.setMode('disconnected');
  }

  private cleanupSocket(): void {
    this.stopPingLoop();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    const sendPing = () => {
      this.sendRaw({ type: 'ping', clientTime: Date.now() });
    };
    sendPing();
    this.pingTimer = setInterval(sendPing, 3000);
  }

  private stopPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendRaw(payload: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  private handleRawMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = String(msg.type || '');
    switch (type) {
      case 'pong': {
        const sentAt = Number(msg.clientTime);
        if (Number.isFinite(sentAt)) {
          this.pingMs = Math.max(1, Math.round(Date.now() - sentAt));
          this.emit('ping_update', { pingMs: this.pingMs });
        }
        break;
      }
      case 'room_joined': {
        const room = msg.room as RoomSnapshot;
        const playerId = String(msg.playerId || '');
        this.currentRoom = room;
        this.playerId = playerId;
        this.emit('room_update', room);
        if (this.pendingJoinResolve) {
          const fn = this.pendingJoinResolve;
          this.pendingJoinResolve = null;
          fn({ ok: true, room, playerId });
        }
        break;
      }
      case 'room_update': {
        const room = msg.room as RoomSnapshot;
        this.currentRoom = room;
        this.emit('room_update', room);
        break;
      }
      case 'chat_message': {
        const chatMsg = msg.message as RoomChatMessage;
        if (this.currentRoom && chatMsg) {
          this.currentRoom = {
            ...this.currentRoom,
            chat: [...this.currentRoom.chat.slice(-59), chatMsg],
          };
        }
        this.emit('chat_message', chatMsg);
        break;
      }
      case 'match_started': {
        const room = msg.room as RoomSnapshot;
        this.currentRoom = room;
        this.emit('match_started', { room, seed: msg.seed ?? room?.seed });
        break;
      }
      case 'state_snapshot': {
        const serverTime = Number(msg.serverTime) || Date.now();
        const players = Array.isArray(msg.players)
          ? (msg.players as Array<Record<string, unknown>>)
          : [];
        for (const p of players) {
          const id = String(p.id || '');
          if (!id || id === this.playerId) continue;
          let buf = this.peerBuffers.get(id);
          if (!buf) {
            buf = new PeerInterpolationBuffer(INTERP_DELAY_MS);
            this.peerBuffers.set(id, buf);
          }
          buf.push({
            timestamp: serverTime,
            x: Number(p.x) || 0,
            y: Number(p.y) || 0,
            z: Number(p.z) || 0,
            yaw: Number(p.yaw) || 0,
            pitch: Number(p.pitch) || 0,
            crouching: Boolean(p.crouching),
            flashlightOn: Boolean(p.flashlightOn),
            uvOn: Boolean(p.uvOn),
            heldItem:
              p.heldItem === null || typeof p.heldItem === 'string'
                ? (p.heldItem as string | null)
                : null,
            captured: Boolean(p.captured),
            spectating: Boolean(p.spectating),
            alive: p.alive !== false,
          });
        }
        this.emit('state_snapshot', { serverTime, players });
        break;
      }
      case 'door_synced':
        this.emit('door_synced', msg);
        break;
      case 'item_synced':
        this.emit('item_synced', msg);
        break;
      case 'generator_synced':
        this.emit('generator_synced', msg);
        break;
      case 'ping_synced':
        this.emit('ping_synced', msg);
        break;
      case 'player_captured':
        if (msg.room) this.currentRoom = msg.room as RoomSnapshot;
        this.emit('player_captured', msg);
        break;
      case 'player_rescued':
        if (msg.room) this.currentRoom = msg.room as RoomSnapshot;
        this.emit('player_rescued', msg);
        break;
      case 'error': {
        const err = String(msg.error || 'Erro multiplayer.');
        this.emit('error', { error: err });
        if (this.pendingJoinResolve) {
          const fn = this.pendingJoinResolve;
          this.pendingJoinResolve = null;
          fn({ ok: false, error: err });
        }
        break;
      }
    }
  }

  async listPublicRooms(): Promise<{ rooms: PublicRoomSummary[]; mode: 'online' | 'local' }> {
    const connMode = await this.connect();
    if (connMode === 'online' && this.transport === 'server' && typeof fetch === 'function') {
      try {
        const resp = await fetch(`${this.apiBase}/api/rooms`, {
          headers: { Accept: 'application/json' },
        });
        const ct = resp.headers.get('content-type') || '';
        if (resp.ok && ct.includes('application/json')) {
          const data = (await resp.json()) as { ok?: boolean; rooms?: PublicRoomSummary[] };
          if (data.ok && Array.isArray(data.rooms)) {
            return { rooms: data.rooms, mode: 'online' };
          }
        }
      } catch {
        // Fall through
      }
    }
    if (connMode === 'online' && this.transport === 'relay') {
      // Give retained public room listings a brief moment on first connect
      if (this.relayPublicRooms.size === 0) {
        await new Promise((r) => setTimeout(r, 320));
      }
      const cutoff = Date.now() - 25000;
      const live: PublicRoomSummary[] = [];
      for (const [code, entry] of this.relayPublicRooms.entries()) {
        if (entry.updatedAt < cutoff || entry.status !== 'lobby') {
          this.relayPublicRooms.delete(code);
          continue;
        }
        const { updatedAt: _u, ...summary } = entry;
        live.push(summary);
      }
      return { rooms: live, mode: 'online' };
    }
    return { rooms: [], mode: 'local' };
  }

  async createRoom(params: CreateRoomParams): Promise<{
    ok: boolean;
    room?: RoomSnapshot;
    playerId?: string;
    mode: 'online' | 'local';
    error?: string;
  }> {
    const connMode = await this.connect();
    if (connMode === 'online' && this.transport === 'server') {
      const res = await new Promise<{
        ok: boolean;
        room?: RoomSnapshot;
        playerId?: string;
        error?: string;
      }>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingJoinResolve = null;
          resolve({ ok: false, error: 'Tempo esgotado ao criar sala.' });
        }, 3000);
        this.pendingJoinResolve = (r) => {
          clearTimeout(timer);
          resolve(r);
        };
        this.sendRaw({ type: 'create_room', payload: params });
      });
      return { ...res, mode: 'online' };
    }

    const code = generateLocalRoomCode();
    const isRelay = connMode === 'online' && this.transport === 'relay';
    const playerId = `${isRelay ? 'p' : 'local'}_${Math.random().toString(36).slice(2, 10)}`;
    const now = Date.now();
    const hostName = (params.hostName || 'Sobrevivente').trim().slice(0, 24) || 'Sobrevivente';
    const maxPlayers = Math.max(2, Math.min(5, Math.round(params.maxPlayers ?? 4)));
    const room: RoomSnapshot = {
      code,
      name: (params.name || `Sala · ${hostName}`).trim().slice(0, 36),
      hostId: playerId,
      hostName,
      chapter: params.chapter ?? 1,
      difficulty: params.difficulty ?? 'easy',
      allowLobbyVote: Boolean(params.allowLobbyVote),
      maxPlayers,
      visibility: params.visibility ?? 'public',
      status: 'lobby',
      seed: Math.floor(100000 + Math.random() * 899999),
      players: [
        {
          id: playerId,
          nickname: hostName,
          platform: params.hostPlatform ?? 'pc',
          perks: params.hostPerks ? [...params.hostPerks] : [],
          avatarId: params.hostAvatarId,
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
        },
      ],
      chat: [],
      doors: {},
      items: {},
      generator: { powered: false, fuseInserted: false, progress: 0, updatedAt: now },
      pings: [],
    };
    this.currentRoom = room;
    this.playerId = playerId;

    if (isRelay && this.relay) {
      this.isRelayHost = true;
      this.relayRoomTopic = `${RELAY_PREFIX}/room/${code}`;
      this.relay.subscribe(this.relayRoomTopic);
      this.publishRelayPublicListing(false);
      this.stopRelayHostHeartbeat();
      this.relayHostHeartbeat = setInterval(() => {
        if (this.currentRoom && this.currentRoom.status === 'lobby') {
          this.publishRelayPublicListing(false);
        }
      }, 4500);
      this.emit('room_update', room);
      return { ok: true, room, playerId, mode: 'online' };
    }

    this.emit('room_update', room);
    return { ok: true, room, playerId, mode: 'local' };
  }

  async joinRoom(
    code: string,
    player: JoinRoomParams,
  ): Promise<{
    ok: boolean;
    room?: RoomSnapshot;
    playerId?: string;
    mode: 'online' | 'local';
    error?: string;
  }> {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (cleanCode.length !== 5) {
      return {
        ok: false,
        mode: this.mode === 'online' ? 'online' : 'local',
        error: 'Código da sala deve ter 5 caracteres.',
      };
    }

    const connMode = await this.connect();
    if (connMode === 'online' && this.transport === 'server') {
      const res = await new Promise<{
        ok: boolean;
        room?: RoomSnapshot;
        playerId?: string;
        error?: string;
      }>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingJoinResolve = null;
          resolve({ ok: false, error: 'Tempo esgotado ao entrar na sala.' });
        }, 3000);
        this.pendingJoinResolve = (r) => {
          clearTimeout(timer);
          resolve(r);
        };
        this.sendRaw({ type: 'join_room', code: cleanCode, player });
      });
      return { ...res, mode: 'online' };
    }

    if (connMode === 'online' && this.transport === 'relay' && this.relay) {
      const myId = `p_${Math.random().toString(36).slice(2, 10)}`;
      this.playerId = myId;
      this.isRelayHost = false;
      this.relayRoomTopic = `${RELAY_PREFIX}/room/${cleanCode}`;
      this.relay.subscribe(this.relayRoomTopic);

      const res = await new Promise<{
        ok: boolean;
        room?: RoomSnapshot;
        playerId?: string;
        error?: string;
      }>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingJoinResolve = null;
          if (this.relayRoomTopic) {
            this.relay?.unsubscribe(this.relayRoomTopic);
            this.relayRoomTopic = null;
          }
          resolve({ ok: false, error: `Sala "${cleanCode}" não encontrada ou host offline.` });
        }, 4200);
        this.pendingJoinResolve = (r) => {
          clearTimeout(timer);
          resolve(r);
        };
        // Short delay so MQTT SUBSCRIBE completes before publishing join_req
        setTimeout(() => {
          this.broadcastRelayRoom({ type: 'join_req', reqPlayerId: myId, player });
        }, 120);
      });
      return { ...res, mode: 'online' };
    }

    return {
      ok: false,
      mode: 'local',
      error: 'Sem conexão com a internet para entrar na sala online.',
    };
  }

  leaveRoom(): void {
    if (this.mode === 'online' && this.transport === 'server') {
      this.sendRaw({ type: 'leave_room' });
    } else if (this.transport === 'relay') {
      if (this.isRelayHost) {
        this.publishRelayPublicListing(true);
        this.stopRelayHostHeartbeat();
      } else {
        this.broadcastRelayRoom({ type: 'leave_room' });
      }
      if (this.relayRoomTopic) {
        this.relay?.unsubscribe(this.relayRoomTopic);
        this.relayRoomTopic = null;
      }
      this.isRelayHost = false;
    }
    this.currentRoom = null;
    this.playerId = null;
    this.peerBuffers.clear();
  }

  toggleReady(ready?: boolean): void {
    if (this.mode === 'online' && this.transport === 'server') {
      this.sendRaw({ type: 'toggle_ready', ready });
      return;
    }
    if (this.currentRoom && this.playerId) {
      const nextReady = typeof ready === 'boolean' ? ready : !this.currentRoom.players.find((p) => p.id === this.playerId)?.ready;
      const players = this.currentRoom.players.map((p) =>
        p.id === this.playerId ? { ...p, ready: nextReady } : p,
      );
      this.currentRoom = { ...this.currentRoom, players };
      this.emit('room_update', this.currentRoom);
      if (this.transport === 'relay') {
        if (this.isRelayHost) {
          this.broadcastRelayRoom({ type: 'room_snapshot', room: this.currentRoom });
        } else {
          this.broadcastRelayRoom({ type: 'toggle_ready', ready: nextReady });
        }
      }
    }
  }

  castVote(vote: { chapter?: number; difficulty?: Difficulty }): void {
    if (this.mode === 'online' && this.transport === 'server') {
      this.sendRaw({ type: 'cast_vote', ...vote });
      return;
    }
    if (this.currentRoom && this.currentRoom.allowLobbyVote) {
      if (this.transport === 'relay' && !this.isRelayHost) {
        this.broadcastRelayRoom({ type: 'cast_vote', ...vote });
        return;
      }
      this.currentRoom = {
        ...this.currentRoom,
        chapter: vote.chapter ?? this.currentRoom.chapter,
        difficulty: vote.difficulty ?? this.currentRoom.difficulty,
      };
      this.emit('room_update', this.currentRoom);
      if (this.transport === 'relay' && this.isRelayHost) {
        this.publishRelayPublicListing(false);
        this.broadcastRelayRoom({ type: 'room_snapshot', room: this.currentRoom });
      }
    }
  }

  sendChat(text: string): void {
    const clean = String(text || '').trim().slice(0, 240);
    if (!clean) return;
    if (this.mode === 'online' && this.transport === 'server') {
      this.sendRaw({ type: 'chat', text: clean });
      return;
    }
    if (this.currentRoom && this.playerId) {
      const me = this.currentRoom.players.find((p) => p.id === this.playerId);
      const msg: RoomChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderId: this.playerId,
        senderName: me?.nickname || 'Sobrevivente',
        text: clean,
        timestamp: Date.now(),
      };
      this.currentRoom = {
        ...this.currentRoom,
        chat: [...this.currentRoom.chat.slice(-59), msg],
      };
      this.emit('chat_message', msg);
      if (this.transport === 'relay') {
        this.broadcastRelayRoom({ type: 'chat', message: msg });
      }
    }
  }

  startMatch(seed?: number): void {
    if (this.mode === 'online' && this.transport === 'server') {
      this.sendRaw({ type: 'start_match', seed });
      return;
    }
    if (this.currentRoom) {
      const nextSeed = typeof seed === 'number' ? seed : this.currentRoom.seed;
      this.currentRoom = { ...this.currentRoom, status: 'playing', seed: nextSeed };
      if (this.transport === 'relay' && this.isRelayHost) {
        this.publishRelayPublicListing(true);
        this.stopRelayHostHeartbeat();
        this.broadcastRelayRoom({ type: 'match_started', room: this.currentRoom, seed: nextSeed });
      }
      this.emit('match_started', { room: this.currentRoom, seed: nextSeed });
    }
  }

  /**
   * 20Hz throttled player state sender. Returns true if sent on this call.
   */
  sendPlayerState(
    state: Omit<PeerTransformSnapshot, 'timestamp'>,
    nowMs: number = Date.now(),
  ): boolean {
    if (nowMs - this.lastStateSentAt < SEND_INTERVAL_MS) {
      return false;
    }
    this.lastStateSentAt = nowMs;
    if (this.mode !== 'online') return false;
    if (this.transport === 'relay') {
      return this.broadcastRelayRoom({ type: 'player_state', ...state });
    }
    return this.sendRaw({
      type: 'player_state',
      ...state,
    });
  }

  getInterpolatedPeer(peerId: string, nowMs: number = Date.now()): PeerTransformSnapshot | null {
    const buf = this.peerBuffers.get(peerId);
    return buf ? buf.sample(nowMs) : null;
  }

  getAllInterpolatedPeers(nowMs: number = Date.now()): Record<string, PeerTransformSnapshot> {
    const result: Record<string, PeerTransformSnapshot> = {};
    for (const [id, buf] of this.peerBuffers.entries()) {
      const sampled = buf.sample(nowMs);
      if (sampled) result[id] = sampled;
    }
    return result;
  }

  syncDoor(doorId: string, open: boolean, locked?: boolean): void {
    if (this.mode !== 'online') return;
    if (this.transport === 'relay') this.broadcastRelayRoom({ type: 'sync_door', doorId, open, locked });
    else this.sendRaw({ type: 'sync_door', doorId, open, locked });
  }

  syncItem(
    itemId: string,
    state: { collected: boolean; holderId?: string | null; x?: number; y?: number; z?: number },
  ): void {
    if (this.mode !== 'online') return;
    if (this.transport === 'relay') this.broadcastRelayRoom({ type: 'sync_item', itemId, ...state });
    else this.sendRaw({ type: 'sync_item', itemId, ...state });
  }

  syncGenerator(state: { powered?: boolean; fuseInserted?: boolean; progress?: number }): void {
    if (this.mode !== 'online') return;
    if (this.transport === 'relay') this.broadcastRelayRoom({ type: 'sync_generator', ...state });
    else this.sendRaw({ type: 'sync_generator', ...state });
  }

  syncPing(ping: {
    kind?: 'danger' | 'item' | 'help' | 'move';
    x: number;
    y: number;
    z: number;
  }): void {
    if (this.mode !== 'online') return;
    if (this.transport === 'relay') this.broadcastRelayRoom({ type: 'sync_ping', ...ping });
    else this.sendRaw({ type: 'sync_ping', ...ping });
  }

  capturePlayer(targetPlayerId: string): void {
    if (this.mode !== 'online') return;
    if (this.transport === 'relay') this.broadcastRelayRoom({ type: 'capture_player', targetPlayerId });
    else this.sendRaw({ type: 'capture_player', targetPlayerId });
  }

  rescuePlayer(targetPlayerId: string): void {
    if (this.mode !== 'online') return;
    if (this.transport === 'relay') this.broadcastRelayRoom({ type: 'rescue_player', targetPlayerId });
    else this.sendRaw({ type: 'rescue_player', targetPlayerId });
  }
}

export const multiplayerClient = new MultiplayerClient();
