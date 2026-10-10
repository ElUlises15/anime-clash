/**
 * Pure double-tap dash detector. Unit-test friendly: no DOM, no Phaser.
 * Frame units are sim frames (60 Hz). Window ~12 frames, dash bit held a few frames.
 */

export const DASH_TAP_WINDOW = 12;
export const DASH_HOLD_FRAMES = 8;

export interface DoubleTapState {
  lastLeft: number;
  lastRight: number;
  dashLeft: number;
}

export function createDoubleTapState(): DoubleTapState {
  return { lastLeft: -9999, lastRight: -9999, dashLeft: 0 };
}

/**
 * Call on the frame a direction becomes pressed (rising edge).
 * Returns true if this press completes a double-tap.
 */
export function noteDirPress(
  state: DoubleTapState,
  dir: 'left' | 'right',
  frame: number,
  window: number = DASH_TAP_WINDOW,
  hold: number = DASH_HOLD_FRAMES,
): boolean {
  const last = dir === 'left' ? state.lastLeft : state.lastRight;
  const dt = frame - last;
  const isDouble = last > -9999 && dt > 0 && dt <= window;
  if (dir === 'left') state.lastLeft = frame;
  else state.lastRight = frame;
  if (isDouble) {
    state.dashLeft = hold;
    return true;
  }
  return false;
}

/** Consume one frame of lingering dash. Returns true if DASH should be emitted this frame. */
export function tickDash(state: DoubleTapState): boolean {
  if (state.dashLeft <= 0) return false;
  state.dashLeft -= 1;
  return true;
}

export function resetDoubleTap(state: DoubleTapState): void {
  state.lastLeft = -9999;
  state.lastRight = -9999;
  state.dashLeft = 0;
}
