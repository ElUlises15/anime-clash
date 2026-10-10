/**
 * CONTRACT FILE — per-frame input bitmask shared by input layer, sim, AI and (Phase 2) netcode.
 * Directions are ABSOLUTE (screen left/right). The sim resolves forward/back from facing.
 * DASH is emitted by the input layer (double-tap a direction or Shift + direction).
 * One frame of input for one player = one small integer (fits in 16 bits) -> trivially sendable over the network.
 */
export const BTN = {
  LEFT: 1 << 0,
  RIGHT: 1 << 1,
  UP: 1 << 2, // jump
  DOWN: 1 << 3, // crouch
  LIGHT: 1 << 4,
  HEAVY: 1 << 5,
  SP1: 1 << 6,
  SP2: 1 << 7,
  BLOCK: 1 << 8,
  ULT: 1 << 9,
  DASH: 1 << 10,
} as const;
export type ButtonName = keyof typeof BTN;
export type InputBits = number;
export const NO_INPUT: InputBits = 0;
export const has = (bits: InputBits, b: number): boolean => (bits & b) !== 0;
/** Edge detection helper: pressed this frame but not last frame. */
export const pressed = (cur: InputBits, prev: InputBits, b: number): boolean => (cur & b) !== 0 && (prev & b) === 0;
