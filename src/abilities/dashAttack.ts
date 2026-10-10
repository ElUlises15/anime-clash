/**
 * DashAttack: the owner travels fast during the move's active window with its melee hitbox; stops on contact.
 * Params: speed (px/f), frames (travel frames), orb (bool: spawn a visual-only entity following the hand),
 *         orbOffsetX, orbOffsetY, orbSize, visual.
 */
import type { Ability } from './types';
import { bool, num } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { visualOf } from './common';

export const dashAttack: Ability = {
  type: 'dashAttack',
  trigger(ctx, owner, p, move) {
    owner.vx = owner.facing * num(p, 'speed', 14) * FX;
    const visual = visualOf(p, move, 'dashTrail');
    emit(ctx, { type: 'dash', player: owner.index, x: owner.x, y: owner.y, moveId: move.id, visual });
    if (bool(p, 'orb', false)) {
      spawnEntity(ctx, {
        kind: 'projectile', owner: owner.index, abilityType: 'dashAttack', moveId: move.id, visual,
        x: owner.x + owner.facing * num(p, 'orbOffsetX', 55) * FX, y: owner.y + num(p, 'orbOffsetY', 105) * FX,
        facing: owner.facing, w: num(p, 'orbSize', 44), h: num(p, 'orbSize', 44), life: 600, hitsLeft: 0, power: 0,
        data: { follow: true, offsetX: num(p, 'orbOffsetX', 55), offsetY: num(p, 'orbOffsetY', 105) },
      });
    }
  },
  tick(ctx, owner, p, move, t) {
    const end = move.startup + move.active;
    if (owner.moveHit || owner.moveConnect > 0) {
      owner.vx = 0;
      if (owner.moveFrame < end) owner.moveFrame = end; // skip to recovery on contact
      return;
    }
    if (t < num(p, 'frames', move.active) && owner.moveFrame < end) owner.vx = owner.facing * num(p, 'speed', 14) * FX;
  },
  updateEntity(ctx, e) {
    // visual-only orb following the owner's hand
    const o = ctx.state.fighters[e.owner];
    if (o.mode !== 'attack' || o.moveId !== e.moveId) { e.life = 0; return; }
    e.facing = o.facing;
    e.x = o.x + o.facing * (e.data.offsetX as number) * FX;
    e.y = o.y + (e.data.offsetY as number) * FX;
  },
};
