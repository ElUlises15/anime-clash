import Phaser from 'phaser';
import { GAME_W, SCENES } from '../sceneData';
import { audio } from '../../audio/AudioEngine';
import { attachArcadeBackground, markUi } from '../backdrop';
import { playIntroWipe, goTo } from '../transitions';
import {
  ArcadeButton, Slider, ToggleRow, arcadeText, hintBar, slantPanel, bodyText, fillPara, strokePara,
} from '../widgets';
import { FocusNav, type Focusable } from '../focusNav';
import { settings, setVolume, setShowHitboxes } from '../settings';
import {
  ACTION_LABELS, BINDING_ORDER, RESERVED_CODES, assignPrimary, getCodes, keyLabel, resetBindings, type KeySetId,
} from '../../game/input/bindings';
import type { ButtonName } from '../../game/input/buttons';
import { C, HEX } from '../theme';

const SET_LABEL: Record<KeySetId, string> = { p1keys: 'P1', p2keys: 'P2' };

/** One clickable key cell of the controls table (shows the action's keys; activate = remap). */
class KeyCell extends Phaser.GameObjects.Container {
  focused = false;
  hovered = false;
  waiting = false;
  private g: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  private bw = 300;
  private bh = 40;

  constructor(
    scene: Phaser.Scene, x: number, y: number,
    readonly set: KeySetId, readonly action: ButtonName, private onPick: (cell: KeyCell) => void,
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.txt = bodyText(scene, 0, 0, '', 20, HEX.cream, 0.5);
    this.add([this.g, this.txt]);
    this.setSize(this.bw, this.bh);
    this.setInteractive(new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.on('pointerout', () => { this.hovered = false; this.redraw(); });
    this.on('pointerup', () => this.activate());
    this.refresh();
    scene.add.existing(this);
  }

  activate(): void { this.onPick(this); }

  setFocused(v: boolean): this { this.focused = v; this.redraw(); return this; }

  setWaiting(v: boolean): void { this.waiting = v; this.refresh(); }

  refresh(): void {
    const codes = getCodes(this.set, this.action);
    const label = this.waiting ? 'Pulsa una tecla...' : codes.length ? codes.map(keyLabel).join('  /  ') : '— sin asignar —';
    this.txt.setText(label).setFontSize(label.length > 26 ? 15 : 20);
    this.redraw();
  }

  private redraw(): void {
    const hot = this.focused || this.hovered || this.waiting;
    const accent = this.set === 'p1keys' ? C.p1 : C.p2;
    this.g.clear();
    fillPara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, 10, this.waiting ? 0x2a1e08 : hot ? 0x1a1430 : 0x101018, hot ? 0.95 : 0.7);
    strokePara(this.g, -this.bw / 2, -this.bh / 2, this.bw, this.bh, 10, this.waiting ? C.gold : hot ? accent : 0x3a415c, hot ? 3 : 1, 1);
    const empty = getCodes(this.set, this.action).length === 0;
    this.txt.setColor(this.waiting ? HEX.gold : hot ? HEX.white : empty ? HEX.dim : this.set === 'p1keys' ? HEX.cyan : HEX.magenta);
  }
}

type NavItem = Focusable & Phaser.GameObjects.GameObject;

