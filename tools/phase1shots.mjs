// Captures Phase 1 review screenshots at 1366x768. Usage: node tools/phase1shots.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base = 'http://localhost:4173/', out = '../shots/phase1'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const active = (k) => page.waitForFunction((k) => window.__game?.scene.isActive(k), k, { timeout: 30000 });
const key = async (c, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(c); await page.waitForTimeout(200); } };
await page.goto(base + (process.env.Q ?? ''));
await active('Title'); await page.waitForTimeout(1800); await shot('01-title');
await key('ArrowDown'); await key('Enter'); await active('Select'); await page.waitForTimeout(1200);
await key('KeyJ'); await key('ArrowRight'); await page.waitForTimeout(600); await shot('02-select');
await key('Comma'); await active('Fight');
await page.waitForFunction(() => !!window.__ac);
await page.evaluate(() => window.__ac.setAutoplay(true));
await page.waitForTimeout(1200); await shot('03-round-intro');
// mid-fight: find a frame with a hit/beam
let got = 0;
for (let i = 0; i < 40 && got < 3; i++) {
  await page.waitForTimeout(450);
  const s = await page.evaluate(() => { const s = window.__ac.getState(); return { ents: s.entities.length, ev: s.events.map((e) => e.type), ph: s.phase, m: s.fighters.map((f) => f.mode) }; });
  if (s.ph === 'fight' && (s.ents > 0 || s.m.includes('hitstun') || s.m.includes('attack'))) { await shot(`04-midfight-${got}`); got++; }
}
// ultimate: fast-forward until cinematic
for (let tries = 0; tries < 30; tries++) {
  const c = await page.evaluate(() => { window.__ac.fastForward(600, 'cinematic'); const s = window.__ac.getState(); return { c: s.cinematic.active, ph: s.phase }; });
  if (c.c) break;
  if (c.ph === 'matchEnd') break;
}
await page.waitForTimeout(500); await shot('05-ultimate-a');
await page.waitForTimeout(900); await shot('05-ultimate-b');
await page.waitForTimeout(1800); await shot('05-ultimate-c');
// finish match
for (let i = 0; i < 60; i++) {
  const ph = await page.evaluate(() => { window.__ac.fastForward(1200, 'matchEnd'); return window.__ac.getState().phase; });
  if (ph === 'matchEnd') break;
}
await page.waitForTimeout(800); await shot('06-match-end');
await active('PostMatch'); await page.waitForTimeout(1800); await shot('07-postmatch');
console.log('ERRORS', errors.length, errors.slice(0, 8).join('\n'));
await browser.close();
