import { expect, test } from '@playwright/test';

test('Light Cycles keeps all four walls in frame during its decisive finale', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto('/play?game=light-cycles&bots=24&seed=1&take=seed&fast=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  const samples = await page.evaluate(async () => {
    const frames: { zoom: number; x: number; y: number; slowing: boolean; border: number }[] = [];
    while (window.__chaos.phase === 'PLAY') {
      const state = window.__chaos;
      frames.push({ zoom: state.cameraZoom, ...state.cameraTarget,
        slowing: state.hype.slowing, border: Number(state.inspect().details?.border) });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    return frames;
  });
  expect(samples.some(frame => frame.slowing && frame.border > 0)).toBe(true);
  for (const frame of samples) {
    expect(frame.zoom).toBe(1);
    expect(frame.x).toBe(960);
    expect(frame.y).toBe(540);
  }
  expect(errors).toEqual([]);
});
