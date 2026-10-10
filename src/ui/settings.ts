import { audio } from '../audio/AudioEngine';

const KEY = 'anime-clash-settings';

export interface UiSettings {
  master: number;
  music: number;
  sfx: number;
  showHitboxes: boolean;
}

const DEFAULTS: UiSettings = {
  master: 0.8,
  music: 0.45,
  sfx: 0.7,
  showHitboxes: false,
};

function clamp01(n: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export const settings: UiSettings = { ...DEFAULTS };

export function loadSettings(): UiSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiSettings>;
      settings.master = clamp01(parsed.master ?? DEFAULTS.master);
      settings.music = clamp01(parsed.music ?? DEFAULTS.music);
      settings.sfx = clamp01(parsed.sfx ?? DEFAULTS.sfx);
      settings.showHitboxes = !!parsed.showHitboxes;
    }
  } catch {
    Object.assign(settings, DEFAULTS);
  }
  applySettings();
  return settings;
}

export function saveSettings(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(settings));
    }
  } catch { /* private mode */ }
  applySettings();
}

export function applySettings(): void {
  audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
}

export function setVolume(kind: 'master' | 'music' | 'sfx', value: number): void {
  settings[kind] = clamp01(value);
  saveSettings();
}

export function setShowHitboxes(v: boolean): void {
  settings.showHitboxes = v;
  saveSettings();
}
