/**
 * Sprite sets: which characters have an AI-drawn sprite atlas and how sim AnimKeys map to atlas frames.
 * Pure data (no Phaser). Atlases live in public/assets/sprites/<atlas>.webp + .json (built by art/tools/build_game_atlas.py)
 * and are lazy-loaded the first time a fighter needs them. Characters without a set keep the procedural rig.
 */
import type { AnimKey } from '../../game/sim/types';
import type { SpriteClip } from './frameSelect';

export interface SpriteSet {
  id: string;
  /** Texture key + file stem under assets/sprites/. */
  atlas: string;
  /** Optional per-form atlases (same frame names), e.g. ssj. Missing => base atlas. */
  forms?: Record<string, string>;
  /** On-screen height of the idle frame in world px (rig heightPx * SPRITE_HEIGHT_MUL by default). */
  idleHeightPx?: number;
  clips: Partial<Record<AnimKey, SpriteClip>>;
  /** Cut-in bust image (assets/sprites/<file>.webp) for ultimate cinematics. */
  bust?: string;
}

/** Sprites are drawn ~30% taller than the old rig: commercial 2D fighters show ~35% of screen height at mid zoom. */
export const SPRITE_HEIGHT_MUL = 1.3;

/** Clips shared by every 12-key-pose set (see art/PIPELINE.md). */
const KEY_POSE_CLIPS: Partial<Record<AnimKey, SpriteClip>> = {
  idle: { mode: 'hold', frames: ['idle'], motion: 'breathe' },
  intro: { mode: 'hold', frames: ['idle'], motion: 'breathe' },
  walkFwd: { mode: 'hold', frames: ['walk'], motion: 'walk' },
  walkBack: { mode: 'hold', frames: ['walk'], motion: 'walk' },
  jump: { mode: 'hold', frames: ['jump'] },
  fall: { mode: 'hold', frames: ['jump'] },
  crouch: { mode: 'hold', frames: ['crouch'] },
  light: { mode: 'move', startup: ['idle'], active: ['light'], recovery: ['light', 'idle'], motion: 'lunge' },
  light2: { mode: 'move', startup: ['idle'], active: ['heavy'], recovery: ['idle'], motion: 'lunge' },
  heavy: { mode: 'move', startup: ['idle'], active: ['heavy'], recovery: ['heavy', 'idle'], motion: 'lunge' },
  crouchLight: { mode: 'move', startup: ['crouch'], active: ['crouch'], recovery: ['crouch'], motion: 'lunge' },
  crouchHeavy: { mode: 'move', startup: ['crouch'], active: ['crouch'], recovery: ['crouch'], motion: 'lunge' },
  airLight: { mode: 'move', startup: ['jump'], active: ['light'], recovery: ['jump'] },
  airHeavy: { mode: 'move', startup: ['jump'], active: ['heavy'], recovery: ['jump'] },
  block: { mode: 'hold', frames: ['block'] },
  crouchBlock: { mode: 'hold', frames: ['crouch'] },
  hit: { mode: 'hold', frames: ['hit'], motion: 'recoil' },
  hitAir: { mode: 'hold', frames: ['hit'] },
  knockback: { mode: 'hold', frames: ['hit'] },
  knockdown: { mode: 'once', frames: ['hit', 'knockdown'], fps: 8 },
  getup: { mode: 'once', frames: ['crouch', 'idle'], fps: 4 },
  ko: { mode: 'once', frames: ['hit', 'knockdown'], fps: 6 },
  victory: { mode: 'hold', frames: ['victory'], motion: 'breathe' },
  special1: { mode: 'move', startup: ['idle'], active: ['special'], recovery: ['special'], motion: 'lunge' },
  special2: { mode: 'move', startup: ['idle'], active: ['special'], recovery: ['special'], motion: 'lunge' },
  projectile: { mode: 'move', startup: ['idle'], active: ['special'], recovery: ['special'], motion: 'lunge' },
  beam: { mode: 'move', startup: ['special'], active: ['ultimate'], recovery: ['ultimate'] },
  ultimate: { mode: 'move', startup: ['victory'], active: ['ultimate'], recovery: ['ultimate'] },
  dash: { mode: 'hold', frames: ['walk'] },
  backdash: { mode: 'hold', frames: ['jump'] },
  teleport: { mode: 'hold', frames: ['special'] },
  transform: { mode: 'hold', frames: ['victory'] },
  summon: { mode: 'hold', frames: ['special'] },
  counter: { mode: 'hold', frames: ['block'] },
};

