/**
 * Generic status effects (by kind). Magnitudes are integer percents unless noted.
 *  powerUp(m%)  speedUp(m%)  slow(m%)  defenseUp(m% dmg taken)  weaken(m% dmg taken)  weakenAtk(m% dmg dealt)
 *  armor(m% dmg taken, no flinch)  burn(m dmg every BURN_INTERVAL)  regen(m hp per second)  energyRegen(m%)
 *  stun (visual marker; the stun itself is hitstun)  counter (internal parry window)  transform (form timer)
 */
import type { FighterState, PlayerIndex, StatusEffect } from './types';
import { BURN_INTERVAL } from './constants';
import { emit, type SimContext } from './context';
import { dealDamage } from './combat';

export function getStatus(f: FighterState, kind: string): StatusEffect | undefined {
  return f.statuses.find((s) => s.kind === kind);
}

export function hasStatus(f: FighterState, kind: string): boolean {
  return f.statuses.some((s) => s.kind === kind);
}

/** Add or refresh (same kind replaces). frames -1 = until round end. */
export function addStatus(f: FighterState, kind: string, frames: number, magnitude: number, source: PlayerIndex): void {
  const existing = getStatus(f, kind);
  if (existing) {
    existing.frames = frames;
    existing.magnitude = magnitude;
    existing.source = source;
  } else {
    f.statuses.push({ kind, frames, magnitude, source });
  }
}

export function removeStatus(f: FighterState, kind: string): void {
  f.statuses = f.statuses.filter((s) => s.kind !== kind);
}

export function tickStatuses(ctx: SimContext, f: FighterState): void {
  if (f.statuses.length === 0) return;
  for (const s of f.statuses) {
    if (s.kind === 'burn' && s.frames % BURN_INTERVAL === 0 && f.hp > 1) {
      // burn never KOs
      dealDamage(ctx, s.source, f, Math.min(s.magnitude, f.hp - 1));
    } else if (s.kind === 'regen' && s.frames % 60 === 0) {
      f.hp = Math.min(f.maxHp, f.hp + s.magnitude);
    }
    if (s.frames > 0) s.frames--;
  }
  const expired = f.statuses.filter((s) => s.frames === 0);
  if (expired.length) {
    for (const s of expired) {
      if (s.kind === 'transform' && f.form) {
        f.form = null;
        emit(ctx, { type: 'transform', player: f.index, x: f.x, y: f.y + 9000, visual: 'revert' });
      }
    }
    f.statuses = f.statuses.filter((s) => s.frames !== 0);
  }
}
