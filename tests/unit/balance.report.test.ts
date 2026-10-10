/**
 * Opt-in bot-vs-bot balance report (skipped by default):
 *   BALANCE_REPORT=1 npx vitest run tests/unit/balance.report.test.ts
 * Optional: BALANCE_N=300 (matches per pair). Prints the win-rate matrix (docs/BALANCING.md §8), round length and
 * damage share per move.
 */
import { describe, it } from 'vitest';
import { listCharacters } from '../../src/characters/registry';
import { formatMatrix, runBots, winMatrix } from './helpers';

const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {};

describe.runIf(!!env.BALANCE_REPORT)('balance report', () => {
  it('win-rate matrix', () => {
    const n = Number(env.BALANCE_N ?? 90);
    const ids = listCharacters().map((c) => c.id);
    const res = winMatrix(ids, n);
    console.log(`Win-rate matrix (${n} matches per pair, row vs column):\n${formatMatrix(ids, res)}`);
    for (const r of res) {
      console.log(`${r.a} vs ${r.b}: ${r.winsA}-${r.winsB} (draws ${r.draws}) avg round ${r.avgRoundSecs.toFixed(1)}s`
        + ` longest match ${r.maxFrames}f unfinished ${r.unfinished}`);
    }
  }, 600_000);

  it('damage share per move', () => {
    const n = Math.max(6, Math.trunc(Number(env.BALANCE_N ?? 90) / 6));
    const ids = listCharacters().map((c) => c.id);
    const dmg: Record<string, Record<string, number>> = {};
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        for (let seed = 1; seed <= n; seed++) {
          const lvl = ((seed % 3) + 1) as 1 | 2 | 3;
          const r = runBots({ p1: a, p2: b, seed }, lvl, lvl, 40000);
          for (const e of r.events) {
            if (e.type !== 'hit' || !e.moveId) continue;
            const who = r.state.fighters[e.player].charId;
            (dmg[who] ??= {})[e.moveId] = (dmg[who][e.moveId] ?? 0) + (e.damage ?? 0);
          }
        }
      }
    }
    for (const id of ids) {
      const t = Object.values(dmg[id] ?? {}).reduce((x, y) => x + y, 0);
      console.log(`${id}: ` + Object.entries(dmg[id] ?? {}).sort((x, y) => y[1] - x[1])
        .map(([k, v]) => `${k.replace(`${id}_`, '')}=${Math.round((v * 100) / t)}%`).join('  '));
    }
  }, 600_000);
});
