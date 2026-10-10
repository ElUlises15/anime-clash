/**
 * Lazy atlas loading. Atlases are NOT part of boot: the first scene that needs a character's sprites queues them
 * on its own loader. Textures are global in Phaser, so later scenes/matches reuse them instantly.
 */
import Phaser from 'phaser';
import { spriteSetFor, spriteUrl, type SpriteSet } from './sets';

type Waiter = (ok: boolean) => void;
const waiting = new Map<string, Waiter[]>();
const failed = new Set<string>();

function textureKeys(set: SpriteSet): string[] {
  return [set.atlas, ...Object.values(set.forms ?? {}), ...(set.bust ? [set.bust] : [])];
}

export function isSpriteSetLoaded(scene: Phaser.Scene, set: SpriteSet): boolean {
  return scene.textures.exists(set.atlas);
}

/** Queue (if needed) and start loading a set's textures. Callback fires once the base atlas is ready (ok) or failed. */
export function ensureSpriteSet(scene: Phaser.Scene, set: SpriteSet, done?: Waiter): void {
  if (scene.textures.exists(set.atlas)) { done?.(true); return; }
  if (failed.has(set.atlas)) { done?.(false); return; }
  const list = waiting.get(set.atlas);
  if (list) { if (done) list.push(done); return; }
  waiting.set(set.atlas, done ? [done] : []);
  const load = scene.load;
  for (const key of textureKeys(set)) {
    if (scene.textures.exists(key)) continue;
    if (key === set.bust) load.image(key, spriteUrl(key, 'webp'));
    else load.atlas(key, spriteUrl(key, 'webp'), spriteUrl(key, 'json'));
  }
  const finish = () => {
    load.off(Phaser.Loader.Events.COMPLETE, finish);
    load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    for (const key of [...waiting.keys()]) {
      const ok = scene.textures.exists(key);
      if (!ok) failed.add(key);
      const ws = waiting.get(key) ?? [];
      waiting.delete(key);
      ws.forEach((w) => w(ok));
    }
  };
  const onError = (file: Phaser.Loader.File) => { console.warn(`[sprites] failed to load ${file.key}; falling back to rig`); };
  load.on(Phaser.Loader.Events.COMPLETE, finish);
  load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  if (!load.isLoading()) load.start();
}

/** Optional warm-up hook (e.g. from the select screen once both fighters are picked). */
export function preloadSpriteSets(scene: Phaser.Scene, ids: string[]): void {
  for (const id of ids) { const set = spriteSetFor(id); if (set) ensureSpriteSet(scene, set); }
}
