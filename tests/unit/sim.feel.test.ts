/**
 * Combat-feel guarantees for human (keyboard) players: input buffer, chains/cancels with natural timing, jump arcs,
 * dashes, block advantage (no infinite pressure), KO flow timing, projectile clashes and beam length.
 */
import { describe, expect, it } from 'vitest';
import { BTN } from '../../src/game/input/buttons';
import { sim } from '../../src/game/sim/engine';
import { FX, STAGE_WIDTH_PX } from '../../src/game/sim/types';
import type { MatchState, SimEvent } from '../../src/game/sim/types';
import { BUFFER_FRAMES, KO_FRAMES } from '../../src/game/sim/constants';
import { listCharacters, getCharacter } from '../../src/characters/registry';
import type { MoveSlot } from '../../src/characters/types';
import { isActionable } from '../../src/game/sim/fighter';
import { makeCtx } from '../../src/game/sim/context';
import { spawnEntity } from '../../src/game/sim/entities';
import { hurtboxFx } from '../../src/game/sim/boxes';
import { BEAM_PENETRATION_PX } from '../../src/abilities/beam';
import { fightReady, place, stepN, tap } from './helpers';

const IDS = listCharacters().map((c) => c.id);
const other = (id: string) => (id === 'goku' ? 'naruto' : 'goku');
const started = (evs: SimEvent[], moveId: string) =>
  evs.some((e) => (e.type === 'moveStart' || e.type === 'specialStart' || e.type === 'ultimateStart') && e.moveId === moveId);

