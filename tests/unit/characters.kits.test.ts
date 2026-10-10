/** Vegeta / Sasuke kits: built purely from existing ability components (no engine code knows these ids). */
import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { FX, ULT_MAX } from '../../src/game/sim/types';
import type { SimEvent } from '../../src/game/sim/types';
import { fightReady, place, stepN, tap } from './helpers';

const count = (evs: SimEvent[], type: string, moveId?: string) =>
  evs.filter((e) => e.type === type && (!moveId || e.moveId === moveId)).length;
const dmgPct = (f: { hp: number; maxHp: number }) => ((f.maxHp - f.hp) * 100) / f.maxHp;

describe('Vegeta', () => {
  it('Ráfaga de Ki: a barrage of 4 blasts that hits several times', () => {
    const s = fightReady({ p1: 'vegeta', p2: 'goku' });
    place(s, 900, 1400);
    const evs = tap(s, 0, BTN.SP1, 90);
    expect(count(evs, 'projectileSpawn', 'vegeta_ki_barrage')).toBe(4);
    expect(count(evs, 'hit', 'vegeta_ki_barrage')).toBeGreaterThanOrEqual(3);
    expect(s.fighters[0].stats.maxCombo).toBeGreaterThanOrEqual(3);
  });

  it('Ráfaga de Ki beats a single ki blast and keeps going', () => {
    const s = fightReady({ p1: 'vegeta', p2: 'goku' });
    place(s, 700, 1500);
    const f0 = s.frame;
    const evs = stepN(s, 90, (st) => [st.frame === f0 + 1 ? BTN.SP1 : 0, st.frame === f0 + 1 ? BTN.SP1 : 0]);
    expect(count(evs, 'projectileClash')).toBe(1);
    expect(count(evs, 'hit', 'vegeta_ki_barrage')).toBeGreaterThanOrEqual(2);
    expect(s.fighters[0].hp).toBe(s.fighters[0].maxHp);
  });

  it('Galick Gun: purple multi-hit beam', () => {
    const s = fightReady({ p1: 'vegeta', p2: 'naruto' });
    place(s, 900, 1300);
    s.fighters[0].energy = 1000;
    const evs = tap(s, 0, BTN.SP2, 100);
    expect(evs.find((e) => e.type === 'beamStart')?.visual).toBe('galickGun');
    expect(count(evs, 'hit', 'vegeta_galick_gun')).toBeGreaterThanOrEqual(4);
  });

  it('Big Bang Attack: slow orb that explodes in an AOE on contact', () => {
    const s = fightReady({ p1: 'vegeta', p2: 'goku' });
    place(s, 900, 1300);
    s.fighters[0].energy = 1000;
    const evs = tap(s, 0, BTN.DOWN | BTN.SP1, 120);
    const spawn = evs.find((e) => e.type === 'projectileSpawn' && e.moveId === 'vegeta_big_bang');
    expect(spawn?.visual).toBe('bigBang');
    expect(count(evs, 'aoe', 'vegeta_big_bang')).toBe(1);
    expect(count(evs, 'hit', 'vegeta_big_bang')).toBeGreaterThanOrEqual(3);
    expect(dmgPct(s.fighters[1])).toBeGreaterThan(8);
  });

  it('Big Bang Attack detonates at the end of its range even on a whiff', () => {
    const s = fightReady({ p1: 'vegeta', p2: 'goku' });
    place(s, 300, 2300);
    s.fighters[0].energy = 1000;
    const evs = tap(s, 0, BTN.DOWN | BTN.SP1, 140);
    expect(count(evs, 'aoe', 'vegeta_big_bang')).toBe(1);
  });

  it('Barrera absorbs projectiles, melee and clone strikes, then bursts', () => {
    // projectile
    let s = fightReady({ p1: 'goku', p2: 'vegeta' });
    place(s, 900, 1250);
    s.fighters[1].energy = 1000;
    tap(s, 0, BTN.SP1, 3);
    let evs = tap(s, 1, BTN.DOWN | BTN.SP2, 50);
    expect(count(evs, 'shield', 'vegeta_barrier')).toBeGreaterThanOrEqual(2);
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
    // melee + burst
    s = fightReady({ p1: 'goku', p2: 'vegeta' });
    place(s, 1000, 1095);
    s.fighters[1].energy = 1000;
    tap(s, 1, BTN.DOWN | BTN.SP2, 6);
    evs = stepN(s, 50, (st) => [st.frame % 3 === 0 ? BTN.LIGHT : 0, 0]);
    expect(count(evs, 'hit', 'goku_jab')).toBe(0);
    expect(count(evs, 'aoe', 'vegeta_barrier')).toBe(1);
    expect(count(evs, 'hit', 'vegeta_barrier')).toBe(1);
    // clones
    s = fightReady({ p1: 'naruto', p2: 'vegeta' });
    place(s, 900, 1300);
    s.fighters[0].energy = 1000; s.fighters[1].energy = 1000;
    tap(s, 0, BTN.SP1, 30);
    evs = tap(s, 1, BTN.DOWN | BTN.SP2, 40);
    expect(count(evs, 'hit', 'naruto_kage_bunshin')).toBe(0);
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
  });

  it('Final Flash: cinematic, huge yellow beam, ~25-35% damage', () => {
    const s = fightReady({ p1: 'vegeta', p2: 'goku' });
    place(s, 900, 1300);
    s.fighters[0].ult = ULT_MAX;
    const evs = tap(s, 0, BTN.ULT, 400);
    expect(count(evs, 'ultimateStart', 'vegeta_final_flash')).toBe(1);
    expect(evs.find((e) => e.type === 'beamStart')?.visual).toBe('finalFlash');
    expect(count(evs, 'hit', 'vegeta_final_flash')).toBeGreaterThanOrEqual(8);
    expect(dmgPct(s.fighters[1])).toBeGreaterThanOrEqual(25);
    expect(dmgPct(s.fighters[1])).toBeLessThanOrEqual(35);
  });
});

