import { createDefaultSettings, saveManager } from './saveManager';
import type { GameSettings, GraphicsQuality } from './types';

export interface GraphicsPresetProfile {
  quality: GraphicsQuality;
  label: string;
  description: string;
  maxDpr: number;
  shadowsEnabled: boolean;
  dualMoonShadow: boolean;
  parallaxEnabled: boolean;
  postProcessingEnabled: boolean;
  shadowMapSize: number;
  maxDynamicLights: number;
  dustParticleCount: number;
  fogFar: number;
  textureSize: 128 | 256;
}

export const GRAPHICS_PROFILES: Record<GraphicsQuality, GraphicsPresetProfile> = {
  low: {
    quality: 'low',
    label: 'Baixo',
    description: '60 FPS cravado em celulares leves. PBR 32×32 + AO falso sem sombras dinâmicas.',
    maxDpr: 0.95,
    shadowsEnabled: false,
    dualMoonShadow: false,
    parallaxEnabled: false,
    postProcessingEnabled: false,
    shadowMapSize: 512,
    maxDynamicLights: 2,
    dustParticleCount: 40,
    fogFar: 26,
    textureSize: 128,
  },
  medium: {
    quality: 'medium',
    label: 'Médio',
    description: 'Padrão Mobile 60 FPS: PBR 32×32, sombra na Lanterna, Fake Bloom e Pérgola projetada.',
    maxDpr: 1.25,
    shadowsEnabled: true,
    dualMoonShadow: false,
    parallaxEnabled: false,
    postProcessingEnabled: false,
    shadowMapSize: 512,
    maxDynamicLights: 3,
    dustParticleCount: 90,
    fogFar: 32,
    textureSize: 128,
  },
  high: {
    quality: 'high',
    label: 'Alto',
    description: 'PC / Top: 2 Sombras Dinâmicas (Lanterna + Lua), Parallax nos blocos e EffectComposer + Bloom.',
    maxDpr: 1.65,
    shadowsEnabled: true,
    dualMoonShadow: true,
    parallaxEnabled: true,
    postProcessingEnabled: true,
    shadowMapSize: 1024,
    maxDynamicLights: 4,
    dustParticleCount: 160,
    fogFar: 38,
    textureSize: 256,
  },
  ultra: {
    quality: 'ultra',
    label: 'Ultra',
    description: 'Máximo realismo: Sombras 2048px (Lanterna + Lua), Parallax profundo, Bloom HD e Grão/Aberração.',
    maxDpr: 2.0,
    shadowsEnabled: true,
    dualMoonShadow: true,
    parallaxEnabled: true,
    postProcessingEnabled: true,
    shadowMapSize: 2048,
    maxDynamicLights: 5,
    dustParticleCount: 220,
    fogFar: 42,
    textureSize: 256,
  },
};

export function getGraphicsProfile(quality: GraphicsQuality): GraphicsPresetProfile {
  return GRAPHICS_PROFILES[quality] ?? GRAPHICS_PROFILES.medium;
}

export function loadSettings(): GameSettings {
  return saveManager.getSettings();
}

export function saveSettings(settings: GameSettings): GameSettings {
  return saveManager.updateSettings(settings);
}

export function resetSettings(): GameSettings {
  return saveManager.resetSettings();
}

export { createDefaultSettings };
