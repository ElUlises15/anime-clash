/**
 * Counter / parry: opens a window (status 'counter'). If the owner would be hit during it (melee or entity), the hit
 * is negated ('parry'), the attacking entity is destroyed, and the owner auto-strikes ('counterHit').
 * Params: window (frames), response ('strike' | 'teleportStrike'), range (px, for 'strike'), distance (teleport px),
 *         invulnAfter (frames), visual, + hit keys for the auto-strike (damage, kbx, kby, hitstun, knockdown...).
 */
import type { Ability } from './types';
import { num, str } from './types';
import { FX } from '../game/sim/types';
import { emit } from '../game/sim/context';
import { addStatus, hasStatus, removeStatus } from '../game/sim/status';
import { applyHit, specFromParams } from '../game/sim/combat';
import { hurtboxFx } from '../game/sim/boxes';
import { restartAnim } from '../game/sim/anim';
import { slotOf } from './common';
import { teleportBehind } from './teleport';
import { currentMove } from '../game/sim/defs';

export const counter: Ability = {
  type: 'counter',
  trigger(ctx, owner, p) {
    addStatus(owner, 'counter', num(p, 'window', 20), 0, owner.index);
  },
  tick(ctx, owner, p, move, t) {
    if (t >= num(p, 'window', 20)) removeStatus(owner, 'counter');
  },
  interceptHit(ctx, owner, attacker, p, spec, dir, source) {
    if (!hasStatus(owner, 'counter')) return false;
    const move = currentMove(owner);
    if (!move) return false;
    removeStatus(owner, 'counter');
    const st = ctx.state;
    const atk = st.fighters[attacker];
    const visual = str(p, 'visual', move.vfx ?? 'parry');
    emit(ctx, { type: 'parry', player: owner.index, x: owner.x, y: owner.y + 110 * FX, moveId: move.id, visual });
    if (source.entity) source.entity.life = 0;
    owner.invulnFrames = Math.max(owner.invulnFrames, num(p, 'invulnAfter', 20));
    st.hitstop = Math.max(st.hitstop, 10);

    const response = str(p, 'response', 'strike');
    if (response === 'teleportStrike') teleportBehind(ctx, owner, atk, num(p, 'distance', 70), visual, move.id);
    else owner.facing = atk.x >= owner.x ? 1 : -1;

    const inRange = response === 'teleportStrike' || Math.abs(atk.x - owner.x) <= num(p, 'range', 120) * FX;
    // recovery starts now
    owner.moveFrame = Math.max(owner.moveFrame, move.startup + move.active);
    owner.moveHit = true;
    owner.moveConnect = 2;
    restartAnim(owner, 'counter');
    if (inRange) {
      const hu = hurtboxFx(atk);
      const spark = { x: hu.x + hu.w / 2, y: hu.y + Math.trunc((hu.h * 2) / 3) };
      emit(ctx, { type: 'counterHit', player: owner.index, x: spark.x, y: spark.y, moveId: move.id, visual });
      const hs = specFromParams(move, slotOf(owner, move), p, false);
      hs.level = 'unblockable';
      applyHit(ctx, owner.index, atk, hs, owner.facing, spark);
    }
    return true;
  },
};