describe.each(IDS)('%s feel', (id) => {
  const def = getCharacter(id);

  it('a single-frame tap of LIGHT always comes out (idle, late in recovery, end of blockstun)', () => {
    let s = fightReady({ p1: id, p2: other(id) });
    place(s, 800, 1500);
    expect(started(tap(s, 0, BTN.LIGHT, 2), def.moves.light.id)).toBe(true);

    s = fightReady({ p1: id, p2: other(id) });
    place(s, 800, 1500);
    const h = def.moves.heavy;
    tap(s, 0, BTN.HEAVY, 1);
    stepN(s, h.startup + h.active + h.recovery - BUFFER_FRAMES);
    expect(s.fighters[0].moveId).toBe(h.id);
    expect(started(tap(s, 0, BTN.LIGHT, BUFFER_FRAMES + 2), def.moves.light.id)).toBe(true);

    s = fightReady({ p1: other(id), p2: id });
    place(s, 1000, 1100);
    tap(s, 0, BTN.HEAVY, 1, BTN.BLOCK);
    let evs: SimEvent[] = [];
    for (let i = 0; i < 60 && s.fighters[1].mode !== 'blockstun'; i++) evs = stepN(s, 1, [0, BTN.BLOCK]);
    expect(s.fighters[1].mode).toBe('blockstun');
    while (s.fighters[1].stunFrames > 3) stepN(s, 1, [0, BTN.BLOCK]);
    evs = tap(s, 1, BTN.LIGHT, 10);
    expect(started(evs, def.moves.light.id)).toBe(true);
  });

  it('a late jump-in press that lands before going active becomes the ground normal', () => {
    const s = fightReady({ p1: id, p2: other(id) });
    place(s, 800, 1500);
    stepN(s, 1, [BTN.UP, 0]);
    let n = 0;
    while (!(s.fighters[0].vy < 0 && s.fighters[0].y + 2 * s.fighters[0].vy <= 0) && n++ < 80) stepN(s, 1);
    const evs = tap(s, 0, BTN.HEAVY, 8);
    expect(evs.some((e) => e.type === 'land')).toBe(true);
    expect(started(evs, def.moves.heavy.id)).toBe(true);
  });

  it.each([0, 4, 8])('light > light2 > heavy > special chains with %i frames of human delay after each hit', (delay) => {
    const s = fightReady({ p1: id, p2: other(id) });
    place(s, 1000, 1092);
    s.fighters[0].energy = 1000;
    const seq: [MoveSlot, number][] = [['light', BTN.LIGHT], ['light2', BTN.LIGHT], ['heavy', BTN.HEAVY], ['special2', BTN.SP2]];
    let idx = 0;
    let hitAt = -1;
    const evs = stepN(s, 160, (st) => {
      const f = st.fighters[0];
      if (idx === 0) { idx++; return [BTN.LIGHT, 0]; }
      if (idx >= seq.length) return [0, 0];
      const [prevSlot] = seq[idx - 1];
      if (f.moveId === def.moves[prevSlot]!.id && f.moveConnect === 2 && hitAt < 0) hitAt = st.frame;
      if (hitAt >= 0 && st.frame >= hitAt + delay) { hitAt = -1; return [seq[idx++][1], 0]; }
      return [0, 0];
    });
    for (const [slot] of seq) expect(started(evs, def.moves[slot]!.id), `${slot} did not come out`).toBe(true);
    expect(s.fighters[0].stats.maxCombo).toBeGreaterThanOrEqual(4);
  });

  it('jump airtime is snappy (38-50 frames) with an apex of 170-260 px', () => {
    const s = fightReady({ p1: id, p2: other(id) });
    place(s, 800, 1500);
    const f0 = s.frame;
    let apex = 0, landAt = -1;
    stepN(s, 80, (st) => {
      apex = Math.max(apex, st.fighters[0].y);
      if (landAt < 0 && st.events.some((e) => e.type === 'land' && e.player === 0)) landAt = st.frame;
      return [st.frame === f0 ? BTN.UP : 0, 0];
    });
    const air = landAt - f0;
    expect(air).toBeGreaterThanOrEqual(38);
    expect(air).toBeLessThanOrEqual(50);
    expect(apex / FX).toBeGreaterThanOrEqual(170);
    expect(apex / FX).toBeLessThanOrEqual(260);
  });

  it('dash covers 150-280 px and can be cancelled into guard; backdash retreats with i-frames', () => {
    let s = fightReady({ p1: id, p2: other(id) });
    place(s, 600, 1600);
    const x0 = s.fighters[0].x;
    tap(s, 0, BTN.DASH | BTN.RIGHT, 30);
    expect((s.fighters[0].x - x0) / FX).toBeGreaterThanOrEqual(150);
    expect((s.fighters[0].x - x0) / FX).toBeLessThanOrEqual(280);

    s = fightReady({ p1: id, p2: other(id) });
    place(s, 600, 1600);
    tap(s, 0, BTN.DASH | BTN.RIGHT, 5);
    stepN(s, 2, [BTN.BLOCK, 0]);
    expect(s.fighters[0].mode).toBe('block');

    s = fightReady({ p1: id, p2: other(id) });
    place(s, 1000, 1600);
    const x1 = s.fighters[0].x;
    tap(s, 0, BTN.DASH | BTN.LEFT, 2);
    expect(s.fighters[0].invulnFrames).toBeGreaterThan(0);
    stepN(s, 25);
    expect((x1 - s.fighters[0].x) / FX).toBeGreaterThanOrEqual(120);
    expect(isActionable(s.fighters[0])).toBe(true);
  });

  it('blocking is instant and ground normals are at most +3 on block (pressure is never infinite)', () => {
    for (const slot of ['light', 'light2', 'heavy', 'crouchLight', 'crouchHeavy'] as MoveSlot[]) {
      const m = def.moves[slot];
      if (!m) continue;
      const s = fightReady({ p1: id, p2: other(id) });
      place(s, 1000, 1000 + Math.min(110, m.range - 20));
      const btn = slot.startsWith('crouch') ? BTN.DOWN | (slot === 'crouchLight' ? BTN.LIGHT : BTN.HEAVY)
        : slot === 'heavy' ? BTN.HEAVY : BTN.LIGHT;
      const defBits = BTN.BLOCK | (m.level === 'low' ? BTN.DOWN : 0);
      if (slot === 'light2') {
        // light2 only exists as a chain: jab first, then chain on block
        stepN(s, 1, [BTN.LIGHT, defBits]);
        while (s.fighters[0].moveConnect === 0 && s.fighters[0].moveId) stepN(s, 1, [0, defBits]);
      }
      stepN(s, 1, [btn, defBits]);
      let atkFree = -1, defFree = -1, blocked = false;
      for (let i = 0; i < 120 && (atkFree < 0 || defFree < 0); i++) {
        stepN(s, 1, [slot.startsWith('crouch') ? BTN.DOWN : 0, defBits]);
        const [a, d] = s.fighters;
        if (d.mode === 'blockstun') blocked = true;
        if (a.moveId !== m.id && atkFree < 0 && isActionable(a) && blocked) atkFree = s.frame;
        if (blocked && defFree < 0 && d.mode !== 'blockstun') defFree = s.frame;
      }
      expect(blocked, `${slot} was not blocked`).toBe(true);
      expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
      const adv = defFree - atkFree;
      expect(adv, `${id} ${slot} block advantage ${adv}`).toBeLessThanOrEqual(3);
      expect(adv, `${id} ${slot} block advantage ${adv}`).toBeGreaterThanOrEqual(-16);
    }
  });
});

