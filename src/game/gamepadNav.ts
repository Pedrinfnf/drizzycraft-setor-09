export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pure 2D spatial focus finder (console-grade navigation for grids, keypads, 2-col settings & tab bars).
 * Picks the geometrically best element in the requested cardinal direction, falling back cleanly
 * to linear order wrap when reaching the edge of a container.
 */
export function findSpatialNextIndex(
  rects: readonly NavRect[],
  currentIdx: number,
  dir: NavDirection
): number {
  const n = rects.length;
  if (n === 0) return -1;
  if (n === 1) return 0;
  if (currentIdx < 0 || currentIdx >= n) return 0;

  const cur = rects[currentIdx];
  const cx = cur.x + cur.w * 0.5;
  const cy = cur.y + cur.h * 0.5;

  let bestIdx = -1;
  let bestScore = Infinity;

  for (let i = 0; i < n; i++) {
    if (i === currentIdx) continue;
    const r = rects[i];
    const rx = r.x + r.w * 0.5;
    const ry = r.y + r.h * 0.5;
    const dx = rx - cx;
    const dy = ry - cy;

    let primary = 0;
    let secondary = 0;

    if (dir === 'right') {
      if (dx <= 6) continue;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (dir === 'left') {
      if (dx >= -6) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (dir === 'down') {
      if (dy <= 6) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else {
      if (dy >= -6) continue;
      primary = -dy;
      secondary = Math.abs(dx);
    }

    // Strongly favor aligned rows/columns (classic console focus cone)
    const alignedBonus =
      (dir === 'left' || dir === 'right')
        ? secondary <= Math.max(cur.h, r.h) * 0.65 ? 0.55 : 1.0
        : secondary <= Math.max(cur.w, r.w) * 0.65 ? 0.55 : 1.0;

    const score = (primary + secondary * 2.35) * alignedBonus;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestIdx !== -1) return bestIdx;

  // Clean wrap fallback at container edge
  const delta = dir === 'right' || dir === 'down' ? 1 : -1;
  return (currentIdx + delta + n) % n;
}

/**
 * Pure range slider stepper for native console D-Pad / Left-Stick adjustment.
 * Uses smart step granularity so 0..100 sliders move smoothly (~5% per step) while fine sliders (e.g. FOV) respect exact steps.
 */
export function computeSliderNextValue(
  current: number,
  min: number,
  max: number,
  step: number,
  dir: 'left' | 'right'
): number {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 100;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const span = safeMax - safeMin;

  // If the slider has > 40 discrete steps (e.g. 0..100 step 1), advance by 5 steps per console click for crisp speed
  const totalSteps = span / safeStep;
  const increment = totalSteps > 40 ? safeStep * 5 : totalSteps > 20 ? safeStep * 2 : safeStep;

  const delta = dir === 'right' ? increment : -increment;
  const rawNext = current + delta;
  const snapped = Math.round((rawNext - safeMin) / safeStep) * safeStep + safeMin;
  const clamped = Math.max(safeMin, Math.min(safeMax, snapped));
  return Math.round(clamped * 10000) / 10000;
}

/**
 * Console-style held-direction auto-repeat timer:
 * - Immediate fire on initial press
 * - 0.26s hold threshold before repeating
 * - Smooth 0.095s repeat cadence while held
 */
export class MenuRepeatController {
  private heldDir: NavDirection | null = null;
  private timer = 0;
  private hasRepeated = false;

  reset(): void {
    this.heldDir = null;
    this.timer = 0;
    this.hasRepeated = false;
  }

  update(dt: number, activeDir: NavDirection | null): NavDirection | null {
    if (!activeDir) {
      this.reset();
      return null;
    }
    if (activeDir !== this.heldDir) {
      this.heldDir = activeDir;
      this.timer = 0;
      this.hasRepeated = false;
      return activeDir;
    }
    this.timer += Math.max(0, dt);
    const threshold = this.hasRepeated ? 0.095 : 0.26;
    if (this.timer >= threshold) {
      this.timer -= threshold;
      this.hasRepeated = true;
      return activeDir;
    }
    return null;
  }
}

/**
 * Dispatches a React-compatible value update to a controlled `<input type="range">` element.
 */
export function applyNativeRangeValue(input: HTMLInputElement, nextValue: number): boolean {
  const prev = Number(input.value);
  if (Math.abs(prev - nextValue) < 1e-6) return false;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(input, String(nextValue));
  } else {
    input.value = String(nextValue);
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
