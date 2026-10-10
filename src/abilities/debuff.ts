/**
 * Debuff: apply a status to the opponent if within range (0 = anywhere). kind 'stun' also puts them in hitstun.
 * Params: kind, frames, magnitude, range (px), visual.
 */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { addStatus } from '../game/sim/status';
import { canBeHit } from '../game/sim/combat';
import { setMode, restartAnim } from '../game/sim/anim';
import { foe } from './common';

export const debuff: Ability = {
  type: 'debuff',
  trigger(ctx, owner, p, move) {
    const o = foe(ctx.state, owner);
    const range = num(p, 'range', 0);
    if (range > 0 && Math.abs(o.x - owner.x) > range * FX) return;
    if (!canBeHit(ctx, o)) return;
    const kind = str(p, 'kind', 'slow');
    const frames = num(p, 'frames', 180);
    addStatus(o, kind, frames, num(p, 'magnitude', 70), owner.index);
    if (kind === 'stun' && o.grounded) {
      o.moveId = null;
      setMode(o, 'hitstun');
      o.stunFrames = frames;
      o.vx = 0;
      restartAnim(o, 'hit');
    }
    emit(ctx, { type: 'buff', player: owner.index, x: o.x, y: o.y + 100 * FX, moveId: move.id,
      visual: str(p, 'visual', move.vfx ?? kind) });
  },
};
