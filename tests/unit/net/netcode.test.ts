import { describe, expect, it } from 'vitest';
import { LoopbackNetwork, type LoopbackOptions } from '../../../src/networking/loopback';
import { NetSession } from '../../../src/networking/netcode';
import type { MatchStart, PeerLink } from '../../../src/networking/types';
import { sim } from '../../../src/game/sim/engine';
import { createBot } from '../../../src/game/ai/qaBot';

const FRAME = 1000 / 60;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

const MATCH: MatchStart = { matchId: 1, seed: 4242, p1: 'goku', p2: 'naruto', stage: 'arena', inputDelay: 3 };

async function connect(net: LoopbackNetwork, code: string): Promise<[PeerLink, PeerLink]> {
  const f = net.factory();
  const host = await f.host(code);
  let hostLink: PeerLink | null = null;
  host.onConnection((l) => { hostLink = l; });
  const p = f.join(code);
  net.advance(500);
  await flush();
  const guestLink = await p;
  if (!hostLink) throw new Error('no host link');
  return [hostLink, guestLink];
}

interface Peer { s: NetSession; bot: ReturnType<typeof createBot>; me: 0 | 1; hashes: Map<number, number> }

function makePeer(s: NetSession, seed: number): Peer {
  return { s, bot: createBot(seed, 2), me: s.me, hashes: new Map() };
}

function record(p: Peer): void {
  const f = p.s.stats.confirmedFrame;
  if (!p.hashes.has(f)) p.hashes.set(f, sim.hashState(p.s.confirmedState));
}

/** One 60 Hz frame: advance network time then tick both peers (bots read their own predicted state). */
function frame(net: LoopbackNetwork, peers: Peer[], idle = false, rec = true): void {
  net.advance(FRAME);
  for (const p of peers) {
    p.s.tick(idle ? 0 : p.bot.next(p.s.state, p.me));
    if (rec) record(p);
  }
}

/** Tick with zero input until both confirmed frames reach `target`. */
function settle(net: LoopbackNetwork, peers: Peer[], rec = true): number {
  const target = Math.max(...peers.map((p) => p.s.stats.localFrame));
  for (let i = 0; i < 3000 && peers.some((p) => p.s.stats.confirmedFrame < target); i++) frame(net, peers, true, rec);
  return target;
}

/** Compare confirmed hashes at every common frame; returns how many and the newest common frame. */
function compare(a: Peer, b: Peer, fromFrame = 0): { common: number; last: number } {
  let common = 0, last = -1;
  for (const [f, h] of a.hashes) {
    if (f < fromFrame || !b.hashes.has(f)) continue;
    expect(b.hashes.get(f), `hash at frame ${f}`).toBe(h);
    common++;
    last = Math.max(last, f);
  }
  return { common, last };
}

async function setup(opts: LoopbackOptions, code: string, match = MATCH) {
  const net = new LoopbackNetwork(opts);
  const [hl, gl] = await connect(net, code);
  const host = makePeer(new NetSession({ link: hl, role: 'host', me: 0, match, now: net.now }), 11);
  const guest = makePeer(new NetSession({ link: gl, role: 'guest', me: 1, match, now: net.now }), 22);
  return { net, host, guest, hl, gl };
}

function run(net: LoopbackNetwork, peers: Peer[], n: number): void {
  for (let i = 0; i < n; i++) frame(net, peers);
}

