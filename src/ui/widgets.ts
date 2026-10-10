import Phaser from 'phaser';
import { audio } from '../audio/AudioEngine';
import { GAME_W, GAME_H } from './sceneData';
import { C, DEPTH, FONT, FONT_UI, HEX } from './theme';

export function arcadeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  msg: string,
  size: number,
  color: string = HEX.cream,
  opts?: { origin?: number | [number, number]; stroke?: number; shadow?: boolean; italic?: boolean; align?: string },
): Phaser.GameObjects.Text {
  const origin = opts?.origin ?? 0.5;
  const ox = Array.isArray(origin) ? origin[0] : origin;
  const oy = Array.isArray(origin) ? origin[1] : origin;
  const t = scene.add.text(x, y, msg, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: opts?.italic === false ? 'normal' : 'italic',
    color,
    stroke: HEX.ink,
    strokeThickness: opts?.stroke ?? Math.max(4, Math.round(size * 0.14)),
    align: opts?.align ?? 'center',
  }).setOrigin(ox, oy);
  if (opts?.shadow !== false) {
    t.setShadow(2, 3, '#000000', Math.max(2, size * 0.08), true, true);
  }
  t.setLetterSpacing(Math.max(0, Math.round(size * 0.04)));
  return t;
}

export function bodyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  msg: string,
  size: number,
  color: string = HEX.dim,
  origin: number | [number, number] = 0,
): Phaser.GameObjects.Text {
  const ox = Array.isArray(origin) ? origin[0] : origin;
  const oy = Array.isArray(origin) ? origin[1] : origin;
  return scene.add.text(x, y, msg, {
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    color,
    wordWrap: { width: 520 },
  }).setOrigin(ox, oy);
}

export function fillPara(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, skew: number,
  color: number, alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillPoints([
    { x: x + skew, y },
    { x: x + w, y },
    { x: x + w - skew, y: y + h },
    { x: x, y: y + h },
  ], true);
}

export function strokePara(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, skew: number,
  color: number, thickness = 2, alpha = 1,
): void {
  g.lineStyle(thickness, color, alpha);
  g.strokePoints([
    { x: x + skew, y },
    { x: x + w, y },
    { x: x + w - skew, y: y + h },
    { x: x, y: y + h },
  ], true);
}

const ACCENT: Record<string, number> = {
  cyan: C.cyan,
  magenta: C.magenta,
  gold: C.gold,
  orange: C.orange,
};

export class ArcadeButton extends Phaser.GameObjects.Container {
  readonly label: string;
  focused = false;
  enabled = true;
  hovered = false;
  private g: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Image;
  private txt: Phaser.GameObjects.Text;
  private marker: Phaser.GameObjects.Text;
  private onActivate: () => void;
  bw: number;
  bh: number;
  accent: number;
  private skew = 22;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onActivate: () => void,
    opts?: { w?: number; h?: number; accent?: keyof typeof ACCENT; size?: number },
  ) {
    super(scene, x, y);
    this.label = label;
    this.onActivate = onActivate;
    this.bw = opts?.w ?? 520;
    this.bh = opts?.h ?? 64;
    this.accent = ACCENT[opts?.accent ?? 'cyan'] ?? C.cyan;

    this.glow = scene.add.image(0, 0, 'ui-glow-cyan').setAlpha(0).setScale(this.bw / 90, this.bh / 70);
    this.g = scene.add.graphics();
    this.txt = arcadeText(scene, 8, 1, label, opts?.size ?? 32, HEX.cream, { origin: 0.5, stroke: 6 });
    this.marker = arcadeText(scene, -this.bw * 0.38, 0, '▶', 28, HEX.cyan, { origin: 0.5, stroke: 4 }).setAlpha(0);

    this.add([this.glow, this.g, this.txt, this.marker]);
    this.setSize(this.bw, this.bh);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input!.cursor = 'pointer';

    this.on('pointerover', () => {
      if (!this.enabled) return;
      this.hovered = true;
      this.emit('hover');
      this.redraw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.redraw();
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.setScale(0.98);
    });
    this.on('pointerup', () => {
      this.setScale(this.focused ? 1.04 : 1);
      if (this.enabled) this.activate();
    });

    this.redraw();
    scene.add.existing(this);
  }

  setFocused(v: boolean): this {
    if (this.focused === v) {
      this.redraw();
      return this;
    }
    this.focused = v;
    this.setScale(v ? 1.04 : 1);
    this.redraw();
    return this;
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.setAlpha(v ? 1 : 0.4);
    return this;
  }

  setLabel(s: string): this {
    this.txt.setText(s);
    return this;
  }

  activate(): void {
    if (!this.enabled) return;
    audio.playSfx('uiConfirm');
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 70,
      yoyo: true,
    });
    this.onActivate();
  }

  redraw(): void {
    const hot = (this.focused || this.hovered) && this.enabled;
    const col = hot ? this.accent : 0x3a415c;
    this.g.clear();
    fillPara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, this.skew, 0x101018, hot ? 0.94 : 0.82);
    // inner fill
    fillPara(this.g, -this.bw / 2 + 6, -this.bh / 2 + 5, this.bw - 12, this.bh - 10, this.skew - 4, hot ? 0x1a1430 : 0x12101c, 0.95);
    strokePara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, this.skew, col, hot ? 3 : 2, 1);
    if (hot) {
      strokePara(this.g, -this.bw / 2 + 4, -this.bh / 2 + 3, this.bw - 8, this.bh - 6, this.skew - 3, C.white, 1, 0.25);
    }
    this.glow.setTint(this.accent).setAlpha(hot ? 0.55 : 0);
    this.marker.setAlpha(hot ? 1 : 0).setColor(hot ? HEX.gold : HEX.cyan);
    this.txt.setColor(hot ? HEX.white : HEX.cream);
  }
}

