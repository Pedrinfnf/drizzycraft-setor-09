import React, { useEffect, useRef } from 'react';
import { BatteryCharging, Camera, DoorClosed, DoorOpen, ShieldAlert, X } from 'lucide-react';
import type { HudSnapshot } from '../game/types';
import { ShieldDoorIcon } from './icons/GameIcons';

interface CctvMonitorModalProps {
  hud: HudSnapshot;
  onBindCctvCanvas: (canvas: HTMLCanvasElement | null) => void;
  onSelectCamera: (index: number) => void;
  onToggleDoor: (side: 'left' | 'right') => void;
  onClose: () => void;
}

export const CctvMonitorModal: React.FC<CctvMonitorModalProps> = ({
  hud,
  onBindCctvCanvas,
  onSelectCamera,
  onToggleDoor,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    onBindCctvCanvas(canvasRef.current);
    return () => onBindCctvCanvas(null);
  }, [onBindCctvCanvas]);

  const activeCam = hud.cctvCameras[hud.cctvActiveCamIndex] ?? {
    id: 'cam_01',
    label: 'CAM 01',
    roomName: 'Pátio Interno',
  };

  const lowPower = hud.securityPowerPct <= 25;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Monitor de Segurança CCTV Setor 09"
      data-testid="cctv-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/86 backdrop-blur-md p-2 sm:p-4 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel w-full max-w-4xl max-h-full flex flex-col overflow-hidden text-slate-100 border border-emerald-500/70 shadow-[0_0_45px_rgba(16,185,129,0.18)] animate-tactical-in">
        {/* Top Security Telemetry Header */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-emerald-800/80 bg-[#05110c] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-950 border border-emerald-500/60 text-emerald-400 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-tech text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-emerald-300 truncate">
                CENTRAL CCTV // SETOR 09
              </div>
              <div className="text-[10px] font-tech text-emerald-500 truncate">
                FEED ATIVO: {activeCam.label} — {activeCam.roomName.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Security Reserve Power Bar */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-black/85 border border-emerald-700/70 font-tech text-xs">
              <BatteryCharging className={`w-3.5 h-3.5 ${lowPower ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
              <div className="w-14 sm:w-20 h-2 bg-slate-900 border border-slate-700 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${lowPower ? 'bg-red-500' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, hud.securityPowerPct))}%` }}
                />
              </div>
              <span className={`font-bold ${lowPower ? 'text-red-400' : 'text-emerald-300'}`}>
                {hud.securityPowerPct}%
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Monitor CCTV"
              className="horror-btn horror-btn-danger px-3 py-1.5 text-xs font-tech font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Main CRT Feed + Camera Selector & Armored Blast Doors */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-3 p-3 overflow-y-auto bg-[#040807]">
          {/* Live 3D Night-Vision CRT Viewport */}
          <div className="relative flex-1 min-h-[175px] sm:min-h-[280px] bg-black border-2 border-emerald-700/80 flex items-center justify-center overflow-hidden shadow-[inset_0_0_32px_rgba(0,0,0,0.95)]">
            <canvas
              ref={canvasRef}
              width={480}
              height={300}
              data-testid="cctv-canvas"
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
            <div className="pointer-events-none absolute inset-0 tactical-scanlines opacity-70" />
            {/* Corner CRT brackets */}
            <div className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400/70" />
            <div className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400/70" />
            <div className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400/70" />
            <div className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400/70" />

            <div className="pointer-events-none absolute top-3 left-4 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 border border-emerald-600/60 font-tech text-[10px] text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>REC · LIVE 3D FEED</span>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-4 bg-black/80 border border-emerald-700/60 px-2.5 py-0.5 font-tech text-[11px] font-bold text-emerald-300">
              {activeCam.label} // {activeCam.roomName.toUpperCase()}
            </div>

            {hud.blackoutActive && (
              <div className="pointer-events-none absolute top-3 right-4 flex items-center gap-1 bg-red-950/90 border border-red-500 px-2 py-0.5 font-tech text-[10px] text-red-200 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>BLECAUTE ATIVO</span>
              </div>
            )}
          </div>

          {/* Right Control Deck: Camera Matrix + Armored Blast Doors */}
          <div className="w-full sm:w-60 shrink-0 flex flex-col justify-between gap-3">
            <div>
              <div className="text-[10px] font-tech font-bold uppercase tracking-[0.16em] text-emerald-400 mb-2">
                SELETOR DE CÂMERAS ({hud.cctvCameras.length})
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5">
                {hud.cctvCameras.map((cam, idx) => {
                  const active = idx === hud.cctvActiveCamIndex;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => onSelectCamera(idx)}
                      className={`px-2 py-2 text-left border font-tech cursor-pointer transition-all ${
                        active
                          ? 'bg-emerald-900/90 border-emerald-300 text-white shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                          : 'bg-slate-950/90 border-slate-700 text-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className="text-[11px] font-black leading-tight">{cam.label}</div>
                      <div className="text-[9px] text-emerald-200/80 truncate mt-0.5">{cam.roomName}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Armored Blast Doors Control Module */}
            <div className="border-t border-emerald-900/80 pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-tech font-bold uppercase tracking-[0.14em] text-amber-300">
                <ShieldDoorIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span>PORTAS BLINDADAS</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleDoor('left')}
                  className={`px-2 py-2.5 border flex flex-col items-center gap-1 font-tech text-[10px] font-bold uppercase cursor-pointer transition-all ${
                    hud.securityLeftClosed
                      ? 'bg-red-950/90 border-red-400 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-950 border-emerald-600/80 text-emerald-300 hover:border-emerald-400'
                  }`}
                >
                  {hud.securityLeftClosed ? <DoorClosed className="w-4 h-4" /> : <DoorOpen className="w-4 h-4" />}
                  <span>OESTE</span>
                  <span className="text-[9px] opacity-85">
                    {hud.securityLeftClosed ? 'SELADA' : 'ABERTA'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleDoor('right')}
                  className={`px-2 py-2.5 border flex flex-col items-center gap-1 font-tech text-[10px] font-bold uppercase cursor-pointer transition-all ${
                    hud.securityRightClosed
                      ? 'bg-red-950/90 border-red-400 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-950 border-emerald-600/80 text-emerald-300 hover:border-emerald-400'
                  }`}
                >
                  {hud.securityRightClosed ? <DoorClosed className="w-4 h-4" /> : <DoorOpen className="w-4 h-4" />}
                  <span>LESTE</span>
                  <span className="text-[9px] opacity-85">
                    {hud.securityRightClosed ? 'SELADA' : 'ABERTA'}
                  </span>
                </button>
              </div>
              <p className="text-[10px] font-tech text-slate-400 leading-snug">
                Portas seladas bloqueiam P. Drizzy, mas drenam energia da sala. Em 0% abrem automaticamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
