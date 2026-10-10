import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { sim } from '../../src/game/sim/engine';
import { getCharacter } from '../../src/characters/registry';
import { deriveStats } from '../../src/game/sim/balance';
import { HITSTOP, COMBO_SCALING } from '../../src/game/sim/constants';
import { fightReady, place, stepN, tap } from './helpers';

const goku = getCharacter('goku');
const naruto = getCharacter('naruto');
const expectedDmg = (base: number, atkPower: number, defPct: number, scale = 100) =>
  Math.max(1, Math.trunc((base * atkPower * scale * defPct) / 1_000_000));

describe('damage & hits', () => {
  it('jab damages an idle opponent by base * power * defense', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    const hp0 = s.fighters[1].hp;
    const evs = tap(s, 0, BTN.LIGHT, 12);
    const hit = evs.find((e) => e.type === 'hit');
    expect(hit).toBeTruthy();
    const dmg = expectedDmg(goku.moves.light.damage, deriveStats(goku.stats).powerMul, deriveStats(naruto.stats).defense);
    expect(hp0 - s.fighters[1].hp).toBe(dmg);
    expect(hit!.damage).toBe(dmg);
    expect(hit!.strength).toBe('light');
    expect(hit!.combo).toBe(1);
    expect(s.fighters[0].stats.hitsLanded).toBe(1);
    expect(s.fighters[0].stats.damageDealt).toBe(dmg);
  });

  it('hit sets hitstop and hitstun on the defender', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    for (let i = 0; i < 12; i++) {
      sim.step(s, [i === 0 ? BTN.LIGHT : 0, 0]);
      if (s.events.some((e) => e.type === 'hit')) break;
    }
    expect(s.hitstop).toBe(HITSTOP.light);
    expect(s.fighters[1].mode).toBe('hitstun');
    expect(s.fighters[1].anim).toBe('hit');
  });

  it('chain jab -> straight -> roundhouse combos with scaling and counter', () => {
    const s = fightReady();
    place(s, 1000, 1090);
    const evs = stepN(s, 60, (st) => {
      const f = st.fighters[0];
      // mash in sequence: press a fresh button every other frame
      const t = st.frame % 2 === 0;
      if (!t) return [0, 0];
      const slot = f.moveId;
      if (slot === 'goku_jab' && f.moveConnect) return [BTN.LIGHT, 0];
      if (slot === 'goku_straight' && f.moveConnect) return [BTN.HEAVY, 0];
      if (!slot) return [BTN.LIGHT, 0];
      return [0, 0];
    });
    const hits = evs.filter((e) => e.type === 'hit');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.slice(0, 3).map((h) => h.moveId)).toEqual(['goku_jab', 'goku_straight', 'goku_roundhouse']);
    expect(hits.slice(0, 3).map((h) => h.combo)).toEqual([1, 2, 3]);
    const p = deriveStats(goku.stats).powerMul, d = deriveStats(naruto.stats).defense;
    expect(hits[2].damage).toBe(expectedDmg(goku.moves.heavy.damage, p, d, COMBO_SCALING[2]));
    expect(s.fighters[0].stats.maxCombo).toBeGreaterThanOrEqual(3);
  });

  it('sweep knocks down; getup grants invulnerability', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    const evs = tap(s, 0, BTN.DOWN | BTN.HEAVY, 40);
    expect(evs.some((e) => e.type === 'hit' && e.moveId === 'goku_sweep')).toBe(true);
    expect(evs.some((e) => e.type === 'knockdown')).toBe(true);
    const more = stepN(s, 60);
    expect(more.some((e) => e.type === 'getup')).toBe(true);
    // during getup the defender cannot be hit
    expect(['getup', 'idle']).toContain(s.fighters[1].mode);
  });

  it('whiffed attack does not damage', () => {
    const s = fightReady();
    place(s, 900, 1300);
    const hp = s.fighters[1].hp;
    tap(s, 0, BTN.HEAVY, 40);
    expect(s.fighters[1].hp).toBe(hp);
  });

  it('simultaneous hits trade (mirror)', () => {
    const s = fightReady({ p2: 'goku' });
    place(s, 1000, 1090);
    const evs = stepN(s, 12, (st) => (st.frame % 2 === 0 && !st.fighters[0].moveId ? [BTN.LIGHT, BTN.LIGHT] : [0, 0]));
    const hits = evs.filter((e) => e.type === 'hit');
    expect(new Set(hits.map((h) => h.player)).size).toBe(2);
  });
});
