/**
 * CONTRACT FILE — deterministic simulation state. Pure data, JSON-serializable, NO Phaser, NO classes,
 * NO functions, NO Math.random, NO Date. All positions/velocities are INTEGERS in fixed-point units
 * (FX units per pixel). Render layer reads this state; it never mutates it.
 *
 * Coordinate system (sim): x grows to the right, y = height above ground (y=0 on floor, up is positive).
 * Fighter origin = feet center. Hitboxes are defined in pixels relative to origin with +x = FORWARD (facing).
 */
import type { InputBits } from '../input/buttons';

export const FX = 100; // fixed-point units per pixel
export const SIM_HZ = 60;
export const STAGE_WIDTH_PX = 2400; // world width in pixels; fighters are clamped to [STAGE_MARGIN, STAGE_WIDTH-STAGE_MARGIN]
export const STAGE_MARGIN_PX = 80;
export const MAX_FIGHTER_DISTANCE_PX = 1100; // camera can't separate fighters further than this
export const ROUND_TIME_SECONDS = 75;
export const ROUNDS_TO_WIN = 2; // best of 3
export const ENERGY_MAX = 1000; // 1000 = full bar (UI shows 0..100)
export const ULT_MAX = 1000;

export type PlayerIndex = 0 | 1;
export type Facing = 1 | -1;

/** Animation keys the renderer understands. Sim sets fighter.anim; render picks pose. */
export type AnimKey =
  | 'idle' | 'walkFwd' | 'walkBack' | 'jump' | 'fall' | 'crouch'
  | 'light' | 'light2' | 'heavy' | 'crouchLight' | 'crouchHeavy' | 'airLight' | 'airHeavy'
  | 'hit' | 'hitAir' | 'block' | 'crouchBlock' | 'knockback' | 'knockdown' | 'getup'
  | 'special1' | 'special2' | 'ultimate' | 'victory' | 'ko' | 'dash' | 'backdash'
  | 'teleport' | 'transform' | 'summon' | 'projectile' | 'beam' | 'counter' | 'intro';

export type FighterMode =
  | 'idle' | 'walk' | 'crouch' | 'jump' | 'dash' | 'attack' | 'block' | 'hitstun' | 'blockstun'
  | 'knockback' | 'knockdown' | 'getup' | 'teleport' | 'ko' | 'victory' | 'intro';

export interface StatusEffect {
  kind: string; // e.g. 'burn','slow','stun','armor','powerUp','speedUp','shield','transform'
  frames: number; // remaining frames (-1 = until round end)
  magnitude: number; // integer, meaning depends on kind (percent for multipliers: 120 = x1.2)
  source: PlayerIndex;
}

export interface MatchStats {
  damageDealt: number;
  hitsLanded: number;
  maxCombo: number;
  blocks: number;
  specialsUsed: number;
  ultimatesUsed: number;
  roundsWon: number;
}

export interface FighterState {
  index: PlayerIndex;
  charId: string;
  x: number; y: number; vx: number; vy: number; // fixed-point ints
  facing: Facing;
  grounded: boolean;
  hp: number; maxHp: number;
  energy: number; // 0..ENERGY_MAX
  ult: number; // 0..ULT_MAX
  mode: FighterMode;
  modeFrame: number; // frames since entering mode
  anim: AnimKey;
  animFrame: number; // frames since anim started (render uses it for pose interpolation)
  moveId: string | null; // active move (attack mode)
  moveFrame: number;
  moveHit: boolean; // active move already connected (prevents multi-hit unless move allows)
  stunFrames: number; // remaining hitstun/blockstun/knockdown frames
  invulnFrames: number; // i-frames (dash, getup, teleport, ultimate startup)
  armorFrames: number;
  airActions: number; // air dashes/jumps used since landing
  cooldowns: Record<string, number>; // moveId -> frames remaining
  statuses: StatusEffect[];
  form: string | null; // transformation id (e.g. 'ssj'), null = base
  comboTaken: number; // hits taken in current combo (attacker's combo counter = defender.comboTaken)
  comboDamage: number;
  prevInput: InputBits;
  lastDirTap: number; // reserved
  stats: MatchStats;
}

