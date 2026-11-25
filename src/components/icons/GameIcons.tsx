import React from 'react';
import type { WorldPickupType } from '../../game/types';

/**
 * Custom Multi-Layer SVG Icon Library for DrizzyCraft: Setor 09.
 * Industrial / Tactical VHS aesthetic: layered metallic gradients, beveled highlights,
 * crisp silhouettes, and ZERO raw emojis.
 */

export function ItemSvgIcon({
  item,
  className = 'w-6 h-6',
  uvActive = false,
}: {
  item: WorldPickupType;
  className?: string;
  uvActive?: boolean;
}) {
  switch (item) {
    case 'flashlight':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-fl-body" x1="4" y1="24" x2="22" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="48%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="gi-fl-head" x1="16" y1="6" x2="26" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="55%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="gi-fl-beam" x1="21" y1="11" x2="31" y2="3" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={uvActive ? '#e879f9' : '#fef08a'} stopOpacity="0.95" />
              <stop offset="100%" stopColor={uvActive ? '#9333ea' : '#f59e0b'} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Light cone */}
          <path d="M21 7 L31 2 L31 15 L25 11 Z" fill="url(#gi-fl-beam)" />
          {/* Ribbed tactical handle */}
          <path d="M4 22 L15 11 L21 17 L10 28 Z" fill="url(#gi-fl-body)" stroke="#090d16" strokeWidth="1.2" />
          <path d="M7 19 L13 25 M10 16 L16 22" stroke="#0f172a" strokeWidth="1.4" strokeOpacity="0.7" />
          {/* Power switch */}
          <rect x="13.5" y="13.5" width="3.5" height="2.2" rx="0.6" transform="rotate(-45 13.5 13.5)" fill={uvActive ? '#d946ef' : '#f59e0b'} />
          {/* Beveled bezel head */}
          <path d="M15 9 L21 5 L27 11 L23 17 Z" fill="url(#gi-fl-head)" stroke="#090d16" strokeWidth="1.2" />
          {/* Emitter lens */}
          <path d="M21 5.8 L26.2 11 L24.6 12.6 L19.4 7.4 Z" fill={uvActive ? '#f0abfc' : '#fef9c3'} />
        </svg>
      );

    case 'stun_gun':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-sg-chassis" x1="4" y1="10" x2="26" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
            <linearGradient id="gi-sg-coil" x1="16" y1="8" x2="26" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="55%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          {/* Grip + tactical frame */}
          <path d="M6 12 H24 L25 18 H14 L12 26 H6 L8 18 H5 Z" fill="url(#gi-sg-chassis)" stroke="#020617" strokeWidth="1.2" />
          {/* Copper induction coil wrap */}
          <rect x="15" y="11" width="7" height="6" rx="1" fill="url(#gi-sg-coil)" stroke="#451a03" strokeWidth="0.9" />
          <path d="M17 11 V17 M19 11 V17 M21 11 V17" stroke="#fef3c7" strokeWidth="0.8" strokeOpacity="0.6" />
          {/* Twin steel electrodes */}
          <rect x="24" y="11.2" width="5.5" height="2" rx="0.5" fill="#cbd5e1" />
          <rect x="24" y="15.2" width="5.5" height="2" rx="0.5" fill="#cbd5e1" />
          {/* High-voltage plasma arc */}
          <path d="M29 11 L26.5 14 L30 14.5 L27 18" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="11" cy="15" r="1.4" fill="#38bdf8" />
        </svg>
      );

    case 'stun_ammo':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-sa-cap" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="55%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#082f49" />
            </linearGradient>
          </defs>
          <rect x="9" y="7" width="14" height="19" rx="2" fill="url(#gi-sa-cap)" stroke="#0c4a6e" strokeWidth="1.2" />
          <rect x="12" y="4" width="3" height="3.5" rx="0.6" fill="#cbd5e1" />
          <rect x="17" y="4" width="3" height="3.5" rx="0.6" fill="#cbd5e1" />
          <rect x="9" y="10" width="14" height="2" fill="#38bdf8" fillOpacity="0.45" />
          <path d="M17.5 12 L13 17.5 H16.5 L14.5 23 L19.5 16.5 H16 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.6" />
        </svg>
      );

    case 'red_key':
    case 'blue_key':
    case 'basement_key':
    case 'master_key': {
      const palette =
        item === 'red_key'
          ? { hi: '#fca5a5', mid: '#dc2626', lo: '#7f1d1d', glow: '#f87171' }
          : item === 'blue_key'
          ? { hi: '#93c5fd', mid: '#2563eb', lo: '#1e3a8a', glow: '#60a5fa' }
          : item === 'basement_key'
          ? { hi: '#e2e8f0', mid: '#94a3b8', lo: '#334155', glow: '#cbd5e1' }
          : { hi: '#fef08a', mid: '#f59e0b', lo: '#92400e', glow: '#fde047' };
      const gid = `gi-key-${item}`;
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="4" y1="6" x2="28" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={palette.hi} />
              <stop offset="48%" stopColor={palette.mid} />
              <stop offset="100%" stopColor={palette.lo} />
            </linearGradient>
          </defs>
          {/* Key bow (ornate industrial ring) */}
          <path
            d="M10.5 8 C6.4 8 3.5 11.2 3.5 15.5 C3.5 19.8 6.4 23 10.5 23 C13.7 23 16.2 21 17 18 H22 V21.5 H25 V18 H27 V22.5 H29.5 V14 H17 C16.2 10.8 13.7 8 10.5 8 Z"
            fill={`url(#${gid})`}
            stroke="#090d16"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="10.2" cy="15.5" r="3.1" fill="#0b101b" stroke={palette.hi} strokeWidth="0.9" />
          {/* Specular ridge along shaft */}
          <path d="M17.5 15.5 H28.2" stroke={palette.hi} strokeWidth="1" strokeOpacity="0.85" />
          {item === 'master_key' && (
            <path d="M10.2 10.2 L11 11.8 L10.2 13 L9.4 11.8 Z" fill="#fef9c3" />
          )}
        </svg>
      );
    }

    case 'crowbar':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-cb-bar" x1="4" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="55%" stopColor="#991b1b" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>
            <linearGradient id="gi-cb-tip" x1="18" y1="4" x2="28" y2="12" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>
          {/* Steel gooseneck claw */}
          <path d="M19 8 C22 4.5 26.5 4.5 28.5 7.5 L26 10.5 C24.5 8.5 22.8 8.5 21 10.5 Z" fill="url(#gi-cb-tip)" stroke="#090d16" strokeWidth="1.1" />
          {/* Hex forged red shaft */}
          <path d="M8.5 21.5 L19.5 10.5 L22 13 L11 24 Z" fill="url(#gi-cb-bar)" stroke="#090d16" strokeWidth="1.1" />
          {/* Highlight spine */}
          <path d="M10.2 21.6 L19.8 12" stroke="#fca5a5" strokeWidth="0.9" strokeOpacity="0.65" />
          {/* Beveled steel chisel foot */}
          <path d="M4 26 L8.5 21.5 L11 24 L6.5 28.2 Z" fill="url(#gi-cb-tip)" stroke="#090d16" strokeWidth="1.1" />
        </svg>
      );

    case 'crowbar_rod':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-rod" x1="5" y1="25" x2="27" y2="7" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>
          <path d="M5 24 L23 6 L27 10 L9 28 Z" fill="url(#gi-rod)" stroke="#090d16" strokeWidth="1.2" />
          <path d="M8 24.5 L24 8.5" stroke="#f8fafc" strokeWidth="1" strokeOpacity="0.65" />
          <path d="M13 16 L16 19 M18 11 L21 14" stroke="#991b1b" strokeWidth="1.4" />
        </svg>
      );

    case 'crowbar_hook':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-hook" x1="6" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="50%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>
          </defs>
          <path
            d="M8 22 C8 12 14 7 22 7 C25.5 7 27.5 9.5 27.5 13 L23 14.5 C23 12 21.5 11 19.5 11 C15 11 13 14.5 13 22 L16 25 H6 Z"
            fill="url(#gi-hook)"
            stroke="#090d16"
            strokeWidth="1.2"
          />
          <circle cx="11" cy="22" r="1.4" fill="#e2e8f0" />
        </svg>
      );

    case 'stun_coil':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-coil-cu" x1="6" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          <rect x="6" y="13" width="20" height="6" rx="1" fill="#334155" stroke="#090d16" strokeWidth="1" />
          <rect x="9" y="9" width="3.6" height="14" rx="1.2" fill="url(#gi-coil-cu)" stroke="#451a03" strokeWidth="0.9" />
          <rect x="14.2" y="9" width="3.6" height="14" rx="1.2" fill="url(#gi-coil-cu)" stroke="#451a03" strokeWidth="0.9" />
          <rect x="19.4" y="9" width="3.6" height="14" rx="1.2" fill="url(#gi-coil-cu)" stroke="#451a03" strokeWidth="0.9" />
          <path d="M13 6 L16 9 L19 6" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'stun_cell':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-cell" x1="8" y1="7" x2="24" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#082f49" />
            </linearGradient>
          </defs>
          <rect x="12" y="4" width="8" height="3.5" rx="1" fill="#cbd5e1" stroke="#090d16" strokeWidth="0.9" />
          <rect x="8.5" y="7.5" width="15" height="20" rx="2" fill="url(#gi-cell)" stroke="#090d16" strokeWidth="1.2" />
          <rect x="10.5" y="10" width="11" height="3" fill="#0f172a" fillOpacity="0.65" />
          <path d="M17.5 14 L13 19 H16.5 L14.5 25 L19.5 18.5 H16 Z" fill="#fef08a" />
        </svg>
      );

    case 'fuse':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-fuse-cap" x1="4" y1="10" x2="28" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          {/* Brass end-caps */}
          <rect x="4" y="10" width="5.5" height="12" rx="1.2" fill="url(#gi-fuse-cap)" stroke="#090d16" strokeWidth="1.1" />
          <rect x="22.5" y="10" width="5.5" height="12" rx="1.2" fill="url(#gi-fuse-cap)" stroke="#090d16" strokeWidth="1.1" />
          {/* Glass cartridge tube */}
          <rect x="9.5" y="11" width="13" height="10" fill="#bae6fd" fillOpacity="0.28" stroke="#7dd3fc" strokeWidth="1" />
          {/* Glowing filament coil */}
          <path d="M10 16 L13 13.5 L15.5 18.5 L18.5 13.5 L22 16" stroke="#fde047" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'wire_cutters':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-wc-jaw" x1="12" y1="4" x2="22" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>
          {/* Forged steel shearing jaws */}
          <path d="M14 14 L10.5 5.5 L15.5 10 L16 14 Z" fill="url(#gi-wc-jaw)" stroke="#090d16" strokeWidth="1" />
          <path d="M18 14 L21.5 5.5 L16.5 10 L16 14 Z" fill="url(#gi-wc-jaw)" stroke="#090d16" strokeWidth="1" />
          {/* Insulated tactical handles */}
          <path d="M14.5 15 L8.5 27.5" stroke="#ea580c" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M17.5 15 L23.5 27.5" stroke="#ea580c" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M14.5 15 L8.5 27.5" stroke="#fdba74" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
          <circle cx="16" cy="14.5" r="2.3" fill="#cbd5e1" stroke="#090d16" strokeWidth="1" />
        </svg>
      );

    case 'throwable_can':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-can" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="45%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>
          <rect x="9" y="7" width="14" height="19" rx="2.5" fill="url(#gi-can)" stroke="#090d16" strokeWidth="1.2" />
          <rect x="9" y="13" width="14" height="6.5" fill="#dc2626" fillOpacity="0.88" />
          <ellipse cx="16" cy="7.5" rx="6.5" ry="1.8" fill="#cbd5e1" stroke="#334155" strokeWidth="0.8" />
          <path d="M11.5 16 H20.5" stroke="#fef2f2" strokeWidth="1.3" strokeDasharray="2 1.5" />
          <path d="M11 22 L14 23.5" stroke="#0f172a" strokeWidth="1.1" />
        </svg>
      );

    case 'flare':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-flr-tube" x1="10" y1="12" x2="22" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="60%" stopColor="#991b1b" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>
          </defs>
          {/* Flare burst sparks */}
          <path d="M16 2 L17.6 7.2 L23 5.5 L19 9.8 L24 12 L18.2 12 L16 15.5 L13.8 12 L8 12 L13 9.8 L9 5.5 L14.4 7.2 Z" fill="#fef08a" />
          <circle cx="16" cy="9.5" r="3" fill="#ffffff" />
          {/* Signal cylinder */}
          <rect x="11.5" y="13" width="9" height="15.5" rx="1.4" fill="url(#gi-flr-tube)" stroke="#090d16" strokeWidth="1.1" />
          <rect x="11.5" y="17" width="9" height="2.6" fill="#fef08a" fillOpacity="0.9" />
          <rect x="11.5" y="24.5" width="9" height="3.5" rx="0.8" fill="#334155" />
        </svg>
      );

    case 'battery':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gi-bat" x1="9" y1="6" x2="23" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="42%" stopColor="#d97706" />
              <stop offset="43%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
          </defs>
          <rect x="12.5" y="4" width="7" height="3" rx="0.8" fill="#cbd5e1" stroke="#090d16" strokeWidth="0.9" />
          <rect x="9.5" y="7" width="13" height="20.5" rx="2" fill="url(#gi-bat)" stroke="#090d16" strokeWidth="1.2" />
          <path d="M16 10.5 V14 M14.2 12.2 H17.8" stroke="#090d16" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M14.2 22.5 H17.8" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

