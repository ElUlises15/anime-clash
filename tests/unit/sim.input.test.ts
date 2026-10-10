import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { sim } from '../../src/game/sim/engine';
import { FX } from '../../src/game/sim/types';
import { PUSH_HALF_W_PX } from '../../src/game/sim/constants';
import { fightReady, place, stepN, tap } from './helpers';

describe('movement & input', () => {
  it('walks forward/back with different speeds and auto-faces the opponent', () => {
    const s = fightReady();
    const x0 = s.fighters[0].x;
    stepN(s, 10, [BTN.RIGHT, 0]);
    const fwd = s.fighters[0].x - x0;
    expect(fwd).toBeGreaterThan(0);
    expect(s.fighters[0].anim).toBe('walkFwd');
    const x1 = s.fighters[0].x;
    stepN(s, 10, [BTN.LEFT, 0]);
    expect(x1 - s.fighters[0].x).toBeLessThan(fwd);
    expect(s.fighters[0].anim).toBe('walkBack');
    // swap sides -> facing flips
    place(s, 1500, 1200);
    s.fighters[0].facing = 1;
    stepN(s, 1);
    expect(s.fighters[0].facing).toBe(-1);
  });

  it('push boxes keep fighters apart', () => {
    const s = fightReady();
    place(s, 1100, 1200);
    stepN(s, 60, [BTN.RIGHT, BTN.LEFT]);
    expect(Math.abs(s.fighters[1].x - s.fighters[0].x)).toBeGreaterThanOrEqual(PUSH_HALF_W_PX * 2 * FX - 1);
  });

  it('jump arcs: neutral, forward, back; lands with event', () => {
    for (const [dir, sign] of [[0, 0], [BTN.RIGHT, 1], [BTN.LEFT, -1]] as const) {
      const s = fightReady();
      place(s, 800, 1500);
      const x0 = s.fighters[0].x;
      const f0 = s.frame;
      const evs = stepN(s, 70, (st) => [st.frame < f0 + 3 ? BTN.UP | dir : 0, 0]);
      expect(evs.some((e) => e.type === 'jump')).toBe(true);
      expect(evs.some((e) => e.type === 'land')).toBe(true);
      expect(Math.sign(s.fighters[0].x - x0)).toBe(sign);
    }
  });

  it('double jump / air dash consume air actions', () => {
    const s = fightReady({ p1: 'naruto' });
    place(s, 800, 1500);
    stepN(s, 1, [BTN.UP, 0]);
    stepN(s, 8, [0, 0]);
    const evs = stepN(s, 1, [BTN.UP, 0]);
    expect(evs.filter((e) => e.type === 'jump').length).toBe(1);
    expect(s.fighters[0].airActions).toBe(1);
    stepN(s, 2);
    const ev2 = stepN(s, 1, [BTN.DASH | BTN.RIGHT, 0]);
    expect(ev2.some((e) => e.type === 'dash')).toBe(true);
    expect(s.fighters[0].airActions).toBe(2);
  });

  it('dash and backdash (with i-frames)', () => {
    const s = fightReady();
    place(s, 800, 1500);
    const x0 = s.fighters[0].x;
    let evs = tap(s, 0, BTN.DASH | BTN.RIGHT, 20);
    expect(evs.some((e) => e.type === 'dash')).toBe(true);
    expect(s.fighters[0].x - x0).toBeGreaterThan(100 * FX);
    const x1 = s.fighters[0].x;
    evs = tap(s, 0, BTN.DASH | BTN.LEFT, 2);
    expect(s.fighters[0].anim).toBe('backdash');
    expect(s.fighters[0].invulnFrames).toBeGreaterThan(0);
    stepN(s, 20);
    expect(s.fighters[0].x).toBeLessThan(x1);
  });

  it('buffers an attack pressed during recovery (~6 frames)', () => {
    const s = fightReady();
    place(s, 800, 1500);
    tap(s, 0, BTN.HEAVY, 1);
    // roundhouse total 10+4+18 = 32 frames; press light 4 frames before it ends
    stepN(s, 27);
    expect(s.fighters[0].moveId).toBe('goku_roundhouse');
    const evs = tap(s, 0, BTN.LIGHT, 8);
    expect(evs.some((e) => e.type === 'moveStart' && e.moveId === 'goku_jab')).toBe(true);
  });

  it('presses older than the buffer window are dropped', () => {
    const s = fightReady();
    place(s, 800, 1500);
    tap(s, 0, BTN.HEAVY, 1);
    stepN(s, 5);
    const evs = tap(s, 0, BTN.LIGHT, 40);
    expect(evs.some((e) => e.type === 'moveStart' && e.moveId === 'goku_jab')).toBe(false);
  });

  it('command variants: DOWN+SP2 / DOWN+SP1 / air SP1', () => {
    let s = fightReady();
    place(s, 800, 1500);
    let evs = tap(s, 0, BTN.DOWN | BTN.SP2, 2);
    expect(evs.find((e) => e.type === 'specialStart')?.moveId).toBe('goku_instant_transmission');
    s = fightReady();
    place(s, 800, 1500);
    evs = tap(s, 0, BTN.DOWN | BTN.SP1, 2);
    expect(evs.find((e) => e.type === 'specialStart')?.moveId).toBe('goku_kiai');
    s = fightReady();
    place(s, 800, 1500);
    stepN(s, 1, [BTN.UP, 0]);
    stepN(s, 6);
    evs = tap(s, 0, BTN.SP1, 2);
    expect(evs.find((e) => e.type === 'specialStart')?.moveId).toBe('goku_air_ki_blast');
  });

  it('normals cancel into specials on hit', () => {
    const s = fightReady();
    place(s, 1000, 1100);
    const evs = stepN(s, 30, (st) => {
      const f = st.fighters[0];
      if (!f.moveId && st.frame % 2 === 0) return [BTN.HEAVY, 0];
      if (f.moveId === 'goku_roundhouse' && f.moveConnect && st.frame % 2 === 0) return [BTN.SP2, 0];
      return [0, 0];
    });
    const rh = evs.find((e) => e.type === 'hit' && e.moveId === 'goku_roundhouse');
    const kame = evs.find((e) => e.type === 'specialStart' && e.moveId === 'goku_kamehameha');
    expect(rh && kame).toBeTruthy();
    // cancelled before the roundhouse recovery would have ended (10+4+18 = 32 frames)
    expect(kame!.frame - rh!.frame).toBeLessThan(18);
  });

  it('launcher can be jump-cancelled on hit (Naruto)', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 1000, 1100);
    tap(s, 0, BTN.HEAVY, 1);
    const evs = stepN(s, 25, (st) => [st.fighters[0].moveConnect === 2 ? BTN.UP | BTN.RIGHT : 0, 0]);
    expect(evs.some((e) => e.type === 'hit' && e.moveId === 'naruto_rising_kick')).toBe(true);
    expect(evs.some((e) => e.type === 'jump' && e.player === 0)).toBe(true);
    expect(s.fighters[1].grounded).toBe(false);
  });

  it('inputs are ignored during the intro', () => {
    const s = sim.createMatch({ p1: 'goku', p2: 'naruto', seed: 1, mode: 'versus' });
    const x0 = s.fighters[0].x;
    for (let i = 0; i < 50; i++) sim.step(s, [BTN.RIGHT | BTN.LIGHT, 0]);
    expect(s.fighters[0].x).toBe(x0);
    expect(s.fighters[0].anim).toBe('intro');
  });
});
