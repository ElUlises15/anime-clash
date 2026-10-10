import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { createBot, dummyInput } from '../../src/game/ai/qaBot';
import { listCharacters } from '../../src/characters/registry';
import { sim } from '../../src/game/sim/engine';
import { fightReady, place, runBots, winMatrix } from './helpers';

const IDS = listCharacters().map((c) => c.id);

describe('QA bot', () => {
  it('is deterministic for the same state', () => {
    const s = fightReady();
    const a = createBot(5, 3), b = createBot(5, 3);
    for (let i = 0; i < 300; i++) {
      const x = a.next(s, 0), y = b.next(s, 0);
      expect(x).toBe(y);
      sim.step(s, [x, createBot(9, 2).next(s, 1)]);
    }
  });

  it('all matchups (incl. mirrors) end with a winner in reasonable time and every move gets used', () => {
    const used = new Set<string>();
    let fightFrames = 0, rounds = 0, k = 0;
    for (const p1 of IDS) {
      for (const p2 of IDS) {
        for (let rep = 0; rep < 2; rep++, k++) {
          const r = runBots({ p1, p2, seed: 100 + k }, ((k % 3) + 1) as 1 | 2 | 3, (((k + rep) % 3) + 1) as 1 | 2 | 3, 30000,
            (s) => { if (s.phase === 'fight' && !s.cinematic.active) fightFrames++; });
          expect(r.state.phase, `${p1} vs ${p2} seed ${100 + k}`).toBe('matchEnd');
          expect(r.state.winner === 0 || r.state.winner === 1, `${p1} vs ${p2} had no winner`).toBe(true);
          expect(r.frames).toBeLessThan(20000); // < ~5.5 min including intros/KO pauses
          rounds += r.state.roundWinners.length;
          for (const e of r.events) {
            if ((e.type === 'moveStart' || e.type === 'specialStart' || e.type === 'ultimateStart') && e.moveId) used.add(e.moveId);
          }
        }
      }
    }
    const avgRoundSecs = fightFrames / rounds / 60;
    expect(avgRoundSecs).toBeGreaterThan(20);
    expect(avgRoundSecs).toBeLessThan(75);
    for (const c of listCharacters()) {
      for (const m of Object.values(c.moves)) expect(used, `${c.id} never used ${m!.id}`).toContain(m!.id);
    }
  }, 60_000);

  it('no character wins more than 80% of a matchup (mirror-free, seeded, both sides, all bot levels)', () => {
    const res = winMatrix(IDS, 18, 500);
    for (const r of res) {
      expect(r.unfinished).toBe(0);
      expect(r.winsA / r.n, `${r.a} vs ${r.b}: ${r.winsA}-${r.winsB}`).toBeLessThanOrEqual(0.8);
      expect(r.winsB / r.n, `${r.a} vs ${r.b}: ${r.winsA}-${r.winsB}`).toBeLessThanOrEqual(0.8);
    }
  }, 120_000);

  it('dummy modes', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    expect(dummyInput('idle', s, 1)).toBe(0);
    expect(dummyInput('crouch', s, 1)).toBe(BTN.DOWN);
    expect(dummyInput('jump', s, 1)).toBe(BTN.UP);
    expect(dummyInput('block', s, 1) & BTN.BLOCK).toBeTruthy();
    // block dummy crouch-blocks a sweep
    const hp = s.fighters[1].hp;
    for (let i = 0; i < 40; i++) sim.step(s, [i === 0 ? BTN.DOWN | BTN.HEAVY : 0, dummyInput('block', s, 1)]);
    expect(s.fighters[1].hp).toBe(hp);
    expect(s.fighters[1].stats.blocks).toBe(1);
  });
});