describe('Sasuke', () => {
  it('Gōkakyū: big slow fireball that hits twice and beats a ki blast', () => {
    let s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 900, 1300);
    let evs = tap(s, 0, BTN.SP1, 100);
    expect(evs.find((e) => e.type === 'projectileSpawn')?.visual).toBe('fireball');
    expect(count(evs, 'hit', 'sasuke_goukakyuu')).toBe(2);
    s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 700, 1500);
    const f0 = s.frame;
    evs = stepN(s, 120, (st) => [st.frame === f0 + 1 ? BTN.SP1 : 0, st.frame === f0 + 1 ? BTN.SP1 : 0]);
    expect(count(evs, 'projectileClash')).toBe(1);
    expect(count(evs, 'hit', 'sasuke_goukakyuu')).toBeGreaterThanOrEqual(1);
  });

  it('Shuriken: two fast projectiles', () => {
    const s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 900, 1500);
    const evs = tap(s, 0, BTN.DOWN | BTN.SP1, 50);
    expect(count(evs, 'projectileSpawn', 'sasuke_shuriken')).toBe(2);
    expect(count(evs, 'hit', 'sasuke_shuriken')).toBe(2);
    expect(s.entities.find((e) => e.moveId === 'sasuke_shuriken')).toBeUndefined();
  });

  it('Chidori: crosses half the screen fast and knocks down', () => {
    const s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 900, 1300);
    s.fighters[0].energy = 1000;
    const x0 = s.fighters[0].x;
    const evs = tap(s, 0, BTN.SP2, 80);
    expect(count(evs, 'hit', 'sasuke_chidori')).toBe(1);
    expect((s.fighters[0].x - x0) / FX).toBeGreaterThan(250);
    expect(evs.some((e) => e.type === 'knockdown' && e.player === 1)).toBe(true);
  });

  it('Sharingan: parries a hit, teleports behind and strikes', () => {
    const s = fightReady({ p1: 'goku', p2: 'sasuke' });
    place(s, 1000, 1100);
    s.fighters[1].energy = 1000;
    tap(s, 1, BTN.DOWN | BTN.SP2, 3);
    const evs = tap(s, 0, BTN.LIGHT, 40);
    expect(count(evs, 'parry', 'sasuke_sharingan')).toBe(1);
    expect(count(evs, 'counterHit', 'sasuke_sharingan')).toBe(1);
    expect(evs.find((e) => e.type === 'parry')?.visual).toBe('sharingan');
    expect(count(evs, 'teleport')).toBeGreaterThanOrEqual(1);
    expect(s.fighters[0].hp).toBeLessThan(s.fighters[0].maxHp);
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
  });

  it('Shuriken Trampa (air SP1): sets a wire trap on the ground that catches the opponent', () => {
    const s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 900, 1300);
    s.fighters[0].energy = 1000;
    stepN(s, 1, [BTN.UP, 0]);
    stepN(s, 6);
    let evs = tap(s, 0, BTN.SP1, 40);
    const set = evs.find((e) => e.type === 'trapSet');
    expect(set?.visual).toBe('wireTrap');
    expect(set!.y).toBe(0);
    evs = stepN(s, 120, [0, BTN.LEFT]);
    expect(count(evs, 'trapTrigger', 'sasuke_wire_trap')).toBe(1);
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
  });

  it('Kirin: lightning AOE drops on the opponent position after the cinematic', () => {
    const s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 600, 1500);
    s.fighters[0].ult = ULT_MAX;
    const evs = tap(s, 0, BTN.ULT, 400);
    expect(count(evs, 'ultimateStart', 'sasuke_kirin')).toBe(1);
    const strike = evs.find((e) => e.type === 'aoe' && e.moveId === 'sasuke_kirin');
    expect(strike?.visual).toBe('kirin');
    expect(Math.abs(strike!.x / FX - 1500)).toBeLessThan(10);
    expect(count(evs, 'hit', 'sasuke_kirin')).toBeGreaterThanOrEqual(5);
    expect(dmgPct(s.fighters[1])).toBeGreaterThanOrEqual(20);
    expect(dmgPct(s.fighters[1])).toBeLessThanOrEqual(32);
  });

  it('Dive kick changes the jump angle', () => {
    const s = fightReady({ p1: 'sasuke', p2: 'goku' });
    place(s, 900, 1600);
    stepN(s, 1, [BTN.UP, 0]);
    stepN(s, 10);
    tap(s, 0, BTN.HEAVY, 9);
    expect(s.fighters[0].vy).toBeLessThan(-1000);
    expect(s.fighters[0].vx).toBeGreaterThan(0);
  });
});

