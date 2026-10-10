/**
 * Stat budget + derivation of engine numbers from StatPoints. See docs/BALANCING.md.
 * All outputs are integers (fixed-point FX for speeds; see field comments in DerivedStats).
 */
import type { DerivedStats, StatPoints } from '../../characters/types';

export const STAT_BUDGET = 25;
export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const STAT_KEYS: (keyof StatPoints)[] = ['power', 'speed', 'mobility', 'defense', 'energy'];

/** Allowed ranges for derived stats (after overrides) — validateCharacter enforces these. */
export const DERIVED_LIMITS: Record<keyof DerivedStats, [number, number]> = {
  health: [850, 1200],
  walkSpeed: [350, 750],
  backWalkSpeed: [250, 650],
  dashSpeed: [900, 1900],
  dashFrames: [8, 22],
  jumpVelocity: [1600, 2400],
  gravity: [80, 130],
  airActions: [0, 2],
  defense: [85, 115],
  powerMul: [80, 125],
  energyRegen: [20, 110],
};

/**
 * Formulas (points 1..10, 5 = average):
 *  health       = 850 + 30*defense          (880..1150, avg 1000)
 *  defense%     = 110 - 2*defense           (damage taken %, 108..90)
 *  powerMul%    = 80 + 4*power              (84..120)
 *  walkSpeed    = 380 + 32*speed  FX/frame  (4.1..7.0 px/f)
 *  backWalk     = 78% of walk
 *  dashSpeed    = 1150 + 55*speed FX/frame
 *  jumpVelocity = 1820 + 40*mobility        (jump apex ~ v^2/2g = 190..240 px)
 *  airActions   = mobility>=7 ? 2 : mobility>=4 ? 1 : 0
 *  energyRegen  = 30 + 6*energy  (CENTI-energy per frame: 60 = 0.6/frame = 36 per second)
 */
export function deriveStats(points: StatPoints, overrides?: Partial<DerivedStats>): DerivedStats {
  const p = points;
  const walk = 380 + p.speed * 32;
  const d: DerivedStats = {
    health: 850 + p.defense * 30,
    walkSpeed: walk,
    backWalkSpeed: Math.trunc((walk * 78) / 100),
    dashSpeed: 1150 + p.speed * 55,
    dashFrames: 14,
    jumpVelocity: 1820 + p.mobility * 40,
    gravity: 100,
    airActions: p.mobility >= 7 ? 2 : p.mobility >= 4 ? 1 : 0,
    defense: 110 - p.defense * 2,
    powerMul: 80 + p.power * 4,
    energyRegen: 30 + p.energy * 6,
  };
  return overrides ? { ...d, ...overrides } : d;
}

export function validateStatPoints(p: StatPoints): string[] {
  const errs: string[] = [];
  let sum = 0;
  for (const k of STAT_KEYS) {
    const v = p[k];
    if (!Number.isInteger(v) || v < STAT_MIN || v > STAT_MAX) errs.push(`stat ${k}=${v} out of ${STAT_MIN}..${STAT_MAX}`);
    sum += v;
  }
  if (sum > STAT_BUDGET) errs.push(`stat points sum ${sum} exceeds budget ${STAT_BUDGET}`);
  return errs;
}

export function validateDerived(d: DerivedStats): string[] {
  const errs: string[] = [];
  for (const k of Object.keys(DERIVED_LIMITS) as (keyof DerivedStats)[]) {
    const [lo, hi] = DERIVED_LIMITS[k];
    const v = d[k];
    if (!Number.isInteger(v) || v < lo || v > hi) errs.push(`derived ${k}=${v} out of ${lo}..${hi}`);
  }
  return errs;
}

/** Horizontal jump speed derived from walk speed (FX/frame). */
export function jumpVxFor(walkSpeed: number): number {
  return Math.trunc((walkSpeed * 120) / 100);
}
