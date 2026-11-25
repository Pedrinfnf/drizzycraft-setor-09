import React, { useEffect, useState } from 'react';
import { Coins, Trophy } from 'lucide-react';
import type { AchievementCategory, AchievementToastPayload } from '../game/types';

export interface AchievementToastProps {
  toast: AchievementToastPayload | null;
  onDismiss?: () => void;
  durationMs?: number;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  story: 'HISTÓRIA',
  challenge: 'DESAFIO',
  exploration: 'EXPLORAÇÃO',
  arsenal: 'ARSENAL',
};

export const AchievementToast: React.FC<AchievementToastProps> = ({
  toast,
  onDismiss,
  durationMs = 4500,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const fadeOutAt = Math.max(400, durationMs - 320);

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, fadeOutAt);

    const dismissTimer = window.setTimeout(() => {
      onDismiss?.();
    }, durationMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [toast, durationMs, onDismiss]);

  if (!toast) return null;

  return (
    <div
      data-testid="achievement-toast"
      role="status"
      aria-live="polite"
      className={`fixed top-3 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-50 w-[92vw] max-w-sm pointer-events-none transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-95'
      }`}
      style={{
        marginTop: 'env(safe-area-inset-top)',
        marginRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="horror-panel tactical-grid-bg border-l-4 border-l-amber-400 border-amber-500/50 px-3.5 py-2.5 shadow-[0_0_28px_rgba(245,158,11,0.3)] relative overflow-hidden">
        <div className="flex items-start gap-3">
          {/* Trophy SVG Emblem */}
          <div className="w-10 h-10 shrink-0 bg-amber-950/80 border border-amber-400/75 flex items-center justify-center shadow-[inset_0_0_12px_rgba(251,191,36,0.28)]">
            <Trophy className="w-5 h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-tech font-extrabold uppercase tracking-[0.18em] text-amber-400 truncate">
                CONQUISTA · {CATEGORY_LABELS[toast.category] ?? 'SETOR 09'}
              </span>
              {toast.rewardCoins > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/70 text-[9px] font-tech font-black text-amber-200 shrink-0">
                  <Coins className="w-2.5 h-2.5 text-amber-300" />
                  +{toast.rewardCoins} MOEDAS
                </span>
              )}
            </div>

            <div className="font-horror text-sm sm:text-base font-extrabold text-white tracking-wider leading-tight mt-0.5 truncate">
              {toast.title}
            </div>
            <div className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-2">
              {toast.description}
            </div>
          </div>
        </div>

        {/* VHS Scanline Accent Strip */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-800/90 overflow-hidden">
          <div
            key={toast.id}
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 transition-all ease-linear"
            style={{
              width: visible ? '0%' : '100%',
              transitionDuration: `${durationMs}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
