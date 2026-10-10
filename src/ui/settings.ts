import { audio, DEFAULT_VOLUMES } from '../audio/AudioEngine';

const KEY = 'anime-clash-settings';
/** Bump when defaults change in a way saved values should not survive (v2: quieter mix). */
export const SETTINGS_VERSION = 2;

export interface UiSettings {
  master: number;
  music: number;
  sfx: number;
  showHitboxes: boolean;
}

export const DEFAULTS: Readonly<UiSettings> = {
  ...DEFAULT_VOLUMES,
  showHitboxes: false,
};

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export const settings: UiSettings = { ...DEFAULTS };

/** Load persisted settings and apply them to the audio engine (called at boot). */
export function loadSettings(): UiSettings {
  Object.assign(settings, DEFAULTS);
  let migrated = false;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiSettings> & { version?: number };
      settings.showHitboxes = !!parsed.showHitboxes;
      if ((parsed.version ?? 1) >= SETTINGS_VERSION) {
        settings.master = clamp01(parsed.master ?? DEFAULTS.master);
        settings.music = clamp01(parsed.music ?? DEFAULTS.music);
        settings.sfx = clamp01(parsed.sfx ?? DEFAULTS.sfx);
      } else {
        // Saved by the old (too loud) version: volumes go back to the new defaults once.
        migrated = true;
      }
    }
  } catch {
    Object.assign(settings, DEFAULTS);
  }
  if (migrated) saveSettings();
  else applySettings();
  return settings;
}

export function saveSettings(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify({ version: SETTINGS_VERSION, ...settings }));
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
