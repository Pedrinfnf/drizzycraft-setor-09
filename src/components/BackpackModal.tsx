import React, { useState } from 'react';
import { ArrowLeftRight, Backpack, Check, PackageMinus, Sparkles, X } from 'lucide-react';
import type { HudSnapshot, ItemType } from '../game/types';
import { ItemSvgIcon } from './icons/GameIcons';

interface BackpackModalProps {
  hud: HudSnapshot;
  itemRenders?: Record<string, string>;
  onSelectHotbarSlot: (slotIndex: number) => void;
  onReorderSlot: (fromIdx: number, toIdx: number) => void;
  onDropItem: (slotIndex: number) => void;
  onClose: () => void;
}

const ITEM_LORE: Partial<Record<ItemType, { category: string; desc: string }>> = {
  flashlight: {
    category: 'EQUIPAMENTO TÁTICO',
    desc: 'Lanterna industrial dual-spectrum. Pressione [F] para alternar luz branca e [V] para ativar espectro UV 365nm que revela marcas ocultas.',
  },
  stun_gun: {
    category: 'DEFESA ELÉTRICA',
    desc: 'Disparador de alta voltagem improvisado. Paralisa o Sujeito 09 temporariamente em confrontos diretos. Recarregue com Cargas de Stun.',
  },
  crowbar: {
    category: 'FERRAMENTA PESADA',
    desc: 'Pé-de-cabra forjado. Essencial para arrancar tábuas de interdição, forçar passagens seladas e destravar obstáculos do subsolo.',
  },
  crowbar_rod: {
    category: 'COMPONENTE DE CRAFT',
    desc: 'Haste hexagonal de aço carbono. Combine com o Gancho de Aço em uma Bancada de Craft para montar um Pé-de-Cabra completo.',
  },
  crowbar_hook: {
    category: 'COMPONENTE DE CRAFT',
    desc: 'Ponta de garra bifurcada. Combine com a Haste de Aço na Bancada de Craft para forjar o Pé-de-Cabra.',
  },
  stun_coil: {
    category: 'COMPONENTE DE CRAFT',
    desc: 'Bobina de indução de cobre enrolada à mão. Combine com a Célula de Alta Voltagem na Bancada para fabricar cargas extras de Taser.',
  },
  stun_cell: {
    category: 'COMPONENTE DE CRAFT',
    desc: 'Capacitor blindado de descarga rápida. Combine com a Bobina de Cobre na Bancada para gerar cargas de Stun.',
  },
  wire_cutters: {
    category: 'FERRAMENTA DE CORTE',
    desc: 'Alicate isolado para alta tensão. Corta correntes, cabos de contenção e travas elétricas de emergência.',
  },
  fuse: {
    category: 'PEÇA ELÉTRICA',
    desc: 'Fusível industrial de cartucho de vidro. Restaura a energia do quadro elétrico principal durante blecautes do Setor 09.',
  },
  red_key: {
    category: 'ACESSO SETORIAL',
    desc: 'Chave metálica vermelha da Ala Administrativa e Arquivo Morto.',
  },
  blue_key: {
    category: 'ACESSO SETORIAL',
    desc: 'Chave azul de controle da Enfermaria e Ala Técnica.',
  },
  basement_key: {
    category: 'ACESSO SUBSOLO',
    desc: 'Chave pesada de ferro da Escadaria Oeste — libera o acesso ao Subsolo -1.',
  },
  master_key: {
    category: 'ACESSO MÁXIMO',
    desc: 'Chave Mestra do Portão Norte recuperada do cofre blindado. Sua única rota de fuga do Setor 09.',
  },
  throwable_can: {
    category: 'DISTRAÇÃO SONORA',
    desc: 'Lata metálica vazia. Arremesse para gerar ruído distante e desviar a atenção de P. Drizzy do seu caminho.',
  },
  flare: {
    category: 'SINALIZADOR QUÍMICO',
    desc: 'Bastão de magnésio de alta luminosidade. Ilumina corredores escuros e revela ameaças mesmo com bateria baixa.',
  },
};

