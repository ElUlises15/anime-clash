/**
 * Teleport: reposition relative to the opponent (behind/front) or self (forward/back) with i-frames.
 * Follow-up hits are regular move hitboxes after the teleport frame.
 * Params: mode ('behind'|'front'|'forward'|'back'), distance (px), invuln (frames), matchHeight (bool), visual.
 */
import type { Ability } from './types';
import { bool, num, str } from './types';
import type { FighterState } from '../game/sim/types';
import { FX } from '../game/sim/types';
import { emit, type SimContext } from '../game/sim/context';
import { clampX, foe, STAGE_MAX, STAGE_MIN } from './common';

/** Move `f` to the far side of `target` (relative to f), clamped to stage; falls back to near side at walls. */
export function teleportBehind(ctx: SimContext, f: FighterState, target: FighterState, distancePx: number, visual: string, moveId?: string) {
  emit(ctx, { type: 'teleport', player: f.index, x: f.x, y: f.y, moveId, visual });
  const side = target.x >= f.x ? 1 : -1;
  let x = target.x + side * distancePx * FX;
  if (x < STAGE_MIN || x > STAGE_MAX) x = target.x - side * distancePx * FX;
  f.x = clampX(x);
  f.vx = 0;
  f.facing = target.x >= f.x ? 1 : -1;
  emit(ctx, { type: 'teleport', player: f.index, x: f.x, y: f.y, moveId, visual });
}

export const teleport: Ability = {
  type: 'teleport',
  trigger(ctx, owner, p, move) {
    const o = foe(ctx.state, owner);
    const mode = str(p, 'mode', 'behind');
    const dist = num(p, 'distance', 70);
    const visual = str(p, 'visual', move.vfx ?? 'teleport');
    owner.invulnFrames = Math.max(owner.invulnFrames, num(p, 'invuln', 12));
    if (mode === 'behind') {
      teleportBehind(ctx, owner, o, dist, visual, move.id);
    } else {
      emit(ctx, { type: 'teleport', player: owner.index, x: owner.x, y: owner.y, moveId: move.id, visual });
      const side = o.x >= owner.x ? 1 : -1;
      if (mode === 'front') owner.x = clampX(o.x - side * dist * FX);
      else if (mode === 'forward') owner.x = clampX(owner.x + owner.facing * dist * FX);
      else owner.x = clampX(owner.x - owner.facing * dist * FX);
      owner.vx = 0;
      owner.facing = o.x >= owner.x ? 1 : -1;
      emit(ctx, { type: 'teleport', player: owner.index, x: owner.x, y: owner.y, moveId: move.id, visual });
    }
    if (bool(p, 'matchHeight', false) && !o.grounded) {
      owner.y = o.y;
      owner.vy = 0;
      owner.grounded = false;
    }
  },
};
