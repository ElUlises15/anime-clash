import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { deriveStats, STAT_BUDGET } from '../../src/game/sim/balance';
import { ENERGY_MAX } from '../../src/game/sim/types';
import { fightReady, place, stepN } from './helpers';

/** Scripted bread-and-butter: press the next button of `seq` whenever the current move has connected. */
function bnb(p1: string, p2: string, seq: number[]) {
  const s = fightReady({ p1, p2 });
  place(s, 1000, 1095);
  s.fighters[0].energy = ENERGY_MAX;
  let idx = 0;
  let lastMove: string | null = null;
  stepN(s, 180, (st) => {
    const f = st.fighters[0];
    if (idx >= seq.length) return [0, 0];
    const ready = idx === 0 ? !f.moveId : f.moveConnect > 0 && f.moveId === lastMove;
    if (ready && (f.prevInput & seq[idx] & ~(BTN.DOWN | BTN.LEFT | BTN.RIGHT)) === 0) {
      return [seq[idx], 0];
    }
    if (f.moveId && f.moveId !== lastMove) { lastMove = f.moveId; idx++; }
    return [0, 0];
  });
  return s;
}

describe('balance targets', () => {
  it('derived stats are normalized for any legal stat spread', () => {
    for (const spread of [[5, 5, 5, 5, 5], [10, 10, 1, 1, 3], [1, 1, 10, 10, 3], [1, 10, 10, 1, 3]]) {
      const [power, speed, mobility, defense, energy] = spread;
      expect(power + speed + mobility + defense + energy).toBeLessThanOrEqual(STAT_BUDGET);
      const d = deriveStats({ power, speed, mobility, defense, energy });
      expect(d.health).toBeGreaterThanOrEqual(880);
      expect(d.health).toBeLessThanOrEqual(1150);
      expect(d.walkSpeed / 100).toBeGreaterThanOrEqual(4);
      expect(d.walkSpeed / 100).toBeLessThanOrEqual(7);
    }
  });

  it.each([
    ['goku', [BTN.LIGHT, BTN.LIGHT, BTN.HEAVY, BTN.SP2]],
    ['naruto', [BTN.LIGHT, BTN.LIGHT, BTN.HEAVY, BTN.SP2]],
  ] as const)('%s BnB combo: 4+ hits for 15-25%% HP', (id, seq) => {
    const s = bnb(id, id === 'goku' ? 'naruto' : 'goku', [...seq]);
    const d = s.fighters[1];
    const pct = ((d.maxHp - d.hp) * 100) / d.maxHp;
    expect(s.fighters[0].stats.maxCombo).toBeGreaterThanOrEqual(4);
    expect(pct).toBeGreaterThanOrEqual(15);
    expect(pct).toBeLessThanOrEqual(25);
  });
});
