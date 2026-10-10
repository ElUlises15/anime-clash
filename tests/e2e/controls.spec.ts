import { test, expect, type Page } from '@playwright/test';

const SHOTS = '../shots/gameplay-pass';
type AcWindow = Window & { __game?: { scene: { isActive(key: string): boolean; getScene(k: string): { scene: { start(k: string): void } } } } };

async function waitScene(page: Page, key: string, timeout = 30_000) {
  await page.waitForFunction((k) => !!(window as AcWindow).__game?.scene.isActive(k), key, { timeout });
}

// Slow headless frames: Phaser can see a fast press twice, so hold each key briefly.
async function tap(page: Page, code: string) {
  await page.keyboard.down(code);
  await page.waitForTimeout(120);
  await page.keyboard.up(code);
  await page.waitForTimeout(250);
}

test('settings: remap a key with keyboard, persist, reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await waitScene(page, 'Title');
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as AcWindow).__game!.scene.getScene('Title').scene.start('Settings'));
  await waitScene(page, 'Settings');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/controls-settings.png` });
  // Focus starts on MASTER: down to the hitbox toggle, right into the table (P1 Fuerte), up to P1 Ligero.
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Enter']) await tap(page, k);
  await page.screenshot({ path: `${SHOTS}/controls-capture.png` });
  await tap(page, 'KeyC'); // used by ULT -> swap
  await page.screenshot({ path: `${SHOTS}/controls-remapped.png` });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anime-clash-bindings') || '{}'));
  expect(saved.p1keys.LIGHT[0]).toBe('KeyC');
  expect(saved.p1keys.ULT).toEqual(['KeyQ']);
  // Mouse: click "RESTABLECER P1".
  const box = await page.locator('canvas').boundingBox();
  const sx = box!.width / 1920, sy = box!.height / 1080;
  await page.mouse.click(box!.x + 1290 * sx, box!.y + (292 + 11 * 48 + 52) * sy);
  await page.waitForTimeout(250);
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem('anime-clash-bindings') || '{}'));
  expect(reset.p1keys.LIGHT[0]).toBe('KeyQ');
  await tap(page, 'Backspace');
  await waitScene(page, 'Title');
  expect(errors).toEqual([]);
});

type FightWindow = Window & { __ac?: { mode: string; getState(): { phase: string; frame: number; fighters: { hp: number; maxHp: number; moveId: string | null }[] } } };

test('fight: new P1 keys attack, H toggles controls help and pauses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await waitScene(page, 'Title');
  await page.waitForTimeout(900);
  for (const k of ['ArrowDown', 'ArrowDown', 'Enter']) await tap(page, k); // TRAINING
  await waitScene(page, 'Select');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/controls-select-hint.png` });
  for (const k of ['KeyJ', 'KeyD', 'KeyJ']) await tap(page, k);
  await waitScene(page, 'Fight', 15_000);
  await page.waitForFunction(() => (window as FightWindow).__ac?.getState().phase === 'fight', null, { timeout: 30_000 });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  const moves = new Set<string>();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('KeyQ');
    for (let j = 0; j < 4; j++) {
      await page.waitForTimeout(40);
      const m = await page.evaluate(() => (window as FightWindow).__ac!.getState().fighters[0].moveId);
      if (m) moves.add(m);
    }
    await page.keyboard.up('KeyQ');
    await page.waitForTimeout(200);
  }
  expect([...moves].length).toBeGreaterThan(0); // Q starts a light attack
  await tap(page, 'KeyH');
  const f0 = await page.evaluate(() => (window as FightWindow).__ac!.getState().frame);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/controls-help-overlay.png` });
  const f1 = await page.evaluate(() => (window as FightWindow).__ac!.getState().frame);
  expect(f1).toBe(f0);
  await tap(page, 'KeyH');
  await page.waitForTimeout(400);
  const f2 = await page.evaluate(() => (window as FightWindow).__ac!.getState().frame);
  expect(f2).toBeGreaterThan(f1);
  expect(errors).toEqual([]);
});
