/** Movement integration, gravity, landing, friction, push boxes, stage bounds, max distance. */
import type { FighterState } from './types';
import { FX, MAX_FIGHTER_DISTANCE_PX, STAGE_MARGIN_PX, STAGE_WIDTH_PX } from './types';
import {
  AIR_DASH_FRAMES, KNOCKDOWN_FRAMES, LANDING_REBUFFER_FRAMES, MAX_FALL_SPEED, PUSH_HALF_W_PX, PUSH_HEIGHT_PX,
} from './constants';
import { emit, type SimContext } from './context';
import { currentMove, currentSlot } from './defs';
import { BTN } from '../input/buttons';
import { DIR_BTNS } from './moves';
import { effStats } from './stats';
import { restartAnim, setMode } from './anim';

export const STAGE_MIN_X = STAGE_MARGIN_PX * FX;
export const STAGE_MAX_X = (STAGE_WIDTH_PX - STAGE_MARGIN_PX) * FX;

function land(ctx: SimContext, f: FighterState): void {
  f.y = 0;
  f.vy = 0;
  f.grounded = true;
  f.airActions = 0;
  f.juggle = 0;
  switch (f.mode) {
    case 'knockback':
      setMode(f, 'knockdown');
      f.stunFrames = KNOCKDOWN_FRAMES;
      f.knockdownOnLand = false;
      f.vx = Math.trunc(f.vx / 3);
      restartAnim(f, 'knockdown');
      emit(ctx, { type: 'knockdown', player: f.index, x: f.x, y: 0 });
      break;
    case 'hitstun':
      if (f.knockdownOnLand) {
        setMode(f, 'knockdown');
        f.stunFrames = KNOCKDOWN_FRAMES;
        f.knockdownOnLand = false;
        restartAnim(f, 'knockdown');
        emit(ctx, { type: 'knockdown', player: f.index, x: f.x, y: 0 });
      }
      break;
    case 'jump':
    case 'dash':
      setMode(f, 'idle');
      f.vx = 0;
      emit(ctx, { type: 'land', player: f.index, x: f.x, y: 0 });
      break;
    case 'attack': {
      const slot = currentSlot(f);
      if (slot && (slot.startsWith('air'))) {
        rebufferLandedMove(ctx, f, slot);
        f.moveId = null;
        setMode(f, 'idle');
        f.vx = 0;
        emit(ctx, { type: 'land', player: f.index, x: f.x, y: 0 });
      }
      break;
    }
    case 'ko':
      f.vx = Math.trunc(f.vx / 2);
      emit(ctx, { type: 'land', player: f.index, x: f.x, y: 0, visual: 'heavyLand' });
      break;
    default:
      break;
  }
}

const AIR_SLOT_BTN: Record<string, number> = { airLight: BTN.LIGHT, airHeavy: BTN.HEAVY, airSpecial1: BTN.SP1 };

/**
 * An air move pressed just before touching the ground would be eaten by the landing. If it started recently and
 * hasn't done anything yet (not active, no ability fired), refund it and re-buffer its button so the ground version
 * comes out on the next frame — a late jump-in press always produces an attack.
 */
function rebufferLandedMove(ctx: SimContext, f: FighterState, slot: string): void {
  const m = currentMove(f);
  const btn = AIR_SLOT_BTN[slot];
  if (!m || !btn || f.moveFrame > LANDING_REBUFFER_FRAMES || f.moveFrame >= m.startup || f.moveConnect > 0) return;
  const firstAbility = m.abilities?.length ? Math.min(...m.abilities.map((a) => a.frame)) : Infinity;
  if (f.moveFrame >= firstAbility) return;
  f.energy += m.energyCost;
  delete f.cooldowns[m.id];
  if (m.kind === 'special') f.stats.specialsUsed = Math.max(0, f.stats.specialsUsed - 1);
  f.bufInput = btn | (ctx.inputs[f.index] & DIR_BTNS);
  f.bufAge = 0;
}

