/**
 * Opt-in bot-vs-bot balance report (skipped by default):
 *   BALANCE_REPORT=1 npx vitest run tests/unit/balance.report.test.ts
 * Optional: BALANCE_N=300 (matches per pair).
 */
import { describe, it } from 'vitest';
import { listCharacters } from '../../src/characters/registry';
import { runBots } from './helpers';

const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {};

describe.runIf(!!env.BALANCE_REPORT)('balance report', () => {
  it('bot vs bot win rates, round length and damage per move', () => {
    const n = Number(env.BALANCE_N ?? 90);
    const ids = listCharacters().map((c) => c.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const wins: Record<string, number> = {};
        const dmg: Record<string, number> = {};
        let fightFrames = 0, rounds = 0;
        for (let seed = 1; seed <= n; seed++) {
          const [p1, p2] = seed % 2 ? [ids[i], ids[j]] : [ids[j], ids[i]];
          const lvl = ((seed % 3) + 1) as 1 | 2 | 3;
          const r = runBots({ p1, p2, seed }, lvl, lvl, 40000, (s) => { if (s.phase === 'fight' && !s.cinematic.active) fightFrames++; });
          rounds += r.state.roundWinners.length;
          const w = r.state.winner;
          const key = w === 0 || w === 1 ? r.state.fighters[w].charId : 'draw';
          wins[key] = (wins[key] ?? 0) + 1;
          wins[`L${lvl}_${key}`] = (wins[`L${lvl}_${key}`] ?? 0) + 1;
          for (const e of r.events) if (e.type === 'hit' && e.moveId) dmg[e.moveId] = (dmg[e.moveId] ?? 0) + (e.damage ?? 0);
        }
        console.log(`${ids[i]} vs ${ids[j]} (${n} matches):`, JSON.stringify(wins),
          `avg round ${(fightFrames / rounds / 60).toFixed(1)}s`);
        console.log(Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));
      }
    }
  });
});
