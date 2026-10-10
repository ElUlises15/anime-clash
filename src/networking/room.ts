import { PROTOCOL_VERSION, RECONNECT_WINDOW_MS } from './types';
import type { HostEndpoint, MatchStart, NetError, PeerLink, PlayerSlot, ResumeData, Room, RoomEvent, RoomPhase, RoomSnapshot, RoomWire, TransportFactory, WireMessage } from './types';
import type { PlayerIndex } from '../game/sim/types';
import { logClose, netDiag } from './diag';
import { generateRoomCode, normalizeRoomCode, roomUrl } from './roomCode';

export interface RoomTimers {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: any): void;
}
export interface RoomOptions {
  name?: string;
  now?: () => number;
  urlBase?: string;
  timers?: RoomTimers;
}
export interface HostRoomOptions extends RoomOptions { code?: string; rand?: () => number; countdownMs?: number }
/** Adapter for LoopbackNetwork.schedule; cancellation suppresses the queued callback. */
export function virtualRoomTimers(network: { schedule(ms: number, fn: () => void): void }): RoomTimers {
  return { setTimeout: (callback, ms) => { const token = { cancelled: false }; network.schedule(ms, () => { if (!token.cancelled) callback(); }); return token; },
    clearTimeout: token => { if (token) token.cancelled = true; } };
}
const emptySlot = (name = '', connected = false): PlayerSlot => ({ name, connected, charId: null, cursor: null, ready: false, rematch: false });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const failure = (kind: NetError['kind'], message: string): NetError => ({ kind, message });

export class RoomSession implements Room {
  resumeProvider: (() => ResumeData | null) | null = null;
  /** TEST ONLY (host): matches started from now on carry MatchStart.testMeter (e2e ability-spam stress). */
  testMeter = false;
  private state: RoomWire;
  private currentLink: PeerLink | null = null;
  private endpoint: HostEndpoint | null = null;
  private listeners = new Set<(e: RoomEvent) => void>();
  private unobservedStart: Extract<RoomEvent, { type: 'matchStart' }> | null = null;
  private subscriptions: (() => void)[] = [];
  private now: () => number;
  private timers: RoomTimers;
  private rand: () => number;
  private countdownMs: number;
  private countdown: unknown;
  private pingTimer: unknown;
  private deadlineTimer: unknown;
  private retryTimer: unknown;
  private handshakeTimer: unknown;
  private ping: number | null = null;
  private error: NetError | null = null;
  private deadline: number | null = null;
  private beforeDrop: RoomPhase = 'selecting';
  private returning = false;
  private pendingResume: MatchStart | null = null;
  private joinResolve: (() => void) | null = null;
  private joinReject: ((e: NetError) => void) | null = null;
  private readonly role: 'host' | 'guest';
  private readonly me: PlayerIndex;
  private readonly url: string;
  private readonly name: string;

