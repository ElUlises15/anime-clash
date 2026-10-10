/**
 * Real online play between two browser contexts through the public PeerJS broker (0.peerjs.com) + WebRTC.
 * Host creates a room, guest opens #/room/CODE, both pick + READY, QA bots fight on each side (each page only drives its
 * own player), we check both screens agree (HP, confirmed-state hashes, winner), then REMATCH and CHANGE FIGHTER.
 */
import { test, expect, type Page, type Browser } from '@playwright/test';

const SHOTS = '../shots/gameplay-pass/online';
type Pct = { p50: number; p95: number; p99: number; max: number };
type NetInfo = {
  ping: number | null; rollbacks: number; maxRollback: number; desyncs: number; resyncs: number; stalls: number; confirmedFrame: number;
  maxTickMs: number; maxResimMs: number; maxPacketGapMs: number; resimFrames: number;
  roomPhases: string[]; closes: { t: number; kind: string; detail: string }[]; warnings: { t: number; kind: string; detail: string }[]; reconnects: number;
  abilities: { specials: number; ultimates: number };
};
type W = Window & {
  __game?: { scene: { isActive(key: string): boolean } };
  __acLobby?: { code: string; url: string };
  __acNet?: { setTestMeter(on: boolean): void; room(): { phase: string; players: { connected: boolean; charId: string | null; ready: boolean }[]; match: { matchId: number } | null } | undefined };
  __ac?: {
    getState(): { phase: string; frame: number; fighters: { hp: number; maxHp: number }[] };
    confirmed(): { phase: string; frame: number; winner: number | null; roundWins: number[]; fighters: { hp: number; maxHp: number }[] };
    hashLog(): Record<string, number>;
    net(): NetInfo | null;
    perf(): { frames: number; delta: Pct; cost: Pct; hitches: number };
    resetPerf(): void;
    setAutoplay(on: boolean, opts?: { spam?: boolean }): void;
    setSpeed(n: number): void;
    mode: string;
  };
};

async function waitScene(page: Page, key: string, timeout = 30_000) {
  await page.waitForFunction((k) => !!(window as W).__game?.scene.isActive(k), key, { timeout });
}
async function key(page: Page, code: string, times = 1) {
  for (let i = 0; i < times; i++) { await page.keyboard.press(code); await page.waitForTimeout(200); }
}
const room = (p: Page) => p.evaluate(() => (window as W).__acNet!.room()!);

async function newPage(browser: Browser, errors: string[], tag: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  return page;
}

async function startFightWithBots(host: Page, guest: Page, matchId: number) {
  for (const p of [host, guest]) await waitScene(p, 'Fight', 30_000);
  for (const p of [host, guest]) {
    await p.waitForFunction((id) => (window as W).__acNet!.room()!.match?.matchId === id && (window as W).__ac?.mode === 'online', matchId, { timeout: 30_000 });
    // Stress: bots throw specials/ultimates whenever affordable (host enabled MatchStart.testMeter → meter tops up).
    await p.evaluate(() => { (window as W).__ac!.setAutoplay(true, { spam: true }); (window as W).__ac!.setSpeed(4); (window as W).__ac!.resetPerf(); });
  }
}

async function playToEnd(host: Page, guest: Page) {
  // fight runs and HP drops on both screens
  for (const p of [host, guest]) {
    await p.waitForFunction(() => {
      const s = (window as W).__ac!.confirmed();
      return s.phase !== 'intro' && s.fighters.some((f) => f.hp < f.maxHp);
    }, null, { timeout: 90_000 });
  }
  const t0 = Date.now();
  for (;;) {
    const st = await Promise.all([host, guest].map((p) => p.evaluate(() => {
      const ac = (window as W).__ac!;
      const c = ac.confirmed();
      return { phase: c.phase, frame: c.frame, hp: c.fighters.map((f) => f.hp), rw: c.roundWins, net: ac.net() };
    })));
    if (st.every((x) => x.phase === 'matchEnd')) break;
    console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, JSON.stringify(st));
    expect(Date.now() - t0).toBeLessThan(900_000);
    await host.waitForTimeout(15_000);
  }
  const [h, g] = await Promise.all([host, guest].map((p) => p.evaluate(() => {
    const ac = (window as W).__ac!;
    const c = ac.confirmed();
    return { winner: c.winner, roundWins: c.roundWins, hashes: ac.hashLog(), net: ac.net() };
  })));
  expect(g.winner).toBe(h.winner);
  expect(g.roundWins).toEqual(h.roundWins);
  const common = Object.keys(h.hashes).filter((f) => f in g.hashes);
  expect(common.length).toBeGreaterThan(10);
  for (const f of common) expect(g.hashes[f], `confirmed hash @${f}`).toBe(h.hashes[f]);
  // Zero tolerance: no link drop / reconnect / desync while abilities and ultimates are spammed.
  const perf = await Promise.all([host, guest].map((p) => p.evaluate(() => (window as W).__ac!.perf())));
  for (const [tag, n] of [['host', h.net], ['guest', g.net]] as const) {
    console.log(`${tag} net`, JSON.stringify({ ...n, warnings: n!.warnings.slice(-5) }));
    expect(n!.closes, `${tag} link closes`).toEqual([]);
    expect(n!.reconnects, `${tag} reconnects`).toBe(0);
    expect(n!.roomPhases, `${tag} room phases`).not.toContain('reconnecting');
    expect(n!.desyncs, `${tag} desyncs`).toBe(0);
    expect(n!.abilities.specials, `${tag} specials thrown`).toBeGreaterThan(10);
    expect(n!.abilities.ultimates, `${tag} ultimates thrown`).toBeGreaterThan(0);
  }
  console.log('perf host', JSON.stringify(perf[0]), 'guest', JSON.stringify(perf[1]));
  console.log('match done', JSON.stringify({ winner: h.winner, roundWins: h.roundWins, commonHashes: common.length, hostNet: h.net, guestNet: g.net }));
  return h;
}

