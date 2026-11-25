import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Hammer, Plus, Wrench, X, Zap } from 'lucide-react';
import type { HudSnapshot, WorldPickupType } from '../game/types';
import { ItemSvgIcon } from './icons/GameIcons';

interface WorkbenchModalProps {
  hud: HudSnapshot;
  itemRenders?: Record<string, string>;
  onCraft: (recipe: 'crowbar' | 'stun_ammo') => { ok: boolean; message: string };
  onClose: () => void;
}

const RenderOrSvgItem: React.FC<{
  item: WorldPickupType;
  itemRenders?: Record<string, string>;
  alt: string;
  className: string;
}> = ({ item, itemRenders, alt, className }) => {
  const renderUrl = itemRenders?.[item];
  if (renderUrl) {
    return (
      <img
        src={renderUrl}
        alt={alt}
        draggable={false}
        className={`${className} object-contain select-none`}
      />
    );
  }
  return <ItemSvgIcon item={item} className={className} />;
};

const IngredientBadge: React.FC<{
  item: WorldPickupType;
  label: string;
  owned: boolean;
  itemRenders?: Record<string, string>;
}> = ({ item, label, owned, itemRenders }) => (
  <div
    className={`flex flex-col items-center justify-center p-2 border transition-colors ${
      owned
        ? 'bg-emerald-950/45 border-emerald-500/70 shadow-[inset_0_0_12px_rgba(16,185,129,0.14)]'
        : 'bg-slate-950/85 border-slate-800 opacity-65'
    }`}
  >
    <RenderOrSvgItem
      item={item}
      itemRenders={itemRenders}
      alt={label}
      className="w-9 h-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
    />
    <span className="text-[10px] font-tech font-bold text-slate-200 text-center mt-1 leading-tight">
      {label}
    </span>
    <span
      className={`text-[9px] font-tech font-extrabold uppercase mt-0.5 ${
        owned ? 'text-emerald-300' : 'text-red-400'
      }`}
    >
      {owned ? 'OK [1/1]' : 'FALTA [0/1]'}
    </span>
  </div>
);

