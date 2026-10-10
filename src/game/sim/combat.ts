/**
 * Hit resolution: blocking, chip, armor, parry interception, damage scaling, hitstun/knockback, meters, stats.
 * Generic for melee hits and entity hits (projectiles, beams, AOE, summons, traps).
 */
import type { HitLevel, MoveDef, MoveSlot } from '../../characters/types';
import type { EntityState, Facing, FighterState, PlayerIndex } from './types';
import { FX, STAGE_MARGIN_PX, STAGE_WIDTH_PX } from './types';
import { BTN, has } from '../input/buttons';
import {
  BLOCK_HITSTOP_PCT, BLOCK_PUSH_PCT, COMBO_SCALING, CORNER_DIST_PX, CORNER_PUSH_PCT, DEFAULT_CHIP_PCT,
  ENERGY_GAIN_BLOCK, ENERGY_GAIN_HEAVY, ENERGY_GAIN_LIGHT, ENERGY_GAIN_TAKEN_PCT, HITSTOP, HITSTUN_DECAY_START,
  JUGGLE_MAX, MIN_HITSTUN, MIN_SCALING, ULTIMATE_MIN_SCALING, ULT_GAIN_BLOCK, ULT_GAIN_DEALT_PCT, ULT_GAIN_TAKEN_PCT,
} from './constants';
import { emit, type SimContext } from './context';
import { currentMove, currentSlot, isHeavySlot, moveSlotById } from './defs';
import { effStats } from './stats';
import { addEnergy, addUlt } from './meters';
import { restartAnim, setMode } from './anim';
import { activeHitboxFx, entityBoxFx, hurtboxFx, overlapCenter, overlaps } from './boxes';
import { getAbility } from '../../abilities/registry';

export type Strength = 'light' | 'heavy' | 'special' | 'ultimate';
export type HitResult = 'hit' | 'block' | 'whiff' | 'parry' | 'armor';

/** Fully resolved description of one hit (from a move or an entity). Knockback in px/frame. */
export interface HitSpec {
  moveId: string;
  kind: MoveDef['kind'];
  strength: Strength;
  damage: number;
  chip: number;
  kbx: number;
  kby: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  level: HitLevel;
  knockdown: boolean;
  launcher: boolean;
  energyGain: number;
  projectile: boolean;
  visual?: string;
  sfx?: string;
}

export function strengthOf(kind: MoveDef['kind'], slot: MoveSlot | null): Strength {
  if (kind === 'ultimate') return 'ultimate';
  if (kind === 'special') return 'special';
  return isHeavySlot(slot) ? 'heavy' : 'light';
}

export function defaultChip(kind: MoveDef['kind'], damage: number): number {
  return kind === 'normal' ? 0 : Math.trunc((damage * DEFAULT_CHIP_PCT) / 100);
}

export function specFromMove(move: MoveDef, slot: MoveSlot | null): HitSpec {
  const strength = strengthOf(move.kind, slot);
  return {
    moveId: move.id,
    kind: move.kind,
    strength,
    damage: move.damage,
    chip: move.chip ?? defaultChip(move.kind, move.damage),
    kbx: move.knockback.x,
    kby: move.knockback.y,
    hitstun: move.hitstun,
    blockstun: move.blockstun,
    hitstop: move.hitstop ?? HITSTOP[strength],
    level: move.level ?? 'mid',
    knockdown: !!move.knockdown,
    launcher: !!move.launcher,
    energyGain: move.energyGain ?? (move.kind !== 'normal' ? 0 : strength === 'heavy' ? ENERGY_GAIN_HEAVY : ENERGY_GAIN_LIGHT),
    projectile: false,
    visual: move.vfx,
    sfx: move.sfx,
  };
}

type Params = Record<string, number | string | boolean>;
const pn = (p: Params, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : d);
const pb = (p: Params, k: string, d: boolean) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
const ps = (p: Params, k: string, d: string | undefined) => (typeof p[k] === 'string' ? (p[k] as string) : d);

/**
 * Build a HitSpec from ability params (entity.data or AbilityRef.params) with the move as fallback.
 * Keys: damage, chip, kbx, kby, hitstun, blockstun, hitstop, level, knockdown, launcher, hitVisual, sfx, energyGain.
 */