export class MenuController {
  buttons: ArcadeButton[] = [];
  index = 0;
  private onBack?: () => void;
  private keyHandler: (e: KeyboardEvent) => void;
  private scene: Phaser.Scene;
  private bound = false;
  horizontal = false;

  constructor(scene: Phaser.Scene, buttons: ArcadeButton[], opts?: { onBack?: () => void; horizontal?: boolean }) {
    this.scene = scene;
    this.onBack = opts?.onBack;
    this.horizontal = !!opts?.horizontal;
    this.keyHandler = (e) => this.onKey(e);
    this.setButtons(buttons);
    this.bind();
  }

  setButtons(buttons: ArcadeButton[]): void {
    this.buttons = buttons;
    this.index = Phaser.Math.Clamp(this.index, 0, Math.max(0, buttons.length - 1));
    for (const b of buttons) {
      b.off('hover');
      b.on('hover', () => {
        const i = this.buttons.indexOf(b);
        if (i >= 0) this.moveTo(i);
      });
    }
    this.sync(false);
  }

  destroy(): void {
    this.unbind();
  }

  private bind(): void {
    if (this.bound) return;
    this.scene.input.keyboard?.on('keydown', this.keyHandler);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbind());
    this.bound = true;
  }

  private unbind(): void {
    if (!this.bound) return;
    this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.bound = false;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const c = e.code;
    const vert = !this.horizontal;
    if ((vert && (c === 'ArrowDown' || c === 'KeyS')) || (!vert && (c === 'ArrowRight' || c === 'KeyD'))) {
      this.moveBy(1);
    } else if ((vert && (c === 'ArrowUp' || c === 'KeyW')) || (!vert && (c === 'ArrowLeft' || c === 'KeyA'))) {
      this.moveBy(-1);
    } else if (c === 'Enter' || c === 'Space' || c === 'KeyJ' || c === 'NumpadEnter') {
      this.buttons[this.index]?.activate();
    } else if (c === 'Escape' || c === 'KeyK') {
      audio.playSfx('uiBack');
      this.onBack?.();
    }
  }

  moveBy(d: number): void {
    if (!this.buttons.length) return;
    const n = this.buttons.length;
    this.moveTo((this.index + d + n) % n);
  }

  moveTo(i: number): void {
    if (i === this.index) {
      this.sync(false);
      return;
    }
    this.index = i;
    audio.playSfx('uiMove');
    this.sync(true);
  }

  private sync(_moved: boolean): void {
    this.buttons.forEach((b, i) => b.setFocused(i === this.index));
  }
}

