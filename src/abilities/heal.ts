/** Heal: restore HP (amount, or percent of max with `percent`). Params: amount, percent, visual. */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';

export const heal: Ability = {
  type: 'heal',
  trigger(ctx, owner, p, move) {
    const amount = num(p, 'amount', 0) + Math.trunc((owner.maxHp * num(p, 'percent', 0)) / 100);
    owner.hp = Math.min(owner.maxHp, owner.hp + Math.max(0, amount));
    emit(ctx, { type: 'buff', player: owner.index, x: owner.x, y: owner.y + 100 * FX, moveId: move.id,
      visual: str(p, 'visual', 'heal'), damage: -amount });
  },
};
