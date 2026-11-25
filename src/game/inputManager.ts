import type { GamepadGlyphStyle, GamepadProfile, InputMode } from './types';

export interface DeviceKeyGlyphs {
  interact: string;
  flashlight: string;
  uvOrUse: string;
  drop: string;
  crouch: string;
  sprint: string;
  backpack: string;
  hotbarSwitch: string;
  map: string;
  journal: string;
  pause: string;
}

export interface RectBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pure, deterministic Input Mode Auto-Detector (Touch <-> PC <-> Gamepad).
 * Features a 650ms ghost-mousemove suppression guard after touch events so mobile browsers
 * that emit synthetic mouse events after taps NEVER falsely hide touch controls.
 */
export class InputModeController {
  private mode: InputMode;
  private gamepadStyle: GamepadGlyphStyle = 'xbox';
  private lastTouchAtMs = -10000;
  private readonly ghostMouseGuardMs = 650;

  constructor(initialTouchCapable = false) {
    this.mode = initialTouchCapable ? 'touch' : 'pc';
  }

  getMode(): InputMode {
    return this.mode;
  }

  getGamepadStyle(): GamepadGlyphStyle {
    return this.gamepadStyle;
  }

  /** Called on real pointerdown (touch) or touchstart. Immediately activates Touch HUD. */
  onTouchInput(nowMs: number): boolean {
    this.lastTouchAtMs = nowMs;
    if (this.mode !== 'touch') {
      this.mode = 'touch';
      return true;
    }
    return false;
  }

  /** Called on real keyboard keydown. Immediately hides Touch controls & switches to PC HUD. */
  onKeyboardInput(): boolean {
    if (this.mode !== 'pc') {
      this.mode = 'pc';
      return true;
    }
    return false;
  }

  /**
   * Called on mousemove / mousedown (pointerType === 'mouse').
   * Ignores synthetic mouse events fired within 650ms of a touch event.
   */
  onMouseInput(nowMs: number, movementMagnitude = 1): boolean {
    if (nowMs - this.lastTouchAtMs < this.ghostMouseGuardMs) {
      return false;
    }
    if (movementMagnitude < 1) return false;
    if (this.mode !== 'pc') {
      this.mode = 'pc';
      return true;
    }
    return false;
  }

  /** Called when any Gamepad button or stick crosses deadzone (or gamepad connects). */
  onGamepadInput(gamepadId = ''): boolean {
    const lower = gamepadId.toLowerCase();
    const nextStyle: GamepadGlyphStyle =
      lower.includes('dualshock') ||
      lower.includes('dualsense') ||
      lower.includes('playstation') ||
      lower.includes('sony') ||
      lower.includes('054c')
        ? 'playstation'
        : 'xbox';
    const changed = this.mode !== 'gamepad' || this.gamepadStyle !== nextStyle;
    this.mode = 'gamepad';
    this.gamepadStyle = nextStyle;
    return changed;
  }
}

/**
 * Returns crisp, device-accurate keybind / button prompts for PC, PlayStation, Xbox, or Touch.
 */
export function getDeviceGlyphs(mode: InputMode, gpStyle: GamepadGlyphStyle): DeviceKeyGlyphs {
  if (mode === 'touch') {
    return {
      interact: 'TOCAR',
      flashlight: 'LUZ',
      uvOrUse: 'USAR',
      drop: 'DROPAR',
      crouch: 'AGACH.',
      sprint: 'CORRER',
      backpack: 'MOCHILA',
      hotbarSwitch: 'SLOTS',
      map: 'MAPA',
      journal: 'DIÁRIO',
      pause: 'PAUSA',
    };
  }
  if (mode === 'gamepad') {
    if (gpStyle === 'playstation') {
      return {
        interact: '✕',
        flashlight: '△',
        uvOrUse: 'R2',
        drop: 'HOLD □',
        crouch: '○',
        sprint: 'L2 / L3',
        backpack: 'D-DOWN',
        hotbarSwitch: 'D-PAD ◀▶',
        map: 'TOUCH',
        journal: 'D-UP',
        pause: 'OPT',
      };
    }
    return {
      interact: 'A',
      flashlight: 'Y',
      uvOrUse: 'RT',
      drop: 'HOLD X',
      crouch: 'B',
      sprint: 'LT / LS',
      backpack: 'D-DOWN',
      hotbarSwitch: 'D-PAD ◀▶',
      map: 'VIEW',
      journal: 'D-UP',
      pause: 'MENU',
    };
  }
  return {
    interact: 'E',
    flashlight: 'F',
    uvOrUse: 'Q / V / RMB',
    drop: 'G',
    crouch: 'C',
    sprint: 'SHIFT',
    backpack: 'TAB / I',
    hotbarSwitch: '1-6 / SCROLL',
    map: 'M',
    journal: 'J',
    pause: 'ESC',
  };
}

