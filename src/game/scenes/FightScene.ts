// Integration scene (lead). Placeholder until integration.
import Phaser from 'phaser';
import { SCENES, type FightSceneData } from '../../ui/sceneData';
export class FightScene extends Phaser.Scene {
  constructor() { super(SCENES.Fight); }
  create(data: FightSceneData) {
    this.add.text(100, 100, `FIGHT placeholder ${data?.p1} vs ${data?.p2}`, { fontSize: '48px', color: '#fff' });
  }
}
