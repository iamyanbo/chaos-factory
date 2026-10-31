import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('offline results offer a fresh same-game round and an accessible game change', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play?game=multiplier-cascade&seed=4&take=seed&fast=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'RESULT');
  await expect(page.locator('#practice-role')).toHaveText('Round complete');
  const again = page.getByRole('button', { name: 'Play again', exact: true });
  const choose = page.getByRole('button', { name: 'Change game', exact: true });
  await expect(again).toBeVisible();
  await expect(choose).toBeVisible();
  const seed = await page.evaluate(() => window.__chaos.seed);
  await mkdir('qa/frames/end-screen/after', { recursive: true });
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'qa/frames/end-screen/after/cascade.png' });
  await again.click();
  await page.waitForFunction(previous => window.__chaos.seed !== previous && window.__chaos.phase === 'PLAY', seed);
  expect(await page.evaluate(() => window.__chaos.gameId)).toBe('multiplier-cascade');
  await expect(again).toBeHidden();
  await page.waitForFunction(() => window.__chaos.phase === 'RESULT');
  await choose.click();
  await expect(page.locator('#practice-game')).toBeVisible();
  await expect(page.locator('#practice-game')).toBeFocused();
  await page.locator('#practice-game').selectOption('peg-fever');
  await page.waitForFunction(() => window.__chaos.gameId === 'peg-fever' && window.__chaos.phase === 'PLAY');
  await expect(again).toBeHidden();
  expect(errors).toEqual([]);
});

test('result variants render with long names, all six teams and no offline controls on the OBS view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('qa/frames/end-screen/after', { recursive: true });
  for (const [name, query] of [
    ['winner', 'screen=winner&game=peg-fever'],
    ['long-name', 'screen=winner&name=AReallyReallyLongStreamerName'],
    ['team-six', 'screen=winner&game=multiplier-cascade&case=team&teams=6'],
    ['void', 'screen=void&practice=1']
  ]) {
    await page.goto(`/preview?${query}`);
    await page.waitForSelector('canvas');
    await expect(page.locator('.practice-result-actions')).toHaveCount(0);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `qa/frames/end-screen/after/${name}.png` });
  }
  expect(errors).toEqual([]);
});
