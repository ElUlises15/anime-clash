/** Match / round flow: createMatch, intro -> fight -> ko/timeUp -> roundEnd -> next round | matchEnd; training rules. */
import type { MatchConfig, MatchState, PlayerIndex } from './types';
import { ENERGY_MAX, FX, ROUNDS_TO_WIN, ROUND_TIME_SECONDS, SIM_HZ, STAGE_WIDTH_PX, ULT_MAX } from './types';
import {
  INTRO_FRAMES, KO_FRAMES, KO_HITSTOP, ROUND_END_FRAMES, START_OFFSET_PX, TIMEUP_FRAMES,
  TRAINING_HP_REGEN_PER_FRAME, TRAINING_REGEN_DELAY,
} from './constants';
import { emit, type SimContext } from './context';
import { createFighter, resetFighterForRound } from './fighter';
import { setMode, restartAnim } from './anim';
import { seedRng } from './rng';
import { getDef } from './defs';

export function roundTimeFrames(config: MatchConfig): number {
  if (config.mode === 'training') return 0;
  const secs = config.roundTimeSeconds ?? ROUND_TIME_SECONDS;
  return secs > 0 && Number.isFinite(secs) ? Math.trunc(secs * SIM_HZ) : 0;
}

export function roundsToWin(config: MatchConfig): number {
  return config.roundsToWin ?? ROUNDS_TO_WIN;
}

const startX = (i: PlayerIndex) => ((STAGE_WIDTH_PX / 2) + (i === 0 ? -START_OFFSET_PX : START_OFFSET_PX)) * FX;

export function createMatch(config: MatchConfig): MatchState {
  // validate ids early (throws on unknown character)
  getDef(config.p1);
  getDef(config.p2);
  const cfg: MatchConfig = JSON.parse(JSON.stringify(config));
  if (cfg.mode === 'training' && !cfg.training) cfg.training = { regenHp: true, regenEnergy: false };
  return {
    frame: 0,
    rng: seedRng(cfg.seed),
    config: cfg,
    phase: 'intro',
    phaseFrame: 0,
    round: 1,
    roundWins: [0, 0],
    roundWinners: [],
    timerFrames: roundTimeFrames(cfg),
    hitstop: 0,
    cinematic: { active: false, owner: 0, framesLeft: 0, total: 0, moveId: '' },
    fighters: [createFighter(0, cfg.p1, startX(0), 1), createFighter(1, cfg.p2, startX(1), -1)],
    entities: [],
    nextEntityId: 1,
    events: [],
    winner: null,
  };
}

function startRound(st: MatchState): void {
  st.phase = 'intro';
  st.phaseFrame = 0;
  st.timerFrames = roundTimeFrames(st.config);
  st.hitstop = 0;
  st.cinematic = { active: false, owner: 0, framesLeft: 0, total: 0, moveId: '' };
  st.entities = [];
  resetFighterForRound(st.fighters[0], startX(0), 1);
  resetFighterForRound(st.fighters[1], startX(1), -1);
}

/** Intro phase step: 'roundStart' on first frame, 'fight' at the end. */
export function introStep(ctx: SimContext): void {
  const st = ctx.state;
  if (st.phaseFrame === 0) {
    emit(ctx, { type: 'roundStart', player: 0, x: (STAGE_WIDTH_PX / 2) * FX, y: 0 });
  }
  st.phaseFrame++;
  for (const f of st.fighters) {
    if (f.mode !== 'intro') setMode(f, 'intro');
    f.animFrame++;
  }
  if (st.phaseFrame >= INTRO_FRAMES) {
    st.phase = 'fight';
    st.phaseFrame = 0;
    for (const f of st.fighters) { setMode(f, 'idle'); restartAnim(f, 'idle'); }
    emit(ctx, { type: 'fight', player: 0, x: (STAGE_WIDTH_PX / 2) * FX, y: 0 });
  }
}

function recordRoundWinner(st: MatchState, w: PlayerIndex | -1): void {
  st.roundWinners.push(w);
  if (w !== -1) {
    st.roundWins[w]++;
    st.fighters[w].stats.roundsWon++;
  }
}

/** Training-mode rules: HP refill instead of KO, optional regen. */
export function trainingRules(ctx: SimContext): void {
  const st = ctx.state;
  const t = st.config.training;
  for (const f of st.fighters) {
    if (f.hp <= 0) f.hp = f.maxHp;
    const recovering = f.mode === 'hitstun' || f.mode === 'knockback' || f.mode === 'knockdown' || f.mode === 'blockstun';
    if (t?.regenHp && !recovering && st.frame - f.lastHitFrame > TRAINING_REGEN_DELAY && f.hp < f.maxHp) {
      f.hp = Math.min(f.maxHp, f.hp + TRAINING_HP_REGEN_PER_FRAME);
    }
    if (t?.regenEnergy) {
      f.energy = Math.min(ENERGY_MAX, f.energy + 20);
      f.ult = Math.min(ULT_MAX, f.ult + 10);
    }
  }
}

