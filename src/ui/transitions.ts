import Phaser from 'phaser';
import { GAME_W, GAME_H } from './sceneData';
import { C, DEPTH } from './theme';

type Payload = object | undefined;

/**
 * Slash wipe / diagonal panel wipe between scenes.
 * Outgoing scene covers itself, then `scene.start`s the target.
 * Incoming scenes should call `playIntroWipe(scene)` at the top of create().
 */
export function goTo(from: Phaser.Scene, target: string, data?: Payload, kind: 'slash' | 'wipe' = 'slash'): void {
  if ((from as unknown as { __uiLeaving?: boolean }).__uiLeaving) return;
  (from as unknown as { __uiLeaving?: boolean }).__uiLeaving = true;
  const run = () => {
    try {
      from.scene.start(target, data);
    } catch {
      from.scene.start(target);
    }
  };
  if (kind === 'wipe') panelWipeOut(from, run);
  else slashOut(from, run);
}

export function playIntroWipe(scene: Phaser.Scene, kind: 'slash' | 'wipe' = 'slash'): void {
  if (kind === 'wipe') panelWipeIn(scene);
  else slashIn(scene);
}

function slashOut(scene: Phaser.Scene, done: () => void): void {
  const g = scene.add.graphics().setDepth(DEPTH.transition).setScrollFactor(0);
  const cover = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, C.bgDeep, 0)
    .setDepth(DEPTH.transition - 1).setScrollFactor(0);
  const st = { t: 0 };
  scene.tweens.add({
    targets: st,
    t: 1,
    duration: 420,
    ease: 'Cubic.easeIn',
    onUpdate: () => drawSlash(g, st.t, 1),
    onComplete: () => {
      scene.tweens.add({
        targets: cover,
        fillAlpha: 1,
        duration: 80,
        onComplete: done,
      });
    },
  });
}

function slashIn(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(DEPTH.transition).setScrollFactor(0);
  const cover = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, C.bgDeep, 1)
    .setDepth(DEPTH.transition - 1).setScrollFactor(0);
  const st = { t: 1 };
  scene.tweens.add({
    targets: cover,
    fillAlpha: 0,
    duration: 160,
    delay: 40,
  });
  scene.tweens.add({
    targets: st,
    t: 0,
    duration: 480,
    ease: 'Cubic.easeOut',
    onUpdate: () => drawSlash(g, st.t, -1),
    onComplete: () => {
      g.destroy();
      cover.destroy();
    },
  });
}

/** t=0 thin slash, t=1 full cover. dir unused visually but keeps chirality. */
function drawSlash(g: Phaser.GameObjects.Graphics, t: number, _dir: number): void {
  g.clear();
  const w = GAME_W;
  const h = GAME_H;
  const thick = 40 + t * (w + h);
  // Diagonal band from TL to BR, expanding.
  const cx = w * 0.5;
  const cy = h * 0.5;
  const nx = 0.62;
  const ny = -0.78;
  const hw = thick * 0.5;
  const span = w + h;
  const p = (ox: number, oy: number) => ({
    x: cx + nx * ox + ny * oy,
    y: cy + ny * ox - nx * oy,
  });
  const a = p(-span, -hw);
  const b = p(span, -hw);
  const c = p(span, hw);
  const d = p(-span, hw);
  g.fillStyle(C.bgDeep, Math.min(1, t * 1.4));
  g.fillPoints([a, b, c, d], true);
  // chromatic edges
  const edge = 18 + t * 10;
  const e1a = p(-span, -hw);
  const e1b = p(span, -hw);
  const e1c = p(span, -hw + edge);
  const e1d = p(-span, -hw + edge);
  g.fillStyle(C.cyan, 0.85);
  g.fillPoints([e1a, e1b, e1c, e1d], true);
  const e2a = p(-span, hw - edge);
  const e2b = p(span, hw - edge);
  const e2c = p(span, hw);
  const e2d = p(-span, hw);
  g.fillStyle(C.magenta, 0.85);
  g.fillPoints([e2a, e2b, e2c, e2d], true);
  // gold core line
  g.lineStyle(4, C.gold, 0.9);
  const c1 = p(-span, 0);
  const c2 = p(span, 0);
  g.lineBetween(c1.x, c1.y, c2.x, c2.y);
}

function panelWipeOut(scene: Phaser.Scene, done: () => void): void {
  const n = 7;
  const pw = GAME_W / n + 80;
  const panels: Phaser.GameObjects.Graphics[] = [];
  for (let i = 0; i < n; i++) {
    const g = scene.add.graphics().setDepth(DEPTH.transition).setScrollFactor(0);
    panels.push(g);
    const st = { x: -pw };
    scene.tweens.add({
      targets: st,
      x: i * (GAME_W / n) - 20,
      duration: 280,
      delay: i * 40,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        g.clear();
        drawPanel(g, st.x, pw, i);
      },
      onComplete: i === n - 1 ? done : undefined,
    });
  }
}

function panelWipeIn(scene: Phaser.Scene): void {
  const n = 7;
  const pw = GAME_W / n + 80;
  for (let i = 0; i < n; i++) {
    const g = scene.add.graphics().setDepth(DEPTH.transition).setScrollFactor(0);
    drawPanel(g, i * (GAME_W / n) - 20, pw, i);
    scene.tweens.add({
      targets: g,
      x: GAME_W + pw,
      duration: 320,
      delay: i * 35,
      ease: 'Cubic.easeIn',
      onComplete: () => g.destroy(),
    });
  }
}

function drawPanel(g: Phaser.GameObjects.Graphics, x: number, pw: number, i: number): void {
  const skew = 48;
  g.fillStyle(i % 2 === 0 ? C.navy : C.bgDeep, 1);
  g.fillPoints([
    { x: x + skew, y: 0 },
    { x: x + pw, y: 0 },
    { x: x + pw - skew, y: GAME_H },
    { x: x, y: GAME_H },
  ], true);
  g.lineStyle(3, i % 2 === 0 ? C.magenta : C.cyan, 0.8);
  g.strokePoints([
    { x: x + skew, y: 0 },
    { x: x + pw, y: 0 },
    { x: x + pw - skew, y: GAME_H },
    { x: x, y: GAME_H },
  ], true);
}
