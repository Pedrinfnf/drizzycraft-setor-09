export interface GamepadPollResult {
  connected: boolean;
  anyActivity: boolean;
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  sprint: boolean;
  crouchToggle: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  breakPressed: boolean;
  placePressed: boolean;
  interactPressed: boolean;
  flashlightToggle: boolean;
  slotDelta: number;
  mapToggle: boolean;
  journalToggle: boolean;
  pauseToggle: boolean;
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0;
  const sign = Math.sign(value);
  return sign * ((Math.abs(value) - deadzone) / (1 - deadzone));
}

/**
 * Standard Web Gamepad API manager supporting Xbox, PlayStation, and generic controllers
 * with rising-edge detection, configurable deadzone/sensitivity/invertY, and rumble haptics.
 */
export class GamepadManager {
  private prevButtons: boolean[] = [];

  poll(deadzone: number, sensitivity: number, invertY: boolean): GamepadPollResult {
    const empty: GamepadPollResult = {
      connected: false,
      anyActivity: false,
      moveX: 0,
      moveZ: 0,
      lookX: 0,
      lookY: 0,
      sprint: false,
      crouchToggle: false,
      jumpPressed: false,
      jumpHeld: false,
      breakPressed: false,
      placePressed: false,
      interactPressed: false,
      flashlightToggle: false,
      slotDelta: 0,
      mapToggle: false,
      journalToggle: false,
      pauseToggle: false,
    };

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return empty;
    }

    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i]!.connected) {
        pad = pads[i];
        break;
      }
    }
    if (!pad) {
      this.prevButtons = [];
      return empty;
    }

    const btn = (idx: number) => Boolean(pad!.buttons[idx]?.pressed);
    const edge = (idx: number) => btn(idx) && !this.prevButtons[idx];

    const moveX = applyDeadzone(pad.axes[0] ?? 0, deadzone);
    const moveZ = -applyDeadzone(pad.axes[1] ?? 0, deadzone); // Up on stick = +1 forward
    const rawLookX = applyDeadzone(pad.axes[2] ?? 0, deadzone);
    const rawLookY = applyDeadzone(pad.axes[3] ?? 0, deadzone);

    const lookX = rawLookX * sensitivity * 24;
    const lookY = rawLookY * sensitivity * 20 * (invertY ? -1 : 1);

    const slotDelta = (edge(5) || edge(15) ? 1 : 0) - (edge(4) || edge(14) ? 1 : 0);

    const res: GamepadPollResult = {
      connected: true,
      anyActivity:
        Math.abs(moveX) > 0.05 ||
        Math.abs(moveZ) > 0.05 ||
        Math.abs(rawLookX) > 0.05 ||
        Math.abs(rawLookY) > 0.05 ||
        pad.buttons.some((b) => b.pressed),
      moveX,
      moveZ,
      lookX,
      lookY,
      sprint: btn(10) || btn(4), // L3 or LB
      crouchToggle: edge(1), // B / Circle
      jumpPressed: edge(0), // A / Cross
      jumpHeld: btn(0),
      breakPressed: edge(7), // RT / R2
      placePressed: edge(6), // LT / L2
      interactPressed: edge(2), // X / Square
      flashlightToggle: edge(3), // Y / Triangle
      slotDelta,
      mapToggle: edge(8) || edge(12), // Select/View or D-Pad Up
      journalToggle: edge(13), // D-Pad Down
      pauseToggle: edge(9), // Start / Options
    };

    this.prevButtons = pad.buttons.map((b) => b.pressed);
    return res;
  }

  rumble(durationMs: number, weakMagnitude: number, strongMagnitude: number) {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i] as (Gamepad & {
        vibrationActuator?: {
          playEffect?: (
            type: string,
            params: { duration: number; weakMagnitude: number; strongMagnitude: number },
          ) => Promise<unknown>;
        };
      }) | null;
      if (pad?.connected && pad.vibrationActuator?.playEffect) {
        pad.vibrationActuator
          .playEffect('dual-rumble', {
            duration: durationMs,
            weakMagnitude: Math.min(1, Math.max(0, weakMagnitude)),
            strongMagnitude: Math.min(1, Math.max(0, strongMagnitude)),
          })
          .catch(() => {});
        break;
      }
    }
  }
}
