import { describe, expect, it } from 'vitest';
import { LoopbackNetwork } from '../../../src/networking/loopback';
import { NetSession } from '../../../src/networking/netcode';
import type { MatchStart, PeerLink } from '../../../src/networking/types';
import { sim } from '../../../src/game/sim/engine';
import { createBot } from '../../../src/game/ai/qaBot';

const FRAME = 1000 / 60;
const ABILITY = new Set(['specialStart', 'projectileSpawn', 'beamStart', 'aoe', 'teleport', 'summon', 'trapSet', 'transform', 'shield', 'buff']);
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

async function connect(net: LoopbackNetwork, code: string): Promise<[PeerLink, PeerLink]> {
  const f = net.factory();
  const host = await f.host(code);
  let hostLink: PeerLink | null = null;
  host.onConnection((l) => { hostLink = l; });
  const p = f.join(code);
  net.advance(500);
  await flush();
  const guestLink = await p;
  return [hostLink!, guestLink];
}

describe('NetSession ability spam (testMeter)', () => {
  for (const [p1, p2] of [['goku', 'naruto'], ['vegeta', 'sasuke']] as const) {
    it(`${p1} vs ${p2}: specials + ultimate cinematics under 50 ms / 5 % loss stay in sync`, async () => {
      const match: MatchStart = { matchId: 1, seed: 777, p1, p2, stage: 'arena', inputDelay: 2, testMeter: true };
      const net = new LoopbackNetwork({ latencyMs: 50, jitterMs: 15, loss: 0.05, seed: 9 });
      const [hl, gl] = await connect(net, 'SPAMAA');
      const peers = [
        { s: new NetSession({ link: hl, role: 'host', me: 0, match, now: net.now }), bot: createBot(11, 2, { spam: true }), h: new Map<number, number>() },
        { s: new NetSession({ link: gl, role: 'guest', me: 1, match, now: net.now }), bot: createBot(22, 2, { spam: true }), h: new Map<number, number>() },
      ];
      let cinematicFrames = 0, ults = 0, specials = 0;
      for (let i = 0; i < 3000; i++) {
        net.advance(FRAME);
        for (const p of peers) {
          const t = p.s.tick(p.bot.next(p.s.state, p.s.me));
          const f = p.s.stats.confirmedFrame;
          if (!p.h.has(f)) p.h.set(f, sim.hashState(p.s.confirmedState));
          if (p === peers[0]) for (const e of t.events) { if (e.type === 'ultimateStart') ults++; if (ABILITY.has(e.type)) specials++; }
        }
        if (peers[0].s.confirmedState.cinematic.active) cinematicFrames++;
      }
      let common = 0;
      for (const [f, h] of peers[0].h) if (peers[1].h.has(f)) { expect(peers[1].h.get(f), `hash @${f}`).toBe(h); common++; }
      expect(common).toBeGreaterThan(500);
      expect(peers[0].s.stats.desyncs + peers[1].s.stats.desyncs).toBe(0);
      expect(specials).toBeGreaterThan(10);
      expect(ults).toBeGreaterThan(0);
      expect(cinematicFrames).toBeGreaterThan(0);
      expect(peers[0].s.stats.maxRollback).toBeLessThanOrEqual(8);
    });
  }
});
