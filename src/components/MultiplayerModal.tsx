import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Gamepad2,
  Globe,
  KeyRound,
  Lock,
  MessageSquare,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Smartphone,
  User,
  Users,
  X,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS, DIFFICULTY_ORDER } from '../game/difficulty';
import type { Difficulty, InputMode, Language } from '../game/types';
import { t } from '../i18n/translations';
import {
  multiplayerClient,
  type PlayerPlatform,
  type PublicRoomSummary,
  type RoomChatMessage,
  type RoomSnapshot,
  type RoomVisibility,
} from '../network/MultiplayerClient';

export interface MultiplayerModalProps {
  language: Language;
  initialView?: 'select' | 'hub';
  selectedDifficulty: Difficulty;
  equippedPerksCount: number;
  nickname: string;
  inputMode: InputMode;
  portraits: Record<string, string>;
  chatFilter: boolean;
  onStartSolo: (diff: Difficulty) => void;
  onStartMultiplayer: (roomCode: string, diff: Difficulty, seed: number) => void;
  onClose: () => void;
}

type ModalView = 'select' | 'hub' | 'lobby';

const FILTERED_WORDS = [
  'porra',
  'caralho',
  'merda',
  'puta',
  'fdp',
  'desgraca',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'mierda',
  'joder',
];

function sanitizeChatMessage(text: string, enabled: boolean): string {
  if (!enabled) return text;
  let out = text;
  for (const word of FILTERED_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    out = out.replace(re, '***');
  }
  return out;
}

