/**
 * Procedural WebAudio engine — no sample files.
 * Render-side pitch jitter is intentional (not used by the sim).
 */
import type { SimEvent } from '../game/sim/types';

export type SfxKey =
  | 'hitLight' | 'hitHeavy' | 'hitSpecial' | 'block' | 'whoosh' | 'dash'
  | 'jump' | 'land' | 'projectile' | 'kiBlast' | 'beamCharge' | 'beamFire'
  | 'explosion' | 'teleport' | 'smoke' | 'ultimate' | 'ko'
  | 'uiMove' | 'uiConfirm' | 'uiBack' | 'ready' | 'fight' | 'roundAnnounce';

export type MusicTrack = 'menu' | 'battle';

export interface VolumeMap { master: number; music: number; sfx: number }

type SfxFn = (ctx: AudioContext, dest: AudioNode, t: number, pitch: number, gain: number) => void;

const SFX: Record<SfxKey, SfxFn> = {
  hitLight: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.05, 1800, 0.35 * g, p);
    blip(ctx, dest, t, 'square', 420 * p, 180 * p, 0.06, 0.18 * g);
  },
  hitHeavy: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.12, 900, 0.5 * g, p);
    blip(ctx, dest, t, 'sawtooth', 140 * p, 50 * p, 0.16, 0.4 * g);
    blip(ctx, dest, t + 0.02, 'square', 80 * p, 40 * p, 0.12, 0.25 * g);
  },
  hitSpecial: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.1, 1400, 0.45 * g, p);
    blip(ctx, dest, t, 'sawtooth', 520 * p, 160 * p, 0.14, 0.28 * g);
    blip(ctx, dest, t + 0.04, 'square', 780 * p, 220 * p, 0.1, 0.22 * g);
  },
  block: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.06, 3200, 0.3 * g, p);
    blip(ctx, dest, t, 'square', 920 * p, 640 * p, 0.07, 0.2 * g);
    blip(ctx, dest, t + 0.03, 'triangle', 1400 * p, 900 * p, 0.05, 0.12 * g);
  },
  whoosh: (ctx, dest, t, p, g) => sweepNoise(ctx, dest, t, 0.12, 400, 2200, 0.22 * g, p),
  dash: (ctx, dest, t, p, g) => {
    sweepNoise(ctx, dest, t, 0.1, 300, 2600, 0.28 * g, p);
    blip(ctx, dest, t, 'sine', 180 * p, 70 * p, 0.08, 0.22 * g);
  },
  jump: (ctx, dest, t, p, g) => blip(ctx, dest, t, 'sine', 220 * p, 520 * p, 0.12, 0.22 * g),
  land: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.07, 700, 0.28 * g, p);
    blip(ctx, dest, t, 'sine', 110 * p, 50 * p, 0.08, 0.25 * g);
  },
  projectile: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'square', 880 * p, 440 * p, 0.09, 0.18 * g);
    noiseBurst(ctx, dest, t, 0.04, 2000, 0.15 * g, p);
  },
  kiBlast: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'sawtooth', 1200 * p, 480 * p, 0.12, 0.2 * g);
    blip(ctx, dest, t, 'sine', 1800 * p, 900 * p, 0.1, 0.12 * g);
  },
  beamCharge: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'sawtooth', 80 * p, 720 * p, 0.45, 0.22 * g);
    sweepNoise(ctx, dest, t, 0.4, 200, 1800, 0.18 * g, p);
  },
  beamFire: (ctx, dest, t, p, g) => {
    drone(ctx, dest, t, 'sawtooth', 90 * p, 0.35, 0.22 * g);
    drone(ctx, dest, t, 'square', 180 * p, 0.3, 0.1 * g);
    noiseBurst(ctx, dest, t, 0.2, 1200, 0.28 * g, p);
  },
  explosion: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.35, 500, 0.55 * g, p);
    blip(ctx, dest, t, 'sine', 70 * p, 28 * p, 0.4, 0.5 * g);
    blip(ctx, dest, t + 0.05, 'sawtooth', 50 * p, 20 * p, 0.3, 0.25 * g);
  },
  teleport: (ctx, dest, t, p, g) => {
    sweepNoise(ctx, dest, t, 0.08, 2400, 400, 0.22 * g, p);
    blip(ctx, dest, t, 'sine', 1600 * p, 3200 * p, 0.07, 0.16 * g);
    blip(ctx, dest, t + 0.05, 'triangle', 2200 * p, 400 * p, 0.08, 0.12 * g);
  },
  smoke: (ctx, dest, t, p, g) => sweepNoise(ctx, dest, t, 0.22, 600, 200, 0.18 * g, p),
  ultimate: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'sawtooth', 60 * p, 900 * p, 0.45, 0.28 * g);
    sweepNoise(ctx, dest, t, 0.4, 200, 3000, 0.3 * g, p);
    noiseBurst(ctx, dest, t + 0.42, 0.22, 700, 0.6 * g, p);
    blip(ctx, dest, t + 0.42, 'sine', 90 * p, 30 * p, 0.28, 0.5 * g);
    blip(ctx, dest, t + 0.44, 'square', 240 * p, 80 * p, 0.18, 0.22 * g);
  },
  ko: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.4, 400, 0.5 * g, p);
    blip(ctx, dest, t, 'sawtooth', 220 * p, 40 * p, 0.55, 0.4 * g);
    blip(ctx, dest, t + 0.08, 'sine', 110 * p, 30 * p, 0.5, 0.35 * g);
  },
  uiMove: (ctx, dest, t, p, g) => blip(ctx, dest, t, 'square', 880 * p, 980 * p, 0.045, 0.12 * g),
  uiConfirm: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'square', 440 * p, 440 * p, 0.06, 0.16 * g);
    blip(ctx, dest, t + 0.055, 'square', 660 * p, 880 * p, 0.1, 0.16 * g);
  },
  uiBack: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'square', 520 * p, 360 * p, 0.07, 0.14 * g);
    blip(ctx, dest, t + 0.05, 'square', 280 * p, 180 * p, 0.08, 0.12 * g);
  },
  ready: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'square', 392 * p, 392 * p, 0.1, 0.2 * g);
    blip(ctx, dest, t + 0.1, 'square', 494 * p, 494 * p, 0.1, 0.2 * g);
    blip(ctx, dest, t + 0.2, 'square', 587 * p, 784 * p, 0.18, 0.22 * g);
  },
  fight: (ctx, dest, t, p, g) => {
    noiseBurst(ctx, dest, t, 0.18, 800, 0.4 * g, p);
    blip(ctx, dest, t, 'sawtooth', 98 * p, 196 * p, 0.22, 0.3 * g);
    blip(ctx, dest, t + 0.04, 'square', 392 * p, 330 * p, 0.16, 0.18 * g);
  },
  roundAnnounce: (ctx, dest, t, p, g) => {
    blip(ctx, dest, t, 'sine', 130 * p, 110 * p, 0.22, 0.28 * g);
    blip(ctx, dest, t + 0.05, 'triangle', 196 * p, 196 * p, 0.2, 0.16 * g);
  },
};

