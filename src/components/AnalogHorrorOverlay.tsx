import React from 'react';
import type { HudSnapshot } from '../game/types';

interface AnalogHorrorOverlayProps {
  hud: HudSnapshot;
  vignetteIntensity?: number;
}

/**
 * Pure GPU-light horror framing overlay (zero backdrop-filter!).
 * Renders danger pulse vignette, hit flash, proximity chromatic aberration edge split,
 * locker narrow slit view, and under-table / under-bed claustrophobic shadow framing.
 */
export const AnalogHorrorOverlay: React.FC<AnalogHorrorOverlayProps> = ({
  hud,
  vignetteIntensity = 1.0,
}) => {
  const showFadeOnly = hud.transitionFade > 0.02 && hud.mode !== 'playing' && hud.mode !== 'jumpscare';
  if (showFadeOnly) {
    return (
      <div
        className="fixed inset-0 z-30 pointer-events-none select-none bg-[#05070d]"
        style={{ opacity: Math.min(1, hud.transitionFade) }}
      />
    );
  }
  if (hud.mode !== 'playing' && hud.mode !== 'jumpscare') return null;

  const vigScale = Math.max(0.25, Math.min(1.5, vignetteIntensity));
  const sightBoost = hud.diddyInView ? 0.22 : 0;
  const redAlpha = Math.min(
    0.78,
    hud.damageFlash * 0.65 + (hud.diddyState === 'chase' ? 0.3 : hud.dangerIntensity * 0.24) + sightBoost
  );
  const chrom = Math.max(0, Math.min(1, hud.chromaticIntensity ?? 0));
  const useLightCssGrain = hud.graphicsQuality === 'low' || hud.graphicsQuality === 'medium';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Hiding Spot Claustrophobic Framing */}
      {hud.hiding && hud.hidingKind === 'locker' && (
        <div className="absolute inset-0 locker-slats" />
      )}
      {hud.hiding && (hud.hidingKind === 'under_table' || hud.hidingKind === 'under_bed') && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(4,5,9,0.96) 0%, rgba(4,5,9,0.92) 30%, rgba(4,5,9,0.12) 48%, rgba(4,5,9,0.12) 78%, rgba(4,5,9,0.92) 100%)',
          }}
        />
      )}

      {/* GPU-Light Proximity Chromatic Aberration Edge Pulse (Red/Cyan Split, zero backdrop-filter!) */}
      {chrom > 0.06 && (
        <div
          className="absolute inset-0 transition-opacity duration-100"
          style={{
            opacity: chrom * 0.72,
            boxShadow: `inset ${Math.round(chrom * 14)}px 0 ${Math.round(chrom * 32)}px rgba(239, 68, 68, 0.42), inset -${Math.round(chrom * 14)}px 0 ${Math.round(chrom * 32)}px rgba(56, 189, 248, 0.38)`,
          }}
        />
      )}

      {/* Danger / Proximity / Diddy-In-View Tension Vignette */}
      {redAlpha > 0.03 && (
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            background: `radial-gradient(circle at center, rgba(0,0,0,0) ${
              hud.diddyInView ? '36%' : '42%'
            }, rgba(160, 12, 18, ${redAlpha.toFixed(2)}) 100%)`,
          }}
        />
      )}

      {/* GPU-Light Scanline/Film Texture Overlay on Low/Medium (High/Ultra uses full EffectComposer ShaderPass!) */}
      {useLightCssGrain && (
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 1px, transparent 1px, transparent 3px)',
          }}
        />
      )}

      {/* Configurable Dark Atmospheric Corner Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, rgba(0,0,0,0) 56%, rgba(4,7,14,${Math.min(
            0.92,
            0.64 * vigScale
          ).toFixed(2)}) 100%)`,
        }}
      />

      {/* Smooth Screen Transition Fade */}
      {hud.transitionFade > 0.02 && (
        <div
          className="absolute inset-0 bg-[#05070d]"
          style={{ opacity: Math.min(1, hud.transitionFade) }}
        />
      )}
    </div>
  );
};