describe('NetSession', () => {
  it('0 ms latency: 3000 frames in sync', async () => {
    const { net, host, guest } = await setup({ seed: 1 }, 'AAAAAA');
    run(net, [host, guest], 3000);
    const end = settle(net, [host, guest]);
    const c = compare(host, guest);
    expect(c.common).toBeGreaterThan(2500);
    expect(c.last).toBeGreaterThanOrEqual(end);
    expect(host.s.stats.desyncs + guest.s.stats.desyncs).toBe(0);
    expect(host.s.stats.localFrame).toBeGreaterThanOrEqual(2990);
    expect(guest.s.stats.localFrame).toBeGreaterThanOrEqual(2990);
    // something happened in the fight
    const st = host.s.confirmedState;
    expect(st.fighters[0].stats.hitsLanded + st.fighters[1].stats.hitsLanded).toBeGreaterThan(3);
  });

  it('50 ms + 15 ms jitter + 5 % loss: rollbacks, no desync, bounded stalls', async () => {
    // delay 2 (host picks 2..4): 50 ms one-way is no longer fully hidden by the input delay -> rollbacks
    const { net, host, guest } = await setup({ latencyMs: 50, jitterMs: 15, loss: 0.05, seed: 2 }, 'BBBBBB', { ...MATCH, inputDelay: 2 });
    run(net, [host, guest], 3000);
    expect(host.s.stats.localFrame).toBeGreaterThanOrEqual(2900);
    expect(guest.s.stats.localFrame).toBeGreaterThanOrEqual(2900);
    const end = settle(net, [host, guest]);
    const c = compare(host, guest);
    expect(c.common).toBeGreaterThan(500);
    expect(c.last).toBeGreaterThanOrEqual(end);
    expect(host.s.stats.rollbacks + guest.s.stats.rollbacks).toBeGreaterThan(0);
    expect(host.s.stats.desyncs + guest.s.stats.desyncs).toBe(0);
    expect(host.s.ping).not.toBeNull();
    expect(host.s.ping!).toBeGreaterThan(90);
    expect(host.s.ping!).toBeLessThan(140);
    // final confirmed states identical
  });

  it('100 ms one-way + 20 % loss still converges', async () => {
    const { net, host, guest } = await setup({ latencyMs: 100, loss: 0.2, seed: 3 }, 'CCCCCC');
    run(net, [host, guest], 3000);
    expect(host.s.stats.localFrame).toBeGreaterThanOrEqual(2000);
    expect(guest.s.stats.localFrame).toBeGreaterThanOrEqual(2000);
    const end = settle(net, [host, guest]);
    const c = compare(host, guest);
    expect(c.common).toBeGreaterThan(300);
    expect(c.last).toBeGreaterThanOrEqual(end);
    expect(host.s.stats.desyncs + guest.s.stats.desyncs).toBe(0);
  });

  it('desync injection triggers a resync and peers match afterwards', async () => {
    const { net, host, guest } = await setup({ latencyMs: 30, jitterMs: 5, loss: 0.02, seed: 4 }, 'DDDDDD');
    run(net, [host, guest], 400);
    guest.s.__corruptForTest();
    let resyncFrame = -1;
    for (let i = 0; i < 600; i++) {
      frame(net, [host, guest]);
      if (resyncFrame < 0 && guest.s.stats.resyncs > 0) {
        resyncFrame = guest.s.stats.confirmedFrame;
        guest.hashes.clear(); // drop hashes recorded from the corrupted timeline
        record(guest);
      }
    }
    const end = settle(net, [host, guest]);
    expect(guest.s.stats.desyncs).toBeGreaterThan(0);
    expect(guest.s.stats.resyncs).toBeGreaterThan(0);
    expect(resyncFrame).toBeGreaterThan(400);
    const c = compare(host, guest, resyncFrame);
    expect(c.common).toBeGreaterThan(100);
    expect(c.last).toBeGreaterThanOrEqual(end);
  });

  it('guest resumes mid-match from a host snapshot on a new link', async () => {
    const { net, host, guest, gl } = await setup({ latencyMs: 20, jitterMs: 5, loss: 0.02, seed: 5 }, 'EEEEEE');
    run(net, [host, guest], 600);
    // guest drops; host keeps ticking (stalls) for a bit
    guest.s.dispose();
    gl.close();
    for (let i = 0; i < 30; i++) frame(net, [host]);
    const hostFrameBefore = host.s.stats.localFrame;
    expect(hostFrameBefore).toBeLessThan(620);

    const f = net.factory();
    const p = f.join('EEEEEE');
    let newHostLink: PeerLink | null = null;
    // the existing endpoint is still registered: hook its next connection through a fresh listener
    const ep = await (async () => { try { return await f.host('ZZZZZZ'); } catch { return null; } })();
    ep?.close();
    net.advance(0);
    // LoopbackHost delivers the new connection to every onConnection listener; capture via loopback internals
    newHostLink = await new Promise<PeerLink>((resolve) => {
      (net as unknown as { _getHost(c: string): { onConnection(cb: (l: PeerLink) => void): void } })._getHost('EEEEEE')
        .onConnection(resolve);
      net.advance(200);
    });
    await flush();
    const newGuestLink = await p;

    const resume = host.s.snapshotForResume();
    host.s.attachLink(newHostLink);
    const g2 = makePeer(new NetSession({ link: newGuestLink, role: 'guest', me: 1, match: MATCH, now: net.now, resume }), 22);
    const host2: Peer = { ...host, hashes: new Map() };
    run(net, [host2, g2], 600);
    const end = settle(net, [host2, g2]);
    expect(host2.s.stats.localFrame).toBeGreaterThan(hostFrameBefore + 550);
    expect(g2.s.stats.localFrame).toBeGreaterThan(hostFrameBefore + 550);
    const c = compare(host2, g2);
    expect(c.common).toBeGreaterThan(300);
    expect(c.last).toBeGreaterThanOrEqual(end);
    expect(g2.s.stats.desyncs).toBe(0);
  });

  it('full bot match finishes with the same winner on both peers', async () => {
    const { net, host, guest } = await setup({ latencyMs: 40, jitterMs: 10, loss: 0.05, seed: 6 }, 'FFFFFF',
      { ...MATCH, matchId: 2, seed: 777 });
    host.bot = createBot(11, 3);
    const peers = [host, guest];
    for (let i = 0; i < 40000; i++) {
      frame(net, peers, false, false);
      if (peers.every((p) => p.s.confirmedState.phase === 'matchEnd')) break;
    }
    expect(host.s.confirmedState.phase).toBe('matchEnd');
    expect(guest.s.confirmedState.phase).toBe('matchEnd');
    expect(host.s.confirmedState.winner).not.toBeNull();
    expect(guest.s.confirmedState.winner).toBe(host.s.confirmedState.winner);
    const end = settle(net, peers);
    for (const p of peers) record(p);
    const c = compare(host, guest);
    expect(c.common).toBeGreaterThan(0);
    expect(c.last).toBeGreaterThanOrEqual(end);
    expect(host.s.stats.desyncs + guest.s.stats.desyncs).toBe(0);
  });
});
