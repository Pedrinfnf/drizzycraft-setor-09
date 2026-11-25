import { compute3DProximityDistance } from '../game/ai';

export interface VoiceSignalPayload {
  kind: 'offer' | 'answer' | 'ice';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface SpatialVoicePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface SpatialVoiceParams {
  gain: number;
  pan: number;
  distance: number;
  audible: boolean;
}

export const VOICE_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const VOICE_FULL_GAIN_DIST = 4.0;
export const VOICE_MAX_HEAR_DIST = 22.0;

/**
 * Computes real 3D floor-aware spatial audio attenuation & stereo pan for Proximity Voice Chat:
 * - 100% volume (gain = 1.0) up to 4.0m on the same floor
 * - Smooth linear/cosine falloff between 4.0m and 22.0m (respecting vertical floor separation Y)
 * - Completely muted (gain = 0.0) beyond 22.0m
 */
export function computeVoiceSpatialParams(
  listener: SpatialVoicePose,
  speaker: { x: number; y: number; z: number }
): SpatialVoiceParams {
  const distance = compute3DProximityDistance(
    listener.x,
    listener.y,
    listener.z,
    speaker.x,
    speaker.y,
    speaker.z
  );

  if (distance >= VOICE_MAX_HEAR_DIST) {
    return { gain: 0, pan: 0, distance, audible: false };
  }

  let gain = 1.0;
  if (distance > VOICE_FULL_GAIN_DIST) {
    const t = (distance - VOICE_FULL_GAIN_DIST) / (VOICE_MAX_HEAR_DIST - VOICE_FULL_GAIN_DIST);
    const clamped = Math.max(0, Math.min(1, t));
    // Smooth cosine rolloff
    gain = 0.5 * (1 + Math.cos(Math.PI * clamped));
  }

  // Extra floor muffle when separated vertically (|dy| >= 2.2m)
  if (Math.abs(listener.y - speaker.y) >= 2.2) {
    gain *= 0.55;
  }

  // Stereo pan relative to listener right vector
  const dx = speaker.x - listener.x;
  const dz = speaker.z - listener.z;
  const horiz = Math.hypot(dx, dz);
  let pan = 0;
  if (horiz > 0.05) {
    const rightX = Math.cos(listener.yaw);
    const rightZ = -Math.sin(listener.yaw);
    pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / horiz));
  }

  return {
    gain: Math.max(0, Math.min(1, gain)),
    pan,
    distance,
    audible: gain > 0.005,
  };
}

interface PeerVoiceChannel {
  peerId: string;
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  gainNode: GainNode | null;
  pannerNode: StereoPannerNode | null;
  remoteStream: MediaStream | null;
  mutedByUser: boolean;
}

/**
 * Real WebRTC Mesh Proximity Voice Chat with STUN + WSS Signaling + Web Audio Spatializer.
 * Uses echoCancellation + noiseSuppression and GainNode + StereoPannerNode attenuation.
 */
export class ProximityVoiceManager {
  private audioCtx: AudioContext | null = null;
  private localStream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localRmsBuf: Float32Array<ArrayBuffer> | null = null;
  private peers = new Map<string, PeerVoiceChannel>();
  private mutedPeers = new Set<string>();

  private micEnabled = false;
  private active = false;
  private localPeerId = '';
  private onSendSignal: ((targetPeerId: string, signal: VoiceSignalPayload) => void) | null = null;

  public isActive(): boolean {
    return this.active;
  }

  public isMicEnabled(): boolean {
    return this.micEnabled && this.localStream !== null;
  }

  public isPeerMuted(peerId: string): boolean {
    return this.mutedPeers.has(peerId);
  }

  public setPeerMuted(peerId: string, muted: boolean): void {
    if (muted) this.mutedPeers.add(peerId);
    else this.mutedPeers.delete(peerId);
    const ch = this.peers.get(peerId);
    if (ch) {
      ch.mutedByUser = muted;
      if (muted && ch.gainNode) {
        ch.gainNode.gain.value = 0;
      }
    }
  }

