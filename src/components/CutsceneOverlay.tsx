import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, FastForward, Radio } from 'lucide-react';
import type {
  CutsceneUiState,
  GamepadGlyphStyle,
  InputMode,
  SpeakerId,
} from '../game/types';
import type { CharacterPortraitId } from '../game/portraitRenderer';
import { RadioWaveIcon } from './icons/GameIcons';

interface CutsceneOverlayProps {
  state: CutsceneUiState;
  portraits?: Record<CharacterPortraitId, string>;
  inputMode?: InputMode;
  gamepadStyle?: GamepadGlyphStyle;
  onAdvance: () => void;
  onSkip: () => void;
  onVoiceBlip?: (speaker: SpeakerId) => void;
  onSpeakStep?: (speaker: SpeakerId, text: string) => void;
  onStopSpeaking?: () => void;
}

function getSpeakerMeta(speaker: SpeakerId, fallbackName: string): {
  portraitId: CharacterPortraitId;
  badge: string;
  subtag: string;
  accentBorder: string;
  accentText: string;
  accentGlow: string;
} {
  switch (speaker) {
    case 'radio':
      return {
        portraitId: 'marcos',
        badge: fallbackName || 'VIGIA MARCOS',
        subtag: 'RÁDIO SETOR 09 // CH-04',
        accentBorder: 'border-emerald-400/85',
        accentText: 'text-emerald-300',
        accentGlow: 'shadow-[0_0_24px_rgba(52,211,153,0.28)]',
      };
    case 'diddy':
      return {
        portraitId: 'diddy',
        badge: fallbackName || 'P. DRIZZY',
        subtag: 'SUJEITO 09 // CONTENÇÃO ROMPIDA',
        accentBorder: 'border-red-500/90',
        accentText: 'text-red-400',
        accentGlow: 'shadow-[0_0_28px_rgba(239,68,68,0.4)]',
      };
    default:
      return {
        portraitId: 'survivor',
        badge: fallbackName || 'PROTAGONISTA',
        subtag: 'INVESTIGADOR // INV-09',
        accentBorder: 'border-amber-400/85',
        accentText: 'text-amber-300',
        accentGlow: 'shadow-[0_0_24px_rgba(245,158,11,0.28)]',
      };
  }
}