export class SettingsScene extends Phaser.Scene {
  private nav!: FocusNav<NavItem>;
  private cells: KeyCell[] = [];
  private capture: KeyCell | null = null;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.Settings);
  }

  create(): void {
    this.capture = null;
    this.cells = [];
    playIntroWipe(this, 'wipe');
    attachArcadeBackground(this, 'settings');
    audio.music('menu');

    arcadeText(this, GAME_W / 2, 64, 'SETTINGS', 60, HEX.gold).setLetterSpacing(8);
    arcadeText(this, GAME_W / 2, 114, 'AUDIO  ·  CONTROLES  ·  DEBUG', 20, HEX.cyan, { stroke: 4 });

    // ---- audio / debug column
    const ax = 440;
    slantPanel(this, 90, 170, 700, 470, { accent: C.gold, skew: 24, alpha: 0.7 });
    arcadeText(this, ax, 205, 'AUDIO', 28, HEX.gold, { stroke: 5 });
    const master = asNav(new Slider(this, ax, 270, 'MASTER', settings.master, (v) => setVolume('master', v)));
    const music = asNav(new Slider(this, ax, 350, 'MÚSICA', settings.music, (v) => setVolume('music', v)));
    const sfx = asNav(new Slider(this, ax, 430, 'SFX', settings.sfx, (v) => setVolume('sfx', v)));
    const boxes = asNav(new ToggleRow(this, ax, 540, 'MOSTRAR HITBOXES (DEBUG)', settings.showHitboxes, (v) => setShowHitboxes(v)));

    // ---- controls table
    slantPanel(this, 800, 170, 1040, 760, { accent: C.cyan, skew: 28, alpha: 0.78 });
    arcadeText(this, 1320, 205, 'CONTROLES  ·  click o ENTER para cambiar una tecla', 24, HEX.cyan, { stroke: 5 });
    const colAction = 960;
    const colX: Record<KeySetId, number> = { p1keys: 1290, p2keys: 1630 };
    arcadeText(this, colAction, 250, 'ACCIÓN', 20, HEX.dim, { stroke: 4 });
    arcadeText(this, colX.p1keys, 250, 'P1', 22, HEX.cyan, { stroke: 4 });
    arcadeText(this, colX.p2keys, 250, 'P2', 22, HEX.magenta, { stroke: 4 });
    BINDING_ORDER.forEach((name, i) => {
      const y = 292 + i * 48;
      bodyText(this, colAction, y, ACTION_LABELS[name], 20, '#e8e4f4', 0.5);
      for (const set of ['p1keys', 'p2keys'] as KeySetId[]) {
        this.cells.push(new KeyCell(this, colX[set], y, set, name, (c) => this.startCapture(c)));
      }
    });
    const notesY = 292 + BINDING_ORDER.length * 48 + 2;
    bodyText(this, 1320, notesY, 'Dash: también doble tap ← / →   ·   Especial 1 + Especial 2 a la vez = Ultimate   ·   H en combate: ayuda', 16, HEX.dim, 0.5)
      .setWordWrapWidth(980);
    const resetP1 = asNav(new ArcadeButton(this, colX.p1keys, notesY + 50, 'RESTABLECER P1', () => this.reset('p1keys'), { w: 300, h: 48, size: 22 }));
    const resetP2 = asNav(new ArcadeButton(this, colX.p2keys, notesY + 50, 'RESTABLECER P2', () => this.reset('p2keys'), { w: 300, h: 48, size: 22, accent: 'magenta' }));

    this.status = arcadeText(this, 440, 700, '', 22, HEX.orange, { stroke: 5 });
    this.status.setWordWrapWidth(620);

    const back = asNav(new ArcadeButton(this, GAME_W / 2, 990, 'VOLVER', () => this.back(), {
      w: 360, h: 58, accent: 'gold', size: 28,
    }));

    const cellsByRow: NavItem[] = this.cells.map((c) => c as unknown as NavItem);
    this.nav = new FocusNav<NavItem>(this, [master, music, sfx, boxes, ...cellsByRow, resetP1, resetP2, back], {
      keyboard: false,
      onBack: () => this.back(),
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    // Clicking anywhere cancels a pending capture (the clicked element then acts normally).
    this.input.on('pointerdown', () => { if (this.capture) this.endCapture('Cambio cancelado.'); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.nav.destroy());

    hintBar(this, 'FLECHAS / WASD mover  ·  ← → volumen  ·  ENTER / ESPACIO / CLICK elegir  ·  ESC / RETROCESO volver');
    markUi(SCENES.Settings, this);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.capture) {
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'Backspace') { audio.playSfx('uiBack'); this.endCapture('Cambio cancelado.'); return; }
      if (RESERVED_CODES.includes(e.code)) { this.status.setText(`${keyLabel(e.code)} está reservada (menús / pausa / ayuda). Probá otra.`); return; }
      const cell = this.capture;
      const conflicts = assignPrimary(cell.set, cell.action, e.code);
      audio.playSfx('uiConfirm');
      let msg = `${SET_LABEL[cell.set]} ${ACTION_LABELS[cell.action]} → ${keyLabel(e.code)}`;
      if (conflicts.length) {
        msg += '\n' + conflicts.map((c) => {
          const left = getCodes(c.set, c.name);
          return `(quitada de ${SET_LABEL[c.set]} ${ACTION_LABELS[c.name]}${left.length ? ` → ahora ${left.map(keyLabel).join(' / ')}` : ' → sin asignar'})`;
        }).join('\n');
      }
      this.endCapture(msg);
      return;
    }
    if (this.nav.handleKey(e)) e.preventDefault();
  }

  private startCapture(cell: KeyCell): void {
    if (this.capture === cell) return;
    this.capture?.setWaiting(false);
    this.capture = cell;
    const i = this.nav.items.indexOf(cell as unknown as NavItem);
    if (i >= 0) this.nav.focus(i);
    cell.setWaiting(true);
    audio.playSfx('uiConfirm');
    this.status.setText(`${SET_LABEL[cell.set]} ${ACTION_LABELS[cell.action]}: pulsa una tecla... (ESC cancela)`);
  }

  private endCapture(msg: string): void {
    const cell = this.capture;
    this.capture = null;
    cell?.setWaiting(false);
    for (const c of this.cells) c.refresh();
    this.status.setText(msg);
  }

  private reset(set: KeySetId): void {
    if (this.capture) this.endCapture('');
    resetBindings(set);
    for (const c of this.cells) c.refresh();
    this.status.setText(`Controles de ${SET_LABEL[set]} restablecidos.`);
  }

  private back(): void {
    if (this.capture) { this.endCapture('Cambio cancelado.'); return; }
    goTo(this, SCENES.Title, undefined, 'wipe');
  }
}

/** Give sliders / toggles the Focusable surface (activate + ←/→ nudge). */
function asNav<T extends Slider | ToggleRow | ArcadeButton>(row: T): NavItem {
  const r = row as unknown as NavItem;
  if (row instanceof Slider) {
    r.activate = () => {};
    r.onNudge = (d) => { row.nudge(d * 0.05); return true; };
  } else if (row instanceof ToggleRow) {
    r.activate = () => row.toggle();
  }
  return r;
}
