import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { HostEndpoint, NetError, PeerLink, TransportFactory, WireMessage } from './types';
import { getPeerOptions } from './config';
import { peerIdFor } from './roomCode';
import { logClose, logWarning } from './diag';

function netError(error: { type?: string; message?: string }): NetError {
  const kind = error.type === 'unavailable-id' ? 'id-taken' : error.type === 'peer-unavailable' ? 'peer-unavailable'
    : error.type === 'network' ? 'network' : error.type === 'webrtc' ? 'webrtc' : 'signaling';
  return { kind, message: kind === 'peer-unavailable' ? 'Room not found' : error.message || 'Connection failed' };
}
/** A link is declared dead only after this long without ANY data from the peer (room pings flow at 1 Hz, inputs at 60 Hz). */
export const LINK_SILENCE_MS = 8000;
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class WebRtcLink implements PeerLink {
  private closed = false;
  private rel = new Set<(m: WireMessage) => void>();
  private unrel = new Set<(d: Uint8Array) => void>();
  private closes = new Set<(reason: string) => void>();
  private pendingReliable: WireMessage[];
  private lastRecvAt = now();
  private watchdog: ReturnType<typeof setInterval>;
  readonly id: string;
  constructor(private reliable: DataConnection, private unreliable: DataConnection, private cleanup: () => void = () => {}, pendingReliable: WireMessage[] = []) {
    this.pendingReliable = pendingReliable;
    this.id = reliable.connectionId + ':' + unreliable.connectionId;
    reliable.on('data', data => {
      this.lastRecvAt = now();
      if (!data || typeof data !== 'object' || typeof (data as WireMessage).t !== 'string') return;
      if (this.rel.size === 0) { if (this.pendingReliable.length < 32) this.pendingReliable.push(data as WireMessage); }
      else for (const cb of this.rel) cb(data as WireMessage);
    });
    unreliable.on('data', data => { this.lastRecvAt = now(); void this.receiveBinary(data); });
    for (const connection of [reliable, unreliable]) {
      const label = connection.label;
      // Only a real channel close is fatal. PeerJS 'error' events are often transient (MessageToBig, NotOpenYet, a send
      // racing a close, ICE negotiation noise); when the channel really dies PeerJS also emits 'close'.
      connection.on('close', () => this.finish(`Connection closed (${label})`));
      connection.on('error', e => { logWarning('dc-error', `${label}: ${(e as { type?: string }).type ?? ''} ${e.message}`); console.warn(`[net] ${label} channel error (non-fatal):`, e.message); });
      connection.on('iceStateChanged', state => {
        if (state === 'failed' || state === 'closed') this.finish(`ICE ${state} (${label})`);
        // 'disconnected' is frequently a short blip (WiFi hiccup, consent-check loss) that recovers on its own. The silence
        // watchdog below decides; we never close on it while packets still arrive.
        else if (state === 'disconnected') logWarning('ice-disconnected', label);
      });
    }
    let lastCheck = now();
    this.watchdog = setInterval(() => {
      const t = now();
      // If OUR main thread was stalled, data events queued behind this timer haven't run yet: skip this check.
      const late = t - lastCheck > 1500;
      lastCheck = t;
      if (late) return;
      const silent = t - this.lastRecvAt;
      if (silent > LINK_SILENCE_MS) this.finish(`No data from peer for ${Math.round(silent / 1000)} s`);
    }, 1000);
  }
  private async receiveBinary(data: unknown): Promise<void> {
    let bytes: Uint8Array;
    if (data instanceof Uint8Array) bytes = data;
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      try { bytes = new Uint8Array(await data.arrayBuffer()); } catch { logWarning('bad-payload', 'blob read failed'); return; }
    }
    else return;
    if (!this.closed) for (const cb of this.unrel) cb(bytes);
  }
  get open(): boolean { return !this.closed && this.reliable.open && this.unreliable.open; }
  sendReliable(msg: WireMessage): void {
    if (!this.open) return;
    try { this.reliable.send(msg); } catch (e) { logWarning('send-failed', `rel ${msg.t}: ${(e as Error).message}`); }
  }
  sendUnreliable(data: Uint8Array): void {
    if (!this.open) return;
    try { this.unreliable.send(new Uint8Array(data).buffer); } catch (e) { logWarning('send-failed', `unrel: ${(e as Error).message}`); }
  }
  onReliable(cb: (m: WireMessage) => void) {
    this.rel.add(cb);
    if (this.pendingReliable.length) {
      const pending = this.pendingReliable.splice(0);
      queueMicrotask(() => { if (!this.closed) for (const msg of pending) for (const listener of this.rel) listener(msg); });
    }
    return () => { this.rel.delete(cb); };
  }
  onUnreliable(cb: (d: Uint8Array) => void) { this.unrel.add(cb); return () => { this.unrel.delete(cb); }; }
  onClose(cb: (r: string) => void) { this.closes.add(cb); return () => { this.closes.delete(cb); }; }
  close(): void { this.finish('Closed by local peer'); }
  private finish(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.watchdog);
    if (reason !== 'Closed by local peer') logClose('link', reason);
    this.reliable.close(); this.unreliable.close(); this.cleanup();
    for (const cb of [...this.closes]) cb(reason);
    this.rel.clear(); this.unrel.clear(); this.closes.clear();
  }
}

