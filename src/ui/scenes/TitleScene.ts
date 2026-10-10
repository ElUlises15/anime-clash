import Phaser from 'phaser';
import { GAME_W, GAME_H, SCENES } from '../sceneData';
import { audio } from '../../audio/AudioEngine';
import { attachArcadeBackground, markUi } from '../backdrop';
import { playIntroWipe, goTo } from '../transitions';
import { ArcadeButton, MenuController, arcadeText, hintBar } from '../widgets';
import { onlineHandlers } from '../online';
import { C, DEPTH, HEX } from '../theme';

export class TitleScene extends Phaser.Scene {
  private menu?: MenuController;
  private mode: 'root' | 'online' = 'root';
  private rootBtns: ArcadeButton[] = [];
  private onlineBtns: ArcadeButton[] = [];
  private onlineLabel?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.Title);
  }

  create(): void {
    playIntroWipe(this);
    attachArcadeBackground(this, 'title');
    audio.music('menu');
    audio.installHooks();

    this.drawDecor();
    this.drawLogo();
    this.buildMenus();

    hintBar(this, 'W/S o flechas · ENTER / J / CLICK confirmar · ESC volver');
    arcadeText(this, 48, GAME_H - 36, 'FASE 1  ·  LOCAL', 16, HEX.dim, { origin: [0, 0.5], stroke: 3 });
    arcadeText(this, GAME_W - 48, GAME_H - 36, '1v1 ARCADE FIGHTER', 16, HEX.dim, { origin: [1, 0.5], stroke: 3 });

    markUi(SCENES.Title, this);
  }

  private drawDecor(): void {
    const slash = this.add.image(GAME_W / 2, 310, 'ui-slash')
      .setDepth(DEPTH.fx)
      .setAlpha(0.55)
      .setScale(14, 1.15)
      .setAngle(-18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(C.magenta);
    this.tweens.add({
      targets: slash,
      alpha: { from: 0.25, to: 0.7 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private drawLogo(): void {
    const halo = this.add.image(GAME_W / 2, 248, 'ui-halo').setScale(5.2, 1.6).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const logo = this.add.image(GAME_W / 2, 250, 'logo-anime-clash').setDepth(DEPTH.fx);
    logo.setScale(0.92);

    this.tweens.add({
      targets: logo,
      scale: { from: 0.90, to: 0.945 },
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.4, to: 0.85 },
      scaleX: { from: 5.0, to: 5.5 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
    });

    this.time.addEvent({
      delay: 2800,
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: logo,
          x: logo.x + 5,
          duration: 40,
          yoyo: true,
          repeat: 5,
          onComplete: () => { logo.x = GAME_W / 2; },
        });
      },
    });

    if (this.textures.exists('ui-particle')) {
      this.add.particles(GAME_W / 2, 250, 'ui-particle', {
        x: { min: -420, max: 420 },
        y: { min: -70, max: 70 },
        lifespan: { min: 700, max: 1600 },
        speed: { min: 20, max: 80 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.9, end: 0 },
        blendMode: 'ADD',
        frequency: 50,
        quantity: 1,
        tint: [C.gold, C.magenta, C.cyan, C.white],
      }).setDepth(DEPTH.fx + 1);
    }

    arcadeText(this, GAME_W / 2, 390, '1v1  ARCADE  FIGHTER', 28, HEX.cyan, { stroke: 6 }).setLetterSpacing(10);
  }

  private buildMenus(): void {
    const startY = 500;
    const gap = 78;
    const cx = GAME_W / 2;

    const online = new ArcadeButton(this, cx, startY, 'ONLINE', () => this.openOnline(), { accent: 'magenta' });
    const local = new ArcadeButton(this, cx, startY + gap, 'LOCAL VS', () => {
      goTo(this, SCENES.Select, { mode: 'versus' });
    }, { accent: 'cyan' });
    const training = new ArcadeButton(this, cx, startY + gap * 2, 'TRAINING', () => {
      goTo(this, SCENES.Select, { mode: 'training' });
    }, { accent: 'orange' });
    const settings = new ArcadeButton(this, cx, startY + gap * 3, 'SETTINGS', () => {
      goTo(this, SCENES.Settings, undefined, 'wipe');
    }, { accent: 'gold' });
    this.rootBtns = [online, local, training, settings];

    this.onlineLabel = arcadeText(this, cx, startY - 70, 'ONLINE', 36, HEX.magenta).setVisible(false);
    const create = new ArcadeButton(this, cx, startY + 10, 'CREATE ROOM', () => onlineHandlers.createRoom(this), { accent: 'magenta' });
    const join = new ArcadeButton(this, cx, startY + 10 + gap, 'JOIN ROOM', () => onlineHandlers.joinRoom(this), { accent: 'cyan' });
    const back = new ArcadeButton(this, cx, startY + 10 + gap * 2, 'VOLVER', () => this.closeOnline(), { accent: 'gold' });
    this.onlineBtns = [create, join, back];
    for (const b of this.onlineBtns) b.setVisible(false).setActive(false);

    this.menu = new MenuController(this, this.rootBtns, { onBack: () => this.onRootBack() });
  }

  private openOnline(): void {
    this.mode = 'online';
    for (const b of this.rootBtns) b.setVisible(false).setActive(false);
    for (const b of this.onlineBtns) b.setVisible(true).setActive(true);
    this.onlineLabel?.setVisible(true);
    this.menu?.setButtons(this.onlineBtns);
  }

  private closeOnline(): void {
    this.mode = 'root';
    for (const b of this.onlineBtns) b.setVisible(false).setActive(false);
    for (const b of this.rootBtns) b.setVisible(true).setActive(true);
    this.onlineLabel?.setVisible(false);
    this.menu?.setButtons(this.rootBtns);
  }

  private onRootBack(): void {
    if (this.mode === 'online') this.closeOnline();
  }
}