const KNOWN = new Set<string>(Object.keys(SFX));

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private unlocked = false;
  private disabled = false;
  private vols: VolumeMap = { master: 0.8, music: 0.45, sfx: 0.7 };
  private queuedMusic: MusicTrack | null | undefined;
  private sfxQueue: Array<{ key: SfxKey; pitch: number; gain: number }> = [];
  private musicTimer: number | null = null;
  private musicStoppers: Array<() => void> = [];
  private currentTrack: MusicTrack | null = null;
  private hooksInstalled = false;
  private lastUiMove = 0;

  /** Create context lazily; never throws. */
  unlock(): void {
    try {
      this.installHooks();
      this.ensureCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume().then(() => this.markUnlocked()).catch(() => { /* ignore */ });
      } else {
        this.markUnlocked();
      }
      try {
        const b = ctx.createBuffer(1, 1, 22050);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch { /* ignore */ }
    } catch { /* never throw */ }
  }

  installHooks(): void {
    if (this.hooksInstalled || typeof window === 'undefined') return;
    this.hooksInstalled = true;
    const once = () => this.unlock();
    window.addEventListener('pointerdown', once, { once: true, capture: true });
    window.addEventListener('keydown', once, { once: true, capture: true });
    window.addEventListener('touchstart', once, { once: true, capture: true });
  }

  setVolumes(v: Partial<VolumeMap>): void {
    if (v.master !== undefined) this.vols.master = clamp01(v.master);
    if (v.music !== undefined) this.vols.music = clamp01(v.music);
    if (v.sfx !== undefined) this.vols.sfx = clamp01(v.sfx);
    this.applyGains();
  }

  getVolumes(): VolumeMap {
    return { ...this.vols };
  }

  playSfx(key: SfxKey, opts?: { pitch?: number; gain?: number }): void {
    try {
      if (this.disabled) return;
      if (key === 'uiMove') {
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        if (now - this.lastUiMove < 40) return;
        this.lastUiMove = now;
      }
      const pitch = (opts?.pitch ?? 1) * (0.94 + Math.random() * 0.12);
      const gain = opts?.gain ?? 1;
      if (!this.unlocked) {
        if (this.sfxQueue.length < 8) this.sfxQueue.push({ key, pitch, gain });
        this.unlock();
        return;
      }
      this.fireSfx(key, pitch, gain);
    } catch { /* ignore */ }
  }

  playEvent(ev: SimEvent): void {
    try {
      const hinted = ev.sfx && KNOWN.has(ev.sfx) ? (ev.sfx as SfxKey) : null;
      if (hinted) {
        this.playSfx(hinted);
        return;
      }
      const key = mapEvent(ev);
      if (key) this.playSfx(key);
    } catch { /* ignore */ }
  }

  music(track: MusicTrack | null): void {
    try {
      if (this.disabled) return;
      if (!this.unlocked) {
        this.queuedMusic = track;
        this.unlock();
        return;
      }
      if (track === this.currentTrack) return;
      this.crossfadeTo(track);
    } catch { /* ignore */ }
  }

  private fireSfx(key: SfxKey, pitch: number, gain: number): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    const fn = SFX[key];
    if (!fn) return;
    fn(ctx, dest, ctx.currentTime, pitch, gain);
  }

  private markUnlocked(): void {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') return;
    this.unlocked = true;
    const q = this.sfxQueue.splice(0);
    for (const s of q) this.fireSfx(s.key, s.pitch, s.gain);
    if (this.queuedMusic !== undefined) {
      const t = this.queuedMusic;
      this.queuedMusic = undefined;
      this.crossfadeTo(t ?? null);
    }
  }

  private ensureCtx(): void {
    if (this.ctx || this.disabled) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) { this.disabled = true; return; }
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 3.5;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.12;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.compressor);
      this.compressor.connect(ctx.destination);
      this.noise = makeNoise(ctx, 1.5);
      this.applyGains();
    } catch {
      this.disabled = true;
    }
  }

  private applyGains(): void {
    const t = this.ctx?.currentTime ?? 0;
    try {
      this.master?.gain.setTargetAtTime(this.vols.master, t, 0.03);
      this.musicGain?.gain.setTargetAtTime(this.vols.music, t, 0.03);
      this.sfxGain?.gain.setTargetAtTime(this.vols.sfx, t, 0.03);
    } catch { /* ignore */ }
  }

  private crossfadeTo(track: MusicTrack | null): void {
    this.stopMusicVoices();
    this.currentTrack = track;
    if (!track || !this.ctx || !this.musicGain) return;
    if (track === 'menu') this.startMenuLoop();
    else this.startBattleLoop();
  }

  private stopMusicVoices(): void {
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    const stop = this.musicStoppers.splice(0);
    const t = this.ctx?.currentTime ?? 0;
    for (const s of stop) {
      try { s(); } catch { /* ignore */ }
    }
    void t;
  }

  private startMenuLoop(): void {
    const ctx = this.ctx!;
    const dest = this.musicGain!;
    const bpm = 92;
    const beat = 60 / bpm;
    const bar = beat * 4;
    let next = ctx.currentTime + 0.05;
    let barN = 0;
    const voices: AudioNode[] = [];

    const pad = ctx.createOscillator();
    pad.type = 'triangle';
    pad.frequency.value = 110;
    const pad2 = ctx.createOscillator();
    pad2.type = 'sine';
    pad2.frequency.value = 164.8;
    const padG = ctx.createGain();
    padG.gain.value = 0.07;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 18;
    lfo.connect(lfoG);
    lfoG.connect(pad.frequency);
    pad.connect(padG);
    pad2.connect(padG);
    padG.connect(dest);
    pad.start();
    pad2.start();
    lfo.start();
    voices.push(pad, pad2, lfo, padG);

    const tick = () => {
      if (this.currentTrack !== 'menu' || !this.ctx) return;
      const now = this.ctx.currentTime;
      while (next < now + 0.35) {
        scheduleMenuBar(this.ctx, dest, this.noise, next, beat, barN);
        next += bar;
        barN++;
      }
      this.musicTimer = window.setTimeout(tick, 80);
    };
    tick();
    this.musicStoppers.push(() => {
      try {
        padG.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
        pad.stop(ctx.currentTime + 0.5);
        pad2.stop(ctx.currentTime + 0.5);
        lfo.stop(ctx.currentTime + 0.5);
      } catch { /* ignore */ }
    });
  }

  private startBattleLoop(): void {
    const ctx = this.ctx!;
    const dest = this.musicGain!;
    const bpm = 138;
    const beat = 60 / bpm;
    const bar = beat * 4;
    let next = ctx.currentTime + 0.04;
    let barN = 0;
    const tick = () => {
      if (this.currentTrack !== 'battle' || !this.ctx) return;
      const now = this.ctx.currentTime;
      while (next < now + 0.35) {
        scheduleBattleBar(this.ctx, dest, this.noise, next, beat, barN);
        next += bar;
        barN++;
      }
      this.musicTimer = window.setTimeout(tick, 70);
    };
    tick();
  }
}