test('online: create room, join via URL, select, ready, fight, KO, rematch, change fighter', async ({ browser }) => {
  test.setTimeout(1_500_000);
  const errors: string[] = [];
  const host = await newPage(browser, errors, 'host');
  const guest = await newPage(browser, errors, 'guest');

  // HOST: Title -> ONLINE -> CREATE ROOM
  await host.goto('./');
  await waitScene(host, 'Title');
  await host.waitForTimeout(900);
  await host.mouse.click(683, 384);
  await key(host, 'Enter'); // ONLINE
  await key(host, 'Enter'); // CREATE ROOM
  await waitScene(host, 'Lobby');
  await host.waitForFunction(() => !!(window as W).__acLobby?.code, null, { timeout: 45_000 });
  const { code, url } = await host.evaluate(() => (window as W).__acLobby!);
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  expect(url).toContain(`#/room/${code}`);
  expect(host.url()).toContain(`#/room/${code}`);

  // GUEST: open the shared URL directly -> joins
  await guest.goto(`./#/room/${code}`);
  await waitScene(guest, 'Lobby');
  for (const p of [host, guest]) {
    await p.waitForFunction(() => {
      const r = (window as W).__acNet?.room?.();
      return !!r && r.phase === 'selecting' && r.players.every((x) => x.connected);
    }, null, { timeout: 60_000 });
  }
  await host.waitForTimeout(1500); // let ping settle + portraits render
  await host.screenshot({ path: `${SHOTS}/online_lobby_host.png` });
  await guest.screenshot({ path: `${SHOTS}/online_lobby_guest.png` });

  // Both: ELEGIR LUCHADOR -> Select
  for (const p of [host, guest]) { await key(p, 'Enter'); await waitScene(p, 'Select'); }
  await host.waitForTimeout(600);
  await host.screenshot({ path: `${SHOTS}/online_select_host.png` });
  await host.waitForTimeout(900);
  await key(host, 'KeyJ'); // lock hovered fighter
  await key(guest, 'KeyD');
  await key(guest, 'KeyJ');
  await host.waitForFunction(() => (window as W).__acNet!.room()!.players.every((x) => !!x.charId), null, { timeout: 15_000 });
  await guest.screenshot({ path: `${SHOTS}/online_select_guest.png` });
  await host.evaluate(() => (window as W).__acNet!.setTestMeter(true));
  await key(host, 'KeyJ'); // READY
  await key(guest, 'KeyJ'); // READY
  await startFightWithBots(host, guest, 1);
  const chars = (await room(host)).players.map((x) => x.charId);
  expect((await room(guest)).players.map((x) => x.charId)).toEqual(chars);

  // mid-fight screenshot on both
  await host.waitForFunction(() => (window as W).__ac!.getState().phase === 'fight', null, { timeout: 30_000 });
  await host.waitForTimeout(6000);
  await host.screenshot({ path: `${SHOTS}/online_fight_host.png` });
  await guest.screenshot({ path: `${SHOTS}/online_fight_guest.png` });

  await playToEnd(host, guest);
  for (const p of [host, guest]) await waitScene(p, 'PostMatch', 30_000);
  await host.waitForTimeout(1200);
  await host.screenshot({ path: `${SHOTS}/online_postmatch_host.png` });

  // REMATCH (first focused button) on both -> new match id 2
  await key(host, 'Enter');
  await host.waitForTimeout(800);
  await guest.screenshot({ path: `${SHOTS}/online_postmatch_guest_rematch_pending.png` });
  await key(guest, 'Enter');
  await startFightWithBots(host, guest, 2);
  await playToEnd(host, guest);
  for (const p of [host, guest]) await waitScene(p, 'PostMatch', 30_000);
  await host.waitForTimeout(1000);

  // CHANGE FIGHTER (second button) from the guest -> both back to Select, chars cleared, still connected
  await key(guest, 'ArrowRight');
  await key(guest, 'Enter');
  for (const p of [host, guest]) await waitScene(p, 'Select', 30_000);
  const r = await room(host);
  expect(r.phase).toBe('selecting');
  expect(r.players.every((x) => x.connected && !x.ready && x.charId === null)).toBe(true);
  await host.screenshot({ path: `${SHOTS}/online_change_fighter_host.png` });

  const fatal = errors.filter((e) => !/favicon|DevTools|WebSocket connection|Failed to load resource/i.test(e));
  expect(fatal).toEqual([]);
});