export function specFromParams(move: MoveDef, slot: MoveSlot | null, p: Params, projectile = true): HitSpec {
  const base = specFromMove(move, slot);
  const damage = pn(p, 'damage', base.damage);
  return {
    ...base,
    damage,
    chip: pn(p, 'chip', move.chip ?? defaultChip(move.kind, damage)),
    kbx: pn(p, 'kbx', base.kbx),
    kby: pn(p, 'kby', base.kby),
    hitstun: pn(p, 'hitstun', base.hitstun),
    blockstun: pn(p, 'blockstun', base.blockstun),
    hitstop: pn(p, 'hitstop', base.hitstop),
    level: (ps(p, 'level', base.level) as HitLevel) ?? 'mid',
    knockdown: pb(p, 'knockdown', base.knockdown),
    launcher: pb(p, 'launcher', base.launcher),
    energyGain: pn(p, 'energyGain', base.energyGain),
    projectile,
    visual: ps(p, 'hitVisual', base.visual),
    sfx: ps(p, 'sfx', base.sfx),
  };
}

/** HitSpec for an entity (its data overrides the spawning move). */
export function specFromEntity(ctx: SimContext, e: EntityState): HitSpec {
  const owner = ctx.state.fighters[e.owner];
  const ms = moveSlotById(owner.charId, e.moveId);
  if (!ms) {
    return {
      moveId: e.moveId, kind: 'special', strength: 'special', damage: pn(e.data, 'damage', 30), chip: pn(e.data, 'chip', 4),
      kbx: pn(e.data, 'kbx', 4), kby: pn(e.data, 'kby', 0), hitstun: pn(e.data, 'hitstun', 16), blockstun: pn(e.data, 'blockstun', 12),
      hitstop: pn(e.data, 'hitstop', HITSTOP.special), level: 'mid', knockdown: pb(e.data, 'knockdown', false),
      launcher: false, energyGain: 0, projectile: true, visual: ps(e.data, 'hitVisual', e.visual),
    };
  }
  return specFromParams(ms.move, ms.slot, e.data, true);
}

// ---------------------------------------------------------------------------------------------------------------

export function isInvulnerable(f: FighterState): boolean {
  if (f.invulnFrames > 0) return true;
  const m = currentMove(f);
  return !!(m?.invuln && f.moveFrame >= m.invuln[0] && f.moveFrame <= m.invuln[1]);
}

export function hasArmor(f: FighterState): boolean {
  if (f.armorFrames > 0) return true;
  if (f.statuses.some((s) => s.kind === 'armor')) return true;
  const m = currentMove(f);
  return !!(m?.armor && f.moveFrame >= m.armor[0] && f.moveFrame <= m.armor[1]);
}

/** Can this fighter currently be struck at all? */
export function canBeHit(ctx: SimContext, f: FighterState): boolean {
  if (ctx.state.phase !== 'fight') return false;
  if (f.mode === 'knockdown' || f.mode === 'ko' || f.mode === 'victory' || f.mode === 'intro') return false;
  if (isInvulnerable(f)) return false;
  if (!f.grounded && f.juggle >= JUGGLE_MAX && (f.mode === 'knockback' || f.mode === 'hitstun')) return false;
  return true;
}

/** Is the defender blocking this hit (stance, level, facing)? */
export function blocks(ctx: SimContext, d: FighterState, level: HitLevel, dir: Facing): boolean {
  if (level === 'unblockable' || !d.grounded) return false;
  const input = ctx.inputs[d.index];
  const guarding = d.mode === 'block' || d.mode === 'blockstun'
    || ((d.mode === 'idle' || d.mode === 'walk' || d.mode === 'crouch') && has(input, BTN.BLOCK));
  if (!guarding) return false;
  if (d.facing === dir) return false; // hit from behind (cross-up)
  const crouch = has(input, BTN.DOWN);
  if (crouch) return level !== 'overhead';
  return level !== 'low';
}

/** Raw damage (no stun). Never below 0. Credits attacker stats. */
export function dealDamage(ctx: SimContext, attacker: PlayerIndex, target: FighterState, amount: number): number {
  const dmg = Math.max(0, Math.min(target.hp, Math.trunc(amount)));
  target.hp -= dmg;
  target.lastHitFrame = ctx.state.frame;
  if (attacker !== target.index && dmg > 0) ctx.state.fighters[attacker].stats.damageDealt += dmg;
  return dmg;
}

function scalingFor(n: number, kind: MoveDef['kind']): number {
  const s = n - 1 < COMBO_SCALING.length ? COMBO_SCALING[n - 1] : MIN_SCALING;
  return Math.max(s, kind === 'ultimate' ? ULTIMATE_MIN_SCALING : MIN_SCALING);
}

