import React from 'react';
import { Award, Home, Play, RotateCcw, Settings, Skull } from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../game/difficulty';
import type { GameSettings, HudSnapshot, ProfileProgress } from '../game/types';
import { Sector09Emblem } from './icons/GameIcons';

interface StatusModalsProps {
  hud: HudSnapshot;
  profile: ProfileProgress;
  settings: GameSettings;
  onQuickSensitivityChange: (mode: 'touch' | 'look', value: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onReturnToTitle: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const StatusModals: React.FC<StatusModalsProps> = ({
  hud,
  profile,
  settings,
  onQuickSensitivityChange,
  onResume,
  onRestart,
  onOpenSettings,
  onReturnToTitle,
}) => {
  if (hud.mode !== 'paused' && hud.mode !== 'victory' && hud.mode !== 'defeat') {
    return null;
  }

  const diffLabel = DIFFICULTY_CONFIGS[hud.difficulty].label;
  const bestTime = profile.bestTimesSec['1']?.[hud.difficulty] ?? profile.bestTimesSec['ch1']?.[hud.difficulty];

  if (hud.mode === 'paused') {
    const isTouch = hud.inputMode === 'touch';
    const sensVal = Math.round(
      (isTouch ? settings.controls.touchSensitivity : settings.controls.lookSensitivity) * 100
    );

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jogo Pausado"
        data-testid="pause-modal"
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/78 backdrop-blur-md p-3 select-none"
      >
        <div className="horror-panel tactical-grid-bg w-full max-w-sm p-5 text-slate-100 flex flex-col gap-3.5 animate-tactical-in">
          <div className="flex items-center gap-3 border-b border-slate-700/80 pb-3">
            <Sector09Emblem className="w-10 h-10 shrink-0" />
            <div>
              <div className="font-tech text-[10px] uppercase tracking-[0.18em] text-amber-400">
                OPERAÇÃO SUSPENSA
              </div>
              <h2 className="font-horror text-2xl font-black tracking-[0.14em] text-white leading-none mt-0.5">
                PAUSADO
              </h2>
              <p className="font-tech text-[11px] text-slate-400 mt-1">
                FASE 1 · {diffLabel.toUpperCase()} · {formatTime(hud.elapsedSec)}
              </p>
            </div>
          </div>

          {/* Quick Camera Sensitivity Adjuster */}
          <div className="p-3 bg-slate-950/85 border border-slate-700/75 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-tech uppercase">
              <span className="text-slate-300">
                {isTouch ? 'Sensibilidade Toque' : 'Sensibilidade Câmera'}
              </span>
              <span className="text-amber-300 font-bold">{sensVal}%</span>
            </div>
            <input
              type="range"
              min={40}
              max={250}
              step={5}
              value={sensVal}
              onChange={(e) =>
                onQuickSensitivityChange(isTouch ? 'touch' : 'look', Number(e.target.value) / 100)
              }
              className="tactical-range w-full cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-testid="pause-resume-btn"
              onClick={onResume}
              className="horror-btn horror-btn-primary py-3 font-horror text-base font-extrabold tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              CONTINUAR
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="horror-btn py-2.5 font-tech text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              CONFIGURAÇÕES COMPLETAS
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRestart}
                className="horror-btn py-2.5 font-tech text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 text-amber-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                REINICIAR
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="horror-btn horror-btn-danger py-2.5 font-tech text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                MENU
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hud.mode === 'victory') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fuga Concluída"
        data-testid="victory-modal"
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/84 backdrop-blur-md p-3 select-none"
      >
        <div className="horror-panel tactical-grid-bg w-full max-w-md p-5 sm:p-6 border border-emerald-400/75 text-slate-100 space-y-4 animate-tactical-in">
          <div className="flex items-center gap-3 border-b border-emerald-800/70 pb-3">
            <div className="w-12 h-12 flex items-center justify-center bg-emerald-950/90 border border-emerald-400/70 text-emerald-300 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="font-tech text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                PERÍMETRO SUPERADO · SETOR 09
              </div>
              <h2 className="font-horror text-2xl sm:text-3xl font-black tracking-wider text-white">
                VOCÊ ESCAPOU!
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-tech">
            <div className="p-2.5 bg-slate-950/90 border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase">TEMPO DE FUGA</div>
              <div className="text-lg font-black text-amber-300 mt-0.5">{formatTime(hud.elapsedSec)}</div>
            </div>
            <div className="p-2.5 bg-slate-950/90 border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase">MELHOR RECORDE</div>
              <div className="text-lg font-black text-emerald-300 mt-0.5">
                {bestTime ? formatTime(bestTime) : formatTime(hud.elapsedSec)}
              </div>
            </div>
            <div className="p-2.5 bg-slate-950/90 border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase">DIFICULDADE</div>
              <div className="text-sm font-bold text-white uppercase mt-0.5">{diffLabel}</div>
            </div>
            <div className="p-2.5 bg-slate-950/90 border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase">EXPLORAÇÃO</div>
              <div className="text-sm font-bold text-cyan-300 mt-0.5">{hud.exploredPct}% DO MAPA</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onRestart}
              className="horror-btn horror-btn-amber py-2.5 font-horror text-sm font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              JOGAR DE NOVO
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="horror-btn py-2.5 font-horror text-sm font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              MENU PRINCIPAL
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Defeat modal
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Derrota — Capturado"
      data-testid="defeat-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/86 backdrop-blur-md p-3 select-none"
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-md p-5 sm:p-6 border border-red-500/80 text-slate-100 space-y-4 shadow-[0_0_45px_rgba(220,38,38,0.28)] animate-tactical-in">
        <div className="flex items-center gap-3 border-b border-red-900/70 pb-3">
          <div className="w-12 h-12 flex items-center justify-center bg-red-950/90 border border-red-500/70 text-red-400 shrink-0">
            <Skull className="w-7 h-7" />
          </div>
          <div>
            <div className="font-tech text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">
              SINAL PERDIDO · CELA 09
            </div>
            <h2 className="font-horror text-2xl sm:text-3xl font-black tracking-wider text-white">
              VOCÊ FOI CAPTURADO
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          P. Drizzy interceptou seu sinal no Setor 09 após{' '}
          <strong className="text-amber-300 font-tech">{formatTime(hud.elapsedSec)}</strong> no modo{' '}
          <strong className="text-white">{diffLabel}</strong>. Use armários, dutos de ventilação e o Taser para sobreviver.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onRestart}
            className="horror-btn horror-btn-primary py-3 font-horror text-sm font-extrabold tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            TENTAR NOVAMENTE
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="horror-btn py-3 font-horror text-sm font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            MENU PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  );
};
