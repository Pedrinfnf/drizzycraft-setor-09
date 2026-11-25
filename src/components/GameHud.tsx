import React, { useEffect, useRef } from 'react';
import {
  Backpack,
  BookOpen,
  Map as MapIcon,
  PackageMinus,
  Pause,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getDeviceGlyphs } from '../game/inputManager';
import type { GameSettings, HudSnapshot, ItemType, ReticleState } from '../game/types';
import { ItemSvgIcon as CustomItemSvgIcon, UvLensIcon, WarningBeaconIcon } from './icons/GameIcons';

interface GameHudProps {
  hud: HudSnapshot;
  settings: GameSettings;
  muted: boolean;
  onBindMinimapCanvas: (canvas: HTMLCanvasElement | null) => void;
  onOpenBackpack: () => void;
  onOpenMap: () => void;
  onOpenJournal: () => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onSelectSlot: (idx: number) => void;
  onDropActiveItem: () => void;
  onInteractClick: () => void;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSpeedrunTimer(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Backwards-compatible wrapper around our multi-layer custom SVG icon library */
export const ItemSvgIcon: React.FC<{ itemType: ItemType; uvMode?: boolean; className?: string }> = ({
  itemType,
  uvMode = false,
  className = 'w-6 h-6 sm:w-7 sm:h-7',
}) => <CustomItemSvgIcon item={itemType} uvActive={uvMode} className={className} />;

const DynamicReticle: React.FC<{ state: ReticleState; uvMode: boolean }> = ({ state, uvMode }) => {
  if (state === 'pickup') {
    return (
      <svg
        viewBox="0 0 28 28"
        className="w-6 h-6 transition-transform duration-150 scale-110 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
        data-reticle-state="pickup"
        aria-hidden="true"
      >
        <path d="M4 10 V5 H10 M18 5 H24 V10 M24 18 V23 H18 M10 23 H4 V18" fill="none" stroke="#34d399" strokeWidth="2" />
        <circle cx="14" cy="14" r="2.4" fill="#6ee7b7" />
      </svg>
    );
  }
  if (state === 'locked') {
    return (
      <svg
        viewBox="0 0 28 28"
        className="w-6 h-6 transition-transform duration-150 scale-110 drop-shadow-[0_0_6px_rgba(248,113,113,0.75)]"
        data-reticle-state="locked"
        aria-hidden="true"
      >
        <rect x="8" y="13" width="12" height="9" rx="1" fill="none" stroke="#f87171" strokeWidth="2" />
        <path d="M10.5 13 V10 A3.5 3.5 0 0 1 17.5 10 V13" fill="none" stroke="#f87171" strokeWidth="2" />
        <circle cx="14" cy="17.5" r="1.4" fill="#fca5a5" />
      </svg>
    );
  }
  if (state === 'hide') {
    return (
      <svg
        viewBox="0 0 28 28"
        className="w-6 h-6 transition-transform duration-150 scale-110 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]"
        data-reticle-state="hide"
        aria-hidden="true"
      >
        <path d="M4 14 Q14 6 24 14 Q14 22 4 14 Z" fill="none" stroke="#38bdf8" strokeWidth="1.9" />
        <circle cx="14" cy="14" r="2.4" fill="#7dd3fc" />
      </svg>
    );
  }
  if (state === 'interact') {
    return (
      <svg
        viewBox="0 0 28 28"
        className="w-5 h-5 transition-transform duration-150 scale-110 drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
        data-reticle-state="interact"
        aria-hidden="true"
      >
        <polygon points="14,3 25,14 14,25 3,14" fill="none" stroke="#fbbf24" strokeWidth="2" />
        <circle cx="14" cy="14" r="2.2" fill="#fde68a" />
      </svg>
    );
  }
  return (
    <div
      data-reticle-state="idle"
      className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
        uvMode
          ? 'bg-purple-300 ring-2 ring-purple-500/50 shadow-[0_0_8px_rgba(192,132,252,0.85)]'
          : 'bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.9)]'
      }`}
    />
  );
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  settings,
  muted,
  onBindMinimapCanvas,
  onOpenBackpack,
  onOpenMap,
  onOpenJournal,
  onOpenSettings,
  onToggleMute,
  onPause,
  onSelectSlot,
  onDropActiveItem,
  onInteractClick,
}) => {
  const miniRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    onBindMinimapCanvas(miniRef.current);
    return () => onBindMinimapCanvas(null);
  }, [onBindMinimapCanvas]);

  const activeItem = hud.hotbar[hud.activeSlot];
  const noiseBars = Math.min(5, Math.ceil(hud.noiseLevel * 5));
  const backpackUsed = hud.backpackItems.filter((s) => s.itemType !== null).length;
  const glyphs = getDeviceGlyphs(hud.inputMode, hud.gamepadStyle);
  const isTouch = hud.inputMode === 'touch';

  const hudScale = Math.max(0.75, Math.min(1.25, settings.controls.hudScale ?? 1.0));
  const hudOpacity = Math.max(0.45, Math.min(1.0, settings.controls.hudOpacity ?? 0.96));
  const minimapOpacity = Math.max(0.45, Math.min(1.0, settings.controls.minimapOpacity ?? 0.94));
  const minimapSize = settings.controls.minimapSize ?? 'md';
  const minimapDimClass =
    minimapSize === 'sm'
      ? 'w-[60px] h-[60px] sm:w-[88px] sm:h-[88px]'
      : minimapSize === 'lg'
      ? 'w-[86px] h-[86px] sm:w-[132px] sm:h-[132px]'
      : 'w-[74px] h-[74px] sm:w-[110px] sm:h-[110px]';
  const subtitleSizeClass =
    settings.audio.subtitleSize === 'sm'
      ? 'text-[11px]'
      : settings.audio.subtitleSize === 'lg'
      ? 'text-sm sm:text-base'
      : 'text-xs sm:text-sm';
  const useDynamicCrosshair = settings.controls.dynamicCrosshair !== false;

  return (
    <div
      data-testid="game-hud"
      data-input-mode={hud.inputMode}
      className="fixed inset-0 z-20 pointer-events-none select-none text-slate-100"
      style={{
        opacity: hudOpacity,
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      {/* Top Row: Tactical Left Telemetry Deck + Compact Right Utilities & Blueprint Minimap */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left: Location + Vitality + Integrated Battery/UV, Stamina & Noise Deck */}
        <div
          className="flex flex-col gap-1.5 max-w-[186px] sm:max-w-[264px] origin-top-left"
          style={{ transform: hudScale !== 1 ? `scale(${hudScale})` : undefined }}
        >
          {/* Sector Header + Vitality Pips */}
          <div className="hud-tactical-panel px-2.5 py-1.5 flex items-center justify-between gap-2 border-l-2 border-l-amber-400/90">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[9px] font-tech font-bold uppercase px-1.5 py-0.5 ${
                    hud.floor === -1
                      ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50'
                      : 'bg-amber-950/75 text-amber-300 border border-amber-500/45'
                  }`}
                >
                  {hud.floor === -1 ? 'SUBSOLO -1' : 'TÉRREO 0'}
                </span>
                <span className="text-[10px] font-tech text-slate-300">
                  {formatTimer(hud.elapsedSec)}
                </span>
              </div>
              <div className="font-horror text-xs sm:text-sm font-bold text-white tracking-wider truncate mt-0.5">
                {hud.roomName}
              </div>
            </div>

            {/* Tactical Vitality Hearts */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" aria-label={`Vida ${hud.health} de ${hud.maxHealth}`}>
              {Array.from({ length: hud.maxHealth }).map((_, idx) => {
                const full = idx < hud.health;
                return (
                  <svg
                    key={idx}
                    viewBox="0 0 20 20"
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      full ? 'drop-shadow-[0_0_5px_rgba(239,68,68,0.65)]' : 'opacity-40'
                    }`}
                    aria-hidden="true"
                  >
                    <path
                      d="M10 17.5 L3.2 10.8 A4.2 4.2 0 0 1 10 5.4 A4.2 4.2 0 0 1 16.8 10.8 Z"
                      fill={full ? '#ef4444' : '#1e293b'}
                      stroke={full ? '#fecaca' : '#475569'}
                      strokeWidth="1.3"
                    />
                  </svg>
                );
              })}
            </div>
          </div>

          {/* Integrated Tactical Telemetry Deck: UV/Battery Bar + Stamina Bar + Acoustic Noise Bars */}
          <div className="hud-tactical-panel px-2.5 py-1.5 space-y-1.5 font-tech">
            {/* Battery / UV Row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <UvLensIcon
                  className={`w-3.5 h-3.5 ${
                    hud.flashlightOn
                      ? hud.uvMode
                        ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]'
                        : 'text-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.7)]'
                      : 'text-slate-500'
                  }`}
                />
                <span className="text-[9px] uppercase text-slate-400">
                  {hud.uvMode ? 'UV' : 'BAT'}
                </span>
              </div>
              <div className="flex-1 h-1.5 bg-slate-900 border border-slate-700/80 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    hud.battery < 20
                      ? 'bg-red-500'
                      : hud.uvMode
                      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-400'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, hud.battery))}%` }}
                />
              </div>
              <span
                className={`text-[9px] font-bold w-7 text-right ${
                  hud.battery < 20 ? 'text-red-400' : hud.uvMode ? 'text-purple-300' : 'text-amber-200'
                }`}
              >
                {hud.battery}%
              </span>
            </div>

            {/* Stamina Row (Always integrated cleanly, pulses crimson on exhaustion!) */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase text-slate-400 w-9 shrink-0">
                {hud.staminaExhausted ? 'EXAUST' : 'ESTAM'}
              </span>
              <div className="flex-1 h-1.5 bg-slate-900 border border-slate-700/80 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.staminaExhausted
                      ? 'bg-red-600 animate-pulse'
                      : hud.stamina < 28
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-300'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-300 w-7 text-right">
                {Math.round(hud.stamina)}%
              </span>
            </div>

            {/* Posture & Acoustic Noise Row */}
            <div className="flex items-center justify-between pt-0.5 border-t border-slate-800/90 text-[9px]">
              <span
                className={`uppercase font-bold tracking-wider ${
                  hud.hiding
                    ? 'text-cyan-300'
                    : hud.inVent
                    ? 'text-sky-300'
                    : hud.sprinting
                    ? 'text-amber-300'
                    : 'text-slate-400'
                }`}
              >
                {hud.hiding
                  ? 'OCULTO'
                  : hud.inVent
                  ? 'DUTO AR'
                  : hud.crouching
                  ? 'AGACHADO'
                  : hud.sprinting
                  ? 'CORRENDO'
                  : 'EM PÉ'}
              </span>

              {settings.gameplay.showNoiseIndicator && (
                <div
                  className="flex items-center gap-1.5"
                  title="Nível de ruído emitido"
                  aria-label={`Ruído ${Math.round(hud.noiseLevel * 100)}%`}
                >
                  <span className="text-[8px] uppercase text-slate-500">dB</span>
                  <div className="flex items-end gap-[2px] h-2.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className={`w-[3px] transition-all duration-100 ${
                          lvl <= noiseBars
                            ? lvl >= 4
                              ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                              : 'bg-amber-400'
                            : 'bg-slate-700/80'
                        }`}
                        style={{ height: `${lvl * 2 + 1}px` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compact Active Perks Tag */}
            {hud.activePerks && hud.activePerks.length > 0 && (
              <div className="flex items-center justify-between pt-0.5 border-t border-slate-800/80 text-[8px] font-tech">
                <span
                  data-testid="hud-active-perks"
                  className="uppercase font-bold tracking-wider text-amber-300/95 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5"
                >
                  PERKS: {hud.activePerks.length}
                </span>
                <span className="text-slate-500 uppercase tracking-wider">ATIVOS</span>
              </div>
            )}
          </div>

          {/* Optional Accessibility Visual Audio Cue (ZERO raw emoji — custom SVG beacon!) */}
          {settings.gameplay.visualAudioCues && hud.diddyDistance <= 14 && (
            <div className="hud-tactical-panel px-2 py-1 border-l-2 border-l-red-500 bg-red-950/60 flex items-center gap-1.5 text-[9px] font-tech uppercase text-red-200 animate-pulse">
              <WarningBeaconIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">
                {hud.diddyDistance <= 6
                  ? 'PASSOS PESADOS MUITO PRÓXIMOS'
                  : 'PASSOS PESADOS NO CORREDOR'}
              </span>
            </div>
          )}

          {/* Objective Indicator */}
          {settings.gameplay.showObjectiveHints && hud.objectiveText && (
            <div
              className={`hud-tactical-panel px-2.5 py-1.5 border-l-2 max-h-[58px] overflow-hidden ${
                hud.blackoutActive ? 'border-l-red-500 bg-red-950/55' : 'border-l-amber-400'
              }`}
            >
              <div
                className={`text-[8px] sm:text-[9px] font-tech font-bold uppercase tracking-[0.15em] leading-none ${
                  hud.blackoutActive ? 'text-red-400' : 'text-amber-400'
                }`}
              >
                {hud.blackoutActive ? 'ALERTA // BLECAUTE' : 'DIRETRIZ ATUAL'}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-200 leading-tight mt-0.5 line-clamp-2">
                {hud.objectiveText}
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Tactical Utility Buttons + Opt-In FPS + Blueprint Minimap */}
        <div
          className="flex flex-col items-end gap-1.5 origin-top-right"
          style={{ transform: hudScale !== 1 ? `scale(${hudScale})` : undefined }}
        >
          <div className="flex items-center gap-1 pointer-events-auto">
            {settings.video.showFps && (
              <div
                data-testid="hud-fps-counter"
                className="hud-tactical-panel px-2 py-1 text-[10px] font-tech font-bold text-emerald-300 pointer-events-none"
              >
                {hud.fps} FPS
              </div>
            )}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-backpack-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenBackpack();
              }}
              aria-label={`Abrir Mochila [${glyphs.backpack}]`}
              className="horror-btn p-1.5 sm:p-2 text-emerald-300 relative cursor-pointer"
            >
              <Backpack className="w-4 h-4" />
              <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-600 text-white text-[8px] font-tech font-extrabold px-1 leading-tight">
                {backpackUsed}
              </span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenMap();
              }}
              aria-label={`Abrir Mapa [${glyphs.map}]`}
              className="horror-btn p-1.5 sm:p-2 text-cyan-300 cursor-pointer"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-journal-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenJournal();
              }}
              aria-label={`Abrir Diário de Pistas [${glyphs.journal}]`}
              className="horror-btn p-1.5 sm:p-2 text-amber-300 relative cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              {hud.cluesFound > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 bg-amber-500 text-black text-[8px] font-tech font-extrabold px-1 leading-tight">
                  {hud.cluesFound}
                </span>
              )}
            </button>
            {!isTouch && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-settings-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenSettings();
                  }}
                  aria-label="Abrir Configurações"
                  className="horror-btn p-1.5 sm:p-2 text-slate-200 hidden sm:flex cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}
                  className="horror-btn p-1.5 sm:p-2 text-slate-200 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </>
            )}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-pause-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label={`Pausar [${glyphs.pause}]`}
              className="horror-btn p-1.5 sm:p-2 text-slate-200 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Clean Architectural Blueprint Minimap Module */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenMap();
            }}
            aria-label="Expandir Mapa Fog of War"
            style={{ opacity: minimapOpacity }}
            className="hud-tactical-panel p-1.5 pointer-events-auto relative cursor-pointer [@media(max-height:430px)]:hidden group"
          >
            <div className="relative border border-slate-700/80 bg-slate-950 overflow-hidden">
              <canvas
                ref={miniRef}
                width={148}
                height={148}
                className={`block ${minimapDimClass}`}
              />
              {/* Blueprint corner crosshairs */}
              <span className="absolute top-1 left-1 text-[7px] sm:text-[8px] font-tech font-bold uppercase px-1 bg-black/85 border border-amber-500/40 text-amber-300">
                {hud.floor === -1 ? 'NV-1' : 'NV 0'}
              </span>
              <span className="absolute bottom-1 right-1 text-[7px] sm:text-[8px] font-tech px-1 bg-black/85 border border-cyan-500/40 text-cyan-300">
                {hud.exploredPct}%
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Optional Top-Center Precision Speedrun Timer */}
      {settings.gameplay.showSpeedrunTimer && (
        <div
          data-testid="speedrun-timer"
          className="fixed left-1/2 -translate-x-1/2 pointer-events-none z-20"
          style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="hud-tactical-panel px-2.5 py-1 border-b-2 border-b-amber-400/85 flex items-center gap-1.5 shadow-[0_0_16px_rgba(245,158,11,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-tech text-[11px] sm:text-xs font-extrabold tracking-wider text-amber-200">
              {formatSpeedrunTimer(hud.elapsedSec)}
            </span>
          </div>
        </div>
      )}

      {/* Exact Screen-Center Dynamic Morphing Reticle */}
      {!hud.hiding && !hud.keypadOpen && !hud.cctvOpen && !hud.workbenchOpen && !hud.terminalOpen && !hud.quickInspect && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <DynamicReticle state={useDynamicCrosshair ? hud.reticleState : 'idle'} uvMode={hud.uvMode} />
        </div>
      )}

      {/* Interactive Hiding Spot Hold-Breath Minigame Overlay */}
      {hud.holdBreathActive && (
        <div
          data-testid="hold-breath-overlay"
          className="fixed left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm pointer-events-none z-30"
        >
          <div className="horror-panel p-3 sm:p-3.5 border-2 border-red-500/90 space-y-2 shadow-[0_0_28px_rgba(239,68,68,0.35)]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-horror text-xs sm:text-sm font-extrabold uppercase tracking-wider text-red-400">
                PRENDA A RESPIRAÇÃO
              </span>
              <span className="text-[10px] font-tech font-bold text-amber-300">
                {Math.round(hud.holdBreathProgress * 100)}%
              </span>
            </div>

            <div className="relative h-5 w-full bg-slate-950 border border-slate-700 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/35 border-x-2 border-emerald-400"
                style={{
                  left: `${hud.holdBreathZoneMin}%`,
                  width: `${Math.max(4, hud.holdBreathZoneMax - hud.holdBreathZoneMin)}%`,
                }}
              />
              <div
                className={`absolute top-0 bottom-0 w-2 -ml-1 transition-all duration-75 ${
                  hud.holdBreathGauge >= hud.holdBreathZoneMin &&
                  hud.holdBreathGauge <= hud.holdBreathZoneMax
                    ? 'bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.95)]'
                    : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.95)]'
                }`}
                style={{ left: `${Math.max(2, Math.min(98, hud.holdBreathGauge))}%` }}
              />
            </div>

            <div className="w-full h-1.5 bg-slate-950 border border-slate-700 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${Math.round(hud.holdBreathProgress * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] font-tech">
              <span className="text-slate-200 truncate">
                {hud.holdBreathWarning ?? 'MANTENHA NA ZONA VERDE'}
              </span>
              <span className="px-1.5 py-0.5 bg-amber-500 text-black font-extrabold shrink-0">
                {isTouch
                  ? 'SEGURE PRENDER AR'
                  : hud.inputMode === 'gamepad'
                  ? `SEGURE ${glyphs.interact} / ${glyphs.uvOrUse}`
                  : 'SEGURE ESPAÇO'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modern Dynamic Interaction Prompt with Device Glyph */}
      {!hud.holdBreathActive && hud.interactPrompt && !hud.keypadOpen && !hud.cctvOpen && !hud.workbenchOpen && !hud.terminalOpen && !hud.quickInspect && (
        <div className="fixed left-1/2 top-[57%] -translate-x-1/2 pointer-events-auto animate-tactical-in">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onInteractClick();
            }}
            className={`hud-tactical-panel px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2.5 border-l-4 cursor-pointer ${
              hud.interactPrompt.accent === 'red'
                ? 'border-l-red-500 shadow-[0_0_20px_rgba(239,68,68,0.28)]'
                : hud.interactPrompt.accent === 'blue'
                ? 'border-l-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.28)]'
                : hud.interactPrompt.accent === 'emerald'
                ? 'border-l-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.28)]'
                : hud.interactPrompt.accent === 'purple'
                ? 'border-l-purple-400 shadow-[0_0_20px_rgba(192,132,252,0.3)]'
                : 'border-l-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.28)]'
            }`}
          >
            <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-tech text-[11px] font-black shadow-[0_0_10px_rgba(251,191,36,0.5)]">
              {glyphs.interact}
            </span>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white leading-tight">
                {hud.interactPrompt.label}
              </div>
              {hud.interactPrompt.sublabel && (
                <div className="text-[10px] font-tech text-slate-300 leading-tight mt-0.5">
                  {hud.interactPrompt.sublabel}
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Optional Radio / Tape Subtitles Caption */}
      {hud.subtitleText && (
        <div className="fixed left-1/2 bottom-[118px] max-sm:portrait:bottom-[242px] sm:bottom-[126px] -translate-x-1/2 w-[92%] max-w-lg text-center pointer-events-none">
          <div className={`inline-block hud-tactical-panel border-l-2 border-l-emerald-400 px-3.5 py-1.5 ${subtitleSizeClass} text-slate-100 leading-snug`}>
            {hud.subtitleText}
          </div>
        </div>
      )}

      {/* Discreet Status Caption Banner */}
      {hud.statusBanner && (
        <div className="fixed left-1/2 bottom-[76px] max-sm:portrait:bottom-[208px] sm:bottom-[88px] -translate-x-1/2 w-[90%] max-w-md text-center pointer-events-none">
          <div className="inline-block hud-tactical-panel border border-amber-500/60 px-3 py-1 text-xs font-medium text-amber-200">
            {hud.statusBanner}
          </div>
        </div>
      )}

      {/* Bottom Center: Tactical Numbered Hotbar with Glowing Active Slot & Ammo/Charge Counters */}
      <div
        className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-auto"
        style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {activeItem?.label && (
          <div className="hud-tactical-panel flex items-center gap-2 text-[10px] sm:text-xs font-tech text-slate-100 px-2.5 py-0.5">
            <span className="truncate max-w-[140px] sm:max-w-none font-bold text-amber-200">
              {activeItem.label}
            </span>
            {!isTouch && hud.contextualUseLabel && (
              <span className="text-[9px] text-cyan-300 border-l border-slate-700 pl-2">
                [{glyphs.uvOrUse}] {hud.contextualUseLabel}
              </span>
            )}
            {hud.canDropActiveItem && (
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-drop-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onDropActiveItem();
                }}
                aria-label={`Dropar item equipado [${glyphs.drop}]`}
                className="flex items-center gap-1 text-[9px] font-extrabold uppercase text-red-300 hover:text-red-200 border-l border-slate-700 pl-2 cursor-pointer"
              >
                <PackageMinus className="w-3 h-3" />
                <span>{isTouch ? 'Dropar' : `Dropar [${glyphs.drop}]`}</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-1.5">
          {hud.hotbar.map((slot) => {
            const selected = slot.slotIndex === hud.activeSlot;
            const isUvFlashlight = selected && slot.itemType === 'flashlight' && hud.uvMode;
            return (
              <button
                key={slot.slotIndex}
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectSlot(slot.slotIndex);
                }}
                aria-label={slot.itemType ? `Slot ${slot.slotIndex + 1}: ${slot.label}` : `Slot ${slot.slotIndex + 1} vazio`}
                className={`relative w-[40px] h-[40px] sm:w-[52px] sm:h-[52px] flex items-center justify-center cursor-pointer ${
                  isUvFlashlight
                    ? 'horror-slot-uv'
                    : selected
                    ? 'horror-slot-active'
                    : 'horror-slot'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-tech font-bold ${
                    selected ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  {slot.slotIndex + 1}
                </span>
                {slot.itemType && (
                  <CustomItemSvgIcon
                    item={slot.itemType}
                    uvActive={hud.uvMode}
                    className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
                  />
                )}
                {slot.count !== undefined && (
                  <span className="absolute bottom-0.5 right-1 text-[8px] sm:text-[9px] font-tech font-black text-amber-300 bg-black/70 px-0.5 leading-tight">
                    x{slot.count}
                  </span>
                )}
                {slot.chargePct !== undefined && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[7px] sm:text-[8px] font-tech font-bold bg-black/70 px-0.5 leading-tight ${
                      slot.chargePct < 20 ? 'text-red-400' : hud.uvMode ? 'text-purple-300' : 'text-cyan-300'
                    }`}
                  >
                    {slot.chargePct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Discreet Bottom-Right PC / Gamepad Keybind Bar */}
      {!isTouch && (
        <div
          data-testid="desktop-keybind-bar"
          className="fixed right-3 bottom-3 hidden xl:flex items-center gap-2 hud-tactical-panel px-2.5 py-1 text-[10px] font-tech text-slate-300 pointer-events-none"
        >
          <span>
            <strong className="text-amber-300">[{glyphs.flashlight}]</strong> Luz
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <strong className="text-amber-300">[{glyphs.crouch}]</strong> Agach.
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <strong className="text-amber-300">[{glyphs.drop}]</strong> Dropar
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <strong className="text-amber-300">[{glyphs.backpack}]</strong> Mochila
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <strong className="text-amber-300">[{glyphs.hotbarSwitch}]</strong> Slots
          </span>
        </div>
      )}
    </div>
  );
};
