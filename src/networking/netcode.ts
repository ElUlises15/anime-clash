/**
 * In-match rollback netcode (NetSession). No Phaser.
 *
 * Frame indexing: "input frame f" is the input consumed by the step that takes a state from frame f to f+1.
 * A state "at frame F" has consumed inputs 0..F-1. `confirmedFrame`/`localFrame` are frames of confirmedState/state.
 * (So ResumeData/net:snapshot `inputsFrom` === `frame`: the first input the state still needs.)
 *
 * - Local input sampled at tick for localFrame L is scheduled for L + inputDelay (frames 0..delay-1 are 0 for both).
 * - confirmedState advances only through frames where both inputs are known (capped at localFrame).
 * - Predicted state (`state`) uses "last known remote input" for unknown remote frames. When a confirmed remote input
 *   differs from what was predicted, predicted = clone(confirmed) and the unconfirmed frames are re-simulated.
 * - Host sends hash(confirmedState) of the latest confirmed multiple of hashInterval in every packet; the guest compares
 *   and asks for a resync (reliable JSON snapshot) on mismatch.
 */
import type { InputBits } from '../game/input/buttons';
import { sim } from '../game/sim/engine';
import type { MatchState, PlayerIndex, SimEvent } from '../game/sim/types';
import { ENERGY_MAX, ULT_MAX } from '../game/sim/types';
import { decodePacket, encodeInputs, encodePing, encodePong, MAX_PACKET_INPUTS, type InputsPacket } from './inputCodec';
import type { MatchStart, NetSessionOptions, NetStats, NetTick, PeerLink, ResumeData, WireMessage } from './types';

const FRAME_MS = 1000 / 60;
const PING_INTERVAL_MS = 500;
const RESYNC_MIN_INTERVAL_MS = 1000;
const HASHES_KEPT = 20;
const HISTORY_KEPT = 240; // input frames kept behind confirmedFrame
const TIME_SYNC_MIN_GAP = 10; // ticks between time-sync skips
const TIME_SYNC_THRESHOLD = 1; // frames of (smoothed) advantage before skipping

const defaultNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class NetSession {
  readonly role: 'host' | 'guest';
  readonly me: PlayerIndex;
  readonly them: PlayerIndex;
  readonly match: MatchStart;
  readonly stats: NetStats;

  private link: PeerLink;
  private unsubs: (() => void)[] = [];
  private readonly now: () => number;
  private readonly delay: number;
  private readonly maxPrediction: number;
  private readonly hashInterval: number;
  private readonly matchId: number;

  private confirmed: MatchState;
  private confirmedFrame: number;
  private predicted: MatchState;
  private localFrame: number;

  private localInputs = new Map<number, InputBits>();
  private remoteInputs = new Map<number, InputBits>();
  /** Remote input used by the predicted state for each unconfirmed frame. */
  private predictedRemote = new Map<number, InputBits>();
  /** First remote frame not yet known (remote inputs known contiguously for frames < remoteContig). */
  private remoteContig: number;
  /** Highest local frame the remote has contiguously (from its ackFrame). */
  private remoteAck: number;
  private remoteDirty = false;

  // time sync
  private remoteFrameSeen = -1;
  private remoteFrameAt = 0;
  private advantage = 0;
  private ticksSinceSkip = 0;

  // ping
  private lastPingAt = -Infinity;
  private rtt: number | null = null;
  private lastPacketAt: number;
  private gotPacket = false;

  // desync detection
  private latestHash: { frame: number; hash: number } | null = null; // host: latest confirmed hash
  private ownHashes = new Map<number, number>(); // guest
  private hostHash: { frame: number; hash: number } | null = null; // guest: latest received from host
  private lastComparedFrame = -1;
  private lastResyncReqAt = -Infinity;
  /** Event keys already handed to the renderer, per predicted frame (so a rollback re-emits only what's new). */
  private shownEvents = new Map<number, Set<string>>();
  private outEvents: SimEvent[] = [];
  private pendingSnapshot: Extract<WireMessage, { t: 'net:snapshot' }> | null = null;

  constructor(opts: NetSessionOptions) {
    this.role = opts.role;
    this.me = opts.me;
    this.them = opts.me === 0 ? 1 : 0;
    this.match = opts.match;
    this.link = opts.link;
    this.now = opts.now ?? defaultNow;
    this.delay = Math.max(0, opts.match.inputDelay | 0);
    this.maxPrediction = Math.max(1, opts.maxPrediction ?? 8);
    this.hashInterval = Math.max(1, opts.hashInterval ?? 30);
    this.matchId = opts.match.matchId & 0xffff;
    this.lastPacketAt = this.now();
    this.stats = {
      ping: null, inputDelay: this.delay, rollbacks: 0, maxRollback: 0, stalls: 0, desyncs: 0, resyncs: 0,
      confirmedFrame: 0, remoteFrame: -1, localFrame: 0, maxTickMs: 0, maxResimMs: 0, maxPacketGapMs: 0, resimFrames: 0,
    };

    const r = opts.resume;
    if (r) {
      this.confirmed = sim.cloneState(r.state);
      this.confirmedFrame = r.frame;
      let latest = r.frame - 1;
      for (const p of [0, 1] as const) {
        const map = p === this.me ? this.localInputs : this.remoteInputs;
        r.inputs[p].forEach((bits, i) => map.set(r.inputsFrom + i, bits | 0));
        latest = Math.max(latest, r.inputsFrom + r.inputs[p].length - 1);
      }
      this.localFrame = Math.max(r.frame, latest + 1 - this.delay);
      // own inputs the host doesn't know yet (frames we skipped while away) are neutral
      for (let f = r.frame; f < this.localFrame + this.delay; f++) if (!this.localInputs.has(f)) this.localInputs.set(f, 0);
      this.remoteContig = r.frame;
      while (this.remoteInputs.has(this.remoteContig)) this.remoteContig++;
      // the host knows our inputs it gave us
      let ack = r.frame - 1;
      while (ack + 1 < r.inputsFrom + r.inputs[this.me].length && ack + 1 >= r.inputsFrom) ack++;
      this.remoteAck = ack;
    } else {
      const m = this.match;
      this.confirmed = sim.createMatch({ p1: m.p1, p2: m.p2, seed: m.seed, mode: 'online' });
      this.confirmedFrame = 0;
      this.localFrame = 0;
      for (let f = 0; f < this.delay; f++) { this.localInputs.set(f, 0); this.remoteInputs.set(f, 0); }
      this.remoteContig = this.delay;
      this.remoteAck = this.delay - 1;
    }
    this.predicted = this.confirmed; // replaced by resimulate()
    this.advanceConfirmed();
    this.resimulate();
    this.outEvents = []; // frames before the first tick were never "shown"; don't replay them
    this.syncStats();
    this.subscribe(this.link);
  }

  // ------------------------------------------------------------------ public API

  /** Current predicted state (render this). */
  get state(): MatchState { return this.predicted; }
  /** State advanced only with confirmed inputs (hashes, snapshots, authoritative result). */
  get confirmedState(): MatchState { return this.confirmed; }
  get ping(): number | null { return this.stats.ping; }
  get frame(): number { return this.localFrame; }

  tick(localBits: InputBits): NetTick {
    const t0 = this.now();
    let rolledBack = 0;
    if (this.pendingSnapshot) rolledBack += this.applySnapshot(this.pendingSnapshot);
    if (this.remoteDirty) rolledBack += this.processRemote();
    if (rolledBack > 0) this.stats.maxResimMs = Math.max(this.stats.maxResimMs!, this.now() - t0);
    this.maybePing();
    this.updateAdvantage();

    let advanced = false;
    this.ticksSinceSkip++;
    const predictionStall = this.localFrame - this.confirmedFrame >= this.maxPrediction;
    const syncSkip = !predictionStall && this.advantage > TIME_SYNC_THRESHOLD && this.ticksSinceSkip >= TIME_SYNC_MIN_GAP;
    if (predictionStall || syncSkip) {
      this.stats.stalls++;
      if (syncSkip) { this.ticksSinceSkip = 0; this.advantage -= 1; }
    } else {
      const target = this.localFrame + this.delay;
      if (!this.localInputs.has(target)) this.localInputs.set(target, localBits | 0);
      this.stepPredicted();
      advanced = true;
      // remote inputs may already cover the new frame
      this.advanceConfirmed();
    }
    this.sendInputs();
    if ((this.localFrame & 63) === 0) this.prune();
    this.syncStats();
    if (rolledBack > 0) {
      this.stats.rollbacks++;
      this.stats.maxRollback = Math.max(this.stats.maxRollback, rolledBack);
      this.stats.resimFrames! += rolledBack;
    }
    this.stats.maxTickMs = Math.max(this.stats.maxTickMs!, this.now() - t0);
    // Events of the new frame + events a rollback revealed (e.g. the remote's special) that were never shown. Rendering
    // never runs inside re-simulation; the caller gets one deduplicated batch per tick.
    const events = this.outEvents;
    this.outEvents = [];
    return { advanced, events, rolledBack };
  }

  /** True when no packet has arrived from the remote for `ms` (UI: "conexión inestable"). */
  isRemoteSilent(ms: number): boolean { return this.now() - this.lastPacketAt > ms; }

  /** Host: data a reconnecting guest needs (confirmed state + every input known after it). */
  snapshotForResume(): ResumeData {
    const from = this.confirmedFrame;
    return { frame: from, state: sim.cloneState(this.confirmed), inputs: this.knownInputsFrom(from), inputsFrom: from };
  }

  /** Swap the link after a reconnection; re-sends unacked inputs. */
  attachLink(link: PeerLink): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.link = link;
    // the new peer instance may know less than the old one acked; it has at least what the resume snapshot gave it
    this.remoteAck = Math.min(this.remoteAck, this.confirmedFrame - 1);
    this.lastPacketAt = this.now();
    this.lastPingAt = -Infinity;
    this.subscribe(link);
    this.sendInputs();
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  /** TEST ONLY: corrupt the confirmed state to exercise desync detection/resync. */
  __corruptForTest(): void {
    this.confirmed.fighters[0].hp -= 7;
    this.confirmed.rng = (this.confirmed.rng ^ 0x5a5a5a5a) >>> 0;
  }

  // ------------------------------------------------------------------ simulation

  private remoteGuess(f: number): InputBits {
    const known = this.remoteInputs.get(f);
    if (known !== undefined) return known;
    return this.remoteInputs.get(this.remoteContig - 1) ?? 0;
  }

  /** sim.step + the (test-only, deterministic, state-derived) meter top-up applied identically on both peers. */
  private simStep(state: MatchState, inputs: [InputBits, InputBits]): void {
    sim.step(state, inputs);
    if (this.match.testMeter && state.phase === 'fight') {
      for (const f of state.fighters) { f.energy = Math.min(ENERGY_MAX, f.energy + 15); f.ult = Math.min(ULT_MAX, f.ult + 6); }
    }
  }

  private pair(local: InputBits, remote: InputBits): [InputBits, InputBits] {
    return this.me === 0 ? [local, remote] : [remote, local];
  }

  private stepPredicted(): void {
    const f = this.localFrame;
    const r = this.remoteGuess(f);
    this.predictedRemote.set(f, r);
    this.simStep(this.predicted, this.pair(this.localInputs.get(f) ?? 0, r));
    this.localFrame++;
    const evs = this.predicted.events;
    if (evs.length) {
      let shown = this.shownEvents.get(f);
      if (!shown) { shown = new Set(); this.shownEvents.set(f, shown); }
      for (const e of evs) {
        const key = `${e.type}|${e.player}|${e.moveId ?? ''}|${e.visual ?? ''}`;
        if (shown.has(key)) continue;
        shown.add(key);
        this.outEvents.push(e);
      }
    }
  }

  /** Rebuild the predicted state from confirmed up to localFrame. Returns frames simulated. */
  private resimulate(): number {
    const target = this.localFrame;
    this.predicted = sim.cloneState(this.confirmed);
    this.localFrame = this.confirmedFrame;
    while (this.localFrame < target) this.stepPredicted();
    return target - this.confirmedFrame;
  }

  /** Advance confirmed through fully known frames. Returns true if a misprediction was found. */
  private advanceConfirmed(): boolean {
    let mispredicted = false;
    while (this.confirmedFrame < this.localFrame) {
      const f = this.confirmedFrame;
      const l = this.localInputs.get(f);
      const r = this.remoteInputs.get(f);
      if (l === undefined || r === undefined) break;
      if (this.predictedRemote.get(f) !== r) mispredicted = true;
      this.simStep(this.confirmed, this.pair(l, r));
      this.confirmedFrame++;
      if (this.confirmedFrame % this.hashInterval === 0) this.recordHash();
    }
    return mispredicted;
  }

  private processRemote(): number {
    this.remoteDirty = false;
    if (!this.advanceConfirmed()) return 0;
    return this.resimulate();
  }

  // ------------------------------------------------------------------ desync detection

  private recordHash(): void {
    const h = { frame: this.confirmedFrame, hash: sim.hashState(this.confirmed) };
    if (this.role === 'host') { this.latestHash = h; return; }
    this.ownHashes.set(h.frame, h.hash);
    if (this.ownHashes.size > HASHES_KEPT) this.ownHashes.delete(this.ownHashes.keys().next().value as number);
    this.compareHashes();
  }

  private compareHashes(): void {
    const hh = this.hostHash;
    if (!hh || hh.frame <= this.lastComparedFrame) return;
    const mine = this.ownHashes.get(hh.frame);
    if (mine === undefined) return;
    this.lastComparedFrame = hh.frame;
    if (mine === hh.hash) return;
    this.stats.desyncs++;
    const t = this.now();
    if (t - this.lastResyncReqAt < RESYNC_MIN_INTERVAL_MS) return;
    this.lastResyncReqAt = t;
    this.link.sendReliable({ t: 'net:resyncReq', matchId: this.match.matchId, frame: hh.frame });
  }

  /** Guest: replace confirmed with the host's snapshot. Returns frames re-simulated. */
  private applySnapshot(msg: Extract<WireMessage, { t: 'net:snapshot' }>): number {
    this.pendingSnapshot = null;
    this.confirmed = sim.cloneState(msg.state);
    this.confirmedFrame = msg.frame;
    msg.inputs[this.them].forEach((bits, i) => this.remoteInputs.set(msg.inputsFrom + i, bits | 0));
    msg.inputs[this.me].forEach((bits, i) => {
      if (!this.localInputs.has(msg.inputsFrom + i)) this.localInputs.set(msg.inputsFrom + i, bits | 0);
    });
    if (this.localFrame < msg.frame) this.localFrame = msg.frame;
    for (let f = msg.frame; f < this.localFrame + this.delay; f++) if (!this.localInputs.has(f)) this.localInputs.set(f, 0);
    this.remoteContig = msg.frame;
    while (this.remoteInputs.has(this.remoteContig)) this.remoteContig++;
    this.ownHashes.clear();
    this.lastComparedFrame = Math.max(this.lastComparedFrame, msg.frame);
    this.predictedRemote.clear();
    this.predicted = this.confirmed;
    this.advanceConfirmed();
    this.stats.resyncs++;
    return this.resimulate();
  }

  private knownInputsFrom(from: number): [InputBits[], InputBits[]] {
    const out: [InputBits[], InputBits[]] = [[], []];
    for (const p of [0, 1] as const) {
      const map = p === this.me ? this.localInputs : this.remoteInputs;
      for (let f = from; map.has(f); f++) out[p].push(map.get(f)!);
    }
    return out;
  }

  // ------------------------------------------------------------------ wire

  private subscribe(link: PeerLink): void {
    this.unsubs.push(link.onUnreliable((d) => this.onPacket(d)));
    this.unsubs.push(link.onReliable((m) => this.onMessage(m)));
  }

  private onPacket(data: Uint8Array): void {
    const p = decodePacket(data);
    if (!p) return;
    const t = this.now();
    if (this.gotPacket) this.stats.maxPacketGapMs = Math.max(this.stats.maxPacketGapMs!, t - this.lastPacketAt);
    this.gotPacket = true;
    this.lastPacketAt = t;
    if (p.type === 'ping') { this.link.sendUnreliable(encodePong(p.ts)); return; }
    if (p.type === 'pong') {
      const sample = this.now() - p.ts;
      if (sample < 0 || !Number.isFinite(sample)) return;
      this.rtt = this.rtt === null ? sample : this.rtt * 0.8 + sample * 0.2;
      this.stats.ping = Math.round(this.rtt);
      return;
    }
    if (p.matchId !== this.matchId) return;
    this.onInputs(p);
  }

  private onInputs(p: InputsPacket): void {
    for (let i = 0; i < p.inputs.length; i++) {
      const f = p.startFrame + i;
      if (f < this.confirmedFrame - HISTORY_KEPT || this.remoteInputs.has(f)) continue; // never overwrite
      this.remoteInputs.set(f, p.inputs[i]);
      this.remoteDirty = true;
    }
    while (this.remoteInputs.has(this.remoteContig)) this.remoteContig++;
    if (p.ackFrame > this.remoteAck) this.remoteAck = p.ackFrame;
    if (p.localFrame > this.remoteFrameSeen) {
      this.remoteFrameSeen = p.localFrame;
      this.remoteFrameAt = this.now();
    }
    if (p.hash && this.role === 'guest' && (!this.hostHash || p.hash.frame > this.hostHash.frame)) {
      this.hostHash = p.hash;
      this.compareHashes();
    }
  }

  private onMessage(m: WireMessage): void {
    if (m.t === 'net:resyncReq') {
      if (this.role !== 'host' || m.matchId !== this.match.matchId) return;
      const from = this.confirmedFrame;
      this.link.sendReliable({
        t: 'net:snapshot', matchId: this.match.matchId, frame: from, state: sim.cloneState(this.confirmed),
        inputs: this.knownInputsFrom(from), inputsFrom: from,
      });
    } else if (m.t === 'net:snapshot') {
      if (this.role !== 'guest' || m.matchId !== this.match.matchId) return;
      this.lastPacketAt = this.now();
      this.pendingSnapshot = m; // applied at the start of the next tick
    }
  }

  private sendInputs(): void {
    if (!this.link.open) return;
    const start = this.remoteAck + 1;
    const end = Math.min(this.localFrame + this.delay, start + MAX_PACKET_INPUTS); // exclusive
    const inputs: InputBits[] = [];
    for (let f = start; f < end; f++) {
      const v = this.localInputs.get(f);
      if (v === undefined) break;
      inputs.push(v);
    }
    const data = encodeInputs({
      matchId: this.matchId, startFrame: Math.max(0, start), inputs, ackFrame: this.remoteContig - 1,
      localFrame: this.localFrame, hash: this.role === 'host' ? this.latestHash ?? undefined : undefined,
    });
    this.link.sendUnreliable(data);
  }

  private maybePing(): void {
    const t = this.now();
    if (t - this.lastPingAt < PING_INTERVAL_MS || !this.link.open) return;
    this.lastPingAt = t;
    this.link.sendUnreliable(encodePing(t));
  }

  /** GGPO-style frame advantage: local frame minus the estimated current remote frame (smoothed). */
  private updateAdvantage(): void {
    if (this.remoteFrameSeen < 0) return;
    const elapsed = this.now() - this.remoteFrameAt + (this.rtt ?? 0) / 2;
    const remoteNow = this.remoteFrameSeen + elapsed / FRAME_MS;
    this.advantage = this.advantage * 0.9 + (this.localFrame - remoteNow) * 0.1;
  }

  private prune(): void {
    const min = this.confirmedFrame - HISTORY_KEPT;
    for (const map of [this.localInputs, this.remoteInputs]) {
      for (const f of map.keys()) if (f < min) map.delete(f);
    }
    for (const f of this.predictedRemote.keys()) if (f < this.confirmedFrame) this.predictedRemote.delete(f);
    for (const f of this.shownEvents.keys()) if (f < this.confirmedFrame) this.shownEvents.delete(f);
  }

  private syncStats(): void {
    this.stats.confirmedFrame = this.confirmedFrame;
    this.stats.localFrame = this.localFrame;
    this.stats.remoteFrame = this.remoteFrameSeen;
  }
}
