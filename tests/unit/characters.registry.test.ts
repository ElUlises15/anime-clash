import { describe, expect, it } from 'vitest';
import { CHARACTERS, getCharacter, listCharacters, listFranchises, validateCharacter, KNOWN_ABILITY_TYPES, REQUIRED_SLOTS }
  from '../../src/characters/registry';
import { STAT_BUDGET, deriveStats, STAT_KEYS } from '../../src/game/sim/balance';
import { listAbilityTypes } from '../../src/abilities';
import type { CharacterDef } from '../../src/characters/types';

describe('character registry', () => {
  it('has Goku and Naruto', () => {
    expect(listCharacters().map((c) => c.id)).toEqual(expect.arrayContaining(['goku', 'naruto']));
    expect(getCharacter('goku').name).toBe('Goku');
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
    expect(f.find((x) => x.id === 'dragonball')?.characters.map((c) => c.id)).toContain('goku');
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

  it('characters are pure data (JSON roundtrip safe, besides visuals)', () => {
    for (const c of CHARACTERS) {
      const { visuals: _v, ...rest } = c;
      expect(JSON.parse(JSON.stringify(rest))).toEqual(rest);
    }
  });
});
