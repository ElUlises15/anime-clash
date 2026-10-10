/**
 * CONTRACT FILE (owned by render layer; extend ADDITIVELY only) — procedural cutout rig description.
 * Pure data; no Phaser imports so character folders and the sim can import it type-only.
 */
import type { AnimKey } from '../../game/sim/types';

export type BodyFamily = 'standard' | 'slim' | 'heavy' | 'petite';

export interface Palette {
  skin: string; skinShade: string;
  hair: string; hairShade: string; hairHighlight?: string;
  eyes: string;
  top: string; topShade: string; // gi / jacket
  undershirt?: string;
  belt?: string;
  pants: string; pantsShade: string;
  boots: string; bootsShade?: string;
  wrist?: string;
  accent: string; // signature accent
  outline: string; // dark ink outline
  aura: string; // energy/aura color
  auraAlt?: string;
}

/** Hair as list of spike/lock polygons in head-local space (head radius = 1, origin head center, +x forward, +y DOWN). */
export interface HairShape {
  /** Main silhouette polygons, each [x,y][] in head-local units. */
  locks: [number, number][][];
  /** Optional bangs drawn in front of face. */
  bangs?: [number, number][][];
}

export interface Accessory {
  kind: 'headband' | 'belt' | 'wristbands' | 'scarf' | 'cape' | 'symbol' | 'pouch' | 'collar' | 'shoulderPad' | 'custom';
  color: string;
  color2?: string;
  /** Free-form params for the renderer (e.g. headband plate, symbol text). */
  params?: Record<string, number | string | boolean>;
}

export interface Pose {
  /** Angles in degrees. Root offsets in px. Keys optional => default from family neutral pose. */
  rootX?: number; rootY?: number; // body offset from feet origin
  torso?: number; head?: number;
  armBackUpper?: number; armBackLower?: number; armFrontUpper?: number; armFrontLower?: number;
  legBackUpper?: number; legBackLower?: number; legFrontUpper?: number; legFrontLower?: number;
  handFront?: 'fist' | 'open' | 'palm' | 'point';
  handBack?: 'fist' | 'open' | 'palm' | 'point';
  squash?: number; // 1 = none
  face?: 'neutral' | 'angry' | 'shout' | 'hurt' | 'ko' | 'smile';
}

export interface AnimClip {
  /** Keyframes: frame offset (60fps) -> pose. Interpolated (ease) between keys. */
  keys: { f: number; pose: Pose }[];
  loop?: boolean;
}

export interface CharacterVisuals {
  family: BodyFamily;
  heightPx: number; // ~190-215 at 1080p
  palette: Palette;
  hair: HairShape;
  accessories: Accessory[];
  /** Per-form overrides (e.g. 'ssj' -> golden hair + aura). */
  forms?: Record<string, { palette?: Partial<Palette>; hair?: HairShape; aura?: boolean }>;
  /** Per-character animation overrides; anything missing falls back to the family clip. */
  animOverrides?: Partial<Record<AnimKey, AnimClip>>;
  /** VFX style hints. */
  vfx: {
    hitSpark: string; // color
    trail: string;
    projectile?: string;
    beam?: string;
    ultimateBg?: string; // cinematic background tint
    ultimateText?: string; // big text shown in cinematic
  };
}
