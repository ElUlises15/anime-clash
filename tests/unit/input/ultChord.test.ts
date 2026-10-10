import { describe, expect, it } from 'vitest';
import { BTN } from '../../../src/game/input/buttons';
import { ULT_CHORD_WINDOW, applyUltChord, createUltChordState } from '../../../src/game/input/ultChord';

const SP1 = BTN.SP1;
const SP2 = BTN.SP2;
const run = (frames: number[]) => {
  const st = createUltChordState();
  return frames.map((f) => applyUltChord(st, f));
};

describe('R+F ultimate chord', () => {
  it('same-frame press emits ULT, not the specials', () => {
    const out = run([SP1 | SP2, SP1 | SP2, 0]);
    expect(out[0]).toBe(BTN.ULT);
    expect(out[1] & (SP1 | SP2)).toBe(0);
    expect(out[2]).toBe(0);
  });

  it('partner within the window still emits ULT', () => {
    const out = run([SP1, SP1, SP1, SP1 | SP2]);
    expect(out.slice(0, 3).every((b) => (b & SP1) === 0)).toBe(true);
    expect(out[3]).toBe(BTN.ULT);
  });

  it('a lone special is released after the window', () => {
    const frames = Array(ULT_CHORD_WINDOW + 2).fill(SP2);
    const out = run(frames);
    const first = out.findIndex((b) => (b & SP2) !== 0);
    expect(first).toBe(ULT_CHORD_WINDOW);
    expect(out.some((b) => (b & BTN.ULT) !== 0)).toBe(false);
  });

  it('a short tap of a special still registers once', () => {
    const out = run([SP1, 0, 0, 0, 0]);
    expect(out.filter((b) => (b & SP1) !== 0).length).toBe(1);
  });

  it('partner too late does not make an ultimate', () => {
    const frames = [SP1, SP1, SP1, SP1, SP1 | SP2];
    const out = run(frames);
    expect(out.some((b) => (b & BTN.ULT) !== 0)).toBe(false);
  });

  it('other buttons pass through untouched', () => {
    const out = run([BTN.LEFT | BTN.LIGHT]);
    expect(out[0]).toBe(BTN.LEFT | BTN.LIGHT);
  });
});
