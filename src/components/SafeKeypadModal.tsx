import React, { useState } from 'react';
import { Check, Delete, RotateCcw, X } from 'lucide-react';
import { SafeDialIcon } from './icons/GameIcons';

interface SafeKeypadModalProps {
  discoveredDigits: (string | null)[];
  onDigitTap: () => void;
  onSubmitCode: (code: string) => { ok: boolean; message: string };
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const SafeKeypadModal: React.FC<SafeKeypadModalProps> = ({
  discoveredDigits,
  onDigitTap,
  onSubmitCode,
  onClose,
}) => {
  const [digits, setDigits] = useState<string>('');
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const pulseKey = (keyId: string) => {
    setPressedKey(keyId);
    window.setTimeout(() => {
      setPressedKey((curr) => (curr === keyId ? null : curr));
    }, 110);
  };

  const handlePress = (num: string) => {
    pulseKey(num);
    if (digits.length >= 4) return;
    onDigitTap();
    setFeedback(null);
    setDigits((prev) => prev + num);
  };

  const handleBackspace = () => {
    pulseKey('back');
    onDigitTap();
    setFeedback(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    pulseKey('clear');
    onDigitTap();
    setFeedback(null);
    setDigits('');
  };

  const handleConfirm = () => {
    pulseKey('ok');
    if (digits.length < 4) {
      setFeedback({ text: 'DIGITE 4 DÍGITOS', isError: true });
      return;
    }
    const res = onSubmitCode(digits);
    setFeedback({ text: res.message, isError: !res.ok });
    if (!res.ok) setDigits('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teclado do Cofre Subterrâneo"
      data-testid="safe-keypad-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 backdrop-blur-md p-3 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel w-full max-w-sm overflow-hidden text-slate-100 border border-slate-500/50 animate-tactical-in">
        {/* Brushed Steel Top Plate */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-b from-slate-800/90 to-slate-950">
          <div className="flex items-center gap-2">
            <SafeDialIcon className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-horror text-base font-extrabold tracking-wider text-white">
                COFRE BLINDADO · S-09
              </h2>
              <div className="font-tech text-[9px] uppercase tracking-widest text-slate-400">
                TRAVA ELETRÔNICA DE 4 DÍGITOS
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Cofre"
            className="horror-btn horror-btn-danger p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-gradient-to-b from-[#11141c] to-[#080a0f] space-y-3.5">
          {/* Discovered Digits Reference Strip */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/90 border border-slate-800 text-[10px] font-tech">
            <span className="text-slate-400 uppercase">NOTAS COLETADAS:</span>
            <div className="flex items-center gap-1.5">
              {discoveredDigits.map((d, idx) => (
                <span
                  key={idx}
                  className={`px-1.5 py-0.5 font-bold border ${
                    d
                      ? 'bg-amber-950/75 border-amber-500/60 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {d ?? '?'}
                </span>
              ))}
            </div>
          </div>

          {/* Recessed Digital LED Display */}
          <div className="relative p-3 bg-[#040907] border-2 border-slate-700 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95)] overflow-hidden">
            <div className="absolute inset-0 tactical-scanlines opacity-65 pointer-events-none" />
            <div className="grid grid-cols-4 gap-2 relative z-10">
              {[0, 1, 2, 3].map((slot) => {
                const char = digits[slot];
                return (
                  <div
                    key={slot}
                    className={`h-12 flex items-center justify-center font-tech text-2xl font-black border ${
                      char
                        ? 'bg-emerald-950/45 border-emerald-400/80 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                        : 'bg-black/80 border-slate-800 text-slate-700'
                    }`}
                  >
                    {char ?? '•'}
                  </div>
                );
              })}
            </div>
            {feedback && (
              <div
                className={`mt-2 text-center font-tech text-[11px] font-bold uppercase tracking-wider ${
                  feedback.isError ? 'text-red-400' : 'text-emerald-300'
                }`}
              >
                {feedback.text}
              </div>
            )}
          </div>

          {/* Metallic Pushbutton Matrix */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handlePress(k)}
                className={`h-12 font-tech text-xl font-black border transition-all cursor-pointer ${
                  pressedKey === k
                    ? 'bg-amber-500 border-amber-200 text-slate-950 scale-95'
                    : 'bg-gradient-to-b from-slate-700/80 to-slate-900 border-slate-600/80 text-white hover:border-amber-400/80 hover:text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                }`}
              >
                {k}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpar código"
              className="h-12 bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handlePress('0')}
              className={`h-12 font-tech text-xl font-black border transition-all cursor-pointer ${
                pressedKey === '0'
                  ? 'bg-amber-500 border-amber-200 text-slate-950 scale-95'
                  : 'bg-gradient-to-b from-slate-700/80 to-slate-900 border-slate-600/80 text-white hover:border-amber-400/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
              }`}
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Apagar último dígito"
              className="h-12 bg-slate-900 border border-slate-700 hover:border-red-400 text-red-300 flex items-center justify-center cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="horror-btn horror-btn-amber w-full py-2.5 font-horror text-sm font-extrabold tracking-widest flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            DESTRAVAR COFRE
          </button>
        </div>
      </div>
    </div>
  );
};
