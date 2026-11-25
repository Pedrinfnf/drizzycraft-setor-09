import React, { useRef, useState } from 'react';
import {
  Backpack,
  Crosshair,
  EyeOff,
  Flashlight,
  Footprints,
  Hand,
  PackageMinus,
  Pause,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DEFAULT_HUD_LAYOUT } from '../game/saveManager';
import type { HudControlId, HudCustomLayout, HudSnapshot, JoystickMode } from '../game/types';

interface TouchControlsProps {
  hud: HudSnapshot;
  buttonScale: number;
  buttonOpacity: number;
  joystickMode: JoystickMode;
  customLayout: HudCustomLayout;
  onJoystick: (nx: number, ny: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onSprintChange: (held: boolean) => void;
  onHoldBreathChange: (held: boolean) => void;
  onToggleCrouch: () => void;
  onToggleFlashlight: () => void;
  onContextualUse: () => void;
  onInteract: () => void;
  onDropActiveItem: () => void;
  onOpenBackpack: () => void;
  onPause: () => void;
}

/**
 * Independent Multi-Touch Controls using Pointer Events (`pointerId`).
 * Supports BOTH Fixed & Floating left analog thumbsticks, free right-side camera drag,
 * and full custom HUD positioning from the interactive HUD Layout Editor.
 */
export const TouchControls: React.FC<TouchControlsProps> = ({
  hud,
  buttonScale,
  buttonOpacity,
  joystickMode,
  customLayout,
  onJoystick,
  onLookDelta,
  onSprintChange,
  onHoldBreathChange,
  onToggleCrouch,
  onToggleFlashlight,
  onContextualUse,
  onInteract,
  onDropActiveItem,
  onOpenBackpack,
  onPause,
}) => {
  const joyPointerId = useRef<number | null>(null);
  const joyOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [floatingCenter, setFloatingCenter] = useState<{ x: number; y: number } | null>(null);

  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sprintPointerId = useRef<number | null>(null);
  const [sprintActive, setSprintActive] = useState(false);
  const breathPointerId = useRef<number | null>(null);
  const [breathActive, setBreathActive] = useState(false);

  const hasCustomLayout = Object.keys(customLayout ?? {}).length > 0;
  const getCfg = (id: HudControlId) => customLayout[id] ?? DEFAULT_HUD_LAYOUT[id];

  const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const joyScaleMult = hasCustomLayout ? getCfg('joystick').scale * buttonScale : buttonScale;
  const joyRadius = Math.round((isPortrait ? 40 : 36) * joyScaleMult);
  const btnPx = Math.max(46, Math.round((isPortrait ? 50 : 46) * buttonScale));
  const controlBottomCss = isPortrait
    ? 'max(4.4rem, calc(env(safe-area-inset-bottom) + 3.9rem))'
    : 'max(0.85rem, env(safe-area-inset-bottom))';

  const updateJoystick = (cx: number, cy: number) => {
    const dx = cx - joyOrigin.current.x;
    const dy = cy - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, joyRadius);
    const angle = Math.atan2(dy, dx);
    const ox = dist > 1 ? Math.cos(angle) * clamped : 0;
    const oy = dist > 1 ? Math.sin(angle) * clamped : 0;
    setKnobOffset({ x: ox, y: oy });
    onJoystick(ox / joyRadius, oy / joyRadius);
  };