export function integrate(ctx: SimContext, f: FighterState): void {
  if (!f.grounded) {
    const airDashHold = f.mode === 'dash' && f.modeFrame < AIR_DASH_FRAMES - 4;
    if (!airDashHold) f.vy = Math.max(-MAX_FALL_SPEED, f.vy - effStats(f).gravity);
  }
  f.x += f.vx;
  f.y += f.vy;
  if (!f.grounded && f.y <= 0 && f.vy <= 0) land(ctx, f);
  else if (f.y < 0) f.y = 0;

  if (f.grounded) {
    switch (f.mode) {
      case 'idle': case 'crouch': case 'block': case 'intro': case 'victory':
        f.vx = 0; break;
      case 'walk': case 'dash':
        break;
      case 'attack':
        f.vx = Math.trunc((f.vx * 78) / 100); break;
      case 'hitstun': case 'blockstun':
        f.vx = Math.trunc((f.vx * 86) / 100); break;
      default:
        f.vx = Math.trunc((f.vx * 75) / 100); break;
    }
    if (Math.abs(f.vx) < 20 && f.mode !== 'walk') f.vx = 0;
  }
}

function clampStage(f: FighterState): void {
  if (f.x < STAGE_MIN_X) { f.x = STAGE_MIN_X; if (f.vx < 0) f.vx = 0; }
  if (f.x > STAGE_MAX_X) { f.x = STAGE_MAX_X; if (f.vx > 0) f.vx = 0; }
}

/** Separate overlapping fighters, keep inside stage and within max distance. */
export function resolveFighters(ctx: SimContext): void {
  const [a, b] = ctx.state.fighters;
  clampStage(a);
  clampStage(b);

  // Max distance (camera limit): pull back whoever is moving away.
  const maxD = MAX_FIGHTER_DISTANCE_PX * FX;
  let dist = Math.abs(a.x - b.x);
  if (dist > maxD) {
    const excess = dist - maxD;
    const aRight = a.x > b.x;
    const aAway = aRight ? a.vx > 0 : a.vx < 0;
    const bAway = aRight ? b.vx < 0 : b.vx > 0;
    let ea = 0, eb = 0;
    if (aAway && !bAway) ea = excess;
    else if (bAway && !aAway) eb = excess;
    else { ea = Math.trunc(excess / 2); eb = excess - ea; }
    a.x += aRight ? -ea : ea;
    b.x += aRight ? eb : -eb;
  }

  // Push boxes.
  const lyingA = a.mode === 'knockdown' || a.mode === 'ko';
  const lyingB = b.mode === 'knockdown' || b.mode === 'ko';
  if (Math.abs(a.y - b.y) < PUSH_HEIGHT_PX * FX && !(lyingA && lyingB)) {
    const minD = PUSH_HALF_W_PX * 2 * FX;
    const dx = b.x - a.x;
    dist = Math.abs(dx);
    if (dist < minD) {
      const sign = dx > 0 ? 1 : dx < 0 ? -1 : (a.facing === 1 ? 1 : -1);
      const overlap = minD - dist;
      let pa = Math.trunc(overlap / 2);
      let pb = overlap - pa;
      // fighter with momentum toward the other pushes harder (walking pushes)
      a.x -= sign * pa;
      b.x += sign * pb;
      // wall transfer
      for (let i = 0; i < 2; i++) {
        if (a.x < STAGE_MIN_X) { b.x += STAGE_MIN_X - a.x; a.x = STAGE_MIN_X; }
        if (a.x > STAGE_MAX_X) { b.x -= a.x - STAGE_MAX_X; a.x = STAGE_MAX_X; }
        if (b.x < STAGE_MIN_X) { a.x += STAGE_MIN_X - b.x; b.x = STAGE_MIN_X; }
        if (b.x > STAGE_MAX_X) { a.x -= b.x - STAGE_MAX_X; b.x = STAGE_MAX_X; }
      }
      pa = pb = 0;
    }
  }
  clampStage(a);
  clampStage(b);
}
