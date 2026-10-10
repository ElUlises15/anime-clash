/** Animation key selection for the renderer (fighter.anim / fighter.animFrame). */
import type { AnimKey, FighterMode, FighterState } from './types';
import { currentMove } from './defs';

/** Force an animation to (re)start this frame (animFrame becomes 0 after updateAnim). */
export function restartAnim(f: FighterState, key: AnimKey): void {
  f.anim = key;
  f.animFrame = -1;
}

/** Switch animation only if different (keeps progress when unchanged). */
export function switchAnim(f: FighterState, key: AnimKey): void {
  if (f.anim !== key) restartAnim(f, key);
}

export function setMode(f: FighterState, mode: FighterMode): void {
  f.mode = mode;
  f.modeFrame = 0;
}

function desiredAnim(f: FighterState): AnimKey {
  switch (f.mode) {
    case 'intro': return 'intro';
    case 'idle': return 'idle';
    case 'walk': return f.vx * f.facing >= 0 ? 'walkFwd' : 'walkBack';
    case 'crouch': return 'crouch';
    case 'jump': return f.vy > 0 ? 'jump' : 'fall';
    case 'dash': return f.anim === 'backdash' ? 'backdash' : 'dash';
    case 'attack': return currentMove(f)?.anim ?? f.anim;
    case 'block': case 'blockstun': return f.anim === 'crouchBlock' ? 'crouchBlock' : 'block';
    case 'hitstun': return f.grounded ? (f.anim === 'knockback' ? 'knockback' : 'hit') : 'hitAir';
    case 'knockback': return 'knockback';
    case 'knockdown': return 'knockdown';
    case 'getup': return 'getup';
    case 'teleport': return 'teleport';
    case 'ko': return 'ko';
    case 'victory': return 'victory';
  }
  return 'idle';
}

/** Called once per simulated (non-frozen) frame after all systems. */
export function updateAnim(f: FighterState): void {
  const want = desiredAnim(f);
  if (want !== f.anim) {
    f.anim = want;
    f.animFrame = 0;
  } else {
    f.animFrame++;
  }
}
