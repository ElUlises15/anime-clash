// Usage: node tools/fightshot.mjs <url> <outPrefix> [seconds]  — starts an autoplay fight and screenshots periodically
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5300/', out = '/tmp/fight', secs = '12'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.scene.getScene('Title')?.sys.isActive(), null, { timeout: 30000 });
await page.evaluate(() => { const g = window.__game; g.scene.getScenes(true).forEach((s) => s.scene.stop()); g.scene.start('Fight', { mode: 'versus', p1: 'goku', p2: 'naruto', controllers: ['cpu', 'cpu'], autoplay: true, seed: 1234 }); });
for (let i = 0; i < Number(secs); i++) {
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => { const s = window.__ac?.getState(); return s ? { f: s.frame, ph: s.phase, hp: s.fighters.map((f) => f.hp), cine: s.cinematic.active, ents: s.entities.length, r: s.round } : null; });
  console.log(i, JSON.stringify(info));
  await page.screenshot({ path: `${out}_${String(i).padStart(2, '0')}.png` });
}
console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
