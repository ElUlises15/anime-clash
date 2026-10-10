/**
 * Character registry. Adding a character = create src/characters/<franchise>/<id>/ and add ONE line to CHARACTERS.
 */
import type { CharacterDef, MoveDef, MoveSlot } from './types';
import { deriveStats, validateDerived, validateStatPoints } from '../game/sim/balance';
import { ENERGY_MAX } from '../game/sim/types';
import { def as goku } from './dragonball/goku';
import { def as naruto } from './naruto/naruto';

export const CHARACTERS: CharacterDef[] = [goku, naruto];

const byId: Record<string, CharacterDef> = {};
for (const c of CHARACTERS) byId[c.id] = c;

export function getCharacter(id: string): CharacterDef {
  const c = byId[id];
  if (!c) throw new Error(`Unknown character id '${id}'`);
  return c;
}

export function listCharacters(): CharacterDef[] {
  return CHARACTERS.slice();
}

export function listFranchises(): { id: string; name: string; characters: CharacterDef[] }[] {
  const out: { id: string; name: string; characters: CharacterDef[] }[] = [];
  for (const c of CHARACTERS) {
    let f = out.find((x) => x.id === c.franchise);
    if (!f) { f = { id: c.franchise, name: c.franchiseName, characters: [] }; out.push(f); }
    f.characters.push(c);
  }
  return out;
}

export const REQUIRED_SLOTS: MoveSlot[] = ['light', 'heavy', 'special1', 'special2', 'ultimate'];
const NORMAL_SLOTS: MoveSlot[] = ['light', 'light2', 'heavy', 'crouchLight', 'crouchHeavy', 'airLight', 'airHeavy'];
const SPECIAL_SLOTS: MoveSlot[] = ['special1', 'special2', 'special1Down', 'special2Down', 'airSpecial1'];
/** Must mirror AbilityRef['type'] (src/characters/types.ts) and src/abilities/index.ts. */
export const KNOWN_ABILITY_TYPES = ['projectile', 'beam', 'dashAttack', 'teleport', 'counter', 'buff', 'transformation',
  'aoe', 'shield', 'summon', 'trap', 'heal', 'debuff', 'grab'];

function validateMove(slot: MoveSlot, m: MoveDef, def: CharacterDef): string[] {
  const e: string[] = [];
  const p = `${slot}(${m.id})`;
  const intOk = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!intOk(m.startup, 1, 60)) e.push(`${p}: startup ${m.startup} out of 1..60`);
  if (!intOk(m.active, 1, 120)) e.push(`${p}: active ${m.active} out of 1..120`);
  if (!intOk(m.recovery, 0, 90)) e.push(`${p}: recovery ${m.recovery} out of 0..90`);
  if (!intOk(m.hitstun, 0, 90) || !intOk(m.blockstun, 0, 60)) e.push(`${p}: hitstun/blockstun out of range`);
  if (!intOk(m.energyCost, 0, ENERGY_MAX)) e.push(`${p}: energyCost out of range`);
  if (!intOk(m.cooldown, 0, 1800)) e.push(`${p}: cooldown out of range`);
  if (NORMAL_SLOTS.includes(slot)) {
    if (m.kind !== 'normal') e.push(`${p}: normal slot must have kind 'normal'`);
    if (!m.hitbox) e.push(`${p}: normals need a hitbox`);
    if (!intOk(m.damage, 1, 120)) e.push(`${p}: normal damage ${m.damage} out of 1..120`);
    if (m.energyCost !== 0) e.push(`${p}: normals must not cost energy`);
  } else if (SPECIAL_SLOTS.includes(slot)) {
    if (m.kind !== 'special') e.push(`${p}: special slot must have kind 'special'`);
    if (!intOk(m.damage, 0, 220)) e.push(`${p}: special damage out of 0..220`);
  } else if (slot === 'ultimate') {
    if (m.kind !== 'ultimate') e.push(`${p}: ultimate slot must have kind 'ultimate'`);
    if (!m.cinematicFrames || m.cinematicFrames < 60 || m.cinematicFrames > 300) e.push(`${p}: cinematicFrames must be 60..300`);
  }
  if (!m.hitbox && !(m.abilities && m.abilities.length)) e.push(`${p}: move has neither hitbox nor abilities`);
  for (const c of m.cancelInto ?? []) if (!def.moves[c]) e.push(`${p}: cancelInto '${c}' not defined`);
  const total = m.startup + m.active + m.recovery;
  for (const ab of m.abilities ?? []) {
    if (!KNOWN_ABILITY_TYPES.includes(ab.type)) e.push(`${p}: unknown ability type '${ab.type}'`);
    if (!intOk(ab.frame, 0, total - 1)) e.push(`${p}: ability ${ab.type} frame ${ab.frame} outside move (0..${total - 1})`);
    if (ab.type === 'transformation') {
      const form = ab.params.form;
      if (typeof form !== 'string' || !def.forms?.[form]) e.push(`${p}: transformation form '${String(form)}' missing in def.forms`);
    }
  }
  if (m.invuln && (m.invuln[0] > m.invuln[1] || m.invuln[0] < 0)) e.push(`${p}: bad invuln range`);
  return e;
}

/** Returns a list of problems ([] = valid). */
export function validateCharacter(def: CharacterDef): string[] {
  const errs: string[] = [];
  if (!def.id || !/^[a-z0-9_]+$/.test(def.id)) errs.push(`bad id '${def.id}'`);
  if (!def.name) errs.push('missing name');
  if (!def.franchise || !def.franchiseName) errs.push('missing franchise');
  if (!def.visuals) errs.push('missing visuals');
  if (!def.audio) errs.push('missing audio');
  errs.push(...validateStatPoints(def.stats));
  errs.push(...validateDerived(deriveStats(def.stats, def.statOverrides)));
  for (const s of REQUIRED_SLOTS) if (!def.moves[s]) errs.push(`missing required move '${s}'`);
  const ids = new Set<string>();
  for (const slot of Object.keys(def.moves) as MoveSlot[]) {
    const m = def.moves[slot];
    if (!m) continue;
    if (ids.has(m.id)) errs.push(`duplicate move id '${m.id}'`);
    ids.add(m.id);
    errs.push(...validateMove(slot, m, def));
  }
  return errs;
}
