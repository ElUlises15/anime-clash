/** Entity lifecycle: spawn, per-frame update (dispatched by abilityType), hits, shields/struck checks, clashes. */
import type { EntityKind, EntityState, Facing, FighterState, PlayerIndex } from './types';
import { emit, type SimContext } from './context';
import { getAbility } from '../../abilities/registry';
import { entityBoxFx, hurtboxFx, overlapCenter, overlaps } from './boxes';
import { applyHit, canBeHit, specFromEntity, type HitResult } from './combat';

export interface SpawnSpec {
  kind: EntityKind;
  owner: PlayerIndex;
  abilityType: string;
  moveId: string;
  visual: string;
  x: number; y: number; vx?: number; vy?: number;
  facing: Facing;
  w: number; h: number;
  life: number;
  hitsLeft?: number;
  power?: number;
  data?: Record<string, number | string | boolean>;
}

export function spawnEntity(ctx: SimContext, s: SpawnSpec): EntityState {
  const st = ctx.state;
  const e: EntityState = {
    id: st.nextEntityId++,
    kind: s.kind,
    owner: s.owner,
    abilityType: s.abilityType,
    moveId: s.moveId,
    visual: s.visual,
    x: Math.trunc(s.x), y: Math.trunc(s.y), vx: Math.trunc(s.vx ?? 0), vy: Math.trunc(s.vy ?? 0),
    facing: s.facing,
    w: Math.trunc(s.w), h: Math.trunc(s.h),
    life: s.life,
    age: 0,
    hitsLeft: s.hitsLeft ?? 1,
    hitCooldown: 0,
    power: s.power ?? 0,
    data: { ...(s.data ?? {}) },
  };
  st.entities.push(e);
  return e;
}

function isHitter(e: EntityState): boolean {
  return (e.kind === 'projectile' || e.kind === 'beam' || e.kind === 'aoe')
    && e.hitsLeft > 0 && e.hitCooldown === 0 && e.data.armed !== false;
}

/** Push direction for an entity hit on target. */
export function entityHitDir(e: EntityState, target: FighterState): Facing {
  if (e.kind === 'aoe') return target.x > e.x ? 1 : target.x < e.x ? -1 : e.facing;
  return e.facing;
}

/**
 * Default entity -> fighter hit: applyHit with the entity's spec; consumes one hit on contact (not on whiff).
 * Projectiles die when out of hits. `interval` data key = frames between multi-hits.
 */
export function defaultEntityHit(ctx: SimContext, e: EntityState, target: FighterState, spark: { x: number; y: number }): HitResult {
  const spec = specFromEntity(ctx, e);
  if (e.hitsLeft === 1 && e.data.finalKnockdown === true) {
    spec.knockdown = true;
    if (typeof e.data.finalKbx === 'number') spec.kbx = e.data.finalKbx;
    if (typeof e.data.finalKby === 'number') spec.kby = e.data.finalKby;
  }
  const r = applyHit(ctx, e.owner, target, spec, entityHitDir(e, target), spark, { entity: e });
  if (r === 'whiff') return r;
  e.hitsLeft--;
  e.hitCooldown = typeof e.data.interval === 'number' ? e.data.interval : 0;
  if (e.kind === 'projectile') {
    if (r !== 'parry') emit(ctx, { type: 'projectileHit', player: e.owner, x: spark.x, y: spark.y, moveId: e.moveId, visual: e.visual });
    if (e.hitsLeft <= 0 || r === 'parry') e.life = 0;
  }
  return r;
}

/** Let opposing struck-able entities (shields...) intercept an entity's hit. Returns true if consumed. */
function struckByEntity(ctx: SimContext, e: EntityState): boolean {
  const box = entityBoxFx(e);
  for (const o of ctx.state.entities) {
    if (o.owner === e.owner || o.life <= 0 || o === e) continue;
    const impl = getAbility(o.abilityType);
    if (!impl?.onEntityStruck) continue;
    const ob = entityBoxFx(o);
    if (!overlaps(box, ob)) continue;
    if (impl.onEntityStruck(ctx, o, e.owner, specFromEntity(ctx, e), overlapCenter(box, ob))) {
      e.hitsLeft--;
      e.hitCooldown = typeof e.data.interval === 'number' ? e.data.interval : 0;
      if (e.kind === 'projectile') e.life = 0;
      return true;
    }
  }
  return false;
}

function tryEntityHit(ctx: SimContext, e: EntityState): void {
  if (struckByEntity(ctx, e)) return;
  const target = ctx.state.fighters[e.owner === 0 ? 1 : 0];
  const box = entityBoxFx(e);
  const hu = hurtboxFx(target);
  if (!overlaps(box, hu) || !canBeHit(ctx, target)) return;
  const spark = overlapCenter(box, hu);
  const impl = getAbility(e.abilityType);
  if (impl?.onEntityHit) impl.onEntityHit(ctx, e, target, spark);
  else defaultEntityHit(ctx, e, target, spark);
}

/** Opposing projectiles/beams cancel by power. */
function clashes(ctx: SimContext): void {
  const list = ctx.state.entities;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.life <= 0 || a.power <= 0 || (a.kind !== 'projectile' && a.kind !== 'beam')) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.life <= 0 || b.power <= 0 || b.owner === a.owner || (b.kind !== 'projectile' && b.kind !== 'beam')) continue;
      const ra = entityBoxFx(a), rb = entityBoxFx(b);
      if (!overlaps(ra, rb)) continue;
      const c = overlapCenter(ra, rb);
      emit(ctx, { type: 'projectileClash', player: a.power >= b.power ? a.owner : b.owner, x: c.x, y: c.y,
        visual: a.power >= b.power ? a.visual : b.visual });
      if (a.power === b.power) {
        a.life = 0; b.life = 0;
      } else if (a.power > b.power) {
        if (a.kind !== 'beam') a.power -= b.power;
        b.life = 0;
      } else {
        if (b.kind !== 'beam') b.power -= a.power;
        a.life = 0;
      }
      if (a.life <= 0) break;
    }
  }
}

export function updateEntities(ctx: SimContext): void {
  const st = ctx.state;
  const snapshot = st.entities.slice();
  for (const e of snapshot) {
    if (e.life <= 0) continue;
    e.age++;
    e.life--;
    if (e.hitCooldown > 0) e.hitCooldown--;
    const impl = getAbility(e.abilityType);
    if (impl?.updateEntity) impl.updateEntity(ctx, e);
    else { e.x += e.vx; e.y += e.vy; }
    if (e.life > 0 && isHitter(e)) tryEntityHit(ctx, e);
  }
  clashes(ctx);
  removeDead(ctx);
}

export function removeDead(ctx: SimContext): void {
  const st = ctx.state;
  if (!st.entities.some((e) => e.life <= 0)) return;
  const dead = st.entities.filter((e) => e.life <= 0);
  st.entities = st.entities.filter((e) => e.life > 0);
  for (const e of dead) getAbility(e.abilityType)?.onExpire?.(ctx, e);
}

export function entitiesOf(ctx: SimContext, owner: PlayerIndex, abilityType?: string): EntityState[] {
  return ctx.state.entities.filter((e) => e.owner === owner && e.life > 0 && (!abilityType || e.abilityType === abilityType));
}
