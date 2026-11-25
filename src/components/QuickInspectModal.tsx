import React from 'react';
import { X } from 'lucide-react';
import type { QuickInspectPayload } from '../game/types';
import { DossierFolderIcon, VhsTapeIcon } from './icons/GameIcons';

interface QuickInspectModalProps {
  payload: QuickInspectPayload;
  onClose: () => void;
}

export const QuickInspectModal: React.FC<QuickInspectModalProps> = ({ payload, onClose }) => {
  const isCassette = payload.kind === 'cassette';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={payload.title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 backdrop-blur-md p-3 sm:p-5 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`horror-panel w-full max-w-md border overflow-hidden text-slate-100 animate-tactical-in ${
          isCassette ? 'border-cyan-400/75' : 'border-amber-400/75'
        }`}
      >
        <div
          className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${
            isCassette
              ? 'bg-cyan-950/55 border-cyan-700/70'
              : 'bg-amber-950/45 border-amber-700/70'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isCassette ? (
              <VhsTapeIcon className="w-5 h-5 text-cyan-300 shrink-0" />
            ) : (
              <DossierFolderIcon className="w-5 h-5 text-amber-300 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-horror text-sm sm:text-base font-extrabold tracking-wider text-white truncate">
                {payload.title}
              </div>
              <div className="text-[10px] font-tech text-slate-300 truncate">
                {payload.roomName} · ARQUIVADO NO DIÁRIO [J]
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Leitura"
            className="horror-btn horror-btn-danger p-1.5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-[#0a0c12] space-y-3">
          {payload.digitHighlight !== undefined && payload.digitIndex !== undefined && (
            <div className="flex items-center justify-between bg-amber-950/40 border border-amber-500/60 px-3 py-2">
              <span className="text-xs font-tech uppercase text-amber-200">
                DÍGITO #{payload.digitIndex + 1} DO COFRE
              </span>
              <span className="font-tech text-2xl font-black text-amber-300 tracking-widest">
                {payload.digitHighlight}
              </span>
            </div>
          )}

          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
            {payload.body}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="horror-btn horror-btn-amber w-full py-2 font-horror text-xs font-bold tracking-widest cursor-pointer"
          >
            CONTINUAR INVESTIGAÇÃO
          </button>
        </div>
      </div>
    </div>
  );
};
