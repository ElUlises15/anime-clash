/**
 * Controls help: in-fight overlay (toggle with H) built from the CURRENT bindings, plus compact one-line hints
 * for the HUD / character select. Plain Phaser objects so it works in any scene (FightHud, menus).
 */
import Phaser from 'phaser';
import { ACTION_LABELS, BINDING_ORDER, getCodes, keyLabel, type KeySetId } from '../game/input/bindings';
import type { ButtonName } from '../game/input/buttons';
import { GAME_W, GAME_H } from './sceneData';
import { FONT, FONT_UI } from './theme';

const DEPTH = 2500;
const layers = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();

/** Primary key label of an action ('Q'), or '—' when unbound. */
export function primaryKey(set: KeySetId, name: ButtonName): string {
  const c = getCodes(set, name)[0];
  return c ? keyLabel(c) : '—';
}

function keysOf(set: KeySetId, name: ButtonName): string {
  const codes = getCodes(set, name);
  return codes.length ? codes.map(keyLabel).join(' / ') : '—';
}

/** Compact one-line hint, e.g. "Q ligero · E fuerte · R/F especiales · C ultimate · Espacio bloqueo · H ayuda". */
export function controlsHint(set: KeySetId = 'p1keys', opts?: { help?: boolean; move?: boolean }): string {
  const k = (n: ButtonName) => primaryKey(set, n);
  const parts: string[] = [];
  if (opts?.move) parts.push(`${k('LEFT')}${k('RIGHT')}${k('UP')}${k('DOWN')} mover`);
  parts.push(
    `${k('LIGHT')} ligero`,
    `${k('HEAVY')} fuerte`,
    `${k('SP1')}/${k('SP2')} especiales`,
    `${k('ULT')} ultimate`,
    `${k('BLOCK')} bloqueo`,
    `${k('DASH')} dash`,
  );
  if (opts?.help !== false) parts.push('H ayuda');
  return parts.join(' · ');
}

export function isControlsHelpOpen(scene: Phaser.Scene): boolean {
  const l = layers.get(scene);
  return !!l && l.active;
}

export function hideControlsHelp(scene: Phaser.Scene): void {
  const l = layers.get(scene);
  if (l) l.destroy(true);
  layers.delete(scene);
}

/** Toggle the overlay; returns true when it is now open. */
export function toggleControlsHelp(scene: Phaser.Scene): boolean {
  if (isControlsHelpOpen(scene)) {
    hideControlsHelp(scene);
    return false;
  }
  showControlsHelp(scene);
  return true;
}

export function showControlsHelp(scene: Phaser.Scene): void {
  hideControlsHelp(scene);
  const layer = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x05040a, 0.78).setInteractive();
  dim.on('pointerup', () => hideControlsHelp(scene));
  const x0 = 300, y0 = 110, w = GAME_W - 600, h = 860;
  const g = scene.add.graphics();
  g.fillStyle(0x0c0a14, 0.96);
  g.fillPoints([{ x: x0 + 30, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w - 30, y: y0 + h }, { x: x0, y: y0 + h }], true);
  g.lineStyle(3, 0x29e7ff, 1);
  g.strokePoints([{ x: x0 + 30, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w - 30, y: y0 + h }, { x: x0, y: y0 + h }], true);
  layer.add([dim, g]);

  const title = (x: number, y: number, s: string, size: number, color: string) =>
    scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'italic', color, stroke: '#07060c', strokeThickness: 6 }).setOrigin(0.5);
  const body = (x: number, y: number, s: string, size: number, color: string) =>
    scene.add.text(x, y, s, { fontFamily: FONT_UI, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

  layer.add(title(GAME_W / 2, y0 + 50, 'CONTROLES', 52, '#ffd23f'));
  const cA = 640, c1 = 990, c2 = 1360;
  layer.add([title(cA, y0 + 115, 'ACCIÓN', 22, '#8a90a8'), title(c1, y0 + 115, 'P1', 26, '#29e7ff'), title(c2, y0 + 115, 'P2', 26, '#ff2e88')]);
  BINDING_ORDER.forEach((name, i) => {
    const y = y0 + 160 + i * 40;
    if (i % 2 === 0) {
      const band = scene.add.rectangle(GAME_W / 2, y, w - 160, 36, 0xffffff, 0.04);
      layer.add(band);
    }
    layer.add([
      body(cA, y, ACTION_LABELS[name], 22, '#e8e4f4'),
      body(c1, y, keysOf('p1keys', name), 22, '#29e7ff'),
      body(c2, y, keysOf('p2keys', name), name === 'DASH' ? 18 : 22, '#ff2e88'),
    ]);
  });
  const ny = y0 + 160 + BINDING_ORDER.length * 40 + 24;
  const notes = [
    `Dash: ${primaryKey('p1keys', 'DASH')} / ${primaryKey('p2keys', 'DASH')} + dirección, o doble tap ← / →`,
    `Ultimate: ${primaryKey('p1keys', 'ULT')} / ${primaryKey('p2keys', 'ULT')}, o Especial 1 + Especial 2 a la vez (P1: ${primaryKey('p1keys', 'SP1')}+${primaryKey('p1keys', 'SP2')})`,
    'Mando: A ligero · B fuerte · X esp. 1 · Y esp. 2 · LB/LT bloqueo · RB ultimate · RT/L3 dash',
    'Cambiá las teclas en SETTINGS → CONTROLES',
  ];
  notes.forEach((s, i) => layer.add(body(GAME_W / 2, ny + i * 32, s, 20, i === 3 ? '#ffd23f' : '#cfd6ff')));
  layer.add(title(GAME_W / 2, y0 + h - 34, 'H / ESC cerrar', 24, '#8a90a8'));
  layers.set(scene, layer);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => layers.delete(scene));
}

/** Small bottom hint line that fades out (fight start). */
export function flashControlsHint(scene: Phaser.Scene, text: string = controlsHint('p1keys'), ms = 6000): Phaser.GameObjects.Text {
  const t = scene.add.text(GAME_W / 2, GAME_H - 22, text, {
    fontFamily: FONT_UI, fontSize: '20px', color: '#cfd6ff', stroke: '#07060c', strokeThickness: 4,
  }).setOrigin(0.5, 1).setDepth(DEPTH - 1).setScrollFactor(0);
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 800, onComplete: () => t.destroy() });
  return t;
}