function mapEvent(ev: SimEvent): SfxKey | null {
  switch (ev.type) {
    case 'hit':
    case 'counterHit':
    case 'projectileHit':
      if (ev.strength === 'ultimate') return 'ultimate';
      if (ev.strength === 'special') return 'hitSpecial';
      if (ev.strength === 'heavy') return 'hitHeavy';
      return 'hitLight';
    case 'block':
    case 'parry':
    case 'armorHit':
      return 'block';
    case 'jump': return 'jump';
    case 'land': return 'land';
    case 'dash': return 'dash';
    case 'teleport': return 'teleport';
    case 'projectileSpawn':
      return ev.visual === 'kiBlast' || ev.sfx === 'kiBlast' ? 'kiBlast' : 'projectile';
    case 'beamStart': return 'beamFire';
    case 'aoe':
    case 'projectileClash':
      return 'explosion';
    case 'ultimateStart': return 'ultimate';
    case 'ko': return 'ko';
    case 'roundStart': return 'roundAnnounce';
    case 'fight': return 'fight';
    case 'whiff':
    case 'moveStart':
    case 'specialStart':
      return 'whoosh';
    case 'summon':
    case 'trapSet':
    case 'transform':
      return 'smoke';
    case 'shield':
    case 'buff':
      return 'beamCharge';
    default:
      return null;
  }
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc = acc * 0.95 + (Math.random() * 2 - 1) * 0.35;
    d[i] = acc * 0.7 + (Math.random() * 2 - 1) * 0.3;
  }
  return buf;
}

