import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  Check,
  EyeOff,
  Flashlight,
  Hand,
  Move,
  PackageMinus,
  Pause,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { DEFAULT_HUD_LAYOUT, HUD_CONTROL_IDS, sanitizeHudCustomLayout } from '../game/saveManager';
import type { HudControlId, HudControlLayout, HudCustomLayout } from '../game/types';

interface HudEditorModalProps {
  initialLayout: HudCustomLayout;
  globalScale: number;
  globalOpacity: number;
  onSave: (layout: HudCustomLayout) => void;
  onClose: () => void;
}

const CONTROL_META: Record<
  HudControlId,
  { label: string; shortLabel: string; baseW: number; baseH: number; round?: boolean; accent: string }
> = {
  joystick: {
    label: 'Joystick Analógico',
    shortLabel: 'MOVER',
    baseW: 92,
    baseH: 92,
    round: true,
    accent: 'border-amber-400 bg-slate-950/75 text-amber-200',
  },
  interact: {
    label: 'Botão Interagir / Esconder',
    shortLabel: 'Ação',
    baseW: 58,
    baseH: 52,
    accent: 'border-amber-400 bg-red-950/90 text-amber-200',
  },
  sprint: {
    label: 'Botão Correr (Segurar)',
    shortLabel: 'Correr',
    baseW: 52,
    baseH: 52,
    accent: 'border-red-400 bg-slate-900/90 text-slate-100',
  },
  crouch: {
    label: 'Botão Agachar / Duto',
    shortLabel: 'Agach.',
    baseW: 52,
    baseH: 52,
    accent: 'border-sky-400 bg-slate-900/90 text-sky-200',
  },
  flashlight: {
    label: 'Botão Lanterna',
    shortLabel: 'Luz',
    baseW: 52,
    baseH: 52,
    accent: 'border-amber-300 bg-amber-950/85 text-amber-200',
  },
  uv: {
    label: 'Botão Uso Contextual / UV',
    shortLabel: 'UV / Uso',
    baseW: 58,
    baseH: 52,
    accent: 'border-purple-400 bg-purple-950/85 text-purple-200',
  },
  drop: {
    label: 'Botão Dropar Item',
    shortLabel: 'Dropar',
    baseW: 52,
    baseH: 46,
    accent: 'border-red-400/80 bg-slate-900/85 text-red-200',
  },
  backpack: {
    label: 'Atalho Mochila',
    shortLabel: 'Mochila',
    baseW: 48,
    baseH: 48,
    accent: 'border-emerald-400 bg-slate-900/85 text-emerald-200',
  },
  pause: {
    label: 'Atalho Pausar',
    shortLabel: 'Pausa',
    baseW: 44,
    baseH: 44,
    accent: 'border-slate-400 bg-slate-900/85 text-slate-200',
  },
};

function renderControlIcon(id: HudControlId) {
  switch (id) {
    case 'joystick':
      return <Move className="w-5 h-5" />;
    case 'interact':
      return <Hand className="w-4 h-4" />;
    case 'sprint':
      return <Zap className="w-4 h-4" />;
    case 'crouch':
      return <EyeOff className="w-4 h-4" />;
    case 'flashlight':
      return <Flashlight className="w-4 h-4" />;
    case 'uv':
      return <Sparkles className="w-4 h-4" />;
    case 'drop':
      return <PackageMinus className="w-4 h-4" />;
    case 'backpack':
      return <Backpack className="w-4 h-4" />;
    case 'pause':
      return <Pause className="w-4 h-4" />;
  }
}

function buildWorkingLayout(initial: HudCustomLayout): Record<HudControlId, HudControlLayout> {
  const result = {} as Record<HudControlId, HudControlLayout>;
  for (const id of HUD_CONTROL_IDS) {
    const base = DEFAULT_HUD_LAYOUT[id];
    const custom = initial[id];
    result[id] = custom ? { ...custom } : { ...base };
  }
  return result;
}

