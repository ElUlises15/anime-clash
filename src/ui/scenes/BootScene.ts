import Phaser from 'phaser';
import { SCENES } from '../sceneData';
import { generateSharedTextures } from '../textures';
import { loadSettings } from '../settings';
import { audio } from '../../audio/AudioEngine';
import { loadPortraitModule } from '../portraitAdapter';
import { loadRegistry } from '../roster';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Boot);
  }

  create(): void {
    loadSettings();
    audio.installHooks();
    generateSharedTextures(this);
    try {
      this.game.canvas.tabIndex = 0;
      this.game.canvas.focus();
    } catch { /* ignore */ }
    void loadPortraitModule();
    void loadRegistry();
    this.scene.start(SCENES.Title);
  }
}