/** After a fight-phase world step: KO and time-out checks. */
export function checkRoundOver(ctx: SimContext): void {
  const st = ctx.state;
  if (st.config.mode === 'training') { trainingRules(ctx); return; }
  const [a, b] = st.fighters;
  const deadA = a.hp <= 0, deadB = b.hp <= 0;
  if (deadA || deadB) {
    const w: PlayerIndex | -1 = deadA && deadB ? -1 : deadA ? 1 : 0;
    recordRoundWinner(st, w);
    st.phase = 'ko';
    st.phaseFrame = 0;
    st.hitstop = Math.max(st.hitstop, KO_HITSTOP);
    st.cinematic.active = false;
    for (const f of st.fighters) {
      if (f.hp > 0) continue;
      const killer = st.fighters[f.index === 0 ? 1 : 0];
      f.moveId = null;
      setMode(f, 'ko');
      restartAnim(f, 'ko');
      f.stunFrames = 0;
      f.vx = (f.x >= killer.x ? 1 : -1) * 700;
      f.vy = Math.max(f.vy, 1100);
      f.grounded = false;
      if (f.y <= 0) f.y = 1;
      emit(ctx, { type: 'ko', player: killer.index, x: f.x, y: f.y + 130 * FX });
    }
    return;
  }
  if (st.timerFrames > 0) {
    st.timerFrames--;
    if (st.timerFrames === 0) {
      const pa = Math.trunc((a.hp * 10000) / a.maxHp), pb = Math.trunc((b.hp * 10000) / b.maxHp);
      const w: PlayerIndex | -1 = pa === pb ? -1 : pa > pb ? 0 : 1;
      recordRoundWinner(st, w);
      st.phase = 'ko';
      st.phaseFrame = KO_FRAMES - TIMEUP_FRAMES; // shorter pause
      emit(ctx, { type: 'timeUp', player: w === -1 ? 0 : w, x: (STAGE_WIDTH_PX / 2) * FX, y: 0 });
    }
  }
}

function lastRoundWinner(st: MatchState): PlayerIndex | -1 {
  return st.roundWinners.length ? st.roundWinners[st.roundWinners.length - 1] : -1;
}

/** Called each frame during 'ko' after the world step. */
export function koPhaseTick(ctx: SimContext): void {
  const st = ctx.state;
  st.phaseFrame++;
  if (st.phaseFrame < KO_FRAMES) return;
  st.phase = 'roundEnd';
  st.phaseFrame = 0;
  const w = lastRoundWinner(st);
  if (w !== -1) {
    const f = st.fighters[w];
    f.moveId = null;
    setMode(f, 'victory');
    restartAnim(f, 'victory');
  }
  emit(ctx, { type: 'roundEnd', player: w === -1 ? 0 : w, x: st.fighters[w === -1 ? 0 : w].x, y: 0 });
}

/** Called each frame during 'roundEnd' after the world step. */
export function roundEndTick(ctx: SimContext): void {
  const st = ctx.state;
  const w = lastRoundWinner(st);
  if (w !== -1) {
    const f = st.fighters[w];
    if (f.grounded && f.mode !== 'victory') { f.moveId = null; setMode(f, 'victory'); restartAnim(f, 'victory'); }
  }
  st.phaseFrame++;
  if (st.phaseFrame < ROUND_END_FRAMES) return;
  const need = roundsToWin(st.config);
  const maxRounds = need * 2 + 1;
  const [w0, w1] = st.roundWins;
  let winner: PlayerIndex | -1 | null = null;
  if (w0 >= need && w1 >= need) winner = -1;
  else if (w0 >= need) winner = 0;
  else if (w1 >= need) winner = 1;
  else if (st.round >= maxRounds) winner = w0 === w1 ? -1 : w0 > w1 ? 0 : 1;
  if (winner !== null) {
    st.phase = 'matchEnd';
    st.phaseFrame = 0;
    st.winner = winner;
    emit(ctx, { type: 'matchEnd', player: winner === -1 ? 0 : winner, x: st.fighters[winner === -1 ? 0 : winner].x, y: 0 });
    return;
  }
  st.round++;
  startRound(st);
}

export function matchEndTick(ctx: SimContext): void {
  const st = ctx.state;
  st.phaseFrame++;
  if (st.winner === 0 || st.winner === 1) {
    const f = st.fighters[st.winner];
    if (f.grounded && f.mode !== 'victory') { setMode(f, 'victory'); restartAnim(f, 'victory'); }
  }
}