describe('round flow timing', () => {
  it('KO pause lasts ~1.5 s, then round end, then next round intro', () => {
    const s = fightReady();
    s.fighters[1].hp = 1;
    place(s, 1000, 1090);
    let koAt = -1, endAt = -1, introAt = -1;
    for (let i = 0; i < 600 && introAt < 0; i++) {
      sim.step(s, [koAt < 0 && i % 2 === 0 ? BTN.LIGHT : 0, 0]);
      if (s.events.some((e) => e.type === 'ko')) koAt = s.frame;
      if (s.events.some((e) => e.type === 'roundEnd')) endAt = s.frame;
      if (s.events.some((e) => e.type === 'roundStart')) introAt = s.frame;
    }
    expect(koAt).toBeGreaterThan(0);
    expect(endAt - koAt).toBe(KO_FRAMES);
    expect((endAt - koAt) / 60).toBeCloseTo(1.5, 1);
    expect(introAt - endAt).toBeGreaterThanOrEqual(60);
    expect(introAt - endAt).toBeLessThanOrEqual(120);
    expect(s.round).toBe(2);
  });
});

/** Ground projectile moves of a character: [slot, button bits]. */
function projectileMoves(id: string): [MoveSlot, number][] {
  const out: [MoveSlot, number][] = [];
  const mv = getCharacter(id).moves;
  if (mv.special1?.abilities?.some((a) => a.type === 'projectile')) out.push(['special1', BTN.SP1]);
  if (mv.special1Down?.abilities?.some((a) => a.type === 'projectile')) out.push(['special1Down', BTN.DOWN | BTN.SP1]);
  return out;
}

