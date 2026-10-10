import { test, expect, type Page } from '@playwright/test';

type AcWindow = Window & {
  __game?: { scene: { isActive(key: string): boolean } };
  __ac?: { getState(): { phase: string; frame: number; fighters: { hp: number; maxHp: number }[] }; setAutoplay(on: boolean): void; mode: string };
};

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function waitScene(page: Page, key: string, timeout = 30_000) {
  await page.waitForFunction((k) => !!(window as AcWindow).__game?.scene.isActive(k), key, { timeout });
}

async function key(page: Page, code: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(code);
    await page.waitForTimeout(180);
  }
}

test('title -> local vs -> select both -> fight with QA bots -> HP changes, no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await waitScene(page, 'Title');
  await page.waitForTimeout(900);
  await page.mouse.click(683, 384); // user gesture (audio unlock)
  await key(page, 'ArrowDown'); // ONLINE -> LOCAL VS
  await key(page, 'Enter');
  await waitScene(page, 'Select');
  await page.waitForTimeout(900);
  await key(page, 'KeyJ'); // P1 confirms hovered fighter
  await key(page, 'ArrowRight'); // P2 moves cursor
  await key(page, 'Comma'); // P2 confirms
  await waitScene(page, 'Fight', 15_000);
  await page.waitForFunction(() => !!(window as AcWindow).__ac);
  await page.evaluate(() => (window as AcWindow).__ac!.setAutoplay(true));
  await page.waitForFunction(() => {
    const s = (window as AcWindow).__ac!.getState();
    return s.phase !== 'intro' && s.fighters.some((f) => f.hp < f.maxHp);
  }, null, { timeout: 60_000 });
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => (window as AcWindow).__ac!.getState());
  expect(s.frame).toBeGreaterThan(150);
  expect(s.fighters.some((f) => f.hp < f.maxHp)).toBe(true);
  expect(errors).toEqual([]);
});

test('training mode loads with dummy', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await waitScene(page, 'Title');
  await page.waitForTimeout(900);
  await key(page, 'ArrowDown', 2); // TRAINING
  await key(page, 'Enter');
  await waitScene(page, 'Select');
  await page.waitForTimeout(900);
  await key(page, 'KeyJ'); // P1 fighter
  await key(page, 'KeyD');
  await key(page, 'KeyJ'); // dummy fighter
  await waitScene(page, 'Fight', 15_000);
  await page.waitForFunction(() => (window as AcWindow).__ac?.mode === 'training');
  await page.waitForFunction(() => (window as AcWindow).__ac!.getState().phase === 'fight', null, { timeout: 30_000 });
  // walk forward and attack the dummy
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  for (let i = 0; i < 12; i++) await key(page, 'KeyJ');
  const s = await page.evaluate(() => (window as AcWindow).__ac!.getState());
  expect(s.phase).toBe('fight');
  expect(errors).toEqual([]);
});
