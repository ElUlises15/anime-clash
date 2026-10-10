/**
 * Beam: sustained hitbox anchored at the owner's hand, extending forward and growing. Multi-hit.
 * Entity: kind 'beam', (x,y) = origin on beam center-line, w = current length (px, also data.length), h = thickness.
 * data.reach = un-obstructed length (grows by growSpeed up to maxLength). The visible/colliding length (w,
 * data.length) is clamped to the stage edge and stops at the first obstacle in its path: an opposing shield or the
 * opponent while it can be hit (so the beam is drawn ending on the target it is connecting with).
 * Ends when duration elapses or the owner leaves the move (interrupted).
 * Params: duration, maxLength, growSpeed, thickness, offsetX, offsetY, hits, interval, power, visual,
 *         finalKnockdown, finalKbx, finalKby, + hit keys.
 */
import type { Ability } from './types';
import { num } from './types';
import type { EntityState } from '../game/sim/types';
import { FX, STAGE_WIDTH_PX } from '../game/sim/types';
import { emit, type SimContext } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { entityBoxFx, hurtboxFx, type Rect } from '../game/sim/boxes';
import { canBeHit } from '../game/sim/combat';
import { foe, hitData, ownerPoint, visualOf } from './common';

/** How far (px) the beam reaches into the body / shield it stops at, so it visibly connects and keeps overlapping. */
export const BEAM_PENETRATION_PX = 30;

/** Length (px) at which the beam meets `r` (a fixed-point rect), or null if `r` isn't in its path within `len`. */
function stopAt(e: EntityState, r: Rect, len: number): number | null {
  const halfH = (e.h * FX) / 2;
  if (r.y >= e.y + halfH || r.y + r.h <= e.y - halfH) return null; // not in the beam's band
  const near = e.facing === 1 ? r.x - e.x : e.x - (r.x + r.w); // fixed-point distance to the near edge
  const far = near + r.w;
  if (far <= 0) return null; // entirely behind the origin
  const d = Math.max(0, Math.trunc(near / FX)) + BEAM_PENETRATION_PX;
  return d < len ? d : null;
}

/** Visible length after stage clamp and first obstacle. */
export function beamLength(ctx: SimContext, e: EntityState, reach: number): number {
  const edgeFx = e.facing === 1 ? STAGE_WIDTH_PX * FX - e.x : e.x;
  let len = Math.max(1, Math.min(reach, Math.trunc(edgeFx / FX)));
  for (const o of ctx.state.entities) {
    if (o.kind !== 'shield' || o.owner === e.owner || o.life <= 0) continue;
    const d = stopAt(e, entityBoxFx(o), len);
    if (d !== null) len = d;
  }
  const target = foe(ctx.state, e.owner);
  if (canBeHit(ctx, target)) {
    const d = stopAt(e, hurtboxFx(target), len);
    if (d !== null) len = d;
  }
  return Math.max(1, len);
}

export const beam: Ability = {
  type: 'beam',
  trigger(ctx, owner, p, move) {
    const at = ownerPoint(owner, p, 'offsetX', 'offsetY', 50, 115);
    const visual = visualOf(p, move, 'kamehameha');
    const grow = num(p, 'growSpeed', 60);
    const e = spawnEntity(ctx, {
      kind: 'beam', owner: owner.index, abilityType: 'beam', moveId: move.id, visual,
      x: at.x, y: at.y, facing: owner.facing, w: grow, h: num(p, 'thickness', 56),
      life: num(p, 'duration', 40), hitsLeft: num(p, 'hits', 6), power: num(p, 'power', 3),
      data: {
        ...hitData(p), interval: num(p, 'interval', 6), length: grow, reach: grow, maxLength: num(p, 'maxLength', 900),
        grow, offsetX: num(p, 'offsetX', 50), offsetY: num(p, 'offsetY', 115),
      },
    });
    e.w = beamLength(ctx, e, grow);
    e.data.length = e.w;
    emit(ctx, { type: 'beamStart', player: owner.index, x: at.x, y: at.y, moveId: move.id, visual, sfx: move.sfx,
      strength: move.kind === 'ultimate' ? 'ultimate' : 'special' });
  },
  updateEntity(ctx, e) {
    const o = ctx.state.fighters[e.owner];
    if (o.mode !== 'attack' || o.moveId !== e.moveId) { e.life = 0; return; }
    e.facing = o.facing;
    e.x = o.x + o.facing * (e.data.offsetX as number) * FX;
    e.y = o.y + (e.data.offsetY as number) * FX;
    const reach = Math.min(e.data.maxLength as number, (e.data.reach as number) + (e.data.grow as number));
    e.data.reach = reach;
    e.w = beamLength(ctx, e, reach);
    e.data.length = e.w;
  },
  onExpire(ctx, e) {
    emit(ctx, { type: 'beamEnd', player: e.owner, x: e.x, y: e.y, moveId: e.moveId, visual: e.visual });
  },
};
