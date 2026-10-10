import Phaser from 'phaser';
import { GAME_W, GAME_H } from './sceneData';
import { C, DEPTH } from './theme';

export type BackdropMood = 'title' | 'select' | 'settings' | 'post';

/** Animated diagonal speed-lines + halftone + vignette + particles. */
export function attachArcadeBackground(scene: Phaser.Scene, mood: BackdropMood = 'title'): void {
  const g = scene.add.graphics().setDepth(DEPTH.bg).setScrollFactor(0);
  const top = mood === 'select' ? 0x0a1630 : mood === 'post' ? 0x140810 : 0x0a1024;
  g.fillGradientStyle(C.bgDeep, C.bgDeep, top, 0x12081c, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);

  const lines = scene.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W + 80, GAME_H + 80, 'ui-speedlines')
    .setDepth(DEPTH.bgFx)
    .setAlpha(mood === 'title' ? 0.22 : 0.14)
    .setTint(mood === 'post' ? C.magenta : C.cyan)
    .setScrollFactor(0)
    .setAngle(-8);

  const lines2 = scene.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W + 80, GAME_H + 80, 'ui-speedlines')
    .setDepth(DEPTH.bgFx)
    .setAlpha(0.08)
    .setTint(C.magenta)
    .setScrollFactor(0)
    .setAngle(12)
    .setBlendMode(Phaser.BlendModes.ADD);

  const ht1 = scene.add.image(180, 160, 'ui-halftone').setDepth(DEPTH.bgFx).setAlpha(0.12).setTint(C.cyan).setScrollFactor(0);
  const ht2 = scene.add.image(GAME_W - 160, GAME_H - 140, 'ui-halftone').setDepth(DEPTH.bgFx).setAlpha(0.1).setTint(C.magenta).setScrollFactor(0).setScale(1.3);

  const noise = scene.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 'ui-noise')
    .setDepth(DEPTH.bgFx + 1)
    .setAlpha(0.18)
    .setScrollFactor(0)
    .setBlendMode(Phaser.BlendModes.ADD);

  // vignette
  const vig = scene.add.graphics().setDepth(DEPTH.bgFx + 2).setScrollFactor(0);
  vig.fillStyle(0x000000, 0.55);
  vig.fillRect(0, 0, GAME_W, 50);
  vig.fillRect(0, GAME_H - 70, GAME_W, 70);
  vig.fillRect(0, 0, 40, GAME_H);
  vig.fillRect(GAME_W - 40, 0, 40, GAME_H);

  // corner brackets
  const corners: Phaser.GameObjects.Image[] = [];
  const c1 = scene.add.image(36, 36, 'ui-corner').setDepth(DEPTH.bgFx + 3).setScrollFactor(0).setOrigin(0, 0);
  const c2 = scene.add.image(GAME_W - 36, 36, 'ui-corner').setDepth(DEPTH.bgFx + 3).setScrollFactor(0).setOrigin(0, 0).setFlipX(true);
  const c3 = scene.add.image(36, GAME_H - 36, 'ui-corner').setDepth(DEPTH.bgFx + 3).setScrollFactor(0).setOrigin(0, 0).setFlipY(true);
  const c4 = scene.add.image(GAME_W - 36, GAME_H - 36, 'ui-corner').setDepth(DEPTH.bgFx + 3).setScrollFactor(0).setOrigin(0, 0).setFlipX(true).setFlipY(true);
  corners.push(c1, c2, c3, c4);

  if (scene.textures.exists('ui-particle')) {
    scene.add.particles(GAME_W / 2, GAME_H + 20, 'ui-particle', {
      x: { min: 0, max: GAME_W },
      y: GAME_H + 10,
      lifespan: { min: 2800, max: 6200 },
      speedY: { min: -50, max: -110 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.55, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
      quantity: 1,
      tint: [C.cyan, C.magenta, C.gold, C.orange],
    }).setDepth(DEPTH.bgFx + 1).setScrollFactor(0);
  }

  scene.tweens.add({
    targets: ht1,
    angle: 12,
    duration: 14000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  scene.tweens.add({
    targets: ht2,
    angle: -10,
    duration: 18000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });

  const flicker = scene.tweens.add({
    targets: corners,
    alpha: { from: 0.75, to: 1 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  void flicker;

  scene.events.on('update', (_t: number, dt: number) => {
    const d = Math.min(dt, 40);
    lines.tilePositionX += d * 0.08;
    lines.tilePositionY += d * 0.12;
    lines2.tilePositionX -= d * 0.05;
    lines2.tilePositionY += d * 0.07;
    noise.tilePositionX += d * 0.03;
    noise.tilePositionY -= d * 0.02;
  });
}

export function markUi(sceneKey: string, scene?: Phaser.Scene): void {
  try {
    (window as unknown as { __ANIME_CLASH_UI: { scene: string; ready: boolean } }).__ANIME_CLASH_UI = {
      scene: sceneKey,
      ready: true,
    };
    const canvas = scene?.game.canvas ?? (window as unknown as { __game?: Phaser.Game }).__game?.canvas;
    if (canvas) {
      canvas.tabIndex = 0;
      canvas.focus();
    }
  } catch { /* ignore */ }
}