export interface GamepadButtonLike {
  pressed: boolean;
  value?: number;
}

export interface GamepadLike {
  id: string;
  mapping?: string;
  axes: readonly number[];
  buttons: readonly GamepadButtonLike[];
}

export interface NormalizedGamepadState {
  resolvedProfile: 'standard' | 'ds4_android';
  style: GamepadGlyphStyle;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  l2Value: number; // 0..1
  r2Value: number; // 0..1
  cross: boolean; // A / Cross (Confirm / Interact)
  circle: boolean; // B / Circle (Back / Crouch)
  square: boolean; // X / Square (Alt Interact / Hold Drop)
  triangle: boolean; // Y / Triangle (Flashlight)
  l1: boolean; // LB / L1 (Prev Cam / Prev Tab)
  r1: boolean; // RB / R1 (Next Cam / Next Tab)
  l2: boolean; // LT / L2 (Sprint)
  r2: boolean; // RT / R2 (Contextual Use: UV / Taser / Flare / Can)
  l3: boolean; // LS / L3 (Sprint)
  r3: boolean; // RS / R3 (Crouch)
  dpadUp: boolean; // Journal / Menu Up
  dpadDown: boolean; // Backpack / Menu Down
  dpadLeft: boolean; // Hotbar Left / Menu Left
  dpadRight: boolean; // Hotbar Right / Menu Right
  options: boolean; // Start / Options (Pause)
  shareOrTouch: boolean; // Share / Touchpad / View (Minimap)
  anyActive: boolean;
}

function isPressed(btn: GamepadButtonLike | undefined, threshold = 0.35): boolean {
  if (!btn) return false;
  return Boolean(btn.pressed) || (typeof btn.value === 'number' && btn.value > threshold);
}

/**
 * Decodes Android Bluetooth DualShock 4 hat-switch D-Pad axis (`axes[9]`) into 4 cardinal booleans.
 * Hat switch ranges from -1.0 (Up) clockwise to +0.714 (Up-Left); neutral is > 1.05 (typically ~1.2857 or ~3.2857).
 */
export function decodeHatSwitchAxis(val: number | undefined): {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
} {
  if (val === undefined || !Number.isFinite(val) || val > 1.05 || val < -1.05) {
    return { up: false, down: false, left: false, right: false };
  }
  // Standard Linux/Android HID hat mapping:
  // Up = -1.0, Up-Right = -0.714, Right = -0.429, Down-Right = -0.143,
  // Down = +0.143, Down-Left = +0.429, Left = +0.714, Up-Left = +1.0
  const eps = 0.16;
  const near = (target: number) => Math.abs(val - target) <= eps;
  const up = near(-1.0) || near(-0.714) || near(1.0);
  const right = near(-0.714) || near(-0.429) || near(-0.143);
  const down = near(-0.143) || near(0.143) || near(0.429);
  const left = near(0.429) || near(0.714) || near(1.0);
  return { up, down, left, right };
}

/**
 * Dual-profile Gamepad Normalizer supporting:
 * 1) Standard W3C Gamepad API (PC Xbox, PC DS4/DualSense, Chrome Standard)
 * 2) Raw Android Bluetooth DualShock 4 (`mapping !== 'standard'` or Sony 054c raw axis layout):
 *    - Right Stick on `axes[2]` (X) & `axes[5]` (Y)
 *    - L2 / R2 analog triggers on `axes[3]` / `axes[4]` mapped (-1..+1) -> (0..1)
 *    - Hat-switch D-Pad on `axes[9]`
 */
