/** Fighter creation and per-frame state machine (movement, dash, jump, block, stun recovery, move ticking). */
import type { Facing, FighterState, PlayerIndex } from './types';
import { BTN, has, pressed, type InputBits } from '../input/buttons';
import {
  AIR_DASH_FRAMES, BACKDASH_INVULN, DASH_CANCEL_FRAME, ENERGY_START, GETUP_FRAMES, GETUP_INVULN,
} from './constants';
import { emit, opponentOf, type SimContext } from './context';
import { baseStats, currentMove } from './defs';
import { effStats } from './stats';
import { setMode, switchAnim, restartAnim } from './anim';
import { endMove, tickMove, tryBufferedMove } from './moves';
import { tickStatuses } from './status';

export function emptyStats(): FighterState['stats'] {
  return { damageDealt: 0, hitsLanded: 0, maxCombo: 0, blocks: 0, specialsUsed: 0, ultimatesUsed: 0, roundsWon: 0 };
}

export function createFighter(index: PlayerIndex, charId: string, x: number, facing: Facing): FighterState {
  const hp = baseStats(charId).health;
  return {
    index, charId, x, y: 0, vx: 0, vy: 0, facing, grounded: true,
    hp, maxHp: hp, energy: ENERGY_START, ult: 0,
    mode: 'intro', modeFrame: 0, anim: 'intro', animFrame: 0,
    moveId: null, moveFrame: 0, moveHit: false, stunFrames: 0, invulnFrames: 0, armorFrames: 0, airActions: 0,
    cooldowns: {}, statuses: [], form: null, comboTaken: 0, comboDamage: 0, prevInput: 0, lastDirTap: 0,
    stats: emptyStats(),
    bufInput: 0, bufAge: 0, juggle: 0, moveHits: 0, moveConnect: 0, knockdownOnLand: false, lastHitFrame: -1,
  };
}

/** Reset per-round state (keeps ult meter and match stats). */
export function resetFighterForRound(f: FighterState, x: number, facing: Facing): void {
  const keep = { ult: f.ult, stats: f.stats, charId: f.charId, index: f.index };
  Object.assign(f, createFighter(keep.index, keep.charId, x, facing));
  f.ult = keep.ult;
  f.stats = keep.stats;
}

const NEUTRAL_GROUND = new Set(['idle', 'walk', 'crouch', 'block']);

export function isActionable(f: FighterState): boolean {
  if (f.grounded) return NEUTRAL_GROUND.has(f.mode);
  return f.mode === 'jump';
}

function autoFace(f: FighterState, opp: FighterState): void {
  if (opp.x > f.x) f.facing = 1;
  else if (opp.x < f.x) f.facing = -1;
}

function dirOf(input: InputBits): -1 | 0 | 1 {
  const l = has(input, BTN.LEFT), r = has(input, BTN.RIGHT);
  return l === r ? 0 : r ? 1 : -1;
}

export function startJump(ctx: SimContext, f: FighterState, dir: -1 | 0 | 1, double: boolean): void {
  const s = effStats(f);
  f.moveId = null;
  setMode(f, 'jump');
  f.vy = double ? Math.trunc((s.jumpVelocity * 88) / 100) : s.jumpVelocity;
  f.vx = dir * s.jumpVx;
  f.grounded = false;
  if (double) f.airActions++;
  restartAnim(f, 'jump');
  emit(ctx, { type: 'jump', player: f.index, x: f.x, y: f.y, visual: double ? 'doubleJump' : 'jump' });
}

/** Start ground dash/backdash or air dash. Returns false if not allowed. */
export function startDash(ctx: SimContext, f: FighterState, back: boolean): boolean {
  const s = effStats(f);
  if (!f.grounded) {
    if (f.mode !== 'jump' || f.airActions >= s.airActions) return false;
    f.airActions++;
    setMode(f, 'dash');
    f.vy = 0;
    f.vx = (back ? -f.facing : f.facing) * Math.trunc((s.dashSpeed * 90) / 100);
    restartAnim(f, back ? 'backdash' : 'dash');
    emit(ctx, { type: 'dash', player: f.index, x: f.x, y: f.y, visual: 'airDash' });
    return true;
  }
  setMode(f, 'dash');
  f.moveId = null;
  if (back) {
    f.vx = -f.facing * Math.trunc((s.dashSpeed * 85) / 100);
    f.invulnFrames = Math.max(f.invulnFrames, BACKDASH_INVULN[1]);
    restartAnim(f, 'backdash');
  } else {
    f.vx = f.facing * s.dashSpeed;
    restartAnim(f, 'dash');
  }
  emit(ctx, { type: 'dash', player: f.index, x: f.x, y: f.y, visual: back ? 'backdash' : 'dash' });
  return true;
}

function dashDuration(f: FighterState): number {
  const s = effStats(f);
  if (!f.grounded) return AIR_DASH_FRAMES;
  return f.anim === 'backdash' ? s.dashFrames + 4 : s.dashFrames;
}

