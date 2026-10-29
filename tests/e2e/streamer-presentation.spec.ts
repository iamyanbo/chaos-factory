import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('offline play uses public connected identity without opening chat', async ({ page }) => {
  const sockets: string[] = [];
  page.on('websocket', socket => sockets.push(socket.url()));
  await page.route('/api/twitch/status', route => route.fulfill({ json: {
    mode: 'live', connected: true, authenticated: true, canPredict: true,
    channel: 'test_caster', displayName: 'TestCaster'
  } }));
  await page.goto('/play?game=blade-brawl&seed=1&take=seed&paused=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.paused);
  const streamer = await page.evaluate(() => window.__chaos.inspect().marbles.find(ball => ball.isStreamer));
  expect(streamer?.name).toBe('TestCaster');
  await expect(page.locator('#practice-format option[value="boss"]')).toHaveText('Streamer vs Chat');
  expect(sockets).toEqual([]);
  await mkdir('qa/checks', { recursive: true });
  await page.screenshot({ path: 'qa/checks/streamer-display-name.png' });
});

test('near-miss captions remain small and follow the affected living rider', async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto('/play?game=light-cycles&seed=1&take=seed&fast=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  const samples = await page.evaluate(async () => {
    const found = [];
    while (window.__chaos.phase === 'PLAY') {
      const state = window.__chaos;
      const caption = state.hype.callout;
      if (caption?.text === 'SO CLOSE') {
        const actor = state.inspect().marbles.find(ball => ball.id === caption.actor);
        found.push({ ...caption, actor: actor ? { id: actor.id, x: actor.x, y: actor.y, alive: actor.alive } : undefined,
          camera: state.cameraTarget, zoom: state.cameraZoom });
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    return found;
  });
  expect(samples.length).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(sample.width).toBeLessThanOrEqual(180);
    expect(sample.actor?.alive).toBe(true);
    expect(sample.point.x).toBeCloseTo(sample.actor!.x, 5);
    expect(sample.point.y).toBeCloseTo(sample.actor!.y, 5);
    const expectedX = 960 + (sample.point.x - sample.camera.x) * sample.zoom * .94;
    const expectedY = 540 + (sample.point.y - sample.camera.y) * sample.zoom * .94;
    if (expectedX > 650 && expectedX < 1250 && expectedY > 200 && expectedY < 880) {
      expect(sample.x).toBeCloseTo(expectedX, 2);
      expect(sample.y).toBeCloseTo(expectedY, 2);
    }
  }
  await mkdir('qa/checks', { recursive: true });
  await writeFile('qa/checks/near-miss-alignment.json', JSON.stringify(samples, null, 2));
});