  const handleFixedJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== null) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystick(e.clientX, e.clientY);
  };

  const handleFloatingJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== null) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    joyOrigin.current = { x: e.clientX, y: e.clientY };
    setFloatingCenter({ x: e.clientX, y: e.clientY });
    setKnobOffset({ x: 0, y: 0 });
    onJoystick(0, 0);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyPointerId.current) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyPointerId.current) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    setFloatingCenter(null);
    onJoystick(0, 0);
  };

  // Free Right-Half Camera Drag Look (tracks independent pointerId)
  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    onLookDelta(dx, dy);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    lookPointerId.current = null;
  };

  const getCustomPosStyle = (id: HudControlId, baseW: number, baseH: number): React.CSSProperties => {
    const cfg = getCfg(id);
    return {
      left: `${cfg.xPct}%`,
      top: `${cfg.yPct}%`,
      width: `${Math.max(42, Math.round(baseW * cfg.scale * buttonScale))}px`,
      height: `${Math.max(42, Math.round(baseH * cfg.scale * buttonScale))}px`,
      opacity: Math.max(0.25, Math.min(1, cfg.opacity)),
    };
  };

  return (
    <div
      data-testid="touch-controls-root"
      className="fixed inset-0 z-10 pointer-events-none select-none touch-none"
      style={{ opacity: buttonOpacity }}
    >
      {/* Full Right-Side Camera Drag Pad */}
      <div
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        className="fixed top-14 bottom-16 left-[38%] right-0 pointer-events-auto touch-none"
        aria-label="Área de arrastar para olhar"
      />

      {/* Left Analog Joystick: Floating OR Fixed */}
      {!hud.hiding && joystickMode === 'floating' ? (
        <div
          data-testid="touch-joystick"
          onPointerDown={handleFloatingJoyDown}
          onPointerMove={handleJoyMove}
          onPointerUp={handleJoyUp}
          onPointerCancel={handleJoyUp}
          aria-label="Joystick flutuante de movimento"
          className="fixed top-20 bottom-16 left-0 w-[38%] pointer-events-auto touch-none"
        >
          {floatingCenter ? (
            <div
              className="fixed -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/60 border-2 border-amber-400/80 flex items-center justify-center pointer-events-none"
              style={{
                left: `${floatingCenter.x}px`,
                top: `${floatingCenter.y}px`,
                width: `${joyRadius * 2 + 16}px`,
                height: `${joyRadius * 2 + 16}px`,
              }}
            >
              <div
                className="rounded-full bg-amber-500/85 border-2 border-amber-200 pointer-events-none"
                style={{
                  width: `${Math.round(34 * joyScaleMult)}px`,
                  height: `${Math.round(34 * joyScaleMult)}px`,
                  transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
                }}
              />
            </div>
          ) : (
            <div
              className="fixed rounded-full bg-slate-950/35 border border-dashed border-slate-400/50 flex items-center justify-center pointer-events-none text-[9px] font-mono-num uppercase text-slate-300/75"
              style={{
                width: `${joyRadius * 2}px`,
                height: `${joyRadius * 2}px`,
                left: 'max(0.85rem, env(safe-area-inset-left))',
                bottom: controlBottomCss,
              }}
            >
              MOVER
            </div>
          )}
        </div>
      ) : !hud.hiding ? (
        <div
          data-testid="touch-joystick"
          onPointerDown={handleFixedJoyDown}
          onPointerMove={handleJoyMove}
          onPointerUp={handleJoyUp}
          onPointerCancel={handleJoyUp}
          aria-label="Joystick de movimento"
          className={`fixed pointer-events-auto touch-none rounded-full bg-slate-950/60 border-2 border-slate-500/75 flex items-center justify-center ${
            hasCustomLayout ? '-translate-x-1/2 -translate-y-1/2' : ''
          }`}
          style={
            hasCustomLayout
              ? {
                  width: `${joyRadius * 2 + 16}px`,
                  height: `${joyRadius * 2 + 16}px`,
                  left: `${getCfg('joystick').xPct}%`,
                  top: `${getCfg('joystick').yPct}%`,
                  opacity: getCfg('joystick').opacity,
                }
              : {
                  width: `${joyRadius * 2 + 16}px`,
                  height: `${joyRadius * 2 + 16}px`,
                  left: 'max(0.75rem, env(safe-area-inset-left))',
                  bottom: controlBottomCss,
                }
          }
        >
          <div
            className="rounded-full bg-amber-500/85 border-2 border-amber-200 pointer-events-none"
            style={{
              width: `${Math.round(34 * joyScaleMult)}px`,
              height: `${Math.round(34 * joyScaleMult)}px`,
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
      ) : null}

      {/* Custom-Positioned Controls (when user customized HUD in Editor) vs Default Zero-Overlap Cluster */}
      {hasCustomLayout ? (
        <>
          {hud.contextualUseLabel && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onContextualUse();
              }}
              aria-label={`Usar item: ${hud.contextualUseLabel}`}
              data-testid="mobile-contextual-use"
              style={getCustomPosStyle('uv', 56, 50)}
              className={`fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 text-[8px] font-extrabold uppercase px-0.5 ${
                hud.uvMode
                  ? 'bg-purple-900/90 border-purple-400 text-purple-100'
                  : hud.contextualUseLabel.startsWith('ATIRAR')
                  ? 'bg-sky-900/90 border-sky-400 text-sky-100'
                  : 'bg-slate-900/85 border-amber-500/80 text-amber-200'
              }`}
            >
              {hud.contextualUseLabel.startsWith('ATIRAR') ? (
                <Crosshair className="w-4 h-4 mb-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 mb-0.5" />
              )}
              <span className="truncate max-w-full">{hud.contextualUseLabel}</span>
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFlashlight();
            }}
            aria-label="Ligar ou desligar lanterna"
            style={getCustomPosStyle('flashlight', 50, 50)}
            className={`fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
              hud.flashlightOn
                ? hud.uvMode
                  ? 'bg-purple-900/85 border-purple-400 text-purple-200'
                  : 'bg-amber-900/85 border-amber-400 text-amber-200'
                : 'bg-slate-900/85 border-slate-600 text-slate-300'
            }`}
          >
            <Flashlight className="w-4 h-4 mb-0.5" />
            <span>Luz</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleCrouch();
            }}
            aria-label="Agachar ou levantar"
            style={getCustomPosStyle('crouch', 50, 50)}
            className={`fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
              hud.crouching
                ? 'bg-sky-900/85 border-sky-400 text-sky-200'
                : 'bg-slate-900/85 border-slate-600 text-slate-300'
            }`}
          >
            <EyeOff className="w-4 h-4 mb-0.5" />
            <span>{hud.inVent ? 'Duto' : 'Agach.'}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              sprintPointerId.current = e.pointerId;
              setSprintActive(true);
              onSprintChange(true);
            }}
            onPointerUp={(e) => {
              if (e.pointerId !== sprintPointerId.current) return;
              sprintPointerId.current = null;
              setSprintActive(false);
              onSprintChange(false);
            }}
            onPointerCancel={(e) => {
              if (e.pointerId !== sprintPointerId.current) return;
              sprintPointerId.current = null;
              setSprintActive(false);
              onSprintChange(false);
            }}
            aria-label="Segurar para correr"
            style={getCustomPosStyle('sprint', 50, 50)}
            className={`fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
              sprintActive
                ? 'bg-red-800/90 border-red-400 text-white'
                : 'bg-slate-900/85 border-slate-600 text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span>Correr</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (hud.holdBreathActive) {
                e.currentTarget.setPointerCapture(e.pointerId);
                breathPointerId.current = e.pointerId;
                setBreathActive(true);
                onHoldBreathChange(true);
              } else {
                onInteract();
              }
            }}
            onPointerUp={(e) => {
              if (e.pointerId !== breathPointerId.current) return;
              breathPointerId.current = null;
              setBreathActive(false);
              onHoldBreathChange(false);
            }}
            onPointerCancel={(e) => {
              if (e.pointerId !== breathPointerId.current) return;
              breathPointerId.current = null;
              setBreathActive(false);
              onHoldBreathChange(false);
            }}
            aria-label={
              hud.holdBreathActive
                ? 'Segurar para prender a respiração'
                : hud.interactPrompt
                ? hud.interactPrompt.label
                : 'Interagir ou Esconder'
            }
            style={getCustomPosStyle('interact', 56, 52)}
            className={`fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
              hud.holdBreathActive
                ? breathActive
                  ? 'bg-emerald-800/95 border-emerald-300 text-white'
                  : 'bg-red-900/95 border-red-400 text-amber-200 ring-2 ring-amber-400/90'
                : hud.interactPrompt
                ? 'bg-red-900/95 border-amber-400 text-amber-200'
                : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
          >
            {hud.hiding ? <Footprints className="w-4 h-4 mb-0.5" /> : <Hand className="w-4 h-4 mb-0.5" />}
            <span>{hud.holdBreathActive ? 'Prender' : hud.hiding ? 'Sair' : 'Ação'}</span>
          </button>

          {hud.canDropActiveItem && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onDropActiveItem();
              }}
              aria-label="Dropar item equipado"
              style={getCustomPosStyle('drop', 48, 44)}
              className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 border-red-400/80 bg-slate-900/85 text-red-200 text-[8px] font-bold uppercase"
            >
              <PackageMinus className="w-4 h-4 mb-0.5" />
              <span>Dropar</span>
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenBackpack();
            }}
            aria-label="Abrir Mochila"
            style={getCustomPosStyle('backpack', 46, 46)}
            className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 border-emerald-400/80 bg-slate-900/85 text-emerald-200 text-[8px] font-bold uppercase"
          >
            <Backpack className="w-4 h-4 mb-0.5" />
            <span>Moch.</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPause();
            }}
            aria-label="Pausar"
            style={getCustomPosStyle('pause', 42, 42)}
            className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center border-2 border-slate-500 bg-slate-900/85 text-slate-200 text-[8px] font-bold uppercase"
          >
            <Pause className="w-4 h-4" />
          </button>
        </>
      ) : (
        /* Default Right Thumb Ergonomic Action Cluster (Zero Overlap Portrait & Landscape!) */
        <div
          data-testid="touch-action-cluster"
          className="fixed flex flex-col items-end gap-2 pointer-events-auto"
          style={{
            right: 'max(0.75rem, env(safe-area-inset-right))',
            bottom: controlBottomCss,
          }}
        >
          {/* Top Action Row: Contextual Use (UV / Stun / Throw) + Flashlight + Crouch */}
          <div className="flex items-center gap-1.5">
            {hud.contextualUseLabel && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onContextualUse();
                }}
                aria-label={`Usar item: ${hud.contextualUseLabel}`}
                data-testid="mobile-contextual-use"
                style={{ width: `${Math.round(btnPx * 1.12)}px`, height: `${btnPx}px` }}
                className={`flex flex-col items-center justify-center border-2 text-[8px] font-extrabold uppercase px-0.5 ${
                  hud.uvMode
                    ? 'bg-purple-900/90 border-purple-400 text-purple-100'
                    : hud.contextualUseLabel.startsWith('ATIRAR')
                    ? 'bg-sky-900/90 border-sky-400 text-sky-100'
                    : 'bg-slate-900/85 border-amber-500/80 text-amber-200'
                }`}
              >
                {hud.contextualUseLabel.startsWith('ATIRAR') ? (
                  <Crosshair className="w-4 h-4 mb-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 mb-0.5" />
                )}
                <span className="truncate max-w-full">{hud.contextualUseLabel}</span>
              </button>
            )}

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleFlashlight();
              }}
              aria-label="Ligar ou desligar lanterna"
              style={{ width: `${btnPx}px`, height: `${btnPx}px` }}
              className={`flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
                hud.flashlightOn
                  ? hud.uvMode
                    ? 'bg-purple-900/85 border-purple-400 text-purple-200'
                    : 'bg-amber-900/85 border-amber-400 text-amber-200'
                  : 'bg-slate-900/85 border-slate-600 text-slate-300'
              }`}
            >
              <Flashlight className="w-4 h-4 mb-0.5" />
              <span>Luz</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleCrouch();
              }}
              aria-label="Agachar ou levantar"
              style={{ width: `${btnPx}px`, height: `${btnPx}px` }}
              className={`flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
                hud.crouching
                  ? 'bg-sky-900/85 border-sky-400 text-sky-200'
                  : 'bg-slate-900/85 border-slate-600 text-slate-300'
              }`}
            >
              <EyeOff className="w-4 h-4 mb-0.5" />
              <span>{hud.inVent ? 'Duto' : 'Agach.'}</span>
            </button>
          </div>

          {/* Bottom Primary Row: Sprint (Hold) + Contextual Interact/Hide */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                sprintPointerId.current = e.pointerId;
                setSprintActive(true);
                onSprintChange(true);
              }}
              onPointerUp={(e) => {
                if (e.pointerId !== sprintPointerId.current) return;
                sprintPointerId.current = null;
                setSprintActive(false);
                onSprintChange(false);
              }}
              onPointerCancel={(e) => {
                if (e.pointerId !== sprintPointerId.current) return;
                sprintPointerId.current = null;
                setSprintActive(false);
                onSprintChange(false);
              }}
              aria-label="Segurar para correr"
              style={{ width: `${btnPx}px`, height: `${btnPx}px` }}
              className={`flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
                sprintActive
                  ? 'bg-red-800/90 border-red-400 text-white'
                  : 'bg-slate-900/85 border-slate-600 text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 mb-0.5" />
              <span>Correr</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (hud.holdBreathActive) {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  breathPointerId.current = e.pointerId;
                  setBreathActive(true);
                  onHoldBreathChange(true);
                } else {
                  onInteract();
                }
              }}
              onPointerUp={(e) => {
                if (e.pointerId !== breathPointerId.current) return;
                breathPointerId.current = null;
                setBreathActive(false);
                onHoldBreathChange(false);
              }}
              onPointerCancel={(e) => {
                if (e.pointerId !== breathPointerId.current) return;
                breathPointerId.current = null;
                setBreathActive(false);
                onHoldBreathChange(false);
              }}
              aria-label={
                hud.holdBreathActive
                  ? 'Segurar para prender a respiração'
                  : hud.interactPrompt
                  ? hud.interactPrompt.label
                  : 'Interagir ou Esconder'
              }
              style={{ width: `${Math.round(btnPx * 1.15)}px`, height: `${btnPx}px` }}
              className={`flex flex-col items-center justify-center border-2 text-[9px] font-bold uppercase ${
                hud.holdBreathActive
                  ? breathActive
                    ? 'bg-emerald-800/95 border-emerald-300 text-white'
                    : 'bg-red-900/95 border-red-400 text-amber-200 ring-2 ring-amber-400/90'
                  : hud.interactPrompt
                  ? 'bg-red-900/95 border-amber-400 text-amber-200'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400'
              }`}
            >
              {hud.hiding ? <Footprints className="w-4 h-4 mb-0.5" /> : <Hand className="w-4 h-4 mb-0.5" />}
              <span>{hud.holdBreathActive ? 'Prender' : hud.hiding ? 'Sair' : 'Ação'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
