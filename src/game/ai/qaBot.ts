/**
 * QA / CPU bot. Deterministic: output depends only on (state, me, seed, level). Randomness is derived by hashing
 * (seed, decision bucket, player, salt) — no internal mutable state, so it is safe with rollback/re-simulation.
 * Only its OUTPUT bits enter the sim.
 */
import { BTN, type InputBits } from '../input/buttons';
import type { FighterState, MatchState, PlayerIndex } from '../sim/types';
import { FX, ULT_MAX } from '../sim/types';
import type { MoveDef, MoveSlot } from '../../characters/types';
import { currentMove, currentSlot, getDef } from '../sim/defs';
import { canAfford } from '../sim/moves';

export type BotLevel = 1 | 2 | 3;
export interface Bot { next(state: MatchState, me: PlayerIndex): InputBits }
export type DummyMode = 'idle' | 'block' | 'jump' | 'crouch';

const LEVEL = {
  1: { interval: 20, block: 250, combo: 350, aggression: 450 },
  2: { interval: 11, block: 550, combo: 750, aggression: 600 },
  3: { interval: 6, block: 780, combo: 950, aggression: 700 },
} as const;

function mix(a: number, b: number, c: number, d: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ b, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13) ^ c, 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (h >>> 16) ^ d, 0x27d4eb2f) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** Edge-press helper: only report the button if it wasn't held last frame (so the sim sees a fresh press). */
const press = (f: FighterState, btn: number) => ((f.prevInput & btn) ? 0 : btn);

function moveOf(f: FighterState, slot: MoveSlot): MoveDef | undefined {
  return getDef(f.charId).moves[slot];
}

function usable(f: FighterState, slot: MoveSlot): boolean {
  const m = moveOf(f, slot);
  return !!m && canAfford(f, m);
}

/** Is the opponent (or one of its entities) about to hit me? Returns the hit level or null. */
function threat(state: MatchState, f: FighterState, o: FighterState): MoveDef['level'] | 'none' | null {
  const dist = Math.abs(o.x - f.x) / FX;
  const m = currentMove(o);
  if (m && o.moveFrame < m.startup + m.active && dist < m.range + 70) return m.level ?? 'mid';
  for (const e of state.entities) {
    if (e.owner !== o.index || e.life <= 0) continue;
    if (e.kind === 'trap' || e.kind === 'shield') continue;
    const ed = (f.x - e.x) / FX;
    const toward = e.kind === 'beam' || e.kind === 'aoe' || (e.vx === 0 ? true : Math.sign(e.vx) === Math.sign(ed));
    const reach = e.kind === 'beam' ? e.w + 120 : 380;
    if (toward && Math.abs(ed) < reach) return 'mid';
  }
  return null;
}

