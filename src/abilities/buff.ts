/** Buff: apply a status effect to the owner. Params: kind, frames (-1 = round), magnitude, visual. */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { addStatus } from '../game/sim/status';

export const buff: Ability = {
  type: 'buff',
  trigger(ctx, owner, p, move) {
    const kind = str(p, 'kind', 'powerUp');
    addStatus(owner, kind, num(p, 'frames', 300), num(p, 'magnitude', 120), owner.index);
    if (kind === 'armor') owner.armorFrames = Math.max(owner.armorFrames, 0);
    emit(ctx, { type: 'buff', player: owner.index, x: owner.x, y: owner.y + 100 * FX, moveId: move.id,
      visual: str(p, 'visual', move.vfx ?? kind) });
  },
};