/** Clips for sets that also have the phase-2 animation sheets (walk_*, light_*, heavy_*, air_*, low_*, moves_*). */
const FULL_CLIPS: Partial<Record<AnimKey, SpriteClip>> = {
  ...KEY_POSE_CLIPS,
  walkFwd: { mode: 'loop', frames: ['walk_0', 'walk_1', 'walk_2'], fps: 7, motion: 'walk' },
  walkBack: { mode: 'loop', frames: ['walk_0', 'walk_1', 'walk_2'], fps: 6, motion: 'walk', reverse: true },
  jump: { mode: 'hold', frames: ['air_0'] },
  fall: { mode: 'hold', frames: ['air_1'] },
  light: { mode: 'move', startup: ['light_0'], active: ['light_1'], recovery: ['light_2', 'light_3'], motion: 'lunge' },
  light2: { mode: 'move', startup: ['light_3'], active: ['light'], recovery: ['light_2', 'light_3'], motion: 'lunge' },
  heavy: { mode: 'move', startup: ['heavy_0'], active: ['heavy_1'], recovery: ['heavy_2', 'heavy_3'], motion: 'lunge' },
  crouchLight: { mode: 'move', startup: ['crouch'], active: ['low_0'], recovery: ['crouch'], motion: 'lunge' },
  crouchHeavy: { mode: 'move', startup: ['crouch'], active: ['low_1'], recovery: ['low_1', 'crouch'] },
  airLight: { mode: 'move', startup: ['air_0'], active: ['air_2'], recovery: ['air_1'] },
  airHeavy: { mode: 'move', startup: ['air_0'], active: ['air_3'], recovery: ['air_1'] },
  crouchBlock: { mode: 'hold', frames: ['low_3'] },
  hitAir: { mode: 'hold', frames: ['moves_5'] },
  knockback: { mode: 'hold', frames: ['moves_5'] },
  knockdown: { mode: 'once', frames: ['moves_5', 'knockdown'], fps: 6 },
  getup: { mode: 'once', frames: ['low_2', 'crouch'], fps: 5 },
  ko: { mode: 'once', frames: ['moves_5', 'knockdown'], fps: 5 },
  dash: { mode: 'hold', frames: ['moves_4'] },
  backdash: { mode: 'hold', frames: ['air_1'] },
};

export const SPRITE_SETS: Record<string, SpriteSet> = {
  goku: {
    id: 'goku', atlas: 'goku', bust: 'goku_bust', forms: { ssj: 'goku_ssj' },
    clips: {
      ...FULL_CLIPS,
      projectile: { mode: 'move', startup: ['moves_3'], active: ['moves_0'], recovery: ['moves_0', 'idle'], motion: 'lunge' },
      beam: { mode: 'move', startup: ['moves_3'], active: ['moves_1'], recovery: ['moves_1'] },
      teleport: { mode: 'hold', frames: ['moves_2'] },
      special1: { mode: 'move', startup: ['moves_3'], active: ['victory'], recovery: ['victory', 'idle'] },
      special2: { mode: 'move', startup: ['moves_3'], active: ['moves_1'], recovery: ['moves_1'] },
      transform: { mode: 'hold', frames: ['moves_3'] },
      ultimate: { mode: 'move', startup: ['moves_3'], active: ['moves_1'], recovery: ['moves_1', 'idle'] },
    },
  },
  naruto: {
    id: 'naruto', atlas: 'naruto', bust: 'naruto_bust',
    clips: {
      ...FULL_CLIPS,
      projectile: { mode: 'move', startup: ['light_0'], active: ['moves_0'], recovery: ['moves_0', 'idle'], motion: 'lunge' },
      summon: { mode: 'hold', frames: ['moves_1'] },
      special1: { mode: 'move', startup: ['moves_1'], active: ['moves_1'], recovery: ['idle'] },
      special2: { mode: 'move', startup: ['moves_1'], active: ['moves_2'], recovery: ['moves_2', 'idle'], motion: 'lunge' },
      counter: { mode: 'hold', frames: ['moves_1'] },
      ultimate: { mode: 'move', startup: ['moves_3'], active: ['moves_0'], recovery: ['moves_0', 'idle'] },
    },
  },
};

SPRITE_SETS.vegeta = {
  id: 'vegeta', atlas: 'vegeta', bust: 'vegeta_bust', forms: { ssj: 'vegeta_ssj' },
  clips: {
    ...FULL_CLIPS,
    projectile: { mode: 'move', startup: ['moves_3'], active: ['moves_0'], recovery: ['moves_0', 'idle'], motion: 'lunge' },
    beam: { mode: 'move', startup: ['moves_3'], active: ['moves_1'], recovery: ['moves_1'] },
    special1: { mode: 'move', startup: ['moves_3'], active: ['moves_2'], recovery: ['moves_2', 'idle'], motion: 'lunge' },
    special2: { mode: 'move', startup: ['moves_3'], active: ['moves_3'], recovery: ['idle'] },
    transform: { mode: 'hold', frames: ['moves_3'] },
    ultimate: { mode: 'move', startup: ['moves_3'], active: ['ultimate'], recovery: ['ultimate', 'idle'] },
  },
};
/** Sasuke: 12 key poses only (animation sheets hit the Codex usage limit) -> key-pose clips + procedural motion. */
SPRITE_SETS.sasuke = {
  id: 'sasuke', atlas: 'sasuke', bust: 'sasuke_bust',
  clips: {
    ...KEY_POSE_CLIPS,
    projectile: { mode: 'move', startup: ['idle'], active: ['light'], recovery: ['light', 'idle'], motion: 'lunge' },
    special1: { mode: 'move', startup: ['crouch'], active: ['special'], recovery: ['special', 'idle'], motion: 'lunge' },
    special2: { mode: 'move', startup: ['crouch'], active: ['special'], recovery: ['special', 'idle'], motion: 'lunge' },
    counter: { mode: 'hold', frames: ['block'] },
    ultimate: { mode: 'move', startup: ['victory'], active: ['ultimate'], recovery: ['ultimate'] },
    dash: { mode: 'hold', frames: ['special'] },
  },
};

export function spriteSetFor(id: string): SpriteSet | undefined {
  return SPRITE_SETS[id];
}

export function spriteUrl(stem: string, ext: 'webp' | 'json'): string {
  return `assets/sprites/${stem}.${ext}`;
}
