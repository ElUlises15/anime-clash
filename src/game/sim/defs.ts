/** Character definition lookups + cached per-character indexes (never stored in state). */
import { getCharacter } from '../../characters/registry';
import type { CharacterDef, DerivedStats, MoveDef, MoveSlot } from '../../characters/types';
import type { FighterState } from './types';
import { deriveStats } from './balance';

export function getDef(charId: string): CharacterDef {
  return getCharacter(charId);
}

interface DefIndex {
  byId: Record<string, { slot: MoveSlot; move: MoveDef }>;
  base: DerivedStats;
}
const cache = new WeakMap<CharacterDef, DefIndex>();

function indexOf(def: CharacterDef): DefIndex {
  let idx = cache.get(def);
  if (!idx) {
    const byId: DefIndex['byId'] = {};
    for (const slot of Object.keys(def.moves) as MoveSlot[]) {
      const move = def.moves[slot];
      if (move) byId[move.id] = { slot, move };
    }
    idx = { byId, base: deriveStats(def.stats, def.statOverrides) };
    cache.set(def, idx);
  }
  return idx;
}

export function baseStats(charId: string): DerivedStats {
  return indexOf(getDef(charId)).base;
}

export function moveSlotById(charId: string, moveId: string): { slot: MoveSlot; move: MoveDef } | null {
  return indexOf(getDef(charId)).byId[moveId] ?? null;
}

export function currentMove(f: FighterState): MoveDef | null {
  if (f.mode !== 'attack' || !f.moveId) return null;
  return moveSlotById(f.charId, f.moveId)?.move ?? null;
}

export function currentSlot(f: FighterState): MoveSlot | null {
  if (f.mode !== 'attack' || !f.moveId) return null;
  return moveSlotById(f.charId, f.moveId)?.slot ?? null;
}

export function moveTotal(m: MoveDef): number {
  return m.startup + m.active + m.recovery;
}

export function isHeavySlot(slot: MoveSlot | null): boolean {
  return slot === 'heavy' || slot === 'crouchHeavy' || slot === 'airHeavy';
}
