/**
 * Keyboard maps for local P1 / P2 — defaults plus user remapping (persisted in localStorage).
 * `code` values are KeyboardEvent.code (physical keys, layout-independent).
 *
 * Defaults (no shared keys between sets):
 * - P1 (left hand, WASD):  A/D move · W jump · S crouch · Q light · E heavy · R sp1 · F sp2
 *   Space block · Shift Izq dash · C ultimate (also R+F together) · 1/2/3/4 alternates for Q/E/R/F.
 * - P2 (right hand): arrows · Num1 light · Num2 heavy · Num4 sp1 · Num5 sp2 · Num0 block · Num3 ult
 *   Num6 / Num. / Ctrl Der dash. Laptop (no numpad): , . ; ' / ] and Shift Der dash.
 */
import { BTN, type ButtonName } from './buttons';

export type KeySetId = 'p1keys' | 'p2keys';
export const KEY_SETS: readonly KeySetId[] = ['p1keys', 'p2keys'];

export interface KeyBinding {
  btn: number;
  name: ButtonName;
  /** Spanish label for the Settings table. */
  action: string;
  /** KeyboardEvent.code values that trigger this button. */
  codes: string[];
  /** Human-readable key names shown in Settings (derived from `codes`). */
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

export const DEFAULT_CODES: Record<KeySetId, Record<ButtonName, string[]>> = {
  p1keys: {
    LEFT: ['KeyA'],
    RIGHT: ['KeyD'],
    UP: ['KeyW'],
    DOWN: ['KeyS'],
    LIGHT: ['KeyQ', 'Digit1'],
    HEAVY: ['KeyE', 'Digit2'],
    SP1: ['KeyR', 'Digit3'],
    SP2: ['KeyF', 'Digit4'],
    BLOCK: ['Space'],
    ULT: ['KeyC'],
    DASH: ['ShiftLeft'],
  },
  p2keys: {
    LEFT: ['ArrowLeft'],
    RIGHT: ['ArrowRight'],
    UP: ['ArrowUp'],
    DOWN: ['ArrowDown'],
    LIGHT: ['Numpad1', 'Comma'],
    HEAVY: ['Numpad2', 'Period'],
    SP1: ['Numpad4', 'Semicolon'],
    SP2: ['Numpad5', 'Quote'],
    BLOCK: ['Numpad0', 'Slash'],
    ULT: ['Numpad3', 'BracketRight'],
    DASH: ['Numpad6', 'NumpadDecimal', 'ControlRight', 'ShiftRight'],
  },
};

const STORAGE_KEY = 'anime-clash-bindings';
const STORAGE_VERSION = 1;

const KEY_NAMES: Record<string, string> = {
  Space: 'Espacio', Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: 'Esc', Backspace: 'Retroceso', Tab: 'Tab',
  ShiftLeft: 'Shift Izq', ShiftRight: 'Shift Der', ControlLeft: 'Ctrl Izq', ControlRight: 'Ctrl Der',
  AltLeft: 'Alt Izq', AltRight: 'Alt Der', MetaLeft: 'Meta', MetaRight: 'Meta', CapsLock: 'Bloq Mayús',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', IntlBackslash: '<',
  NumpadDecimal: 'Num .', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /',
  Insert: 'Insert', Delete: 'Supr', Home: 'Inicio', End: 'Fin', PageUp: 'RePág', PageDown: 'AvPág',
};

/** Nice display name for a KeyboardEvent.code ('KeyQ' → 'Q', 'Numpad1' → 'Num1', 'ShiftLeft' → 'Shift Izq'). */
export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return `Num${m[1]}`;
  return code;
}

function labelCodes(codes: string[]): string {
  return codes.length ? codes.map(keyLabel).join(' / ') : '—';
}

function makeSet(codes: Record<ButtonName, string[]>): KeyBinding[] {
  return BINDING_ORDER.map((name) => ({
    btn: BTN[name],
    name,
    action: ACTION_LABELS[name],
    codes: [...codes[name]],
    display: labelCodes(codes[name]),
  }));
}

/** Live (mutable) bindings. Arrays are mutated in place so references stay valid. */
export const P1_BINDINGS: KeyBinding[] = makeSet(DEFAULT_CODES.p1keys);
export const P2_BINDINGS: KeyBinding[] = makeSet(DEFAULT_CODES.p2keys);

export const BINDINGS: Record<KeySetId, KeyBinding[]> = {
  p1keys: P1_BINDINGS,
  p2keys: P2_BINDINGS,
};

