/**
 * Summon: autonomous clone(s) (kind 'summon', bottom-anchored) that run toward the opponent, wind up and strike once,
 * then poof. Struck clones poof and absorb the hit. data.anim / data.animFrame tell the renderer which pose to draw.
 * Params: count, speed (px/f), life, delayStep (frames between clones), spacing (px), attackRange (px), windup,
 *         recover, w, h, visual, + hit keys (damage, kbx, kby, hitstun, blockstun, level, knockdown...).
 */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { spawnEntity } from '../game/sim/entities';
import { applyHit, canBeHit, specFromEntity } from '../game/sim/combat';
import { hurtboxFx, overlapCenter, overlaps, relBoxFx } from '../game/sim/boxes';
import { clampX, foe, hitData } from './common';

function setAnim(e: { data: Record<string, number | string | boolean> }, anim: string) {
  if (e.data.anim !== anim) { e.data.anim = anim; e.data.animFrame = 0; }
}

export const summon: Ability = {
  type: 'summon',
  trigger(ctx, owner, p, move) {
    const count = Math.max(1, num(p, 'count', 1));
    const visual = str(p, 'visual', move.vfx ?? 'clone');
    for (let i = 0; i < count; i++) {
      const x = clampX(owner.x + owner.facing * (num(p, 'offsetX', 30) - i * num(p, 'spacing', 50)) * FX);
      spawnEntity(ctx, {
        kind: 'summon', owner: owner.index, abilityType: 'summon', moveId: move.id, visual,
        x, y: 0, facing: owner.facing, w: num(p, 'w', 60), h: num(p, 'h', 180),
        life: num(p, 'life', 150), hitsLeft: 1, power: 0,
        data: {
          ...hitData(p), phase: 'run', t: 0, delay: i * num(p, 'delayStep', 10), speed: num(p, 'speed', 11),
          attackRange: num(p, 'attackRange', 70), windup: num(p, 'windup', 7), recover: num(p, 'recover', 12),
          anim: 'idle', animFrame: 0,
        },
      });
      emit(ctx, { type: 'summon', player: owner.index, x, y: 0, moveId: move.id, visual });
    }
  },
  updateEntity(ctx, e) {
    const o = foe(ctx.state, e.owner);
    const d = e.data;
    d.animFrame = (d.animFrame as number) + 1;
    d.t = (d.t as number) + 1;
    switch (d.phase) {
      case 'run': {
        if (e.age < (d.delay as number)) { setAnim(e, 'idle'); return; }
        e.facing = o.x >= e.x ? 1 : -1;
        setAnim(e, 'walkFwd');
        const dist = Math.abs(o.x - e.x);
        if (dist <= (d.attackRange as number) * FX) { d.phase = 'windup'; d.t = 0; setAnim(e, 'light2'); return; }
        e.x = clampX(e.x + e.facing * (d.speed as number) * FX);
        return;
      }
      case 'windup': {
        if ((d.t as number) < (d.windup as number)) return;
        setAnim(e, 'heavy');
        const hb = relBoxFx(e.x, e.y, e.facing, { x: 0, y: 60, w: (d.attackRange as number) + 30, h: 90 });
        const hu = hurtboxFx(o);
        if (e.hitsLeft > 0 && overlaps(hb, hu) && canBeHit(ctx, o)) {
          const r = applyHit(ctx, e.owner, o, specFromEntity(ctx, e), e.facing, overlapCenter(hb, hu), { entity: e });
          if (r !== 'whiff') e.hitsLeft = 0;
        }
        d.phase = 'recover';
        d.t = 0;
        return;
      }
      case 'recover':
        if ((d.t as number) >= (d.recover as number)) e.life = 0;
        return;
    }
  },
  onEntityStruck(ctx, e, _attacker, spec, spark) {
    e.life = 0;
    ctx.state.hitstop = Math.max(ctx.state.hitstop, 4);
    emit(ctx, { type: 'hit', player: _attacker, x: spark.x, y: spark.y, moveId: spec.moveId, damage: 0,
      strength: 'light', visual: 'smoke' });
    return true;
  },
  onExpire(ctx, e) {
    emit(ctx, { type: 'summon', player: e.owner, x: e.x, y: e.y, moveId: e.moveId, visual: 'smoke' });
  },
};
