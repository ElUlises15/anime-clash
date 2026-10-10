import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { sim } from '../../src/game/sim/engine';
import { FX, ULT_MAX, ENERGY_MAX } from '../../src/game/sim/types';
import type { MatchState, SimEvent } from '../../src/game/sim/types';
import { getAbility } from '../../src/abilities';
import { makeCtx } from '../../src/game/sim/context';
import { getCharacter } from '../../src/characters/registry';
import { effStats } from '../../src/game/sim/stats';
import { fightReady, place, stepN, tap } from './helpers';

const goku = getCharacter('goku');
const naruto = getCharacter('naruto');

function full(s: MatchState) {
  for (const f of s.fighters) { f.energy = ENERGY_MAX; }
}
const count = (evs: SimEvent[], type: string, moveId?: string) =>
  evs.filter((e) => e.type === type && (!moveId || e.moveId === moveId)).length;

describe('ability components', () => {
  it('projectile: spawns, travels and hits', () => {
    const s = fightReady();
    place(s, 900, 1400);
    const hp = s.fighters[1].hp;
    const evs = tap(s, 0, BTN.SP1, 60);
    expect(count(evs, 'projectileSpawn', 'goku_ki_blast')).toBe(1);
    expect(count(evs, 'projectileHit', 'goku_ki_blast')).toBe(1);
    expect(s.fighters[1].hp).toBeLessThan(hp);
    expect(s.entities.filter((e) => e.kind === 'projectile').length).toBe(0);
  });

  it('projectile clash: equal-power projectiles cancel', () => {
    const s = fightReady();
    place(s, 800, 1500);
    const hp = [s.fighters[0].hp, s.fighters[1].hp];
    const f0 = s.frame;
    const evs2 = stepN(s, 80, (st) => [st.frame === f0 + 1 ? BTN.SP1 : 0, st.frame === f0 + 1 ? BTN.DOWN | BTN.SP1 : 0]);
    expect(count(evs2, 'projectileClash')).toBe(1);
    expect([s.fighters[0].hp, s.fighters[1].hp]).toEqual(hp);
  });

  it('beam: multi-hits and ends', () => {
    const s = fightReady();
    place(s, 900, 1300);
    full(s);
    const evs = tap(s, 0, BTN.SP2, 120);
    expect(count(evs, 'beamStart', 'goku_kamehameha')).toBe(1);
    expect(count(evs, 'hit', 'goku_kamehameha')).toBeGreaterThanOrEqual(4);
    expect(count(evs, 'beamEnd')).toBe(1);
    expect(evs.some((e) => e.type === 'knockdown' && e.player === 1)).toBe(true);
  });

  it('beam is cut when the owner is interrupted', () => {
    const s = fightReady();
    place(s, 900, 1000);
    full(s);
    tap(s, 0, BTN.SP2, 1);
    // Naruto jabs Goku during startup
    const evs = stepN(s, 30, (st) => [0, st.frame % 2 === 0 ? BTN.LIGHT : 0]);
    expect(count(evs, 'hit', 'naruto_jab')).toBeGreaterThan(0);
    expect(s.entities.filter((e) => e.kind === 'beam').length).toBe(0);
  });

  it('dashAttack: travels fast and stops on hit with knockdown', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 900, 1150);
    full(s);
    const x0 = s.fighters[0].x;
    const evs = tap(s, 0, BTN.SP2, 70);
    expect(count(evs, 'hit', 'naruto_rasengan')).toBe(1);
    expect(s.fighters[0].x - x0).toBeGreaterThan(100 * FX);
    expect(evs.some((e) => e.type === 'knockdown' && e.player === 1)).toBe(true);
  });

  it('teleport: Instant Transmission appears behind and strikes', () => {
    const s = fightReady();
    place(s, 800, 1300);
    full(s);
    const evs = tap(s, 0, BTN.DOWN | BTN.SP2, 40);
    expect(count(evs, 'teleport')).toBe(2);
    expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x - 10 * FX);
    expect(count(evs, 'hit', 'goku_instant_transmission')).toBe(1);
  });

  it('counter: Kawarimi parries a melee attack and auto-strikes from behind', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 1000, 1100);
    full(s);
    tap(s, 0, BTN.DOWN | BTN.SP2, 3);
    const hpN = s.fighters[0].hp, hpG = s.fighters[1].hp;
    const evs = tap(s, 1, BTN.LIGHT, 30);
    expect(count(evs, 'parry')).toBe(1);
    expect(count(evs, 'counterHit')).toBe(1);
    expect(s.fighters[0].hp).toBe(hpN);
    expect(s.fighters[1].hp).toBeLessThan(hpG);
    expect(count(evs, 'teleport')).toBe(2);
  });

  it('counter: also parries projectiles (destroying them)', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 1000, 1350);
    full(s);
    const f0 = s.frame;
    // Goku fires first; Naruto opens the window right before impact
    const evs = stepN(s, 60, (st) => {
      const kb = st.entities.find((e) => e.visual === 'kiBlast');
      const near = kb && Math.abs(kb.x - st.fighters[0].x) < 140 * FX;
      return [near && !st.fighters[0].moveId ? BTN.DOWN | BTN.SP2 : 0, st.frame === f0 + 1 ? BTN.SP1 : 0];
    });
    expect(count(evs, 'parry')).toBe(1);
    expect(count(evs, 'projectileHit')).toBe(0);
  });

  it('aoe: Kiai pushes the opponent away', () => {
    const s = fightReady();
    place(s, 1000, 1080);
    full(s);
    const d0 = s.fighters[1].x - s.fighters[0].x;
    const evs = tap(s, 0, BTN.DOWN | BTN.SP1, 40);
    expect(count(evs, 'aoe')).toBe(1);
    expect(count(evs, 'hit', 'goku_kiai')).toBe(1);
    expect(s.fighters[1].x - s.fighters[0].x).toBeGreaterThan(d0 + 50 * FX);
  });

  it('summon: Kage Bunshin spawns clones that run in and hit', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 800, 1300);
    full(s);
    const evs = tap(s, 0, BTN.SP1, 20);
    expect(s.entities.filter((e) => e.kind === 'summon').length).toBe(naruto.moves.special1.abilities![0].params.count);
    const more = stepN(s, 100);
    expect(count(more, 'hit', 'naruto_kage_bunshin')).toBeGreaterThanOrEqual(1);
    stepN(s, 120);
    expect(s.entities.filter((e) => e.kind === 'summon').length).toBe(0);
    void evs;
  });

  it('summon: a struck clone poofs and absorbs the hit', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 900, 1080);
    full(s);
    tap(s, 0, BTN.SP1, 15);
    expect(s.entities.filter((e) => e.kind === 'summon').length).toBe(2);
    const hpN = s.fighters[0].hp;
    stepN(s, 12, (st) => [0, st.frame % 2 === 0 ? BTN.LIGHT : 0]);
    expect(s.entities.filter((e) => e.kind === 'summon').length).toBeLessThan(2);
    expect(s.fighters[0].hp).toBe(hpN);
  });

  it('transformation: Super Kamehameha sets form ssj with stat multipliers', () => {
    const s = fightReady();
    place(s, 900, 1300);
    const base = effStats(s.fighters[0]);
    s.fighters[0].ult = ULT_MAX;
    const evs = tap(s, 0, BTN.ULT, 2);
    expect(count(evs, 'transform')).toBe(1);
    expect(s.fighters[0].form).toBe('ssj');
    const t = effStats(s.fighters[0]);
    expect(t.powerMul).toBeGreaterThan(base.powerMul);
    expect(t.walkSpeed).toBeGreaterThan(base.walkSpeed);
    const after = stepN(s, 260);
    expect(count(after, 'hit', 'goku_super_kamehameha')).toBeGreaterThanOrEqual(5);
    const dealt = s.fighters[1].maxHp - s.fighters[1].hp;
    expect(dealt).toBeGreaterThan(220);
    expect(dealt).toBeLessThan(400);
    // form expires
    stepN(s, 1000);
    expect(s.fighters[0].form).toBe(null);
  });

  it('ultimate: Rasenshuriken explodes into a multi-hit AOE', () => {
    const s = fightReady({ p1: 'naruto', p2: 'goku' });
    place(s, 900, 1300);
    s.fighters[0].ult = ULT_MAX;
    const evs = stepN(s, 400, (st) => [st.frame % 2 === 0 && st.fighters[0].ult === ULT_MAX ? BTN.ULT : 0, 0]);
    expect(count(evs, 'ultimateStart')).toBe(1);
    expect(count(evs, 'aoe')).toBe(1);
    expect(count(evs, 'hit', 'naruto_rasenshuriken')).toBeGreaterThanOrEqual(5);
    const dealt = s.fighters[1].maxHp - s.fighters[1].hp;
    expect(dealt).toBeGreaterThan(200);
    expect(dealt).toBeLessThan(400);
  });

  it('shield: absorbs projectiles and melee until broken', () => {
    const s = fightReady();
    place(s, 1000, 1400);
    const ctx = makeCtx(s, [0, 0]);
    getAbility('shield')!.trigger(ctx, s.fighters[0], { hp: 60, life: 300, w: 60, h: 220, offsetX: 50, offsetY: 110 }, goku.moves.special1);
    expect(s.entities.filter((e) => e.kind === 'shield').length).toBe(1);
    full(s);
    const hp = s.fighters[0].hp;
    const evs = tap(s, 1, BTN.DOWN | BTN.SP1, 60);
    expect(count(evs, 'shield')).toBeGreaterThanOrEqual(1);
    expect(count(evs, 'projectileHit')).toBe(0);
    expect(s.fighters[0].hp).toBe(hp);
    // melee into the shield
    place(s, 1000, 1110);
    const evs2 = tap(s, 1, BTN.HEAVY, 30);
    expect(count(evs2, 'hit', 'naruto_rising_kick')).toBe(0);
    expect(s.fighters[0].hp).toBe(hp);
  });

  it('trap: triggers when the enemy walks in, stunning them', () => {
    const s = fightReady();
    place(s, 1000, 1400);
    const ctx = makeCtx(s, [0, 0]);
    getAbility('trap')!.trigger(ctx, s.fighters[0], { offsetX: 200, armDelay: 5, stun: 60, damage: 25 }, goku.moves.special1);
    expect(ctx.state.events.some((e) => e.type === 'trapSet')).toBe(true);
    const hp = s.fighters[1].hp;
    const evs = stepN(s, 120, [0, BTN.LEFT]);
    expect(count(evs, 'trapTrigger')).toBe(1);
    expect(s.fighters[1].hp).toBeLessThan(hp);
    expect(s.entities.filter((e) => e.kind === 'trap').length).toBe(0);
  });

  it('buff / debuff / heal apply statuses and hp', () => {
    const s = fightReady();
    const ctx = makeCtx(s, [0, 0]);
    const [g, n] = s.fighters;
    getAbility('buff')!.trigger(ctx, g, { kind: 'powerUp', frames: 120, magnitude: 130 }, goku.moves.special1);
    expect(effStats(g).powerMul).toBe(130);
    getAbility('debuff')!.trigger(ctx, g, { kind: 'slow', frames: 120, magnitude: 50 }, goku.moves.special1);
    expect(effStats(n).walkSpeed).toBeLessThan(effStats(g).walkSpeed);
    getAbility('debuff')!.trigger(ctx, g, { kind: 'stun', frames: 40 }, goku.moves.special1);
    expect(n.mode).toBe('hitstun');
    g.hp = 500;
    getAbility('heal')!.trigger(ctx, g, { amount: 100 }, goku.moves.special1);
    expect(g.hp).toBe(600);
    stepN(s, 130);
    expect(g.statuses.find((x) => x.kind === 'powerUp')).toBeUndefined();
  });

  it('grab: unblockable at close range only', () => {
    const s = fightReady();
    place(s, 1000, 1080);
    const ctx = makeCtx(s, [0, BTN.BLOCK]);
    s.fighters[1].mode = 'block';
    const hp = s.fighters[1].hp;
    getAbility('grab')!.trigger(ctx, s.fighters[0], { range: 100, damage: 80, knockdown: true }, goku.moves.heavy);
    expect(s.fighters[1].hp).toBeLessThan(hp);
    const s2 = fightReady();
    place(s2, 1000, 1400);
    const hp2 = s2.fighters[1].hp;
    getAbility('grab')!.trigger(makeCtx(s2, [0, 0]), s2.fighters[0], { range: 100, damage: 80 }, goku.moves.heavy);
    expect(s2.fighters[1].hp).toBe(hp2);
  });

  it('engine dispatches abilities only by type (no character ids in sim/abilities)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const files: string[] = [];
    const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
    walk('src/game/sim'); walk('src/abilities');
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/['"](goku|naruto)['"]/);
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date|from 'phaser'|window\.|document\./);
    }
  });
});

describe('sim never crashes on random input', () => {
  it('fuzz 6000 frames with seeded random inputs', () => {
    for (const [p1, p2] of [['goku', 'naruto'], ['naruto', 'goku']]) {
      const s = sim.createMatch({ p1, p2, seed: 9, mode: 'versus' });
      let r = 12345;
      for (let i = 0; i < 6000; i++) {
        r = (Math.imul(r, 1103515245) + 12345) >>> 0;
        const a = r & 0x7ff;
        r = (Math.imul(r, 1103515245) + 12345) >>> 0;
        sim.step(s, [a, r & 0x7ff]);
        for (const f of s.fighters) {
          expect(f.hp).toBeGreaterThanOrEqual(0);
          expect(f.energy).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
