import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('all eight games are queueable while only the original five start in automatic rotation', async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto('/play');
  const selector = page.locator('select#practice-game');
  await expect(selector.locator('option')).toHaveCount(8);
  await page.goto('/dashboard');
  const games = await page.locator('.game-card').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.game));
  expect(games).toEqual(['hot-potato', 'blade-brawl', 'multiplier-cascade', 'peg-fever', 'marble-race',
    'pong-wars', 'ring-escape', 'light-cycles']);
  expect(await page.locator('[data-enable]:checked').evaluateAll(inputs =>
    inputs.map(input => (input as HTMLInputElement).dataset.enable)))
    .toEqual(['hot-potato', 'blade-brawl', 'multiplier-cascade', 'peg-fever', 'marble-race']);
  await expect(page.locator('[data-game="pong-wars"] .game-kind')).toContainText('Faction supporters');
  expect(await page.locator('h1').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Lilita One');
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Fredoka');
  for (const id of ['show-settings', 'broadcast-settings', 'cup-details', 'dashboard-logs', 'mock-testing']) {
    await expect(page.locator(`#${id}`)).not.toHaveAttribute('open');
  }
  await expect(page.locator('.game-grid')).toHaveCSS('grid-template-columns', /\S+ \S+ \S+/);
  expect((await page.locator('.game-art').first().boundingBox())!.height).toBeGreaterThan(220);
  await page.screenshot({ path: 'qa/checks/dashboard-compact-desktop.png' });
  for (const id of games) {
    const card = page.locator(`.game-card[data-game="${id}"]`);
    const preview = card.locator('img.game-preview');
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toHaveAttribute('src', `/game-previews/${id}.webp`);
    await expect(preview).toHaveJSProperty('naturalWidth', 640);
    await expect(card.getByRole('link', { name: 'Play offline' })).toHaveAttribute('href', `/play?game=${id}`);
  }
  await mkdir('qa/checks', { recursive: true });
  await page.locator('.library').screenshot({ path: 'qa/checks/dashboard-game-floor.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'qa/checks/dashboard-compact-mobile.png', fullPage: true });
});

test('lobby, standings and winner previews use local fonts and never connect to a show', async ({ page }) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  const remoteFonts: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => { if (!socket.url().includes('vite')) sockets.push(socket.url()); });
  page.on('request', request => {
    if (request.resourceType() === 'font' && !new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
      remoteFonts.push(request.url());
    }
  });
  await page.routeWebSocket('**', socket => socket.close());
  for (const screen of ['lobby', 'standings', 'winner']) {
    await page.goto(`/preview?screen=${screen}`);
    await expect(page.locator('html')).toHaveAttribute('data-preview', screen);
    await expect(page.locator('canvas')).toBeVisible();
    expect(await page.evaluate(() => document.fonts.check('54px "Lilita One"')
      && document.fonts.check('500 26px Fredoka'))).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(sockets.filter(url => url.includes('/ws'))).toEqual([]);
  expect(remoteFonts).toEqual([]);
});
