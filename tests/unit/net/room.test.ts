import { describe, expect, it } from 'vitest';
import { LoopbackNetwork } from '../../../src/networking/loopback';
import { RoomSession, virtualRoomTimers } from '../../../src/networking/room';
import { PROTOCOL_VERSION, RECONNECT_WINDOW_MS } from '../../../src/networking/types';
import type { MatchStart, RoomEvent, WireMessage } from '../../../src/networking/types';
import { sim } from '../../../src/game/sim/engine';

async function advance(net: LoopbackNetwork, ms = 0): Promise<void> {
  // Transport promises create further scheduled messages, so alternate clock and microtasks.
  for (let i = 0; i < 8; i++) { net.advance(i === 0 ? ms : 0); await Promise.resolve(); }
}
async function setup(latencyMs = 0, countdownMs = 100) {
  const net = new LoopbackNetwork({ latencyMs });
  const options = { now: net.now, timers: virtualRoomTimers(net), urlBase: 'https://example.test/' };
  let seed = 0.1;
  const host = await RoomSession.host(net.factory(), { ...options, code: 'ABC234', countdownMs, rand: () => (seed += 0.1) });
  const guestFactory = net.factory();
  const joining = RoomSession.join(guestFactory, host.snapshot.code, { ...options, name: 'Friend' });
  for (let i = 0; i < 8; i++) await advance(net, latencyMs * 2);
  const guest = await joining;
  return { net, options, host, guest, guestFactory };
}
async function fight(pair: Awaited<ReturnType<typeof setup>>) {
  pair.host.selectCharacter('goku'); pair.guest.selectCharacter('vegeta'); await advance(pair.net);
  pair.host.setReady(true); pair.guest.setReady(true); await advance(pair.net); await advance(pair.net, 100);
}
function events(room: RoomSession): RoomEvent[] { const list: RoomEvent[] = []; room.on(e => list.push(e)); return list; }

