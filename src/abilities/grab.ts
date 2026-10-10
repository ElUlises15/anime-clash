/**
 * Grab: unblockable close-range throw. Connects only if the opponent is grounded, hittable and within range.
 * Params: range (px), + hit keys (damage, kbx, kby, knockdown...), visual.
 */
import type { Ability } from './types';
import { num } from './types';
import { FX } from '../game/sim/types';
import { applyHit, canBeHit, specFromParams } from '../game/sim/combat';
import { foe, slotOf } from './common';

export const grab: Ability = {
  type: 'grab',
  trigger(ctx, owner, p, move) {
    const o = foe(ctx.state, owner);
    if (!o.grounded || !canBeHit(ctx, o)) return;
    if (Math.abs(o.x - owner.x) > num(p, 'range', 90) * FX) return;
    const spec = specFromParams(move, slotOf(owner, move), p, false);
    spec.level = 'unblockable';
    owner.moveHit = true;
    applyHit(ctx, owner.index, o, spec, owner.facing, { x: (owner.x + o.x) >> 1, y: o.y + 110 * FX });
  },
};
