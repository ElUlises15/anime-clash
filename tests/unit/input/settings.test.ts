import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULTS, SETTINGS_VERSION, loadSettings, setVolume, settings } from '../../../src/ui/settings';
import { audio, DEFAULT_VOLUMES } from '../../../src/audio/AudioEngine';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const ls = new MemStorage();
(globalThis as unknown as { localStorage: MemStorage }).localStorage = ls;

beforeEach(() => ls.clear());

describe('audio settings', () => {
  it('defaults are the quieter mix', () => {
    expect(DEFAULT_VOLUMES.master).toBeLessThanOrEqual(0.5);
    expect(DEFAULT_VOLUMES.music).toBeLessThan(DEFAULT_VOLUMES.sfx);
    loadSettings();
    expect(audio.getVolumes()).toEqual(DEFAULT_VOLUMES);
  });

  it('persists volumes with a version and applies them on load', () => {
    loadSettings();
    setVolume('sfx', 0.25);
    const saved = JSON.parse(ls.getItem('anime-clash-settings')!);
    expect(saved.version).toBe(SETTINGS_VERSION);
    settings.sfx = 1;
    loadSettings();
    expect(settings.sfx).toBe(0.25);
    expect(audio.getVolumes().sfx).toBe(0.25);
  });

  it('migrates old unversioned saves to the new default volumes once', () => {
    ls.setItem('anime-clash-settings', JSON.stringify({ master: 0.8, music: 0.45, sfx: 0.7, showHitboxes: true }));
    loadSettings();
    expect(settings.master).toBe(DEFAULTS.master);
    expect(settings.music).toBe(DEFAULTS.music);
    expect(settings.showHitboxes).toBe(true);
    expect(JSON.parse(ls.getItem('anime-clash-settings')!).version).toBe(SETTINGS_VERSION);
    setVolume('master', 0.9);
    loadSettings();
    expect(settings.master).toBe(0.9);
  });
});
