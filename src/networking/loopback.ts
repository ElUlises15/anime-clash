/**
 * In-memory transport for tests (and offline demos). Simulates latency, jitter and packet loss.
 *
 * Time model: by default a VIRTUAL clock — nothing is delivered until you call `net.advance(ms)` (deterministic tests).
 * Pass `{ realtime: true }` to deliver with setTimeout instead.
 * Reliable channel: ordered, never dropped, delayed by latency (+jitter, but never reordered).
 * Unreliable channel: independent delay per packet (can reorder), dropped with probability `loss`.
 */
import type { HostEndpoint, NetError, PeerLink, TransportFactory, WireMessage } from './types';
import { PEER_ID_PREFIX } from './types';

export interface LoopbackOptions {
  latencyMs?: number; // one-way
  jitterMs?: number;
  loss?: number; // 0..1, unreliable only
  seed?: number;
  realtime?: boolean;
}

type Task = { at: number; seq: number; fn: () => void };

export class LoopbackNetwork {
  opts: Required<LoopbackOptions>;
  private hosts = new Map<string, LoopbackHost>();
  private queue: Task[] = [];
  private seq = 0;
  private rng: number;
  /** Virtual time (ms). */
  time = 0;
  private linkSeq = 0;

  constructor(opts: LoopbackOptions = {}) {
    this.opts = { latencyMs: 0, jitterMs: 0, loss: 0, seed: 12345, realtime: false, ...opts };
    this.rng = this.opts.seed >>> 0 || 1;
  }

  now = (): number => (this.opts.realtime ? Date.now() : this.time);

  random(): number {
    let x = this.rng;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.rng = x;
    return x / 0x100000000;
  }

  schedule(delayMs: number, fn: () => void): void {
    if (this.opts.realtime) { setTimeout(fn, delayMs); return; }
    this.queue.push({ at: this.time + delayMs, seq: this.seq++, fn });
  }

  /** Advance virtual time, delivering everything due (in time order). */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      let best = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const q = this.queue[i];
        if (q.at > end) continue;
        if (best < 0 || q.at < this.queue[best].at || (q.at === this.queue[best].at && q.seq < this.queue[best].seq)) best = i;
      }
      if (best < 0) break;
      const task = this.queue.splice(best, 1)[0];
      this.time = Math.max(this.time, task.at);
      task.fn();
    }
    this.time = end;
  }

  /** Flush all pending tasks (advances time as needed). */
  flush(maxMs = 60_000): void { this.advance(maxMs); }

  delay(): number {
    const j = this.opts.jitterMs > 0 ? this.random() * this.opts.jitterMs : 0;
    return this.opts.latencyMs + j;
  }

  factory(): LoopbackFactory { return new LoopbackFactory(this); }

  _registerHost(code: string, h: LoopbackHost): void { this.hosts.set(code, h); }
  _unregisterHost(code: string, h: LoopbackHost): void { if (this.hosts.get(code) === h) this.hosts.delete(code); }
  _getHost(code: string): LoopbackHost | undefined { return this.hosts.get(code); }
  _nextLinkId(): string { return `loop-${++this.linkSeq}`; }

  /** Test helper: hard-drop every open link (simulates network loss). */
  severAll(): void { for (const h of this.hosts.values()) h._severAll(); }
}

export class LoopbackLink implements PeerLink {
  readonly id: string;
  open = true;
  other: LoopbackLink | null = null;
  private relCbs = new Set<(m: WireMessage) => void>();
  private unrelCbs = new Set<(d: Uint8Array) => void>();
  private closeCbs = new Set<(r: string) => void>();
  private lastReliableAt = 0;
  /** Per-link overrides (e.g. block one direction). */
  dropAll = false;

  constructor(private net: LoopbackNetwork, id: string) { this.id = id; }

  sendReliable(msg: WireMessage): void {
    if (!this.open || !this.other) return;
    const target = this.other;
    const payload = JSON.parse(JSON.stringify(msg)) as WireMessage; // enforce JSON-serialisable
    const at = Math.max(this.net.now() + this.net.delay(), this.lastReliableAt);
    this.lastReliableAt = at;
    this.net.schedule(at - this.net.now(), () => { if (target.open) target._deliverReliable(payload); });
  }

  sendUnreliable(data: Uint8Array): void {
    if (!this.open || !this.other || this.dropAll) return;
    if (this.net.opts.loss > 0 && this.net.random() < this.net.opts.loss) return;
    const target = this.other;
    const copy = new Uint8Array(data);
    this.net.schedule(this.net.delay(), () => { if (target.open) target._deliverUnreliable(copy); });
  }

  onReliable(cb: (m: WireMessage) => void) { this.relCbs.add(cb); return () => { this.relCbs.delete(cb); }; }
  onUnreliable(cb: (d: Uint8Array) => void) { this.unrelCbs.add(cb); return () => { this.unrelCbs.delete(cb); }; }
  onClose(cb: (r: string) => void) { this.closeCbs.add(cb); return () => { this.closeCbs.delete(cb); }; }

  close(): void { this._close('closed by local peer', true); }

  _close(reason: string, propagate: boolean): void {
    if (!this.open) return;
    this.open = false;
    for (const cb of [...this.closeCbs]) cb(reason);
    const o = this.other;
    if (propagate && o && o.open) this.net.schedule(this.net.delay(), () => o._close('remote peer closed', false));
  }

  _deliverReliable(m: WireMessage): void { for (const cb of [...this.relCbs]) cb(m); }
  _deliverUnreliable(d: Uint8Array): void { for (const cb of [...this.unrelCbs]) cb(d); }
}

class LoopbackHost implements HostEndpoint {
  private connCbs = new Set<(l: PeerLink) => void>();
  private errCbs = new Set<(e: NetError) => void>();
  links: LoopbackLink[] = [];
  closed = false;
  constructor(private net: LoopbackNetwork, readonly code: string) {}
  onConnection(cb: (l: PeerLink) => void) { this.connCbs.add(cb); return () => { this.connCbs.delete(cb); }; }
  onError(cb: (e: NetError) => void) { this.errCbs.add(cb); return () => { this.errCbs.delete(cb); }; }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.net._unregisterHost(this.code, this);
    for (const l of this.links) l.close();
  }
  _accept(link: LoopbackLink): void { this.links.push(link); for (const cb of [...this.connCbs]) cb(link); }
  _severAll(): void {
    for (const l of this.links) {
      const o = l.other;
      l._close('network lost', false);
      o?._close('network lost', false);
    }
  }
}

export class LoopbackFactory implements TransportFactory {
  constructor(readonly net: LoopbackNetwork) {}

  host(code: string): Promise<HostEndpoint> {
    if (this.net._getHost(code)) return Promise.reject<HostEndpoint>({ kind: 'id-taken', message: `${PEER_ID_PREFIX}${code} taken` } satisfies NetError);
    const h = new LoopbackHost(this.net, code);
    this.net._registerHost(code, h);
    return Promise.resolve(h);
  }

  join(code: string): Promise<PeerLink> {
    return new Promise<PeerLink>((resolve, reject) => {
      // connection setup takes one round trip
      this.net.schedule(this.net.delay(), () => {
        const host = this.net._getHost(code);
        if (!host || host.closed) { reject({ kind: 'peer-unavailable', message: `room ${code} not found` } satisfies NetError); return; }
        const a = new LoopbackLink(this.net, this.net._nextLinkId());
        const b = new LoopbackLink(this.net, this.net._nextLinkId());
        a.other = b; b.other = a;
        host._accept(b);
        this.net.schedule(this.net.delay(), () => resolve(a));
      });
    });
  }

  destroy(): void {}
}