export function createBot(seed: number, level: BotLevel = 2): Bot {
  const L = LEVEL[level];
  return {
    next(state: MatchState, me: PlayerIndex): InputBits {
      if (state.phase !== 'fight' || state.cinematic.active) return 0;
      const f = state.fighters[me];
      const o = state.fighters[me === 0 ? 1 : 0];
      const dx = o.x - f.x;
      const dist = Math.abs(dx) / FX;
      const fwd = dx >= 0 ? BTN.RIGHT : BTN.LEFT;
      const back = dx >= 0 ? BTN.LEFT : BTN.RIGHT;
      const bucket = Math.trunc(state.frame / L.interval);
      const rnd = (salt: number) => mix(seed, bucket, me + 1, salt) % 1000;

      // --- stunned / blocking states ---
      if (f.mode === 'blockstun') return BTN.BLOCK | (threat(state, f, o) === 'low' ? BTN.DOWN : 0);
      if (f.mode === 'hitstun' || f.mode === 'knockback' || f.mode === 'knockdown' || f.mode === 'getup') {
        return rnd(1) < L.block ? BTN.BLOCK : 0;
      }

      // --- combos / cancels while my move connected ---
      if (f.mode === 'attack') {
        const slot = currentSlot(f);
        const m = currentMove(f);
        if (!m || f.moveConnect === 0 || rnd(2) >= L.combo) return 0;
        const hit = f.moveConnect === 2;
        if (hit && f.ult >= ULT_MAX && m.kind !== 'normal') return press(f, BTN.ULT);
        switch (slot) {
          case 'light': return press(f, rnd(3) < 700 ? BTN.LIGHT : BTN.HEAVY);
          case 'crouchLight': return BTN.DOWN | press(f, BTN.HEAVY);
          case 'light2': return press(f, BTN.HEAVY);
          case 'heavy':
            if (m.launcher && hit && rnd(4) < 600) return BTN.UP | fwd;
            if (usable(f, 'special2') && rnd(4) < 800) return press(f, BTN.SP2);
            if (usable(f, 'special1')) return press(f, BTN.SP1);
            return 0;
          case 'airLight': return press(f, BTN.HEAVY);
          case 'airHeavy': return usable(f, 'airSpecial1') ? press(f, BTN.SP1) : 0;
          default: return 0;
        }
      }
      if (f.mode === 'dash') {
        return dist < 160 ? press(f, rnd(5) < 500 ? BTN.LIGHT : BTN.HEAVY) : 0;
      }

      // --- airborne ---
      if (!f.grounded) {
        const above = f.y / FX;
        if (o.mode === 'knockback' && dist < 160) return press(f, rnd(6) < 600 ? BTN.LIGHT : BTN.HEAVY);
        if (dist < 150 && f.vy < 0 && above < 200) return press(f, rnd(6) < 550 ? BTN.HEAVY : BTN.LIGHT);
        if (dist > 300 && usable(f, 'airSpecial1') && rnd(7) < 250) return press(f, BTN.SP1);
        if (f.airActions === 0 && f.vy < 200 && rnd(8) < 150) return press(f, rnd(9) < 500 ? BTN.UP : BTN.DASH) | fwd;
        return 0;
      }

      // --- ultimate ---
      const ult = moveOf(f, 'ultimate');
      if (ult && f.ult >= ULT_MAX && dist < Math.min(900, ult.range) && rnd(10) < 500) return press(f, BTN.ULT);

      // --- defense ---
      const th = threat(state, f, o);
      if (th) {
        const r = rnd(11);
        if (r < L.block) return BTN.BLOCK | (th === 'low' ? BTN.DOWN : 0);
        if (r < L.block + 60 && usable(f, 'special2Down') && getDef(f.charId).moves.special2Down?.abilities?.some((a) => a.type === 'counter')) {
          return BTN.DOWN | press(f, BTN.SP2);
        }
        if (r < L.block + 120 && usable(f, 'special1Down') && moveOf(f, 'special1Down')?.invuln) {
          return BTN.DOWN | press(f, BTN.SP1);
        }
        if (r < L.block + 160) return press(f, BTN.DASH) | back;
      }

      // --- neutral game by distance ---
      const lightRange = moveOf(f, 'light')?.range ?? 120;
      const r = rnd(12);
      const aggro = r < L.aggression;
      if (dist <= lightRange) {
        const pick = rnd(13);
        if (!aggro && pick < 300) return BTN.BLOCK;
        if (pick < 450) return press(f, BTN.LIGHT);
        if (pick < 560) return BTN.DOWN | press(f, BTN.LIGHT);
        if (pick < 660) return BTN.DOWN | press(f, BTN.HEAVY);
        if (pick < 770) return press(f, BTN.HEAVY);
        if (pick < 820 && usable(f, 'special1Down')) return BTN.DOWN | press(f, BTN.SP1);
        if (pick < 870 && usable(f, 'special2Down')) return BTN.DOWN | press(f, BTN.SP2);
        if (pick < 930) return press(f, BTN.DASH) | back;
        return BTN.UP | fwd;
      }
      if (dist < 420) {
        const pick = rnd(14);
        if (pick < 320) return fwd;
        if (pick < 450) return press(f, BTN.DASH) | fwd;
        if (pick < 570) return BTN.UP | fwd;
        if (pick < 680 && usable(f, 'special2')) return press(f, BTN.SP2);
        if (pick < 760 && usable(f, 'special2Down')) return BTN.DOWN | press(f, BTN.SP2);
        if (pick < 860 && usable(f, 'special1')) return press(f, BTN.SP1);
        if (pick < 920 && usable(f, 'special1Down')) return BTN.DOWN | press(f, BTN.SP1);
        return aggro ? fwd : back;
      }
      const pick = rnd(15);
      if (pick < 260 && usable(f, 'special1')) return press(f, BTN.SP1);
      if (pick < 360 && usable(f, 'special1Down')) return BTN.DOWN | press(f, BTN.SP1);
      if (pick < 420 && usable(f, 'special2')) return press(f, BTN.SP2);
      if (pick < 480 && usable(f, 'special2Down') && !moveOf(f, 'special2Down')?.abilities?.some((a) => a.type === 'counter')) {
        return BTN.DOWN | press(f, BTN.SP2);
      }
      if (pick < 640) return press(f, BTN.DASH) | fwd;
      if (pick < 720) return BTN.UP | fwd;
      return fwd;
    },
  };
}

/** Training dummy behaviours. 'block' crouch-blocks lows automatically. */
export function dummyInput(mode: DummyMode, state: MatchState, me: PlayerIndex): InputBits {
  if (state.phase !== 'fight') return 0;
  const f = state.fighters[me];
  const o = state.fighters[me === 0 ? 1 : 0];
  switch (mode) {
    case 'idle': return 0;
    case 'crouch': return BTN.DOWN;
    case 'jump': return f.grounded && f.mode !== 'jump' ? BTN.UP : 0;
    case 'block': {
      const m = currentMove(o);
      return BTN.BLOCK | (m?.level === 'low' ? BTN.DOWN : 0);
    }
  }
  return 0;
}