export class Slider extends Phaser.GameObjects.Container {
  value: number;
  focused = false;
  private g: Phaser.GameObjects.Graphics;
  private labelTxt: Phaser.GameObjects.Text;
  private valTxt: Phaser.GameObjects.Text;
  private onChange: (v: number) => void;
  private caption: string;
  bw = 640;
  bh = 56;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: number, onChange: (v: number) => void) {
    super(scene, x, y);
    this.caption = label;
    this.value = value;
    this.onChange = onChange;
    this.g = scene.add.graphics();
    this.labelTxt = arcadeText(scene, -300, 0, label, 26, HEX.cream, { origin: [0, 0.5], stroke: 5 });
    this.valTxt = arcadeText(scene, 300, 0, pct(value), 26, HEX.gold, { origin: [1, 0.5], stroke: 5 });
    this.add([this.g, this.labelTxt, this.valTxt]);
    this.setSize(this.bw, this.bh);
    this.setInteractive(new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerdown', (p: Phaser.Input.Pointer) => this.scrub(p));
    this.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) this.scrub(p); });
    this.redraw();
    scene.add.existing(this);
  }

  setFocused(v: boolean): this {
    this.focused = v;
    this.redraw();
    return this;
  }

  nudge(d: number): void {
    this.setVal(this.value + d);
  }

  setVal(v: number): void {
    const n = Math.round(Phaser.Math.Clamp(v, 0, 1) * 20) / 20;
    if (n === this.value) return;
    this.value = n;
    this.valTxt.setText(pct(n));
    this.onChange(n);
    audio.playSfx('uiMove');
    this.redraw();
  }

  private scrub(p: Phaser.Input.Pointer): void {
    const local = this.pointToLocal(p);
    // track starts around x=-40, width 280-ish visually; use full lower band
    const trackX0 = -40;
    const trackW = 250;
    const t = Phaser.Math.Clamp((local.x - trackX0) / trackW, 0, 1);
    this.setVal(t);
  }

  private pointToLocal(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const m = this.getWorldTransformMatrix();
    const out = new Phaser.Math.Vector2();
    m.applyInverse(p.worldX, p.worldY, out);
    return out;
  }

  redraw(): void {
    const hot = this.focused;
    this.g.clear();
    fillPara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, 16, 0x101018, hot ? 0.92 : 0.72);
    strokePara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, 16, hot ? C.cyan : 0x3a415c, hot ? 3 : 2);
    // track
    const tx = -40, ty = -8, tw = 250, th = 16, sk = 6;
    fillPara(this.g, tx, ty, tw, th, sk, 0x07060c, 1);
    fillPara(this.g, tx, ty, Math.max(10, tw * this.value), th, sk, hot ? C.cyan : C.gold, 1);
    strokePara(this.g, tx, ty, tw, th, sk, C.white, 1, 0.35);
  }
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export class ToggleRow extends Phaser.GameObjects.Container {
  value: boolean;
  focused = false;
  private g: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  private stateTxt: Phaser.GameObjects.Text;
  private onChange: (v: boolean) => void;
  bw = 640;
  bh = 56;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: boolean, onChange: (v: boolean) => void) {
    super(scene, x, y);
    this.value = value;
    this.onChange = onChange;
    this.g = scene.add.graphics();
    this.txt = arcadeText(scene, -300, 0, label, 26, HEX.cream, { origin: [0, 0.5], stroke: 5 });
    this.stateTxt = arcadeText(scene, 300, 0, value ? 'ON' : 'OFF', 26, value ? HEX.cyan : HEX.dim, { origin: [1, 0.5], stroke: 5 });
    this.add([this.g, this.txt, this.stateTxt]);
    this.setSize(this.bw, this.bh);
    this.setInteractive(new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerup', () => this.toggle());
    this.redraw();
    scene.add.existing(this);
  }

  setFocused(v: boolean): this {
    this.focused = v;
    this.redraw();
    return this;
  }

  toggle(): void {
    this.value = !this.value;
    this.stateTxt.setText(this.value ? 'ON' : 'OFF').setColor(this.value ? HEX.cyan : HEX.dim);
    this.onChange(this.value);
    audio.playSfx('uiConfirm');
    this.redraw();
  }

  redraw(): void {
    this.g.clear();
    fillPara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, 16, 0x101018, this.focused ? 0.92 : 0.72);
    strokePara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, 16, this.focused ? C.magenta : 0x3a415c, this.focused ? 3 : 2);
  }
}

export function showToast(scene: Phaser.Scene, msg: string, ms = 1600): void {
  const g = scene.add.graphics().setDepth(DEPTH.toast).setScrollFactor(0);
  fillPara(g, GAME_W / 2 - 280, 48, 560, 64, 18, 0x101018, 0.94);
  strokePara(g, GAME_W / 2 - 280, 48, 560, 64, 18, C.gold, 3);
  const t = arcadeText(scene, GAME_W / 2, 80, msg, 32, HEX.gold).setDepth(DEPTH.toast).setScrollFactor(0);
  scene.tweens.add({
    targets: [g, t],
    alpha: 0,
    y: '-=20',
    delay: ms,
    duration: 280,
    onComplete: () => { g.destroy(); t.destroy(); },
  });
}

