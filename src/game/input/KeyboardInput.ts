import { BTN, NO_INPUT, type InputBits, has } from './buttons';
import {
  allGameCodes,
  bitsForCode,
  isDashModifier,
  type KeySetId,
} from './bindings';
import {
  createDoubleTapState,
  noteDirPress,
  resetDoubleTap,
  tickDash,
  type DoubleTapState,
} from './doubleTap';

const GAME_CODES = allGameCodes();

interface SetState {
  held: InputBits;
  prev: InputBits;
  dashMod: boolean;
  dt: DoubleTapState;
}

function emptySet(): SetState {
  return { held: NO_INPUT, prev: NO_INPUT, dashMod: false, dt: createDoubleTapState() };
}

/**
 * Window-level keyboard sampler. Works without a Phaser scene.
 * `sample(set)` is called once per sim frame per key set.
 */
export class KeyboardInput {
  private down = new Set<string>();
  /** Keys pressed since they were last sampled: a tap shorter than one frame still registers once. */
  private tapped = new Set<string>();
  private sets: Record<KeySetId, SetState> = { p1keys: emptySet(), p2keys: emptySet() };
  private frame = 0;
  private advanced = false;
  private cache: Partial<Record<KeySetId, InputBits>> = {};
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private attached = false;

  constructor() {
    this.onKeyDown = (e) => this.handleDown(e);
    this.onKeyUp = (e) => this.handleUp(e);
    this.onBlur = () => this.clear();
    this.attach();
  }

  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
    this.attached = true;
  }

  destroy(): void {
    if (!this.attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true } as AddEventListenerOptions);
    window.removeEventListener('keyup', this.onKeyUp, { capture: true } as AddEventListenerOptions);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.attached = false;
    this.clear();
  }

  /** Advance the internal frame counter. Idempotent within a sample pair — InputManager calls this. */
  beginFrame(): void {
    if (this.advanced) return;
    this.frame += 1;
    this.advanced = true;
    this.cache = {};
  }

  endFrame(): void {
    this.advanced = false;
    this.sets.p1keys.prev = this.sets.p1keys.held;
    this.sets.p2keys.prev = this.sets.p2keys.held;
  }

  sample(set: KeySetId): InputBits {
    this.beginFrame();
    if (this.cache[set] !== undefined) return this.cache[set]!;
    const st = this.sets[set];
    this.rebuildHeld(set);

    const leftEdge = has(st.held, BTN.LEFT) && !has(st.prev, BTN.LEFT);
    const rightEdge = has(st.held, BTN.RIGHT) && !has(st.prev, BTN.RIGHT);
    if (leftEdge) noteDirPress(st.dt, 'left', this.frame);
    if (rightEdge) noteDirPress(st.dt, 'right', this.frame);

    const lingering = tickDash(st.dt);
    const dirHeld = has(st.held, BTN.LEFT) || has(st.held, BTN.RIGHT);
    const shiftDash = st.dashMod && dirHeld;
    let bits = st.held;
    // DASH from the key map already includes the dash key itself; only emit it with a direction
    // (or as a lingering double-tap). Strip raw DASH then re-apply with the right rule.
    const dashKey = has(st.held, BTN.DASH);
    bits &= ~BTN.DASH;
    if (lingering || (dashKey && dirHeld) || shiftDash) bits |= BTN.DASH;
    st.held = bits;
    this.cache[set] = bits;
    return bits;
  }

  clear(): void {
    this.down.clear();
    this.tapped.clear();
    this.sets.p1keys = emptySet();
    this.sets.p2keys = emptySet();
    resetDoubleTap(this.sets.p1keys.dt);
    resetDoubleTap(this.sets.p2keys.dt);
  }

  getFrame(): number {
    return this.frame;
  }

  private handleDown(e: KeyboardEvent): void {
    const code = e.code;
    if (GAME_CODES.has(code)) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
    }
    if (e.repeat) {
      this.down.add(code);
      return;
    }
    this.down.add(code);
    this.tapped.add(code);
  }

  private handleUp(e: KeyboardEvent): void {
    this.down.delete(e.code);
  }

  private rebuildHeld(set: KeySetId): void {
    const st = this.sets[set];
    let bits: InputBits = NO_INPUT;
    let dashMod = false;
    for (const code of this.down) {
      bits |= bitsForCode(set, code);
      if (isDashModifier(set, code)) dashMod = true;
    }
    for (const code of this.tapped) {
      const b = bitsForCode(set, code);
      if (b) {
        bits |= b;
        this.tapped.delete(code);
      }
    }
    st.held = bits;
    st.dashMod = dashMod;
  }
}
