export type HoldBreathOutcome = 'none' | 'survived' | 'caught';

export interface HoldBreathSnapshot {
  active: boolean;
  spotId: string | null;
  progress: number; // 0..1 (reaches 1 => survived)
  gauge: number; // 0..100 equilibrium tension gauge
  zoneMin: number;
  zoneMax: number;
  holding: boolean;
  inSafeZone: boolean;
  warning: string | null;
  dangerTimer: number;
  timeRemainingSec: number;
}

/**
 * Pure, deterministic state machine for the Hiding Spot Hold-Breath Minigame.
 *
 * When P. Drizzy inspects a hiding spot the player entered UNSEEN:
 * - An equilibrium bar (0..100) opens with a safe sweet-spot zone (default 30..72, assist 22..80).
 * - Holding Space / Touch Action / Gamepad Cross|R2 raises the gauge (holding breath tightly).
 * - Releasing lets the gauge drift down (exhaling quietly).
 * - Keeping the needle inside the safe zone advances the inspection timer to 1.0 (~4.8s).
 * - Staying out of bounds (< 4 or > 96) or letting danger accumulate for > 1.25s triggers a cough/gasp -> caught!
 */
export class HoldBreathMinigame {
  private active = false;
  private spotId: string | null = null;
  private elapsedSec = 0;
  private durationSec = 4.8;
  private progress = 0;
  private gauge = 52;
  private zoneMin = 30;
  private zoneMax = 72;
  private dangerTimer = 0;
  private holding = false;
  private swayPhase = 0;

  isActive(): boolean {
    return this.active;
  }

  getSpotId(): string | null {
    return this.spotId;
  }

  start(spotId: string, assistMode = false, durationSec = 4.8, ironLungsPerk = false): void {
    this.active = true;
    this.spotId = spotId;
    this.elapsedSec = 0;
    this.durationSec = Math.max(3.8, Math.min(6.0, durationSec));
    this.progress = 0;
    this.gauge = 50;
    const baseMin = assistMode ? 22 : 30;
    const baseMax = assistMode ? 80 : 72;
    this.zoneMin = ironLungsPerk ? Math.max(14, baseMin - 5) : baseMin;
    this.zoneMax = ironLungsPerk ? Math.min(86, baseMax + 5) : baseMax;
    this.dangerTimer = 0;
    this.holding = false;
    this.swayPhase = 0;
  }

  cancel(): void {
    this.active = false;
    this.spotId = null;
    this.elapsedSec = 0;
    this.progress = 0;
    this.gauge = 50;
    this.dangerTimer = 0;
    this.holding = false;
  }

  step(dt: number, isHoldingInput: boolean, assistMode = false, ironLungsPerk = false): {
    outcome: HoldBreathOutcome;
    breathPulse: boolean;
  } {
    if (!this.active) {
      return { outcome: 'none', breathPulse: false };
    }
    const clampedDt = Math.min(Math.max(dt, 0), 0.1);
    this.holding = isHoldingInput;
    const baseMin = assistMode ? 22 : 30;
    const baseMax = assistMode ? 80 : 72;
    this.zoneMin = ironLungsPerk ? Math.max(14, baseMin - 5) : baseMin;
    this.zoneMax = ironLungsPerk ? Math.min(86, baseMax + 5) : baseMax;

    this.elapsedSec += clampedDt;
    const prevCycle = Math.floor(this.swayPhase / Math.PI);
    this.swayPhase += clampedDt * 2.8;
    const breathPulse = Math.floor(this.swayPhase / Math.PI) !== prevCycle;

    // Gentle heartbeat tremor pushes the gauge subtly so feathering feels tense and tactile
    const tremor = Math.sin(this.swayPhase * 1.45) * (assistMode ? 6.5 : 11.5);
    const riseRate = assistMode ? 44 : 52;
    const fallRate = assistMode ? 36 : 44;

    if (isHoldingInput) {
      this.gauge += (riseRate + tremor) * clampedDt;
    } else {
      this.gauge -= (fallRate - tremor) * clampedDt;
    }
    this.gauge = Math.max(0, Math.min(100, this.gauge));

    const inSafe = this.gauge >= this.zoneMin && this.gauge <= this.zoneMax;
    const criticalEdge = this.gauge <= 3 || this.gauge >= 97;

    if (inSafe) {
      this.progress = Math.min(1, this.progress + clampedDt / this.durationSec);
      this.dangerTimer = Math.max(0, this.dangerTimer - clampedDt * 1.4);
    } else {
      // Slightly slower progress while slightly off-zone, rapid danger buildup on edges
      this.progress = Math.min(1, this.progress + (clampedDt / this.durationSec) * 0.25);
      const dangerRate = criticalEdge ? 2.15 : 0.85;
      this.dangerTimer += clampedDt * (assistMode ? dangerRate * 0.65 : dangerRate);
    }

    const maxDanger = (assistMode ? 1.85 : 1.25) * (ironLungsPerk ? 1.25 : 1.0);
    if (this.dangerTimer >= maxDanger) {
      this.active = false;
      return { outcome: 'caught', breathPulse };
    }

    if (this.progress >= 1 || this.elapsedSec >= this.durationSec * 1.25) {
      this.active = false;
      return { outcome: 'survived', breathPulse };
    }

    return { outcome: 'none', breathPulse };
  }

  getSnapshot(): HoldBreathSnapshot {
    const inSafeZone = this.gauge >= this.zoneMin && this.gauge <= this.zoneMax;
    let warning: string | null = null;
    if (this.active) {
      if (this.gauge > this.zoneMax) {
        warning = 'SOLTE DEVAGAR — SEM AR!';
      } else if (this.gauge < this.zoneMin) {
        warning = 'SEGURE — RESPIRAÇÃO ALTA!';
      } else {
        warning = 'NA ZONA SEGURA — ELE ESTÁ OUVINDO';
      }
    }
    return {
      active: this.active,
      spotId: this.spotId,
      progress: Math.max(0, Math.min(1, this.progress)),
      gauge: Math.round(this.gauge * 10) / 10,
      zoneMin: this.zoneMin,
      zoneMax: this.zoneMax,
      holding: this.holding,
      inSafeZone,
      warning,
      dangerTimer: this.dangerTimer,
      timeRemainingSec: Math.max(0, (1 - this.progress) * this.durationSec),
    };
  }
}
