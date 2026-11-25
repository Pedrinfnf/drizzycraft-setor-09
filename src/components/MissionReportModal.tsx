import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Coins,
  Compass,
  Eye,
  Film,
  Home,
  RotateCcw,
  ScanEye,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../game/difficulty';
import type { EndingId, MissionReportSnapshot, RankGrade } from '../game/types';

export interface MissionReportModalProps {
  report: MissionReportSnapshot;
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
  onOpenStore?: () => void;
  onRankStampSound?: () => void;
  onContinueChapter2?: () => void;
  mpRoomCode?: string | null;
}

interface EndingTheme {
  tag: string;
  title: string;
  subtitle: string;
  headerBg: string;
  headerBorder: string;
  accentBar: string;
  titleColor: string;
  tagColor: string;
  glowShadow: string;
}

const ENDING_THEMES: Record<EndingId, EndingTheme> = {
  bad: {
    tag: 'FINAL RUIM // PROTOCOLO FALHOU',
    title: 'CONTENÇÃO DO SETOR 09',
    subtitle: 'P. Drizzy interceptou sua fuga e selou sua transferência para as celas do subsolo.',
    headerBg: 'bg-red-950/75',
    headerBorder: 'border-red-500/55',
    accentBar: 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)]',
    titleColor: 'text-red-300',
    tagColor: 'text-red-400',
    glowShadow: 'shadow-[0_0_40px_rgba(220,38,38,0.22)]',
  },
  good: {
    tag: 'FINAL BOM // EXTRAÇÃO CONFIRMADA',
    title: 'FUGA PELO PORTÃO NORTE',
    subtitle: 'Você rompeu o bloqueio do perímetro e alcançou a mata externa vivo.',
    headerBg: 'bg-emerald-950/75',
    headerBorder: 'border-emerald-500/55',
    accentBar: 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]',
    titleColor: 'text-emerald-300',
    tagColor: 'text-emerald-400',
    glowShadow: 'shadow-[0_0_40px_rgba(16,185,129,0.22)]',
  },
  real: {
    tag: 'FINAL REAL // SINAL DE RESGATE',
    title: 'RESGATE NO NÍVEL -2',
    subtitle: 'Você cortou o cadeado blindado e desceu ao subsolo profundo atrás do Vigia Marcos.',
    headerBg: 'bg-cyan-950/75',
    headerBorder: 'border-cyan-400/55',
    accentBar: 'bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.85)]',
    titleColor: 'text-cyan-300',
    tagColor: 'text-cyan-400',
    glowShadow: 'shadow-[0_0_40px_rgba(6,182,212,0.22)]',
  },
  secret: {
    tag: 'FINAL SECRETO // ARQUIVO VAZADO',
    title: 'DOSSIÊ ÔMEGA EXPOSTO',
    subtitle: 'Os registros confidenciais do Projeto Ômega foram transmitidos antes da sua fuga.',
    headerBg: 'bg-violet-950/75',
    headerBorder: 'border-violet-400/60',
    accentBar: 'bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.85)]',
    titleColor: 'text-violet-300',
    tagColor: 'text-violet-300',
    glowShadow: 'shadow-[0_0_44px_rgba(139,92,246,0.28)]',
  },
};

const RANK_STYLES: Record<
  RankGrade,
  {
    text: string;
    border: string;
    bg: string;
    glow: string;
    label: string;
  }
> = {
  S: {
    text: 'text-amber-300',
    border: 'border-amber-400',
    bg: 'bg-amber-950/75',
    glow: 'shadow-[0_0_28px_rgba(251,191,36,0.55),inset_0_0_18px_rgba(251,191,36,0.25)]',
    label: 'AGENTE FANTASMA',
  },
  A: {
    text: 'text-emerald-300',
    border: 'border-emerald-400',
    bg: 'bg-emerald-950/75',
    glow: 'shadow-[0_0_24px_rgba(52,211,153,0.45),inset_0_0_16px_rgba(52,211,153,0.2)]',
    label: 'OPERAÇÃO LIMPA',
  },
  B: {
    text: 'text-cyan-300',
    border: 'border-cyan-400',
    bg: 'bg-cyan-950/75',
    glow: 'shadow-[0_0_22px_rgba(34,211,238,0.4),inset_0_0_14px_rgba(34,211,238,0.18)]',
    label: 'SOBREVIVENTE TÁTICO',
  },
  C: {
    text: 'text-slate-300',
    border: 'border-slate-500',
    bg: 'bg-slate-900/85',
    glow: 'shadow-[0_0_16px_rgba(148,163,184,0.28)]',
    label: 'REGISTRO DE CAMPO',
  },
};