export function showModal(scene: Phaser.Scene, title: string, headline: string, body: string): void {
  audio.playSfx('uiConfirm');
  const root = scene.add.container(0, 0).setDepth(DEPTH.modal).setScrollFactor(0);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.62).setInteractive();
  const g = scene.add.graphics();
  const w = 820, h = 420, x = (GAME_W - w) / 2, y = (GAME_H - h) / 2;
  fillPara(g, x, y, w, h, 36, 0x100c1c, 0.97);
  strokePara(g, x, y, w, h, 36, C.magenta, 4);
  strokePara(g, x + 8, y + 8, w - 16, h - 16, 28, C.cyan, 2, 0.6);
  const t1 = arcadeText(scene, GAME_W / 2, y + 70, title, 46, HEX.gold);
  const t2 = arcadeText(scene, GAME_W / 2, y + 150, headline, 30, HEX.magenta);
  const t3 = bodyText(scene, GAME_W / 2, y + 220, body, 20, HEX.dim, 0.5).setWordWrapWidth(680).setAlign('center');
  const btn = new ArcadeButton(scene, GAME_W / 2, y + h - 80, 'VOLVER', close, { w: 280, h: 56, accent: 'gold', size: 26 });
  root.add([dim, g, t1, t2, t3, btn]);

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'Space') {
      e.stopImmediatePropagation();
      close();
    }
  };
  scene.input.keyboard?.on('keydown', onKey);

  function close(): void {
    audio.playSfx('uiBack');
    scene.input.keyboard?.off('keydown', onKey);
    root.destroy(true);
  }
}

export function hintBar(scene: Phaser.Scene, msg: string): Phaser.GameObjects.Text {
  return arcadeText(scene, GAME_W / 2, GAME_H - 36, msg, 18, HEX.dim, { origin: 0.5, stroke: 4, italic: true });
}

export function slantPanel(
  scene: Phaser.Scene,
  x: number, y: number, w: number, h: number,
  opts?: { accent?: number; alpha?: number; skew?: number; depth?: number },
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(opts?.depth ?? DEPTH.panel);
  const skew = opts?.skew ?? 22;
  fillPara(g, x, y, w, h, skew, 0x0c0a14, opts?.alpha ?? 0.82);
  strokePara(g, x, y, w, h, skew, opts?.accent ?? C.cyan, 2, 0.85);
  return g;
}

/** Clipboard helper shared by online screens, including browsers without Clipboard API. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.select();
  try { return document.execCommand('copy'); } catch { return false; } finally { ta.remove(); }
}

/** Blocking arcade dialog. Capture keyboard events before the underlying Phaser menu. */
export function onlineDialog(scene: Phaser.Scene, title: string, message: string,
  actions: { label: string; run: () => void }[], onCancel?: () => void): () => void {
  const root = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.88).setInteractive();
  root.add(dim);
  root.add(slantPanel(scene, 460, 300, 1000, 480, { accent: C.magenta }));
  root.add(arcadeText(scene, GAME_W / 2, 370, title, 42, HEX.cyan));
  root.add(bodyText(scene, GAME_W / 2, 490, message, 26, HEX.cream, 0.5).setWordWrapWidth(880).setAlign('center'));
  let index = 0; let closed = false;
  const buttons = actions.map((a, i) => new ArcadeButton(scene, GAME_W / 2, 620 + i * 74, a.label,
    () => { close(); a.run(); }, { w: 700, h: 58, size: 24 }));
  root.add(buttons); buttons[0]?.setFocused(true);
  const key = (e: KeyboardEvent) => {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(e.code)) index = (index + 1) % buttons.length;
    else if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(e.code)) index = (index + buttons.length - 1) % buttons.length;
    else if (['Enter', 'KeyJ', 'Space'].includes(e.code)) buttons[index]?.activate();
    else if (['Escape', 'KeyK'].includes(e.code)) { close(); (onCancel ?? actions[actions.length - 1]?.run)?.(); }
    buttons.forEach((b, i) => b.setFocused(i === index));
  };
  window.addEventListener('keydown', key, true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, close);
  function close(): void {
    if (closed) return; closed = true;
    window.removeEventListener('keydown', key, true);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, close);
    root.destroy(true);
  }
  return close;
}
