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

const STEP_MS = 1000 / SIM_HZ;
const MAX_STEPS_PER_FRAME = 4;
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
  private debug = false;
  private debugG: Phaser.GameObjects.Graphics | null = null;
  private dummyMode: DummyMode | 'bot' = 'idle';
  private regen = true;
  private lastDamage = 0;
  private lastComboDamage = 0;
  private fpsSmooth = 60;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private stepsTotal = 0;

  constructor() { super(SCENES.Fight); }

  create(data: FightSceneData) {
    this.fightData = {
      ...data,
      controllers: data.autoplay ? ['cpu', 'cpu'] : data.controllers ?? ['p1keys', 'p2keys'],
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
    this.state = this.newMatch();

    this.cameras.main.setBackgroundColor('#07060c');
    this.stage = new StageView(this);
    this.camRig = new CameraRig(this);
    this.views = [new FighterView(this, this.defs[0], 0), new FighterView(this, this.defs[1], 1)];
    this.entityView = new EntityView(this, this.views);
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
    if (this.hudScene?.paused) {
      if (e.code === 'Escape') this.resume();
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.hudScene.movePause(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.hudScene.movePause(1);
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') this.hudScene.confirmPause();
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
    const items = [
      { label: 'CONTINUAR', action: () => this.resume() },
      ...(this.fightData.mode === 'training' ? [{ label: 'RESET', action: () => { this.resetTraining(); this.resume(); } }] : []),
      { label: 'CAMBIAR LUCHADOR', action: () => this.leave(SCENES.Select, { mode: this.fightData.mode }) },
      { label: 'MENÚ PRINCIPAL', action: () => this.leave(SCENES.Title, {}) },
    ];
    this.hudScene.showPause(items);
    audio.playSfx?.('uiConfirm');
  }

  private resume() {
    this.hudScene.hidePause();
    this.paused = false;
    this.acc = 0;
  }

  // ---------------------------------------------------------------- loop
  update(_time: number, delta: number) {
    if (!this.state) return;
    this.fpsSmooth = this.fpsSmooth * 0.95 + (1000 / Math.max(1, delta)) * 0.05;
    if (!this.paused && !this.ending) {
      this.acc += Math.min(delta, 250);
      let steps = 0;
      while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.stepOnce();
        this.acc -= STEP_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // fell behind: drop time instead of spiralling
    }
    this.renderState(delta);
    if (this.state.phase === 'matchEnd' && !this.ending && this.state.phaseFrame > 150) this.finishMatch();
  }

  private stepOnce() {
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
    this.hudScene.updateHud(this.state, this.hudExtra());
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
      ping: this.fightData.mode === 'online' ? null : undefined,
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
    this.hudScene.setDebug(
      `FPS ${this.fpsSmooth.toFixed(0)} | frame ${s.frame} phase=${s.phase}(${s.phaseFrame}) hitstop=${s.hitstop} ` +
        `cine=${s.cinematic.active ? s.cinematic.framesLeft : 0} ents=${s.entities.length} hash=${sim.hashState(s).toString(16)}\n${line(0)}\n${line(1)}`,
    );
  }

  // ---------------------------------------------------------------- exit
  private finishMatch() {
    this.ending = true;
    const s = this.state;
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
