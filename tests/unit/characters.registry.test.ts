import { describe, expect, it } from 'vitest';
import { CHARACTERS, getCharacter, listCharacters, listFranchises, validateCharacter, KNOWN_ABILITY_TYPES, REQUIRED_SLOTS }
  from '../../src/characters/registry';
import { STAT_BUDGET, deriveStats, STAT_KEYS } from '../../src/game/sim/balance';
import { listAbilityTypes } from '../../src/abilities';
import type { CharacterDef } from '../../src/characters/types';

describe('character registry', () => {
  it('has Goku, Vegeta, Naruto and Sasuke', () => {
    expect(listCharacters().map((c) => c.id)).toEqual(expect.arrayContaining(['goku', 'vegeta', 'naruto', 'sasuke']));
    expect(getCharacter('goku').name).toBe('Goku');
    expect(getCharacter('vegeta').archetype).toBe('Rushdown');
    expect(getCharacter('sasuke').archetype).toBe('Technical');
    expect(getCharacter('sasuke').difficulty).toBe(4);
    expect(() => getCharacter('nobody')).toThrow();
  });

  it('ids are unique', () => {
    const ids = CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CHARACTERS.map((c) => [c.id, c] as const))('%s is valid', (_id, def) => {
    expect(validateCharacter(def)).toEqual([]);
    const sum = STAT_KEYS.reduce((a, k) => a + def.stats[k], 0);
    expect(sum).toBeLessThanOrEqual(STAT_BUDGET);
    for (const s of REQUIRED_SLOTS) expect(def.moves[s]).toBeTruthy();
    expect(def.visuals).toBeTruthy();
    const d = deriveStats(def.stats, def.statOverrides);
    expect(d.health).toBeGreaterThanOrEqual(900);
    expect(d.health).toBeLessThanOrEqual(1150);
    expect(d.walkSpeed).toBeGreaterThanOrEqual(400);
    expect(d.walkSpeed).toBeLessThanOrEqual(700);
  });

  it('groups by franchise', () => {
    const f = listFranchises();
    expect(f.find((x) => x.id === 'dragonball')?.characters.map((c) => c.id)).toEqual(['goku', 'vegeta']);
    expect(f.find((x) => x.id === 'naruto')?.characters.map((c) => c.id)).toEqual(['naruto', 'sasuke']);
    expect(f.find((x) => x.id === 'naruto')?.name).toBe('Naruto');
  });

  it('validator catches problems', () => {
    const bad: CharacterDef = JSON.parse(JSON.stringify(getCharacter('goku')));
    bad.stats.power = 10;
    delete (bad.moves as Record<string, unknown>).special2;
    bad.moves.light.energyCost = 50;
    const errs = validateCharacter(bad);
    expect(errs.some((e) => e.includes('budget'))).toBe(true);
    expect(errs.some((e) => e.includes('special2'))).toBe(true);
    expect(errs.some((e) => e.includes('energy'))).toBe(true);
  });

  it('every known ability type has a registered component', () => {
    expect(listAbilityTypes()).toEqual([...KNOWN_ABILITY_TYPES].sort());
  });

  it('characters are distinct: different stat spreads, archetypes or ability kits', () => {
    const sig = (c: CharacterDef) => JSON.stringify([c.stats, c.archetype,
      Object.values(c.moves).flatMap((m) => (m!.abilities ?? []).map((a) => a.type)).sort()]);
    const sigs = CHARACTERS.map(sig);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it('new characters use the requested ability components and visual hints', () => {
    const kit = (id: string) => Object.entries(getCharacter(id).moves).map(([slot, m]) => [slot, m!] as const);
    const find = (id: string, slot: string) => kit(id).find(([s]) => s === slot)![1];
    const types = (id: string, slot: string) => (find(id, slot).abilities ?? []).map((a) => a.type);
    const visual = (id: string, slot: string) => (find(id, slot).abilities ?? []).map((a) => a.params.visual);
    // Vegeta
    expect(types('vegeta', 'special1')).toEqual(['projectile']);
    expect(find('vegeta', 'special1').abilities![0].params.count).toBeGreaterThanOrEqual(3);
    expect(types('vegeta', 'special2')).toEqual(['beam']);
    expect(visual('vegeta', 'special2')).toEqual(['galickGun']);
    expect(find('vegeta', 'special1Down').abilities![0].params.explode).toBe(true);
    expect(visual('vegeta', 'special1Down')).toEqual(['bigBang']);
    expect(types('vegeta', 'special2Down')).toContain('shield');
    expect(visual('vegeta', 'special2Down')).toContain('barrier');
    expect(visual('vegeta', 'ultimate')).toEqual(['finalFlash']);
    // Sasuke
    expect(visual('sasuke', 'special1')).toEqual(['fireball']);
    expect(types('sasuke', 'special2')).toEqual(['dashAttack']);
    expect(visual('sasuke', 'special2')).toEqual(['chidori']);
    expect(find('sasuke', 'special1Down').abilities![0].params.count).toBe(2);
    expect(visual('sasuke', 'special1Down')).toEqual(['shuriken']);
    expect(types('sasuke', 'special2Down')).toEqual(['counter']);
    expect(visual('sasuke', 'special2Down')).toEqual(['sharingan']);
    expect(kit('sasuke').some(([, m]) => (m.abilities ?? []).some((a) => a.type === 'trap' && a.params.visual === 'wireTrap'))).toBe(true);
    expect(types('sasuke', 'ultimate')).toEqual(['aoe']);
    expect(find('sasuke', 'ultimate').abilities![0].params.at).toBe('opponent');
    expect(visual('sasuke', 'ultimate')).toEqual(['kirin']);
  });

  it('characters are pure data (JSON roundtrip safe, besides visuals)', () => {
    for (const c of CHARACTERS) {
      const { visuals: _v, ...rest } = c;
      expect(JSON.parse(JSON.stringify(rest))).toEqual(rest);
    }
  });
});
