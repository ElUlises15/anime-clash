/**
 * Transformation: sets fighter.form (stat multipliers from CharacterDef.forms[form].statMul) for `frames`
 * (-1 = rest of round). Params: form, frames, heal (hp), energy (gain), visual.
 */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { addStatus } from '../game/sim/status';
import { addEnergy } from '../game/sim/meters';

export const transformation: Ability = {
  type: 'transformation',
  trigger(ctx, owner, p, move) {
    owner.form = str(p, 'form', 'powered');
    addStatus(owner, 'transform', num(p, 'frames', 900), 100, owner.index);
    const healAmt = num(p, 'heal', 0);
    if (healAmt > 0) owner.hp = Math.min(owner.maxHp, owner.hp + healAmt);
    const en = num(p, 'energy', 0);
    if (en > 0) addEnergy(ctx, owner, en);
    emit(ctx, { type: 'transform', player: owner.index, x: owner.x, y: owner.y + 100 * FX, moveId: move.id,
      visual: str(p, 'visual', move.vfx ?? 'aura') });
  },
};
