import type { CutsceneSoundCue, FloorId, GameSettings, SpeakerId, SurfaceType } from './types';

/**
 * Realistic Procedural Web Audio Engine (Zero 8-bit tones / Zero dry square or sawtooth waves).
 * Features:
 * - 4-bus mixer: Master, Ambient/Music, SFX, and Voice/Tapes/Radio with master dynamics compressor
 * - Synthesized Stereo Convolver Reverb (automatically deepened in the Underground Floor)
 * - Pink + White noise generators shaped via resonant BiquadFilterNode chains & WaveShaper saturation
 * - Surface-specific footsteps (concrete, wood, tile, basement_wet, vent_metal) with pitch randomization
 * - 3D Positional P. Drizzy heavy footsteps + metallic chain/keyring jingle + guttural breathing/growl
 * - Realistic tool foley: double-click flashlight, key cylinder + bolt turn, creaking splintering planks,
 *   high-voltage electric arc stun gun, tactile mechanical safe keypad, analog VHS hiss & 60Hz lamp buzz
 */
export class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterComp: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceTapesGain: GainNode | null = null;
  private chaseHeartbeatGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSendGain: GainNode | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private softDriveCurve: Float32Array<ArrayBuffer> | null = null;

  // Adaptive dark ambient & chase nodes (pure filtered noise + organic sub-harmonics)
  private musicStarted = false;
  private droneGain: GainNode | null = null;
  private chaseGain: GainNode | null = null;
  private chaseFilter: BiquadFilterNode | null = null;

  private masterVol = 0.85;
  private musicVol = 0.65;
  private tensionVol = 0.75;
  private sfxVol = 0.9;
  private voiceTapesVol = 0.95;
  private chaseHeartbeatVol = 0.9;
  private soundOcclusionEnabled = true;
  private nightMode = false;
  private muted = false;
  private currentFloor: FloorId = 0;

  private heartbeatAccum = 0;
  private breathAccum = 0;
  private dripAccum = 0;
  private chasePulseAccum = 0;
  private gestureUnlockBound = false;

  private handleDeferredGestureUnlock = (): void => {
    this.removeGestureUnlockListeners();
    this.unlock();
  };

  private bindGestureUnlockListeners(): void {
    if (this.gestureUnlockBound || typeof window === 'undefined') return;
    this.gestureUnlockBound = true;
    window.addEventListener('pointerdown', this.handleDeferredGestureUnlock, { passive: true });
    window.addEventListener('keydown', this.handleDeferredGestureUnlock, { passive: true });
    window.addEventListener('touchstart', this.handleDeferredGestureUnlock, { passive: true });
  }

  private removeGestureUnlockListeners(): void {
    if (!this.gestureUnlockBound || typeof window === 'undefined') return;
    this.gestureUnlockBound = false;
    window.removeEventListener('pointerdown', this.handleDeferredGestureUnlock);
    window.removeEventListener('keydown', this.handleDeferredGestureUnlock);
    window.removeEventListener('touchstart', this.handleDeferredGestureUnlock);
  }

  unlock(): void {
    if (typeof window === 'undefined') return;
    const navActivation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (!this.ctx && navActivation && !navActivation.hasBeenActive) {
      this.bindGestureUnlockListeners();
      return;
    }
    this.removeGestureUnlockListeners();
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -13;
      comp.knee.value = 18;
      comp.ratio.value = 5.5;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      this.masterComp = comp;

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.voiceTapesGain = this.ctx.createGain();
      this.chaseHeartbeatGain = this.ctx.createGain();
      this.reverbSendGain = this.ctx.createGain();
      this.reverbSendGain.gain.value = 0.2;

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.buildImpulseResponse(this.ctx, 1.95, 2.75);

      this.pinkNoiseBuffer = this.buildPinkNoiseBuffer(this.ctx, 2.5);
      this.whiteNoiseBuffer = this.buildWhiteNoiseBuffer(this.ctx, 1.5);
      this.softDriveCurve = this.buildSoftDriveCurve(2.8);

      this.sfxGain.connect(this.masterGain);
      this.sfxGain.connect(this.reverbSendGain);
      this.voiceTapesGain.connect(this.masterGain);
      this.chaseHeartbeatGain.connect(this.masterGain);
      this.reverbSendGain.connect(this.reverbNode);
      this.reverbNode.connect(this.masterGain);

      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);

      this.applyVolumes();
      this.startAdaptiveMusic();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private buildSoftDriveCurve(drive: number): Float32Array<ArrayBuffer> {
    const samples = 512;
    const curve = new Float32Array(new ArrayBuffer(samples * 4));
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * drive);
    }
    return curve;
  }

  private buildPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3 + white * 0.18) * 0.24));
    }
    return buf;
  }

  private buildWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private buildImpulseResponse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * durationSec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        const earlyTap = i === Math.floor(rate * (0.018 + ch * 0.005)) ? 0.45 : 0;
        const white = (Math.random() * 2 - 1) * env;
        lp = lp * 0.74 + white * 0.26;
        data[i] = lp + earlyTap;
      }
    }
    return buf;
  }

  applySettings(settings: GameSettings): void {
    this.masterVol = settings.audio.master;
    this.musicVol = settings.audio.music;
    this.tensionVol = settings.audio.tension ?? 0.75;
    this.sfxVol = settings.audio.sfx;
    this.voiceTapesVol = settings.audio.voiceTapes ?? 0.95;
    this.chaseHeartbeatVol = settings.audio.chaseHeartbeat ?? 0.9;
    this.soundOcclusionEnabled = settings.audio.soundOcclusion ?? true;
    this.nightMode = settings.audio.nightMode ?? false;
    this.muted = settings.audio.muted;
    this.applyVolumes();
  }

  isSoundOcclusionEnabled(): boolean {
    return this.soundOcclusionEnabled;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      !this.musicGain ||
      !this.sfxGain ||
      !this.voiceTapesGain ||
      !this.chaseHeartbeatGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    // Night mode softens peaks via tighter dynamics compression and a gentle master gain cap
    const nightMasterScale = this.nightMode ? 0.76 : 1.0;
    if (this.masterComp) {
      this.masterComp.threshold.setTargetAtTime(this.nightMode ? -24 : -13, now, 0.08);
      this.masterComp.knee.setTargetAtTime(this.nightMode ? 24 : 18, now, 0.08);
      this.masterComp.ratio.setTargetAtTime(this.nightMode ? 10 : 5.5, now, 0.08);
      this.masterComp.attack.setTargetAtTime(this.nightMode ? 0.002 : 0.004, now, 0.08);
      this.masterComp.release.setTargetAtTime(this.nightMode ? 0.24 : 0.16, now, 0.08);
    }
    this.masterGain.gain.setTargetAtTime(
      this.muted ? 0 : this.masterVol * nightMasterScale,
      now,
      0.05
    );
    this.musicGain.gain.setTargetAtTime(this.musicVol * 0.56, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.05);
    this.voiceTapesGain.gain.setTargetAtTime(this.voiceTapesVol, now, 0.05);
    this.chaseHeartbeatGain.gain.setTargetAtTime(this.chaseHeartbeatVol, now, 0.05);
  }

  setFloorAcoustics(floor: FloorId): void {
    if (this.currentFloor === floor) return;
    this.currentFloor = floor;
    if (!this.ctx || !this.reverbSendGain) return;
    // Underground concrete tunnel has deeper cavernous corridor reverb
    const targetWet = floor === -1 ? 0.5 : 0.18;
    this.reverbSendGain.gain.setTargetAtTime(targetWet, this.ctx.currentTime, 0.35);
  }

  private startAdaptiveMusic(): void {
    if (!this.ctx || !this.musicGain || !this.pinkNoiseBuffer || this.musicStarted) return;
    this.musicStarted = true;

    // Layer 1: Realistic industrial air-handling rumble & distant hallway wind (zero sawtooth!)
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.26;

    const airNoise = this.ctx.createBufferSource();
    airNoise.buffer = this.pinkNoiseBuffer;
    airNoise.loop = true;
    const airLp = this.ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.frequency.value = 128;
    airLp.Q.value = 1.4;
    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.55;
    airNoise.connect(airLp);
    airLp.connect(airGain);
    airGain.connect(this.droneGain);
    airNoise.start();

    // Subtle deep sub-bass building hum (pure sine + triangle with gentle LFO drift)
    const subFreqs: [number, OscillatorType, number][] = [
      [41.2, 'sine', 0.22],
      [61.74, 'sine', 0.12],
      [82.41, 'triangle', 0.06],
    ];
    for (const [f, type, amp] of subFreqs) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 135;
      const g = this.ctx.createGain();
      g.gain.value = amp;
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.droneGain);
      osc.start();
    }
    this.droneGain.connect(this.musicGain);

    // Layer 2: Organic tense metallic air pressure & dissonant bowed sub-resonance during pursuit
    this.chaseGain = this.ctx.createGain();
    this.chaseGain.gain.value = 0.0001;
    this.chaseFilter = this.ctx.createBiquadFilter();
    this.chaseFilter.type = 'bandpass';
    this.chaseFilter.frequency.value = 260;
    this.chaseFilter.Q.value = 3.6;

    const chaseNoise = this.ctx.createBufferSource();
    chaseNoise.buffer = this.pinkNoiseBuffer;
    chaseNoise.loop = true;
    const chaseNoiseGain = this.ctx.createGain();
    chaseNoiseGain.gain.value = 0.45;
    chaseNoise.connect(chaseNoiseGain);
    chaseNoiseGain.connect(this.chaseFilter);
    chaseNoise.start();

    for (const f of [55, 58.27, 110]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.18;
      osc.connect(g);
      g.connect(this.chaseFilter);
      osc.start();
    }
    this.chaseFilter.connect(this.chaseGain);
    this.chaseGain.connect(this.chaseHeartbeatGain ?? this.musicGain);
  }

  updateListener(x: number, y: number, z: number, yaw: number): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(x, t, 0.02);
      l.positionY.setTargetAtTime(y + 1.5, t, 0.02);
      l.positionZ.setTargetAtTime(z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(0, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.setTargetAtTime(0, t, 0.02);
      l.upY.setTargetAtTime(1, t, 0.02);
      l.upZ.setTargetAtTime(0, t, 0.02);
    } else if (l.setPosition) {
      l.setPosition(x, y + 1.5, z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  tickAtmosphere(
    dt: number,
    dangerIntensity: number,
    isChased: boolean,
    isHiding: boolean,
    staminaPct: number,
    floor: FloorId,
    isPaused: boolean
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.setFloorAcoustics(floor);

    const now = this.ctx.currentTime;
    if (this.chaseGain && this.chaseFilter && this.droneGain) {
      const tensionScale = Math.max(0, Math.min(1, this.tensionVol));
      const targetChase = isPaused
        ? 0.0001
        : (isChased ? 0.42 : dangerIntensity * 0.22) * tensionScale;
      const targetDrone = isPaused ? 0.08 : floor === -1 ? 0.34 : 0.24;
      this.chaseGain.gain.setTargetAtTime(Math.max(0.0001, targetChase), now, 0.25);
      this.chaseFilter.frequency.setTargetAtTime(220 + dangerIntensity * 460, now, 0.2);
      this.droneGain.gain.setTargetAtTime(targetDrone, now, 0.3);
    }

    if (isPaused) return;

    // Adaptive sub-bass chase pulse
    if (isChased || dangerIntensity > 0.5) {
      this.chasePulseAccum += dt;
      const pulseInterval = isChased ? 0.38 : 0.58;
      if (this.chasePulseAccum >= pulseInterval) {
        this.chasePulseAccum = 0;
        const tensionScale = Math.max(0, Math.min(1, this.tensionVol));
        if (tensionScale > 0.02) {
          this.playChaseDrumHit((isChased ? 0.36 : 0.18) * tensionScale);
        }
      }
    }

    // Dynamic proximity heartbeat (62 BPM -> 148 BPM)
    if (dangerIntensity > 0.16 || isHiding) {
      const level = Math.max(dangerIntensity, isHiding ? 0.28 : 0);
      const bpm = 62 + level * 86;
      this.heartbeatAccum += dt;
      if (this.heartbeatAccum >= 60 / bpm) {
        this.heartbeatAccum = 0;
        this.playHeartbeat(0.15 + level * 0.45);
      }
    }

    // Tense panting breath when hiding near danger or sprinting low on stamina
    if ((isHiding && dangerIntensity > 0.22) || staminaPct < 34) {
      this.breathAccum += dt;
      const interval = isHiding ? 1.5 : 0.98;
      if (this.breathAccum >= interval) {
        this.breathAccum = 0;
        this.playPantingBreath(isHiding ? 0.17 + dangerIntensity * 0.22 : 0.2);
      }
    }

    // Subterranean damp water drips
    if (floor === -1) {
      this.dripAccum += dt;
      if (this.dripAccum >= 2.6 + Math.random() * 3.4) {
        this.dripAccum = 0;
        this.playBasementWaterDrip();
      }
    }
  }

  private playChaseDrumHit(vol: number): void {
    const outBus = this.chaseHeartbeatGain ?? this.musicGain;
    if (!this.ctx || !outBus || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(84, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(outBus);
    osc.start(t);
    osc.stop(t + 0.26);

    const thudNoise = this.ctx.createBufferSource();
    thudNoise.buffer = this.pinkNoiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.45, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    thudNoise.connect(lp);
    lp.connect(ng);
    ng.connect(outBus);
    thudNoise.start(t, Math.random(), 0.16);
  }

  private playHeartbeat(vol: number): void {
    const outBus = this.chaseHeartbeatGain ?? this.sfxGain;
    if (!this.ctx || !outBus) return;
    const t = this.ctx.currentTime;
    const thump = (offset: number, freqStart: number, amp: number) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, t + offset);
      osc.frequency.exponentialRampToValueAtTime(26, t + offset + 0.14);
      g.gain.setValueAtTime(0.001, t + offset);
      g.gain.linearRampToValueAtTime(amp, t + offset + 0.016);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.16);
      osc.connect(g);
      g.connect(outBus);
      osc.start(t + offset);
      osc.stop(t + offset + 0.18);
    };
    thump(0, 56, vol);
    thump(0.155, 46, vol * 0.72);
  }

  private playPantingBreath(vol: number): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(760 + Math.random() * 80, t);
    filter.frequency.linearRampToValueAtTime(430, t + 0.34);
    filter.Q.value = 2.9;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 1.1, 0.42);
  }

  private playBasementWaterDrip(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const baseF = 1120 + Math.random() * 520;
    bp.frequency.setValueAtTime(baseF, t);
    bp.frequency.exponentialRampToValueAtTime(baseF * 1.5, t + 0.042);
    bp.Q.value = 15;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random(), 0.1);
  }

  /**
   * 60Hz/120Hz Fluorescent Lamp Flicker Buzz synced to flickering ceiling lights.
   */
  playFluorescentFlickerBuzz(distance: number): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer || distance > 14) return;
    const t = this.ctx.currentTime;
    const atten = Math.max(0.04, 1 - distance / 14);

    // 120Hz ballast hum
    const hum = this.ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 120;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.055 * atten, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    hum.connect(hg);
    hg.connect(this.sfxGain);
    hum.start(t);
    hum.stop(t + 0.13);

    // Subtle starter crackle
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 3.5;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.085 * atten, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.sfxGain);
    src.start(t, Math.random() * 0.8, 0.06);
  }

  playPlayerFootstep(surface: SurfaceType, sprinting: boolean, crouching: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const vol = crouching ? 0.085 : sprinting ? 0.36 : 0.21;
    const pitchVar = 0.88 + Math.random() * 0.24;

    // Layer A: Surface grit / splash / metallic scrape
    const src = this.ctx.createBufferSource();
    src.buffer = surface === 'basement_wet' || surface === 'tile' ? this.whiteNoiseBuffer : this.pinkNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    if (surface === 'vent_metal') {
      filter.type = 'bandpass';
      filter.frequency.value = 640 * pitchVar;
      filter.Q.value = 6.2;
    } else if (surface === 'wood') {
      filter.type = 'bandpass';
      filter.frequency.value = 230 * pitchVar;
      filter.Q.value = 2.4;
    } else if (surface === 'basement_wet') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1650 * pitchVar, t);
      filter.frequency.exponentialRampToValueAtTime(740 * pitchVar, t + 0.11);
      filter.Q.value = 1.5;
    } else if (surface === 'tile') {
      filter.type = 'bandpass';
      filter.frequency.value = 1120 * pitchVar;
      filter.Q.value = 2.6;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 560 * pitchVar;
    }

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(surface === 'vent_metal' ? vol * 1.4 : vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(
      0.001,
      t + (surface === 'vent_metal' ? 0.21 : surface === 'basement_wet' ? 0.15 : 0.095)
    );

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.9, 0.22);

    // Layer B: Low physical heel weight thump (gives footsteps authentic boot weight)
    if (!crouching) {
      const thump = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      thump.type = 'sine';
      const baseHz = surface === 'vent_metal' ? 148 : surface === 'wood' ? 96 : 74;
      thump.frequency.setValueAtTime(baseHz * pitchVar, t);
      thump.frequency.exponentialRampToValueAtTime(38, t + 0.07);
      tg.gain.setValueAtTime(vol * (surface === 'vent_metal' ? 0.55 : 0.36), t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      thump.connect(tg);
      tg.connect(this.sfxGain);
      thump.start(t);
      thump.stop(t + 0.095);
    }
  }

  /**
   * 3D Positional Heavy Footsteps for P. Drizzy (Sujeito 09):
   * Deep seismic boot impact + concrete grit + dangling metallic belt chain / keyring jingle!
   */
  playDiddyFootstep3D(
    dx: number,
    dy: number,
    dz: number,
    sameFloor: boolean,
    isChasing: boolean,
    occludeCutoffHz?: number
  ): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.6;
    panner.maxDistance = 38;
    panner.rolloffFactor = 1.3;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(dx, t);
      panner.positionY.setValueAtTime(dy + 0.35, t);
      panner.positionZ.setValueAtTime(dz, t);
    } else if (panner.setPosition) {
      panner.setPosition(dx, dy + 0.35, dz);
    }

    const occlude = this.ctx.createBiquadFilter();
    occlude.type = 'lowpass';
    const fallbackHz = !this.soundOcclusionEnabled
      ? sameFloor ? 16000 : 2800
      : sameFloor
      ? isChasing ? 2400 : 1450
      : 340;
    occlude.frequency.value = occludeCutoffHz ?? fallbackHz;

    // 1. Sub-bass heavy boot impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    const baseFreq = (isChasing ? 88 : 74) * (0.93 + Math.random() * 0.14);
    sub.frequency.setValueAtTime(baseFreq, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.18);
    subGain.gain.setValueAtTime(isChasing ? 0.84 : 0.6, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
    sub.connect(subGain);
    subGain.connect(occlude);

    // 2. Heavy boot sole grit
    const grit = this.ctx.createBufferSource();
    grit.buffer = this.pinkNoiseBuffer;
    const gritFilter = this.ctx.createBiquadFilter();
    gritFilter.type = 'bandpass';
    gritFilter.frequency.value = 320;
    gritFilter.Q.value = 1.4;
    const gritGain = this.ctx.createGain();
    gritGain.gain.setValueAtTime(isChasing ? 0.44 : 0.26, t);
    gritGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    grit.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(occlude);

    // 3. Signature P. Drizzy metallic belt chain & heavy foreman keyring jingle!
    if (sameFloor) {
      const chainSrc = this.ctx.createBufferSource();
      chainSrc.buffer = this.whiteNoiseBuffer;
      const chainBp = this.ctx.createBiquadFilter();
      chainBp.type = 'bandpass';
      chainBp.frequency.value = 4200 + Math.random() * 1400;
      chainBp.Q.value = 9.5;
      const chainG = this.ctx.createGain();
      chainG.gain.setValueAtTime(0.001, t + 0.03);
      chainG.gain.linearRampToValueAtTime(isChasing ? 0.22 : 0.13, t + 0.045);
      chainG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      chainSrc.connect(chainBp);
      chainBp.connect(chainG);
      chainG.connect(occlude);
      chainSrc.start(t + 0.03, Math.random() * 0.7, 0.14);
    }

    occlude.connect(panner);
    panner.connect(this.sfxGain);

    sub.start(t);
    sub.stop(t + 0.22);
    grit.start(t, Math.random(), 0.16);
  }

  /**
   * 3D Positional Distorted Guttural Growl / Heavy Breathing for P. Drizzy.
   */
  playDrizzyGrowl3D(
    dx: number,
    dy: number,
    dz: number,
    sameFloor: boolean,
    intensity = 0.85,
    occludeCutoffHz?: number
  ): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer || !this.softDriveCurve) return;
    const t = this.ctx.currentTime;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3.0;
    panner.maxDistance = 36;
    panner.rolloffFactor = 1.2;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(dx, t);
      panner.positionY.setValueAtTime(dy + 1.75, t);
      panner.positionZ.setValueAtTime(dz, t);
    } else if (panner.setPosition) {
      panner.setPosition(dx, dy + 1.75, dz);
    }

    // Formant-filtered raspy breath + low throat growl saturated smoothly
    const breath = this.ctx.createBufferSource();
    breath.buffer = this.pinkNoiseBuffer;
    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(240, t);
    formant.frequency.linearRampToValueAtTime(165, t + 0.65);
    formant.Q.value = 3.2;

    const throat = this.ctx.createOscillator();
    throat.type = 'triangle';
    throat.frequency.setValueAtTime(68 + Math.random() * 12, t);
    throat.frequency.exponentialRampToValueAtTime(44, t + 0.62);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.softDriveCurve;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const rawCut = occludeCutoffHz ?? (sameFloor ? 680 : 260);
    lp.frequency.value = Math.min(920, rawCut);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.32 * intensity, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

    breath.connect(formant);
    formant.connect(shaper);
    throat.connect(shaper);
    shaper.connect(lp);
    lp.connect(g);
    g.connect(panner);
    panner.connect(this.sfxGain);

    breath.start(t, Math.random() * 0.8, 0.75);
    throat.start(t);
    throat.stop(t + 0.75);
  }

  /**
   * Metallic key jingle when collecting keys or handling keychain items.
   */
  playKeyJingle(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const partials = [2720, 3510, 4860, 5890, 6720];
    partials.forEach((freq, idx) => {
      const start = t + idx * 0.024;
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * (0.96 + Math.random() * 0.08), start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.095 / (1 + idx * 0.18), start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, start + 0.21);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  /**
   * Realistic metallic key insertion + pin tumblers + heavy deadbolt unlocking!
   */
  playKeyLockTurn(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const clicks: [number, number, number][] = [
      [0.0, 2600, 0.22], // Key enters cylinder
      [0.085, 3150, 0.24], // Tumbler pins set
      [0.16, 1380, 0.34], // Heavy lock bolt slides open
    ];
    for (const [off, freq, amp] of clicks) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 6.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(amp, t + off);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.048);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(t + off, Math.random() * 0.5, 0.055);
    }
    // Mechanical deadbolt body thud
    const bolt = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    bolt.type = 'sine';
    bolt.frequency.setValueAtTime(165, t + 0.16);
    bolt.frequency.exponentialRampToValueAtTime(52, t + 0.27);
    bg.gain.setValueAtTime(0.32, t + 0.16);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.29);
    bolt.connect(bg);
    bg.connect(this.sfxGain);
    bolt.start(t + 0.16);
    bolt.stop(t + 0.3);
  }

  /**
   * Realistic rusted door hinge creak using resonant filtered noise + low wood/metal body (ZERO sawtooth!).
   * Supports quiet crouched opening (softer, slower, muffled).
   */
  playDoorCreak(heavyIron = false, quiet = false): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const volScale = quiet ? 0.36 : 1.0;

    // Resonant metallic/wooden friction band
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(heavyIron ? 340 : 620, t);
    bp.frequency.linearRampToValueAtTime(heavyIron ? 260 : 480, t + 0.28);
    bp.frequency.linearRampToValueAtTime(heavyIron ? 390 : 710, t + 0.56);
    bp.Q.value = heavyIron ? 12 : 16;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.38 * volScale, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + (quiet ? 0.48 : 0.62));

    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.8, 0.66);

    // Subtle latch click at start
    const latch = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    latch.type = 'sine';
    latch.frequency.setValueAtTime(heavyIron ? 125 : 180, t);
    latch.frequency.exponentialRampToValueAtTime(48, t + 0.07);
    lg.gain.setValueAtTime(0.24 * volScale, t);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    latch.connect(lg);
    lg.connect(this.sfxGain);
    latch.start(t);
    latch.stop(t + 0.095);
  }

  playLockedRattle(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.11;
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 980 + i * 210;
      bp.Q.value = 5.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.28, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.075);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(start, Math.random() * 0.5, 0.09);
    }
  }

  /**
   * Heavy crowbar wood strain creak + layered snapping splinters!
   */
  playWoodSplinter(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;

    // 1. Strained wood pry groan
    const groan = this.ctx.createBufferSource();
    groan.buffer = this.pinkNoiseBuffer;
    const gbp = this.ctx.createBiquadFilter();
    gbp.type = 'bandpass';
    gbp.frequency.setValueAtTime(280, t);
    gbp.frequency.linearRampToValueAtTime(520, t + 0.14);
    gbp.Q.value = 9.0;
    const gg = this.ctx.createGain();
    gg.gain.setValueAtTime(0.001, t);
    gg.gain.linearRampToValueAtTime(0.42, t + 0.04);
    gg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    groan.connect(gbp);
    gbp.connect(gg);
    gg.connect(this.sfxGain);
    groan.start(t, 0.1, 0.2);

    // 2. Sharp wood fiber snaps + nail rip
    for (let i = 0; i < 4; i++) {
      const s = t + 0.07 + i * 0.055;
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 720 + i * 380;
      bp.Q.value = 2.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.46 / (1 + i * 0.18), s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(s, Math.random() * 0.6, 0.13);
    }
  }

  playDroppedObjectCrash(kind: 'bottles' | 'tin_cans'): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const s = t + i * 0.052;
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = kind === 'bottles' ? 'highpass' : 'bandpass';
      hp.frequency.value = kind === 'bottles' ? 2500 + i * 380 : 1220 + i * 260;
      hp.Q.value = kind === 'bottles' ? 1.2 : 4.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.36 / (1 + i * 0.34), s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.15);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.sfxGain);
      src.start(s, Math.random() * 0.6, 0.17);
    }
  }

  /**
   * Realistic Double Mechanical Click on the tactical flashlight thumb switch!
   */
  playFlashlightClick(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const clicks: [number, number, number][] = [
      [0.0, 2150, 0.25], // Push thumb button down
      [0.028, 3180, 0.22], // Spring latch snaps into place
    ];
    for (const [off, freq, amp] of clicks) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 6.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(amp, t + off);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.019);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(t + off, Math.random() * 0.4, 0.025);
    }
  }

  /**
   * Physical tactile safe keypad switch clicks (ZERO high-pitched retro beeps!).
   */
  playKeypadPress(isError = false, isSuccess = false): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;

    // Physical tactile key switch clack
    const click = this.ctx.createBufferSource();
    click.buffer = this.whiteNoiseBuffer;
    const cf = this.ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 1650 + Math.random() * 220;
    cf.Q.value = 5.5;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.24, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    click.connect(cf);
    cf.connect(cg);
    cg.connect(this.sfxGain);
    click.start(t, Math.random() * 0.4, 0.025);

    if (isError) {
      // Muted mechanical lock-jam double thud (no annoying buzzer!)
      for (let i = 0; i < 2; i++) {
        const s = t + 0.03 + i * 0.095;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(118, s);
        osc.frequency.exponentialRampToValueAtTime(54, s + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.26, s);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(s);
        osc.stop(s + 0.1);
      }
    } else if (isSuccess) {
      this.playKeyLockTurn();
      this.playDoorCreak(true);
    }
  }

  /**
   * Organic speech-cadence foley tick (analog radio squelch, low throat rumble, or hushed breath/typewriter tap — ZERO 8-bit beep!).
   */
  playDialogueBlip(speaker: SpeakerId): void {
    if (!this.ctx || !this.voiceTapesGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    if (speaker === 'radio') {
      bp.frequency.value = 1520 + Math.random() * 280;
      bp.Q.value = 4.2;
    } else if (speaker === 'diddy') {
      bp.frequency.value = 145 + Math.random() * 45;
      bp.Q.value = 5.5;
    } else {
      // Soft breathy vocal formant pulse
      bp.frequency.value = 480 + Math.random() * 140;
      bp.Q.value = 3.2;
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(speaker === 'diddy' ? 0.095 : 0.055, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.voiceTapesGain);
    src.start(t, Math.random() * 0.9, 0.062);
  }

  playSpottedSting(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer || !this.softDriveCurve) return;
    const t = this.ctx.currentTime;
    // Cinematic bowed metallic scrape + sub impact (zero retro sawtooth!)
    const scrape = this.ctx.createBufferSource();
    scrape.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, t);
    bp.frequency.exponentialRampToValueAtTime(1420, t + 0.25);
    bp.frequency.exponentialRampToValueAtTime(340, t + 0.72);
    bp.Q.value = 9.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.46, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.76);
    scrape.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    scrape.start(t, 0.2, 0.8);

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(98, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.52);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.55, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.56);
    sub.connect(sg);
    sg.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.58);
  }

  playFlareIgnite(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1900, t);
    hp.frequency.exponentialRampToValueAtTime(3400, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, 0, 0.7);
  }

  playJumpscareImpact(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer || !this.softDriveCurve) return;
    const t = this.ctx.currentTime;

    // 1. Massive chest-rattling sub-bass slam
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(128, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.68);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.95, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    sub.connect(sg);
    sg.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.82);

    // 2. Saturated guttural horror roar (pink noise + low triangles through WaveShaper)
    const roarNoise = this.ctx.createBufferSource();
    roarNoise.buffer = this.pinkNoiseBuffer;
    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(620, t);
    formant.frequency.exponentialRampToValueAtTime(260, t + 0.7);
    formant.Q.value = 2.2;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.softDriveCurve;
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.75, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.78);
    roarNoise.connect(formant);
    formant.connect(shaper);
    shaper.connect(rg);
    rg.connect(this.sfxGain);
    roarNoise.start(t, 0, 0.82);

    // 3. Sharp metallic crash transient
    const crash = this.ctx.createBufferSource();
    crash.buffer = this.whiteNoiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.55, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    crash.connect(hp);
    hp.connect(cg);
    cg.connect(this.sfxGain);
    crash.start(t, 0, 0.4);
  }

  playEscapeReliefChord(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const freqs = [146.83, 220, 293.66, 369.99];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.7);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 2.8);
    }
  }

  /**
   * Realistic High-Voltage Electric Arc Stun Gun Discharge (ZERO sawtooth!).
   */
  playStunGunFire(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer || !this.softDriveCurve) return;
    const t = this.ctx.currentTime;

    // 1. Rapid electric arc sparks across electrodes (6 high-voltage crackle pulses)
    for (let i = 0; i < 6; i++) {
      const s = t + i * 0.032;
      const arc = this.ctx.createBufferSource();
      arc.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3200 + (i % 3) * 1100;
      bp.Q.value = 2.6;
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.softDriveCurve;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.42, s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.028);
      arc.connect(bp);
      bp.connect(shaper);
      shaper.connect(g);
      g.connect(this.sfxGain);
      arc.start(s, Math.random() * 0.5, 0.032);
    }

    // 2. 120Hz AC transformer discharge buzz + capacitor snap
    const hum = this.ctx.createOscillator();
    hum.type = 'triangle';
    hum.frequency.setValueAtTime(120, t);
    hum.frequency.exponentialRampToValueAtTime(60, t + 0.22);
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.32, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    hum.connect(hg);
    hg.connect(this.sfxGain);
    hum.start(t);
    hum.stop(t + 0.25);
  }

  playUvToggle(on: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    this.playFlashlightClick();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(on ? 320 : 620, t + 0.02);
    osc.frequency.exponentialRampToValueAtTime(on ? 680 : 260, t + 0.13);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.075, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t + 0.02);
    osc.stop(t + 0.16);
  }

  playRechargeHum(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.65);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  playBlackoutPowerDown(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    // Heavy industrial breaker trip + turbine spin-down (pure triangle + noise)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 1.15);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 1.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 1.28);
  }

  playPowerRestore(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(48, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.85);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.96);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.98);
  }

  playCctvStatic(): void {
    if (!this.ctx || !this.voiceTapesGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1850;
    bp.Q.value = 1.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.voiceTapesGain);
    src.start(t, Math.random() * 0.6, 0.16);
  }

  playBunkerBlastDoor(closing: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(closing ? 124 : 90, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.25);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.64, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    sub.connect(sg);
    sg.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.3);

    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = closing ? 740 : 1240;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.32, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    hiss.connect(bp);
    bp.connect(hg);
    hg.connect(this.sfxGain);
    hiss.start(t, Math.random(), 0.24);
  }

  playWorkbenchCraft(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.14;
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1480 + i * 420;
      bp.Q.value = 7.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.32, s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(s, Math.random() * 0.5, 0.12);
    }
  }

  /**
   * Realistic Analog VHS Deck Latch Clunk + Warm Magnetic Tape Hiss routed to Voice/Tapes bus.
   */
  playCassettePlay(): void {
    if (!this.ctx || !this.voiceTapesGain || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;

    // 1. Mechanical plastic deck button clunk
    const clunk = this.ctx.createBufferSource();
    clunk.buffer = this.whiteNoiseBuffer;
    const cbp = this.ctx.createBiquadFilter();
    cbp.type = 'bandpass';
    cbp.frequency.value = 920;
    cbp.Q.value = 4.5;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.34, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    clunk.connect(cbp);
    cbp.connect(cg);
    cg.connect(this.voiceTapesGain);
    clunk.start(t, 0.1, 0.05);

    // 2. Warm analog tape hiss + gentle capstan motor settle
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.pinkNoiseBuffer;
    const hbp = this.ctx.createBiquadFilter();
    hbp.type = 'bandpass';
    hbp.frequency.value = 2150;
    hbp.Q.value = 1.6;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.001, t + 0.05);
    hg.gain.linearRampToValueAtTime(0.18, t + 0.14);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    hiss.connect(hbp);
    hbp.connect(hg);
    hg.connect(this.voiceTapesGain);
    hiss.start(t + 0.05, 0.25, 0.65);
  }

  /**
   * Cutscene cinematic sound cues (fence vault, remote gate slam, radio static, hatch hum).
   */
  playCutsceneCue(cue: CutsceneSoundCue): void {
    if (!this.ctx || !this.sfxGain || !this.voiceTapesGain || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    if (cue === 'fence_vault') {
      // Metallic chainlink rattle + heavy boot landing thud
      const rattle = this.ctx.createBufferSource();
      rattle.buffer = this.whiteNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2800;
      bp.Q.value = 5.0;
      const rg = this.ctx.createGain();
      rg.gain.setValueAtTime(0.24, t);
      rg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      rattle.connect(bp);
      bp.connect(rg);
      rg.connect(this.sfxGain);
      rattle.start(t, 0.1, 0.26);
      this.playPlayerFootstep('stone', true, false);
    } else if (cue === 'gate_slam') {
      this.playBunkerBlastDoor(true);
    } else if (cue === 'radio_static') {
      this.playCctvStatic();
      this.playCassettePlay();
    } else if (cue === 'drizzy_growl') {
      this.playDrizzyGrowl3D(0, 0, -6, true, 0.9);
    } else if (cue === 'door_open') {
      this.playKeyLockTurn();
      this.playDoorCreak(true);
    } else if (cue === 'hatch_hum') {
      const hum = this.ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.setValueAtTime(52, t);
      hum.frequency.linearRampToValueAtTime(42, t + 1.4);
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.001, t);
      hg.gain.linearRampToValueAtTime(0.28, t + 0.35);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      hum.connect(hg);
      hg.connect(this.sfxGain);
      hum.start(t);
      hum.stop(t + 1.55);
    }
  }

  playThrowWhoosh(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(1180, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, 0.1, 0.18);
  }

  playDrawerSlide(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 440;
    bp.Q.value = 2.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, 0.4, 0.24);
  }

  playItemDrop(isMetal = true): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = isMetal ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isMetal ? 480 : 140, t);
    osc.frequency.exponentialRampToValueAtTime(isMetal ? 175 : 48, t + 0.11);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);

    if (isMetal) {
      const clink = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      clink.type = 'sine';
      clink.frequency.setValueAtTime(2200 + Math.random() * 440, t + 0.03);
      cg.gain.setValueAtTime(0.11, t + 0.03);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      clink.connect(cg);
      cg.connect(this.sfxGain);
      clink.start(t + 0.03);
      clink.stop(t + 0.17);
    }
  }

  playWaterDrip(pan = 0, distance = 6): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    if (distance > 18) return;
    const t = this.ctx.currentTime;
    const atten = Math.max(0.05, Math.min(1, 1 - distance / 18));
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const baseF = 1220 + Math.random() * 480;
    bp.frequency.setValueAtTime(baseF, t);
    bp.frequency.exponentialRampToValueAtTime(baseF * 1.5, t + 0.045);
    bp.Q.value = 15;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.26 * atten, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    src.connect(bp);
    bp.connect(g);
    if (typeof this.ctx.createStereoPanner === 'function') {
      const sp = this.ctx.createStereoPanner();
      sp.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      g.connect(sp);
      sp.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    src.start(t, Math.random(), 0.1);
  }

  /**
   * Layered realistic water splash & wet boot squelch (varies cleanly between walk and sprint!).
   */
  playWaterSplash(intensity = 1.0, isRunning = false): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0.25, Math.min(1.5, intensity));

    // 1. High-frequency liquid spray burst
    const spray = this.ctx.createBufferSource();
    spray.buffer = this.whiteNoiseBuffer;
    const sbp = this.ctx.createBiquadFilter();
    sbp.type = 'bandpass';
    sbp.frequency.setValueAtTime(isRunning ? 2600 : 1850, t);
    sbp.frequency.exponentialRampToValueAtTime(isRunning ? 920 : 680, t + (isRunning ? 0.24 : 0.16));
    sbp.Q.value = 1.6;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime((isRunning ? 0.34 : 0.19) * clamped, t + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.001, t + (isRunning ? 0.27 : 0.18));
    spray.connect(sbp);
    sbp.connect(sg);
    sg.connect(this.sfxGain);
    spray.start(t, Math.random() * 0.8, 0.3);

    // 2. Low-mid watery cavity slosh / boot squelch
    const slosh = this.ctx.createBufferSource();
    slosh.buffer = this.pinkNoiseBuffer;
    const lbp = this.ctx.createBiquadFilter();
    lbp.type = 'bandpass';
    lbp.frequency.setValueAtTime(420 + Math.random() * 120, t + 0.02);
    lbp.frequency.exponentialRampToValueAtTime(980, t + 0.12);
    lbp.Q.value = 4.2;
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(0.001, t + 0.015);
    lg.gain.linearRampToValueAtTime((isRunning ? 0.26 : 0.16) * clamped, t + 0.04);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    slosh.connect(lbp);
    lbp.connect(lg);
    lg.connect(this.sfxGain);
    slosh.start(t + 0.015, Math.random() * 0.7, 0.22);
  }

  /** Pyrotechnic chemical flare ignition & fizzing hiss */
  playFlareHiss(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(3400, t);
    hp.frequency.linearRampToValueAtTime(2200, t + 0.9);
    hp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.4, 1.0);
  }

  /** Explosive pyrotechnic flare pop & shockwave flash (lures & blinds P. Drizzy!) */
  playFlareDetonation(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;

    // 1. Sub-bass concussive thump
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(145, t);
    boom.frequency.exponentialRampToValueAtTime(34, t + 0.36);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.68, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    boom.connect(bg);
    bg.connect(this.sfxGain);
    boom.start(t);
    boom.stop(t + 0.45);

    // 2. Crackling shockwave blast noise
    const blast = this.ctx.createBufferSource();
    blast.buffer = this.whiteNoiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.65);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.54, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    blast.connect(lp);
    lp.connect(ng);
    ng.connect(this.sfxGain);
    blast.start(t, 0.05, 0.72);
  }

  /** Muffled inhale/exhale breathing foley for the Hold-Breath Hiding Minigame */
  playHoldBreathCycle(inhaling: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(inhaling ? 620 : 480, t);
    bp.frequency.linearRampToValueAtTime(inhaling ? 920 : 320, t + 0.38);
    bp.Q.value = 3.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.7, 0.45);
  }

  /** Heavy exhausted panting when stamina hits zero */
  playExhaustedPant(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.32;
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(i === 0 ? 780 : 540, start);
      bp.frequency.exponentialRampToValueAtTime(340, start + 0.22);
      bp.Q.value = 2.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.24, start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(start, Math.random() * 0.6, 0.27);
    }
  }

  /** Crisp heavy industrial breaker / wall light switch mechanical snap */
  playWallSwitchClick(on: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const snap = this.ctx.createBufferSource();
    snap.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = on ? 2400 : 1650;
    bp.Q.value = 5.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
    snap.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    snap.start(t, 0.1, 0.05);

    if (on) {
      // Brief fluorescent ballast strike hum
      const ballast = this.ctx.createOscillator();
      ballast.type = 'sine';
      ballast.frequency.setValueAtTime(120, t + 0.03);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.001, t + 0.03);
      bg.gain.linearRampToValueAtTime(0.075, t + 0.07);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      ballast.connect(bg);
      bg.connect(this.sfxGain);
      ballast.start(t + 0.03);
      ballast.stop(t + 0.3);
    }
  }

  /** Subtle plaster ceiling dust rumble when P. Drizzy stomps heavily nearby */
  playCeilingDustRumble(distance: number): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    if (distance > 12) return;
    const t = this.ctx.currentTime;
    const atten = Math.max(0.08, 1 - distance / 12);
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18 * atten, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.6, 0.35);
  }

  /** Tactile mechanical folder/paper rustle when UV clue is auto-logged to Journal */
  playJournalClueSaved(): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const paper = this.ctx.createBufferSource();
    paper.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1900, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.14);
    bp.Q.value = 2.4;
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.001, t);
    pg.gain.linearRampToValueAtTime(0.19, t + 0.025);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    paper.connect(bp);
    bp.connect(pg);
    pg.connect(this.sfxGain);
    paper.start(t, Math.random() * 0.5, 0.2);
  }

  /** Soft mechanical tactile UI switch click (ZERO synthetic beep) */
  playUiClick(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 4.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, 0.05, 0.035);
  }

  /** Subtle organic atmospheric tension event: distant pressurized steam hiss */
  playDistantPipeSteam(pan = 0): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, t);
    bp.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
    bp.Q.value = 2.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    src.connect(bp);
    bp.connect(g);
    if (typeof this.ctx.createStereoPanner === 'function') {
      const sp = this.ctx.createStereoPanner();
      sp.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      g.connect(sp);
      sp.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    src.start(t, Math.random() * 0.4, 1.0);
  }

  /** Subtle atmospheric tension event: distant corridor draft door creak */
  playDistantWindDoorCreak(pan = 0): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.linearRampToValueAtTime(290, t + 0.45);
    bp.frequency.linearRampToValueAtTime(380, t + 0.85);
    bp.Q.value = 14;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(bp);
    bp.connect(g);
    if (typeof this.ctx.createStereoPanner === 'function') {
      const sp = this.ctx.createStereoPanner();
      sp.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      g.connect(sp);
      sp.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    src.start(t, Math.random() * 0.6, 0.95);
  }

  /** Soft mechanical wall-clock tick when player is nearby */
  playClockTick(distance: number): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer || distance > 8.5) return;
    const t = this.ctx.currentTime;
    const atten = Math.max(0.04, 1 - distance / 8.5);
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 8.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07 * atten, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, 0.05, 0.02);
  }

  /** Brief electromagnetic static crackle when P. Drizzy disrupts flashlight/monitors */
  playEmiStaticBurst(intensity = 0.6): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 900;
    bp.Q.value = 2.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08 * Math.max(0.2, Math.min(1, intensity)), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.5, 0.09);
  }

  /** Crisp electric fuse snap + miniature arc when installing fuse into generator */
  playFuseSnapSpark(): void {
    if (!this.ctx || !this.sfxGain || !this.whiteNoiseBuffer) return;
    this.playWallSwitchClick(true);
    const t = this.ctx.currentTime + 0.04;
    const spark = this.ctx.createBufferSource();
    spark.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4400;
    bp.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    spark.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    spark.start(t, Math.random() * 0.4, 0.1);
  }

  /** Short filtered noise squelch burst for voice dubbing radio transmissions */
  playRadioStaticCue(): void {
    const outBus = this.voiceTapesGain ?? this.sfxGain;
    if (!this.ctx || !outBus || !this.whiteNoiseBuffer) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1950, t);
    bp.frequency.exponentialRampToValueAtTime(2450, t + 0.075);
    bp.Q.value = 3.6;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    src.connect(bp);
    bp.connect(g);
    g.connect(outBus);
    src.start(t, Math.random() * 0.4, 0.12);
  }

  dispose(): void {
    this.removeGestureUnlockListeners();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterComp = null;
    this.musicStarted = false;
  }
}
