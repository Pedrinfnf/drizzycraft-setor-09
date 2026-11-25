import React, { useState } from 'react';
import {
  ChevronRight,
  Coins,
  Globe,
  Lock,
  Play,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS, DIFFICULTY_ORDER } from '../game/difficulty';
import type {
  Difficulty,
  GamepadGlyphStyle,
  InputMode,
  ProfileProgress,
} from '../game/types';
import { Sector09Emblem, WarningBeaconIcon } from './icons/GameIcons';

const DIFFICULTY_LIST = DIFFICULTY_ORDER.map((id) => DIFFICULTY_CONFIGS[id]);

interface TitleScreenProps {
  selectedDifficulty: Difficulty;
  profile: ProfileProgress;
  muted: boolean;
  inputMode: InputMode;
  gamepadStyle: GamepadGlyphStyle;
  survivalCoins?: number;
  equippedPerksCount?: number;
  unclaimedAchievementsCount?: number;
  accountLabel?: string;
  isSignedIn?: boolean;
  cloudSyncStatus?: 'synced' | 'saving' | 'offline';
  onSelectDifficulty: (d: Difficulty) => void;
  onStartChapter1: () => void;
  onOpenPlaySelector?: () => void;
  onOpenAccount?: () => void;
  onOpenStore?: () => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
}

