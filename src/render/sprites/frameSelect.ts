/**
 * Pure, deterministic sprite-frame selection from sim state (no Phaser, no wall clock).
 * Frame choice depends only on (anim, animFrame, move timing) so rollback / replays render identically.
 */
import type { AnimKey } from '../../game/sim/types';

export type ClipMode = 'hold' | 'loop' | 'once' | 'move';
/** Procedural secondary motion layered on top of the drawn frames. */
export type ClipMotion = 'breathe' | 'walk' | 'recoil' | 'lunge' | 'float' | 'none';

export interface SpriteClip {
  /** hold/loop/once: the frames in order. */
  frames?: string[];
  /** move: frames spread over the move phases (startup / active / recovery). */
  startup?: string[];
  active?: string[];
  recovery?: string[];
  mode: ClipMode;
  /** loop/once playback rate in drawn frames per second (sim runs at 60 Hz). */
  fps?: number;
  motion?: ClipMotion;
  /** Play the loop backwards (walkBack). */
  reverse?: boolean;
}

export interface MoveTiming { startup: number; active: number; recovery: number }

export interface FramePick {
  frame: string;
  /** Multipliers / offsets (world px, +x = forward, +y = up) applied by the view. */
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

const SIM_HZ = 60;

function pickPhase(list: string[] | undefined, fallback: string, t: number, len: number): string {
  const l = list && list.length ? list : [fallback];
  if (len <= 0) return l[l.length - 1];
  const i = Math.min(l.length - 1, Math.max(0, Math.floor((t / len) * l.length)));
  return l[i];
}

/** Select the frame name for a clip at animation frame `animFrame` (0-based, 60 Hz). */
export function selectFrameName(clip: SpriteClip, animFrame: number, timing?: MoveTiming): string {
  const f = Math.max(0, animFrame | 0);
  if (clip.mode === 'move') {
    const first = clip.startup?.[0] ?? clip.active?.[0] ?? clip.frames?.[0] ?? '';
    const startup = timing?.startup ?? 6, active = timing?.active ?? 3, recovery = timing?.recovery ?? 10;
    if (f < startup) return pickPhase(clip.startup, first, f, startup);
    if (f < startup + active) return pickPhase(clip.active, first, f - startup, active);
    return pickPhase(clip.recovery ?? clip.active, first, Math.min(f - startup - active, recovery - 1), recovery);
  }
  const frames = clip.frames && clip.frames.length ? clip.frames : [''];
  if (clip.mode === 'hold' || frames.length === 1) return frames[0];
  const step = Math.floor((f * (clip.fps ?? 8)) / SIM_HZ);
  if (clip.mode === 'once') return frames[Math.min(frames.length - 1, step)];
  const i = step % frames.length;
  return frames[clip.reverse ? frames.length - 1 - i : i];
}

/** Procedural secondary motion (squash / bob / recoil), deterministic from animFrame. */
export function clipMotion(clip: SpriteClip, animFrame: number, timing?: MoveTiming): Omit<FramePick, 'frame'> {
  const f = Math.max(0, animFrame | 0);
  const out = { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
  switch (clip.motion ?? 'none') {
    case 'breathe': {
      const s = Math.sin((f / 72) * Math.PI * 2);
      out.scaleY = 1 + 0.014 * s; out.scaleX = 1 - 0.007 * s; break;
    }
    case 'walk': {
      const period = Math.max(1, Math.round(SIM_HZ / (clip.fps ?? 8)) * (clip.frames?.length ?? 3));
      out.offsetY = Math.abs(Math.sin((f / period) * Math.PI * 2)) * 4; break;
    }
    case 'recoil': {
      const k = Math.max(0, 1 - f / 12);
      out.offsetX = -14 * k; out.scaleX = 1 - 0.04 * k; out.scaleY = 1 + 0.03 * k; break;
    }
    case 'lunge': {
      if (timing) {
        const a0 = timing.startup, a1 = timing.startup + timing.active;
        if (f < a0) { const t = f / Math.max(1, a0); out.scaleX = 1 - 0.035 * t; out.scaleY = 1 + 0.025 * t; out.offsetX = -6 * t; }
        else if (f < a1) { out.scaleX = 1.03; out.scaleY = 0.985; out.offsetX = 10; }
        else { const t = Math.min(1, (f - a1) / Math.max(1, timing.recovery)); out.offsetX = 10 * (1 - t); }
      }
      break;
    }
    case 'float': out.offsetY = Math.sin((f / 40) * Math.PI * 2) * 3; break;
  }
  return out;
}

export function selectFrame(clip: SpriteClip, animFrame: number, timing?: MoveTiming): FramePick {
  return { frame: selectFrameName(clip, animFrame, timing), ...clipMotion(clip, animFrame, timing) };
}

/** Fallback chain so every AnimKey resolves even with a partial sprite set. */
export const ANIM_FALLBACK: Record<AnimKey, AnimKey[]> = {
  idle: [], intro: ['victory', 'idle'], walkFwd: ['idle'], walkBack: ['walkFwd', 'idle'],
  jump: ['idle'], fall: ['jump', 'idle'], crouch: ['idle'],
  light: ['idle'], light2: ['light', 'heavy', 'idle'], heavy: ['light', 'idle'],
  crouchLight: ['crouch', 'light'], crouchHeavy: ['crouchLight', 'crouch', 'heavy'],
  airLight: ['jump', 'light'], airHeavy: ['airLight', 'jump', 'heavy'],
  hit: ['idle'], hitAir: ['hit'], block: ['idle'], crouchBlock: ['block', 'crouch'],
  knockback: ['hitAir', 'hit'], knockdown: ['hit'], getup: ['crouch', 'idle'],
  special1: ['projectile', 'heavy'], special2: ['special1', 'heavy'], ultimate: ['special1', 'heavy'],
  victory: ['idle'], ko: ['knockdown', 'hit'], dash: ['walkFwd', 'idle'], backdash: ['walkBack', 'idle'],
  teleport: ['dash', 'idle'], transform: ['ultimate', 'special1'], summon: ['special1', 'projectile'],
  projectile: ['special1', 'light'], beam: ['projectile', 'special1'], counter: ['block', 'special1'],
};

export function resolveClip(clips: Partial<Record<AnimKey, SpriteClip>>, anim: AnimKey): SpriteClip | undefined {
  if (clips[anim]) return clips[anim];
  const seen = new Set<AnimKey>([anim]);
  const queue = [...(ANIM_FALLBACK[anim] ?? [])];
  while (queue.length) {
    const k = queue.shift()!;
    if (seen.has(k)) continue;
    seen.add(k);
    if (clips[k]) return clips[k];
    queue.push(...(ANIM_FALLBACK[k] ?? []));
  }
  return clips.idle;
}