export function normalizeGamepadState(
  gp: GamepadLike,
  deadzone = 0.14,
  profile: GamepadProfile = 'auto',
  deadzoneRight?: number
): NormalizedGamepadState {
  const idLower = (gp.id || '').toLowerCase();
  const isXbox = idLower.includes('xbox') || idLower.includes('xinput') || idLower.includes('045e');
  const isSony =
    !isXbox &&
    (idLower.includes('dualshock') ||
      idLower.includes('dualsense') ||
      idLower.includes('playstation') ||
      idLower.includes('wireless controller') ||
      idLower.includes('sony') ||
      idLower.includes('054c'));
  const style: GamepadGlyphStyle = isSony ? 'playstation' : 'xbox';

  const looksLikeRawDs4 =
    gp.mapping !== 'standard' &&
    gp.axes.length >= 6 &&
    (isSony || gp.axes.length >= 10);

  const resolvedProfile: 'standard' | 'ds4_android' =
    profile === 'ds4_android'
      ? 'ds4_android'
      : profile === 'standard'
        ? 'standard'
        : looksLikeRawDs4
          ? 'ds4_android'
          : 'standard';

  const rawMoveX = gp.axes[0] ?? 0;
  const rawMoveY = gp.axes[1] ?? 0;
  let rawLookX = gp.axes[2] ?? 0;
  let rawLookY = gp.axes[3] ?? 0;

  let l2Value = 0;
  let r2Value = 0;
  let cross = false;
  let circle = false;
  let square = false;
  let triangle = false;
  let l1 = false;
  let r1 = false;
  let l3 = false;
  let r3 = false;
  let options = false;
  let shareOrTouch = false;
  let dpadUp = false;
  let dpadDown = false;
  let dpadLeft = false;
  let dpadRight = false;

  if (resolvedProfile === 'ds4_android') {
    // Raw Android/Linux HID DualShock 4 layout
    rawLookX = gp.axes[2] ?? 0;
    rawLookY = gp.axes[5] ?? gp.axes[3] ?? 0;

    // Analog triggers on axes[3] (L2) and axes[4] (R2): rest at -1.0, full pull at +1.0
    const rawL2Axis = gp.axes[3];
    const rawR2Axis = gp.axes[4];
    const axisL2 = rawL2Axis !== undefined ? Math.max(0, Math.min(1, (rawL2Axis + 1) * 0.5)) : 0;
    const axisR2 = rawR2Axis !== undefined ? Math.max(0, Math.min(1, (rawR2Axis + 1) * 0.5)) : 0;
    l2Value = Math.max(axisL2, gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0));
    r2Value = Math.max(axisR2, gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0));

    // Raw DS4 face button order: 0=Square, 1=Cross, 2=Circle, 3=Triangle (some Android builds remap 0=Cross, 1=Circle, 2=Square, 3=Triangle)
    const isAndroidStandardFace = idLower.includes('wireless controller') && gp.buttons.length >= 16;
    if (isAndroidStandardFace) {
      cross = isPressed(gp.buttons[0]);
      circle = isPressed(gp.buttons[1]);
      square = isPressed(gp.buttons[2]);
      triangle = isPressed(gp.buttons[3]);
    } else {
      square = isPressed(gp.buttons[0]);
      cross = isPressed(gp.buttons[1]);
      circle = isPressed(gp.buttons[2]);
      triangle = isPressed(gp.buttons[3]);
    }

    l1 = isPressed(gp.buttons[4]);
    r1 = isPressed(gp.buttons[5]);
    options = isPressed(gp.buttons[9]);
    l3 = isPressed(gp.buttons[10]);
    r3 = isPressed(gp.buttons[11]);
    shareOrTouch = isPressed(gp.buttons[8]) || isPressed(gp.buttons[13]) || isPressed(gp.buttons[17]);

    const hat = decodeHatSwitchAxis(gp.axes[9]);
    dpadUp = hat.up || isPressed(gp.buttons[12]);
    dpadDown = hat.down || isPressed(gp.buttons[13]) && !shareOrTouch ? isPressed(gp.buttons[13]) : hat.down;
    dpadLeft = hat.left || isPressed(gp.buttons[14]);
    dpadRight = hat.right || isPressed(gp.buttons[15]);
    // On raw DS4 with hat switch, button 13 is touchpad click (not dpadDown)
    if (gp.axes.length >= 10) {
      dpadDown = hat.down;
    }
  } else {
    // Standard W3C Gamepad mapping (PC / Chrome Standard DS4 & Xbox)
    rawLookX = gp.axes[2] ?? 0;
    rawLookY = gp.axes[3] ?? 0;
    l2Value = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);
    r2Value = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);

    cross = isPressed(gp.buttons[0]);
    circle = isPressed(gp.buttons[1]);
    square = isPressed(gp.buttons[2]);
    triangle = isPressed(gp.buttons[3]);
    l1 = isPressed(gp.buttons[4]);
    r1 = isPressed(gp.buttons[5]);
    shareOrTouch = isPressed(gp.buttons[8]) || isPressed(gp.buttons[17]);
    options = isPressed(gp.buttons[9]);
    l3 = isPressed(gp.buttons[10]);
    r3 = isPressed(gp.buttons[11]);
    dpadUp = isPressed(gp.buttons[12]);
    dpadDown = isPressed(gp.buttons[13]);
    dpadLeft = isPressed(gp.buttons[14]);
    dpadRight = isPressed(gp.buttons[15]);
  }

  const move = applyStickResponseCurve(rawMoveX, rawMoveY, deadzone, 1.55);
  const look = applyStickResponseCurve(rawLookX, rawLookY, deadzoneRight ?? deadzone, 1.75);
  const l2 = l2Value > 0.35;
  const r2 = r2Value > 0.35;

  const anyActive =
    move.magnitude > 0 ||
    look.magnitude > 0 ||
    cross ||
    circle ||
    square ||
    triangle ||
    l1 ||
    r1 ||
    l2 ||
    r2 ||
    l3 ||
    r3 ||
    dpadUp ||
    dpadDown ||
    dpadLeft ||
    dpadRight ||
    options ||
    shareOrTouch;

  return {
    resolvedProfile,
    style,
    moveX: move.x,
    moveY: move.y,
    lookX: look.x,
    lookY: look.y,
    l2Value,
    r2Value,
    cross,
    circle,
    square,
    triangle,
    l1,
    r1,
    l2,
    r2,
    l3,
    r3,
    dpadUp,
    dpadDown,
    dpadLeft,
    dpadRight,
    options,
    shareOrTouch,
    anyActive,
  };
}