function tickDash(ctx: SimContext, f: FighterState): void {
  const dur = dashDuration(f);
  if (f.grounded && f.modeFrame > dur - 4) f.vx = Math.trunc((f.vx * 65) / 100);
  if (!f.grounded && f.modeFrame < AIR_DASH_FRAMES - 4) f.vy = 0;
  if (f.modeFrame >= dur) {
    if (f.grounded) { setMode(f, 'idle'); f.vx = 0; } else setMode(f, 'jump');
  }
}

/** Neutral control: buffered attacks, jump, block, crouch, walk. */
function control(ctx: SimContext, f: FighterState, input: InputBits): void {
  const opp = opponentOf(ctx, f);
  if (f.grounded) autoFace(f, opp);
  if (tryBufferedMove(ctx, f, null, (back) => startDash(ctx, f, back))) return;
  const s = effStats(f);
  if (f.grounded) {
    if (has(input, BTN.UP)) { startJump(ctx, f, dirOf(input), false); return; }
    if (has(input, BTN.BLOCK)) {
      if (f.mode !== 'block') setMode(f, 'block');
      f.vx = 0;
      switchAnim(f, has(input, BTN.DOWN) ? 'crouchBlock' : 'block');
      return;
    }
    if (has(input, BTN.DOWN)) {
      if (f.mode !== 'crouch') setMode(f, 'crouch');
      f.vx = 0;
      return;
    }
    const d = dirOf(input);
    if (d !== 0) {
      if (f.mode !== 'walk') setMode(f, 'walk');
      f.vx = d === f.facing ? d * s.walkSpeed : d * s.backWalkSpeed;
      return;
    }
    if (f.mode !== 'idle') setMode(f, 'idle');
    f.vx = 0;
    return;
  }
  // airborne neutral
  if (pressed(input, f.prevInput, BTN.UP) && f.airActions < s.airActions && f.modeFrame > 3) {
    startJump(ctx, f, dirOf(input), true);
  }
}

/** One simulated frame for one fighter (before physics). */
export function updateFighter(ctx: SimContext, f: FighterState, input: InputBits): void {
  f.modeFrame++;
  if (f.invulnFrames > 0) f.invulnFrames--;
  if (f.armorFrames > 0) f.armorFrames--;
  for (const k of Object.keys(f.cooldowns)) {
    if (f.cooldowns[k] > 1) f.cooldowns[k]--;
    else delete f.cooldowns[k];
  }
  tickStatuses(ctx, f);

  switch (f.mode) {
    case 'hitstun':
      if (--f.stunFrames <= 0) {
        f.stunFrames = 0;
        if (f.grounded) setMode(f, 'idle');
        else setMode(f, f.knockdownOnLand ? 'knockback' : 'jump');
      }
      break;
    case 'blockstun':
      if (--f.stunFrames <= 0) {
        f.stunFrames = 0;
        if (f.grounded) setMode(f, has(input, BTN.BLOCK) ? 'block' : 'idle');
        else setMode(f, 'jump');
      }
      break;
    case 'knockdown':
      if (--f.stunFrames <= 0) {
        setMode(f, 'getup');
        f.stunFrames = GETUP_FRAMES;
        f.invulnFrames = Math.max(f.invulnFrames, GETUP_INVULN);
        emit(ctx, { type: 'getup', player: f.index, x: f.x, y: f.y });
      }
      break;
    case 'getup':
      if (--f.stunFrames <= 0) { f.stunFrames = 0; setMode(f, 'idle'); }
      break;
    case 'dash':
      tickDash(ctx, f);
      if (f.mode === 'dash' && f.grounded && f.anim === 'dash' && f.modeFrame >= DASH_CANCEL_FRAME) {
        // forward dash can be cancelled into attacks, or into guard (dash in, then block)
        if (!tryBufferedMove(ctx, f, null, () => false) && has(input, BTN.BLOCK)) {
          setMode(f, 'idle');
          f.vx = Math.trunc(f.vx / 3);
        }
      }
      break;
    case 'attack': {
      tickMove(ctx, f);
      const m = currentMove(f);
      if (m && f.moveConnect > 0) {
        if (!tryBufferedMove(ctx, f, m, () => false)
          && m.launcher && f.moveConnect === 2 && f.grounded && has(input, BTN.UP) && f.moveFrame >= m.startup) {
          startJump(ctx, f, dirOf(input), false); // jump-cancel launcher on hit
        }
      }
      break;
    }
    case 'knockback':
      if (f.grounded) { setMode(f, 'knockdown'); f.stunFrames = 20; }
      break;
    default:
      break;
  }

  if (f.mode !== 'hitstun' && f.mode !== 'knockback' && f.mode !== 'knockdown' && f.mode !== 'blockstun') {
    f.comboTaken = 0;
  }
  if (f.mode !== 'attack') f.moveId = null;
  if (isActionable(f)) control(ctx, f, input);
}
