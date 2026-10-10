/**
 * FightScene — integration point. Runs the deterministic sim at a fixed 60 Hz (accumulator), feeds it input bitmasks
 * from local controllers / bots, and drives render (FighterView/EntityView/VfxSystem/StageView/CameraRig),
 * audio and the HUD overlay scene from the read-only MatchState + per-step SimEvents.
 *
 * Phase 2 (online): replace `gatherInputs()` with the netcode session (local + remote/predicted inputs) and
 * let the session own `state` (rollback = restore cloneState snapshot + re-step).
 */
import Phaser from 'phaser';
import { sim, getHurtbox, getActiveHitbox, getEntityBox } from '../sim/engine';
import type { InputBits } from '../input/buttons';
import type { MatchState, PlayerIndex, SimEvent } from '../sim/types';
import { FX, SIM_HZ } from '../sim/types';
import { getCharacter } from '../../characters/registry';
import type { CharacterDef } from '../../characters/types';
import { InputManager } from '../input/InputManager';
import { createBot, dummyInput, type Bot, type DummyMode } from '../ai/qaBot';
import { StageView } from '../../render/StageView';
import { CameraRig } from '../../render/CameraRig';
import { FighterView } from '../../render/FighterView';
import { EntityView } from '../../render/EntityView';
import { VfxSystem } from '../../render/VfxSystem';
import { audio } from '../../audio';
import { settings } from '../../ui/settings';
import { SCENES, GROUND_Y, type FightSceneData, type MatchResult } from '../../ui/sceneData';
import { HUD_SCENE, HudScene } from './HudScene';
import { toggleControlsHelp, isControlsHelpOpen, hideControlsHelp, showControlsHelp, flashControlsHint } from '../../ui/controlsHelp';
import { NetSession } from '../../networking/netcode';
import { getActiveRoom, clearActiveRoom, netDiag, type RoomSession } from '../../networking';
import { spriteSetFor } from '../../render/sprites/sets';
import { ensureFormAtlas } from '../../render/sprites/loader';

const STEP_MS = 1000 / SIM_HZ;
const MAX_STEPS_PER_FRAME = 4;
/** Online: the lagging peer may catch up this many steps in one render frame instead of dropping time (keeps clocks in sync). */
const ONLINE_MAX_STEPS_PER_FRAME = 12;
/** Online: if the render loop hasn't run for this long (tab hidden, long stall) a timer keeps stepping + sending inputs. */
const PUMP_STALL_MS = 200;
const PERF_SAMPLES = 1800;
const ABILITY_EVENTS = new Set<string>(['specialStart', 'projectileSpawn', 'beamStart', 'aoe', 'teleport', 'summon', 'trapSet', 'transform', 'shield', 'buff']);
const DUMMY_MODES: (DummyMode | 'bot')[] = ['idle', 'block', 'jump', 'crouch', 'bot'];
const DUMMY_LABEL: Record<string, string> = { idle: 'QUIETO', block: 'BLOQUEA', jump: 'SALTA', crouch: 'AGACHADO', bot: 'BOT QA' };

export function isDebugEnabled(): boolean {
  const q = new URLSearchParams(window.location.search);
  if (q.get('debug') === '1') return true;
  if (q.get('debug') === '0') return false;
  return !!import.meta.env.DEV || !!settings.showHitboxes;
}

