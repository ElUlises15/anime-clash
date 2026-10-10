import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { sim } from '../../src/game/sim/engine';
import { ROUND_TIME_SECONDS, SIM_HZ, ULT_MAX } from '../../src/game/sim/types';
import { ENERGY_START, INTRO_FRAMES, KO_FRAMES, ROUND_END_FRAMES, KO_HITSTOP } from '../../src/game/sim/constants';
import { fightReady, newMatch, place, stepN, tap } from './helpers';
import type { MatchState } from '../../src/game/sim/types';

/** Make P1 KO P2 with a jab. */
function koP2(s: MatchState) {
  place(s, 1000, 1100);
  s.fighters[1].hp = 1;
  return tap(s, 0, BTN.LIGHT, 12);
}

describe('rounds & KO', () => {
  it('intro emits roundStart then fight', () => {
    const s = newMatch();
    expect(s.phase).toBe('intro');
    const evs = stepN(s, INTRO_FRAMES);
    expect(evs[0].type).toBe('roundStart');
    expect(evs.some((e) => e.type === 'fight')).toBe(true);
    expect(s.phase).toBe('fight');
    expect(s.timerFrames).toBe(ROUND_TIME_SECONDS * SIM_HZ);
  });

  it('KO ends the round, awards it and starts round 2 with reset hp/energy but kept ult', () => {
    const s = fightReady();
    s.fighters[0].ult = 400;
    const evs = koP2(s);
    expect(evs.some((e) => e.type === 'ko')).toBe(true);
    expect(s.phase).toBe('ko');
    expect(s.fighters[1].mode).toBe('ko');
    expect(s.roundWins).toEqual([1, 0]);
    expect(s.roundWinners).toEqual([0]);
    const ult = s.fighters[0].ult;
    const more = stepN(s, KO_HITSTOP + KO_FRAMES + 2);
    expect(more.some((e) => e.type === 'roundEnd')).toBe(true);
    expect(s.phase).toBe('roundEnd');
    expect(s.fighters[0].anim).toBe('victory');
    stepN(s, ROUND_END_FRAMES);
    expect(s.phase).toBe('intro');
    expect(s.round).toBe(2);
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
    expect(s.fighters[0].energy).toBe(ENERGY_START);
    expect(s.fighters[0].ult).toBe(ult);
    expect(s.fighters[0].stats.roundsWon).toBe(1);
  });

  it('best of 3: two round wins end the match', () => {
    const s = fightReady();
    koP2(s);
    stepN(s, KO_HITSTOP + KO_FRAMES + ROUND_END_FRAMES + INTRO_FRAMES + 5);
    expect(s.phase).toBe('fight');
    const evs = koP2(s);
    expect(evs.some((e) => e.type === 'ko')).toBe(true);
    const end = stepN(s, KO_HITSTOP + KO_FRAMES + ROUND_END_FRAMES + 5);
    expect(end.some((e) => e.type === 'matchEnd')).toBe(true);
    expect(s.phase).toBe('matchEnd');
    expect(s.winner).toBe(0);
    expect(s.roundWins).toEqual([2, 0]);
    // stays in matchEnd
    stepN(s, 200);
    expect(s.phase).toBe('matchEnd');
  });

  it('time-out: higher HP% wins the round', () => {
    const s = fightReady();
    s.fighters[0].hp = 500;
    s.timerFrames = 3;
    const evs = stepN(s, 5);
    expect(evs.some((e) => e.type === 'timeUp')).toBe(true);
    expect(s.roundWinners).toEqual([1]);
    expect(s.roundWins).toEqual([0, 1]);
  });

  it('time-out with equal HP% is a draw round', () => {
    const s = fightReady({ p2: 'goku' });
    s.timerFrames = 2;
    stepN(s, 4);
    expect(s.roundWinners).toEqual([-1]);
    expect(s.roundWins).toEqual([0, 0]);
  });

  it('a draw match terminates after max rounds', () => {
    const s = fightReady({ p2: 'goku' });
    for (let r = 0; r < 5; r++) {
      while (s.phase !== 'fight' && s.phase !== 'matchEnd') sim.step(s, [0, 0]);
      if (s.phase === 'matchEnd') break;
      s.timerFrames = 1;
      stepN(s, 2);
      while ((s.phase as string) === 'ko' || (s.phase as string) === 'roundEnd') sim.step(s, [0, 0]);
    }
    expect(s.phase).toBe('matchEnd');
    expect(s.winner).toBe(-1);
  });

  it('timer counts down and freezes during hitstop', () => {
    const s = fightReady();
    const t0 = s.timerFrames;
    stepN(s, 60);
    expect(t0 - s.timerFrames).toBe(60);
    s.hitstop = 10;
    stepN(s, 10);
    expect(t0 - s.timerFrames).toBe(60);
  });

  it('rematch returns a fresh match with the same config', () => {
    const s = fightReady();
    koP2(s);
    const r = sim.rematch(s);
    expect(r.phase).toBe('intro');
    expect(r.round).toBe(1);
    expect(r.roundWins).toEqual([0, 0]);
    expect(r.config).toEqual(s.config);
    expect(r.fighters[0].stats.hitsLanded).toBe(0);
  });

  it('ultimate cinematic freezes the world and then resumes', () => {
    const s = fightReady();
    place(s, 1000, 1500);
    s.fighters[0].ult = ULT_MAX;
    const evs = tap(s, 0, BTN.ULT, 2);
    expect(evs.some((e) => e.type === 'ultimateStart')).toBe(true);
    expect(s.cinematic.active).toBe(true);
    expect(s.fighters[0].form).toBe('ssj');
    const timer = s.timerFrames, x1 = s.fighters[1].x, mf = s.fighters[0].moveFrame, af = s.fighters[0].animFrame;
    const during = stepN(s, 20, [0, BTN.RIGHT]);
    expect(s.timerFrames).toBe(timer);
    expect(s.fighters[1].x).toBe(x1);
    expect(s.fighters[0].moveFrame).toBe(mf);
    expect(s.fighters[0].animFrame).toBeGreaterThan(af);
    expect(during.length).toBe(0);
    const after = stepN(s, s.cinematic.framesLeft + 5);
    expect(after.some((e) => e.type === 'ultimateCinematicEnd')).toBe(true);
    expect(s.cinematic.active).toBe(false);
    expect(s.fighters[0].moveFrame).toBeGreaterThan(mf);
  });
});

describe('training mode', () => {
  it('no timer, HP refills instead of KO', () => {
    const s = fightReady({ mode: 'training', training: { regenHp: false, regenEnergy: false } });
    expect(s.timerFrames).toBe(0);
    const evs = koP2(s);
    expect(evs.some((e) => e.type === 'ko')).toBe(false);
    expect(s.phase).toBe('fight');
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
    stepN(s, 600);
    expect(s.phase).toBe('fight');
  });

  it('optional HP and energy regen', () => {
    const s = fightReady({ mode: 'training', training: { regenHp: true, regenEnergy: true } });
    s.fighters[1].hp = 100;
    s.fighters[0].energy = 0;
    s.fighters[0].ult = 0;
    stepN(s, 200);
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
    expect(s.fighters[0].energy).toBeGreaterThan(900);
    expect(s.fighters[0].ult).toBeGreaterThan(900);
  });
});
