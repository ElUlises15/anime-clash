import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { createBot, dummyInput } from '../../src/game/ai/qaBot';
import { listCharacters } from '../../src/characters/registry';
import { sim } from '../../src/game/sim/engine';
import { fightReady, place, runBots } from './helpers';

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

  it('bot vs bot matches end with a winner in reasonable time and use every move', () => {
    const used = new Set<string>();
    let fightFrames = 0, rounds = 0;
    const pairs = [['goku', 'naruto'], ['naruto', 'goku'], ['goku', 'goku'], ['naruto', 'naruto']] as const;
    for (let i = 0; i < 8; i++) {
      const [p1, p2] = pairs[i % pairs.length];
      const r = runBots({ p1, p2, seed: 100 + i }, ((i % 3) + 1) as 1 | 2 | 3, 3, 30000, (s) => {
        if (s.phase === 'fight' && !s.cinematic.active) fightFrames++;
      });
      expect(r.state.phase).toBe('matchEnd');
      expect(r.state.winner === 0 || r.state.winner === 1).toBe(true);
      rounds += r.state.roundWinners.length;
      for (const e of r.events) {
        if ((e.type === 'moveStart' || e.type === 'specialStart' || e.type === 'ultimateStart') && e.moveId) used.add(e.moveId);
      }
    }
    const avgRoundSecs = fightFrames / rounds / 60;
    expect(avgRoundSecs).toBeGreaterThan(20);
    expect(avgRoundSecs).toBeLessThan(75);
    for (const c of listCharacters()) {
      for (const m of Object.values(c.moves)) expect(used, `${c.id} never used ${m!.id}`).toContain(m!.id);
    }
  });

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