  public async start(
    localPeerId: string,
    onSendSignal: (targetPeerId: string, signal: VoiceSignalPayload) => void,
    enableMicImmediately = false
  ): Promise<boolean> {
    this.localPeerId = localPeerId;
    this.onSendSignal = onSendSignal;
    this.active = true;

    if (typeof window !== 'undefined' && !this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }

    if (enableMicImmediately) {
      return this.setMicEnabled(true);
    }
    return true;
  }

  public async setMicEnabled(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      this.micEnabled = false;
      if (this.localStream) {
        for (const tr of this.localStream.getAudioTracks()) {
          tr.enabled = false;
        }
      }
      return true;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => undefined);
      }

      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (this.audioCtx) {
          const src = this.audioCtx.createMediaStreamSource(this.localStream);
          this.localAnalyser = this.audioCtx.createAnalyser();
          this.localAnalyser.fftSize = 256;
          this.localRmsBuf = new Float32Array(new ArrayBuffer(this.localAnalyser.fftSize * 4));
          src.connect(this.localAnalyser);
        }

        // Attach tracks to any existing peer connections and renegotiate
        for (const [peerId, ch] of this.peers.entries()) {
          for (const track of this.localStream.getAudioTracks()) {
            ch.pc.addTrack(track, this.localStream);
          }
          if (this.localPeerId > peerId) {
            void this.createAndSendOffer(peerId, ch);
          }
        }
      }

      for (const tr of this.localStream.getAudioTracks()) {
        tr.enabled = true;
      }
      this.micEnabled = true;
      return true;
    } catch {
      this.micEnabled = false;
      return false;
    }
  }

  /** Returns true when local microphone RMS exceeds speech threshold */
  public isLocalSpeaking(): boolean {
    if (!this.micEnabled || !this.localAnalyser || !this.localRmsBuf) return false;
    this.localAnalyser.getFloatTimeDomainData(this.localRmsBuf);
    let sumSq = 0;
    for (let i = 0; i < this.localRmsBuf.length; i++) {
      const v = this.localRmsBuf[i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / this.localRmsBuf.length);
    return rms > 0.022;
  }

  public syncPeers(peerIds: string[]): void {
    if (!this.active || typeof RTCPeerConnection === 'undefined') return;
    const targetSet = new Set(peerIds.filter((id) => id && id !== this.localPeerId));

    for (const id of targetSet) {
      if (!this.peers.has(id)) {
        const ch = this.createPeerChannel(id);
        // Lexicographically greater peerId initiates WebRTC Offer to prevent glare
        if (this.localPeerId > id) {
          void this.createAndSendOffer(id, ch);
        }
      }
    }

    for (const [id] of this.peers.entries()) {
      if (!targetSet.has(id)) {
        this.closePeer(id);
      }
    }
  }

  public async handleSignal(fromPeerId: string, signal: VoiceSignalPayload): Promise<void> {
    if (!this.active || !fromPeerId || fromPeerId === this.localPeerId) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    const ch = this.peers.get(fromPeerId) ?? this.createPeerChannel(fromPeerId);
    try {
      if (signal.kind === 'offer' && signal.sdp) {
        await ch.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await ch.pc.createAnswer();
        await ch.pc.setLocalDescription(answer);
        this.onSendSignal?.(fromPeerId, { kind: 'answer', sdp: answer });
      } else if (signal.kind === 'answer' && signal.sdp) {
        if (ch.pc.signalingState === 'have-local-offer') {
          await ch.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.kind === 'ice' && signal.candidate) {
        await ch.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch {
      // ignore transient ICE / signaling races
    }
  }

  /** Updates GainNode & StereoPannerNode for every remote voice peer at ~30Hz */
  public updateSpatialPositions(
    listener: SpatialVoicePose,
    peerPositions: Record<string, { x: number; y: number; z: number }>
  ): void {
    if (!this.active) return;
    const now = this.audioCtx?.currentTime ?? 0;
    for (const [peerId, ch] of this.peers.entries()) {
      const pos = peerPositions[peerId];
      if (!pos || ch.mutedByUser || this.mutedPeers.has(peerId)) {
        if (ch.gainNode) ch.gainNode.gain.setTargetAtTime(0, now, 0.05);
        continue;
      }
      const sp = computeVoiceSpatialParams(listener, pos);
      if (ch.gainNode) {
        ch.gainNode.gain.setTargetAtTime(sp.gain, now, 0.05);
      }
      if (ch.pannerNode) {
        ch.pannerNode.pan.setTargetAtTime(sp.pan, now, 0.05);
      }
    }
  }

  private createPeerChannel(peerId: string): PeerVoiceChannel {
    const pc = new RTCPeerConnection({ iceServers: VOICE_ICE_SERVERS });
    const ch: PeerVoiceChannel = {
      peerId,
      pc,
      audioEl: null,
      sourceNode: null,
      gainNode: null,
      pannerNode: null,
      remoteStream: null,
      mutedByUser: this.mutedPeers.has(peerId),
    };
    this.peers.set(peerId, ch);

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.onSendSignal?.(peerId, { kind: 'ice', candidate: ev.candidate.toJSON() });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      ch.remoteStream = stream;

      // Chrome/Android WebRTC requires an HTMLAudioElement sink (muted) for Web Audio MediaStreamSource to pump audio
      if (typeof document !== 'undefined' && !ch.audioEl) {
        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.muted = true;
        audio.autoplay = true;
        audio.play().catch(() => undefined);
        ch.audioEl = audio;
      }

      if (this.audioCtx) {
        try {
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => undefined);
          }
          const src = this.audioCtx.createMediaStreamSource(stream);
          const gain = this.audioCtx.createGain();
          gain.gain.value = ch.mutedByUser ? 0 : 0.8;
          const panner =
            typeof this.audioCtx.createStereoPanner === 'function'
              ? this.audioCtx.createStereoPanner()
              : null;
          if (panner) {
            src.connect(gain);
            gain.connect(panner);
            panner.connect(this.audioCtx.destination);
          } else {
            src.connect(gain);
            gain.connect(this.audioCtx.destination);
          }
          ch.sourceNode = src;
          ch.gainNode = gain;
          ch.pannerNode = panner;
        } catch {
          // Fallback to direct element playback if Web Audio fails
          if (ch.audioEl) ch.audioEl.muted = ch.mutedByUser;
        }
      }
    };

    return ch;
  }

  private async createAndSendOffer(peerId: string, ch: PeerVoiceChannel): Promise<void> {
    try {
      const offer = await ch.pc.createOffer({ offerToReceiveAudio: true });
      await ch.pc.setLocalDescription(offer);
      this.onSendSignal?.(peerId, { kind: 'offer', sdp: offer });
    } catch {
      // ignore
    }
  }

  private closePeer(peerId: string): void {
    const ch = this.peers.get(peerId);
    if (!ch) return;
    try {
      ch.sourceNode?.disconnect();
      ch.gainNode?.disconnect();
      ch.pannerNode?.disconnect();
      if (ch.audioEl) {
        ch.audioEl.pause();
        ch.audioEl.srcObject = null;
      }
      ch.pc.close();
    } catch {
      // ignore
    }
    this.peers.delete(peerId);
  }

  public stop(): void {
    this.active = false;
    this.micEnabled = false;
    for (const id of Array.from(this.peers.keys())) {
      this.closePeer(id);
    }
    if (this.localStream) {
      for (const tr of this.localStream.getTracks()) tr.stop();
      this.localStream = null;
    }
    this.localAnalyser = null;
    this.localRmsBuf = null;
    this.onSendSignal = null;
  }
}

export const proximityVoice = new ProximityVoiceManager();