/**
 * Smooth non-linear radial deadzone response curve for Gamepad right-stick camera & left-stick movement.
 * Eliminates stick drift while keeping fine aiming precise and fast turns snappy.
 */
export function applyStickResponseCurve(
  rawX: number,
  rawY: number,
  deadzone = 0.14,
  exponent = 1.75
): { x: number; y: number; magnitude: number } {
  const mag = Math.hypot(rawX, rawY);
  if (mag <= deadzone) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const normalized = Math.min(1, (mag - deadzone) / (1 - deadzone));
  const curved = Math.pow(normalized, exponent);
  const scale = curved / mag;
  return {
    x: rawX * scale,
    y: rawY * scale,
    magnitude: curved,
  };
}

/**
 * Pure geometric layout calculator mirroring our minimalist Mobile HUD & TouchControls geometry.
 * Used by `uiAudit.test.ts` to mathematically prove ZERO button overlap across Portrait & Landscape viewports!
 */
export function computeMobileHudLayout(
  viewportW: number,
  viewportH: number,
  buttonScale = 1.0
): { boxes: RectBox[]; hasOverlap: boolean; overlapPairs: [string, string][] } {
  const isPortrait = viewportH > viewportW;
  const pad = 8;
  const btnPx = Math.max(46, Math.round((isPortrait ? 50 : 46) * buttonScale));
  const joyDiameter = Math.round((isPortrait ? 96 : 86) * buttonScale);
  const hotbarSlotW = viewportW < 420 ? 38 : 42;
  const hotbarW = hotbarSlotW * 6 + 4 * 5;
  const hotbarH = hotbarSlotW;
  const hotbarBottom = pad;
  const hotbarY = viewportH - hotbarBottom - hotbarH;
  const hotbarX = Math.round((viewportW - hotbarW) / 2);

  // In portrait, lift joystick & right cluster cleanly above the hotbar; in landscape, keep them on the far edges!
  const controlBottom = isPortrait ? hotbarH + 22 : Math.max(12, Math.round(viewportH * 0.08));

  const boxes: RectBox[] = [
    // Top-Left compact status pill
    { id: 'hud_status', x: pad, y: pad, w: Math.min(168, Math.round(viewportW * 0.42)), h: 42 },
    // Top-Right minimalist utility row (4 compact buttons: Mochila, Mapa, Diário, Pausa)
    { id: 'hud_utils', x: viewportW - pad - 156, y: pad, w: 156, h: 36 },
    // Bottom-Center 6-slot Hotbar
    { id: 'hud_hotbar', x: hotbarX, y: hotbarY, w: hotbarW, h: hotbarH },
    // Left Analog Joystick
    {
      id: 'touch_joystick',
      x: pad + 4,
      y: viewportH - controlBottom - joyDiameter,
      w: joyDiameter,
      h: joyDiameter,
    },
    // Right Action Cluster (2x2 clean ergonomic grid)
    {
      id: 'touch_interact',
      x: viewportW - pad - Math.round(btnPx * 1.15),
      y: viewportH - controlBottom - btnPx,
      w: Math.round(btnPx * 1.15),
      h: btnPx,
    },
    {
      id: 'touch_sprint',
      x: viewportW - pad - Math.round(btnPx * 1.15) - 8 - btnPx,
      y: viewportH - controlBottom - btnPx,
      w: btnPx,
      h: btnPx,
    },
    {
      id: 'touch_crouch',
      x: viewportW - pad - btnPx,
      y: viewportH - controlBottom - btnPx - 8 - btnPx,
      w: btnPx,
      h: btnPx,
    },
    {
      id: 'touch_light',
      x: viewportW - pad - btnPx - 8 - btnPx,
      y: viewportH - controlBottom - btnPx - 8 - btnPx,
      w: btnPx,
      h: btnPx,
    },
  ];

  // Check pairwise AABB intersection
  const overlapPairs: [string, string][] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const intersects =
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
      if (intersects) {
        overlapPairs.push([a.id, b.id]);
      }
    }
  }

  return { boxes, hasOverlap: overlapPairs.length > 0, overlapPairs };
}
