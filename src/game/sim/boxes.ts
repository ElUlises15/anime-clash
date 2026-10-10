/**
 * Hurtboxes / hitboxes / entity boxes.
 * Public API returns WORLD PIXELS {x,y,w,h} with x = left, y = bottom, y up (sim space).
 * Internally collision uses fixed-point rects (FX units) to stay integer-exact.
 */
import type { EntityState, FighterState, HitboxPx, MatchState } from './types';
import { FX } from './types';
import { currentMove, currentSlot } from './defs';

export interface Rect { x: number; y: number; w: number; h: number }

/** Hurtbox sizes in px (relative to feet center). */
export const HURT = {
  stand: { w: 70, h: 225 },
  crouch: { w: 80, h: 140 },
  air: { w: 66, h: 180, y: 20 },
  lying: { w: 170, h: 45 },
} as const;

export function isCrouching(f: FighterState): boolean {
  if (!f.grounded) return false;
  if (f.mode === 'crouch') return true;
  if ((f.mode === 'block' || f.mode === 'blockstun') && f.anim === 'crouchBlock') return true;
  if (f.mode === 'attack') {
    const slot = currentSlot(f);
    return slot === 'crouchLight' || slot === 'crouchHeavy';
  }
  return false;
}

/** Fixed-point hurtbox. */
export function hurtboxFx(f: FighterState): Rect {
  if (f.mode === 'knockdown' || (f.mode === 'ko' && f.grounded)) {
    return { x: f.x - (HURT.lying.w * FX) / 2, y: f.y, w: HURT.lying.w * FX, h: HURT.lying.h * FX };
  }
  if (!f.grounded) {
    return { x: f.x - (HURT.air.w * FX) / 2, y: f.y + HURT.air.y * FX, w: HURT.air.w * FX, h: HURT.air.h * FX };
  }
  const s = isCrouching(f) ? HURT.crouch : HURT.stand;
  return { x: f.x - (s.w * FX) / 2, y: f.y, w: s.w * FX, h: s.h * FX };
}

/** Relative px hitbox (+x forward) -> fixed-point world rect. */
export function relBoxFx(x: number, y: number, facing: 1 | -1, hb: HitboxPx): Rect {
  const left = facing === 1 ? x + hb.x * FX : x - (hb.x + hb.w) * FX;
  return { x: left, y: y + hb.y * FX, w: hb.w * FX, h: hb.h * FX };
}

export function isMoveActive(f: FighterState): boolean {
  const m = currentMove(f);
  return !!m && f.moveFrame >= m.startup && f.moveFrame < m.startup + m.active;
}

export function activeHitboxFx(f: FighterState): Rect | null {
  const m = currentMove(f);
  if (!m || !m.hitbox) return null;
  if (f.moveFrame < m.startup || f.moveFrame >= m.startup + m.active) return null;
  return relBoxFx(f.x, f.y, f.facing, m.hitbox);
}

/**
 * Entity collision rect (fixed-point).
 *  - beam: (x,y) = origin at beam center-line; extends `w` px FORWARD (facing), `h` px thick.
 *  - summon / trap: (x,y) = feet/bottom center.
 *  - projectile / aoe / shield: (x,y) = center.
 */
export function entityBoxFx(e: EntityState): Rect {
  const w = e.w * FX, h = e.h * FX;
  switch (e.kind) {
    case 'beam':
      return { x: e.facing === 1 ? e.x : e.x - w, y: e.y - h / 2, w, h };
    case 'summon':
    case 'trap':
      return { x: e.x - w / 2, y: e.y, w, h };
    default:
      return { x: e.x - w / 2, y: e.y - h / 2, w, h };
  }
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Center of intersection (fixed-point ints). Assumes overlap. */
export function overlapCenter(a: Rect, b: Rect): { x: number; y: number } {
  const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w);
  const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h);
  return { x: Math.trunc((x0 + x1) / 2), y: Math.trunc((y0 + y1) / 2) };
}

const toPx = (r: Rect): Rect => ({ x: r.x / FX, y: r.y / FX, w: r.w / FX, h: r.h / FX });

/** World-px hurtbox (debug overlay / render). */
export function getHurtbox(f: FighterState): Rect {
  return toPx(hurtboxFx(f));
}

/** World-px active melee hitbox, or null. */
export function getActiveHitbox(_state: MatchState, f: FighterState): Rect | null {
  const r = activeHitboxFx(f);
  return r ? toPx(r) : null;
}

/** World-px entity box (debug overlay / render). */
export function getEntityBox(e: EntityState): Rect {
  return toPx(entityBoxFx(e));
}
