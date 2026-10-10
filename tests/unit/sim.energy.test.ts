import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { ENERGY_MAX, ULT_MAX } from '../../src/game/sim/types';
import { ENERGY_START, ENERGY_GAIN_LIGHT, ENERGY_GAIN_BLOCK } from '../../src/game/sim/constants';
import { getCharacter } from '../../src/characters/registry';
import { deriveStats } from '../../src/game/sim/balance';
import { fightReady, newMatch, place, stepN, tap } from './helpers';

const goku = getCharacter('goku');

describe('energy', () => {
  it('starts at ENERGY_START and regenerates passively', () => {
    const s0 = newMatch();
    expect(s0.fighters[0].energy).toBe(ENERGY_START);
    const s = fightReady();
    const e0 = s.fighters[0].energy;
    stepN(s, 600);
    const regen = deriveStats(goku.stats).energyRegen; // centi-energy per frame
    expect(s.fighters[0].energy - e0).toBeGreaterThanOrEqual(Math.trunc((600 * regen) / 100) - 1);
    expect(s.fighters[0].energy - e0).toBeLessThanOrEqual(Math.trunc((600 * regen) / 100) + 1);
  });

  it('caps at ENERGY_MAX and emits energyFull', () => {
    const s = fightReady();
    s.fighters[0].energy = ENERGY_MAX - 2;
    const evs = stepN(s, 30);
    expect(s.fighters[0].energy).toBe(ENERGY_MAX);
    expect(evs.some((e) => e.type === 'energyFull' && e.player === 0)).toBe(true);
  });

  it('specials cost energy; not enough energy = no special', () => {
    const s = fightReady();
    place(s, 900, 1500);
    const before = s.fighters[0].energy;
    const evs = tap(s, 0, BTN.SP1, 2);
    expect(evs.some((e) => e.type === 'specialStart' && e.moveId === 'goku_ki_blast')).toBe(true);
    expect(before - s.fighters[0].energy).toBeGreaterThanOrEqual(goku.moves.special1.energyCost - 2);

    const s2 = fightReady();
    s2.fighters[0].energy = 10;
    const evs2 = tap(s2, 0, BTN.SP1, 10);
    expect(evs2.some((e) => e.type === 'specialStart')).toBe(false);
  });

  it('gain on hit (attacker) and on block (defender)', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    s.config.mode = 'versus';
    const a0 = s.fighters[0].energy;
    let hitFrame = -1;
    for (let i = 0; i < 12 && hitFrame < 0; i++) {
      tap(s, 0, i === 0 ? BTN.LIGHT : 0, 1);
      if (s.events.some((e) => e.type === 'hit')) hitFrame = s.frame;
    }
    expect(s.fighters[0].energy - a0).toBeGreaterThanOrEqual(ENERGY_GAIN_LIGHT);

    const b = fightReady();
    place(b, 1000, 1100);
    const d0 = b.fighters[1].energy;
    for (let i = 0; i < 12; i++) {
      tap(b, 0, i === 0 ? BTN.LIGHT : 0, 1, BTN.BLOCK);
      if (b.events.some((e) => e.type === 'block')) break;
    }
    expect(b.fighters[1].energy - d0).toBeGreaterThanOrEqual(ENERGY_GAIN_BLOCK);
  });
});

describe('ultimate meter', () => {
  it('fills from dealing and taking damage', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    tap(s, 0, BTN.HEAVY, 30);
    expect(s.fighters[0].ult).toBeGreaterThan(0);
    expect(s.fighters[1].ult).toBeGreaterThan(s.fighters[0].ult);
  });

  it('ultimate requires a full meter and consumes it', () => {
    const s = fightReady();
    place(s, 1000, 1400);
    s.fighters[0].ult = ULT_MAX - 1;
    let evs = tap(s, 0, BTN.ULT, 5);
    expect(evs.some((e) => e.type === 'ultimateStart')).toBe(false);
    s.fighters[0].ult = ULT_MAX;
    evs = tap(s, 0, BTN.ULT, 3);
    expect(evs.some((e) => e.type === 'ultimateStart' && e.player === 0)).toBe(true);
    expect(s.fighters[0].ult).toBe(0);
    expect(s.fighters[0].stats.ultimatesUsed).toBe(1);
  });
});

describe('cooldowns', () => {
  it('a move on cooldown cannot be reused until it expires', () => {
    const s = fightReady();
    place(s, 900, 1500);
    s.fighters[0].energy = ENERGY_MAX;
    const cd = goku.moves.special1.cooldown;
    let evs = tap(s, 0, BTN.SP1, 3);
    expect(evs.filter((e) => e.type === 'specialStart').length).toBe(1);
    expect(s.fighters[0].cooldowns['goku_ki_blast']).toBeGreaterThan(0);
    // finish the move, then try again while still cooling down
    stepN(s, 30);
    s.fighters[0].energy = ENERGY_MAX;
    evs = tap(s, 0, BTN.SP1, 3);
    expect(evs.some((e) => e.type === 'specialStart')).toBe(false);
    stepN(s, cd);
    s.fighters[0].energy = ENERGY_MAX;
    evs = tap(s, 0, BTN.SP1, 3);
    expect(evs.some((e) => e.type === 'specialStart' && e.moveId === 'goku_ki_blast')).toBe(true);
  });
});
