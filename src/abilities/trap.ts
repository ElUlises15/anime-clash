/**
 * Trap: placed ground entity (bottom-anchored). Arms after armDelay; when the opponent's hurtbox touches it, it
 * triggers once: hit with stun (hitstun = stun), emits 'trapTrigger'. Params: offsetX, w, h, armDelay, life, stun,
 * visual, + hit keys (damage, kbx, kby...).
 */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { applyHit, canBeHit, specFromEntity } from '../game/sim/combat';
import { entityBoxFx, hurtboxFx, overlapCenter, overlaps } from '../game/sim/boxes';
import { addStatus } from '../game/sim/status';
import { clampX, foe, hitData } from './common';

export const trap: Ability = {
  type: 'trap',
  trigger(ctx, owner, p, move) {
    const visual = str(p, 'visual', move.vfx ?? 'trap');
    const x = clampX(owner.x + owner.facing * num(p, 'offsetX', 120) * FX);
    spawnEntity(ctx, {
      kind: 'trap', owner: owner.index, abilityType: 'trap', moveId: move.id, visual,
      x, y: 0, facing: owner.facing, w: num(p, 'w', 90), h: num(p, 'h', 30),
      life: num(p, 'life', 600), hitsLeft: 1, power: 0,
      data: { ...hitData(p), armDelay: num(p, 'armDelay', 20), armed: false, stun: num(p, 'stun', 50),
        damage: num(p, 'damage', 30), kbx: num(p, 'kbx', 0), kby: num(p, 'kby', 0) },
    });
    emit(ctx, { type: 'trapSet', player: owner.index, x, y: 0, moveId: move.id, visual });
  },
  updateEntity(ctx, e) {
    if (e.data.armed !== true) {
      if (e.age >= (e.data.armDelay as number)) e.data.armed = true;
      return;
    }
    const o = foe(ctx.state, e.owner);
    const box = entityBoxFx(e);
    const hu = hurtboxFx(o);
    if (!overlaps(box, hu) || !canBeHit(ctx, o)) return;
    const spec = specFromEntity(ctx, e);
    spec.hitstun = e.data.stun as number;
    spec.level = 'unblockable';
    const spark = overlapCenter(box, hu);
    emit(ctx, { type: 'trapTrigger', player: e.owner, x: spark.x, y: spark.y, moveId: e.moveId, visual: e.visual });
    const r = applyHit(ctx, e.owner, o, spec, o.x >= e.x ? 1 : -1, spark, { entity: e });
    if (r === 'hit') addStatus(o, 'stun', e.data.stun as number, 100, e.owner);
    e.life = 0;
  },
};