  private constructor(private factory: TransportFactory, role: 'host' | 'guest', code: string, options: HostRoomOptions) {
    this.role = role; this.me = role === 'host' ? 0 : 1;
    this.name = (options.name || (role === 'host' ? 'Host' : 'Guest')).slice(0, 64);
    this.now = options.now || Date.now; this.rand = options.rand || Math.random;
    this.countdownMs = Math.max(0, options.countdownMs ?? 3000);
    this.timers = options.timers || { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: id => clearTimeout(id) };
    this.url = roomUrl(code, options.urlBase);
    this.state = { code, phase: role === 'host' ? 'waiting' : 'connecting', players: [emptySlot(role === 'host' ? this.name : '', role === 'host'), emptySlot(role === 'guest' ? this.name : '')], match: null, matchCount: 0, lastWinner: null };
  }
  static async host(factory: TransportFactory, options: HostRoomOptions = {}): Promise<RoomSession> {
    if (options.code && !normalizeRoomCode(options.code)) throw failure('unknown', 'Invalid room code');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = attempt === 0 && options.code ? normalizeRoomCode(options.code)! : generateRoomCode(options.rand);
      try {
        const endpoint = await factory.host(code);
        const room = new RoomSession(factory, 'host', code, options); room.endpoint = endpoint;
        endpoint.onConnection(link => room.accept(link));
        endpoint.onError(error => { room.error = error; room.changed(); });
        return room;
      } catch (e) { if ((e as NetError).kind !== 'id-taken' || attempt === 4) throw e; }
    }
    throw failure('id-taken', 'Could not allocate a room code');
  }
  static async join(factory: TransportFactory, code: string, options: RoomOptions = {}): Promise<RoomSession> {
    const normalized = normalizeRoomCode(code);
    if (!normalized) throw failure('unknown', 'Invalid room code');
    const room = new RoomSession(factory, 'guest', normalized, options);
    const link = await factory.join(normalized);
    await new Promise<void>((resolve, reject) => {
      room.joinResolve = resolve; room.joinReject = reject; room.attach(link);
      room.handshakeTimer = room.later(15000, () => room.rejectJoin(failure('timeout', 'Room handshake timed out')));
      link.sendReliable({ t: 'hello', version: PROTOCOL_VERSION, name: room.name });
    });
    return room;
  }
  get snapshot(): RoomSnapshot { return { ...copy(this.state), role: this.role, me: this.me, ping: this.ping === null ? null : Math.round(this.ping), error: this.error && { ...this.error }, url: this.url, reconnectDeadline: this.deadline }; }
  get link(): PeerLink | null { return this.currentLink; }
  on(cb: (e: RoomEvent) => void): () => void {
    this.listeners.add(cb);
    const start = this.unobservedStart; this.unobservedStart = null;
    if (start) queueMicrotask(() => { if (this.listeners.has(cb) && this.state.phase === 'fighting' && this.state.match?.matchId === start.match.matchId) cb(start); });
    return () => { this.listeners.delete(cb); };
  }
  private emit(event: RoomEvent): void {
    // A new page can receive resume data before its join() promise's caller subscribes.
    if (event.type === 'matchStart' && this.listeners.size === 0) this.unobservedStart = event;
    for (const cb of [...this.listeners]) cb(event);
  }
  private event(type: 'opponentReturned' | 'toSelect' | 'toLobby'): void { this.emit({ type, room: this.snapshot }); }
  private changed(broadcast = false): void { if (broadcast && this.role === 'host') this.currentLink?.sendReliable({ t: 'room', room: copy(this.state) }); this.emit({ type: 'change', room: this.snapshot }); }
  private later(ms: number, fn: () => void): unknown { return this.timers.setTimeout(fn, ms); }
  private cancel(handle: unknown): void { if (handle !== undefined) this.timers.clearTimeout(handle); }
  private detach(): void { this.subscriptions.splice(0).forEach(fn => fn()); this.cancel(this.pingTimer); }
  private attach(link: PeerLink): void {
    this.detach(); this.currentLink = link;
    this.subscriptions.push(link.onReliable(msg => this.receive(msg)), link.onClose(reason => this.dropped(reason)));
    const tick = () => { if (this.currentLink !== link || !link.open) return; link.sendReliable({ t: 'ping', ts: this.now() }); this.pingTimer = this.later(1000, tick); };
    this.pingTimer = this.later(1000, tick);
  }
  private accept(link: PeerLink): void {
    // A link is provisional until hello; never replace the active guest on room-full.
    let done = false;
    const timer = this.later(15000, () => { if (!done) { done = true; off(); link.close(); } });
    const off = link.onReliable(msg => {
      if (done || msg.t !== 'hello') return;
      done = true; off(); this.cancel(timer);
      const reject = (e: NetError) => { link.sendReliable({ t: 'reject', reason: e.kind, message: e.message }); this.later(100, () => link.close()); };
      if (msg.version !== PROTOCOL_VERSION) { reject(failure('version', 'Game versions do not match')); return; }
      if (this.state.phase === 'closed' || this.state.players[1].connected) { reject(failure('room-full', 'Room is full')); return; }
      const resumed = this.state.phase === 'reconnecting';
      this.cancel(this.deadlineTimer); this.deadline = null;
      this.attach(link);
      this.state.players[1].connected = true;
      this.state.players[1].name = typeof msg.name === 'string' ? msg.name.slice(0, 64) : 'Guest';
      this.state.phase = resumed ? this.beforeDrop : 'selecting';
      // Additive wire metadata lets a fresh page identify a restored slot as well.
      const welcome = { t: 'welcome' as const, version: PROTOCOL_VERSION, room: copy(this.state), resumed };
      link.sendReliable(welcome); this.changed(true);
      if (resumed) {
        this.event('opponentReturned');
        if (this.state.phase === 'fighting' && this.state.match) {
          const resume = this.resumeProvider?.();
          if (resume) { link.sendReliable({ t: 'start', match: this.state.match }); link.sendReliable({ t: 'net:snapshot', matchId: this.state.match.matchId, ...resume }); }
        }
        if (this.state.phase === 'ready') this.updateReady();
      }
    });
  }
  private receive(msg: WireMessage): void {
    if (this.state.phase === 'closed' || !msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') { if (Number.isFinite(msg.ts)) this.currentLink?.sendReliable({ t: 'pong', ts: msg.ts }); return; }
    if (msg.t === 'pong') {
      const rtt = this.now() - msg.ts;
      if (Number.isFinite(rtt) && rtt >= 0) { this.ping = this.ping === null ? rtt : this.ping * 0.8 + rtt * 0.2; this.changed(); } return;
    }
    if (msg.t === 'leave') { if (this.role === 'host') this.finalGuestLeft(); else this.closeRoom('Host left the room'); return; }
    if (this.role === 'guest') {
      if (msg.t === 'reject') { this.rejectJoin(failure(msg.reason, msg.message)); return; }
      if (msg.t === 'welcome') {
        if (msg.version !== PROTOCOL_VERSION) { this.rejectJoin(failure('version', 'Game versions do not match')); return; }
        const returned = this.returning || (msg as typeof msg & { resumed?: boolean }).resumed === true;
        this.state = copy(msg.room); this.cancel(this.deadlineTimer); this.cancel(this.retryTimer); this.cancel(this.handshakeTimer); this.deadline = null;
        this.pendingResume = this.state.phase === 'fighting' ? this.state.match : null;
        this.returning = false; this.changed(); this.joinResolve?.(); this.joinResolve = null; this.joinReject = null;
        if (returned) { this.event('opponentReturned'); }
      } else if (msg.t === 'room') {
        this.state = copy(msg.room); this.changed();
      } else if (msg.t === 'start') {
        if (this.pendingResume) { this.pendingResume = msg.match; return; }
        if (this.state.phase !== 'ready' && this.state.phase !== 'fighting' && this.state.phase !== 'postmatch') return;
        this.state.match = copy(msg.match); this.state.phase = 'fighting'; this.state.matchCount = msg.match.matchId; this.changed();
        this.emit({ type: 'matchStart', match: copy(msg.match), room: this.snapshot });
      } else if (msg.t === 'net:snapshot' && this.pendingResume?.matchId === msg.matchId) {
        const match = this.pendingResume; this.pendingResume = null;
        this.emit({ type: 'matchStart', match: copy(match), room: this.snapshot, resume: { frame: msg.frame, state: msg.state, inputs: msg.inputs, inputsFrom: msg.inputsFrom } });
      } else if (msg.t === 'changeFighter') this.event('toSelect');
      else if (msg.t === 'returnToRoom') this.event('toLobby');
      return;
    }
    // Slots are implicit in the authenticated link; refuse attempts to target P1.
    if ((msg as WireMessage & { slot?: number; playerIndex?: number }).slot === 0 || (msg as WireMessage & { playerIndex?: number }).playerIndex === 0) return;
    this.action(msg, 1);
  }
  private action(msg: WireMessage, index: PlayerIndex): void {
    const phase = this.state.phase, player = this.state.players[index];
    if (msg.t === 'select' && (phase === 'selecting' || phase === 'ready') && (msg.charId === null || (typeof msg.charId === 'string' && msg.charId.length > 0 && msg.charId.length < 128))) {
      player.charId = msg.charId; player.ready = false; this.updateReady();
    } else if (msg.t === 'cursor' && (phase === 'selecting' || phase === 'ready') && Number.isInteger(msg.index) && msg.index >= 0) player.cursor = msg.index;
    else if (msg.t === 'ready' && (phase === 'selecting' || phase === 'ready') && typeof msg.ready === 'boolean') { player.ready = msg.ready && !!player.charId; this.updateReady(); }
    else if (msg.t === 'rematch' && phase === 'postmatch') {
      player.rematch = true;
      if (this.state.players.every(p => p.rematch && p.connected && p.charId)) { this.startMatch(); return; }
    } else if ((msg.t === 'changeFighter' || msg.t === 'returnToRoom') && (phase === 'postmatch' || phase === 'fighting' || phase === 'selecting' || phase === 'ready')) {
      this.cancel(this.countdown); this.countdown = undefined; this.state.phase = 'selecting';
      for (const p of this.state.players) { p.ready = false; p.rematch = false; if (msg.t === 'changeFighter') { p.charId = null; p.cursor = null; } }
      this.changed(true); this.currentLink?.sendReliable(msg); this.event(msg.t === 'changeFighter' ? 'toSelect' : 'toLobby'); return;
    } else if (msg.t === 'matchEnd' && (phase === 'fighting' || phase === 'postmatch') && msg.matchId === this.state.match?.matchId) {
      // Guest reports never decide the winner or advance the host phase.
      if (index !== 0) return;
      this.state.phase = 'postmatch'; this.state.lastWinner = msg.winner;
      for (const p of this.state.players) p.rematch = false;
    } else return;
    this.changed(this.role === 'host');
  }
  private dispatch(msg: WireMessage): void {
    if (!['selecting', 'ready', 'fighting', 'postmatch'].includes(this.state.phase)) return;
    if (this.role === 'host') this.action(msg, 0);
    else {
      if (msg.t === 'select' || msg.t === 'ready' || msg.t === 'cursor') this.action(msg, 1);
      this.currentLink?.sendReliable(msg);
    }
  }
  selectCharacter(charId: string | null): void { this.dispatch({ t: 'select', charId }); }
  setCursor(index: number): void { this.dispatch({ t: 'cursor', index }); }
  setReady(ready: boolean): void { this.dispatch({ t: 'ready', ready }); }
  requestRematch(): void { this.dispatch({ t: 'rematch' }); }
  changeFighter(): void { this.dispatch({ t: 'changeFighter' }); }
  returnToRoom(): void { this.dispatch({ t: 'returnToRoom' }); }
  reportMatchEnd(winner: PlayerIndex | -1, frame: number, hash: number): void {
    if (!this.state.match || this.state.phase !== 'fighting') return;
    const msg: WireMessage = { t: 'matchEnd', matchId: this.state.match.matchId, winner, frame, hash };
    if (this.role === 'host') this.action(msg, 0);
    else { this.state.phase = 'postmatch'; this.state.lastWinner = winner; this.changed(); this.currentLink?.sendReliable(msg); }
  }
  private updateReady(): void {
    if (this.role !== 'host') return;
    this.cancel(this.countdown); this.countdown = undefined;
    if (!this.state.players.every(p => p.ready && p.charId && p.connected)) { this.state.phase = 'selecting'; return; }
    this.state.phase = 'ready';
    this.countdown = this.later(this.countdownMs, () => { this.countdown = undefined; if (this.state.phase === 'ready' && this.state.players.every(p => p.ready && p.connected)) this.startMatch(); });
  }
  private startMatch(): void {
    const match: MatchStart = { matchId: ++this.state.matchCount, seed: Math.floor(this.rand() * 0x80000000) >>> 0, p1: this.state.players[0].charId!, p2: this.state.players[1].charId!, stage: 'arena', inputDelay: this.ping === null ? 3 : this.ping <= 60 ? 2 : this.ping <= 130 ? 3 : 4, ...(this.testMeter ? { testMeter: true } : {}) };
    this.state.match = match; this.state.phase = 'fighting'; this.state.lastWinner = null;
    for (const p of this.state.players) p.rematch = false;
    this.changed(true); this.currentLink?.sendReliable({ t: 'start', match });
    this.emit({ type: 'matchStart', match: copy(match), room: this.snapshot });
  }
  private dropped(reason: string): void {
    if (this.state.phase === 'closed' || this.state.phase === 'waiting') return;
    if (this.joinReject) { this.rejectJoin(failure('network', reason)); return; }
    this.detach(); this.currentLink = null; this.pendingResume = null;
    if (this.state.phase === 'reconnecting') {
      if (this.role === 'guest') { this.cancel(this.retryTimer); this.retryTimer = this.later(2000, () => { void this.retry(); }); }
      return;
    }
    netDiag.reconnects++; logClose('room-reconnecting', `${this.state.phase}: ${reason}`);
    this.beforeDrop = this.state.phase; this.state.phase = 'reconnecting'; this.state.players[this.me === 0 ? 1 : 0].connected = false;
    this.cancel(this.countdown); this.countdown = undefined;
    this.deadline = this.now() + RECONNECT_WINDOW_MS;
    this.changed(); this.emit({ type: 'opponentLeft', final: false, room: this.snapshot });
    this.deadlineTimer = this.later(RECONNECT_WINDOW_MS, () => { if (this.role === 'host') this.finalGuestLeft(); else this.closeRoom('Could not reconnect to the host'); });
    if (this.role === 'guest') { this.returning = true; this.retryTimer = this.later(2000, () => { void this.retry(); }); }
  }
  private async retry(): Promise<void> {
    if (this.state.phase !== 'reconnecting' || this.deadline === null) return;
    try {
      const link = await this.factory.join(this.state.code, Math.min(2000, Math.max(1, this.deadline - this.now())));
      if (this.state.phase !== 'reconnecting') { link.close(); return; }
      this.attach(link); link.sendReliable({ t: 'hello', version: PROTOCOL_VERSION, name: this.name, resume: true });
      this.retryTimer = this.later(2000, () => {
        if (this.state.phase !== 'reconnecting') return;
        this.detach(); this.currentLink = null; link.close(); void this.retry();
      });
    } catch { if (this.state.phase === 'reconnecting') this.retryTimer = this.later(2000, () => { void this.retry(); }); }
  }
  private finalGuestLeft(): void {
    this.cancel(this.deadlineTimer); this.cancel(this.countdown); this.deadline = null; this.countdown = undefined;
    const link = this.currentLink; this.detach(); this.currentLink = null;
    this.state.players[1] = emptySlot(); this.state.players[0].ready = false; this.state.players[0].rematch = false;
    this.state.phase = 'waiting'; this.state.match = null; link?.close();
    this.changed(); this.emit({ type: 'opponentLeft', final: true, room: this.snapshot });
  }
  private rejectJoin(error: NetError): void {
    this.error = error; const reject = this.joinReject; this.joinResolve = null; this.joinReject = null;
    this.closeRoom(error.message); reject?.(error);
  }
  private closeRoom(reason: string): void {
    if (this.state.phase === 'closed') return;
    this.state.phase = 'closed'; this.deadline = null;
    for (const handle of [this.countdown, this.deadlineTimer, this.retryTimer, this.handshakeTimer]) this.cancel(handle);
    this.detach(); const link = this.currentLink; this.currentLink = null; link?.close(); this.endpoint?.close(); this.endpoint = null;
    this.changed(); this.emit({ type: 'closed', reason, room: this.snapshot });
  }
  leave(): void {
    this.currentLink?.sendReliable({ t: 'leave' });
    // Keep the channel alive briefly so the reliable leave reaches the remote peer.
    const link = this.currentLink; this.detach(); this.currentLink = null;
    const endpoint = this.endpoint; this.endpoint = null;
    this.closeRoom('Left the room'); this.later(100, () => { link?.close(); endpoint?.close(); });
  }
}
