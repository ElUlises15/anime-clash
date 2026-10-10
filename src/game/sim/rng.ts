/** Deterministic xorshift32 RNG stored in MatchState.rng (uint32). Never use Math.random in the sim. */
import type { MatchState } from './types';

export function seedRng(seed: number): number {
  let s = (seed >>> 0) ^ 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  return s === 0 ? 0x6d2b79f5 : s;
}

export function xorshift32(x: number): number {
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x;
}

/** Advance state.rng and return the new uint32. */
export function nextRng(state: MatchState): number {
  state.rng = xorshift32(state.rng >>> 0 || 0x6d2b79f5);
  return state.rng;
}

/** Integer in [0, n). */
export function rngInt(state: MatchState, n: number): number {
  return n <= 1 ? 0 : nextRng(state) % n;
}

/** Integer in [lo, hi]. */
export function rngRange(state: MatchState, lo: number, hi: number): number {
  return lo + rngInt(state, hi - lo + 1);
}