function formatBestTime(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedDifficulty: difficulty,
  profile,
  muted,
  inputMode,
  gamepadStyle,
  survivalCoins = 0,
  equippedPerksCount = 0,
  unclaimedAchievementsCount = 0,
  accountLabel,
  isSignedIn = false,
  cloudSyncStatus = 'offline',
  onSelectDifficulty,
  onStartChapter1,
  onOpenPlaySelector,
  onOpenAccount,
  onOpenStore,
  onOpenSettings,
  onToggleMute,
}) => {
  const [selectedChapter, setSelectedChapter] = useState<1 | 2>(1);
  const chapter2Unlocked = profile.chaptersUnlocked.includes(2);
  const ch1Best = profile.bestTimesSec['ch1']?.[difficulty] ?? profile.bestTimesSec['1']?.[difficulty];
  const ch1DoneCount =
    profile.completedDifficulties['ch1']?.length ??
    profile.completedDifficulties['1']?.length ??
    0;

  return (
    <div
      data-testid="title-screen"
      className="fixed inset-0 z-30 flex items-stretch justify-between pointer-events-auto overflow-hidden"
    >
      {/* Atmospheric subtle directional vignette leaving right-side live Guardhouse 3D scene bright & clear */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(102deg, rgba(5, 7, 12, 0.86) 0%, rgba(7, 10, 16, 0.54) 44%, rgba(6, 8, 14, 0.14) 76%, rgba(4, 6, 11, 0.45) 100%)',
        }}
      />
      <div className="absolute inset-0 pointer-events-none tactical-scanlines opacity-55" />

      {/* Top-Right Live Security Camera Feed Tag + Audio/Settings Controls */}
      <div
        className="fixed top-3 right-3 sm:top-5 sm:right-5 z-40 flex items-center gap-2"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div className="hidden md:flex items-center gap-2 hud-tactical-panel px-2.5 py-1.5 text-[10px] font-tech text-slate-300">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          <span className="text-red-400 font-bold tracking-wider">REC</span>
          <span className="text-slate-500">|</span>
          <span className="tracking-wider">CAM-01 · GUARITA NORTE</span>
        </div>
        <div
          data-testid="cloud-sync-badge"
          className={`hidden sm:flex items-center gap-1.5 hud-tactical-panel px-2 py-1.5 text-[10px] font-tech uppercase tracking-wider ${
            cloudSyncStatus === 'synced'
              ? 'text-emerald-300 border-emerald-500/40'
              : cloudSyncStatus === 'saving'
              ? 'text-amber-300 border-amber-500/40'
              : 'text-slate-400 border-slate-700/60'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              cloudSyncStatus === 'synced'
                ? 'bg-emerald-400'
                : cloudSyncStatus === 'saving'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-slate-500'
            }`}
          />
          <span>
            {cloudSyncStatus === 'synced'
              ? 'Nuvem Sincronizada'
              : cloudSyncStatus === 'saving'
              ? 'Salvando na nuvem...'
              : 'Modo Offline'}
          </span>
        </div>
        <button
          type="button"
          data-testid="title-account-btn"
          onClick={() => onOpenAccount?.()}
          aria-label="Conta e Save na Nuvem"
          className="horror-btn px-3 py-2 flex items-center gap-1.5 text-[11px] font-tech font-bold uppercase tracking-wider text-slate-100 cursor-pointer"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isSignedIn
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                : 'bg-amber-400'
            }`}
          />
          <User className="w-4 h-4 text-cyan-300" />
          <span className="hidden sm:inline max-w-[110px] truncate">
            {accountLabel || 'Conta'}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Ativar som' : 'Silenciar som'}
          className="horror-btn p-2.5 text-slate-200 cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          data-testid="title-settings-btn"
          onClick={onOpenSettings}
          aria-label="Abrir Configurações"
          className="horror-btn px-3 py-2 flex items-center gap-1.5 text-[11px] font-tech font-bold uppercase tracking-wider text-slate-100 cursor-pointer"
        >
          <Settings className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Configurações</span>
        </button>
      </div>

      {/* Left-Anchored Tactical Command Console (Compact, translucent glass, leaves live 3D courtyard open!) */}
      <div
        className="relative z-30 flex flex-col justify-between w-full max-w-[440px] sm:max-w-[470px] h-full p-3 sm:p-6 overflow-y-auto horror-scroll"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        }}
      >
        {/* Top Stylized DrizzyCraft: Setor 09 Emblem & Header */}
        <div className="space-y-2 animate-tactical-in">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-red-950/75 border border-red-500/40 text-[10px] font-tech uppercase tracking-[0.18em] text-red-300">
            <span className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
            PROTOCOLO DE CONTENÇÃO · SETOR 09
          </div>

          <div className="flex items-center gap-3">
            <Sector09Emblem className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 drop-shadow-[0_0_16px_rgba(220,38,38,0.45)]" />
            <div>
              <h1 className="font-horror text-3xl sm:text-5xl font-black tracking-[0.06em] text-white leading-[0.95] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
                DRIZZY<span className="text-red-500">CRAFT</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-[2px] w-7 bg-amber-500" />
                <span className="font-tech text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
                  SETOR 09 // SOBREVIVÊNCIA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Tactical Mission Selector Panel */}
        <div className="horror-panel backdrop-blur-md tactical-grid-bg p-3.5 sm:p-4 my-3 space-y-3.5 animate-tactical-in">
          {/* Chapter Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-tech uppercase tracking-[0.16em] text-slate-400">
              <span>SELEÇÃO DE OPERAÇÃO</span>
              <span className="text-amber-300">FUGAS: {profile.totalEscapes}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedChapter(1)}
                className={`p-2.5 text-left transition-all cursor-pointer border ${
                  selectedChapter === 1
                    ? 'bg-red-950/55 border-amber-400/90 shadow-[inset_0_0_16px_rgba(245,158,11,0.16)]'
                    : 'bg-slate-950/75 border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-tech text-[9px] font-bold uppercase tracking-widest text-amber-400">
                    FASE 01
                  </span>
                  {ch1DoneCount > 0 && (
                    <span className="text-[9px] font-tech text-emerald-300">
                      {ch1DoneCount}/4
                    </span>
                  )}
                </div>
                <div className="font-horror text-sm sm:text-base font-bold text-white leading-tight mt-0.5">
                  Complexo Setor 09
                </div>
                <div className="text-[10px] font-tech text-slate-400 mt-0.5">
                  RECORDE: <span className="text-slate-200">{formatBestTime(ch1Best)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChapter(2)}
                className={`p-2.5 text-left transition-all cursor-pointer border ${
                  selectedChapter === 2
                    ? 'bg-slate-900/90 border-cyan-400/80'
                    : 'bg-slate-950/65 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-tech text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    FASE 02
                  </span>
                  <Lock className={`w-3 h-3 ${chapter2Unlocked ? 'text-cyan-400' : 'text-slate-500'}`} />
                </div>
                <div className="font-horror text-sm sm:text-base font-bold text-slate-300 leading-tight mt-0.5">
                  Nível 2 · Projeto Ômega
                </div>
                <div className="text-[10px] font-tech text-slate-500 mt-0.5">
                  {chapter2Unlocked ? 'ARQUIVO DESCLASSIFICADO' : 'ACESSO RESTRITO'}
                </div>
              </button>
            </div>
          </div>

          {selectedChapter === 1 ? (
            <>
              {/* Difficulty Selector Grid */}
              <div className="space-y-1.5">
                <div className="flex flex-col gap-0.5 text-[10px] font-tech">
                  <span className="uppercase tracking-[0.16em] text-slate-400">
                    NÍVEL DE AMEAÇA
                  </span>
                  <span className="text-[11px] text-slate-200 leading-snug">
                    {DIFFICULTY_LIST.find((d) => d.id === difficulty)?.subtitle}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {DIFFICULTY_LIST.map((d) => {
                    const active = difficulty === d.id;
                    const accentStyle =
                      d.id === 'nightmare'
                        ? active
                          ? 'bg-red-950/85 border-red-400 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.35)]'
                          : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-red-500/60'
                        : d.id === 'hard'
                        ? active
                          ? 'bg-amber-950/80 border-amber-400 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.3)]'
                          : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-amber-500/60'
                        : d.id === 'practice'
                        ? active
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.28)]'
                          : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-cyan-500/60'
                        : active
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.28)]'
                        : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-emerald-500/60';
                    return (
                      <button
                        key={d.id}
                        type="button"
                        data-testid={`diff-${d.id}`}
                        onClick={() => onSelectDifficulty(d.id)}
                        className={`px-1.5 py-2 border text-center transition-all cursor-pointer ${accentStyle}`}
                      >
                        <div className="font-horror text-[11px] sm:text-xs font-bold tracking-wide truncate">
                          {d.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Tactical CTA Action */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  data-testid="title-start-btn"
                  onClick={onStartChapter1}
                  className="horror-btn horror-btn-primary w-full py-3 sm:py-3.5 px-4 flex items-center justify-between font-horror text-base sm:text-lg font-extrabold tracking-widest cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Play className="w-5 h-5 fill-current" />
                    INICIAR FASE 1
                  </span>
                  <ChevronRight className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  data-testid="title-multiplayer-btn"
                  onClick={() => (onOpenPlaySelector ? onOpenPlaySelector() : onStartChapter1())}
                  className="horror-btn w-full py-2.5 px-3.5 border-cyan-500/60 hover:border-cyan-300 flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-horror text-xs sm:text-sm font-extrabold tracking-wider text-cyan-300 truncate">
                    <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                    MODO SOLO &amp; MULTIPLAYER ONLINE (CROSSPLAY)
                  </span>
                  <ChevronRight className="w-4 h-4 text-cyan-400/80 shrink-0" />
                </button>

                <button
                  type="button"
                  data-testid="title-store-btn"
                  onClick={() => onOpenStore?.()}
                  className="horror-btn w-full py-2.5 px-3.5 border-amber-500/60 hover:border-amber-300 flex flex-col gap-1.5 text-left cursor-pointer relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="flex items-center gap-2 font-horror text-xs sm:text-sm font-extrabold tracking-wider text-amber-300 truncate">
                      <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                      CENTRAL TÁTICA · PERKS &amp; LOJA 3D
                    </span>
                    {unclaimedAchievementsCount > 0 ? (
                      <span
                        data-testid="title-unclaimed-badge"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-tech font-black uppercase tracking-wider animate-pulse shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.75)]"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        +{unclaimedAchievementsCount} RESGATE
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-amber-400/80 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-tech text-slate-300 w-full">
                    <span className="inline-flex items-center gap-1 text-amber-200 font-bold">
                      <Coins className="w-3 h-3 text-amber-400" />
                      {survivalCoins} MOEDAS
                    </span>
                    <span className="text-slate-400">
                      PERKS EQUIPADOS:{' '}
                      <strong className={equippedPerksCount > 0 ? 'text-emerald-300' : 'text-slate-200'}>
                        {equippedPerksCount}/3
                      </strong>
                    </span>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 bg-slate-950/85 border border-slate-700/70 space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                {chapter2Unlocked ? (
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                ) : (
                  <WarningBeaconIcon className="w-4 h-4 shrink-0" />
                )}
                <span className="font-horror text-sm font-bold uppercase tracking-wider">
                  {chapter2Unlocked
                    ? 'DOSSIÊ ÔMEGA DESCLASSIFICADO · NÍVEL -2'
                    : 'ACESSO RESTRITO AO NÍVEL -2'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {chapter2Unlocked
                  ? 'Você escapou do Complexo Setor 09 e revelou o alçapão selado do Projeto Ômega. Os registros do Nível -2 foram arquivados na Central Tática e estão sob monitoramento ativo do Setor.'
                  : 'Conclua a Fase 1 em qualquer modo com P. Drizzy ativo (Fácil, Difícil ou Pesadelo) para desclassificar o Dossiê do Nível -2.'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedChapter(1)}
                className="horror-btn w-full py-2 text-xs font-tech font-bold uppercase tracking-wider text-amber-300 cursor-pointer"
              >
                VOLTAR PARA FASE 1
              </button>
            </div>
          )}
        </div>

        {/* Bottom Compact Device Control Legend */}
        <div className="hud-tactical-panel px-3 py-2 text-[10px] font-tech text-slate-300 flex items-center justify-between gap-2">
          <span className="truncate">
            {inputMode === 'gamepad'
              ? gamepadStyle === 'playstation'
                ? 'D-Pad/L-Stick Navegar · [X] Confirmar · [O] Voltar · L2 Correr · R2 UV/Uso'
                : 'D-Pad/L-Stick Navegar · [A] Confirmar · [B] Voltar · LT Correr · RT UV/Uso'
              : inputMode === 'touch'
              ? 'Toque para navegar · Joystick + Botões Táticos na tela'
              : 'WASD Mover · Mouse Olhar · [E] Interagir · [F] Luz · [V] UV · [I] Mochila'}
          </span>
          <span className="text-[9px] text-amber-400/90 shrink-0 uppercase">SETOR-09</span>
        </div>
      </div>
    </div>
  );
};