function cornerPush(ctx: SimContext, atk: FighterState, target: FighterState, spec: HitSpec, dir: Facing): void {
  if (spec.projectile || !atk.grounded || spec.kbx <= 0) return;
  const minX = STAGE_MARGIN_PX * FX, maxX = (STAGE_WIDTH_PX - STAGE_MARGIN_PX) * FX;
  const nearWall = dir === 1 ? target.x >= maxX - CORNER_DIST_PX * FX : target.x <= minX + CORNER_DIST_PX * FX;
  if (nearWall) atk.vx = -dir * Math.trunc((spec.kbx * FX * CORNER_PUSH_PCT) / 100);
}

/**
 * Apply one hit from `attacker` to `target`. `dir` = direction the target is pushed (+1 right).
 * `spark` = fixed-point world point for VFX. Returns what happened.
 */
export function applyHit(
  ctx: SimContext, attacker: PlayerIndex, target: FighterState, spec: HitSpec, dir: Facing,
  spark: { x: number; y: number }, source: { entity?: EntityState } = {},
): HitResult {
  const st = ctx.state;
  const atk = st.fighters[attacker];
  if (!canBeHit(ctx, target)) return 'whiff';

  // Ability interception (counters/parries) — dispatched by ability type of the target's current move.
  const tm = currentMove(target);
  if (tm?.abilities && spec.level !== 'unblockable') {
    for (const ab of tm.abilities) {
      const impl = getAbility(ab.type);
      if (impl?.interceptHit && target.moveFrame >= ab.frame
        && impl.interceptHit(ctx, target, attacker, ab.params, spec, dir, source)) {
        return 'parry';
      }
    }
  }

  const connected = atk.mode === 'attack' && atk.moveId === spec.moveId;

  // --- Block ---
  if (blocks(ctx, target, spec.level, dir)) {
    const crouch = has(ctx.inputs[target.index], BTN.DOWN);
    target.moveId = null;
    setMode(target, 'blockstun');
    target.stunFrames = Math.max(target.stunFrames, spec.blockstun);
    restartAnim(target, crouch ? 'crouchBlock' : 'block');
    target.vx = dir * Math.max(200, Math.trunc((spec.kbx * FX * BLOCK_PUSH_PCT) / 100));
    if (spec.chip > 0) {
      const ds = effStats(target);
      dealDamage(ctx, attacker, target, Math.max(1, Math.trunc((spec.chip * ds.defense) / 100)));
    }
    st.hitstop = Math.max(st.hitstop, Math.trunc((spec.hitstop * BLOCK_HITSTOP_PCT) / 100));
    addEnergy(ctx, target, ENERGY_GAIN_BLOCK);
    addEnergy(ctx, atk, Math.trunc(spec.energyGain / 2));
    addUlt(ctx, target, ULT_GAIN_BLOCK);
    addUlt(ctx, atk, ULT_GAIN_BLOCK);
    target.stats.blocks++;
    if (connected) atk.moveConnect = Math.max(atk.moveConnect, 1);
    cornerPush(ctx, atk, target, spec, dir);
    emit(ctx, { type: 'block', player: attacker, x: spark.x, y: spark.y, moveId: spec.moveId, strength: spec.strength,
      visual: spec.visual, sfx: spec.sfx, damage: 0 });
    return 'block';
  }

  // --- Damage ---
  const inCombo = target.mode === 'hitstun' || target.mode === 'knockback';
  const n = inCombo ? target.comboTaken + 1 : 1;
  const as = effStats(atk), ds = effStats(target);
  const scale = scalingFor(n, spec.kind);
  let dmg = spec.damage > 0
    ? Math.max(1, Math.trunc((spec.damage * as.powerMul * scale * ds.defense) / 1_000_000)) : 0;

  // --- Armor (absorbs non-ultimate hits without flinching) ---
  if (hasArmor(target) && spec.kind !== 'ultimate') {
    const armorStatus = target.statuses.find((s) => s.kind === 'armor');
    if (armorStatus) dmg = Math.trunc((dmg * armorStatus.magnitude) / 100);
    dealDamage(ctx, attacker, target, dmg);
    st.hitstop = Math.max(st.hitstop, Math.trunc(spec.hitstop / 2));
    addUlt(ctx, target, Math.trunc((dmg * ULT_GAIN_TAKEN_PCT) / 100));
    if (connected) atk.moveConnect = Math.max(atk.moveConnect, 1);
    atk.stats.hitsLanded++;
    emit(ctx, { type: 'armorHit', player: attacker, x: spark.x, y: spark.y, moveId: spec.moveId, damage: dmg,
      strength: spec.strength, visual: spec.visual, sfx: spec.sfx });
    return 'armor';
  }

  dmg = dealDamage(ctx, attacker, target, dmg);
  target.comboTaken = n;
  target.comboDamage = inCombo ? target.comboDamage + dmg : dmg;

  // --- Stun / knockback ---
  const wasAir = !target.grounded;
  target.moveId = null;
  const hitstun = Math.max(MIN_HITSTUN, spec.hitstun - Math.max(0, n - HITSTUN_DECAY_START));
  target.vx = dir * spec.kbx * FX;
  const goesAirborne = wasAir || spec.kby > 0 || spec.knockdown || spec.launcher;
  if (goesAirborne) {
    let vy = spec.kby * FX;
    if (wasAir && vy >= 0 && vy < 350) vy = 350; // keep juggles readable
    if (!wasAir && vy <= 0) vy = 450; // knockdown from ground pops up a little
    target.vy = vy;
    target.grounded = false;
    if (target.y <= 0) target.y = 1;
    if (wasAir) target.juggle++;
    const kd = spec.knockdown || spec.launcher || (wasAir && (target.knockdownOnLand || target.juggle >= 2));
    setMode(target, kd ? 'knockback' : 'hitstun');
    target.knockdownOnLand = kd;
    target.stunFrames = hitstun;
    restartAnim(target, kd ? 'knockback' : 'hitAir');
  } else {
    setMode(target, 'hitstun');
    target.stunFrames = hitstun;
    target.knockdownOnLand = false;
    restartAnim(target, spec.kbx >= 10 ? 'knockback' : 'hit');
  }

  st.hitstop = Math.max(st.hitstop, spec.hitstop);

  // --- Meters & stats ---
  addEnergy(ctx, atk, spec.energyGain);
  addEnergy(ctx, target, Math.trunc((dmg * ENERGY_GAIN_TAKEN_PCT) / 100));
  if (spec.kind !== 'ultimate') addUlt(ctx, atk, Math.trunc((dmg * ULT_GAIN_DEALT_PCT) / 100));
  addUlt(ctx, target, Math.trunc((dmg * ULT_GAIN_TAKEN_PCT) / 100));
  atk.stats.hitsLanded++;
  atk.stats.maxCombo = Math.max(atk.stats.maxCombo, n);
  if (connected) atk.moveConnect = 2;
  cornerPush(ctx, atk, target, spec, dir);

  emit(ctx, { type: 'hit', player: attacker, x: spark.x, y: spark.y, moveId: spec.moveId, damage: dmg,
    strength: spec.strength, visual: spec.visual, sfx: spec.sfx, combo: n });
  return 'hit';
}

