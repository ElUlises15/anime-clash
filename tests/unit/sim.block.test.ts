import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { sim } from '../../src/game/sim/engine';
import { fightReady, place, stepN } from './helpers';

/** P1 performs `atk` (one press), P2 holds `hold`. */
function exchange(atk: number, hold: number, frames = 40, p2x = 1100, air = false) {
  const s = fightReady();
  place(s, 1000, p2x);
  if (air) { s.fighters[0].y = 9000; s.fighters[0].grounded = false; s.fighters[0].mode = 'jump'; s.fighters[0].vy = 0; }
  const hp = s.fighters[1].hp;
  const f0 = s.frame + 1;
  const evs = stepN(s, frames, (st) => [st.frame === f0 ? atk : 0, hold]);
  return { s, evs, dmg: hp - s.fighters[1].hp };
}

describe('blocking', () => {
  it('standing block stops a mid normal with no chip', () => {
    const { s, evs, dmg } = exchange(BTN.LIGHT, BTN.BLOCK);
    expect(evs.some((e) => e.type === 'block')).toBe(true);
    expect(evs.some((e) => e.type === 'hit')).toBe(false);
    expect(dmg).toBe(0);
    expect(s.fighters[1].stats.blocks).toBe(1);
  });

  it('blockstun is applied', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    for (let i = 0; i < 12; i++) {
      sim.step(s, [i === 0 ? BTN.LIGHT : 0, BTN.BLOCK]);
      if (s.events.some((e) => e.type === 'block')) break;
    }
    expect(s.fighters[1].mode).toBe('blockstun');
    expect(s.fighters[1].stunFrames).toBeGreaterThan(0);
  });

  it('specials deal chip damage on block', () => {
    const { evs, dmg } = exchange(BTN.SP1, BTN.BLOCK, 80, 1400);
    expect(evs.some((e) => e.type === 'block' && e.moveId === 'goku_ki_blast')).toBe(true);
    expect(dmg).toBeGreaterThan(0);
    expect(dmg).toBeLessThan(15);
  });

  it('standing block loses to lows; crouch block stops them', () => {
    const stand = exchange(BTN.DOWN | BTN.HEAVY, BTN.BLOCK);
    expect(stand.evs.some((e) => e.type === 'hit' && e.moveId === 'goku_sweep')).toBe(true);
    const crouch = exchange(BTN.DOWN | BTN.HEAVY, BTN.BLOCK | BTN.DOWN);
    expect(crouch.evs.some((e) => e.type === 'block' && e.moveId === 'goku_sweep')).toBe(true);
    expect(crouch.dmg).toBe(0);
  });

  it('crouch block loses to overheads (air attacks); standing block stops them', () => {
    const crouch = exchange(BTN.HEAVY, BTN.BLOCK | BTN.DOWN, 30, 1060, true);
    expect(crouch.evs.some((e) => e.type === 'hit' && e.moveId === 'goku_axe_kick')).toBe(true);
    const stand = exchange(BTN.HEAVY, BTN.BLOCK, 30, 1060, true);
    expect(stand.evs.some((e) => e.type === 'block' && e.moveId === 'goku_axe_kick')).toBe(true);
  });

  it('not holding block = hit', () => {
    const { evs, dmg } = exchange(BTN.LIGHT, 0);
    expect(evs.some((e) => e.type === 'hit')).toBe(true);
    expect(dmg).toBeGreaterThan(0);
  });
});