function formatPrecisionTime(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export const MissionReportModal: React.FC<MissionReportModalProps> = ({
  report,
  onPlayAgain,
  onReturnToTitle,
  onOpenStore,
  onRankStampSound,
  onContinueChapter2,
  mpRoomCode,
}) => {
  const [stamped, setStamped] = useState(false);
  const [animatedCoins, setAnimatedCoins] = useState(0);
  const stampSoundPlayedRef = useRef(false);

  const theme = ENDING_THEMES[report.endingId] ?? ENDING_THEMES.good;
  const rankStyle = RANK_STYLES[report.rank] ?? RANK_STYLES.C;
  const diffLabel = DIFFICULTY_CONFIGS[report.difficulty]?.label ?? report.difficulty.toUpperCase();

  // Trigger dramatic Rank Stamp animation & sound once on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStamped(true);
      if (!stampSoundPlayedRef.current) {
        stampSoundPlayedRef.current = true;
        onRankStampSound?.();
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [onRankStampSound]);

  // Smooth Survival Coins count-up animation
  useEffect(() => {
    const target = Math.max(0, Math.round(report.coinsEarned));
    if (target === 0) {
      setAnimatedCoins(0);
      return;
    }
    let rafId = 0;
    const duration = 780;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedCoins(Math.round(target * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [report.coinsEarned]);

  const diffBadgeClass =
    report.difficulty === 'nightmare'
      ? 'bg-red-950/90 border-red-500/70 text-red-300'
      : report.difficulty === 'hard'
      ? 'bg-amber-950/90 border-amber-500/70 text-amber-300'
      : report.difficulty === 'practice'
      ? 'bg-cyan-950/90 border-cyan-500/70 text-cyan-300'
      : 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Relatório de Missão"
      data-testid="mission-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <div
        className={`horror-panel tactical-grid-bg w-full max-w-3xl max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in ${theme.glowShadow}`}
      >
        {/* Ending Header Banner */}
        <div
          className={`px-4 py-3 sm:px-5 sm:py-4 border-b ${theme.headerBorder} ${theme.headerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className={`w-1.5 self-stretch shrink-0 ${theme.accentBar}`} />
            <div className="min-w-0">
              <div className={`text-[10px] font-tech font-bold uppercase tracking-[0.2em] ${theme.tagColor}`}>
                {theme.tag}
              </div>
              <h2
                className={`font-horror text-xl sm:text-3xl font-black tracking-wider uppercase leading-none mt-1 ${theme.titleColor}`}
              >
                {theme.title}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
                {theme.subtitle}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
            <span
              className={`px-2.5 py-1 border text-[10px] font-tech font-extrabold uppercase tracking-widest ${diffBadgeClass}`}
            >
              {diffLabel}
            </span>
            <span className="text-[9px] font-tech uppercase tracking-[0.16em] text-slate-400">
              DOSSIÊ DE MISSÃO · S09
            </span>
          </div>
        </div>

        {/* Scrollable Dossier Body */}
        <div className="flex-1 overflow-y-auto horror-scroll px-3.5 py-3.5 sm:px-5 sm:py-4 space-y-3.5">
          {/* Chapter 2 Unlock Highlight */}
          {report.chapter2JustUnlocked && (
            <div className="p-2.5 bg-amber-950/45 border border-amber-400/75 flex items-center gap-2.5 text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-[11px] sm:text-xs font-tech font-bold uppercase tracking-wider">
                ACESSO LIBERADO: DOSSIÊ DA FASE 2 · PROJETO ÔMEGA DESBLOQUEADO NO MENU
              </div>
            </div>
          )}

          {/* Top Summary Row: Time + Animated Rank Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
            {/* Escape Time & Best Record Panel */}
            <div className="sm:col-span-7 bg-slate-950/85 border border-slate-800 p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-tech font-bold uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-amber-400" />
                  TEMPO DE OPERAÇÃO
                </span>
                {report.isNewBestTime && (
                  <span
                    data-testid="new-best-time-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-400 text-amber-300 text-[9px] font-tech font-extrabold uppercase tracking-wider shadow-[0_0_12px_rgba(251,191,36,0.35)]"
                  >
                    <Sparkles className="w-3 h-3" />
                    NOVO RECORDE PESSOAL
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div
                  data-testid="mission-report-time"
                  className="font-tech text-3xl sm:text-4xl font-black tracking-wider text-white"
                >
                  {formatPrecisionTime(report.elapsedSec)}
                </div>
                {report.bestTimeSec !== null && !report.isNewBestTime && (
                  <div className="text-right">
                    <div className="text-[9px] font-tech uppercase text-slate-500">RECORDE</div>
                    <div className="text-xs font-tech font-bold text-slate-300">
                      {formatPrecisionTime(report.bestTimeSec)}
                    </div>
                  </div>
                )}
              </div>

              {/* Compact 5-metric Telemetry Strip */}
              <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-800/90">
                <TelemetryCell
                  icon={<Eye className="w-3 h-3 text-red-400" />}
                  label="Detecções"
                  value={String(report.detections)}
                  highlight={report.detections === 0 ? 'text-emerald-300' : 'text-slate-100'}
                />
                <TelemetryCell
                  icon={<Zap className="w-3 h-3 text-cyan-400" />}
                  label="Stuns"
                  value={String(report.stunsApplied)}
                />
                <TelemetryCell
                  icon={<Film className="w-3 h-3 text-amber-400" />}
                  label="Fitas VHS"
                  value={`${report.vhsCollected}/${report.vhsTotal}`}
                />
                <TelemetryCell
                  icon={<ScanEye className="w-3 h-3 text-purple-400" />}
                  label="Pistas UV"
                  value={`${report.uvCluesCollected}/${report.uvCluesTotal}`}
                />
                <TelemetryCell
                  icon={<Compass className="w-3 h-3 text-emerald-400" />}
                  label="Mapa"
                  value={`${report.exploredPct}%`}
                />
              </div>
            </div>

            {/* Animated Rank S-C Stamp Panel */}
            <div className="sm:col-span-5 bg-slate-950/85 border border-slate-800 p-3.5 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="text-[10px] font-tech font-bold uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                CLASSIFICAÇÃO TÁTICA
              </div>

              <div
                data-testid="mission-report-rank"
                className={`w-24 h-24 sm:w-28 sm:h-28 border-2 flex flex-col items-center justify-center transition-all duration-300 ease-out ${rankStyle.border} ${rankStyle.bg} ${rankStyle.glow} ${
                  stamped
                    ? 'scale-100 opacity-100 -rotate-3'
                    : 'scale-150 opacity-0 -rotate-12'
                }`}
              >
                <span className={`font-horror text-6xl sm:text-7xl font-black leading-none ${rankStyle.text}`}>
                  {report.rank}
                </span>
              </div>

              <div className="mt-2 text-center">
                <div className={`text-[10px] font-tech font-extrabold uppercase tracking-[0.18em] ${rankStyle.text}`}>
                  {rankStyle.label}
                </div>
                <div className="text-[10px] font-tech text-slate-400 mt-0.5">
                  PONTUAÇÃO: <span className="text-slate-200 font-bold">{report.rankScore} PTS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transparent Rank Formula & Survival Coins Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Rank Formula Breakdown */}
            <div className="bg-slate-950/85 border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] font-tech font-bold uppercase tracking-[0.16em] text-slate-300">
                  FÓRMULA DE RANK
                </span>
                <span className="text-[10px] font-tech font-bold text-amber-300">
                  TOTAL {report.rankScore} PTS
                </span>
              </div>
              <div className="space-y-1">
                {report.rankBreakdown.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="flex items-center justify-between gap-2 text-[11px] font-tech"
                  >
                    <span className="text-slate-300 truncate">{row.label}</span>
                    <span
                      className={`font-bold shrink-0 ${
                        row.points > 0
                          ? 'text-emerald-400'
                          : row.points < 0
                          ? 'text-red-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {row.points > 0 ? `+${row.points}` : row.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Survival Coins Earned & Breakdown */}
            <div className="bg-slate-950/85 border border-amber-500/35 p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] font-tech font-bold uppercase tracking-[0.16em] text-amber-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  MOEDAS DE SOBREVIVÊNCIA
                </span>
                <span
                  data-testid="mission-report-coins"
                  className="text-sm font-tech font-black text-amber-300"
                >
                  +{animatedCoins}
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-tech">
                <CoinRow label="Base da Operação" value={report.coinBreakdown.base} />
                <CoinRow label={`Bônus de Rank (${report.rank})`} value={report.coinBreakdown.rankBonus} />
                <CoinRow label={`Bônus de Dificuldade (${diffLabel})`} value={report.coinBreakdown.difficultyBonus} />
                <CoinRow label="Bônus de Final" value={report.coinBreakdown.endingBonus} />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-tech">
                <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                  NOVO SALDO DISPONÍVEL
                </span>
                <span className="font-black text-amber-200 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  {report.newBalance}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        {/* Chapter Selector & Direct Bridge to Chapter 2 (keeps Multiplayer room connected!) */}
        {onContinueChapter2 && report.endingId !== 'bad' && (
          <div className="px-4 py-2.5 border-t border-cyan-500/40 bg-cyan-950/35 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] font-tech text-cyan-200">
              <span className="font-extrabold uppercase tracking-wider text-cyan-300">
                PONTE PARA O CAPÍTULO 2 · LABORATÓRIO ÔMEGA
              </span>
              {mpRoomCode && (
                <span className="ml-2 px-1.5 py-0.5 bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-[9px] font-bold">
                  SALA {mpRoomCode} MANTIDA CONECTADA
                </span>
              )}
            </div>
            <button
              type="button"
              data-testid="continue-chapter2-btn"
              onClick={onContinueChapter2}
              className="horror-btn horror-btn-primary px-4 py-2 font-horror text-xs sm:text-sm font-extrabold tracking-widest uppercase cursor-pointer whitespace-nowrap"
            >
              CONTINUAR PARA O CAPÍTULO 2 ▶
            </button>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/95 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            data-testid="mission-report-replay-btn"
            onClick={onPlayAgain}
            className="horror-btn horror-btn-primary py-2.5 px-3 flex items-center justify-center gap-2 font-horror text-sm font-extrabold tracking-widest cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>JOGAR DE NOVO</span>
          </button>

          {onOpenStore ? (
            <button
              type="button"
              data-testid="mission-report-store-btn"
              onClick={onOpenStore}
              className="horror-btn horror-btn-amber py-2.5 px-3 flex items-center justify-center gap-2 font-horror text-sm font-extrabold tracking-widest cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>CENTRAL / LOJA 3D</span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <button
            type="button"
            data-testid="mission-report-menu-btn"
            onClick={onReturnToTitle}
            className="horror-btn py-2.5 px-3 flex items-center justify-center gap-2 font-horror text-sm font-bold tracking-widest text-slate-200 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>MENU PRINCIPAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const TelemetryCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: string;
}> = ({ icon, label, value, highlight = 'text-slate-100' }) => (
  <div className="bg-slate-900/80 border border-slate-800/90 px-1.5 py-1.5 text-center flex flex-col items-center gap-0.5">
    <div className="flex items-center justify-center">{icon}</div>
    <div className={`text-xs font-tech font-extrabold leading-none ${highlight}`}>{value}</div>
    <div className="text-[8px] font-tech uppercase text-slate-400 truncate max-w-full">{label}</div>
  </div>
);

const CoinRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-slate-300 truncate">{label}</span>
    <span className={value > 0 ? 'text-amber-300 font-bold shrink-0' : 'text-slate-500 shrink-0'}>
      +{value}
    </span>
  </div>
);
