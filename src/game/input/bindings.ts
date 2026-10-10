/**
 * Default keyboard maps for local P1 / P2.
 * `code` values are KeyboardEvent.code (physical keys, layout-independent).
 */
import { BTN, type ButtonName } from './buttons';

export type KeySetId = 'p1keys' | 'p2keys';

export interface KeyBinding {
  btn: number;
  name: ButtonName;
  /** Spanish label for the Settings table. */
  action: string;
  /** KeyboardEvent.code values that trigger this button. */
  codes: string[];
  /** Human-readable key names shown in Settings. */
  display: string;
}

export const ACTION_LABELS: Record<ButtonName, string> = {
  LEFT: 'Izquierda',
  RIGHT: 'Derecha',
  UP: 'Salto',
  DOWN: 'Agacharse',
  LIGHT: 'Ligero',
  HEAVY: 'Fuerte',
  SP1: 'Especial 1',
  SP2: 'Especial 2',
  BLOCK: 'Bloqueo',
  ULT: 'Ultimate',
  DASH: 'Dash',
};

export const BINDING_ORDER: ButtonName[] = [
  'LEFT', 'RIGHT', 'UP', 'DOWN', 'LIGHT', 'HEAVY', 'SP1', 'SP2', 'BLOCK', 'ULT', 'DASH',
];

export const P1_BINDINGS: KeyBinding[] = [
  { btn: BTN.LEFT,  name: 'LEFT',  action: ACTION_LABELS.LEFT,  codes: ['KeyA'], display: 'A' },
  { btn: BTN.RIGHT, name: 'RIGHT', action: ACTION_LABELS.RIGHT, codes: ['KeyD'], display: 'D' },
  { btn: BTN.UP,    name: 'UP',    action: ACTION_LABELS.UP,    codes: ['KeyW'], display: 'W' },
  { btn: BTN.DOWN,  name: 'DOWN',  action: ACTION_LABELS.DOWN,  codes: ['KeyS'], display: 'S' },
  { btn: BTN.LIGHT, name: 'LIGHT', action: ACTION_LABELS.LIGHT, codes: ['KeyJ'], display: 'J' },
  { btn: BTN.HEAVY, name: 'HEAVY', action: ACTION_LABELS.HEAVY, codes: ['KeyK'], display: 'K' },
  { btn: BTN.SP1,   name: 'SP1',   action: ACTION_LABELS.SP1,   codes: ['KeyL'], display: 'L' },
  { btn: BTN.SP2,   name: 'SP2',   action: ACTION_LABELS.SP2,   codes: ['KeyU'], display: 'U' },
  { btn: BTN.BLOCK, name: 'BLOCK', action: ACTION_LABELS.BLOCK, codes: ['KeyI'], display: 'I' },
  { btn: BTN.ULT,   name: 'ULT',   action: ACTION_LABELS.ULT,   codes: ['KeyO'], display: 'O' },
  { btn: BTN.DASH,  name: 'DASH',  action: ACTION_LABELS.DASH,  codes: ['ShiftLeft', 'ShiftRight'], display: 'Shift / doble tap' },
];

/** Numpad plus laptop alternatives (no numpad): , . / ; ' ] [ */
export const P2_BINDINGS: KeyBinding[] = [
  { btn: BTN.LEFT,  name: 'LEFT',  action: ACTION_LABELS.LEFT,  codes: ['ArrowLeft'], display: 'LEFT' },
  { btn: BTN.RIGHT, name: 'RIGHT', action: ACTION_LABELS.RIGHT, codes: ['ArrowRight'], display: 'RIGHT' },
  { btn: BTN.UP,    name: 'UP',    action: ACTION_LABELS.UP,    codes: ['ArrowUp'], display: 'UP' },
  { btn: BTN.DOWN,  name: 'DOWN',  action: ACTION_LABELS.DOWN,  codes: ['ArrowDown'], display: 'DOWN' },
  { btn: BTN.LIGHT, name: 'LIGHT', action: ACTION_LABELS.LIGHT, codes: ['Numpad1', 'Comma'], display: 'Num1  o  ,' },
  { btn: BTN.HEAVY, name: 'HEAVY', action: ACTION_LABELS.HEAVY, codes: ['Numpad2', 'Period'], display: 'Num2  o  .' },
  { btn: BTN.SP1,   name: 'SP1',   action: ACTION_LABELS.SP1,   codes: ['Numpad3', 'Slash'], display: 'Num3  o  /' },
  { btn: BTN.SP2,   name: 'SP2',   action: ACTION_LABELS.SP2,   codes: ['Numpad4', 'Semicolon'], display: 'Num4  o  ;' },
  { btn: BTN.BLOCK, name: 'BLOCK', action: ACTION_LABELS.BLOCK, codes: ['Numpad5', 'Quote'], display: "Num5  o  '" },
  { btn: BTN.ULT,   name: 'ULT',   action: ACTION_LABELS.ULT,   codes: ['Numpad6', 'BracketRight'], display: 'Num6  o  ]' },
  { btn: BTN.DASH,  name: 'DASH',  action: ACTION_LABELS.DASH,  codes: ['Numpad0', 'BracketLeft'], display: 'Num0  o  [  /  doble tap' },
];

export const BINDINGS: Record<KeySetId, KeyBinding[]> = {
  p1keys: P1_BINDINGS,
  p2keys: P2_BINDINGS,
};

/** Menu / UI navigation (not fight bits). */
export const UI_KEYS = {
  confirm: ['Enter', 'Space', 'KeyJ'],
  back: ['Escape', 'KeyK'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
} as const;

const codeToBits: Record<KeySetId, Map<string, number>> = {
  p1keys: new Map(),
  p2keys: new Map(),
};

function buildMaps(): void {
  for (const set of ['p1keys', 'p2keys'] as KeySetId[]) {
    const map = new Map<string, number>();
    for (const b of BINDINGS[set]) {
      for (const code of b.codes) {
        map.set(code, (map.get(code) ?? 0) | b.btn);
      }
    }
    codeToBits[set] = map;
  }
}
buildMaps();

export function bitsForCode(set: KeySetId, code: string): number {
  return codeToBits[set].get(code) ?? 0;
}

export function allGameCodes(): Set<string> {
  const s = new Set<string>();
  for (const set of ['p1keys', 'p2keys'] as KeySetId[]) {
    for (const b of BINDINGS[set]) for (const c of b.codes) s.add(c);
  }
  // Also consume keys we don't want the browser to handle during play.
  for (const extra of ['Space', 'Backspace', 'F1', 'F2', 'F3', 'AltLeft', 'AltRight']) s.add(extra);
  return s;
}

export function isDashModifier(set: KeySetId, code: string): boolean {
  const b = BINDINGS[set].find((x) => x.name === 'DASH');
  return !!b && b.codes.includes(code);
}

export function displayFor(set: KeySetId, name: ButtonName): string {
  return BINDINGS[set].find((b) => b.name === name)?.display ?? '—';
}