export const CutsceneOverlay: React.FC<CutsceneOverlayProps> = ({
  state,
  portraits,
  inputMode = 'pc',
  gamepadStyle = 'playstation',
  onAdvance,
  onSkip,
  onVoiceBlip,
  onSpeakStep,
  onStopSpeaking,
}) => {
  const { step, chapterTitle, subtitle, stepIndex, totalSteps, progress } = state;
  const [visibleChars, setVisibleChars] = useState(0);
  const voiceBlipRef = useRef(onVoiceBlip);
  voiceBlipRef.current = onVoiceBlip;
  const speakStepRef = useRef(onSpeakStep);
  speakStepRef.current = onSpeakStep;
  const stopSpeakRef = useRef(onStopSpeaking);
  stopSpeakRef.current = onStopSpeaking;

  const meta = getSpeakerMeta(step.speaker, step.speakerName);
  const portraitSrc = portraits?.[meta.portraitId] ?? '';

  // Smooth typewriter reveal + rhythmic speaker voice blips + optional voice dubbing
  useEffect(() => {
    setVisibleChars(0);
    if (!step.text) return;
    speakStepRef.current?.(step.speaker, step.text);
    let idx = 0;
    let ticks = 0;
    const timer = window.setInterval(() => {
      idx += 2;
      ticks += 1;
      if (ticks % 4 === 1 && idx < step.text.length) {
        voiceBlipRef.current?.(step.speaker);
      }
      if (idx >= step.text.length) {
        setVisibleChars(step.text.length);
        window.clearInterval(timer);
      } else {
        setVisibleChars(idx);
      }
    }, 20);
    return () => {
      window.clearInterval(timer);
      stopSpeakRef.current?.();
    };
  }, [step.id, step.text, step.speaker]);

  const displayedText = step.text.slice(0, visibleChars);
  const isTyping = visibleChars < step.text.length;

  const handleDialogueTap = () => {
    if (isTyping) {
      setVisibleChars(step.text.length);
    } else {
      onAdvance();
    }
  };

  const skipLabel =
    inputMode === 'touch'
      ? 'PULAR CUTSCENE'
      : inputMode === 'gamepad'
      ? gamepadStyle === 'playstation'
        ? '[O / OPT] PULAR'
        : '[B / MENU] PULAR'
      : '[ESC] PULAR';

  const advanceLabel =
    inputMode === 'touch'
      ? 'TOCAR'
      : inputMode === 'gamepad'
      ? gamepadStyle === 'playstation'
        ? '[X] AVANÇAR'
        : '[A] AVANÇAR'
      : '[ESPAÇO] AVANÇAR';

  return (
    <div
      data-testid="cutscene-overlay"
      className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between select-none"
    >
      {/* Top Cinematic Letterbox Bar + VHS Transmission Header */}
      <div
        className="w-full bg-black/95 border-b border-slate-800/80 px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 pointer-events-auto"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)] shrink-0" />
          <span className="font-tech text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-red-400 shrink-0">
            REC
          </span>
          <span className="text-slate-600 shrink-0">|</span>
          <span className="font-horror text-xs sm:text-sm tracking-[0.14em] text-amber-300 truncate">
            {chapterTitle}
          </span>
          {subtitle && (
            <span className="hidden md:inline font-tech text-[10px] uppercase tracking-widest text-slate-400 truncate">
              · {subtitle}
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="cutscene-skip-btn"
          onClick={onSkip}
          className="horror-btn px-3 py-1.5 flex items-center gap-1.5 text-[10px] sm:text-xs font-tech font-bold uppercase tracking-wider text-slate-100 cursor-pointer shrink-0"
        >
          <FastForward className="w-3.5 h-3.5 text-amber-400" />
          <span>{skipLabel}</span>
        </button>
      </div>

      {/* Bottom Cinematic Dialogue Box + 3D Rendered Bust Portrait + Letterbox */}
      <div className="w-full flex flex-col">
        <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 pb-3 sm:pb-4 pointer-events-auto">
          <div
            role="button"
            tabIndex={0}
            onClick={handleDialogueTap}
            onKeyDown={(e) => {
              if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleDialogueTap();
              }
            }}
            className={`horror-panel backdrop-blur-md p-3 sm:p-4 border-l-4 ${meta.accentBorder} ${meta.accentGlow} flex items-center gap-3 sm:gap-4 cursor-pointer animate-tactical-in`}
          >
            {/* Real 3D Rendered Micro-Voxel Character Bust Portrait */}
            <div className="relative w-16 h-16 sm:w-24 sm:h-24 shrink-0 bg-slate-950 border border-slate-600/80 overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.8)]">
              {portraitSrc ? (
                <img
                  src={portraitSrc}
                  alt={meta.badge}
                  data-testid={`cutscene-portrait-${meta.portraitId}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-950 text-emerald-400">
                  <RadioWaveIcon className="w-9 h-9 opacity-85" />
                </div>
              )}
              <div className="absolute inset-0 tactical-scanlines pointer-events-none opacity-60" />
              <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-white/55 pointer-events-none" />
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-white/55 pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 bg-black/80 px-1 py-0.5 text-[8px] font-tech text-center uppercase tracking-wider text-slate-300">
                {step.speaker === 'radio' ? 'TX-LIVE' : step.speaker === 'diddy' ? 'HOSTIL' : 'CAM-3D'}
              </div>
            </div>

            {/* Speaker ID Header + Typewriter Text + Advance Cue */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {step.speaker === 'radio' && (
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                  )}
                  <span className={`font-horror text-sm sm:text-base font-extrabold tracking-wider ${meta.accentText}`}>
                    {meta.badge}
                  </span>
                  <span className="hidden sm:inline font-tech text-[10px] uppercase tracking-widest text-slate-400 px-1.5 py-0.5 bg-slate-900/90 border border-slate-700/70">
                    {meta.subtag}
                  </span>
                </div>
                <span className="font-tech text-[10px] text-slate-400">
                  {stepIndex + 1}/{totalSteps}
                </span>
              </div>

              <p
                className="text-xs sm:text-base text-slate-100 leading-relaxed min-h-[2.6rem] sm:min-h-[3.2rem]"
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
              >
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-amber-400 align-middle animate-pulse" />
                )}
              </p>

              {/* Progress Rail + Advance Hint */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-slate-900/95 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-red-500 transition-all duration-150"
                    style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}
                  />
                </div>
                <span className="font-tech text-[9px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-0.5 shrink-0">
                  {advanceLabel}
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cinematic Letterbox Bar */}
        <div
          className="w-full h-4 sm:h-6 bg-black/95 border-t border-slate-800/80"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        />
      </div>
    </div>
  );
};
