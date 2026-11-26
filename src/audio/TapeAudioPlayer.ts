import type { Language } from '../game/types';

export type TapeLang = 'pt' | 'en' | 'es';
export type TapeNumber = 1 | 2;

export interface TapeSubtitleCue {
  /** Normalized progress start [0..1] across tape speech duration */
  startFrac: number;
  text: string;
}

export interface TapePlayOptions {
  lang?: TapeLang | Language;
  volume?: number;
  onSubtitle?: (line: string | null) => void;
  onEnded?: () => void;
}

export interface TapeAudioPlayerConfig {
  language?: TapeLang | Language;
  volume?: number;
  muted?: boolean;
}

export function mapLanguageToTapeLang(lang?: TapeLang | Language): TapeLang {
  if (!lang) return 'pt';
  const lower = lang.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('es')) return 'es';
  return 'pt';
}

export function getTapeAudioUrl(lang: TapeLang, tapeNumber: TapeNumber): string {
  const baseUrl =
    (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}audio/tapes/${lang}/tape_0${tapeNumber}.mp3`;
}

export const TAPE_SUBTITLE_CUES: Record<TapeLang, Record<TapeNumber, readonly TapeSubtitleCue[]>> = {
  pt: {
    1: [
      {
        startFrac: 0.0,
        text: 'Fita 01 — Vigia Marcos falando da Cabine 09-A. Se você encontrou esta gravação, escute com atenção.',
      },
      {
        startFrac: 0.27,
        text: 'O P. Drizzy não responde mais à contenção. Ele patrulha os corredores no escuro e ouve qualquer passo apressado.',
      },
      {
        startFrac: 0.54,
        text: 'Não pise nas tábuas soltas e rangentes do piso sem agachar — um único estalo entrega sua posição.',
      },
      {
        startFrac: 0.77,
        text: 'Se ele aparecer na sua frente, dispare o flash da Câmera Polaroid no rosto dele para atordoá-lo e fugir.',
      },
    ],
    2: [
      {
        startFrac: 0.0,
        text: 'Fita 02 — Dra. Helena. A Interferência Neural está se intensificando por todo o Setor 09.',
      },
      {
        startFrac: 0.28,
        text: 'No breu total e perto do Sujeito 09, a estática distorce a percepção. Mantenha a lanterna acesa.',
      },
      {
        startFrac: 0.53,
        text: 'Tome as pílulas de Supressor de Frequência assim que o sinal começar a falhar.',
      },
      {
        startFrac: 0.74,
        text: 'Procure o Sótão Secreto: atrás dele há um Elevador de Carga oculto que desce direto para o Capítulo 2.',
      },
    ],
  },
  en: {
    1: [
      {
        startFrac: 0.0,
        text: 'Tape 01 — Watchman Marcos from Cabin 09-A. If you are listening to this, stay sharp.',
      },
      {
        startFrac: 0.26,
        text: 'P. Drizzy broke containment. He stalks the dark hallways and tracks every careless sound.',
      },
      {
        startFrac: 0.53,
        text: 'Never walk across creaking floorboards standing up — crouch low or the wood gives you away.',
      },
      {
        startFrac: 0.76,
        text: 'If he corners you, fire the Polaroid Camera flash right in his face to stun him and escape.',
      },
    ],
    2: [
      {
        startFrac: 0.0,
        text: 'Tape 02 — Dr. Helena. Neural Interference is spiking across Sector 09.',
      },
      {
        startFrac: 0.27,
        text: 'In pitch darkness and near Subject 09, the static tears at your mind. Keep your light steady.',
      },
      {
        startFrac: 0.52,
        text: 'Take the Frequency Suppressor pills the moment the distortion rises.',
      },
      {
        startFrac: 0.73,
        text: 'Find the Secret Attic: behind it lies a hidden Cargo Elevator leading straight down to Chapter 2.',
      },
    ],
  },
  es: {
    1: [
      {
        startFrac: 0.0,
        text: 'Cinta 01 — Vigilante Marcos desde la Cabina 09-A. Si encontraste esta grabación, presta atención.',
      },
      {
        startFrac: 0.27,
        text: 'P. Drizzy rompió la contención. Patrulla los pasillos a oscuras y escucha cada paso descuidado.',
      },
      {
        startFrac: 0.54,
        text: 'Nunca pises las tablas sueltas y crujientes sin agacharte — un solo crujido te delatará.',
      },
      {
        startFrac: 0.77,
        text: 'Si te acorrala, dispara el flash de la Cámara Polaroid directo a su rostro para aturdirlo y huir.',
      },
    ],
    2: [
      {
        startFrac: 0.0,
        text: 'Cinta 02 — Dra. Helena. La Interferencia Neural se agrava en todo el Sector 09.',
      },
      {
        startFrac: 0.28,
        text: 'En la oscuridad total y cerca del Sujeto 09, la estática distorsiona los sentidos. Mantén la luz encendida.',
      },
      {
        startFrac: 0.53,
        text: 'Toma las píldoras del Supresor de Frecuencia en cuanto la señal empiece a fallar.',
      },
      {
        startFrac: 0.74,
        text: 'Busca el Ático Secreto: detrás se oculta un Ascensor de Carga que desciende directo al Capítulo 2.',
      },
    ],
  },
};

export function getTapeSubtitles(
  lang: TapeLang | Language,
  tapeNumber: TapeNumber
): readonly TapeSubtitleCue[] {
  const mapped = mapLanguageToTapeLang(lang);
  return TAPE_SUBTITLE_CUES[mapped][tapeNumber];
}

function createTapeSaturationCurve(drive = 2.4, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    // Mild asymmetric magnetic hysteresis saturation for warm analog tape timbre
    const biased = x + 0.045 * x * x;
    curve[i] = Math.tanh(biased * drive) / norm;
  }
  return curve;
}

function getAudioContextConstructor(): (typeof AudioContext) | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

interface ActivePlaybackNodes {
  voiceSource: AudioBufferSourceNode | null;
  lfoOsc: OscillatorNode | null;
  lfoGain: GainNode | null;
  hissSource: AudioBufferSourceNode | null;
  hissGain: GainNode | null;
  masterGain: GainNode | null;
}

export class TapeAudioPlayer {
  private ctx: AudioContext | null = null;
  private language: TapeLang = 'pt';
  private volume = 0.9;
  private muted = false;
  private bufferCache = new Map<string, AudioBuffer>();
  private noiseBuffer: AudioBuffer | null = null;
  private saturationCurve: Float32Array<ArrayBuffer> | null = null;
  private activeNodes: ActivePlaybackNodes | null = null;
  private subtitleTimers: ReturnType<typeof setTimeout>[] = [];
  private activeSubtitleCb: ((line: string | null) => void) | null = null;
  private playbackToken = 0;
  private playing = false;

  isSupported(): boolean {
    return getAudioContextConstructor() !== null;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  configure(config: TapeAudioPlayerConfig): void {
    if (config.language !== undefined) {
      this.language = mapLanguageToTapeLang(config.language);
    }
    if (config.volume !== undefined && Number.isFinite(config.volume)) {
      this.volume = Math.max(0, Math.min(1, config.volume));
    }
    if (config.muted !== undefined) {
      this.muted = config.muted;
    }

    const effectiveGain = this.muted ? 0 : this.volume;
    if (this.activeNodes?.masterGain && this.ctx) {
      try {
        this.activeNodes.masterGain.gain.setTargetAtTime(
          effectiveGain,
          this.ctx.currentTime,
          0.03
        );
      } catch {
        // Ignore AudioParam scheduling errors in restricted environments
      }
    }
  }

  private ensureContext(): AudioContext | null {
    const Ctor = getAudioContextConstructor();
    if (!Ctor) return null;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Browser autoplay gate: safely ignored until user gesture
      });
    }
    return this.ctx;
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 2.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Filtered pink-ish noise for realistic magnetic oxide tape hiss
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.22) * 0.24));
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private getSaturationCurve(): Float32Array<ArrayBuffer> {
    if (!this.saturationCurve) {
      this.saturationCurve = createTapeSaturationCurve(2.35, 1024);
    }
    return this.saturationCurve;
  }

  private scheduleMechanicalInsertAndPlay(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number
  ): number {
    const noise = this.ensureNoiseBuffer(ctx);

    // 1. Cassette shell insertion thud (t + 0.00s)
    const insertNoise = ctx.createBufferSource();
    insertNoise.buffer = noise;
    const insertFilter = ctx.createBiquadFilter();
    insertFilter.type = 'bandpass';
    insertFilter.frequency.setValueAtTime(420, startTime);
    insertFilter.Q.setValueAtTime(2.6, startTime);
    const insertGain = ctx.createGain();
    insertGain.gain.setValueAtTime(0.001, startTime);
    insertGain.gain.linearRampToValueAtTime(0.42, startTime + 0.012);
    insertGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.085);
    insertNoise.connect(insertFilter);
    insertFilter.connect(insertGain);
    insertGain.connect(dest);
    insertNoise.start(startTime, 0.05, 0.095);

    // Low plastic body thump
    const thumpOsc = ctx.createOscillator();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(165, startTime);
    thumpOsc.frequency.exponentialRampToValueAtTime(62, startTime + 0.07);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.28, startTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.075);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(dest);
    thumpOsc.start(startTime);
    thumpOsc.stop(startTime + 0.08);

    // 2. Mechanical PLAY button latch click (t + 0.115s)
    const clickTime = startTime + 0.115;
    const clickNoise = ctx.createBufferSource();
    clickNoise.buffer = noise;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(1680, clickTime);
    clickFilter.Q.setValueAtTime(4.8, clickTime);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.48, clickTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.042);
    clickNoise.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(dest);
    clickNoise.start(clickTime, 0.4, 0.05);

    // Metallic latch ping
    const latchOsc = ctx.createOscillator();
    latchOsc.type = 'square';
    latchOsc.frequency.setValueAtTime(2400, clickTime);
    latchOsc.frequency.exponentialRampToValueAtTime(980, clickTime + 0.024);
    const latchGain = ctx.createGain();
    latchGain.gain.setValueAtTime(0.09, clickTime);
    latchGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.028);
    latchOsc.connect(latchGain);
    latchGain.connect(dest);
    latchOsc.start(clickTime);
    latchOsc.stop(clickTime + 0.032);

    // Return exact time when voice playback should begin after capstan settles
    return startTime + 0.24;
  }

  private triggerMechanicalStopClick(ctx: AudioContext, volumeScale: number): void {
    try {
      const t = ctx.currentTime;
      const noise = this.ensureNoiseBuffer(ctx);
      const outGain = ctx.createGain();
      outGain.gain.setValueAtTime(Math.max(0, Math.min(1, volumeScale)), t);
      outGain.connect(ctx.destination);

      // Sharp mechanical STOP switch release click
      const stopNoise = ctx.createBufferSource();
      stopNoise.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1420, t);
      bp.Q.setValueAtTime(5.2, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.048);
      stopNoise.connect(bp);
      bp.connect(g);
      g.connect(outGain);
      stopNoise.start(t, 0.85, 0.055);

      // Capstan brake thud
      const brakeOsc = ctx.createOscillator();
      brakeOsc.type = 'sine';
      brakeOsc.frequency.setValueAtTime(130, t);
      brakeOsc.frequency.exponentialRampToValueAtTime(48, t + 0.06);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.22, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      brakeOsc.connect(bg);
      bg.connect(outGain);
      brakeOsc.start(t);
      brakeOsc.stop(t + 0.07);
    } catch {
      // Safe no-op
    }
  }

  private clearSubtitleTimers(): void {
    for (const timer of this.subtitleTimers) {
      clearTimeout(timer);
    }
    this.subtitleTimers = [];
  }

  private scheduleSubtitles(
    lang: TapeLang,
    tapeNumber: TapeNumber,
    durationSec: number,
    leadInSec: number,
    token: number,
    onSubtitle?: (line: string | null) => void
  ): void {
    this.clearSubtitleTimers();
    if (!onSubtitle) return;
    this.activeSubtitleCb = onSubtitle;

    const cues = TAPE_SUBTITLE_CUES[lang][tapeNumber];
    const safeDuration = Math.max(4, durationSec);

    for (const cue of cues) {
      const delayMs = Math.max(0, Math.round((leadInSec + cue.startFrac * safeDuration) * 1000));
      const timer = setTimeout(() => {
        if (this.playbackToken !== token) return;
        try {
          onSubtitle(cue.text);
        } catch {
          // Ignore UI callback errors
        }
      }, delayMs);
      this.subtitleTimers.push(timer);
    }

    const endMs = Math.round((leadInSec + safeDuration + 0.45) * 1000);
    const endTimer = setTimeout(() => {
      if (this.playbackToken !== token) return;
      try {
        onSubtitle(null);
      } catch {
        // Ignore UI callback errors
      }
    }, endMs);
    this.subtitleTimers.push(endTimer);
  }

  private async loadAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    if (typeof fetch !== 'function') return null;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      this.bufferCache.set(url, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  async playTape(tapeNumber: TapeNumber, options: TapePlayOptions = {}): Promise<boolean> {
    this.stop(false);
    const token = ++this.playbackToken;
    const lang = mapLanguageToTapeLang(options.lang ?? this.language);
    const effectiveVolume = this.muted
      ? 0
      : Math.max(0, Math.min(1, options.volume ?? this.volume));

    const ctx = this.ensureContext();
    if (!ctx) {
      // Headless / Node-safe fallback: emit first subtitle synchronously if requested, never throw
      if (options.onSubtitle) {
        this.activeSubtitleCb = options.onSubtitle;
        const cues = TAPE_SUBTITLE_CUES[lang][tapeNumber];
        if (cues.length > 0) {
          try {
            options.onSubtitle(cues[0].text);
          } catch {
            // Safe no-op
          }
        }
      }
      return false;
    }

    const url = getTapeAudioUrl(lang, tapeNumber);
    const decoded = await this.loadAudioBuffer(ctx, url);
    if (this.playbackToken !== token) {
      return false;
    }

    if (!decoded) {
      // Graceful subtitle-only fallback if asset fetch/decode fails
      this.scheduleSubtitles(lang, tapeNumber, 14, 0, token, options.onSubtitle);
      return false;
    }

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(effectiveVolume, now);
      masterGain.connect(ctx.destination);

      // 1. Mechanical cassette-insert + Play click BEFORE speech playback
      const speechStartTime = this.scheduleMechanicalInsertAndPlay(ctx, masterGain, now);
      const leadInSec = Math.max(0, speechStartTime - now);

      // 2. Voice AudioBufferSourceNode with Wow & Flutter LFO -> playbackRate
      const voiceSource = ctx.createBufferSource();
      voiceSource.buffer = decoded;

      const lfoOsc = ctx.createOscillator();
      lfoOsc.type = 'sine';
      lfoOsc.frequency.setValueAtTime(1.7, speechStartTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.0035, speechStartTime);
      lfoOsc.connect(lfoGain);
      lfoGain.connect(voiceSource.playbackRate);

      // 3. Analog Cassette DSP Chain: BiquadFilter (bandpass 1350Hz, Q 1.1) -> WaveShaper (warm soft saturation)
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1350, speechStartTime);
      bandpass.Q.setValueAtTime(1.1, speechStartTime);

      const saturator = ctx.createWaveShaper();
      saturator.curve = this.getSaturationCurve();
      saturator.oversample = '2x';

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(1.35, speechStartTime);

      voiceSource.connect(bandpass);
      bandpass.connect(saturator);
      saturator.connect(voiceGain);
      voiceGain.connect(masterGain);

      // 4. Filtered continuous Tape Hiss noise floor mixed softly underneath
      const hissSource = ctx.createBufferSource();
      hissSource.buffer = this.ensureNoiseBuffer(ctx);
      hissSource.loop = true;

      const hissHighpass = ctx.createBiquadFilter();
      hissHighpass.type = 'highpass';
      hissHighpass.frequency.setValueAtTime(1600, now);

      const hissBand = ctx.createBiquadFilter();
      hissBand.type = 'bandpass';
      hissBand.frequency.setValueAtTime(3400, now);
      hissBand.Q.setValueAtTime(0.9, now);

      const hissGain = ctx.createGain();
      hissGain.gain.setValueAtTime(0.0001, now + 0.11);
      hissGain.gain.linearRampToValueAtTime(0.042, speechStartTime);

      hissSource.connect(hissHighpass);
      hissHighpass.connect(hissBand);
      hissBand.connect(hissGain);
      hissGain.connect(masterGain);

      this.activeNodes = {
        voiceSource,
        lfoOsc,
        lfoGain,
        hissSource,
        hissGain,
        masterGain,
      };
      this.playing = true;

      // Schedule synchronized subtitles driven by active language
      this.scheduleSubtitles(
        lang,
        tapeNumber,
        decoded.duration,
        leadInSec,
        token,
        options.onSubtitle
      );

      voiceSource.onended = () => {
        if (this.playbackToken !== token) return;
        const stopVol = this.muted ? 0 : this.volume;
        this.cleanupNodes();
        this.playing = false;
        this.clearSubtitleTimers();
        if (this.ctx && stopVol > 0.001) {
          this.triggerMechanicalStopClick(this.ctx, stopVol);
        }
        try {
          options.onSubtitle?.(null);
        } catch {
          // Safe no-op
        }
        try {
          options.onEnded?.();
        } catch {
          // Safe no-op
        }
      };

      hissSource.start(now + 0.11);
      lfoOsc.start(speechStartTime);
      voiceSource.start(speechStartTime);
      return true;
    } catch {
      this.cleanupNodes();
      this.playing = false;
      return false;
    }
  }

  private cleanupNodes(): void {
    const nodes = this.activeNodes;
    this.activeNodes = null;
    if (!nodes) return;

    const safeStop = (node: { stop: () => void; disconnect: () => void } | null) => {
      if (!node) return;
      try {
        node.stop();
      } catch {
        // Already stopped
      }
      try {
        node.disconnect();
      } catch {
        // Already disconnected
      }
    };

    if (nodes.voiceSource) {
      nodes.voiceSource.onended = null;
    }
    safeStop(nodes.voiceSource);
    safeStop(nodes.lfoOsc);
    safeStop(nodes.hissSource);

    try {
      nodes.lfoGain?.disconnect();
      nodes.hissGain?.disconnect();
      nodes.masterGain?.disconnect();
    } catch {
      // Safe no-op
    }
  }

  stop(playStopClick = true): void {
    this.playbackToken++;
    const wasPlaying = this.playing;
    this.playing = false;
    this.clearSubtitleTimers();
    this.cleanupNodes();

    if (playStopClick && wasPlaying && this.ctx && !this.muted && this.volume > 0.001) {
      this.triggerMechanicalStopClick(this.ctx, this.volume);
    }

    if (this.activeSubtitleCb) {
      const cb = this.activeSubtitleCb;
      this.activeSubtitleCb = null;
      try {
        cb(null);
      } catch {
        // Safe no-op
      }
    }
  }
}

export const tapeAudioPlayer = new TapeAudioPlayer();
