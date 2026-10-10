/** Move execution: command resolution (buffer), costs/cooldowns, cancels, move script (abilities, self velocity). */
import type { MoveDef, MoveSlot } from '../../characters/types';
import type { FighterState } from './types';
import { FX, ULT_MAX } from './types';
import { BTN, has, type InputBits } from '../input/buttons';
import { BUFFER_FRAMES } from './constants';
import { emit, type SimContext } from './context';
import { currentMove, currentSlot, getDef, moveTotal } from './defs';
import { restartAnim, setMode } from './anim';
import { strengthOf } from './combat';
import { getAbility } from '../../abilities/registry';

export const BUFFERED_BTNS = BTN.LIGHT | BTN.HEAVY | BTN.SP1 | BTN.SP2 | BTN.ULT | BTN.DASH;
export const DIR_BTNS = BTN.LEFT | BTN.RIGHT | BTN.UP | BTN.DOWN;

/** Record new presses into the buffer; age the buffer (unless frozen). */
export function bufferInput(f: FighterState, input: InputBits, age: boolean): void {
  const pressedBits = input & ~f.prevInput & BUFFERED_BTNS;
  if (pressedBits) {
    f.bufInput = pressedBits | (input & DIR_BTNS);
    f.bufAge = 0;
  } else if (f.bufInput && age) {
    f.bufAge++;
    if (f.bufAge > BUFFER_FRAMES) { f.bufInput = 0; f.bufAge = 0; }
  }
}

export function clearBuffer(f: FighterState): void {
  f.bufInput = 0;
  f.bufAge = 0;
}

export type Command = { slot: MoveSlot; move: MoveDef } | { dash: true; back: boolean };

export function canAfford(f: FighterState, move: MoveDef): boolean {
  if ((f.cooldowns[move.id] ?? 0) > 0) return false;
  if (f.energy < move.energyCost) return false;
  if (move.kind === 'ultimate' && f.ult < (move.ultCost ?? ULT_MAX)) return false;
  return true;
}

/** Candidate commands for the buffered press, highest priority first (ULT > SP2 > SP1 > HEAVY > LIGHT > DASH). */
export function commandCandidates(f: FighterState, buf: InputBits, cur: InputBits): Command[] {
  const def = getDef(f.charId);
  const mv = def.moves;
  const out: Command[] = [];
  const down = has(buf | cur, BTN.DOWN);
  const air = !f.grounded;
  const push = (slot: MoveSlot) => { const m = mv[slot]; if (m) out.push({ slot, move: m }); };
  if (has(buf, BTN.ULT) && !air) push('ultimate');
  if (has(buf, BTN.SP2) && !air) push(down && mv.special2Down ? 'special2Down' : 'special2');
  if (has(buf, BTN.SP1)) {
    if (air) { if (mv.airSpecial1) push('airSpecial1'); }
    else push(down && mv.special1Down ? 'special1Down' : 'special1');
  }
  if (has(buf, BTN.HEAVY)) push(air ? 'airHeavy' : down ? 'crouchHeavy' : 'heavy');
  if (has(buf, BTN.LIGHT)) {
    if (air) push('airLight');
    else if (down) push('crouchLight');
    else {
      const cs = currentSlot(f);
      if (cs === 'light' && mv.light2) push('light2');
      push('light');
    }
  }
  if (has(buf, BTN.DASH)) {
    const backBtn = f.facing === 1 ? BTN.LEFT : BTN.RIGHT;
    out.push({ dash: true, back: has(buf | cur, backBtn) && !has(buf | cur, f.facing === 1 ? BTN.RIGHT : BTN.LEFT) });
  }
  return out;
}

/** Cancel rules from the current (connected) move into `slot`. */
export function canCancelInto(f: FighterState, cur: MoveDef, slot: MoveSlot, target: MoveDef): boolean {
  if (f.moveConnect <= 0 || f.moveFrame < cur.startup) return false;
  if (target.id === cur.id && !(cur.cancelInto ?? []).includes(slot)) return false;
  if (target.kind === 'ultimate') return cur.kind === 'special' ? f.moveConnect === 2 : cur.kind === 'normal' && f.moveConnect === 2;
  if (target.kind === 'special') return cur.kind === 'normal';
  if (target.kind === 'normal') return cur.kind === 'normal' && (cur.cancelInto ?? []).includes(slot);
  return false;
}

