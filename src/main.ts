import Phaser from 'phaser';
import { GAME_W, GAME_H } from './ui/sceneData';
import { BootScene } from './ui/scenes/BootScene';
import { TitleScene } from './ui/scenes/TitleScene';
import { SettingsScene } from './ui/scenes/SettingsScene';
import { SelectScene } from './ui/scenes/SelectScene';
import { PostMatchScene } from './ui/scenes/PostMatchScene';
import { FightScene } from './game/scenes/FightScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#07060c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  fps: { target: 60, smoothStep: false },
  scene: [BootScene, TitleScene, SettingsScene, SelectScene, FightScene, PostMatchScene],
});
(window as unknown as { __game: Phaser.Game }).__game = game;
