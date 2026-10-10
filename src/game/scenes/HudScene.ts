/**
 * Screen-space overlay for the Fight scene: HUD, pause menu, training panel and debug text.
 * Lives in its own scene so the fight camera's zoom/shake never affects the UI.
 */
import Phaser from 'phaser';
import { Hud, type HudExtra } from '../../ui/Hud';
import type { CharacterDef } from '../../characters/types';
import type { MatchState } from '../sim/types';
import { GAME_W, GAME_H, type GameMode } from '../../ui/sceneData';
import { ArcadeButton } from '../../ui/widgets';
import { FocusNav } from '../../ui/focusNav';

export const HUD_SCENE = 'FightHud';

export interface PauseItem { label: string; action: () => void }

export class HudScene extends Phaser.Scene {
  hud: Hud | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;
  private pauseLayer: Phaser.GameObjects.Container | null = null;
  private pauseNav: FocusNav<ArcadeButton> | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;

  constructor() { super({ key: HUD_SCENE, active: false }); }

  create(data: { defs: [CharacterDef, CharacterDef]; mode: GameMode; debug: boolean }) {
    this.hud = new Hud(this, data.defs, { mode: data.mode });
    this.pauseLayer = null;
    this.debugText = data.debug
      ? this.add.text(16, GAME_H - 16, '', { fontFamily: 'monospace', fontSize: '18px', color: '#9fffb0', backgroundColor: '#000000aa' })
          .setOrigin(0, 1).setDepth(1000)
      : null;
    this.toastText = this.add.text(GAME_W / 2, GAME_H - 70, '', {
      fontFamily: 'Arial Black, Impact, sans-serif', fontSize: '30px', fontStyle: 'italic', color: '#ffd23f', stroke: '#0a0a14', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(1000).setAlpha(0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hud?.destroy();
      this.hud = null;
    });
  }

  updateHud(state: MatchState, extra: HudExtra) { this.hud?.update(state, extra); }

  setDebug(text: string) { this.debugText?.setText(text); }

  toast(msg: string) {
    if (!this.toastText) return;
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(msg).setAlpha(1).setScale(1.15);
    this.tweens.add({ targets: this.toastText, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1300, duration: 400 });
  }

  get paused() { return !!this.pauseLayer; }

  showPause(items: PauseItem[]) {
    this.hidePause();
    const layer = this.add.container(0, 0).setDepth(2000);
    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x05040a, 0.72);
    const band = this.add.graphics();
    band.fillStyle(0x12142a, 0.95);
    band.fillPoints([{ x: 560, y: 250 }, { x: 1460, y: 250 }, { x: 1360, y: 830 }, { x: 460, y: 830 }], true);
    band.lineStyle(4, 0xff2e88, 1);
    band.strokePoints([{ x: 560, y: 250 }, { x: 1460, y: 250 }, { x: 1360, y: 830 }, { x: 460, y: 830 }], true);
    const title = this.add.text(GAME_W / 2, 330, 'PAUSA', {
      fontFamily: 'Impact, Arial Black, sans-serif', fontSize: '86px', fontStyle: 'italic', color: '#ffffff', stroke: '#ff2e88', strokeThickness: 8,
    }).setOrigin(0.5);
    layer.add([dim, band, title]);
    const buttons = items.map((it, i) => new ArcadeButton(this, GAME_W / 2, 470 + i * 95, it.label, it.action,
      { w: 640, h: 72, size: 38, accent: i === 0 ? 'gold' : 'cyan' }));
    layer.add(buttons);
    this.pauseNav = new FocusNav(this, buttons, { keyboard: false });
    this.pauseLayer = layer;
  }

  movePause(d: number) { this.pauseNav?.move(d > 0 ? 'down' : 'up'); }

  /** Arrow/WASD/confirm keys forwarded by the Fight scene while paused. */
  pauseKey(e: KeyboardEvent): boolean { return this.pauseNav?.handleKey(e) ?? false; }

  confirmPause() { if (this.pauseLayer) this.pauseNav?.current?.activate(); }

  hidePause() {
    this.pauseLayer?.destroy(true);
    this.pauseNav?.destroy();
    this.pauseNav = null;
    this.pauseLayer = null;
  }
}
