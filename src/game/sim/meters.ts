/** Energy / ultimate meter helpers (emit 'energyFull' / 'ultReady' on reaching max). */
import type { FighterState } from './types';
import { ENERGY_MAX, ULT_MAX } from './types';
import { emit, type SimContext } from './context';

export function addEnergy(ctx: SimContext, f: FighterState, n: number): void {
  const before = f.energy;
  f.energy = Math.max(0, Math.min(ENERGY_MAX, f.energy + Math.trunc(n)));
  if (before < ENERGY_MAX && f.energy === ENERGY_MAX) {
    emit(ctx, { type: 'energyFull', player: f.index, x: f.x, y: f.y });
  }
}

export function addUlt(ctx: SimContext, f: FighterState, n: number): void {
  const before = f.ult;
  f.ult = Math.max(0, Math.min(ULT_MAX, f.ult + Math.trunc(n)));
  if (before < ULT_MAX && f.ult === ULT_MAX) {
    emit(ctx, { type: 'ultReady', player: f.index, x: f.x, y: f.y });
  }
}

/** Passive regen: `perFrameCenti` hundredths per frame, distributed exactly over frames (no stored remainder). */
export function centiStep(frame: number, perFrameCenti: number): number {
  return Math.trunc(((frame + 1) * perFrameCenti) / 100) - Math.trunc((frame * perFrameCenti) / 100);
}