export class PeerJsFactory implements TransportFactory {
  private peers = new Set<Peer>();
  async host(code: string): Promise<HostEndpoint> {
    const { default: PeerConstructor } = await import('peerjs');
    const peer = new PeerConstructor(peerIdFor(code), getPeerOptions());
    this.peers.add(peer);
    return new Promise((resolve, reject) => {
      let opened = false;
      const connections = new Set<(l: PeerLink) => void>();
      const errors = new Set<(e: NetError) => void>();
      const pairs = new Map<string, { rel?: DataConnection; unrel?: DataConnection; pending: WireMessage[]; buffer?: (data: unknown) => void; timer: ReturnType<typeof setTimeout> }>();
      const links = new Set<PeerLink>();
      const close = () => {
        for (const pair of pairs.values()) { clearTimeout(pair.timer); pair.rel?.close(); pair.unrel?.close(); }
        pairs.clear(); for (const link of links) link.close(); links.clear(); peer.destroy(); this.peers.delete(peer);
      };
      peer.on('open', () => {
        opened = true;
        resolve({ code, onConnection: cb => { connections.add(cb); return () => { connections.delete(cb); }; },
          onError: cb => { errors.add(cb); return () => { errors.delete(cb); }; }, close });
      });
      peer.on('error', error => { const e = netError(error); if (!opened) { close(); reject(e); } else for (const cb of errors) cb(e); });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('connection', conn => {
        if (conn.label !== 'rel' && conn.label !== 'unrel') { conn.close(); return; }
        let pair = pairs.get(conn.peer);
        if (!pair) {
          pair = { pending: [], timer: setTimeout(() => { const p = pairs.get(conn.peer); pairs.delete(conn.peer); p?.rel?.close(); p?.unrel?.close(); }, 15000) };
          pairs.set(conn.peer, pair);
        }
        if (pair[conn.label]) { conn.close(); return; }
        pair[conn.label] = conn;
        if (conn.label === 'rel') {
          pair.buffer = data => { if (data && typeof data === 'object' && typeof (data as WireMessage).t === 'string' && pair.pending.length < 32) pair.pending.push(data as WireMessage); };
          conn.on('data', pair.buffer);
        }
        const ready = () => {
          if (pair.rel?.open && pair.unrel?.open && pairs.get(conn.peer) === pair) {
            clearTimeout(pair.timer); pairs.delete(conn.peer);
            if (pair.buffer) pair.rel.removeListener('data', pair.buffer);
            const link = new WebRtcLink(pair.rel, pair.unrel, undefined, pair.pending); links.add(link);
            link.onClose(() => links.delete(link));
            for (const cb of connections) cb(link);
          }
        };
        const discard = () => {
          if (pairs.get(conn.peer) !== pair) return;
          pairs.delete(conn.peer); clearTimeout(pair.timer);
          if (pair.buffer) pair.rel?.removeListener('data', pair.buffer);
          pair.rel?.close(); pair.unrel?.close();
        };
        conn.on('error', discard); conn.on('close', discard);
        conn.on('open', ready); ready();
      });
    });
  }
  async join(code: string, timeoutMs = 15000): Promise<PeerLink> {
    const { default: PeerConstructor } = await import('peerjs');
    const peer = new PeerConstructor(getPeerOptions()); this.peers.add(peer);
    return new Promise((resolve, reject) => {
      let settled = false;
      let rel: DataConnection | undefined, unrel: DataConnection | undefined;
      const cleanup = () => { peer.destroy(); this.peers.delete(peer); };
      const fail = (e: NetError) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); reject(e); };
      const timer = setTimeout(() => fail({ kind: 'timeout', message: 'Connection timed out' }), timeoutMs);
      peer.on('error', error => fail(netError(error)));
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('open', () => {
        rel = peer.connect(peerIdFor(code), { label: 'rel', reliable: true, serialization: 'json' });
        // PeerJS 1.5 sets ordered:false but does not expose maxRetransmits; binary remains retransmitted.
        unrel = peer.connect(peerIdFor(code), { label: 'unrel', reliable: false, serialization: 'raw' });
        const ready = () => { if (!settled && rel?.open && unrel?.open) { settled = true; clearTimeout(timer); resolve(new WebRtcLink(rel, unrel, cleanup)); } };
        for (const conn of [rel, unrel]) {
          conn.on('open', ready); conn.on('error', error => fail(netError(error)));
          conn.on('close', () => fail({ kind: 'network', message: 'Connection closed before opening' }));
        }
        ready();
      });
    });
  }
  destroy(): void { for (const peer of this.peers) peer.destroy(); this.peers.clear(); }
}
