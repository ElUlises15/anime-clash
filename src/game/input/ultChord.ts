/**
 * Pure "Especial 1 + Especial 2 together = Ultimate" chord detector. Unit-test friendly: no DOM, no Phaser.
 * A lone special press is held back for up to ULT_CHORD_WINDOW frames waiting for its partner;
 * if the partner arrives in time the frame emits ULT (and both specials are suppressed until released).
 */
import { BTN, type InputBits } from './buttons';

export const ULT_CHORD_WINDOW = 3;
const SP = BTN.SP1 | BTN.SP2;

export interface UltChordState {
  prevRaw: InputBits;
  /** Special bits pressed but not yet emitted. */
  pending: InputBits;
  /** Frames left before pending specials are released. */
  left: number;
  /** Chord fired; specials suppressed until both are released. */
  active: boolean;
}

export function createUltChordState(): UltChordState {
  return { prevRaw: 0, pending: 0, left: 0, active: false };
}

/** Feed one frame of raw held bits; returns the bits to emit. */
export function applyUltChord(st: UltChordState, raw: InputBits, window: number = ULT_CHORD_WINDOW): InputBits {
  const rising = raw & ~st.prevRaw & SP;
  st.prevRaw = raw;
  if (st.active) {
    if ((raw & SP) === 0) {
      st.active = false;
      return raw;
    }
    return (raw & ~SP) | BTN.ULT;
  }
  if (rising && !st.pending) st.left = window;
  st.pending |= rising;
  if ((st.pending & SP) === SP) {
    st.pending = 0;
    st.left = 0;
    st.active = true;
    return (raw & ~SP) | BTN.ULT;
  }
  if (!st.pending) return raw;
  if (st.left > 0) {
    st.left -= 1;
    return raw & ~st.pending;
  }
  // Partner never came: release the special (latched so a short tap still registers once).
  const out = raw | st.pending;
  st.pending = 0;
  return out;
}

export function resetUltChord(st: UltChordState): void {
  st.prevRaw = 0;
  st.pending = 0;
  st.left = 0;
  st.active = false;
}
