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
