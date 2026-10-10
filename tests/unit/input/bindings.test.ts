import { beforeEach, describe, expect, it } from 'vitest';
import { BTN } from '../../../src/game/input/buttons';
import {
  BINDING_ORDER, DEFAULT_CODES, UI_KEYS, allGameCodes, assignPrimary, bitsForCode, getCodes,
  keyLabel, loadBindings, resetBindings, setBinding,
} from '../../../src/game/input/bindings';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const ls = new MemStorage();
(globalThis as unknown as { localStorage: MemStorage }).localStorage = ls;

beforeEach(() => {
  ls.clear();
  loadBindings();
});

describe('default bindings', () => {
  it('P1 and P2 defaults share no keys', () => {
    const p1 = new Set(BINDING_ORDER.flatMap((n) => DEFAULT_CODES.p1keys[n]));
    const p2 = BINDING_ORDER.flatMap((n) => DEFAULT_CODES.p2keys[n]);
    expect(p2.filter((c) => p1.has(c))).toEqual([]);
  });

  it('P1 one-hand layout near WASD', () => {
    expect(bitsForCode('p1keys', 'KeyQ')).toBe(BTN.LIGHT);
    expect(bitsForCode('p1keys', 'KeyE')).toBe(BTN.HEAVY);
    expect(bitsForCode('p1keys', 'KeyR')).toBe(BTN.SP1);
    expect(bitsForCode('p1keys', 'KeyF')).toBe(BTN.SP2);
    expect(bitsForCode('p1keys', 'Space')).toBe(BTN.BLOCK);
    expect(bitsForCode('p1keys', 'KeyC')).toBe(BTN.ULT);
    expect(bitsForCode('p1keys', 'ShiftLeft')).toBe(BTN.DASH);
    expect(bitsForCode('p1keys', 'Digit3')).toBe(BTN.SP1);
    expect(bitsForCode('p1keys', 'KeyJ')).toBe(0);
  });

  it('P2 numpad + laptop alternates', () => {
    expect(bitsForCode('p2keys', 'Numpad1')).toBe(BTN.LIGHT);
    expect(bitsForCode('p2keys', 'Numpad4')).toBe(BTN.SP1);
    expect(bitsForCode('p2keys', 'Numpad0')).toBe(BTN.BLOCK);
    expect(bitsForCode('p2keys', 'Numpad3')).toBe(BTN.ULT);
    expect(bitsForCode('p2keys', 'ControlRight')).toBe(BTN.DASH);
    expect(bitsForCode('p2keys', 'Comma')).toBe(BTN.LIGHT);
    expect(bitsForCode('p2keys', 'ShiftRight')).toBe(BTN.DASH);
  });

  it('UI back includes Backspace and Escape', () => {
    expect(UI_KEYS.back).toContain('Backspace');
    expect(UI_KEYS.back).toContain('Escape');
  });

  it('keyLabel gives readable names', () => {
    expect(keyLabel('KeyQ')).toBe('Q');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('Numpad3')).toBe('Num3');
    expect(keyLabel('Space')).toBe('Espacio');
    expect(keyLabel('ArrowLeft')).toBe('←');
  });
});

describe('remapping', () => {
  it('assigning a key rebuilds the code→bits map', () => {
    assignPrimary('p1keys', 'LIGHT', 'KeyT');
    expect(bitsForCode('p1keys', 'KeyT')).toBe(BTN.LIGHT);
    expect(bitsForCode('p1keys', 'KeyQ')).toBe(0);
    expect(getCodes('p1keys', 'LIGHT')).toEqual(['KeyT', 'Digit1']);
    expect(allGameCodes().has('KeyT')).toBe(true);
  });

  it('a key already used in the same set is taken away (swap when left empty)', () => {
    const conflicts = assignPrimary('p1keys', 'LIGHT', 'KeyC');
    expect(conflicts).toEqual([{ set: 'p1keys', name: 'ULT', code: 'KeyC' }]);
    expect(bitsForCode('p1keys', 'KeyC')).toBe(BTN.LIGHT);
    expect(getCodes('p1keys', 'ULT')).toEqual(['KeyQ']);
  });

  it('a key used by the other player is removed there', () => {
    const conflicts = setBinding('p1keys', 'BLOCK', ['Numpad0']);
    expect(conflicts).toEqual([{ set: 'p2keys', name: 'BLOCK', code: 'Numpad0' }]);
    expect(bitsForCode('p2keys', 'Numpad0')).toBe(0);
    expect(bitsForCode('p1keys', 'Numpad0')).toBe(BTN.BLOCK);
  });

  it('reserved keys cannot be bound', () => {
    setBinding('p1keys', 'LIGHT', ['Escape', 'KeyH']);
    expect(getCodes('p1keys', 'LIGHT')).toEqual([]);
  });

  it('persists to localStorage and reloads', () => {
    assignPrimary('p2keys', 'ULT', 'KeyL');
    expect(ls.getItem('anime-clash-bindings')).toContain('KeyL');
    resetBindings('p2keys', { persist: false });
    expect(bitsForCode('p2keys', 'KeyL')).toBe(0);
    loadBindings();
    expect(bitsForCode('p2keys', 'KeyL')).toBe(BTN.ULT);
  });

  it('resetBindings restores defaults per player only', () => {
    assignPrimary('p1keys', 'LIGHT', 'KeyT');
    assignPrimary('p2keys', 'LIGHT', 'KeyL');
    resetBindings('p1keys');
    expect(getCodes('p1keys', 'LIGHT')).toEqual(DEFAULT_CODES.p1keys.LIGHT);
    expect(bitsForCode('p2keys', 'KeyL')).toBe(BTN.LIGHT);
    loadBindings();
    expect(getCodes('p1keys', 'LIGHT')).toEqual(DEFAULT_CODES.p1keys.LIGHT);
  });

  it('corrupt storage falls back to defaults', () => {
    ls.setItem('anime-clash-bindings', '{not json');
    loadBindings();
    expect(bitsForCode('p1keys', 'KeyQ')).toBe(BTN.LIGHT);
  });
});