export type EntityKind = 'projectile' | 'beam' | 'summon' | 'trap' | 'aoe' | 'shield';

export interface HitboxPx { x: number; y: number; w: number; h: number } // relative, +x forward, y up from feet

export interface EntityState {
  id: number;
  kind: EntityKind;
  owner: PlayerIndex;
  abilityType: string; // key in ability registry
  moveId: string;
  visual: string; // render hint, e.g. 'kiBlast','kamehameha','rasengan','clone','rasenshuriken'
  x: number; y: number; vx: number; vy: number; // fixed-point
  facing: Facing;
  w: number; h: number; // pixel size of hitbox (centered on x, bottom at y for summons; centered for projectiles)
  life: number; // frames remaining
  age: number;
  hitsLeft: number;
  hitCooldown: number;
  power: number; // projectile clash strength
  data: Record<string, number | string | boolean>; // ability-specific serializable data
}

export type SimEventType =
  | 'hit' | 'block' | 'whiff' | 'counterHit' | 'parry' | 'armorHit'
  | 'jump' | 'land' | 'dash' | 'teleport' | 'transform' | 'summon'
  | 'projectileSpawn' | 'projectileHit' | 'projectileClash' | 'beamStart' | 'beamEnd'
  | 'aoe' | 'trapSet' | 'trapTrigger' | 'shield' | 'buff'
  | 'moveStart' | 'specialStart' | 'ultimateStart' | 'ultimateCinematicEnd'
  | 'knockdown' | 'getup' | 'ko' | 'roundStart' | 'fight' | 'roundEnd' | 'timeUp' | 'matchEnd'
  | 'energyFull' | 'ultReady';

export interface SimEvent {
  type: SimEventType;
  frame: number;
  player: PlayerIndex; // who caused it (attacker / actor)
  x: number; y: number; // fixed-point world position (spark location etc.)
  moveId?: string;
  damage?: number;
  strength?: 'light' | 'heavy' | 'special' | 'ultimate';
  visual?: string; // vfx hint from move data
  sfx?: string; // sfx hint from move data
  combo?: number;
}

export type MatchPhase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd';

export interface CinematicState {
  active: boolean;
  owner: PlayerIndex;
  framesLeft: number;
  total: number;
  moveId: string;
}

export interface MatchConfig {
  p1: string; // character id
  p2: string;
  seed: number;
  mode: 'versus' | 'training' | 'online';
  roundTimeSeconds?: number; // default ROUND_TIME_SECONDS; training uses Infinity-like (0 = no timer)
  roundsToWin?: number;
  training?: { regenHp: boolean; regenEnergy: boolean };
}

export interface MatchState {
  frame: number; // total simulated frames
  rng: number; // seeded RNG state (uint32)
  config: MatchConfig;
  phase: MatchPhase;
  phaseFrame: number;
  round: number; // 1-based
  roundWins: [number, number];
  roundWinners: (PlayerIndex | -1)[]; // -1 = draw
  timerFrames: number; // remaining round time in frames
  hitstop: number; // global freeze frames (both fighters + entities freeze, events still flow)
  cinematic: CinematicState;
  fighters: [FighterState, FighterState];
  entities: EntityState[];
  nextEntityId: number;
  events: SimEvent[]; // events produced by the LAST step only (cleared at start of each step)
  winner: PlayerIndex | -1 | null; // null while match ongoing, -1 draw
}

/** Public sim API (implemented in src/game/sim/engine.ts). Netcode (Phase 2) only needs these. */
export interface SimApi {
  createMatch(config: MatchConfig): MatchState;
  /** Advance exactly one 60 Hz frame. Pure w.r.t. (state, inputs): mutates and returns the given state. */
  step(state: MatchState, inputs: [InputBits, InputBits]): MatchState;
  cloneState(state: MatchState): MatchState; // deep clone (structuredClone-equivalent)
  hashState(state: MatchState): number; // deterministic 32-bit hash for desync detection
  /** Start next round after roundEnd (engine also does this automatically after a delay). */
  rematch(state: MatchState): MatchState;
}
