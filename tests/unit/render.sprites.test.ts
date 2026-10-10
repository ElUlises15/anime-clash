import { describe, it, expect } from 'vitest';
import { selectFrameName, clipMotion, resolveClip, type SpriteClip } from '../../src/render/sprites/frameSelect';
import { SPRITE_SETS } from '../../src/render/sprites/sets';
import type { AnimKey } from '../../src/game/sim/types';

const ALL: AnimKey[] = ['idle','walkFwd','walkBack','jump','fall','crouch','light','light2','heavy','crouchLight','crouchHeavy','airLight','airHeavy','hit','hitAir','block','crouchBlock','knockback','knockdown','getup','special1','special2','ultimate','victory','ko','dash','backdash','teleport','transform','summon','projectile','beam','counter','intro'];

describe('sprite frame selection', () => {
  it('maps move phases to startup/active/recovery frames', () => {
    const c: SpriteClip = { mode: 'move', startup: ['s'], active: ['a'], recovery: ['r1', 'r2'] };
    const t = { startup: 5, active: 3, recovery: 8 };
    expect(selectFrameName(c, 0, t)).toBe('s');
    expect(selectFrameName(c, 4, t)).toBe('s');
    expect(selectFrameName(c, 5, t)).toBe('a');
    expect(selectFrameName(c, 7, t)).toBe('a');
    expect(selectFrameName(c, 8, t)).toBe('r1');
    expect(selectFrameName(c, 15, t)).toBe('r2');
    expect(selectFrameName(c, 99, t)).toBe('r2');
  });
  it('spreads startup frames and holds the impact frame for the whole active window', () => {
    const c: SpriteClip = { mode: 'move', startup: ['s0', 's1'], active: ['a0', 'impact'], recovery: ['r'] };
    const t = { startup: 6, active: 8, recovery: 10 };
    expect(selectFrameName(c, 0, t)).toBe('s0');
    expect(selectFrameName(c, 3, t)).toBe('s1');
    expect(selectFrameName(c, 6, t)).toBe('a0');
    for (let f = 8; f < 14; f++) expect(selectFrameName(c, f, t)).toBe('impact');
    expect(selectFrameName(c, 14, t)).toBe('r');
  });
  it('loops and reverses deterministically', () => {
    const c: SpriteClip = { mode: 'loop', frames: ['a', 'b', 'c'], fps: 10 };
    expect([0, 6, 12, 18].map((f) => selectFrameName(c, f))).toEqual(['a', 'b', 'c', 'a']);
    expect(selectFrameName({ ...c, reverse: true }, 0)).toBe('c');
    const once: SpriteClip = { mode: 'once', frames: ['x', 'y'], fps: 6 };
    expect(selectFrameName(once, 1000)).toBe('y');
  });
  it('is pure (same input, same output) and motion is bounded', () => {
    const c: SpriteClip = { mode: 'hold', frames: ['idle'], motion: 'breathe' };
    for (let f = 0; f < 200; f++) {
      const m = clipMotion(c, f);
      expect(m).toEqual(clipMotion(c, f));
      expect(Math.abs(m.scaleY - 1)).toBeLessThan(0.03);
    }
  });
  it('every sprite set resolves every AnimKey', () => {
    for (const set of Object.values(SPRITE_SETS)) {
      for (const k of ALL) expect(resolveClip(set.clips, k), `${set.id}:${k}`).toBeDefined();
    }
  });
});