export class FightScene extends Phaser.Scene {
  state!: MatchState;
  private fightData!: FightSceneData;
  private defs!: [CharacterDef, CharacterDef];
  private stage!: StageView;
  private camRig!: CameraRig;
  private views!: [FighterView, FighterView];
  private entityView!: EntityView;
  private vfx!: VfxSystem;
  private inputMgr!: InputManager;
  private bots: (Bot | null)[] = [null, null];
  private hudScene!: HudScene;
  private acc = 0;
  private ending = false;
  private paused = false;
  private helpPaused = false;
  private debug = false;
  private debugG: Phaser.GameObjects.Graphics | null = null;
  private dummyMode: DummyMode | 'bot' = 'idle';
  private regen = true;
  private lastDamage = 0;
  private lastComboDamage = 0;
  private fpsSmooth = 60;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private stepsTotal = 0;
  // ---- online (Phase 2)
  private net: NetSession | null = null;
  private room: RoomSession | null = null;
  private roomUnsubs: (() => void)[] = [];
  private localBot: Bot | null = null;
  private onlineAutoplay = false;
  private silentShown = false;
  private hashLog: Record<number, number> = {};
  /** Test/tooling only: simulation speed multiplier (both peers must use the same value online). */
  private speed = 1;
  private spam = false;
  private hudDirty = false;
  // ---- perf / liveness instrumentation
  private perfDelta = new Float32Array(PERF_SAMPLES);
  private perfCost = new Float32Array(PERF_SAMPLES);
  private perfN = 0;
  private perfRender = new Float32Array(PERF_SAMPLES);
  private renderN = 0;
  private renderT0 = 0;
  private onPreRender = () => { this.renderT0 = performance.now(); };
  private onPostRender = () => { this.perfRender[this.renderN++ % PERF_SAMPLES] = performance.now() - this.renderT0; };
  private lastUpdateAt = 0;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private pumping = false;
  private phaseLog: string[] = [];
  private abilityCount = { specials: 0, ultimates: 0 };

  constructor() { super(SCENES.Fight); }

  create(data: FightSceneData) {
    this.fightData = {
      ...data,
      controllers: data.autoplay && data.mode !== 'online' ? ['cpu', 'cpu'] : data.controllers ?? ['p1keys', 'p2keys'],
      seed: data.seed ?? ((Date.now() & 0x7fffffff) >>> 0),
    };
    this.ending = false;
    this.paused = false;
    this.acc = 0;
    this.stepsTotal = 0;
    this.lastDamage = 0;
    this.lastComboDamage = 0;
    this.defs = [getCharacter(this.fightData.p1), getCharacter(this.fightData.p2)];
    const training = this.fightData.mode === 'training';
    this.dummyMode = this.fightData.autoplay ? 'bot' : 'idle';
    this.net = null;
    this.room = null;
    this.roomUnsubs = [];
    this.localBot = null;
    this.silentShown = false;
    this.hashLog = {};
    this.speed = 1;
    this.spam = false;
    this.perfN = 0;
    this.renderN = 0;
    this.lastNetInfo = null;
    this.game.events.on(Phaser.Core.Events.PRE_RENDER, this.onPreRender);
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.onPostRender);
    this.phaseLog = [];
    this.abilityCount = { specials: 0, ultimates: 0 };
    this.lastUpdateAt = performance.now();
    this.onlineAutoplay = this.fightData.mode === 'online' && !!data.autoplay;
    if (this.fightData.mode === 'online') {
      const room = getActiveRoom();
      if (!room || !room.link || !data.online) {
        this.scene.start(SCENES.Title, {});
        return;
      }
      this.room = room;
      const me = room.snapshot.me;
      this.net = new NetSession({ link: room.link, role: room.snapshot.role, me, match: data.online.match, resume: data.online.resume });
      this.localBot = createBot(((data.online.match.seed + me * 7919) >>> 0) || 1, 2);
      room.resumeProvider = () => this.net?.snapshotForResume() ?? null;
      this.roomUnsubs.push(room.on((ev) => {
        if (ev.type === 'opponentReturned' && this.net && room.link) {
          this.net.attachLink(room.link);
          this.hudScene?.toast('RIVAL RECONECTADO');
        } else if (ev.type === 'opponentLeft' && !ev.final) {
          this.hudScene?.toast('RIVAL DESCONECTADO — esperando reconexión (15 s)');
        } else if ((ev.type === 'opponentLeft' && ev.final) || ev.type === 'closed') {
          this.showOpponentGone(ev.type === 'closed');
        } else if (ev.type === 'matchStart' && ev.match.matchId !== data.online!.match.matchId && !this.ending) {
          this.leave(SCENES.Fight, { ...this.fightData, seed: ev.match.seed, p1: ev.match.p1, p2: ev.match.p2, online: { match: ev.match, resume: ev.resume } });
        }
      }));
      this.state = this.net.state;
      // Keep stepping/sending from a timer if rAF stops (hidden tab, long main-thread stall) so the peer never goes silent.
      this.pumpTimer = setInterval(() => this.pump(), 50);
    } else {
      this.state = this.newMatch();
    }