function getPlatformIcon(platform: PlayerPlatform) {
  if (platform === 'touch') return <Smartphone className="w-3 h-3 text-emerald-300" />;
  if (platform === 'gamepad') return <Gamepad2 className="w-3 h-3 text-amber-300" />;
  return <Monitor className="w-3 h-3 text-cyan-300" />;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  language,
  initialView = 'select',
  selectedDifficulty,
  equippedPerksCount,
  nickname,
  inputMode,
  portraits,
  chatFilter,
  onStartSolo,
  onStartMultiplayer,
  onClose,
}) => {
  const [view, setView] = useState<ModalView>(initialView);
  const [soloDiff, setSoloDiff] = useState<Difficulty>(selectedDifficulty);

  // Hub state
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [connMode, setConnMode] = useState<'online' | 'local'>('local');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [hubError, setHubError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Room Creator state
  const [roomName, setRoomName] = useState(`Operação ${nickname || 'Setor 09'}`);
  const [chapter, setChapter] = useState<number>(1);
  const [roomDiff, setRoomDiff] = useState<Difficulty>(selectedDifficulty);
  const [allowLobbyVote, setAllowLobbyVote] = useState<boolean>(true);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [visibility, setVisibility] = useState<RoomVisibility>('public');

  // Lobby state
  const [room, setRoom] = useState<RoomSnapshot | null>(multiplayerClient.currentRoom);
  const [chatInput, setChatInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const safeNickname = (nickname || 'Agente09').trim() || 'Agente09';

  const refreshRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await multiplayerClient.listPublicRooms();
      setPublicRooms(res.rooms);
      setConnMode(res.mode);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (view === 'hub') {
      void refreshRooms();
    }
  }, [view, refreshRooms]);

  useEffect(() => {
    const unsubRoom = multiplayerClient.on('room_update', (payload) => {
      const next = payload as RoomSnapshot | null;
      if (next) {
        setRoom({ ...next });
      }
    });
    const unsubChat = multiplayerClient.on('chat_message', (payload) => {
      const msg = payload as RoomChatMessage | null;
      if (!msg) return;
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.chat.some((c) => c.id === msg.id)) return prev;
        return { ...prev, chat: [...prev.chat.slice(-59), msg] };
      });
    });
    const unsubStart = multiplayerClient.on('match_started', (payload) => {
      const data = payload as { room?: RoomSnapshot; seed?: number };
      const targetRoom = data?.room ?? multiplayerClient.currentRoom;
      if (targetRoom) {
        onStartMultiplayer(
          targetRoom.code,
          targetRoom.difficulty,
          typeof data?.seed === 'number' ? data.seed : targetRoom.seed
        );
      }
    });
    const unsubErr = multiplayerClient.on('error', (payload) => {
      const data = payload as { error?: string };
      if (data?.error) setHubError(data.error);
    });

    return () => {
      unsubRoom();
      unsubChat();
      unsubStart();
      unsubErr();
    };
  }, [onStartMultiplayer]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setHubError(null);
    setBusy(true);
    try {
      const res = await multiplayerClient.createRoom({
        hostName: safeNickname,
        hostPlatform: inputMode,
        hostPerks: equippedPerksCount > 0 ? [`${equippedPerksCount} Perks`] : [],
        hostAvatarId: 'marcos',
        name: roomName.trim() || `Operação ${safeNickname}`,
        chapter,
        difficulty: roomDiff,
        allowLobbyVote,
        maxPlayers,
        visibility,
      });
      setConnMode(res.mode);
      if (res.ok && res.room) {
        setRoom(res.room);
        setView('lobby');
      } else {
        setHubError(res.error || 'Não foi possível criar a sala.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleJoinByCode = async (codeToJoin: string) => {
    const clean = codeToJoin.trim().toUpperCase();
    if (clean.length !== 5) {
      setHubError('Informe um código válido de 5 caracteres.');
      return;
    }
    setHubError(null);
    setBusy(true);
    try {
      const res = await multiplayerClient.joinRoom(clean, {
        nickname: safeNickname,
        platform: inputMode,
        perks: equippedPerksCount > 0 ? [`${equippedPerksCount} Perks`] : [],
        avatarId: 'marcos',
      });
      setConnMode(res.mode);
      if (res.ok && res.room) {
        setRoom(res.room);
        setView('lobby');
      } else {
        setHubError(res.error || 'Sala não encontrada.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    multiplayerClient.sendChat(trimmed);
    setChatInput('');
  };

  const handleLeaveLobby = () => {
    multiplayerClient.leaveRoom();
    setRoom(null);
    setView('hub');
  };

  const localPlayer = room?.players.find((p) => p.id === multiplayerClient.playerId) ?? null;
  const isHost = Boolean(localPlayer?.isHost);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'mode.title')}
      data-testid="multiplayer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/84 backdrop-blur-md p-2 sm:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Tactical Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-cyan-500/35 bg-slate-950/92 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {view !== 'select' && (
              <button
                type="button"
                onClick={() => {
                  if (view === 'lobby') handleLeaveLobby();
                  else setView('select');
                }}
                aria-label={t(language, 'common.back')}
                className="horror-btn p-1.5 text-slate-300 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="w-1.5 h-6 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.65)] shrink-0" />
            <div className="min-w-0">
              <h2 className="font-horror text-lg sm:text-2xl font-extrabold tracking-wider uppercase text-white leading-none truncate">
                {view === 'select'
                  ? t(language, 'mode.title')
                  : view === 'hub'
                  ? t(language, 'mp.hubTitle')
                  : t(language, 'mp.lobbyTitle')}
              </h2>
              <div className="text-[10px] font-tech uppercase tracking-[0.16em] text-cyan-300 mt-0.5 truncate">
                {view === 'select'
                  ? t(language, 'mode.subtitle')
                  : connMode === 'online'
                  ? 'REDE CROSSPLAY ONLINE · 20HZ SYNC'
                  : 'MODO LOBBY LOCAL · CROSSPLAY PRONTO'}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="mp-close-btn"
            onClick={onClose}
            aria-label={t(language, 'common.close')}
            className="horror-btn horror-btn-danger px-3 py-1.5 text-[11px] font-tech font-bold uppercase text-white flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t(language, 'common.close')}</span>
          </button>
        </div>

        {/* Error Strip */}
        {hubError && (
          <div
            role="alert"
            data-testid="mp-error-banner"
            className="px-4 py-2 bg-red-950/85 border-b border-red-500/60 text-xs font-tech font-bold text-red-200 flex items-center justify-between gap-2 shrink-0"
          >
            <span>{hubError}</span>
            <button
              type="button"
              onClick={() => setHubError(null)}
              className="opacity-75 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto horror-scroll p-3.5 sm:p-5">
          {/* ==============================================================
              VIEW 1: MODE SELECTOR (MODO SOLO vs MULTIPLAYER ONLINE)
              ============================================================== */}
          {view === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MODO SOLO */}
              <div
                data-testid="mode-card-solo"
                className="p-4 bg-slate-950/85 border border-amber-500/50 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-tech font-bold uppercase bg-amber-950/80 border border-amber-500/60 text-amber-300">
                      {t(language, 'mode.solo.badge')}
                    </span>
                    <span className="text-[10px] font-tech text-emerald-300 uppercase">
                      {t(language, 'mode.perksEquipped', { count: equippedPerksCount })}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-horror text-2xl font-extrabold uppercase tracking-wider text-white">
                      {t(language, 'mode.solo.title')}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {t(language, 'mode.solo.desc')}
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="text-[10px] font-tech uppercase tracking-wider text-slate-400">
                      {t(language, 'title.chapter1')}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {DIFFICULTY_ORDER.map((diff) => {
                        const cfg = DIFFICULTY_CONFIGS[diff];
                        const active = soloDiff === diff;
                        return (
                          <button
                            key={diff}
                            type="button"
                            data-testid={`solo-diff-${diff}`}
                            onClick={() => setSoloDiff(diff)}
                            className={`py-1.5 px-2 text-[11px] font-horror font-bold uppercase border cursor-pointer transition-colors ${
                              active
                                ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                                : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-100'
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="mp-start-solo-btn"
                  onClick={() => onStartSolo(soloDiff)}
                  className="horror-btn horror-btn-primary w-full py-3 px-4 flex items-center justify-center gap-2 font-horror text-base font-extrabold uppercase tracking-widest cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{t(language, 'mode.solo.cta')}</span>
                </button>
              </div>

              {/* MULTIPLAYER ONLINE (CROSSPLAY) */}
              <div
                data-testid="mode-card-multiplayer"
                className="p-4 bg-slate-950/85 border border-cyan-500/55 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-tech font-bold uppercase bg-cyan-950/80 border border-cyan-500/60 text-cyan-300">
                      {t(language, 'mode.mp.badge')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-tech text-slate-300 uppercase">
                      {getPlatformIcon(inputMode)}
                      <span>{t(language, `mp.platform.${inputMode}`)}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="font-horror text-2xl font-extrabold uppercase tracking-wider text-white">
                      {t(language, 'mode.mp.title')}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {t(language, 'mode.mp.desc')}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-tech text-[10px]">
                    <div className="p-2 bg-slate-900/80 border border-slate-800 text-slate-300">
                      <Globe className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <span>SALAS PÚBLICAS</span>
                    </div>
                    <div className="p-2 bg-slate-900/80 border border-slate-800 text-slate-300">
                      <KeyRound className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <span>CÓDIGO 5 CHARS</span>
                    </div>
                    <div className="p-2 bg-slate-900/80 border border-slate-800 text-slate-300">
                      <Users className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <span>2–5 AGENTES</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="mp-open-hub-btn"
                  onClick={() => setView('hub')}
                  className="horror-btn w-full py-3 px-4 border-cyan-400/80 text-cyan-200 flex items-center justify-center gap-2 font-horror text-base font-extrabold uppercase tracking-widest cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>{t(language, 'mode.mp.cta')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              VIEW 2: MULTIPLAYER HUB (BROWSER + QUICK CODE + ROOM CREATOR)
              ============================================================== */}
          {view === 'hub' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Public Room Browser + Quick 5-Char Code Join */}
              <div className="lg:col-span-7 space-y-3">
                {/* Quick 5-Char Room Code Join */}
                <div className="p-3 bg-slate-950/85 border border-amber-500/45 space-y-2">
                  <div className="text-xs font-horror font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4" />
                    <span>{t(language, 'mp.quickJoinTitle')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      data-testid="mp-join-code-input"
                      maxLength={5}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder={t(language, 'mp.codePlaceholder')}
                      className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm font-tech font-extrabold tracking-[0.25em] uppercase text-white"
                    />
                    <button
                      type="button"
                      data-testid="mp-join-code-btn"
                      disabled={busy || joinCode.length !== 5}
                      onClick={() => void handleJoinByCode(joinCode)}
                      className="horror-btn horror-btn-amber px-4 py-2 text-xs font-tech font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {t(language, 'mp.joinBtn')}
                    </button>
                  </div>
                </div>

                {/* Public Room Browser */}
                <div className="p-3 bg-slate-950/85 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-horror font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <Globe className="w-4 h-4" />
                      <span>{t(language, 'mp.publicRooms')}</span>
                    </div>
                    <button
                      type="button"
                      data-testid="mp-refresh-rooms-btn"
                      disabled={loadingRooms}
                      onClick={() => void refreshRooms()}
                      className="horror-btn px-2.5 py-1 text-[10px] font-tech font-bold uppercase flex items-center gap-1 text-slate-300 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingRooms ? 'animate-spin' : ''}`} />
                      <span>{t(language, 'mp.refresh')}</span>
                    </button>
                  </div>

                  {publicRooms.length === 0 ? (
                    <div className="py-8 text-center text-xs font-tech text-slate-400 border border-dashed border-slate-800">
                      {t(language, 'mp.noRooms')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {publicRooms.map((r) => (
                        <div
                          key={r.code}
                          data-testid={`mp-room-row-${r.code}`}
                          className="p-2.5 bg-slate-900/85 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-horror text-sm font-bold text-white truncate">
                                {r.name}
                              </span>
                              <span className="px-1.5 py-0.5 text-[9px] font-tech font-bold bg-slate-950 border border-cyan-500/40 text-cyan-300">
                                {r.code}
                              </span>
                            </div>
                            <div className="text-[10px] font-tech text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                              <span>HOST: {r.hostName}</span>
                              <span>·</span>
                              <span>CAP. {r.chapter}</span>
                              <span>·</span>
                              <span className="text-amber-300 uppercase">
                                {DIFFICULTY_CONFIGS[r.difficulty]?.label ?? r.difficulty}
                              </span>
                              <span>·</span>
                              <span className="text-emerald-300">
                                {r.playerCount}/{r.maxPlayers}
                              </span>
                              {r.pingMs != null && (
                                <>
                                  <span>·</span>
                                  <span>{t(language, 'mp.ping', { ms: r.pingMs })}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={busy || r.playerCount >= r.maxPlayers}
                            onClick={() => void handleJoinByCode(r.code)}
                            className="horror-btn px-3 py-1.5 text-[11px] font-tech font-bold uppercase text-cyan-200 border-cyan-500/60 cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {t(language, 'mp.joinBtn')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Full Room Creator */}
              <form
                onSubmit={handleCreateRoom}
                className="lg:col-span-5 p-3.5 bg-slate-950/90 border border-cyan-500/45 space-y-3"
              >
                <div className="text-xs font-horror font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>{t(language, 'mp.createRoomTitle')}</span>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="mp-room-name"
                    className="text-[10px] font-tech font-bold uppercase text-slate-300"
                  >
                    {t(language, 'mp.roomName')}
                  </label>
                  <input
                    id="mp-room-name"
                    data-testid="mp-create-name-input"
                    type="text"
                    maxLength={36}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder={t(language, 'mp.roomNamePlaceholder')}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:outline-none px-2.5 py-1.5 text-xs font-tech text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-tech font-bold uppercase text-slate-300">
                      {t(language, 'mp.chapter')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChapter(1)}
                      className="w-full py-1.5 px-2 text-[11px] font-tech font-bold uppercase bg-amber-950/60 border border-amber-400 text-amber-200"
                    >
                      Setor 09 (Cap. 1)
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-tech font-bold uppercase text-slate-300">
                      {t(language, 'mp.maxPlayers')} ({maxPlayers})
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {[2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          data-testid={`mp-max-players-${n}`}
                          onClick={() => setMaxPlayers(n)}
                          className={`py-1.5 text-[11px] font-tech font-bold border cursor-pointer ${
                            maxPlayers === n
                              ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-tech font-bold uppercase text-slate-300">
                    {t(language, 'mp.difficulty')}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    {DIFFICULTY_ORDER.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRoomDiff(d)}
                        className={`py-1.5 px-1 text-[10px] font-tech font-bold uppercase border cursor-pointer ${
                          roomDiff === d
                            ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {DIFFICULTY_CONFIGS[d].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="mp-visibility-public"
                    onClick={() => setVisibility('public')}
                    className={`py-1.5 px-2 text-[10px] font-tech font-bold uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                      visibility === 'public'
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{t(language, 'mp.public')}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="mp-visibility-private"
                    onClick={() => setVisibility('private')}
                    className={`py-1.5 px-2 text-[10px] font-tech font-bold uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                      visibility === 'private'
                        ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t(language, 'mp.private')}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-tech font-bold uppercase text-slate-300">
                    {t(language, 'mp.lobbyVote')}
                  </span>
                  <button
                    type="button"
                    data-testid="mp-lobby-vote-toggle"
                    aria-pressed={allowLobbyVote}
                    onClick={() => setAllowLobbyVote((v) => !v)}
                    className={`px-2.5 py-1 text-[10px] font-tech font-bold uppercase border cursor-pointer ${
                      allowLobbyVote
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                        : 'bg-slate-950 border-slate-700 text-slate-400'
                    }`}
                  >
                    {allowLobbyVote ? t(language, 'common.on') : t(language, 'common.off')}
                  </button>
                </div>

                <button
                  type="submit"
                  data-testid="mp-create-room-btn"
                  disabled={busy}
                  className="horror-btn horror-btn-primary w-full py-2.5 px-4 text-xs font-horror font-extrabold uppercase tracking-widest cursor-pointer"
                >
                  {busy ? t(language, 'common.loading') : t(language, 'mp.createBtn')}
                </button>
              </form>
            </div>
          )}

          {/* ==============================================================
              VIEW 3: MULTIPLAYER LOBBY
              ============================================================== */}
          {view === 'lobby' && room && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Room Code + Player List */}
              <div className="lg:col-span-7 space-y-3">
                {/* Prominent 5-Character Room Code Bar */}
                <div className="p-3.5 bg-slate-950/90 border border-amber-500/60 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-tech uppercase tracking-widest text-amber-400">
                      {t(language, 'mp.roomCode')} · {room.name}
                    </div>
                    <div
                      data-testid="mp-lobby-code"
                      className="font-horror text-3xl sm:text-4xl font-black tracking-[0.28em] text-white mt-0.5"
                    >
                      {room.code}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="mp-copy-code-btn"
                      onClick={() => void handleCopyCode()}
                      className="horror-btn horror-btn-amber px-3 py-2 text-xs font-tech font-extrabold uppercase flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>
                        {copiedCode ? t(language, 'common.copied') : t(language, 'common.copy')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Players List */}
                <div className="p-3 bg-slate-950/85 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-tech uppercase text-slate-300">
                    <span>
                      {t(language, 'mp.players')} ({room.players.length}/{room.maxPlayers})
                    </span>
                    <span className="text-amber-300">
                      {DIFFICULTY_CONFIGS[room.difficulty]?.label ?? room.difficulty}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {room.players.map((p) => {
                      const portraitUrl = portraits[p.avatarId || 'marcos'] || portraits['marcos'];
                      return (
                        <div
                          key={p.id}
                          data-testid={`mp-lobby-player-${p.id}`}
                          className="p-2.5 bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                              {portraitUrl ? (
                                <img
                                  src={portraitUrl}
                                  alt={p.nickname}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-horror text-sm font-bold text-white truncate">
                                  {p.nickname}
                                </span>
                                {p.isHost && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-950/80 border border-amber-500/60 text-[9px] font-tech font-bold text-amber-300">
                                    <Crown className="w-2.5 h-2.5" />
                                    {t(language, 'mp.host')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-tech text-slate-400 mt-0.5">
                                <span className="inline-flex items-center gap-1">
                                  {getPlatformIcon(p.platform)}
                                  {t(language, `mp.platform.${p.platform}`)}
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-amber-300/90">
                                  <Shield className="w-3 h-3" />
                                  {p.perks.length > 0 ? p.perks.join(', ') : '0 Perks'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-1 text-[10px] font-tech font-extrabold uppercase border shrink-0 ${
                              p.ready
                                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                                : 'bg-slate-950 border-slate-700 text-slate-400'
                            }`}
                          >
                            {p.ready ? t(language, 'mp.ready') : t(language, 'mp.notReady')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lobby Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="mp-toggle-ready-btn"
                    onClick={() => multiplayerClient.toggleReady()}
                    className={`horror-btn flex-1 py-2.5 px-4 text-xs font-tech font-extrabold uppercase tracking-wider cursor-pointer ${
                      localPlayer?.ready
                        ? 'border-emerald-400 text-emerald-200'
                        : 'text-slate-200'
                    }`}
                  >
                    {t(language, 'mp.toggleReady')}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      data-testid="mp-start-mission-btn"
                      onClick={() => multiplayerClient.startMatch(room.seed)}
                      className="horror-btn horror-btn-primary flex-1 py-2.5 px-4 text-xs font-horror font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{t(language, 'mp.startMission')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="mp-leave-lobby-btn"
                    onClick={handleLeaveLobby}
                    className="horror-btn horror-btn-danger py-2.5 px-3 text-xs font-tech font-bold uppercase cursor-pointer"
                  >
                    {t(language, 'mp.leaveLobby')}
                  </button>
                </div>
              </div>

              {/* Right: Lobby Radio Chat */}
              <div className="lg:col-span-5 p-3 bg-slate-950/90 border border-slate-800 flex flex-col h-[340px] lg:h-auto">
                <div className="text-xs font-horror font-bold uppercase tracking-wider text-cyan-300 flex items-center justify-between gap-2 pb-2 border-b border-slate-800 shrink-0">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    {t(language, 'mp.chatTitle')}
                  </span>
                  {chatFilter && (
                    <span className="text-[9px] font-tech text-emerald-300">FILTRO ATIVO</span>
                  )}
                </div>

                <div
                  data-testid="mp-chat-messages"
                  className="flex-1 overflow-y-auto horror-scroll py-2 space-y-1.5 text-xs"
                >
                  {room.chat.length === 0 ? (
                    <div className="text-[11px] font-tech text-slate-500 text-center py-6">
                      Canal de rádio aberto. Coordene sua equipe antes de entrar no Setor 09.
                    </div>
                  ) : (
                    room.chat.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-2 bg-slate-900/80 border border-slate-800/80 break-words"
                      >
                        <span className="font-tech font-bold text-amber-300 mr-1.5">
                          {msg.senderName}:
                        </span>
                        <span className="text-slate-200">
                          {sanitizeChatMessage(msg.text, chatFilter)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-2 border-t border-slate-800 shrink-0">
                  <input
                    type="text"
                    data-testid="mp-chat-input"
                    maxLength={200}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t(language, 'mp.chatPlaceholder')}
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:outline-none px-2.5 py-1.5 text-xs font-tech text-white"
                  />
                  <button
                    type="submit"
                    data-testid="mp-chat-send-btn"
                    className="horror-btn px-3 py-1.5 text-xs font-tech font-bold uppercase text-cyan-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t(language, 'mp.chatSend')}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
