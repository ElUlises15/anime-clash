/**
 * Projectile: flies forward (speed px/f, vy px/f), hits once (or `hits` times), clashes by `power`.
 * Params: speed, vy, life, w, h, offsetX, offsetY, hits, interval, power, count, spreadVy, visual,
 *         explode (bool) + explodeRadius/explodeHits/explodeInterval/explodeDamage/explodeVisual/explodeLife (spawns AOE),
 *         + hit keys (damage, kbx, kby, hitstun, blockstun, chip, level, knockdown...).
 */
import type { Ability } from './types';
import { bool, num } from './types';
import { FX, STAGE_WIDTH_PX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { spawnEntity, defaultEntityHit } from '../game/sim/entities';
import { hitData, ownerPoint, visualOf } from './common';
import { spawnAoe } from './aoe';

export const projectile: Ability = {
  type: 'projectile',
  trigger(ctx, owner, p, move) {
    const count = Math.max(1, num(p, 'count', 1));
    const visual = visualOf(p, move, 'kiBlast');
    for (let i = 0; i < count; i++) {
      const at = ownerPoint(owner, p, 'offsetX', 'offsetY', 60, 110);
      const vy = num(p, 'vy', 0) + i * num(p, 'spreadVy', 0);
      const e = spawnEntity(ctx, {
        kind: 'projectile', owner: owner.index, abilityType: 'projectile', moveId: move.id, visual,
        x: at.x - owner.facing * i * num(p, 'spacing', 0) * FX, y: at.y,
        vx: owner.facing * num(p, 'speed', 14) * FX, vy: vy * FX, facing: owner.facing,
        w: num(p, 'w', 40), h: num(p, 'h', 40), life: num(p, 'life', 90), hitsLeft: num(p, 'hits', 1),
        power: num(p, 'power', 1),
        data: {
          ...hitData(p),
          explode: bool(p, 'explode', false),
          explodeRadius: num(p, 'explodeRadius', 150), explodeHits: num(p, 'explodeHits', 5),
          explodeInterval: num(p, 'explodeInterval', 5), explodeDamage: num(p, 'explodeDamage', 20),
          explodeLife: num(p, 'explodeLife', 40), explodeVisual: typeof p.explodeVisual === 'string' ? p.explodeVisual : 'explosion',
        },
      });
      emit(ctx, { type: 'projectileSpawn', player: owner.index, x: e.x, y: e.y, moveId: move.id, visual, sfx: move.sfx });
    }
  },
  updateEntity(ctx, e) {
    e.x += e.vx;
    e.y += e.vy;
    const halfW = (e.w * FX) / 2;
    if (e.x < -halfW || e.x > STAGE_WIDTH_PX * FX + halfW) e.life = 0;
    if (e.vy < 0 && e.y - (e.h * FX) / 2 <= 0) { e.y = (e.h * FX) / 2; e.life = 0; }
  },
  onEntityHit(ctx, e, target, spark) {
    const r = defaultEntityHit(ctx, e, target, spark);
    if (r !== 'whiff' && e.data.explode === true) e.life = 0; // explode on contact
  },
  onExpire(ctx, e) {
    if (e.data.explode === true && e.data.exploded !== true) {
      e.data.exploded = true;
      spawnAoe(ctx, e.owner, e.moveId, e.x, e.y, e.facing, {
        radius: e.data.explodeRadius as number, hits: e.data.explodeHits as number,
        interval: e.data.explodeInterval as number, damage: e.data.explodeDamage as number,
        life: e.data.explodeLife as number, visual: e.data.explodeVisual as string,
        kbx: 3, kby: 4, hitstun: 20, blockstun: 12, finalKnockdown: true, finalKbx: 10, finalKby: 12,
      });
    }
  },
};