    this.cameras.main.setBackgroundColor('#07060c');
    this.stage = new StageView(this);
    this.camRig = new CameraRig(this);
    this.views = [new FighterView(this, this.defs[0], 0), new FighterView(this, this.defs[1], 1)];
    this.entityView = new EntityView(this, this.views);
    // Transformation atlases (e.g. goku_ssj) used to load at transform time → decode + GPU upload hitch mid-fight
    // (online: a long stall on one peer). Queue them now so they decode during the intro.
    for (const def of this.defs) for (const key of Object.values(spriteSetFor(def.id)?.forms ?? {})) ensureFormAtlas(this, key);
    this.vfx = new VfxSystem(this, this.camRig);
    this.inputMgr = new InputManager();
    this.bots = this.fightData.controllers.map((c, i) =>
      c === 'cpu' || c === 'dummy' ? createBot((this.fightData.seed ?? 1) + i * 7919, 2) : null,
    );

    this.debug = isDebugEnabled();
    this.debugG = this.debug ? this.add.graphics().setDepth(500) : null;

    this.scene.launch(HUD_SCENE, { defs: this.defs, mode: this.fightData.mode, debug: this.debug });
    this.hudScene = this.scene.get(HUD_SCENE) as HudScene;
    this.scene.bringToTop(HUD_SCENE);
    this.helpPaused = false;
    this.time.delayedCall(600, () => { if (this.hudScene?.sys.isActive()) flashControlsHint(this.hudScene); });

