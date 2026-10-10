/**
 * Adapter around src/characters/registry.ts (owned by the engine team).
 * Uses import.meta.glob so this module still compiles if registry is not on disk yet.
 */
import type { CharacterDef } from '../characters/types';

export interface FranchiseGroup {
  id: string;
  name: string;
  characters: CharacterDef[];
}

interface RegistryMod {
  listFranchises?: () => FranchiseGroup[];
  listCharacters?: () => CharacterDef[];
  getCharacter?: (id: string) => CharacterDef;
  CHARACTERS?: CharacterDef[];
}

const eager = import.meta.glob('../characters/registry.ts', { eager: true }) as Record<string, RegistryMod>;
const loaders = import.meta.glob('../characters/registry.ts') as Record<string, () => Promise<RegistryMod>>;

let cached: RegistryMod | null | undefined = Object.values(eager)[0] ?? undefined;

export async function loadRegistry(): Promise<RegistryMod | null> {
  if (cached !== undefined) {
    if (cached && ((cached.listFranchises?.().length ?? 0) > 0 || (cached.CHARACTERS?.length ?? 0) > 0)) {
      return cached;
    }
  }
  const loader = Object.values(loaders)[0];
  if (!loader) {
    cached = null;
    return null;
  }
  try {
    cached = await loader();
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function getRegistrySync(): RegistryMod | null {
  return cached ?? null;
}

export function listFranchises(): FranchiseGroup[] {
  const m = cached;
  if (!m) return [];
  if (m.listFranchises) return m.listFranchises();
  if (m.CHARACTERS && m.CHARACTERS.length) {
    const map = new Map<string, FranchiseGroup>();
    for (const c of m.CHARACTERS) {
      const g = map.get(c.franchise) ?? { id: c.franchise, name: c.franchiseName, characters: [] };
      g.characters.push(c);
      map.set(c.franchise, g);
    }
    return [...map.values()];
  }
  return [];
}

export function listCharacters(): CharacterDef[] {
  const m = cached;
  if (!m) return [];
  if (m.listCharacters) return m.listCharacters();
  return m.CHARACTERS ?? [];
}

export function getCharacter(id: string): CharacterDef | undefined {
  const m = cached;
  if (!m) return undefined;
  try {
    if (m.getCharacter) return m.getCharacter(id);
  } catch {
    return undefined;
  }
  return (m.CHARACTERS ?? []).find((c) => c.id === id);
}

/** Drop the cache so a later HMR / late-arriving module can be picked up. */
export function resetRegistryCache(): void {
  cached = undefined;
}