export function VhsTapeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <rect x="2.5" y="6" width="23" height="16" rx="2" fill="#181c24" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6" y="9" width="16" height="5" rx="0.8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
      <circle cx="9.5" cy="17.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18.5" cy="17.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.7 17.5 H16.3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function UvLensIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="9.5" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
      <circle cx="14" cy="14" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 2.5 V5.5 M14 22.5 V25.5 M2.5 14 H5.5 M22.5 14 H25.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function DossierFolderIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <path d="M3 7.5 C3 6.4 3.9 5.5 5 5.5 H11 L13.5 8 H23 C24.1 8 25 8.9 25 10 V21 C25 22.1 24.1 23 23 23 H5 C3.9 23 3 22.1 3 21 Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 13 H20 M8 17 H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CharacterBadgeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <rect x="4" y="4" width="20" height="20" rx="2.5" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="11" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 21 C9.2 17.5 11.4 16 14 16 C16.6 16 18.8 17.5 19.5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WarningBeaconIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <path d="M14 4 L25 23 H3 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 10.5 V16.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="19.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function RadioWaveIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <rect x="7" y="11" width="14" height="13" rx="2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 11 V4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 15 H17.5 M10.5 18 H17.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="18" cy="21" r="1.2" fill="currentColor" />
      <path d="M14.5 5.5 C16.5 6.5 17.5 8 17.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SafeDialIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="21" height="19" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="14" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="14" r="1.8" fill="currentColor" />
      <path d="M14 8.5 V10.5 M19.5 14 H17.5 M14 19.5 V17.5 M8.5 14 H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldDoorIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <path d="M14 3 L23 6.5 V14 C23 19.2 19.2 23 14 25 C8.8 23 5 19.2 5 14 V6.5 Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 13.5 H18 M14 9.5 V17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Sector09Emblem({ className = 'w-11 h-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gi-s09-ring" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>
      {/* Chamfered industrial octagon */}
      <polygon
        points="15,3 33,3 45,15 45,33 33,45 15,45 3,33 3,15"
        fill="#0b0e15"
        stroke="url(#gi-s09-ring)"
        strokeWidth="2.4"
      />
      <polygon
        points="17,7.5 31,7.5 40.5,17 40.5,31 31,40.5 17,40.5 7.5,31 7.5,17"
        fill="none"
        stroke="#f59e0b"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      {/* Stylized 09 stencil + glowing crimson eye slit */}
      <path d="M12 18 H36 M12 30 H36" stroke="#dc2626" strokeOpacity="0.45" strokeWidth="1" />
      <rect x="13" y="21.5" width="9" height="5" rx="1" fill="#dc2626" />
      <rect x="26" y="21.5" width="9" height="5" rx="1" fill="#dc2626" />
      <rect x="16" y="22.8" width="3" height="2.4" fill="#fef08a" />
      <rect x="29" y="22.8" width="3" height="2.4" fill="#fef08a" />
      <path d="M19 13 H29 M24 10 V15" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 35 H30" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ============================================================================
   PHASE 2 — PROGRESSION HUB, 3D STORE, ACHIEVEMENTS & GALLERY TACTICAL ICONS
   ============================================================================ */

export function CoinSvgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gi-coin-rim" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="48%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="gi-coin-face" x1="8" y1="7" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="55%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
      {/* Chamfered industrial survival token */}
      <polygon
        points="11,2.5 21,2.5 29.5,11 29.5,21 21,29.5 11,29.5 2.5,21 2.5,11"
        fill="url(#gi-coin-rim)"
        stroke="#451a03"
        strokeWidth="1.3"
      />
      <polygon
        points="12.2,5.5 19.8,5.5 26.5,12.2 26.5,19.8 19.8,26.5 12.2,26.5 5.5,19.8 5.5,12.2"
        fill="url(#gi-coin-face)"
        stroke="#fef3c7"
        strokeOpacity="0.55"
        strokeWidth="0.9"
      />
      {/* Tactical S09 diamond crest */}
      <path
        d="M16 9 L21.5 16 L16 23 L10.5 16 Z"
        fill="#451a03"
        fillOpacity="0.45"
        stroke="#fef9c3"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.2" fill="#fef08a" />
      <path d="M9.5 8.5 L12 6.5" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function TrophySvgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gi-trophy-cup" x1="8" y1="4" x2="24" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="gi-trophy-base" x1="8" y1="22" x2="24" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* Angular tactical handles */}
      <path
        d="M9 7 H5 V12.5 C5 15.2 6.8 17 9.5 17.4 M23 7 H27 V12.5 C27 15.2 25.2 17 22.5 17.4"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Main chalice body */}
      <path
        d="M9 5 H23 V12.5 C23 16.8 19.9 19.8 16 20.5 C12.1 19.8 9 16.8 9 12.5 Z"
        fill="url(#gi-trophy-cup)"
        stroke="#451a03"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Specular rib & emblem */}
      <path d="M12 7.5 V13.5" stroke="#fef9c3" strokeOpacity="0.65" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="16,9 17.5,12 20.5,12.4 18.2,14.5 18.8,17.5 16,16 13.2,17.5 13.8,14.5 11.5,12.4 14.5,12" fill="#451a03" fillOpacity="0.55" />
      {/* Stem & heavy steel pedestal */}
      <rect x="14.2" y="20" width="3.6" height="4" fill="#b45309" stroke="#451a03" strokeWidth="0.9" />
      <path d="M9.5 24 H22.5 L24 28.5 H8 Z" fill="url(#gi-trophy-base)" stroke="#94a3b8" strokeOpacity="0.45" strokeWidth="1" />
      <path d="M11.5 26.2 H20.5" stroke="#fbbf24" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export type PerkIconKind =
  | 'stealth'
  | 'lungs'
  | 'hacker'
  | 'battery'
  | 'stamina'
  | 'taser'
  | 'scavenger'
  | 'hands'
  | 'acoustic'
  | 'adrenaline'
  | 'nightmare'
  | 'omega';

