import Phaser from 'phaser';
import { GAME_W, GAME_H, SCENES } from '../sceneData';
import { audio } from '../../audio/AudioEngine';
import { attachArcadeBackground, markUi } from '../backdrop';
import { playIntroWipe, goTo } from '../transitions';
import {
  ArcadeButton, Slider, ToggleRow, arcadeText, hintBar, slantPanel, bodyText,
} from '../widgets';
import { settings, setVolume, setShowHitboxes } from '../settings';
import { BINDING_ORDER, displayFor } from '../../game/input/bindings';
import { ACTION_LABELS } from '../../game/input/bindings';
import { C, HEX } from '../theme';

type Row = Slider | ToggleRow | ArcadeButton;

export class SettingsScene extends Phaser.Scene {
  private rows: Row[] = [];
  private index = 0;
  private holdDir = 0;
  private holdAcc = 0;

  constructor() {
    super(SCENES.Settings);
  }

  create(): void {
    playIntroWipe(this, 'wipe');
    attachArcadeBackground(this, 'settings');
    audio.music('menu');

    arcadeText(this, GAME_W / 2, 70, 'SETTINGS', 64, HEX.gold).setLetterSpacing(8);
    arcadeText(this, GAME_W / 2, 122, 'AUDIO  ·  CONTROLES  ·  DEBUG', 20, HEX.cyan, { stroke: 4 });

    const cx = GAME_W / 2;
    const master = new Slider(this, cx, 200, 'MASTER', settings.master, (v) => setVolume('master', v));
    const music = new Slider(this, cx, 268, 'MÚSICA', settings.music, (v) => setVolume('music', v));
    const sfx = new Slider(this, cx, 336, 'SFX', settings.sfx, (v) => setVolume('sfx', v));
    const boxes = new ToggleRow(this, cx, 404, 'MOSTRAR HITBOXES (DEBUG)', settings.showHitboxes, (v) => setShowHitboxes(v));
    const back = new ArcadeButton(this, cx, 1000, 'VOLVER', () => goTo(this, SCENES.Title, undefined, 'wipe'), {
      w: 360, h: 58, accent: 'gold', size: 28,
    });

    this.rows = [master, music, sfx, boxes, back];
    this.drawControlsTable();
    this.bindNav();
    this.sync(false);

    hintBar(this, 'W/S seleccionar  ·  A/D o arrastrar volumen  ·  ENTER toggle  ·  ESC volver');
    markUi(SCENES.Settings, this);
  }

  private drawControlsTable(): void {
    slantPanel(this, 180, 460, 1560, 430, { accent: C.cyan, skew: 28, alpha: 0.78 });
    arcadeText(this, GAME_W / 2, 490, 'CONTROLES', 28, HEX.cyan, { stroke: 5 });
    arcadeText(this, 430, 535, 'ACCIÓN', 20, HEX.dim, { origin: 0.5, stroke: 4 });
    arcadeText(this, 900, 535, 'P1', 20, HEX.cyan, { origin: 0.5, stroke: 4 });
    arcadeText(this, 1360, 535, 'P2', 20, HEX.magenta, { origin: 0.5, stroke: 4 });

    BINDING_ORDER.forEach((name, i) => {
      const y = 564 + i * 28;
      const even = i % 2 === 0;
      if (even) {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.03);
        g.fillRect(240, y - 14, 1440, 30);
      }
      bodyText(this, 430, y, ACTION_LABELS[name], 18, '#e8e4f4', 0.5);
      bodyText(this, 900, y, displayFor('p1keys', name), 18, HEX.cyan, 0.5);
      bodyText(this, 1360, y, displayFor('p2keys', name), 18, HEX.magenta, 0.5);
    });
  }

  private bindNav(): void {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat && (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD')) {
        return; // handled in update via hold
      }
      const c = e.code;
      if (c === 'ArrowDown' || c === 'KeyS') this.move(1);
      else if (c === 'ArrowUp' || c === 'KeyW') this.move(-1);
      else if (c === 'ArrowLeft' || c === 'KeyA') this.nudge(-0.05);
      else if (c === 'ArrowRight' || c === 'KeyD') this.nudge(0.05);
      else if (c === 'Enter' || c === 'Space' || c === 'KeyJ' || c === 'NumpadEnter') this.activate();
      else if (c === 'Escape' || c === 'KeyK') goTo(this, SCENES.Title, undefined, 'wipe');
    });

    this.input.keyboard?.on('keydown-LEFT', () => { this.holdDir = -1; this.holdAcc = 0; });
    this.input.keyboard?.on('keydown-RIGHT', () => { this.holdDir = 1; this.holdAcc = 0; });
    this.input.keyboard?.on('keydown-A', () => { this.holdDir = -1; this.holdAcc = 0; });
    this.input.keyboard?.on('keydown-D', () => { this.holdDir = 1; this.holdAcc = 0; });
    this.input.keyboard?.on('keyup-LEFT', () => { if (this.holdDir < 0) this.holdDir = 0; });
    this.input.keyboard?.on('keyup-RIGHT', () => { if (this.holdDir > 0) this.holdDir = 0; });
    this.input.keyboard?.on('keyup-A', () => { if (this.holdDir < 0) this.holdDir = 0; });
    this.input.keyboard?.on('keyup-D', () => { if (this.holdDir > 0) this.holdDir = 0; });

    for (const row of this.rows) {
      row.on('pointerover', () => {
        const i = this.rows.indexOf(row);
        if (i >= 0 && i !== this.index) this.moveTo(i);
      });
    }
  }

  update(_t: number, dt: number): void {
    if (!this.holdDir) return;
    const row = this.rows[this.index];
    if (!(row instanceof Slider)) return;
    this.holdAcc += dt;
    if (this.holdAcc > 280) {
      row.nudge(this.holdDir * 0.05);
      this.holdAcc = 200;
    }
  }

  private move(d: number): void {
    this.moveTo((this.index + d + this.rows.length) % this.rows.length);
  }

  private moveTo(i: number): void {
    if (i === this.index) { this.sync(false); return; }
    this.index = i;
    audio.playSfx('uiMove');
    this.sync(true);
  }

  private sync(_m: boolean): void {
    this.rows.forEach((r, i) => {
      if ('setFocused' in r) (r as Slider | ToggleRow | ArcadeButton).setFocused(i === this.index);
    });
  }

  private nudge(d: number): void {
    const row = this.rows[this.index];
    if (row instanceof Slider) row.nudge(d);
  }

  private activate(): void {
    const row = this.rows[this.index];
    if (row instanceof ToggleRow) row.toggle();
    else if (row instanceof ArcadeButton) row.activate();
  }
}
