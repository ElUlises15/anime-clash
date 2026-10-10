import { test, expect, type Page } from '@playwright/test';

// Visual check of fighter animation polish (smears, hitstop shake, squash). Screenshots only; asserts no console errors.
type AcWindow = Window & {
  __game?: { scene: { isActive(key: string): boolean } };
  __ac?: { getState(): { phase: string; frame: number; hitstop: number; fighters: { hp: number; maxHp: number; mode: string; grounded: boolean; anim: string; animFrame: number; moveFrame: number; moveId: string | null }[] }; setAutoplay(on: boolean): void };
};
const OUT = '/workspace/anime-clash/shots/gameplay-pass';
const waitScene = (page: Page, k: string, timeout = 30_000) =>
  page.waitForFunction((key) => !!(window as AcWindow).__game?.scene.isActive(key), k, { timeout });
async function key(page: Page, code: string) { await page.keyboard.press(code); await page.waitForTimeout(180); }

test('anim: local vs CPU fight screenshots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await waitScene(page, 'Title');
  await page.waitForTimeout(900);
  await page.mouse.click(683, 384);
  await key(page, 'ArrowDown');
  await key(page, 'Enter');
  await waitScene(page, 'Select');
  await page.waitForTimeout(2500);
  await key(page, 'KeyJ');
  await key(page, 'ArrowRight');
  await key(page, 'Comma');
  await waitScene(page, 'Fight', 15_000);
  await page.waitForFunction(() => !!(window as AcWindow).__ac);
  await page.evaluate(() => (window as AcWindow).__ac!.setAutoplay(true));
  await page.waitForFunction(() => (window as AcWindow).__ac!.getState().phase === 'fight', null, { timeout: 30_000 });
  const got = new Set<string>();
  for (let i = 0; i < 400 && got.size < 4; i++) {
    const s = await page.evaluate(() => { const s = (window as AcWindow).__ac!.getState(); return { h: s.hitstop, m: s.fighters.map((f) => f.mode), g: s.fighters.map((f) => f.grounded), d: s.fighters.map((f) => [f.anim, f.animFrame, f.moveFrame, f.moveId]) }; });
    const tag = s.h > 0 ? 'hitstop' : s.m.includes('attack') ? 'attack' : s.m.includes('dash') ? 'dash' : s.g.includes(false) ? 'air' : '';
    if (tag && !got.has(tag)) { got.add(tag); console.log(tag, JSON.stringify(s)); await page.screenshot({ path: `${OUT}/anim_${tag}.png` }); }
    await page.waitForTimeout(40);
  }
  // Freeze the scene the moment a condition holds so short windows (smear / hitstop shake / landing squash) are captured.
  const freezeOn = (cond: string) => page.evaluate((c) => new Promise<string>((resolve) => {
    const ac = (window as unknown as { __ac: { scene: { scene: { pause(): void } }; getState(): { hitstop: number; fighters: { grounded: boolean; mode: string; anim: string; animFrame: number }[] } } }).__ac;
    let prevAir = [false, false]; const t0 = performance.now();
    const tick = () => {
      const s = ac.getState(); let hit = false;
      if (c === 'smear') hit = s.hitstop > 0 && s.fighters.some((f) => f.mode === 'attack' && (f.anim === 'heavy' || f.anim === 'light2' || f.anim === 'crouchHeavy'));
      if (c === 'land') hit = s.fighters.some((f, i) => f.grounded && prevAir[i]);
      prevAir = s.fighters.map((f) => !f.grounded);
      if (hit || performance.now() - t0 > 40000) { ac.scene.scene.pause(); resolve(JSON.stringify(s.fighters.map((f) => [f.mode, f.anim, f.animFrame]))); return; }
      requestAnimationFrame(tick);
    };
    tick();
  }), cond);
  const resume = () => page.evaluate(() => (window as unknown as { __ac: { scene: { scene: { resume(): void } } } }).__ac.scene.scene.resume());
  for (const c of ['smear', 'land']) {
    console.log(c, await freezeOn(c));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/anim_${c}.png` });
    await resume();
  }
  await page.screenshot({ path: `${OUT}/anim_fight.png` });
  expect(errors).toEqual([]);
});