export function PerkSvgIcon({
  className = 'w-5 h-5',
  kind,
}: {
  className?: string;
  kind?: PerkIconKind;
}) {
  const isPrestige = kind === 'nightmare' || kind === 'omega';
  const strokeAccent =
    kind === 'nightmare'
      ? '#f87171'
      : kind === 'omega'
      ? '#c084fc'
      : 'currentColor';

  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      {/* Hexagonal tactical chassis */}
      <polygon
        points="16,2.5 27.5,9 27.5,23 16,29.5 4.5,23 4.5,9"
        fill={isPrestige ? '#1a0b1e' : '#0f172a'}
        fillOpacity="0.88"
        stroke={strokeAccent}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <polygon
        points="16,5.5 24.8,10.5 24.8,21.5 16,26.5 7.2,21.5 7.2,10.5"
        fill={strokeAccent}
        fillOpacity="0.12"
        stroke={strokeAccent}
        strokeOpacity="0.35"
        strokeWidth="0.9"
      />
      {/* Inner tactical glyph */}
      {kind === 'stealth' && (
        <path d="M11 21 L14 11 H18 L21 21 M13 17 H19 M9.5 22.5 H22.5" stroke={strokeAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'lungs' && (
        <path d="M16 9 V19 M16 12 C13 11.5 10.5 14 10.5 17.5 C10.5 20 12 21.5 14 21.5 C15.2 21.5 16 20.5 16 19 M16 12 C19 11.5 21.5 14 21.5 17.5 C21.5 20 20 21.5 18 21.5 C16.8 21.5 16 20.5 16 19" stroke={strokeAccent} strokeWidth="1.5" strokeLinecap="round" />
      )}
      {kind === 'hacker' && (
        <path d="M12.5 12 L9.5 16 L12.5 20 M19.5 12 L22.5 16 L19.5 20 M17 11 L15 21" stroke={strokeAccent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'battery' && (
        <>
          <rect x="11.5" y="10.5" width="9" height="12.5" rx="1.2" stroke={strokeAccent} strokeWidth="1.5" />
          <path d="M14 8.5 H18 M16.5 13 L14 17 H16.5 L15.5 20.5 L18.5 16.5 H16 Z" stroke={strokeAccent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === 'stamina' && (
        <path d="M17.5 8.5 L11.5 17 H16 L14.5 23.5 L21 15 H16.5 Z" fill={strokeAccent} fillOpacity="0.28" stroke={strokeAccent} strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {kind === 'taser' && (
        <path d="M12 10 V14 M20 10 V14 M10.5 14 H21.5 V20.5 H10.5 Z M14 17 H18" stroke={strokeAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'scavenger' && (
        <>
          <circle cx="16" cy="16" r="4.8" stroke={strokeAccent} strokeWidth="1.5" />
          <circle cx="16" cy="16" r="1.5" fill={strokeAccent} />
          <path d="M16 9 V11 M16 21 V23 M9 16 H11 M21 16 H23" stroke={strokeAccent} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {kind === 'hands' && (
        <path d="M11 19 V12.5 M14.3 19 V10.5 M17.7 19 V11.5 M21 19 V14 M11 19 C11 21.5 13 22.5 16 22.5 C19 22.5 21 21.5 21 19" stroke={strokeAccent} strokeWidth="1.5" strokeLinecap="round" />
      )}
      {kind === 'acoustic' && (
        <path d="M10 16 H12.5 L14.5 11 L17 21 L19.5 14 L21 16 H22.5" stroke={strokeAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'adrenaline' && (
        <path d="M10.5 19.5 L16 11 L21.5 19.5 M13 22.5 L16 17.5 L19 22.5" stroke={strokeAccent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'nightmare' && (
        <>
          <path d="M9.5 14.5 L14.5 16.5 L11 18.5 Z M22.5 14.5 L17.5 16.5 L21 18.5 Z" fill="#ef4444" />
          <path d="M11 21.5 L16 19.5 L21 21.5 M12 11 L16 9 L20 11" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {kind === 'omega' && (
        <path d="M11.5 21.5 H14.2 V19.5 C12 18.5 11 16.5 11 14.3 C11 11.5 13.2 9.5 16 9.5 C18.8 9.5 21 11.5 21 14.3 C21 16.5 20 18.5 17.8 19.5 V21.5 H20.5" stroke="#e879f9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {!kind && (
        <>
          <path d="M11 18 L16 12.5 L21 18" stroke={strokeAccent} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 21.5 L16 17.5 L19.5 21.5" stroke={strokeAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function StoreBagSvgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gi-store-crate" x1="5" y1="9" x2="27" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* Tactical carry handle */}
      <path d="M11.5 10 V7.2 C11.5 5.8 12.6 4.8 14 4.8 H18 C19.4 4.8 20.5 5.8 20.5 7.2 V10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      {/* Chamfered armory case */}
      <path
        d="M5 12 L7.5 9.5 H24.5 L27 12 V24.5 L24.5 27 H7.5 L5 24.5 Z"
        fill="url(#gi-store-crate)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Amber security band & latches */}
      <path d="M5.5 15.5 H26.5" stroke="#f59e0b" strokeWidth="1.6" />
      <rect x="9.5" y="13.8" width="3.5" height="4" rx="0.6" fill="#fbbf24" stroke="#0f172a" strokeWidth="0.9" />
      <rect x="19" y="13.8" width="3.5" height="4" rx="0.6" fill="#fbbf24" stroke="#0f172a" strokeWidth="0.9" />
      <path d="M12.5 22 H19.5" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GalleryFilmSvgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="25" height="20" rx="2" fill="#0f172a" fillOpacity="0.88" stroke="currentColor" strokeWidth="1.6" />
      {/* Top & bottom sprocket holes */}
      <path d="M6.5 9 H8.5 M11.5 9 H13.5 M18.5 9 H20.5 M23.5 9 H25.5" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 23 H8.5 M11.5 23 H13.5 M18.5 23 H20.5 M23.5 23 H25.5" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" />
      {/* Inner cinema viewport */}
      <rect x="7" y="11.5" width="18" height="9" rx="1" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      {/* Play chevron & REC dot */}
      <polygon points="14,13.5 19.5,16 14,18.5" fill="currentColor" />
      <circle cx="22.2" cy="13.6" r="1.1" fill="#ef4444" />
    </svg>
  );
}

export function RankBadgeSvgIcon({
  className = 'w-6 h-6',
  rank = 'S',
}: {
  className?: string;
  rank?: 'S' | 'A' | 'B' | 'C';
}) {
  const palette =
    rank === 'S'
      ? { hi: '#fef08a', mid: '#f59e0b', lo: '#78350f', text: '#fef9c3' }
      : rank === 'A'
      ? { hi: '#a7f3d0', mid: '#10b981', lo: '#064e3b', text: '#ecfdf5' }
      : rank === 'B'
      ? { hi: '#a5f3fc', mid: '#06b6d4', lo: '#164e63', text: '#ecfeff' }
      : { hi: '#cbd5e1', mid: '#64748b', lo: '#1e293b', text: '#f1f5f9' };
  const gid = `gi-rank-${rank}`;
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.hi} />
          <stop offset="50%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.lo} />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 L27 7 V16.5 C27 22.8 22.4 27.3 16 29.5 C9.6 27.3 5 22.8 5 16.5 V7 Z"
        fill="#090d16"
        stroke={`url(#${gid})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 5.8 L24 9.1 V16.2 C24 21 20.6 24.4 16 26.2 C11.4 24.4 8 21 8 16.2 V9.1 Z"
        fill={`url(#${gid})`}
        fillOpacity="0.22"
      />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fill={palette.text}
        fontSize="13.5"
        fontWeight="900"
        fontFamily="Oswald, Arial Narrow, sans-serif"
      >
        {rank}
      </text>
    </svg>
  );
}