export const BackpackModal: React.FC<BackpackModalProps> = ({
  hud,
  itemRenders,
  onSelectHotbarSlot,
  onReorderSlot,
  onDropItem,
  onClose,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(hud.activeSlot);
  const [swapFromIdx, setSwapFromIdx] = useState<number | null>(null);
  const [quickSwapEnabled, setQuickSwapEnabled] = useState<boolean>(true);

  const renderItemGraphic = (itemType: ItemType, label: string, className: string) => {
    const key = itemType === 'flashlight' && hud.uvMode ? 'flashlight_uv' : itemType;
    const renderUrl = itemRenders?.[key] || itemRenders?.[itemType];
    if (renderUrl) {
      return (
        <img
          src={renderUrl}
          alt={label}
          draggable={false}
          className={`${className} object-contain select-none`}
        />
      );
    }
    return <ItemSvgIcon item={itemType} uvActive={hud.uvMode} className={className} />;
  };

  const slots = hud.backpackItems;
  const usedCount = slots.filter((s) => s.itemType !== null).length;
  const selectedSlot = slots[selectedIdx] ?? null;
  const selectedMeta = selectedSlot?.itemType ? ITEM_LORE[selectedSlot.itemType] : null;

  const hasCraftParts =
    (hud.collectedKeys.includes('crowbar_rod') && hud.collectedKeys.includes('crowbar_hook')) ||
    (hud.collectedKeys.includes('stun_coil') && hud.collectedKeys.includes('stun_cell'));

  const handleSlotTap = (idx: number) => {
    if (swapFromIdx !== null) {
      if (swapFromIdx !== idx) {
        onReorderSlot(swapFromIdx, idx);
        setSelectedIdx(idx);
      }
      setSwapFromIdx(null);
      return;
    }

    if (quickSwapEnabled && idx >= 6 && slots[idx]?.itemType) {
      onReorderSlot(idx, hud.activeSlot);
      setSelectedIdx(hud.activeSlot);
      return;
    }

    setSelectedIdx(idx);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mochila e Inventário"
      data-testid="backpack-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 backdrop-blur-md p-2 sm:p-4 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-3xl max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/80 bg-slate-950/75 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shrink-0">
              <Backpack className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-horror text-lg sm:text-xl font-extrabold tracking-wider text-white">
                  MOCHILA TÁTICA
                </h2>
                <span className="font-tech text-[10px] font-bold px-1.5 py-0.5 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300">
                  {usedCount} / {slots.length} SLOTS
                </span>
              </div>
              <p className="text-[11px] font-tech text-slate-400 truncate">
                SLOTS 1–6: HOTBAR RÁPIDA · SLOTS 7–10: COMPARTIMENTO RESERVA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setQuickSwapEnabled((v) => !v)}
              className={`horror-btn px-2.5 py-1.5 text-[10px] font-tech font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                quickSwapEnabled ? 'border-emerald-400/70 text-emerald-300' : 'text-slate-400'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Troca 1-Toque: {quickSwapEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              data-testid="backpack-close-btn"
              onClick={onClose}
              aria-label="Fechar Mochila"
              className="horror-btn horror-btn-danger px-3 py-1.5 text-xs font-tech font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* Body: Responsive 2-Column Inventory Grid + Selected Item Inspector */}
        <div className="flex-1 overflow-y-auto horror-scroll p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-3 sm:gap-4">
          {/* Left: Slot Grid */}
          <div className="space-y-3">
            {hasCraftParts && (
              <div className="px-3 py-2 bg-amber-950/55 border border-amber-500/60 flex items-center gap-2 text-xs text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Você possui peças compatíveis! Procure uma Bancada de Craft para combiná-las.</span>
              </div>
            )}

            {/* Hotbar Slots 1-6 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-tech uppercase tracking-[0.16em] text-amber-400">
                <span>HOTBAR DE ACESSO RÁPIDO (1–6)</span>
                {swapFromIdx !== null && (
                  <span className="text-cyan-300 animate-pulse">
                    TOQUE NO SLOT DESTINO PARA TROCAR
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {slots.slice(0, 6).map((slot, idx) => {
                  const isSelected = selectedIdx === idx;
                  const isActiveHand = hud.activeSlot === idx;
                  const isSwapSource = swapFromIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSlotTap(idx)}
                      className={`relative aspect-square flex flex-col items-center justify-center p-1.5 cursor-pointer transition-all ${
                        isSwapSource
                          ? 'horror-slot border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.45)]'
                          : isSelected
                          ? 'horror-slot-active'
                          : 'horror-slot'
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] font-tech font-bold text-slate-400">
                        {idx + 1}
                      </span>
                      {isActiveHand && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
                      )}
                      {slot.itemType ? (
                        renderItemGraphic(
                          slot.itemType,
                          slot.label,
                          'w-8 h-8 sm:w-9 sm:h-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                        )
                      ) : (
                        <span className="text-[9px] font-tech text-slate-600 uppercase">VAZIO</span>
                      )}
                      {slot.count !== undefined && (
                        <span className="absolute bottom-1 right-1 text-[9px] font-tech font-black text-amber-300 bg-black/75 px-1">
                          x{slot.count}
                        </span>
                      )}
                      {slot.chargePct !== undefined && (
                        <span className="absolute bottom-1 right-1 text-[8px] font-tech font-bold text-cyan-300 bg-black/75 px-1">
                          {slot.chargePct}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reserve Slots 7-10 */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-tech uppercase tracking-[0.16em] text-slate-400">
                COMPARTIMENTO INTERNO (7–10)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {slots.slice(6, 10).map((slot, offset) => {
                  const idx = offset + 6;
                  const isSelected = selectedIdx === idx;
                  const isSwapSource = swapFromIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSlotTap(idx)}
                      className={`relative h-16 sm:h-20 flex flex-col items-center justify-center p-1.5 cursor-pointer transition-all ${
                        isSwapSource
                          ? 'horror-slot border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.45)]'
                          : isSelected
                          ? 'horror-slot-active'
                          : 'horror-slot'
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] font-tech font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      {slot.itemType ? (
                        <>
                          {renderItemGraphic(
                            slot.itemType,
                            slot.label,
                            'w-8 h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                          )}
                          <span className="text-[9px] font-tech text-slate-300 truncate max-w-full mt-0.5">
                            {slot.label}
                          </span>
                        </>
                      ) : (
                        <span className="text-[9px] font-tech text-slate-600 uppercase">LIVRE</span>
                      )}
                      {slot.count !== undefined && (
                        <span className="absolute bottom-1 right-1 text-[9px] font-tech font-black text-amber-300 bg-black/75 px-1">
                          x{slot.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Utility Footer Telemetry */}
            <div className="grid grid-cols-3 gap-2 pt-1 font-tech text-[10px]">
              <div className="p-2 bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">BATERIA</span>
                <span className="text-amber-300 font-bold">{hud.battery}%</span>
              </div>
              <div className="p-2 bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">STUN</span>
                <span className="text-cyan-300 font-bold">{hud.stunAmmo}x</span>
              </div>
              <div className="p-2 bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">FLARES</span>
                <span className="text-red-300 font-bold">
                  {slots.find((s) => s.itemType === 'flare')?.count ?? 0}x
                </span>
              </div>
            </div>
          </div>

          {/* Right: Detailed Tactical Item Inspector */}
          <div className="p-3.5 bg-slate-950/85 border border-slate-700/80 flex flex-col justify-between gap-3">
            {selectedSlot?.itemType ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-tech text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400">
                      {selectedMeta?.category ?? 'ITEM DE CAMPO'}
                    </span>
                    <span className="font-tech text-[10px] text-slate-400">
                      SLOT #{selectedIdx + 1}
                    </span>
                  </div>

                  {/* Large 3D / SVG Specimen Inspection */}
                  <div className="relative h-28 bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-700/70 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 tactical-grid-bg opacity-65 pointer-events-none" />
                    {renderItemGraphic(
                      selectedSlot.itemType,
                      selectedSlot.label,
                      'w-20 h-20 drop-shadow-[0_6px_14px_rgba(0,0,0,0.9)] relative z-10'
                    )}
                    {selectedSlot.count !== undefined && (
                      <span className="absolute bottom-2 right-2 font-tech text-xs font-extrabold text-amber-300 bg-black/80 border border-amber-500/40 px-2 py-0.5">
                        QTD: {selectedSlot.count}
                      </span>
                    )}
                    {selectedSlot.chargePct !== undefined && (
                      <span className="absolute bottom-2 right-2 font-tech text-xs font-extrabold text-cyan-300 bg-black/80 border border-cyan-500/40 px-2 py-0.5">
                        CARGA: {selectedSlot.chargePct}%
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-horror text-lg font-extrabold text-white tracking-wider">
                      {selectedSlot.label}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {selectedMeta?.desc ?? 'Equipamento recuperado no Complexo Setor 09.'}
                    </p>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {selectedIdx < 6 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectHotbarSlot(selectedIdx);
                        onClose();
                      }}
                      className="horror-btn horror-btn-amber w-full py-2 px-3 text-xs font-horror font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      EQUIPAR NA MÃO (SLOT {selectedIdx + 1})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onReorderSlot(selectedIdx, hud.activeSlot);
                        setSelectedIdx(hud.activeSlot);
                      }}
                      className="horror-btn horror-btn-amber w-full py-2 px-3 text-xs font-horror font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      MOVER PARA HOTBAR (SLOT {hud.activeSlot + 1})
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSwapFromIdx(swapFromIdx === selectedIdx ? null : selectedIdx)}
                      className="horror-btn py-2 px-2 text-[11px] font-tech font-bold uppercase flex items-center justify-center gap-1 text-cyan-300 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>{swapFromIdx === selectedIdx ? 'Cancelar' : 'Reordenar'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedSlot.itemType === 'flashlight'}
                      onClick={() => onDropItem(selectedIdx)}
                      className="horror-btn horror-btn-danger py-2 px-2 text-[11px] font-tech font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PackageMinus className="w-3.5 h-3.5" />
                      <span>Dropar</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-500 space-y-2">
                <Backpack className="w-10 h-10 opacity-40" />
                <div className="font-horror text-sm tracking-wider uppercase text-slate-400">
                  SLOT #{selectedIdx + 1} VAZIO
                </div>
                <p className="text-xs max-w-[220px]">
                  Selecione um slot preenchido para inspecionar detalhes, equipar ou dropar o item no mapa.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
