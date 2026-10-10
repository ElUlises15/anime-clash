/** Per-step simulation context passed to systems and ability components. Not stored in state. */
import type { InputBits } from '../input/buttons';
import type { FighterState, MatchState, PlayerIndex, SimEvent } from './types';

export interface SimContext {
  state: MatchState;
  /** Effective inputs of this step (zeroed outside the 'fight' phase). */
  inputs: [InputBits, InputBits];
}

export function makeCtx(state: MatchState, inputs: [InputBits, InputBits]): SimContext {
  return { state, inputs };
}

export function emit(ctx: SimContext, ev: Omit<SimEvent, 'frame'>): void {
  const out: SimEvent = { ...ev, frame: ctx.state.frame } as SimEvent;
  // keep events JSON-clean (no undefined keys)
  for (const k of Object.keys(out) as (keyof SimEvent)[]) if (out[k] === undefined) delete out[k];
  ctx.state.events.push(out);
}

export function opponentOf(ctx: SimContext, f: FighterState | PlayerIndex): FighterState {
  const i = typeof f === 'number' ? f : f.index;
  return ctx.state.fighters[i === 0 ? 1 : 0];
}

export function fighter(ctx: SimContext, i: PlayerIndex): FighterState {
  return ctx.state.fighters[i];
}