// ---------------------------------------------------------------------------------------------------------------

/** Melee hit detection for both fighters (collected first so simultaneous hits trade). */
export function checkMeleeHits(ctx: SimContext): void {
  const st = ctx.state;
  const pending: { a: FighterState; d: FighterState; spec: HitSpec; idx: number; spark: { x: number; y: number } }[] = [];
  for (const a of st.fighters) {
    const d = st.fighters[a.index === 0 ? 1 : 0];
    const m = currentMove(a);
    if (!m || !m.hitbox) continue;
    const hb = activeHitboxFx(a);
    if (!hb) continue;
    const hits = Math.max(1, m.multiHit ?? 1);
    const t = a.moveFrame - m.startup;
    const idx = hits > 1 ? Math.min(hits - 1, Math.trunc((t * hits) / Math.max(1, m.active))) : 0;
    if (a.moveHits > idx) continue;
    const spec = specFromMove(m, currentSlot(a));

    // Opposing entities that can intercept melee (shields absorb, clones poof).
    let consumed = false;
    for (const e of st.entities) {
      if (e.owner !== d.index || e.life <= 0) continue;
      const impl = getAbility(e.abilityType);
      if (!impl?.onEntityStruck) continue;
      const eb = entityBoxFx(e);
      if (!overlaps(hb, eb)) continue;
      if (impl.onEntityStruck(ctx, e, a.index, spec, overlapCenter(hb, eb))) {
        consumed = true;
        break;
      }
    }
    if (consumed) {
      a.moveHits = idx + 1;
      a.moveHit = true;
      a.moveConnect = Math.max(a.moveConnect, 1);
      continue;
    }

    const hu = hurtboxFx(d);
    if (!overlaps(hb, hu) || !canBeHit(ctx, d)) continue;
    pending.push({ a, d, spec, idx, spark: overlapCenter(hb, hu) });
  }
  for (const p of pending) {
    p.a.moveHits = p.idx + 1;
    p.a.moveHit = true;
    applyHit(ctx, p.a.index, p.d, p.spec, p.a.facing, p.spark);
  }
}
