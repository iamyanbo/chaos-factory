import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('the first race finish never pulls the camera backward or changes zoom', async ({ page }) => {
  await page.goto('/play?game=marble-race&seed=5&take=seed&bots=24&fast=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  const samples = await page.evaluate(async () => {
    const rows: { time: number; cameraY: number; zoom: number; finished: number; slow: boolean }[] = [];
    await new Promise<void>(done => {
      const sample = () => {
        const state = window.__chaos;
        if (state.phase !== 'PLAY') { done(); return; }
        const inspected = state.inspect();
        rows.push({ time: inspected.time, cameraY: state.cameraTarget.y,
          zoom: state.cameraZoom, finished: Number(inspected.details.finished), slow: state.hype.slowing });
        requestAnimationFrame(sample);
      };
      sample();
    });
    return rows;
  });
  const finish = samples.findIndex(row => row.finished > 0);
  expect(finish).toBeGreaterThan(0);
  expect(samples.slice(finish).some(row => row.slow)).toBe(true);
  for (let index = Math.max(1, finish - 4); index < samples.length; index++) {
    expect(samples[index].time).toBeGreaterThanOrEqual(samples[index - 1].time);
    expect(samples[index].cameraY).toBeGreaterThanOrEqual(samples[index - 1].cameraY - 1e-6);
    expect(samples[index].zoom).toBeCloseTo(1, 5);
  }
  await mkdir('qa/checks', { recursive: true });
  await writeFile('qa/checks/race-finish-camera.json', JSON.stringify(samples, null, 2));
});
