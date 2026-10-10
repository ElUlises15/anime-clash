import { describe, expect, it } from 'vitest';
import {
  createDoubleTapState,
  noteDirPress,
  tickDash,
  resetDoubleTap,
  DASH_TAP_WINDOW,
  DASH_HOLD_FRAMES,
} from '../../../src/game/input/doubleTap';

describe('double-tap dash', () => {
  it('does not dash on a single tap', () => {
    const s = createDoubleTapState();
    expect(noteDirPress(s, 'left', 10)).toBe(false);
    expect(tickDash(s)).toBe(false);
  });

  it('dashes when the same direction is pressed again within the window', () => {
    const s = createDoubleTapState();
    noteDirPress(s, 'left', 10);
    expect(noteDirPress(s, 'left', 10 + DASH_TAP_WINDOW)).toBe(true);
    let n = 0;
    while (tickDash(s)) n++;
    expect(n).toBe(DASH_HOLD_FRAMES);
  });

  it('does not dash after the window expires', () => {
    const s = createDoubleTapState();
    noteDirPress(s, 'left', 5);
    expect(noteDirPress(s, 'left', 5 + DASH_TAP_WINDOW + 1)).toBe(false);
  });

  it('does not dash when switching directions', () => {
    const s = createDoubleTapState();
    noteDirPress(s, 'left', 10);
    expect(noteDirPress(s, 'right', 14)).toBe(false);
  });

  it('reset clears lingering dash', () => {
    const s = createDoubleTapState();
    noteDirPress(s, 'right', 1);
    noteDirPress(s, 'right', 5);
    resetDoubleTap(s);
    expect(tickDash(s)).toBe(false);
  });
});
