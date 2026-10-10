/**
 * Beam: sustained hitbox anchored at the owner's hand, extending forward and growing. Multi-hit.
 * Entity: kind 'beam', (x,y) = origin on beam center-line, w = current length (px, also data.length), h = thickness.
 * Ends when duration elapses or the owner leaves the move (interrupted).
 * Params: duration, maxLength, growSpeed, thickness, offsetX, offsetY, hits, interval, power, visual,
 *         finalKnockdown, finalKbx, finalKby, + hit keys.
 */
import type { Ability } from './types';
import { num } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { hitData, ownerPoint, visualOf } from './common';

export const beam: Ability = {
  type: 'beam',
  trigger(ctx, owner, p, move) {
    const at = ownerPoint(owner, p, 'offsetX', 'offsetY', 50, 115);
    const visual = visualOf(p, move, 'kamehameha');
    const grow = num(p, 'growSpeed', 60);
    spawnEntity(ctx, {
      kind: 'beam', owner: owner.index, abilityType: 'beam', moveId: move.id, visual,
      x: at.x, y: at.y, facing: owner.facing, w: grow, h: num(p, 'thickness', 56),
      life: num(p, 'duration', 40), hitsLeft: num(p, 'hits', 6), power: num(p, 'power', 3),
      data: {
        ...hitData(p), interval: num(p, 'interval', 6), length: grow, maxLength: num(p, 'maxLength', 900), grow,
        offsetX: num(p, 'offsetX', 50), offsetY: num(p, 'offsetY', 115),
      },
    });
    emit(ctx, { type: 'beamStart', player: owner.index, x: at.x, y: at.y, moveId: move.id, visual, sfx: move.sfx,
      strength: move.kind === 'ultimate' ? 'ultimate' : 'special' });
  },
  updateEntity(ctx, e) {
    const o = ctx.state.fighters[e.owner];
    if (o.mode !== 'attack' || o.moveId !== e.moveId) { e.life = 0; return; }
    e.facing = o.facing;
    e.x = o.x + o.facing * (e.data.offsetX as number) * FX;
    e.y = o.y + (e.data.offsetY as number) * FX;
    e.w = Math.min(e.data.maxLength as number, e.w + (e.data.grow as number));
    e.data.length = e.w;
  },
  onExpire(ctx, e) {
    emit(ctx, { type: 'beamEnd', player: e.owner, x: e.x, y: e.y, moveId: e.moveId, visual: e.visual });
  },
};
