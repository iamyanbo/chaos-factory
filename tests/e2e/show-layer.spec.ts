import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { RoundResult } from '@chaos/shared';

test('a real five-round Cup shows standings, admits only the top eight and persists its final champion', async ({ page, request }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript('globalThis.__name = fn => fn;');
  await page.routeWebSocket(url => url.pathname !== '/ws', socket => socket.close());
  await page.goto('/show?manual=1&fast=1&seed=42&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'ATTRACT' && window.__chaos.connected);
  await page.evaluate(async () => {
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    await new Promise<void>((done, fail) => {
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'hello', role: 'dashboard' }));
        socket.send(JSON.stringify({ type: 'mock.swarm', viewers: 24, activity: .45, delayMs: [2500, 4500] }));
      };
      socket.onerror = () => fail(new Error('QA bridge unavailable'));
      socket.onmessage = event => {
        const message = JSON.parse(String(event.data));
        if (message.type === 'mock.status' && message.viewers === 24) { socket.close(); done(); }
      };
    });
    window.__chaos.command('queue', ['ring-escape', 'pong-wars', 'marble-race', 'multiplier-cascade']);
    window.__chaos.command('start', 5);
  });
  await mkdir('qa/show-layer', { recursive: true });
  await page.waitForFunction(() => window.__chaos.phase === 'INTRO' && (window.__chaos.show?.phaseTime ?? 0) >= .35);
  await page.screenshot({ path: 'qa/show-layer/intro.png' });
  for (let round = 1; round <= 4; round++) {
    await page.waitForFunction(expected => window.__chaos.phase === 'STANDINGS'
      && window.__chaos.show?.round === expected, round, { timeout: 90000 });
    const standings = await page.evaluate(() => window.__chaos.show!.standings);
    expect(standings.length).toBeGreaterThanOrEqual(8);
    expect(standings.every(row => row.points >= 0 && row.level >= 1)).toBe(true);
    await page.waitForFunction(() => window.__chaos.phase === 'STANDINGS' && (window.__chaos.show?.phaseTime ?? 0) >= 2);
    await page.screenshot({ path: `qa/show-layer/standings-${round}.png` });
  }
  await page.waitForFunction(() => window.__chaos.show?.grandFinal && window.__chaos.phase === 'INTRO');
  const qualified = await page.evaluate(() => window.__chaos.show!.qualified);
  expect(qualified).toHaveLength(8);
  expect(await page.evaluate(() => window.__chaos.gameId)).toBe('blade-brawl');
  await page.screenshot({ path: 'qa/show-layer/grand-final.png' });
  await page.waitForFunction(() => window.__chaos.phase === 'CUP_RESULTS', undefined, { timeout: 90000 });
  const results = await page.evaluate(() => window.__chaos.results) as RoundResult[];
  expect(results).toHaveLength(5);
  const final = results[4];
  expect(final.replay.setup?.format).toBe('ffa');
  expect(final.replay.setup?.participants.map(user => user.userId)).toEqual(qualified);
  expect(final.champion?.userId).toBeTruthy();
  expect(await page.evaluate(() => window.__chaos.show!.championId)).toBe(final.champion!.userId);
  await expect.poll(async () => (await (await request.get('/api/profiles')).json()).users[final.champion!.userId]?.cupsWon).toBeGreaterThan(0);
  await page.screenshot({ path: 'qa/show-layer/champion.png' });
  expect(errors).toEqual([]);
});
