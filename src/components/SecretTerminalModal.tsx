import React, { useState } from 'react';
import { Delete, ShieldCheck, Terminal, X } from 'lucide-react';
import type { JournalSnapshot } from '../game/types';

interface SecretTerminalModalProps {
  journal: JournalSnapshot;
  onDigitTap: () => void;
  onSubmitCode: (code: string) => { ok: boolean; message: string };
  onClose: () => void;
}

export const SecretTerminalModal: React.FC<SecretTerminalModalProps> = ({
  journal,
  onDigitTap,
  onSubmitCode,
  onClose,
}) => {
  const [digits, setDigits] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const pressDigit = (d: string) => {
    if (digits.length >= 5) return;
    onDigitTap();
    setDigits((prev) => prev + d);
    setFeedback(null);
  };

  const handleBack = () => {
    onDigitTap();
    setDigits((prev) => prev.slice(0, -1));
    setFeedback(null);
  };

  const handleConfirm = () => {
    if (digits.length < 5) {
      setFeedback({ ok: false, text: 'DIGITE OS 5 DÍGITOS DA CIFRA UV' });
      return;
    }
    const res = onSubmitCode(digits);
    setFeedback({ ok: res.ok, text: res.message });
    if (!res.ok) setDigits('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terminal Secreto Projeto Ômega"
      data-testid="secret-terminal-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/84 backdrop-blur-md p-2 sm:p-4 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel w-full max-w-md overflow-hidden border border-emerald-500/70 text-emerald-100 shadow-[0_0_40px_rgba(16,185,129,0.2)] animate-tactical-in">
        {/* Retro CRT Bezel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-800/80 bg-[#05120d]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="font-tech text-sm font-black uppercase tracking-[0.16em] text-emerald-300">
                OMEGA-OS // TERMINAL v0.9
              </h2>
              <div className="font-tech text-[9px] text-emerald-500/90 uppercase">
                ACESSO CRIPTOGRAFADO · CIFRA UV 5 DÍGITOS
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Terminal"
            className="horror-btn horror-btn-danger p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative p-4 bg-[#030a07] space-y-3.5 overflow-hidden">
          <div className="absolute inset-0 tactical-scanlines opacity-75 pointer-events-none" />

          {/* UV Marks Found Strip */}
          <div className="relative z-10 p-2.5 bg-black/70 border border-emerald-800/70 space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-tech uppercase text-emerald-400">
              <span>SÍMBOLOS UV COLETADOS</span>
              <span className="text-purple-300">
                {journal.uvMarks.filter((m) => m.discovered).length}/{journal.uvMarks.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              {journal.uvMarks.map((mark) => (
                <div
                  key={mark.id}
                  className={`flex-1 py-1 text-center font-tech text-sm border ${
                    mark.discovered
                      ? 'bg-purple-950/55 border-purple-400/70 text-purple-200'
                      : 'bg-black/80 border-emerald-950 text-emerald-900'
                  }`}
                >
                  {mark.discovered ? mark.symbolChar : '?'}
                </div>
              ))}
            </div>
          </div>

          {/* CRT 5-Digit Code Input */}
          <div className="relative z-10 p-3 bg-black/90 border border-emerald-600/60 shadow-[inset_0_0_20px_rgba(16,185,129,0.16)]">
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className={`h-11 flex items-center justify-center font-tech text-xl font-black border ${
                    digits[idx]
                      ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                      : 'bg-black border-emerald-950 text-emerald-800'
                  }`}
                >
                  {digits[idx] ?? '_'}
                </div>
              ))}
            </div>
            {feedback && (
              <div
                className={`mt-2 text-center font-tech text-[11px] font-bold uppercase ${
                  feedback.ok ? 'text-emerald-300' : 'text-red-400'
                }`}
              >
                &gt; {feedback.text}
              </div>
            )}
          </div>

          {/* Numeric Matrix */}
          <div className="relative z-10 grid grid-cols-5 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => pressDigit(n)}
                className="h-10 bg-[#081b14] hover:bg-emerald-900/70 border border-emerald-700/70 hover:border-emerald-300 font-tech text-base font-black text-emerald-200 cursor-pointer transition-colors"
              >
                {n}
              </button>
            ))}
          </div>

          <div className="relative z-10 grid grid-cols-[1fr_2fr] gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="horror-btn py-2.5 text-xs font-tech font-bold uppercase text-red-300 border-red-800/70 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Delete className="w-3.5 h-3.5" />
              DEL
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="horror-btn py-2.5 text-xs font-tech font-extrabold uppercase tracking-widest bg-emerald-900/80 border-emerald-400 text-emerald-100 hover:bg-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              AUTENTICAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
