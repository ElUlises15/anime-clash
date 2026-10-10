/**
 * CONTRACT FILE — data-driven character definitions. The engine NEVER references a specific character.
 * Each character lives in src/characters/<franchise>/<id>/ and is registered in src/characters/registry.ts.
 */
import type { AnimKey, HitboxPx } from '../game/sim/types';
import type { CharacterVisuals } from '../render/rig/types';

export type Archetype =
  | 'Balanced' | 'Rushdown' | 'Zoner' | 'Grappler' | 'Bruiser' | 'Glass Cannon' | 'Defensive' | 'Technical' | 'Summoner';

/** Stat budget points (1..10 each). Sum must be <= STAT_BUDGET (see src/game/sim/balance.ts). */
export interface StatPoints {
  power: number; // damage multiplier
  speed: number; // walk/dash speed
  mobility: number; // jump, air actions
  defense: number; // hp / damage reduction
  energy: number; // energy regen / gain
}

/** Derived engine numbers (computed from StatPoints by balance.ts; overrides allowed but validated). */
export interface DerivedStats {
  health: number;
  walkSpeed: number; // px/frame * FX
  backWalkSpeed: number;
  dashSpeed: number;
  dashFrames: number;
  jumpVelocity: number; // FX per frame
  gravity: number;
  airActions: number;
  defense: number; // percent damage taken (100 = normal)
  powerMul: number; // percent
  energyRegen: number; // per frame (ENERGY_MAX scale)
}

export type MoveSlot =
  | 'light' | 'light2' | 'heavy' | 'crouchLight' | 'crouchHeavy' | 'airLight' | 'airHeavy'
  | 'special1' | 'special2' | 'ultimate' | 'airSpecial1';

export type HitLevel = 'mid' | 'low' | 'high' | 'overhead' | 'unblockable';

/** Reference to a reusable ability component (src/abilities) with data params, spawned at a move frame. */
export interface AbilityRef {
  type: 'projectile' | 'beam' | 'dashAttack' | 'teleport' | 'counter' | 'buff' | 'transformation'
    | 'aoe' | 'shield' | 'summon' | 'trap' | 'heal' | 'debuff' | 'grab';
  frame: number; // move frame at which it triggers (relative to move start)
  params: Record<string, number | string | boolean>;
}

export interface MoveDef {
  id: string;
  name: string;
  kind: 'normal' | 'special' | 'ultimate';
  anim: AnimKey;
  startup: number; // frames before active
  active: number;
  recovery: number;
  damage: number; // base damage (HP units; typical health ~1000)
  chip?: number; // damage on block (default 0 for normals, ~15% for specials)
  knockback: { x: number; y: number }; // px/frame on hit (x forward)
  hitstun: number;
  blockstun: number;
  hitstop?: number; // frames
  level?: HitLevel;
  hitbox?: HitboxPx; // melee hitbox (omit for pure ability moves)
  range: number; // px, informational + AI
  energyCost: number; // ENERGY_MAX scale (1000)
  energyGain?: number; // gained on hit
  ultCost?: number; // ultimate meter cost (ULT_MAX = 1000)
  cooldown: number; // frames
  knockdown?: boolean;
  launcher?: boolean;
  multiHit?: number; // hits during active window
  cancelInto?: MoveSlot[]; // allowed cancels on hit/block
  selfVelocity?: { frame: number; vx: number; vy: number }[]; // px/frame (forward +)
  invuln?: [number, number]; // move-frame range with i-frames
  armor?: [number, number];
  abilities?: AbilityRef[];
  cinematicFrames?: number; // ultimates: freeze/zoom duration (120..300)
  vfx?: string; // render hint
  sfx?: string; // audio hint
  description?: string;
}

export interface CharacterAudio {
  voicePitch: number; // 0.5..2 for procedural grunts
  cues?: Partial<Record<string, string>>; // moveId/event -> sfx key
}

export interface CharacterDef {
  id: string; // unique e.g. 'goku'
  name: string; // 'Goku'
  franchise: string; // franchise id e.g. 'dragonball'
  franchiseName: string; // 'Dragon Ball'
  archetype: Archetype;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string;
  stats: StatPoints;
  statOverrides?: Partial<DerivedStats>;
  moves: Partial<Record<MoveSlot, MoveDef>> & Record<'light' | 'heavy' | 'special1' | 'special2' | 'ultimate', MoveDef>;
  forms?: Record<string, { name: string; statMul?: Partial<Record<'powerMul' | 'speed' | 'defense', number>> }>;
  visuals: CharacterVisuals;
  audio: CharacterAudio;
}
