import Phaser from 'phaser';
import type { CharacterDef } from '../characters/types';
import type { MatchState, SimEvent } from '../game/sim/types';
import { ENERGY_MAX, ULT_MAX, ROUNDS_TO_WIN } from '../game/sim/types';
import type { GameMode } from './sceneData';
import { GAME_W } from './sceneData';
import { C, DEPTH, FONT, HEX } from './theme';
import { arcadeText, fillPara, strokePara } from './widgets';
import { makePortraitTexture } from './portraitAdapter';

export interface HudExtra {
  ping?: number | null;
  fps?: number;
  training?: {
    dummyMode: string;
    lastDamage: number;
    comboDamage: number;
    regen: boolean;
  };
}

/**
 * Fight HUD. The Fight scene instantiates this on a dedicated HUD camera / layer.
 * Layout is in logical 1920×1080 space; Scale.FIT keeps it readable at 1366×768.
 */
export class Hud {
  private scene: Phaser.Scene;
  private defs: [CharacterDef, CharacterDef];
  private mode: GameMode;
  private root: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private names: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private timer: Phaser.GameObjects.Text;
  private announcer: Phaser.GameObjects.Text;
  private combo: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private comboDmg: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private ultReady: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private pingTxt: Phaser.GameObjects.Text;
  private trainTxt?: Phaser.GameObjects.Text;
  private pips: [Phaser.GameObjects.Image[], Phaser.GameObjects.Image[]];
  private portraits: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private hp: [number, number] = [1, 1];
  private trail: [number, number] = [1, 1];
  private comboHold: [number, number] = [0, 0];
  private comboShown: [number, number] = [0, 0];
  private lastPhase = '';
  private lastRound = 0;
  private announceUntil = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, defs: [CharacterDef, CharacterDef], opts: { mode: GameMode }) {
    this.scene = scene;
    this.defs = defs;
    this.mode = opts.mode;
    this.root = scene.add.container(0, 0).setDepth(DEPTH.hud).setScrollFactor(0);
    this.g = scene.add.graphics().setScrollFactor(0);
    this.root.add(this.g);

    const p1k = makePortraitTexture(scene, defs[0], `hud-p1-${defs[0].id}`, 96);
    const p2k = makePortraitTexture(scene, defs[1], `hud-p2-${defs[1].id}`, 96);
    this.portraits = [
      scene.add.image(70, 78, p1k).setDisplaySize(88, 88).setScrollFactor(0),
      scene.add.image(GAME_W - 70, 78, p2k).setDisplaySize(88, 88).setFlipX(true).setScrollFactor(0),
    ];
    this.root.add(this.portraits);

    this.names = [
      arcadeText(scene, 128, 28, defs[0].name.toUpperCase(), 26, HEX.cyan, { origin: [0, 0.5], stroke: 5 }),
      arcadeText(scene, GAME_W - 128, 28, defs[1].name.toUpperCase(), 26, HEX.magenta, { origin: [1, 0.5], stroke: 5 }),
    ];
    this.root.add(this.names);

    this.timer = arcadeText(scene, GAME_W / 2, 42, '99', 64, HEX.gold, { stroke: 8 });
    this.root.add(this.timer);

    this.announcer = arcadeText(scene, GAME_W / 2, 420, '', 96, HEX.gold, { stroke: 12 }).setAlpha(0);
    this.root.add(this.announcer);

    this.combo = [
      arcadeText(scene, 260, 250, '', 42, HEX.cyan, { origin: [0, 0.5], stroke: 6 }).setAlpha(0),
      arcadeText(scene, GAME_W - 260, 250, '', 42, HEX.magenta, { origin: [1, 0.5], stroke: 6 }).setAlpha(0),
    ];
    this.comboDmg = [
      arcadeText(scene, 260, 292, '', 22, HEX.gold, { origin: [0, 0.5], stroke: 4 }).setAlpha(0),
      arcadeText(scene, GAME_W - 260, 292, '', 22, HEX.gold, { origin: [1, 0.5], stroke: 4 }).setAlpha(0),
    ];
    this.root.add([...this.combo, ...this.comboDmg]);

    this.ultReady = [
      arcadeText(scene, 360, 168, 'ULT READY', 18, HEX.gold, { origin: 0.5, stroke: 4 }).setAlpha(0),
      arcadeText(scene, GAME_W - 360, 168, 'ULT READY', 18, HEX.gold, { origin: 0.5, stroke: 4 }).setAlpha(0),
    ];
    this.root.add(this.ultReady);

    this.pips = [[], []];
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < ROUNDS_TO_WIN; i++) {
        const x = s === 0 ? 132 + i * 34 : GAME_W - 132 - i * 34;
        const img = scene.add.image(x, 168, 'ui-pip-off').setScrollFactor(0);
        this.pips[s].push(img);
        this.root.add(img);
      }
    }

    this.pingTxt = arcadeText(scene, GAME_W - 24, 1060, '', 16, HEX.dim, { origin: [1, 1], stroke: 3 });
    this.root.add(this.pingTxt);
    if (this.mode !== 'online') this.pingTxt.setVisible(false);

    if (this.mode === 'training') {
      this.trainTxt = arcadeText(scene, 24, 860, '', 18, HEX.cream, { origin: [0, 0], stroke: 4, italic: false });
      this.trainTxt.setFontFamily(FONT).setAlpha(0.95);
      this.root.add(this.trainTxt);
    }

    this.drawFrame();
  }

  update(state: MatchState, extra?: HudExtra): void {
    if (this.destroyed) return;
    const [a, b] = state.fighters;
    this.hp[0] = a.maxHp > 0 ? Phaser.Math.Clamp(a.hp / a.maxHp, 0, 1) : 0;
    this.hp[1] = b.maxHp > 0 ? Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1) : 0;
    for (let i = 0; i < 2; i++) {
      if (this.hp[i] > this.trail[i]) this.trail[i] = this.hp[i];
      else this.trail[i] += (this.hp[i] - this.trail[i]) * 0.08;
      if (Math.abs(this.trail[i] - this.hp[i]) < 0.002) this.trail[i] = this.hp[i];
    }

    this.drawBars(state);
    this.updateTimer(state);
    this.updatePips(state);
    this.updateCombo(state);
    this.updateUltReady(state);
    this.updateAnnouncer(state);
    this.updatePing(extra);
    this.updateTraining(extra);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.root.destroy(true);
  }

  private drawFrame(): void {
    // portrait frames
    const g = this.g;
    g.lineStyle(3, C.cyan, 1);
    g.strokeRect(26, 34, 88, 88);
    g.lineStyle(3, C.magenta, 1);
    g.strokeRect(GAME_W - 114, 34, 88, 88);
  }

  private drawBars(state: MatchState): void {
    const g = this.g;
    g.clear();
    this.drawFrame();

    this.sideBar(0, this.hp[0], this.trail[0], state.fighters[0].energy, state.fighters[0].ult);
    this.sideBar(1, this.hp[1], this.trail[1], state.fighters[1].energy, state.fighters[1].ult);
  }

  private sideBar(side: 0 | 1, hp: number, trail: number, energy: number, ult: number): void {
    const g = this.g;
    const p1 = side === 0;
    const barW = 620;
    const x = p1 ? 128 : GAME_W - 128 - barW;
    const skew = p1 ? 16 : -16;
    const yHp = 50;
    const yEn = 92;
    const yUlt = 118;

    const draw = (y: number, h: number, fill: number, color: number, trailAmt?: number, trailCol?: number) => {
      fillPara(g, x, y, barW, h, skew, 0x0a0810, 0.92);
      if (trailAmt !== undefined && trailCol !== undefined && trailAmt > fill) {
        const tw = Math.max(4, barW * trailAmt);
        const tx = p1 ? x : x + (barW - tw);
        fillPara(g, tx, y, tw, h, skew, trailCol, 0.85);
      }
      const fw = Math.max(0, barW * fill);
      if (fw > 1) {
        const fx = p1 ? x : x + (barW - fw);
        fillPara(g, fx, y, fw, h, skew, color, 1);
      }
      strokePara(g, x, y, barW, h, skew, p1 ? C.cyan : C.magenta, 2, 0.9);
    };

    draw(yHp, 28, hp, C.hp, trail, C.hpTrail);

    // energy segments
    const segs = 5;
    const gap = 6;
    const segW = (barW - gap * (segs - 1)) / segs;
    const ratio = Phaser.Math.Clamp(energy / ENERGY_MAX, 0, 1);
    for (let i = 0; i < segs; i++) {
      const si = p1 ? i : segs - 1 - i;
      const sx = x + si * (segW + gap);
      const filled = ratio * segs - i;
      fillPara(g, sx, yEn, segW, 14, 6, 0x0a0810, 0.92);
      if (filled > 0) {
        fillPara(g, sx, yEn, segW * Phaser.Math.Clamp(filled, 0, 1), 14, 6, C.energy, 1);
      }
      strokePara(g, sx, yEn, segW, 14, 6, C.cyan, 1, 0.5);
    }

    const ur = Phaser.Math.Clamp(ult / ULT_MAX, 0, 1);
    const ultCol = ur >= 1 ? C.gold : 0xaa7820;
    draw(yUlt, 10, ur, ultCol);
  }

  private updateTimer(state: MatchState): void {
    if (this.mode === 'training' || state.config.mode === 'training') {
      this.timer.setText('∞');
      return;
    }
    const sec = Math.max(0, Math.ceil(state.timerFrames / 60));
    this.timer.setText(String(sec).padStart(2, '0'));
    this.timer.setColor(sec <= 10 ? HEX.magenta : HEX.gold);
  }

  private updatePips(state: MatchState): void {
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < this.pips[s].length; i++) {
        this.pips[s][i].setTexture(i < state.roundWins[s] ? 'ui-pip-on' : 'ui-pip-off');
      }
    }
  }

  private updateCombo(state: MatchState): void {
    // Attacker's combo = defender.comboTaken
    const hits: [number, number] = [state.fighters[1].comboTaken, state.fighters[0].comboTaken];
    const dmg: [number, number] = [state.fighters[1].comboDamage, state.fighters[0].comboDamage];
    for (let i = 0; i < 2; i++) {
      if (hits[i] >= 2) {
        if (hits[i] !== this.comboShown[i]) {
          this.combo[i].setScale(1.2);
          this.scene.tweens.add({ targets: this.combo[i], scale: 1, duration: 120 });
        }
        this.comboHold[i] = 45;
        this.comboShown[i] = hits[i];
        this.combo[i].setText(`${hits[i]} HITS!`).setAlpha(1);
        this.comboDmg[i].setText(`${dmg[i]} DMG`).setAlpha(1);
      } else if (this.comboHold[i] > 0) {
        this.comboHold[i] -= 1;
        if (this.comboHold[i] <= 0) {
          this.scene.tweens.add({ targets: [this.combo[i], this.comboDmg[i]], alpha: 0, duration: 280 });
        }
      }
    }
  }

  private updateUltReady(state: MatchState): void {
    for (let i = 0; i < 2; i++) {
      const ready = state.fighters[i].ult >= ULT_MAX;
      const t = this.ultReady[i];
      if (ready) {
        t.setAlpha(0.7 + Math.sin(this.scene.time.now / 180) * 0.3);
      } else {
        t.setAlpha(0);
      }
    }
  }

  private updateAnnouncer(state: MatchState): void {
    const evs = state.events ?? [];
    for (const ev of evs) this.flashFromEvent(ev, state);

    const key = `${state.phase}:${state.round}`;
    if (key !== `${this.lastPhase}:${this.lastRound}`) {
      if (state.phase === 'intro' && state.phaseFrame < 8) {
        this.flash(`ROUND ${state.round}`, HEX.cream);
      }
      if (state.phase === 'ko') {
        const perfect = (() => {
          const w = state.winner;
          if (w !== 0 && w !== 1) return false;
          const f = state.fighters[w];
          return f.hp >= f.maxHp;
        })();
        this.flash(perfect ? 'PERFECT' : 'K.O.', HEX.magenta);
      }
      if (state.phase === 'matchEnd') {
        const w = state.winner;
        const msg = w === 0 ? 'P1 WINS' : w === 1 ? 'P2 WINS' : 'DRAW';
        this.flash(msg, HEX.gold);
      }
      this.lastPhase = state.phase;
      this.lastRound = state.round;
    }
  }

  private flashFromEvent(ev: SimEvent, state: MatchState): void {
    switch (ev.type) {
      case 'roundStart':
        this.flash(`ROUND ${state.round}`, HEX.cream);
        break;
      case 'fight':
        this.flash('FIGHT!', HEX.gold);
        break;
      case 'ko':
        this.flash('K.O.', HEX.magenta);
        break;
      case 'timeUp':
        this.flash('TIME UP', HEX.orange);
        break;
      case 'matchEnd': {
        const w = state.winner;
        this.flash(w === 0 ? 'P1 WINS' : w === 1 ? 'P2 WINS' : 'DRAW', HEX.gold);
        break;
      }
      default:
        break;
    }
  }

  private flash(msg: string, color: string): void {
    this.announcer.setText(msg).setColor(color).setAlpha(1).setScale(1.6);
    this.scene.tweens.killTweensOf(this.announcer);
    this.scene.tweens.add({
      targets: this.announcer,
      scale: 1,
      duration: 180,
      ease: 'Back.out',
    });
    this.scene.tweens.add({
      targets: this.announcer,
      alpha: 0,
      delay: 900,
      duration: 320,
    });
    this.announceUntil = this.scene.time.now + 1200;
    void this.announceUntil;
  }

  private updatePing(extra?: HudExtra): void {
    if (this.mode !== 'online') return;
    if (!extra || extra.ping === undefined) {
      this.pingTxt.setText('-- ms');
      return;
    }
    if (extra.ping === null) this.pingTxt.setText('-- ms');
    else this.pingTxt.setText(`${Math.round(extra.ping)} ms`);
  }

  private updateTraining(extra?: HudExtra): void {
    if (!this.trainTxt) return;
    const t = extra?.training;
    const dummy = (t?.dummyMode ?? 'idle').toUpperCase();
    const last = t?.lastDamage ?? 0;
    const combo = t?.comboDamage ?? 0;
    const regen = t?.regen ? 'ON' : 'OFF';
    const fps = extra?.fps !== undefined ? `  FPS ${Math.round(extra.fps)}` : '';
    this.trainTxt.setText(
      `TRAINING\nDUMMY  ${dummy}\nLAST HIT  ${last}\nCOMBO DMG  ${combo}\nREGEN  ${regen}${fps}\nF1 dummy   F2 regen   F3 / BKSP reset`,
    );
  }
}