export const WorkbenchModal: React.FC<WorkbenchModalProps> = ({
  hud,
  itemRenders,
  onCraft,
  onClose,
}) => {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const hasRod = hud.collectedKeys.includes('crowbar_rod');
  const hasHook = hud.collectedKeys.includes('crowbar_hook');
  const hasCrowbar = hud.collectedKeys.includes('crowbar');

  const hasCoil = hud.collectedKeys.includes('stun_coil');
  const hasCell = hud.collectedKeys.includes('stun_cell');

  const canCraftCrowbar = hasRod && hasHook && !hasCrowbar;
  const canCraftStun = hasCoil && hasCell;

  const handleCraft = (recipe: 'crowbar' | 'stun_ammo') => {
    const res = onCraft(recipe);
    setFeedback({ ok: res.ok, text: res.message });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bancada de Craft"
      data-testid="workbench-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-2xl max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-amber-500/40 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-950/80 border border-amber-500/60 text-amber-300 shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-horror text-lg sm:text-xl font-extrabold tracking-wider text-amber-300">
                BANCADA DE ENGENHARIA · SETOR 09
              </h2>
              <p className="text-[11px] font-tech text-slate-400">
                MONTAGEM DE FERRAMENTAS TÁTICAS &amp; RECARGAS DE ALTA VOLTAGEM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Bancada"
            className="horror-btn horror-btn-danger px-3 py-1.5 text-xs font-tech font-bold uppercase flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div
            className={`mx-4 mt-3 px-3 py-2 border flex items-center gap-2 text-xs font-tech font-bold animate-tactical-in ${
              feedback.ok
                ? 'bg-emerald-950/75 border-emerald-400 text-emerald-200'
                : 'bg-red-950/75 border-red-500 text-red-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Visual Recipe Cards */}
        <div className="flex-1 overflow-y-auto horror-scroll p-3 sm:p-4 space-y-3.5">
          {/* Recipe 1: Crowbar */}
          <div className="p-3.5 bg-slate-950/85 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Hammer className="w-4 h-4 text-amber-400" />
                <span className="font-horror text-base font-bold tracking-wider text-white">
                  PÉ-DE-CABRA FORJADO
                </span>
              </div>
              <span
                className={`font-tech text-[10px] font-bold uppercase px-2 py-0.5 border ${
                  hasCrowbar
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                    : canCraftCrowbar
                    ? 'bg-amber-950/80 border-amber-400 text-amber-200 animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {hasCrowbar ? 'JÁ POSSUI' : canCraftCrowbar ? 'PRONTO PARA MONTAR' : 'PEÇAS INCOMPLETAS'}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
              <IngredientBadge
                item="crowbar_rod"
                label="Haste de Aço"
                owned={hasRod || hasCrowbar}
                itemRenders={itemRenders}
              />
              <Plus className="w-4 h-4 text-slate-500 shrink-0" />
              <IngredientBadge
                item="crowbar_hook"
                label="Gancho Curvo"
                owned={hasHook || hasCrowbar}
                itemRenders={itemRenders}
              />
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col items-center justify-center p-2 bg-amber-950/35 border border-amber-500/60">
                <RenderOrSvgItem
                  item="crowbar"
                  itemRenders={itemRenders}
                  alt="Pé-de-Cabra"
                  className="w-10 h-10 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                />
                <span className="text-[10px] font-tech font-bold text-amber-200 mt-1 text-center">
                  Pé-de-Cabra
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <p className="text-[11px] text-slate-400">
                Arranca tábuas de madeira que selam acessos estratégicos e salas do subsolo.
              </p>
              <button
                type="button"
                disabled={!canCraftCrowbar}
                onClick={() => handleCraft('crowbar')}
                className="horror-btn horror-btn-amber px-4 py-2 text-xs font-horror font-bold tracking-wider shrink-0 w-full sm:w-auto cursor-pointer"
              >
                {hasCrowbar ? 'FERRAMENTA EQUIPADA' : 'MONTAR PÉ-DE-CABRA'}
              </button>
            </div>
          </div>

          {/* Recipe 2: Stun Ammo Pack */}
          <div className="p-3.5 bg-slate-950/85 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="font-horror text-base font-bold tracking-wider text-white">
                  CARGA DE STUN (+2 DISPAROS)
                </span>
              </div>
              <span
                className={`font-tech text-[10px] font-bold uppercase px-2 py-0.5 border ${
                  canCraftStun
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {canCraftStun ? 'PRONTO PARA MONTAR' : `ATUAL: ${hud.stunAmmo}x`}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
              <IngredientBadge
                item="stun_coil"
                label="Bobina Cobre"
                owned={hasCoil}
                itemRenders={itemRenders}
              />
              <Plus className="w-4 h-4 text-slate-500 shrink-0" />
              <IngredientBadge
                item="stun_cell"
                label="Célula Volt."
                owned={hasCell}
                itemRenders={itemRenders}
              />
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="flex flex-col items-center justify-center p-2 bg-cyan-950/35 border border-cyan-500/60">
                <RenderOrSvgItem
                  item="stun_ammo"
                  itemRenders={itemRenders}
                  alt="+2 Cargas Stun"
                  className="w-10 h-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                />
                <span className="text-[10px] font-tech font-bold text-cyan-200 mt-1 text-center">
                  +2 Cargas Stun
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <p className="text-[11px] text-slate-400">
                Fabrica 2 cargas de alta voltagem para neutralizar P. Drizzy em emergências.
              </p>
              <button
                type="button"
                disabled={!canCraftStun}
                onClick={() => handleCraft('stun_ammo')}
                className="horror-btn px-4 py-2 text-xs font-horror font-bold tracking-wider text-cyan-200 border-cyan-500/60 shrink-0 w-full sm:w-auto cursor-pointer"
              >
                FABRICAR CARGAS (+2)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
