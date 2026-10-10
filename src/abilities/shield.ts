/**
 * Shield: temporary barrier entity (kind 'shield', centered rect) that absorbs opposing projectiles and melee hits
 * until its hp (data.hp) is depleted. Params: w, h, offsetX, offsetY, life, hp, follow (bool), visual.
 */
import type { Ability } from './types';
import { bool, num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { ownerPoint } from './common';

export const shield: Ability = {
  type: 'shield',
  trigger(ctx, owner, p, move) {
    const at = ownerPoint(owner, p, 'offsetX', 'offsetY', 50, 100);
    const visual = str(p, 'visual', move.vfx ?? 'shield');
    spawnEntity(ctx, {
      kind: 'shield', owner: owner.index, abilityType: 'shield', moveId: move.id, visual,
      x: at.x, y: at.y, facing: owner.facing, w: num(p, 'w', 70), h: num(p, 'h', 200),
      life: num(p, 'life', 120), hitsLeft: 0, power: 0,
      data: { hp: num(p, 'hp', 120), follow: bool(p, 'follow', true), offsetX: num(p, 'offsetX', 50), offsetY: num(p, 'offsetY', 100) },
    });
    emit(ctx, { type: 'shield', player: owner.index, x: at.x, y: at.y, moveId: move.id, visual });
  },
  updateEntity(ctx, e) {
    if (e.data.follow !== true) return;
    const o = ctx.state.fighters[e.owner];
    e.facing = o.facing;
    e.x = o.x + o.facing * (e.data.offsetX as number) * FX;
    e.y = o.y + (e.data.offsetY as number) * FX;
  },
  onEntityStruck(ctx, e, attacker, spec, spark) {
    e.data.hp = (e.data.hp as number) - Math.max(1, spec.damage);
    const broke = (e.data.hp as number) <= 0;
    if (broke) e.life = 0;
    ctx.state.hitstop = Math.max(ctx.state.hitstop, Math.trunc(spec.hitstop / 2));
    const atk = ctx.state.fighters[attacker];
    if (!spec.projectile && atk.grounded) atk.vx = -atk.facing * 600;
    emit(ctx, { type: 'shield', player: e.owner, x: spark.x, y: spark.y, moveId: e.moveId,
      visual: broke ? 'shieldBreak' : e.visual, damage: 0 });
    return true;
  },
};
