/**
 * Deterministic combat simulation entry point. Pure TS: no Phaser, DOM, Date or Math.random.
 * step(state, inputs) mutates and returns `state`; state is plain JSON (structuredClone / JSON roundtrip safe).
 */
import '../../abilities'; // registers ability components
import type { InputBits } from '../input/buttons';
import type { MatchConfig, MatchState, SimApi } from './types';
import { emit, makeCtx, type SimContext } from './context';
import { bufferInput } from './moves';
import { updateFighter } from './fighter';
import { integrate, resolveFighters } from './physics';
import { checkMeleeHits } from './combat';
import { updateEntities } from './entities';
import { updateAnim } from './anim';
import { centiStep, addEnergy } from './meters';
import { effStats } from './stats';
import { hashValue } from './hash';
import {
  checkRoundOver, createMatch, introStep, koPhaseTick, matchEndTick, roundEndTick,
} from './rounds';

export { getDef } from './defs';
export { getHurtbox, getActiveHitbox, getEntityBox } from './boxes';
export { deriveStats, STAT_BUDGET } from './balance';

const ZERO: [InputBits, InputBits] = [0, 0];

/** One unfrozen frame of world simulation. */
function worldStep(ctx: SimContext, fight: boolean): void {
  const st = ctx.state;
  if (fight) for (const f of st.fighters) bufferInput(f, ctx.inputs[f.index], true);
  for (const f of st.fighters) updateFighter(ctx, f, ctx.inputs[f.index]);
  for (const f of st.fighters) integrate(ctx, f);
  resolveFighters(ctx);
  checkMeleeHits(ctx);
  updateEntities(ctx);
  if (fight) {
    for (const f of st.fighters) addEnergy(ctx, f, centiStep(st.frame, effStats(f).energyRegen));
  }
  for (const f of st.fighters) updateAnim(f);
}

function cinematicTick(ctx: SimContext): void {
  const st = ctx.state;
  const c = st.cinematic;
  c.framesLeft--;
  st.fighters[c.owner].animFrame++;
  if (c.framesLeft <= 0) {
    c.active = false;
    c.framesLeft = 0;
    const f = st.fighters[c.owner];
    emit(ctx, { type: 'ultimateCinematicEnd', player: c.owner, x: f.x, y: f.y, moveId: c.moveId });
  }
}

function step(state: MatchState, inputs: [InputBits, InputBits]): MatchState {
  state.events = [];
  state.frame++;
  const fight = state.phase === 'fight';
  const ctx = makeCtx(state, fight ? [inputs[0] | 0, inputs[1] | 0] : ZERO);
  switch (state.phase) {
    case 'intro':
      introStep(ctx);
      break;
    case 'fight':
      if (state.cinematic.active) {
        cinematicTick(ctx);
      } else if (state.hitstop > 0) {
        state.hitstop--;
        for (const f of state.fighters) bufferInput(f, ctx.inputs[f.index], false);
      } else {
        worldStep(ctx, true);
        checkRoundOver(ctx);
      }
      break;
    case 'ko':
      if (state.hitstop > 0) state.hitstop--;
      else worldStep(ctx, false);
      koPhaseTick(ctx);
      break;
    case 'roundEnd':
      worldStep(ctx, false);
      roundEndTick(ctx);
      break;
    case 'matchEnd':
      worldStep(ctx, false);
      matchEndTick(ctx);
      break;
  }
  state.fighters[0].prevInput = inputs[0] | 0;
  state.fighters[1].prevInput = inputs[1] | 0;
  return state;
}

function cloneState(state: MatchState): MatchState {
  return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

export const sim: SimApi = {
  createMatch: (config: MatchConfig) => createMatch(config),
  step,
  cloneState,
  hashState: (state: MatchState) => hashValue(state),
  rematch: (state: MatchState) => createMatch(state.config),
};
