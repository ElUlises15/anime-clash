/**
 * 2D focus system for menus: spatial arrow/WASD navigation (nearest item in the pressed direction, no forced
 * wrap), mouse hover moves the keyboard focus, click/Enter/Space/J activate, Esc/Backspace go back.
 * Works with any object that has a position plus setFocused()/activate() (ArcadeButton, Slider rows, ...).
 */
import Phaser from 'phaser';
import { audio } from '../audio/AudioEngine';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Focusable {
  x: number;
  y: number;
  visible?: boolean;
  enabled?: boolean;
  hovered?: boolean;
  setFocused(v: boolean): unknown;
  activate(): void;
  /** Phaser event emitter (GameObjects): pointerover moves focus here. */
  on?: (event: string, fn: (...args: unknown[]) => void) => unknown;
  off?: (event: string, fn: (...args: unknown[]) => void) => unknown;
  getWorldTransformMatrix?: () => Phaser.GameObjects.Components.TransformMatrix;
  /** Optional per-item left/right handler (e.g. sliders); return true to consume the key. */
  onNudge?: (dir: -1 | 1) => boolean;
}

export const CONFIRM_KEYS = ['Enter', 'NumpadEnter', 'Space', 'KeyJ'];
export const BACK_KEYS = ['Escape', 'Backspace', 'KeyK'];
const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function dirForKey(code: string): Dir | null {
  return DIR_KEYS[code] ?? null;
}

/**
 * Spatial pick: index of the candidate nearest to `from` in direction `dir`, or -1 if none lies that way.
 * Off-axis distance is weighted 2x so items in the same row/column win over diagonal ones.
 */
export function pickSpatial(from: { x: number; y: number }, cands: ({ x: number; y: number } | null)[], dir: Dir): number {
  let best = -1;
  let bestScore = Infinity;
  cands.forEach((c, i) => {
    if (!c) return;
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const primary = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const secondary = Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
    if (primary <= 4) return;
    const score = primary + secondary * 2;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function worldPos(it: Focusable): { x: number; y: number } {
  const m = it.getWorldTransformMatrix?.();
  return m ? { x: m.tx, y: m.ty } : { x: it.x, y: it.y };
}

export interface FocusNavOpts {
  onBack?: () => void;
  /** Listen to the scene keyboard (default true). Set false when another handler forwards keys via handleKey(). */
  keyboard?: boolean;
  /** Wrap at the ends (only sensible for a single row/column). Default false. */
  wrap?: boolean;
  /** Skip disabled items while navigating (default true). */
  skipDisabled?: boolean;
}

export class FocusNav<T extends Focusable = Focusable> {
  items: T[] = [];
  index = 0;
  onBack?: () => void;
  private scene: Phaser.Scene;
  private opts: FocusNavOpts;
  private keyHandler = (e: KeyboardEvent) => { this.handleKey(e); };
  private hoverHandlers = new Map<T, () => void>();
  private bound = false;

  constructor(scene: Phaser.Scene, items: T[] = [], opts: FocusNavOpts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.onBack = opts.onBack;
    this.setItems(items);
    if (opts.keyboard !== false) this.bind();
  }

  get current(): T | undefined { return this.items[this.index]; }

  setItems(items: T[], focusIndex = this.index): void {
    for (const [it, fn] of this.hoverHandlers) it.off?.('pointerover', fn);
    this.hoverHandlers.clear();
    this.items = items;
    this.index = Phaser.Math.Clamp(focusIndex, 0, Math.max(0, items.length - 1));
    for (const it of items) {
      const fn = () => {
        if (!this.usable(it)) return;
        const i = this.items.indexOf(it);
        if (i >= 0) this.focus(i);
      };
      it.on?.('pointerover', fn);
      this.hoverHandlers.set(it, fn);
    }
    this.sync();
  }

  destroy(): void {
    this.unbind();
    for (const [it, fn] of this.hoverHandlers) it.off?.('pointerover', fn);
    this.hoverHandlers.clear();
  }

  /** Returns true when the key was consumed. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.repeat && !dirForKey(e.code)) return false;
    const c = e.code;
    const d = dirForKey(c);
    if (d) {
      const cur = this.current;
      if ((d === 'left' || d === 'right') && cur?.onNudge?.(d === 'left' ? -1 : 1)) return true;
      this.move(d);
      return true;
    }
    if (CONFIRM_KEYS.includes(c)) {
      if (e.repeat) return true;
      const cur = this.current;
      if (cur && this.usable(cur)) cur.activate();
      return true;
    }
    if (BACK_KEYS.includes(c) && this.onBack) {
      if (e.repeat) return true;
      audio.playSfx('uiBack');
      this.onBack();
      return true;
    }
    return false;
  }

  move(dir: Dir): void {
    const cur = this.current;
    if (!cur) return;
    const cands = this.items.map((it, i) => (i !== this.index && this.navigable(it) ? worldPos(it) : null));
    let i = pickSpatial(worldPos(cur), cands, dir);
    if (i < 0 && this.opts.wrap) {
      const n = this.items.length;
      const step = dir === 'down' || dir === 'right' ? 1 : -1;
      for (let k = 1; k < n && i < 0; k++) {
        const j = (this.index + step * k + n * k) % n;
        if (this.navigable(this.items[j])) i = j;
      }
    }
    if (i >= 0) this.focus(i);
  }

  focus(i: number): void {
    if (i === this.index) { this.sync(); return; }
    this.index = i;
    audio.playSfx('uiMove');
    this.sync();
  }

  sync(): void {
    this.items.forEach((it, i) => {
      if (i !== this.index && it.hovered) it.hovered = false; // keyboard and mouse share one focus
      it.setFocused(i === this.index);
    });
  }

  private usable(it: T): boolean {
    return it.visible !== false && it.enabled !== false;
  }

  private navigable(it: T): boolean {
    return it.visible !== false && (this.opts.skipDisabled === false || it.enabled !== false);
  }

  private bind(): void {
    if (this.bound) return;
    this.scene.input.keyboard?.on('keydown', this.keyHandler);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.bound = true;
  }

  private unbind(): void {
    if (!this.bound) return;
    this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.bound = false;
  }
}