describe('projectile clashes', () => {
  const cases: [string, string, MoveSlot, number, MoveSlot, number][] = [];
  for (const a of IDS) for (const b of IDS) {
    for (const [sa, ba] of projectileMoves(a)) for (const [sb, bb] of projectileMoves(b)) cases.push([a, b, sa, ba, sb, bb]);
  }

  it.each(cases)('%s vs %s: %s meets %s mid-screen and they clash', (a, b, _sa, ba, _sb, bb) => {
    const s = fightReady({ p1: a, p2: b });
    place(s, 700, 1700);
    for (const f of s.fighters) f.energy = 1000;
    const f0 = s.frame;
    const evs = stepN(s, 100, (st) => [st.frame === f0 + 1 ? ba : 0, st.frame === f0 + 1 ? bb : 0]);
    expect(evs.filter((e) => e.type === 'projectileClash').length).toBeGreaterThanOrEqual(1);
    const firstClash = evs.find((e) => e.type === 'projectileClash')!;
    expect(firstClash.x / FX).toBeGreaterThan(800);
    expect(firstClash.x / FX).toBeLessThan(1600);
  });

  it('fast projectiles never tunnel through each other between frames', () => {
    const s = fightReady();
    place(s, 400, 2000);
    const ctx = makeCtx(s, [0, 0]);
    const mk = (owner: 0 | 1, x: number, vx: number) => spawnEntity(ctx, {
      kind: 'projectile', owner, abilityType: 'projectile', moveId: owner === 0 ? 'goku_ki_blast' : 'naruto_kunai',
      visual: 'kiBlast', x: x * FX, y: 150 * FX, vx: vx * FX, facing: vx > 0 ? 1 : -1, w: 10, h: 10, life: 60, power: 1,
    });
    mk(0, 1000, 47); // after one step: 1047 vs 1153 (gap), after two: 1094 vs 1106... after three they've crossed
    mk(1, 1200, -47);
    const evs = stepN(s, 6);
    expect(evs.some((e) => e.type === 'projectileClash')).toBe(true);
    expect(s.entities.length).toBe(0);
  });
});

describe('beam length', () => {
  function fireBeam(s: MatchState) {
    s.fighters[0].energy = 1000;
    let maxLen = 0;
    let lenAtHit = -1;
    stepN(s, 90, (st) => {
      const b = st.entities.find((e) => e.kind === 'beam');
      if (b) maxLen = Math.max(maxLen, b.data.length as number);
      if (b && lenAtHit < 0 && st.events.some((e) => e.type === 'hit' && e.moveId === b.moveId)) lenAtHit = b.data.length as number;
      return [st.frame % 200 === 0 ? 0 : 0, 0];
    });
    return { maxLen, lenAtHit };
  }

  it('stops at the opponent it is hitting (drawn ending on the target)', () => {
    const s = fightReady();
    place(s, 900, 1300);
    s.fighters[0].energy = 1000;
    tap(s, 0, BTN.SP2, 1);
    let seen = false;
    stepN(s, 60, (st) => {
      const b = st.entities.find((e) => e.kind === 'beam');
      const t = st.fighters[1];
      if (b && st.events.some((e) => e.type === 'hit' && e.moveId === 'goku_kamehameha')) {
        const hu = hurtboxFx(t);
        const near = (hu.x - b.x) / FX;
        expect(b.data.length).toBe(b.w);
        expect(b.w).toBeGreaterThanOrEqual(Math.trunc(near));
        expect(b.w).toBeLessThanOrEqual(Math.max(0, Math.trunc(near)) + BEAM_PENETRATION_PX);
        seen = true;
      }
      return [0, 0];
    });
    expect(seen).toBe(true);
  });

  it('extends to max length past an intangible opponent but is clamped to the stage edge', () => {
    const s = fightReady();
    place(s, 1700, 2100);
    s.fighters[1].invulnFrames = 400;
    tap(s, 0, BTN.SP2, 1);
    const { maxLen } = fireBeam(s);
    const origin = 1700 + 55;
    expect(maxLen).toBe(STAGE_WIDTH_PX - origin);
  });

  it('stops at an opposing barrier (shield entity)', () => {
    const s = fightReady({ p1: 'goku', p2: 'vegeta' });
    place(s, 800, 1300);
    s.fighters[0].energy = 1000; s.fighters[1].energy = 1000;
    tap(s, 0, BTN.SP2, 12);
    tap(s, 1, BTN.DOWN | BTN.SP2, 1);
    let minLen = 9999;
    const evs = stepN(s, 30, (st) => {
      const b = st.entities.find((e) => e.kind === 'beam');
      const sh = st.entities.find((e) => e.kind === 'shield');
      if (b && sh && (b.data.reach as number) > 600) minLen = Math.min(minLen, b.w);
      return [0, 0];
    });
    expect(evs.some((e) => e.type === 'shield')).toBe(true);
    expect(minLen).toBeLessThan(500 - 55 - 30);
  });
});
