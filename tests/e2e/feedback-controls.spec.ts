import { expect, test } from '@playwright/test';

test('offline settings hide seeds and both round buttons choose a fresh hidden seed', async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto('/play?game=pong-wars&take=seed&paused=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  const first = await page.evaluate(() => window.__chaos.seed);
  await page.getByRole('button', { name: 'Show settings' }).click();
  await expect(page.getByLabel('Seed', { exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('seed')).toBe(false);
  await page.getByRole('button', { name: 'Restart round', exact: true }).click();
  await page.waitForFunction(seed => window.__chaos?.phase === 'PLAY'
    && window.__chaos.seed !== seed, first);
  const second = await page.evaluate(() => window.__chaos.seed);
  await page.getByRole('button', { name: 'New round', exact: true }).click();
  await page.waitForFunction(seed => window.__chaos?.phase === 'PLAY'
    && window.__chaos.seed !== seed, second);
  expect(new URL(page.url()).searchParams.has('seed')).toBe(false);
});

test('an explicit reproduction link still starts at its exact seed', async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto('/play?game=pong-wars&seed=314159&take=seed&paused=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  expect(await page.evaluate(() => window.__chaos.seed)).toBe(314159);
  await expect(page.locator('#practice-seed')).toHaveCount(0);
});