export function startMove(ctx: SimContext, f: FighterState, slot: MoveSlot, move: MoveDef): void {
  const st = ctx.state;
  f.energy -= move.energyCost;
  if (move.cooldown > 0) f.cooldowns[move.id] = move.cooldown;
  if (move.kind === 'ultimate') f.ult = Math.max(0, f.ult - (move.ultCost ?? ULT_MAX));
  setMode(f, 'attack');
  f.moveId = move.id;
  f.moveFrame = 0;
  f.moveHit = false;
  f.moveHits = 0;
  f.moveConnect = 0;
  if (f.grounded) f.vx = Math.trunc(f.vx / 3);
  restartAnim(f, move.anim);
  clearBuffer(f);
  const strength = strengthOf(move.kind, slot);
  const ev = { player: f.index, x: f.x, y: f.y, moveId: move.id, strength, visual: move.vfx, sfx: move.sfx } as const;
  if (move.kind === 'ultimate') {
    f.stats.ultimatesUsed++;
    emit(ctx, { type: 'ultimateStart', ...ev });
    if (move.cinematicFrames && move.cinematicFrames > 0) {
      st.cinematic = { active: true, owner: f.index, framesLeft: move.cinematicFrames, total: move.cinematicFrames, moveId: move.id };
    }
  } else if (move.kind === 'special') {
    f.stats.specialsUsed++;
    emit(ctx, { type: 'specialStart', ...ev });
  } else {
    emit(ctx, { type: 'moveStart', ...ev });
  }
  runMoveFrame(ctx, f, move);
}

/** Apply per-frame scripted data for the current moveFrame (self velocity, ability triggers). */
function runMoveFrame(ctx: SimContext, f: FighterState, move: MoveDef): void {
  if (move.selfVelocity) {
    for (const sv of move.selfVelocity) {
      if (sv.frame !== f.moveFrame) continue;
      f.vx = sv.vx * FX * f.facing;
      if (sv.vy !== 0) { f.vy = sv.vy * FX; if (sv.vy > 0) f.grounded = false; }
    }
  }
  if (move.abilities) {
    for (const ab of move.abilities) {
      if (ab.frame === f.moveFrame) getAbility(ab.type)?.trigger(ctx, f, ab.params, move);
      if (f.mode !== 'attack' || f.moveId !== move.id) return; // ability ended/changed the move
    }
  }
}

export function endMove(ctx: SimContext, f: FighterState): void {
  f.moveId = null;
  if (f.grounded) setMode(f, has(ctx.inputs[f.index], BTN.DOWN) ? 'crouch' : 'idle');
  else setMode(f, 'jump');
}

/** Advance the active move one frame. */
export function tickMove(ctx: SimContext, f: FighterState): void {
  const m = currentMove(f);
  if (!m) { endMove(ctx, f); return; }
  f.moveFrame++;
  runMoveFrame(ctx, f, m);
  if (f.mode !== 'attack' || f.moveId !== m.id) return;
  if (m.abilities) {
    for (const ab of m.abilities) {
      const t = f.moveFrame - ab.frame;
      if (t >= 1) getAbility(ab.type)?.tick?.(ctx, f, ab.params, m, t);
      if (f.mode !== 'attack' || f.moveId !== m.id) return;
    }
  }
  if (f.moveFrame >= moveTotal(m)) endMove(ctx, f);
}

/** Try to start a move/dash from the buffer. `cancelFrom` = current move when cancelling. */
export function tryBufferedMove(ctx: SimContext, f: FighterState, cancelFrom: MoveDef | null,
  onDash: (back: boolean) => boolean): boolean {
  if (!f.bufInput) return false;
  const cands = commandCandidates(f, f.bufInput, ctx.inputs[f.index]);
  for (const c of cands) {
    if ('dash' in c) {
      if (cancelFrom) continue;
      if (onDash(c.back)) { clearBuffer(f); return true; }
      continue;
    }
    if (!canAfford(f, c.move)) continue;
    if (cancelFrom && !canCancelInto(f, cancelFrom, c.slot, c.move)) continue;
    startMove(ctx, f, c.slot, c.move);
    return true;
  }
  return false;
}
