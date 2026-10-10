import { describe, expect, it } from 'vitest';
import { sim } from '../../src/game/sim/engine';
import { createBot } from '../../src/game/ai/qaBot';
import type { MatchState } from '../../src/game/sim/types';
import { newMatch } from './helpers';

function run(seed: number, frames: number, from?: MatchState, hashes: number[] = []) {
  const s = from ?? newMatch({ seed });
  const a = createBot(seed, 3), b = createBot(seed + 99, 2);
  for (let i = 0; i < frames; i++) {
    sim.step(s, [a.next(s, 0), b.next(s, 1)]);
    hashes.push(sim.hashState(s));
  }
  return { s, hashes };
}

describe('determinism', () => {
  it('same inputs => same hash every frame (3000 frames)', () => {
    const r1 = run(42, 3000);
    const r2 = run(42, 3000);
    expect(r1.hashes.length).toBe(3000);
    expect(r1.hashes).toEqual(r2.hashes);
    // something actually happened
    expect(r1.s.fighters[0].stats.hitsLanded + r1.s.fighters[1].stats.hitsLanded).toBeGreaterThan(5);
    // different seeds diverge
    const r3 = run(43, 3000);
    expect(r3.hashes).not.toEqual(r1.hashes);
  });

  it('structuredClone and JSON roundtrip mid-match continue identically', () => {
    const base = run(7, 1500).s;
    const a = sim.cloneState(base);
    const b = structuredClone(base);
    const c: MatchState = JSON.parse(JSON.stringify(base));
    expect(sim.hashState(a)).toBe(sim.hashState(base));
    expect(sim.hashState(c)).toBe(sim.hashState(base));
    const ha = run(7, 1500, a).hashes;
    const hb = run(7, 1500, b).hashes;
    const hc = run(7, 1500, c).hashes;
    const hbase = run(7, 1500, base).hashes;
    expect(ha).toEqual(hbase);
    expect(hb).toEqual(hbase);
    expect(hc).toEqual(hbase);
  });

  it('state contains only plain JSON data', () => {
    const s = run(3, 800).s;
    const json = JSON.stringify(s);
    expect(JSON.stringify(JSON.parse(json))).toBe(json);
    const walk = (v: unknown): void => {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        expect(Object.getPrototypeOf(v)).toBe(Object.prototype);
        Object.values(v).forEach(walk);
      } else expect(['string', 'boolean', 'number']).toContain(v === null ? 'string' : typeof v);
    };
    walk(s);
  });

  it('positions and velocities are integers', () => {
    const { s } = run(11, 2000);
    for (const f of s.fighters) for (const k of ['x', 'y', 'vx', 'vy', 'hp', 'energy', 'ult'] as const) expect(Number.isInteger(f[k])).toBe(true);
  });

  it('hash detects a one-unit change', () => {
    const s = run(5, 300).s;
    const h = sim.hashState(s);
    s.fighters[0].x += 1;
    expect(sim.hashState(s)).not.toBe(h);
  });
});
