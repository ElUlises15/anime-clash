import { sim } from '../../src/game/sim/engine';
import type { MatchConfig, MatchState, SimEvent } from '../../src/game/sim/types';
import { createBot, type BotLevel } from '../../src/game/ai/qaBot';
import type { InputBits } from '../../src/game/input/buttons';
import { INTRO_FRAMES } from '../../src/game/sim/constants';

export function newMatch(over: Partial<MatchConfig> = {}): MatchState {
  return sim.createMatch({ p1: 'goku', p2: 'naruto', seed: 1234, mode: 'versus', ...over });
}

/** Create a match and skip the intro so the fight phase is active. */
export function fightReady(over: Partial<MatchConfig> = {}): MatchState {
  const s = newMatch(over);
  for (let i = 0; i < INTRO_FRAMES; i++) sim.step(s, [0, 0]);
  if (s.phase !== 'fight') throw new Error('expected fight phase');
  return s;
}

export function stepN(s: MatchState, n: number, inputs: [InputBits, InputBits] | ((s: MatchState) => [InputBits, InputBits]) = [0, 0]): SimEvent[] {
  const evs: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step(s, typeof inputs === 'function' ? inputs(s) : inputs);
    evs.push(...s.events);
  }
  return evs;
}

/** Press a button for one frame then release, stepping `after` frames total. */
export function tap(s: MatchState, who: 0 | 1, bits: InputBits, after = 1, other: InputBits = 0): SimEvent[] {
  const evs: SimEvent[] = [];
  for (let i = 0; i < after; i++) {
    const inp: [InputBits, InputBits] = who === 0 ? [i === 0 ? bits : 0, other] : [other, i === 0 ? bits : 0];
    sim.step(s, inp);
    evs.push(...s.events);
  }
  return evs;
}

export function place(s: MatchState, x0px: number, x1px: number): void {
  s.fighters[0].x = x0px * 100; s.fighters[1].x = x1px * 100;
  s.fighters[0].facing = x0px < x1px ? 1 : -1; s.fighters[1].facing = x0px < x1px ? -1 : 1;
}

export function runBots(config: Partial<MatchConfig>, l0: BotLevel, l1: BotLevel, maxFrames = 40000,
  onStep?: (s: MatchState) => void) {
  const s = newMatch(config);
  const b0 = createBot(config.seed ?? 1, l0), b1 = createBot((config.seed ?? 1) * 7 + 3, l1);
  const events: SimEvent[] = [];
  let f = 0;
  while (s.phase !== 'matchEnd' && f < maxFrames) {
    sim.step(s, [b0.next(s, 0), b1.next(s, 1)]);
    events.push(...s.events);
    onStep?.(s);
    f++;
  }
  return { state: s, events, frames: f };
}

export interface MatchupResult {
  a: string; b: string; n: number;
  winsA: number; winsB: number; draws: number;
  avgRoundSecs: number; maxFrames: number; unfinished: number;
}

/**
 * Win-rate matrix method (docs/BALANCING.md §8): for every unordered pair of DIFFERENT characters play `n` seeded
 * bot-vs-bot matches, alternating sides (P1/P2) every seed and cycling bot levels 1..3 (both bots same level).
 */
export function winMatrix(ids: string[], n: number, seed0 = 1, maxFrames = 40000): MatchupResult[] {
  const out: MatchupResult[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const r: MatchupResult = { a: ids[i], b: ids[j], n, winsA: 0, winsB: 0, draws: 0, avgRoundSecs: 0, maxFrames: 0, unfinished: 0 };
      let fightFrames = 0, rounds = 0;
      for (let k = 0; k < n; k++) {
        const seed = seed0 + k;
        const [p1, p2] = k % 2 ? [ids[j], ids[i]] : [ids[i], ids[j]];
        const lvl = ((k % 3) + 1) as BotLevel;
        const m = runBots({ p1, p2, seed }, lvl, lvl, maxFrames, (s) => { if (s.phase === 'fight' && !s.cinematic.active) fightFrames++; });
        rounds += m.state.roundWinners.length;
        r.maxFrames = Math.max(r.maxFrames, m.frames);
        if (m.state.phase !== 'matchEnd') r.unfinished++;
        const w = m.state.winner;
        if (w === 0 || w === 1) {
          if (m.state.fighters[w].charId === ids[i]) r.winsA++; else r.winsB++;
        } else r.draws++;
      }
      r.avgRoundSecs = fightFrames / Math.max(1, rounds) / 60;
      out.push(r);
    }
  }
  return out;
}

/** Markdown matrix: row character's win % against column character. */
export function formatMatrix(ids: string[], res: MatchupResult[]): string {
  const pct = (a: string, b: string) => {
    const r = res.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!r) return '  -  ';
    const w = r.a === a ? r.winsA : r.winsB;
    return `${Math.round((w * 100) / r.n)}%`.padStart(5);
  };
  const lines = [`| vs | ${ids.join(' | ')} | overall |`, `|---|${ids.map(() => '---').join('|')}|---|`];
  for (const a of ids) {
    let w = 0, n = 0;
    for (const r of res) {
      if (r.a === a) { w += r.winsA; n += r.n; } else if (r.b === a) { w += r.winsB; n += r.n; }
    }
    lines.push(`| ${a} | ${ids.map((b) => (a === b ? '  -  ' : pct(a, b))).join(' | ')} | ${Math.round((w * 100) / Math.max(1, n))}% |`);
  }
  return lines.join('\n');
}