function env(ctx: AudioContext, dest: AudioNode, t: number, a: number, h: number, r: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.005, a));
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + h);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + Math.max(0.01, r));
  g.connect(dest);
  return g;
}

function blip(
  ctx: AudioContext, dest: AudioNode, t: number,
  type: OscillatorType, f0: number, f1: number, dur: number, peak: number,
): void {
  const g = env(ctx, dest, t, 0.005, dur * 0.25, dur * 0.75, peak);
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drone(ctx: AudioContext, dest: AudioNode, t: number, type: OscillatorType, f: number, dur: number, peak: number): void {
  const g = env(ctx, dest, t, 0.02, dur * 0.6, dur * 0.35, peak);
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = Math.max(20, f);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(ctx: AudioContext, dest: AudioNode, t: number, dur: number, cutoff: number, peak: number, pitch: number): void {
  const buf = makeShortNoise(ctx, dur + 0.04);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.35), t + dur);
  const g = env(ctx, dest, t, 0.004, dur * 0.15, dur * 0.85, peak);
  src.connect(f);
  f.connect(g);
  src.start(t);
  src.stop(t + dur + 0.03);
}

function sweepNoise(
  ctx: AudioContext, dest: AudioNode, t: number, dur: number,
  c0: number, c1: number, peak: number, pitch: number,
): void {
  const buf = makeShortNoise(ctx, dur + 0.05);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(Math.max(60, c0), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, c1), t + dur);
  const g = env(ctx, dest, t, 0.01, dur * 0.3, dur * 0.7, peak);
  src.connect(f);
  f.connect(g);
  src.start(t);
  src.stop(t + dur + 0.03);
}

function makeShortNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(32, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function kick(ctx: AudioContext, dest: AudioNode, t: number, peak: number): void {
  blip(ctx, dest, t, 'sine', 140, 42, 0.12, peak);
  noiseBurst(ctx, dest, t, 0.03, 400, peak * 0.25, 1);
}

function snare(ctx: AudioContext, dest: AudioNode, t: number, noise: AudioBuffer | null, peak: number): void {
  noiseBurst(ctx, dest, t, 0.08, 1800, peak, 1);
  blip(ctx, dest, t, 'triangle', 220, 160, 0.06, peak * 0.4);
  void noise;
}

function hat(ctx: AudioContext, dest: AudioNode, t: number, peak: number): void {
  const buf = makeShortNoise(ctx, 0.04);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = env(ctx, dest, t, 0.001, 0.01, 0.03, peak);
  src.connect(f);
  f.connect(g);
  src.start(t);
  src.stop(t + 0.05);
}

function bassNote(ctx: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, peak: number): void {
  const g = env(ctx, dest, t, 0.01, dur * 0.45, dur * 0.5, peak);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(520, t);
  f.frequency.exponentialRampToValueAtTime(180, t + dur);
  o.connect(f);
  f.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function leadNote(ctx: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, peak: number): void {
  const g = env(ctx, dest, t, 0.01, dur * 0.3, dur * 0.6, peak);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  o.connect(f);
  f.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const MENU_BASS = [55, 55, 65.41, 49];
const MENU_LEAD = [220, 261.63, 246.94, 196, 220, 174.61, 196, 164.81];
const BATTLE_BASS = [82.41, 82.41, 98, 110, 82.41, 73.42, 98, 61.74];
const BATTLE_LEAD = [329.63, 392, 440, 392, 329.63, 293.66, 246.94, 293.66];

function scheduleMenuBar(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer | null, t0: number, beat: number, barN: number): void {
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * beat;
    if (i === 0 || i === 2) kick(ctx, dest, t, 0.22);
    if (i === 1 || i === 3) snare(ctx, dest, t, noise, 0.1);
    hat(ctx, dest, t, 0.05);
    hat(ctx, dest, t + beat * 0.5, 0.035);
    bassNote(ctx, dest, t, MENU_BASS[i % MENU_BASS.length], beat * 0.9, 0.16);
  }
  if (barN % 2 === 0) {
    for (let i = 0; i < 4; i++) {
      leadNote(ctx, dest, t0 + i * beat, MENU_LEAD[(barN + i) % MENU_LEAD.length], beat * 0.6, 0.06);
    }
  }
}

function scheduleBattleBar(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer | null, t0: number, beat: number, barN: number): void {
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * beat;
    kick(ctx, dest, t, 0.28);
    if (i === 1 || i === 3) snare(ctx, dest, t, noise, 0.22);
    hat(ctx, dest, t, 0.07);
    hat(ctx, dest, t + beat * 0.25, 0.04);
    hat(ctx, dest, t + beat * 0.5, 0.06);
    hat(ctx, dest, t + beat * 0.75, 0.04);
    const bi = (barN * 4 + i) % BATTLE_BASS.length;
    bassNote(ctx, dest, t, BATTLE_BASS[bi], beat * 0.85, 0.2);
  }
  for (let i = 0; i < 8; i++) {
    if ((barN + i) % 3 === 0) continue;
    leadNote(
      ctx, dest, t0 + i * (beat / 2),
      BATTLE_LEAD[(barN * 2 + i) % BATTLE_LEAD.length],
      beat * 0.4, 0.055,
    );
  }
}

export const audio = new AudioEngine();
