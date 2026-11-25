import type { Language } from './types';

export type DubSpeaker = 'marcos' | 'diddy' | 'vhs' | 'system' | 'survivor';

export interface VoiceDubbingConfig {
  language?: Language;
  enabled?: boolean;
  volume?: number;
  muted?: boolean;
}

interface VocalProfile {
  pitch: number;
  rate: number;
}

const SPEAKER_PROFILES: Record<DubSpeaker, VocalProfile> = {
  diddy: { pitch: 0.55, rate: 0.82 },
  marcos: { pitch: 0.92, rate: 1.06 },
  vhs: { pitch: 1.08, rate: 0.96 },
  system: { pitch: 0.85, rate: 1.05 },
  survivor: { pitch: 1.0, rate: 1.02 },
};

export class VoiceDubbingEngine {
  private language: Language = 'pt-BR';
  private enabled = true;
  private volume = 0.95;
  private muted = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private voicesBound = false;

  constructor() {
    this.bindVoicesChanged();
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  private bindVoicesChanged(): void {
    if (this.voicesBound || !this.isSupported()) return;
    this.voicesBound = true;
    try {
      const synth = window.speechSynthesis;
      const refresh = () => {
        try {
          const list = synth.getVoices();
          if (Array.isArray(list) && list.length > 0) {
            this.cachedVoices = list;
          }
        } catch {
          // Ignore browser voice enumeration errors
        }
      };
      refresh();
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', refresh);
      } else if ('onvoiceschanged' in synth) {
        synth.onvoiceschanged = refresh;
      }
    } catch {
      // Safe no-op in restricted environments
    }
  }

  configure(config: VoiceDubbingConfig): void {
    if (config.language !== undefined) {
      this.language = config.language;
    }
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.volume !== undefined && Number.isFinite(config.volume)) {
      this.volume = Math.max(0, Math.min(1, config.volume));
    }
    if (config.muted !== undefined) {
      this.muted = config.muted;
    }
    if (!this.enabled || this.muted || this.volume <= 0.001) {
      this.stop();
    }
  }

  private pickVoice(lang: Language): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    try {
      const synth = window.speechSynthesis;
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : synth.getVoices();
      if (!Array.isArray(voices) || voices.length === 0) return null;
      this.cachedVoices = voices;

      const normalizedTarget = lang.toLowerCase();
      const shortPrefix = normalizedTarget.split('-')[0];

      // 1. Exact locale match (prefer localService native voices first)
      const exactMatches = voices.filter(
        (v) => (v.lang || '').toLowerCase().replace('_', '-') === normalizedTarget
      );
      if (exactMatches.length > 0) {
        const localExact = exactMatches.find((v) => v.localService);
        return localExact ?? exactMatches[0];
      }

      // 2. Language prefix match (e.g. 'pt', 'en', 'es')
      const prefixMatches = voices.filter((v) =>
        (v.lang || '').toLowerCase().replace('_', '-').startsWith(shortPrefix)
      );
      if (prefixMatches.length > 0) {
        const localPrefix = prefixMatches.find((v) => v.localService);
        return localPrefix ?? prefixMatches[0];
      }

      // 3. Default voice fallback
      return voices.find((v) => v.default) ?? voices[0] ?? null;
    } catch {
      return null;
    }
  }

  speak(text: string, speaker: DubSpeaker = 'system', onRadioCue?: () => void): boolean {
    const cleanText = (text ?? '').trim();
    if (!cleanText || !this.enabled || this.muted || this.volume <= 0.001) {
      return false;
    }
    if (!this.isSupported()) {
      return false;
    }

    try {
      this.bindVoicesChanged();
      const synth = window.speechSynthesis;
      synth.cancel();

      if (onRadioCue) {
        try {
          onRadioCue();
        } catch {
          // Never allow radio cue callback errors to break speech synthesis
        }
      }

      const utterance = new window.SpeechSynthesisUtterance(cleanText);
      const profile = SPEAKER_PROFILES[speaker] ?? SPEAKER_PROFILES.system;
      utterance.lang = this.language;
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
      utterance.volume = Math.max(0, Math.min(1, this.volume));

      const voice = this.pickVoice(this.language);
      if (voice) {
        utterance.voice = voice;
      }

      synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Safe no-op
    }
  }
}

export const voiceDubbing = new VoiceDubbingEngine();
