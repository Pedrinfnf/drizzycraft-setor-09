import {
  tapeAudioPlayer,
  type TapeNumber,
  mapLanguageToTapeLang,
} from '../audio/TapeAudioPlayer';
import type { Language } from './types';

export type DubSpeaker = 'marcos' | 'diddy' | 'vhs' | 'system' | 'survivor';

export interface VoiceDubbingConfig {
  language?: Language;
  enabled?: boolean;
  volume?: number;
  muted?: boolean;
  onSubtitle?: (line: string | null) => void;
}

function detectTapeNumber(text: string, speaker: DubSpeaker): TapeNumber | null {
  const lower = text.toLowerCase();
  if (
    /tape[\s_-]*0?2|fita[\s#_-]*0?2|cinta[\s#_-]*0?2|ch1_tape_02|dra\.?\s*helena|dr\.?\s*helena|interfer[eê]ncia neural|neural interference/.test(
      lower
    )
  ) {
    return 2;
  }
  if (
    /tape[\s_-]*0?1|fita[\s#_-]*0?1|cinta[\s#_-]*0?1|ch1_tape_01|cabine\s*09-a|cabin\s*09-a|cabina\s*09-a/.test(
      lower
    )
  ) {
    return 1;
  }
  if (speaker === 'vhs') {
    return 1;
  }
  return null;
}

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class VoiceDubbingEngine {
  private language: Language = 'pt-BR';
  private enabled = true;
  private volume = 0.95;
  private muted = false;
  private onSubtitle: ((line: string | null) => void) | null = null;
  private subtitleTimer: ReturnType<typeof setTimeout> | null = null;
  private cueCtx: AudioContext | null = null;

  isSupported(): boolean {
    return tapeAudioPlayer.isSupported();
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
    if (config.onSubtitle !== undefined) {
      this.onSubtitle = config.onSubtitle;
    }

    tapeAudioPlayer.configure({
      language: mapLanguageToTapeLang(this.language),
      volume: this.volume,
      muted: this.muted || !this.enabled,
    });

    if (!this.enabled || this.muted || this.volume <= 0.001) {
      this.stop();
    }
  }

  private playCueTone(speaker: DubSpeaker): void {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    try {
      if (!this.cueCtx) {
        this.cueCtx = new Ctor();
      }
      const ctx = this.cueCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(speaker === 'diddy' ? 280 : 1250, t);
      bp.Q.setValueAtTime(2.2, t);

      osc.type = speaker === 'diddy' ? 'sawtooth' : 'triangle';
      const baseFreq =
        speaker === 'diddy'
          ? 110
          : speaker === 'marcos'
            ? 640
            : speaker === 'system'
              ? 880
              : 520;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.86, t + 0.065);

      const level = Math.max(0.001, Math.min(0.12, this.volume * 0.09));
      gain.gain.setValueAtTime(level, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.075);

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // Safe no-op in headless or restricted audio environments
    }
  }

  private emitFallbackSubtitle(cleanText: string): void {
    if (this.subtitleTimer) {
      clearTimeout(this.subtitleTimer);
      this.subtitleTimer = null;
    }
    if (!this.onSubtitle) return;
    try {
      this.onSubtitle(cleanText);
    } catch {
      // Ignore callback error
    }
    const durationMs = Math.max(2400, Math.min(9000, cleanText.length * 55));
    this.subtitleTimer = setTimeout(() => {
      this.subtitleTimer = null;
      try {
        this.onSubtitle?.(null);
      } catch {
        // Ignore callback error
      }
    }, durationMs);
  }

  playTape(
    tapeNumber: TapeNumber,
    onSubtitle?: (line: string | null) => void
  ): Promise<boolean> {
    if (!this.enabled || this.muted || this.volume <= 0.001) {
      return Promise.resolve(false);
    }
    return tapeAudioPlayer.playTape(tapeNumber, {
      lang: mapLanguageToTapeLang(this.language),
      volume: this.volume,
      onSubtitle: onSubtitle ?? this.onSubtitle ?? undefined,
    });
  }

  speak(text: string, speaker: DubSpeaker = 'system', onRadioCue?: () => void): boolean {
    const cleanText = (text ?? '').trim();
    if (!cleanText || !this.enabled || this.muted || this.volume <= 0.001) {
      return false;
    }

    if (onRadioCue) {
      try {
        onRadioCue();
      } catch {
        // Never allow radio cue callback errors to break dubbing flow
      }
    }

    const tapeNumber = detectTapeNumber(cleanText, speaker);
    if (tapeNumber !== null) {
      void this.playTape(tapeNumber);
      return true;
    }

    // Clean subtitle + subtle analog comms audio cue (no robotic browser TTS)
    this.emitFallbackSubtitle(cleanText);
    if (this.isSupported()) {
      this.playCueTone(speaker);
      return true;
    }
    return false;
  }

  stop(): void {
    if (this.subtitleTimer) {
      clearTimeout(this.subtitleTimer);
      this.subtitleTimer = null;
    }
    tapeAudioPlayer.stop(false);
    if (this.onSubtitle) {
      try {
        this.onSubtitle(null);
      } catch {
        // Safe no-op
      }
    }
  }
}

export const voiceDubbing = new VoiceDubbingEngine();
