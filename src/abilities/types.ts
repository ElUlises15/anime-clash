/**
 * Ability component interface. The engine dispatches ONLY by AbilityRef.type / EntityState.abilityType —
 * never by character id. Components are pure functions over SimContext (deterministic, no Phaser/DOM).
 */
import type { AbilityRef, MoveDef } from '../characters/types';
import type { EntityState, FighterState, PlayerIndex, Facing } from '../game/sim/types';
import type { SimContext } from '../game/sim/context';
import type { HitSpec } from '../game/sim/combat';

export type AbilityParams = AbilityRef['params'];

export interface Ability {
  type: AbilityRef['type'];
  /** Called once when the owner's move reaches AbilityRef.frame. */
  trigger(ctx: SimContext, owner: FighterState, params: AbilityParams, move: MoveDef): void;
  /** Called every frame after the trigger frame while the owner stays in the same move (t = frames since trigger, >= 1). */
  tick?(ctx: SimContext, owner: FighterState, params: AbilityParams, move: MoveDef, t: number): void;
  /** Per-frame update for entities spawned by this ability (movement, custom collisions). Set e.life = 0 to remove. */
  updateEntity?(ctx: SimContext, e: EntityState): void;
  /** Custom resolution when a hitting entity (projectile/beam/aoe) overlaps the target. Default = applyHit with entity data. */
  onEntityHit?(ctx: SimContext, e: EntityState, target: FighterState, spark: { x: number; y: number }): void;
  /** Called once when the entity is removed (life <= 0). May spawn new entities. */
  onExpire?(ctx: SimContext, e: EntityState): void;
  /**
   * An opposing attack (melee hitbox or hitting entity) overlaps this entity. Return true if the attack is consumed
   * (e.g. shield absorbs it); false to let it continue to the fighter.
   */
  onEntityStruck?(ctx: SimContext, e: EntityState, attacker: PlayerIndex, spec: HitSpec, spark: { x: number; y: number }): boolean;
  /**
   * The owner is about to be hit while this ability's move is active. Return true to negate the hit (counters/parries).
   * `source` is the attacking fighter or entity.
   */
  interceptHit?(ctx: SimContext, owner: FighterState, attacker: PlayerIndex, params: AbilityParams, spec: HitSpec,
    dir: Facing, source: { entity?: EntityState }): boolean;
}

// --- param helpers ---
export function num(p: AbilityParams, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' ? v : d;
}
export function str(p: AbilityParams, k: string, d: string): string {
  const v = p[k];
  return typeof v === 'string' ? v : d;
}
export function bool(p: AbilityParams, k: string, d: boolean): boolean {
  const v = p[k];
  return typeof v === 'boolean' ? v : d;
}