export const HudEditorModal: React.FC<HudEditorModalProps> = ({
  initialLayout,
  globalScale,
  globalOpacity,
  onSave,
  onClose,
}) => {
  const [layout, setLayout] = useState<Record<HudControlId, HudControlLayout>>(() =>
    buildWorkingLayout(initialLayout)
  );
  const [selectedId, setSelectedId] = useState<HudControlId>('interact');
  const [isResetToDefault, setIsResetToDefault] = useState<boolean>(
    Object.keys(initialLayout).length === 0
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: HudControlId; pointerId: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updateControl = (id: HudControlId, patch: Partial<HudControlLayout>) => {
    setIsResetToDefault(false);
    setLayout((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const handlePointerDownControl = (id: HudControlId, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    dragRef.current = { id, pointerId: e.pointerId };
  };

  const handlePointerMoveControl = (id: HudControlId, e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.id !== id || dragRef.current.pointerId !== e.pointerId) {
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const xPct = Math.round(Math.max(4, Math.min(96, rawX)) * 10) / 10;
    const yPct = Math.round(Math.max(8, Math.min(92, rawY)) * 10) / 10;
    updateControl(id, { xPct, yPct });
  };

  const handlePointerUpControl = (id: HudControlId, e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && dragRef.current.id === id && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const handleRestoreDefaults = () => {
    setLayout(buildWorkingLayout({}));
    setIsResetToDefault(true);
  };

  const handleSave = () => {
    if (isResetToDefault) {
      onSave({});
      return;
    }
    onSave(sanitizeHudCustomLayout(layout));
  };

  const selectedCfg = layout[selectedId];
  const selectedMeta = CONTROL_META[selectedId];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor de Layout do HUD Mobile"
      data-testid="hud-editor-modal"
      className="fixed inset-0 z-[60] bg-[#05070d]/92 select-none touch-none overflow-hidden text-slate-100"
    >
      {/* Interactive Full-Viewport Drag Canvas */}
      <div
        ref={stageRef}
        className="relative w-full h-full"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      >
        {/* Center Aim Reference Crosshair (non-interactive) */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-45">
          <div className="w-6 h-[1px] bg-amber-300" />
          <div className="absolute h-6 w-[1px] bg-amber-300" />
        </div>

        {/* Draggable HUD Controls */}
        {HUD_CONTROL_IDS.map((id) => {
          const cfg = layout[id];
          const meta = CONTROL_META[id];
          const isSelected = selectedId === id;
          const effScale = cfg.scale * globalScale;
          const effOpacity = Math.max(0.28, Math.min(1, cfg.opacity * globalOpacity));
          const w = Math.round(meta.baseW * effScale);
          const h = Math.round(meta.baseH * effScale);

          return (
            <div
              key={id}
              data-testid={`hud-editor-item-${id}`}
              onPointerDown={(e) => handlePointerDownControl(id, e)}
              onPointerMove={(e) => handlePointerMoveControl(id, e)}
              onPointerUp={(e) => handlePointerUpControl(id, e)}
              onPointerCancel={(e) => handlePointerUpControl(id, e)}
              style={{
                left: `${cfg.xPct}%`,
                top: `${cfg.yPct}%`,
                width: `${w}px`,
                height: `${h}px`,
                opacity: effOpacity,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center border-2 cursor-grab active:cursor-grabbing touch-none transition-shadow ${
                meta.round ? 'rounded-full' : ''
              } ${meta.accent} ${
                isSelected
                  ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-black z-20'
                  : 'z-10'
              }`}
            >
              {renderControlIcon(id)}
              <span className="text-[9px] font-mono-num font-bold uppercase mt-0.5 leading-none">
                {meta.shortLabel}
              </span>
            </div>
          );
        })}

        {/* Compact Top-Center Control Inspector Dock */}
        <div
          className="absolute left-1/2 top-2 -translate-x-1/2 z-30 w-[94%] max-w-2xl horror-panel px-3 py-2 flex flex-col gap-2 border-2 border-amber-500/80"
          style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5">
            <div className="min-w-0">
              <div className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wider text-amber-300 leading-none">
                Editor de HUD Mobile · Arraste qualquer botão
              </div>
              <div className="text-[10px] font-mono-num text-slate-300 mt-0.5 truncate">
                Selecionado: <strong className="text-white">{selectedMeta.label}</strong> (X:{' '}
                {selectedCfg.xPct.toFixed(0)}% · Y: {selectedCfg.yPct.toFixed(0)}%)
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="hud-editor-reset-btn"
                onClick={handleRestoreDefaults}
                className="horror-btn px-2 py-1 text-[10px] font-bold uppercase text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrão</span>
              </button>
              <button
                type="button"
                data-testid="hud-editor-save-btn"
                onClick={handleSave}
                className="bg-emerald-700 hover:bg-emerald-600 border-2 border-emerald-300 px-2.5 py-1 text-[10px] font-extrabold uppercase text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Layout</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cancelar edição do HUD"
                className="horror-btn-danger p-1 text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between font-mono-num">
                <label htmlFor="hud-item-scale" className="text-slate-300 uppercase text-[10px] font-bold">
                  Escala Individual
                </label>
                <span className="text-amber-300 font-bold">{Math.round(selectedCfg.scale * 100)}%</span>
              </div>
              <input
                id="hud-item-scale"
                type="range"
                min={70}
                max={150}
                value={Math.round(selectedCfg.scale * 100)}
                onChange={(e) => updateControl(selectedId, { scale: Number(e.target.value) / 100 })}
                className="w-full accent-amber-500 cursor-pointer h-1.5"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between font-mono-num">
                <label htmlFor="hud-item-opacity" className="text-slate-300 uppercase text-[10px] font-bold">
                  Opacidade Individual
                </label>
                <span className="text-amber-300 font-bold">{Math.round(selectedCfg.opacity * 100)}%</span>
              </div>
              <input
                id="hud-item-opacity"
                type="range"
                min={30}
                max={100}
                value={Math.round(selectedCfg.opacity * 100)}
                onChange={(e) => updateControl(selectedId, { opacity: Number(e.target.value) / 100 })}
                className="w-full accent-amber-500 cursor-pointer h-1.5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