/** Menu / UI navigation (not fight bits). */
export const UI_KEYS = {
  confirm: ['Enter', 'Space', 'KeyJ', 'NumpadEnter'],
  back: ['Escape', 'Backspace', 'KeyK'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
} as const;

/** Keys that can never be bound to fight actions (menus / pause / help). */
export const RESERVED_CODES: readonly string[] = ['Escape', 'Backspace', 'KeyP', 'KeyH', 'F1', 'F2', 'F3', 'Tab'];

let codeToBits: Record<KeySetId, Map<string, number>> = { p1keys: new Map(), p2keys: new Map() };
let gameCodes = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function rebuild(): void {
  const next: Record<KeySetId, Map<string, number>> = { p1keys: new Map(), p2keys: new Map() };
  const all = new Set<string>();
  for (const set of KEY_SETS) {
    for (const b of BINDINGS[set]) {
      b.display = labelCodes(b.codes);
      for (const code of b.codes) {
        next[set].set(code, (next[set].get(code) ?? 0) | b.btn);
        all.add(code);
      }
    }
  }
  // Also consume keys we don't want the browser to handle during play.
  for (const extra of ['Space', 'Backspace', 'Tab', 'F1', 'F2', 'F3', 'AltLeft', 'AltRight']) all.add(extra);
  codeToBits = next;
  gameCodes = all;
  version += 1;
  for (const fn of listeners) fn();
}

/** Bumped every time bindings change (cheap cache invalidation). */
export function bindingsVersion(): number {
  return version;
}

export function onBindingsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function bitsForCode(set: KeySetId, code: string): number {
  return codeToBits[set].get(code) ?? 0;
}

export function allGameCodes(): Set<string> {
  return gameCodes;
}

export function isDashModifier(set: KeySetId, code: string): boolean {
  return (bitsForCode(set, code) & BTN.DASH) !== 0;
}

export function displayFor(set: KeySetId, name: ButtonName): string {
  const b = BINDINGS[set].find((x) => x.name === name);
  if (!b) return '—';
  return name === 'DASH' ? `${b.display}  o  doble tap` : b.display;
}

/** Current codes per action (copy). */
export function getBindings(set: KeySetId): Record<ButtonName, string[]> {
  const out = {} as Record<ButtonName, string[]>;
  for (const b of BINDINGS[set]) out[b.name] = [...b.codes];
  return out;
}

export function getCodes(set: KeySetId, name: ButtonName): string[] {
  return [...(BINDINGS[set].find((b) => b.name === name)?.codes ?? [])];
}

export interface BindingConflict { set: KeySetId; name: ButtonName; code: string }

/**
 * Replace the codes of one action. Any of those codes used elsewhere (same set or the other player's set)
 * is removed from that action; if a same-set action is left with no keys, it receives this action's
 * previous primary key (swap). Returns the actions that lost a key.
 */
export function setBinding(set: KeySetId, name: ButtonName, codes: string[], opts?: { persist?: boolean }): BindingConflict[] {
  const target = BINDINGS[set].find((b) => b.name === name);
  if (!target) return [];
  const clean = [...new Set(codes)].filter((c) => !RESERVED_CODES.includes(c));
  const oldPrimary = target.codes[0];
  const conflicts: BindingConflict[] = [];
  for (const s of KEY_SETS) {
    for (const b of BINDINGS[s]) {
      if (s === set && b.name === name) continue;
      for (const code of clean) {
        const i = b.codes.indexOf(code);
        if (i < 0) continue;
        b.codes.splice(i, 1);
        conflicts.push({ set: s, name: b.name, code });
        if (s === set && b.codes.length === 0 && oldPrimary && !clean.includes(oldPrimary)) b.codes.push(oldPrimary);
      }
    }
  }
  target.codes.splice(0, target.codes.length, ...clean);
  rebuild();
  if (opts?.persist !== false) saveBindings();
  return conflicts;
}

/**
 * Remap the primary key of an action (what the Settings "press a key" flow does): `code` becomes the first key,
 * other alternates stay unless they are the same key.
 */
export function assignPrimary(set: KeySetId, name: ButtonName, code: string): BindingConflict[] {
  const cur = getCodes(set, name);
  const rest = cur.slice(1).filter((c) => c !== code);
  return setBinding(set, name, [code, ...rest]);
}

export function resetBindings(set: KeySetId, opts?: { persist?: boolean }): void {
  for (const b of BINDINGS[set]) b.codes.splice(0, b.codes.length, ...DEFAULT_CODES[set][b.name]);
  // Defaults never overlap between sets, but a custom set on the other side might use our keys.
  const mine = new Set(BINDINGS[set].flatMap((b) => b.codes));
  for (const s of KEY_SETS) {
    if (s === set) continue;
    for (const b of BINDINGS[s]) {
      for (let i = b.codes.length - 1; i >= 0; i--) if (mine.has(b.codes[i])) b.codes.splice(i, 1);
    }
  }
  rebuild();
  if (opts?.persist !== false) saveBindings();
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveBindings(): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, p1keys: getBindings('p1keys'), p2keys: getBindings('p2keys') }));
  } catch { /* private mode */ }
}

/** Load saved bindings (falls back to defaults for anything missing/invalid). Safe to call repeatedly. */
export function loadBindings(): void {
  for (const set of KEY_SETS) for (const b of BINDINGS[set]) b.codes.splice(0, b.codes.length, ...DEFAULT_CODES[set][b.name]);
  const ls = storage();
  try {
    const raw = ls?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: number } & Partial<Record<KeySetId, Partial<Record<ButtonName, unknown>>>>;
      if (parsed && parsed.v === STORAGE_VERSION) {
        for (const set of KEY_SETS) {
          const saved = parsed[set];
          if (!saved) continue;
          for (const b of BINDINGS[set]) {
            const codes = saved[b.name];
            if (Array.isArray(codes) && codes.every((c) => typeof c === 'string')) {
              b.codes.splice(0, b.codes.length, ...(codes as string[]).filter((c) => !RESERVED_CODES.includes(c)));
            }
          }
        }
      }
    }
  } catch { /* corrupt → defaults */ }
  rebuild();
}

loadBindings();