    audio.music('battle');
    this.cameras.main.fadeIn(350, 7, 6, 12);

    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    // Test / tooling hook (used by Playwright smoke tests and the QA harness).
    (window as unknown as { __ac?: unknown }).__ac = {
      scene: this,
      getState: () => this.state,
      hash: () => sim.hashState(this.state),
      steps: () => this.stepsTotal,
      /** Hand both sides to the QA bot (smoke tests / demo). */
      setAutoplay: (on: boolean, opts?: { spam?: boolean }) => {
        if (this.net) {
          this.onlineAutoplay = on;
          if (opts?.spam !== undefined && this.room && this.fightData.online) {
            this.spam = opts.spam;
            this.localBot = createBot(((this.fightData.online.match.seed + this.room.snapshot.me * 7919) >>> 0) || 1, 2, { spam: opts.spam });
          }
          return;
        }
        if (!on) return;
        this.fightData.controllers = ['cpu', 'cpu'];
        this.bots = [createBot(4242, 2), createBot(9191, 2)];
      },
      mode: this.fightData.mode,
      /** Simulate N frames immediately (tests/tools only). Stops early at the requested predicate phase. */
      /** Online stats + diagnostics; after the fight ends it keeps returning the final numbers of that match. */
      net: () => (this.net ? this.netInfo(this.net) : this.lastNetInfo),
      /** Frame-time profile since fight start (ms): render delta + update() CPU cost percentiles. */
      perf: () => this.perfReport(),
      resetPerf: () => { this.perfN = 0; this.renderN = 0; },
      confirmed: () => this.net?.confirmedState ?? this.state,
      confirmedHash: () => sim.hashState(this.net?.confirmedState ?? this.state),
      me: () => this.room?.snapshot.me ?? 0,
      hashLog: () => ({ ...this.hashLog }),
      /** Tests only: run the fixed-step loop N times faster (1..8). */
      setSpeed: (n: number) => { this.speed = Math.max(1, Math.min(8, n | 0)); },
      fastForward: (frames: number, until?: string) => {
        if (this.net) return this.state.frame; // online: never fast-forward (would desync pacing)
        for (let i = 0; i < frames && !this.ending; i++) {
          this.stepOnce();
          if (until && (this.state.phase === until || (until === 'cinematic' && this.state.cinematic.active))) break;
        }
        return this.state.frame;
      },
    };
    if (training) this.hudScene.events.once(Phaser.Scenes.Events.CREATE, () => this.hudScene.toast('F1 modo dummy · F2 regen · F3 reset'));
  }

  private newMatch(): MatchState {
    const training = this.fightData.mode === 'training';
    return sim.createMatch({
      p1: this.fightData.p1,
      p2: this.fightData.p2,
      seed: this.fightData.seed ?? 1,
      mode: training ? 'training' : 'versus',
      training: training ? { regenHp: this.regen, regenEnergy: this.regen } : undefined,
    });
  }

  // ---------------------------------------------------------------- input
  private gatherInputs(): [InputBits, InputBits] {
    const local = this.inputMgr.samplePair([
      this.fightData.controllers[0] === 'p2keys' ? 'p2keys' : 'p1keys',
      'p2keys',
    ]);
    const out: [InputBits, InputBits] = [0, 0];
    for (const i of [0, 1] as PlayerIndex[]) {
      const c = this.fightData.controllers[i];
      if (c === 'p1keys') out[i] = local[0];
      else if (c === 'p2keys') out[i] = local[1];
      else if (c === 'cpu') out[i] = this.bots[i]!.next(this.state, i);
      else if (c === 'dummy') out[i] = this.dummyMode === 'bot' ? this.bots[i]!.next(this.state, i) : dummyInput(this.dummyMode, this.state, i);
      else out[i] = 0; // 'remote' — Phase 2
    }
    return out;
  }

  private onKey(e: KeyboardEvent) {
    if (this.ending) return;
    // Controls help overlay (H). Pauses local play (online: local inputs go neutral) and restores on close.
    if (this.hudScene && (e.code === 'KeyH' || (isControlsHelpOpen(this.hudScene) && (e.code === 'Escape' || e.code === 'Backspace')))) {
      e.preventDefault();
      if (toggleControlsHelp(this.hudScene)) {
        this.helpPaused = !this.paused;
        this.paused = true;
      } else if (this.helpPaused) {
        this.helpPaused = false;
        this.resume();
      }
      return;
    }
    if (this.hudScene && isControlsHelpOpen(this.hudScene)) return;
    if (this.hudScene?.paused) {
      if (e.code === 'Escape' || e.code === 'Backspace') this.resume();
      else this.hudScene.pauseKey(e);
      e.preventDefault();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') { this.pause(); e.preventDefault(); return; }
    if (this.fightData.mode !== 'training') return;
    if (e.code === 'F1') {
      this.dummyMode = DUMMY_MODES[(DUMMY_MODES.indexOf(this.dummyMode) + 1) % DUMMY_MODES.length];
      this.hudScene.toast(`DUMMY: ${DUMMY_LABEL[this.dummyMode]}`);
      e.preventDefault();
    } else if (e.code === 'F2') {
      this.regen = !this.regen;
      if (this.state.config.training) {
        this.state.config.training.regenHp = this.regen;
        this.state.config.training.regenEnergy = this.regen;
      }
      this.hudScene.toast(`REGEN ${this.regen ? 'ON' : 'OFF'}`);
      e.preventDefault();
    } else if (e.code === 'F3' || e.code === 'Backspace') {
      this.resetTraining();
      e.preventDefault();
    }
  }

  private resetTraining() {
    this.state = this.newMatch();
    this.lastDamage = 0;
    this.lastComboDamage = 0;
    this.hudScene.toast('RESET');
  }

  private pause() {
    this.paused = true;
    if (this.net) {
      // Online: the simulation keeps running (local inputs are neutral while the menu is open).
      this.hudScene.showPause([
        { label: 'CONTINUAR', action: () => this.resume() },
        { label: 'CONTROLES', action: () => showControlsHelp(this.hudScene) },
        { label: 'SALIR DE LA SALA', action: () => { clearActiveRoom(); this.leave(SCENES.Title, {}); } },
      ]);
      audio.playSfx?.('uiConfirm');
      return;
    }
    const items = [
      { label: 'CONTINUAR', action: () => this.resume() },
      ...(this.fightData.mode === 'training' ? [{ label: 'RESET', action: () => { this.resetTraining(); this.resume(); } }] : []),
      { label: 'CONTROLES', action: () => showControlsHelp(this.hudScene) },
      { label: 'CAMBIAR LUCHADOR', action: () => this.leave(SCENES.Select, { mode: this.fightData.mode }) },
      { label: 'MENÚ PRINCIPAL', action: () => this.leave(SCENES.Title, {}) },
    ];
    this.hudScene.showPause(items);
    audio.playSfx?.('uiConfirm');
  }

  /** Opponent left for good (or room closed): sim is stalled; offer the way out. */
  private showOpponentGone(closed: boolean) {
    if (this.ending) return;
    this.paused = true;
    const host = this.room?.snapshot.role === 'host' && !closed;
    this.hudScene.toast(closed ? 'SALA CERRADA' : 'EL RIVAL SE FUE');
    this.hudScene.showPause([
      ...(host ? [{ label: 'VOLVER A LA SALA', action: () => this.leave(SCENES.Lobby, { action: 'resume' }) }] : []),
      { label: 'MENÚ PRINCIPAL', action: () => { clearActiveRoom(); this.leave(SCENES.Title, {}); } },
    ]);
  }

  private resume() {
    hideControlsHelp(this.hudScene);
    this.hudScene.hidePause();
    this.paused = false;
    this.acc = 0;
  }

  // ---------------------------------------------------------------- loop
  update(_time: number, delta: number) {
    if (!this.state) return;
    const t0 = performance.now();
    this.lastUpdateAt = t0;
    this.fpsSmooth = this.fpsSmooth * 0.95 + (1000 / Math.max(1, delta)) * 0.05;
    if ((!this.paused || this.net) && !this.ending) this.advance(delta);
    // HUD text/bars once per rendered frame (it was per sim step: up to 4-48 Text re-rasterisations per frame).
    if (this.hudDirty) { this.hudDirty = false; this.hudScene.updateHud(this.state, this.hudExtra()); }
    this.renderState(delta);
    const auth = this.net ? this.net.confirmedState : this.state;
    if (auth.phase === 'matchEnd' && !this.ending && auth.phaseFrame > 150) this.finishMatch();
    if (this.room) {
      const ph = this.room.snapshot.phase;
      if (this.phaseLog[this.phaseLog.length - 1] !== ph) this.phaseLog.push(ph);
    }
    const i = this.perfN++ % PERF_SAMPLES;
    this.perfDelta[i] = delta;
    this.perfCost[i] = performance.now() - t0;
  }

  /** Fixed-step accumulator. Offline drops time when far behind; online catches up (bounded) so peers stay in sync. */
  private advance(elapsedMs: number, stepCap?: number) {
    const online = !!this.net;
    this.acc += Math.min(elapsedMs, online ? 1000 : 250) * this.speed;
    let steps = 0;
    const maxSteps = (stepCap ?? (online ? ONLINE_MAX_STEPS_PER_FRAME : MAX_STEPS_PER_FRAME)) * this.speed;
    while (this.acc >= STEP_MS && steps < maxSteps) {
      const advanced = this.stepOnce();
      this.acc -= STEP_MS;
      steps++;
      // Online stall = remote is behind: more ticks this frame would only spam packets. Drop the debt (time sync).
      if (!advanced) { this.acc = Math.min(this.acc, STEP_MS); break; }
    }
    if (steps === maxSteps) this.acc = online ? Math.min(this.acc, STEP_MS * maxSteps) : 0; // fell behind: bound the debt
  }

  /** Online watchdog (setInterval): when rAF has stalled, step the sim without rendering so inputs/acks keep flowing. */
  private pump() {
    if (!this.net || this.ending || !this.state) return;
    const now = performance.now();
    const gap = now - this.lastUpdateAt;
    if (gap < PUMP_STALL_MS) return;
    this.lastUpdateAt = now;
    this.pumping = true;
    // Background tabs throttle timers to ~1 Hz: allow a full second of steps per pump (no rendering, so it's cheap).
    try { this.advance(gap, 60); } finally { this.pumping = false; }
  }

  private lastNetInfo: ReturnType<FightScene['netInfo']> | null = null;
  private netInfo(net: NetSession) {
    return { ...net.stats, roomPhases: [...this.phaseLog], closes: netDiag.closes.map((c) => ({ ...c })),
      warnings: netDiag.warnings.map((c) => ({ ...c })), reconnects: netDiag.reconnects, abilities: { ...this.abilityCount } };
  }

  private perfReport() {
    const n = Math.min(this.perfN, PERF_SAMPLES);
    const pct = (arr: Float32Array, count = n) => {
      const a = Array.from(arr.subarray(0, Math.min(count, PERF_SAMPLES))).sort((x, y) => x - y);
      const at = (q: number) => (a.length ? +a[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(2) : 0);
      return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: a.length ? +a[a.length - 1].toFixed(2) : 0 };
    };
    let over33 = 0;
    for (let i = 0; i < n; i++) if (this.perfDelta[i] > 33.4) over33++;
    // delta = time between frames; cost = FightScene.update() (sim + view updates); render = Phaser WebGL render pass (CPU side).
    return { frames: n, delta: pct(this.perfDelta), cost: pct(this.perfCost), render: pct(this.perfRender, this.renderN), hitches: over33 };
  }

  private stepOnline(net: NetSession): boolean {
    const me = this.room!.snapshot.me;
    const keys = this.inputMgr.samplePair(['p1keys', 'p2keys'])[0];
    const bits = this.paused ? 0 : this.onlineAutoplay ? this.localBot!.next(net.state, me) : keys;
    const t = net.tick(bits);
    this.state = net.state;
    // Desync audit trail for tests/tools: hash of the confirmed state every 60 confirmed frames.
    const cf = net.stats.confirmedFrame;
    if (cf % 60 === 0 && !this.hashLog[cf]) this.hashLog[cf] = sim.hashState(net.confirmedState);
    if (t.advanced) {
      this.stepsTotal++;
      for (const ev of t.events) {
        if (ABILITY_EVENTS.has(ev.type)) this.abilityCount.specials++;
        else if (ev.type === 'ultimateStart') this.abilityCount.ultimates++;
      }
      // VFX/audio only from the newest displayed frame (never from rollback re-simulation, never from the stall pump).
      if (t.events.length && !this.pumping) {
        this.vfx.handleEvents(t.events, this.state);
        for (const ev of t.events) audio.playEvent(ev);
      }
    }
    const silent = net.isRemoteSilent(1000);
    if (silent && !this.silentShown) this.hudScene.toast('CONEXIÓN INESTABLE…');
    this.silentShown = silent;
    this.hudDirty = true;
    return t.advanced;
  }

  /** One fixed step. Returns false when the online session stalled (waiting for the remote / time sync). */
  private stepOnce(): boolean {
    if (this.net) return this.stepOnline(this.net);
    const inputs = this.gatherInputs();
    sim.step(this.state, inputs);
    this.stepsTotal++;
    const events = this.state.events;
    if (events.length) {
      this.vfx.handleEvents(events, this.state);
      for (const ev of events) {
        audio.playEvent(ev);
        this.trackTraining(ev);
      }
    }
    this.hudDirty = true;
    return true;
  }

  private trackTraining(ev: SimEvent) {
    if (this.fightData.mode !== 'training') return;
    if ((ev.type === 'hit' || ev.type === 'counterHit' || ev.type === 'projectileHit') && ev.damage) {
      this.lastDamage = ev.damage;
      const defender = this.state.fighters[ev.player === 0 ? 1 : 0];
      this.lastComboDamage = defender.comboDamage;
    }
  }

  private hudExtra() {
    return {
      ping: this.fightData.mode === 'online' ? (this.net?.ping ?? null) : undefined,
      fps: Math.round(this.fpsSmooth),
      training: this.fightData.mode === 'training'
        ? { dummyMode: DUMMY_LABEL[this.dummyMode], lastDamage: this.lastDamage, comboDamage: this.lastComboDamage, regen: this.regen }
        : undefined,
    };
  }

  private renderState(delta: number) {
    const s = this.state;
    this.views[0].update(s.fighters[0], s);
    this.views[1].update(s.fighters[1], s);
    this.entityView.update(s.entities, s);
    this.camRig.update(s, delta);
    this.stage.update(delta, this.cameras.main);
    this.vfx.update(delta, s);
    if (this.debug) this.drawDebug();
  }

  private drawDebug() {
    const g = this.debugG!;
    const s = this.state;
    g.clear();
    const rect = (r: { x: number; y: number; w: number; h: number }, color: number, alpha: number) => {
      g.fillStyle(color, alpha);
      g.fillRect(r.x, GROUND_Y - r.y - r.h, r.w, r.h);
      g.lineStyle(2, color, 0.9);
      g.strokeRect(r.x, GROUND_Y - r.y - r.h, r.w, r.h);
    };
    for (const f of s.fighters) {
      rect(getHurtbox(f), f.invulnFrames > 0 ? 0x8888ff : 0x22ff66, 0.12);
      const hb = getActiveHitbox(s, f);
      if (hb) rect(hb, 0xff2244, 0.3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(f.x / FX, GROUND_Y - f.y / FX, 4);
    }
    for (const e of s.entities) rect(getEntityBox(e), 0xffaa00, 0.2);
    const line = (i: number) => {
      const f = s.fighters[i];
      return `P${i + 1} ${f.charId} mode=${f.mode}(${f.modeFrame}) anim=${f.anim}:${f.animFrame} move=${f.moveId ?? '-'}@${f.moveFrame} ` +
        `pos=(${(f.x / FX).toFixed(0)},${(f.y / FX).toFixed(0)}) vel=(${(f.vx / FX).toFixed(1)},${(f.vy / FX).toFixed(1)}) ` +
        `hp=${f.hp} en=${f.energy} ult=${f.ult} stun=${f.stunFrames} inv=${f.invulnFrames} form=${f.form ?? '-'}`;
    };
    if ((this.perfN & 3) !== 0) return; // text (+ state hash) every 4th frame: string building was a per-frame cost
    const ns = this.net?.stats;
    const netLine = ns
      ? `\nNET maxTick=${(ns.maxTickMs ?? 0).toFixed(1)}ms maxResim=${(ns.maxResimMs ?? 0).toFixed(1)}ms maxGap=${Math.round(ns.maxPacketGapMs ?? 0)}ms drops=${netDiag.reconnects} warn=${netDiag.warnings.length}` +
        `${netDiag.closes.length ? ` last=${netDiag.closes[netDiag.closes.length - 1].detail}` : ''}\nNET ping=${ns.ping ?? '-'} delay=${ns.inputDelay} rb=${ns.rollbacks}(max ${ns.maxRollback}) stalls=${ns.stalls} desync=${ns.desyncs} resync=${ns.resyncs} conf=${ns.confirmedFrame} local=${ns.localFrame} remote=${ns.remoteFrame}`
      : '';
    this.hudScene.setDebug(
      `FPS ${this.fpsSmooth.toFixed(0)} | frame ${s.frame} phase=${s.phase}(${s.phaseFrame}) hitstop=${s.hitstop} ` +
        `cine=${s.cinematic.active ? s.cinematic.framesLeft : 0} ents=${s.entities.length} hash=${sim.hashState(s).toString(16)}\n${line(0)}\n${line(1)}${netLine}`,
    );
  }

  // ---------------------------------------------------------------- exit
  private finishMatch() {
    this.ending = true;
    const s = this.net ? this.net.confirmedState : this.state;
    if (this.net && this.room) this.room.reportMatchEnd((s.winner ?? -1) as PlayerIndex | -1, s.frame, sim.hashState(s));
    const result: MatchResult = {
      mode: this.fightData.mode,
      p1: this.fightData.p1,
      p2: this.fightData.p2,
      winner: (s.winner ?? -1) as PlayerIndex | -1,
      roundWinners: [...s.roundWinners],
      roundWins: [s.roundWins[0], s.roundWins[1]],
      stats: [{ ...s.fighters[0].stats }, { ...s.fighters[1].stats }],
      durationFrames: s.frame,
      fightData: { ...this.fightData, seed: undefined },
    };
    (window as unknown as { __acLastResult?: MatchResult }).__acLastResult = result;
    this.leave(SCENES.PostMatch, { result });
  }

  private leave(target: string, data: object) {
    this.ending = true;
    this.hudScene.hidePause();
    this.cameras.main.fadeOut(300, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(HUD_SCENE);
      this.scene.start(target, data);
    });
  }

  private cleanup() {
    this.game.events.off(Phaser.Core.Events.PRE_RENDER, this.onPreRender);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPostRender);
    if (this.pumpTimer) clearInterval(this.pumpTimer);
    this.pumpTimer = null;
    for (const u of this.roomUnsubs) u();
    this.roomUnsubs = [];
    if (this.room) this.room.resumeProvider = null;
    this.lastNetInfo = this.net ? this.netInfo(this.net) : null;
    this.net?.dispose();
    this.net = null;
    this.room = null;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.inputMgr?.destroy();
    this.views?.forEach((v) => v.destroy());
    this.entityView?.destroy();
    this.vfx?.destroy();
    this.stage?.destroy();
    this.debugG?.destroy();
    this.debugG = null;
  }
}
