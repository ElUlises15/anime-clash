/**
 * AOE: area (circle approximated by a square of side 2*radius) around a point; optional delay; multi-hit.
 * Params: radius, at ('self'|'opponent'), offsetX, offsetY, delay, life (active frames), hits, interval, visual, + hit keys.
 */
import type { Ability, AbilityParams } from './types';
import { num, str } from './types';
import type { Facing, PlayerIndex } from '../game/sim/types';
import { FX } from '../game/sim/types';
import { emit, type SimContext } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { foe, hitData, ownerPoint } from './common';

export function spawnAoe(ctx: SimContext, owner: PlayerIndex, moveId: string, x: number, y: number, facing: Facing,
  p: AbilityParams) {
  const r = num(p, 'radius', 120);
  const delay = num(p, 'delay', 0);
  const visual = str(p, 'visual', 'explosion');
  const e = spawnEntity(ctx, {
    kind: 'aoe', owner, abilityType: 'aoe', moveId, visual, x, y, facing,
    w: r * 2, h: r * 2, life: delay + num(p, 'life', 12), hitsLeft: num(p, 'hits', 1),
    data: { ...hitData(p), delay, armed: delay === 0, interval: num(p, 'interval', 6) },
  });
  if (delay === 0) emit(ctx, { type: 'aoe', player: owner, x, y, moveId, visual });
  return e;
}

export const aoe: Ability = {
  type: 'aoe',
  trigger(ctx, owner, p, move) {
    let pt = ownerPoint(owner, p, 'offsetX', 'offsetY', 0, 116);
    if (str(p, 'at', 'self') === 'opponent') {
      const o = foe(ctx.state, owner);
      pt = { x: o.x, y: o.y + num(p, 'offsetY', 116) * FX };
    }
    spawnAoe(ctx, owner.index, move.id, pt.x, pt.y, owner.facing, { visual: move.vfx ?? 'explosion', ...p });
  },
  updateEntity(ctx, e) {
    if (e.data.armed !== true && e.age >= (e.data.delay as number)) {
      e.data.armed = true;
      emit(ctx, { type: 'aoe', player: e.owner, x: e.x, y: e.y, moveId: e.moveId, visual: e.visual });
    }
    if (e.hitsLeft <= 0 && e.life > 6) e.life = 6; // linger briefly for visuals
  },
};
