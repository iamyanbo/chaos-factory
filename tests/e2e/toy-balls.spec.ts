import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

test('ball styles change the artwork while preserving the same locked field', async ({ page }) => {
  const errors: string[] = [];
  const screenshots = new Set<string>();
  let field: unknown;
  page.on('pageerror', error => errors.push(error.message));
  for (const style of ['a', 'b', 'c']) {
    await page.goto(`/play?game=blade-brawl&seed=8&take=seed&paused=1&ball=${style}`);
    await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.paused);
    expect(await page.evaluate(() => window.__chaos.ballStyle)).toBe(style);
    const next = await page.evaluate(() => window.__chaos.inspect());
    if (field) expect(next).toEqual(field);
    else field = next;
    screenshots.add(createHash('sha256').update(await page.screenshot()).digest('hex'));
  }
  expect(screenshots.size).toBe(3);
  expect(errors).toEqual([]);
});

test('show ball selection is available before a manual Cup starts', async ({ page }) => {
  for (const [requested, expected] of [['c', 'c'], ['invalid', 'a']]) {
    await page.goto(`/show?manual=1&ball=${requested}`);
    await page.waitForFunction(() => Boolean(window.__chaos));
    expect(await page.evaluate(() => window.__chaos.ballStyle)).toBe(expected);
  }
});
