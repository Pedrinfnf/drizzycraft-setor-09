import React, { useEffect, useRef } from 'react';
import { Compass, X } from 'lucide-react';
import type { FloorId } from '../game/types';

interface WorldMapModalProps {
  floor: FloorId;
  exploredPct: number;
  roomName: string;
  onBindFullMapCanvas: (canvas: HTMLCanvasElement | null) => void;
  onClose: () => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  floor,
  exploredPct,
  roomName,
  onBindFullMapCanvas,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    onBindFullMapCanvas(canvasRef.current);
    return () => onBindFullMapCanvas(null);
  }, [onBindFullMapCanvas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyM') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mapa Tático Fog of War"
      data-testid="world-map-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 backdrop-blur-md p-2 sm:p-4 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-2xl max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cyan-500/35 bg-slate-950/85 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 flex items-center justify-center bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-horror text-base sm:text-xl font-extrabold tracking-wider text-white truncate">
                  PLANTA ARQUITETÔNICA · {floor === -1 ? 'SUBSOLO -1' : 'TÉRREO 0'}
                </h2>
                <span className="font-tech text-[10px] font-bold px-1.5 py-0.5 bg-cyan-950/85 border border-cyan-500/50 text-cyan-300 shrink-0">
                  {exploredPct}% EXPLORADO
                </span>
              </div>
              <div className="font-tech text-[10px] text-slate-400 truncate">
                LOCAL ATUAL: <strong className="text-amber-300">{roomName.toUpperCase()}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Mapa"
            className="horror-btn horror-btn-danger px-2.5 py-1.5 text-xs font-tech font-bold uppercase flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>
        </div>

        {/* Blueprint Map Canvas */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-2.5 sm:p-4 bg-[#06090f] overflow-hidden">
          <div className="relative border border-cyan-500/45 bg-slate-950 p-1 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
            <canvas
              ref={canvasRef}
              width={460}
              height={460}
              className="block max-w-full max-h-[60vh] sm:max-h-[66vh] aspect-square"
            />
          </div>
        </div>

        {/* Architectural Legend Footer */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 text-[10px] font-tech text-slate-300 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              VOCÊ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-cyan-400 inline-block" />
              ESCADA / ACESSO
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-slate-600 inline-block" />
              ÁREA MAPEADA
            </span>
          </div>
          <span className="text-slate-500 uppercase">FOG-OF-WAR ESTRITO</span>
        </div>
      </div>
    </div>
  );
};
