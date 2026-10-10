/** Shared helpers for ability components. */
import type { FighterState, MatchState, PlayerIndex } from '../game/sim/types';
import { FX, STAGE_MARGIN_PX, STAGE_WIDTH_PX } from '../game/sim/types';
import { num, str, type AbilityParams } from './types';
import { moveSlotById } from '../game/sim/defs';
import type { MoveDef, MoveSlot } from '../characters/types';

/** Point relative to the owner: offsetX px forward, offsetY px up (fixed-point result). */
export function ownerPoint(owner: FighterState, p: AbilityParams, dx = 'offsetX', dy = 'offsetY', defX = 0, defY = 100) {
  return { x: owner.x + owner.facing * num(p, dx, defX) * FX, y: owner.y + num(p, dy, defY) * FX };
}

export function foe(state: MatchState, owner: FighterState | PlayerIndex): FighterState {
  const i = typeof owner === 'number' ? owner : owner.index;
  return state.fighters[i === 0 ? 1 : 0];
}

export const STAGE_MIN = STAGE_MARGIN_PX * FX;
export const STAGE_MAX = (STAGE_WIDTH_PX - STAGE_MARGIN_PX) * FX;
export const clampX = (x: number) => Math.max(STAGE_MIN, Math.min(STAGE_MAX, x));

/** Copy hit-related params into entity data (damage, kbx, kby, hitstun, blockstun, chip, level, ...). */
const HIT_KEYS = ['damage', 'chip', 'kbx', 'kby', 'hitstun', 'blockstun', 'hitstop', 'level', 'knockdown', 'launcher',
  'hitVisual', 'sfx', 'energyGain', 'interval', 'finalKnockdown', 'finalKbx', 'finalKby'];
export function hitData(p: AbilityParams): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  for (const k of HIT_KEYS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

export function visualOf(p: AbilityParams, move: MoveDef, fallback: string): string {
  return str(p, 'visual', move.vfx ?? fallback);
}

export function slotOf(owner: FighterState, move: MoveDef): MoveSlot | null {
  return moveSlotById(owner.charId, move.id)?.slot ?? null;
}