describe('RoomSession lobby', () => {
  it('joins into selecting with consistent authoritative snapshots and defensive copies', async () => {
    const { net, host, guest } = await setup();
    expect(host.snapshot.phase).toBe('selecting'); expect(guest.snapshot.phase).toBe('selecting');
    expect(host.snapshot.players).toEqual(guest.snapshot.players); expect(guest.snapshot.me).toBe(1);
    host.snapshot.players[0].name = 'corrupted'; expect(host.snapshot.players[0].name).toBe('Host');
    guest.setCursor(4); await advance(net); expect(host.snapshot.players[1].cursor).toBe(4);
    host.leave(); guest.leave(); await advance(net, 100);
  });
  it('rejects a mismatched version and refuses a third guest', async () => {
    const { net, options, host, guest } = await setup();
    const raw = net.factory().join(host.snapshot.code); await advance(net); const link = await raw;
    const replies: WireMessage[] = []; link.onReliable(m => replies.push(m));
    link.sendReliable({ t: 'hello', version: 'old', name: 'Old' }); await advance(net);
    expect(replies).toContainEqual({ t: 'reject', reason: 'version', message: 'Game versions do not match' });
    const third = RoomSession.join(net.factory(), host.snapshot.code, options);
    const rejection = expect(third).rejects.toMatchObject({ kind: 'room-full' }); await advance(net); await rejection;
    expect(host.link?.open).toBe(true); expect(guest.snapshot.phase).toBe('selecting');
    host.leave(); guest.leave(); await advance(net, 100);
  });
  it('starts an identical match on both peers after countdown and requires characters', async () => {
    const pair = await setup(); const h = events(pair.host), g = events(pair.guest);
    pair.host.setReady(true); expect(pair.host.snapshot.players[0].ready).toBe(false);
    pair.host.selectCharacter('goku'); pair.guest.selectCharacter('vegeta'); await advance(pair.net);
    pair.host.setReady(true); pair.guest.setReady(true); await advance(pair.net);
    expect(pair.host.snapshot.phase).toBe('ready'); await advance(pair.net, 99); expect(h.some(e => e.type === 'matchStart')).toBe(false);
    await advance(pair.net, 1);
    const hm = h.find(e => e.type === 'matchStart'), gm = g.find(e => e.type === 'matchStart');
    expect(hm?.type).toBe('matchStart'); expect(gm?.type).toBe('matchStart');
    expect((hm as { match: MatchStart }).match).toEqual((gm as { match: MatchStart }).match);
    expect(pair.guest.snapshot.phase).toBe('fighting'); pair.host.leave(); pair.guest.leave();
  });
  it('unready cancels the pending countdown', async () => {
    const { net, host, guest } = await setup();
    host.selectCharacter('goku'); guest.selectCharacter('vegeta'); await advance(net);
    host.setReady(true); guest.setReady(true); await advance(net, 0); await advance(net, 50);
    guest.setReady(false); await advance(net); await advance(net, 100);
    expect(host.snapshot.phase).toBe('selecting'); expect(host.snapshot.match).toBeNull(); host.leave(); guest.leave();
  });
  it('measures RTT and explicit guest leave resets the host slot', async () => {
    const { net, host, guest } = await setup(40); const h = events(host);
    await advance(net, 1100); expect(host.snapshot.ping).toBeCloseTo(80); expect(guest.snapshot.ping).toBeCloseTo(80);
    guest.leave(); await advance(net, 200);
    expect(host.snapshot.phase).toBe('waiting'); expect(host.snapshot.players[1].connected).toBe(false);
    expect(h.some(e => e.type === 'opponentLeft' && e.final)).toBe(true); host.leave();
  });
  it('automatically rejoins after a dropped link and restores the phase', async () => {
    const { net, host, guest } = await setup(); const h = events(host), g = events(guest);
    host.selectCharacter('goku'); guest.selectCharacter('vegeta'); await advance(net);
    const oldLink = guest.link; net.severAll();
    expect(host.snapshot.phase).toBe('reconnecting'); expect(guest.snapshot.phase).toBe('reconnecting');
    await advance(net, 2000);
    expect(host.snapshot.phase).toBe('selecting'); expect(guest.snapshot.phase).toBe('selecting');
    expect(guest.link).not.toBe(oldLink); expect(guest.snapshot.players[1].charId).toBe('vegeta');
    expect(h.some(e => e.type === 'opponentReturned')).toBe(true); expect(g.some(e => e.type === 'opponentReturned')).toBe(true);
    host.leave(); guest.leave();
  });
  it('resumes a fight only after receiving the authoritative snapshot', async () => {
    const pair = await setup(); await fight(pair); const g = events(pair.guest);
    const state = sim.createMatch({ p1: 'goku', p2: 'vegeta', seed: 123, mode: 'online' });
    const resume = { frame: 0, state, inputs: [[], []] as [number[], number[]], inputsFrom: 1 };
    pair.host.resumeProvider = () => resume; pair.net.severAll(); await advance(pair.net, 2000);
    expect(pair.host.snapshot.phase).toBe('fighting'); expect(pair.guest.snapshot.phase).toBe('fighting');
    const starts = g.filter(e => e.type === 'matchStart'); expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ resume, match: pair.host.snapshot.match }); pair.host.leave(); pair.guest.leave();
  });
  it('accepts a new page into a disconnected slot as a returning guest', async () => {
    const { net, options, host, guest } = await setup(); guest.selectCharacter('vegeta'); await advance(net);
    net.severAll();
    const joining = RoomSession.join(net.factory(), host.snapshot.code, options); await advance(net); const replacement = await joining;
    expect(replacement.snapshot.players[1].charId).toBe('vegeta'); expect(host.snapshot.phase).toBe('selecting');
    guest.leave(); replacement.leave(); host.leave();
  });
  it('a new page receives buffered matchStart with resume after join resolves', async () => {
    const pair = await setup(); await fight(pair);
    const resume = { frame: 0, state: sim.createMatch({ p1: 'goku', p2: 'vegeta', seed: 123, mode: 'online' }), inputs: [[], []] as [number[], number[]], inputsFrom: 0 };
    pair.host.resumeProvider = () => resume; pair.net.severAll();
    const joining = RoomSession.join(pair.net.factory(), pair.host.snapshot.code, pair.options); await advance(pair.net);
    const replacement = await joining; const received = events(replacement); await Promise.resolve();
    expect(received.filter(e => e.type === 'matchStart')).toHaveLength(1);
    expect(received.find(e => e.type === 'matchStart')).toMatchObject({ resume });
    pair.guest.leave(); replacement.leave(); pair.host.leave();
  });
  it('expires the reconnect window without resetting the deadline on repeated failures', async () => {
    const { net, host, guest, guestFactory } = await setup();
    // Fail dial attempts while preserving the registered endpoint.
    guestFactory.join = () => Promise.reject({ kind: 'network', message: 'offline' });
    net.severAll(); const deadline = guest.snapshot.reconnectDeadline;
    for (let i = 0; i < 7; i++) await advance(net, 2000);
    expect(guest.snapshot.reconnectDeadline).toBe(deadline); await advance(net, RECONNECT_WINDOW_MS - 14000);
    expect(host.snapshot.phase).toBe('waiting'); expect(guest.snapshot.phase).toBe('closed'); host.leave();
  });
  it('rematch requires both votes and creates a new match id and seed', async () => {
    const pair = await setup(); await fight(pair); const first = pair.host.snapshot.match!;
    pair.host.reportMatchEnd(0, 100, 123); pair.guest.reportMatchEnd(0, 100, 123); await advance(pair.net);
    expect(pair.guest.snapshot.phase).toBe('postmatch'); pair.host.requestRematch(); await advance(pair.net);
    expect(pair.host.snapshot.phase).toBe('postmatch'); pair.guest.requestRematch(); await advance(pair.net);
    expect(pair.host.snapshot.match?.matchId).toBe(first.matchId + 1); expect(pair.host.snapshot.match?.seed).not.toBe(first.seed);
    expect(pair.guest.snapshot.match).toEqual(pair.host.snapshot.match); pair.host.leave(); pair.guest.leave();
  });
  it('changeFighter clears characters and returnToRoom keeps them, emitting events on both', async () => {
    const pair = await setup(); await fight(pair); const h = events(pair.host), g = events(pair.guest);
    pair.guest.returnToRoom(); await advance(pair.net);
    expect(pair.host.snapshot.players.map(p => p.charId)).toEqual(['goku', 'vegeta']);
    expect(h.filter(e => e.type === 'toLobby')).toHaveLength(1); expect(g.filter(e => e.type === 'toLobby')).toHaveLength(1);
    pair.host.changeFighter(); await advance(pair.net);
    expect(pair.guest.snapshot.players.every(p => p.charId === null && !p.ready && !p.rematch)).toBe(true);
    expect(h.filter(e => e.type === 'toSelect')).toHaveLength(1); expect(g.filter(e => e.type === 'toSelect')).toHaveLength(1);
    pair.host.leave(); pair.guest.leave();
  });
  it('host leave closes the guest and id collisions retry', async () => {
    const { net, host, guest, options } = await setup();
    const next = await RoomSession.host(net.factory(), { ...options, code: 'ABC234', rand: () => 0 });
    expect(next.snapshot.code).toBe('AAAAAA'); host.leave(); await advance(net, 200); expect(guest.snapshot.phase).toBe('closed'); next.leave();
  });
  it('guest messages only affect the guest slot and cannot decide the winner', async () => {
    const pair = await setup();
    pair.guest.link?.sendReliable({ t: 'select', charId: 'vegeta', slot: 0 } as WireMessage); await advance(pair.net);
    expect(pair.host.snapshot.players[0].charId).toBeNull(); expect(pair.host.snapshot.players[1].charId).toBeNull();
    pair.guest.selectCharacter('vegeta'); await advance(pair.net); expect(pair.host.snapshot.players[1].charId).toBe('vegeta');
    await fight(pair); pair.guest.reportMatchEnd(1, 100, 99); await advance(pair.net);
    expect(pair.host.snapshot.phase).toBe('fighting'); pair.host.reportMatchEnd(0, 100, 99); await advance(pair.net);
    expect(pair.guest.snapshot.lastWinner).toBe(0); pair.host.leave(); pair.guest.leave();
  });
});
