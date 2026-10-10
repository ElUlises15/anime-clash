/** A single atlas-driven fighter body (used for the fighter itself and its afterimage ghosts). */
import Phaser from 'phaser';
import type { AnimKey } from '../../game/sim/types';
import { resolveClip, selectFrame, type MoveTiming } from './frameSelect';
import type { SpriteSet } from './sets';

/** If an animation-sheet frame is missing (key-pose-only set) use the closest key pose. */
const KEY_FALLBACK: Record<string, string> = { walk: 'walk', light: 'light', heavy: 'heavy', air: 'jump', low: 'crouch', moves: 'special' };

export class SpriteBody {
  readonly sprite: Phaser.GameObjects.Sprite;
  private texKey: string;
  private frameName = '';
  /** world px per source px (idle frame height -> idleHeightPx). */
  baseScale = 1;

  constructor(scene: Phaser.Scene, readonly set: SpriteSet, idleHeightPx: number) {
    this.texKey = set.atlas;
    this.sprite = scene.add.sprite(0, 0, set.atlas, 'idle');
    const idle = this.sprite.frame;
    this.baseScale = idleHeightPx / Math.max(1, idle.height);
  }

  setForm(form: string | null): void {
    const want = (form && this.set.forms?.[form]) || this.set.atlas;
    const key = this.sprite.scene.textures.exists(want) ? want : this.set.atlas;
    if (key !== this.texKey) { this.texKey = key; this.frameName = ''; }
  }

  /** Position at feet (x, y) facing ±1 and show the frame for anim/animFrame. */
  show(x: number, y: number, facing: 1 | -1, anim: AnimKey, animFrame: number, timing?: MoveTiming): string {
    const clip = resolveClip(this.set.clips, anim);
    const pick = clip ? selectFrame(clip, animFrame, timing) : { frame: 'idle', scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
    let name = pick.frame;
    const tex = this.sprite.scene.textures.get(this.texKey);
    if (!tex.has(name)) name = KEY_FALLBACK[name.split('_')[0]] ?? 'idle';
    if (!tex.has(name)) name = 'idle';
    if (name !== this.frameName || this.sprite.texture.key !== this.texKey) {
      this.sprite.setTexture(this.texKey, name); // custom pivot from the atlas becomes the origin
      this.frameName = name;
    }
    const s = this.baseScale;
    this.sprite
      .setPosition(x + facing * pick.offsetX, y - pick.offsetY)
      .setScale(facing * s * pick.scaleX, s * pick.scaleY);
    return name;
  }

  destroy(): void { this.sprite.destroy(); }
}