describe('all characters: determinism under seeded random input', () => {
  it('every pairing replays to the same hash and survives a JSON roundtrip mid-match', async () => {
    const { sim } = await import('../../src/game/sim/engine');
    const { listCharacters } = await import('../../src/characters/registry');
    const ids = listCharacters().map((c) => c.id);
    for (const p1 of ids) {
      for (const p2 of ids) {
        let r = 12345;
        const rnd = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r >>> 16; };
        const inputs: [number, number][] = [];
        for (let i = 0; i < 1500; i++) inputs.push([rnd() & 0x7ff, rnd() & 0x7ff]);
        const a = sim.createMatch({ p1, p2, seed: 7, mode: 'versus' });
        const b = sim.createMatch({ p1, p2, seed: 7, mode: 'versus' });
        let c: ReturnType<typeof sim.createMatch> | null = null;
        for (let i = 0; i < inputs.length; i++) {
          sim.step(a, inputs[i]);
          sim.step(b, inputs[i]);
          if (i === 700) c = JSON.parse(JSON.stringify(a));
          else if (c) sim.step(c, inputs[i]);
        }
        expect(sim.hashState(a), `${p1} vs ${p2}`).toBe(sim.hashState(b));
        expect(sim.hashState(c!), `${p1} vs ${p2} roundtrip`).toBe(sim.hashState(a));
      }
    }
  }, 30_000);
});
