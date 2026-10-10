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
