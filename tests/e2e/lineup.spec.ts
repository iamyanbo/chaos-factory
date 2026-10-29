import { expect, test } from '@playwright/test';
import type { RoundResult } from '@chaos/shared';
import { simulate } from '../../tools/simulation';
import { assertReplayResult } from '../../tools/replay-compare';

for (const format of ['boss','ffa','faction'] as const) {
  test(`Blade ${format} plays offline and its browser result replays exactly`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/play?game=blade-brawl&format=${format}&bots=8&seed=5&fast=1&mute=1`);
    await page.waitForFunction(() => window.__chaos?.phase === 'RESULT');
    const result = await page.evaluate(() => window.__chaos.result) as RoundResult;
    expect(result.replay.setup!.format).toBe(format);
    expect(result.replay.setup!.participants).toHaveLength(8);
    expect(result.winner.kind).not.toBe('void');
    const replay = await simulate({game:'blade-brawl',seed:result.replay.seed,
      setup:result.replay.setup,replay:result.replay.inputs});
    assertReplayResult(replay.result,result);
    expect(errors).toEqual([]);
  });
}

test('all retained offline views load without Twitch and use their declared camera scale', async ({page}) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => sockets.push(socket.url()));
  for (const game of ['blade-brawl', 'pong-wars', 'ring-escape', 'marble-race', 'multiplier-cascade',
    'light-cycles', 'peg-fever', 'hot-potato']) {
    await page.goto(`/play?game=${game}&bots=8&seed=1&take=seed&mute=1`);
    await page.waitForFunction(id => window.__chaos?.gameId === id && window.__chaos.phase === 'PLAY',game);
    await expect.poll(() => page.evaluate(() => window.__chaos.inspect().time)).toBeGreaterThan(0.3);
    await expect.poll(() => page.evaluate(() => Math.abs(window.__chaos.cameraZoom-window.__chaos.expectedCameraZoom))).toBeLessThan(0.000001);
  }
  expect(sockets).toEqual([]);
  expect(errors).toEqual([]);
});

test('Pong runs with zero viewers and retains its fixed machine field', async ({page}) => {
  await page.goto('/play?game=pong-wars&bots=0&teams=3&seed=42&take=seed&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  await expect.poll(() => page.evaluate(() => window.__chaos.inspect().time)).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__chaos.participants.length)).toBe(0);
  expect(await page.evaluate(() => window.__chaos.inspect().marbles.length)).toBe(12);
});

for (const [game, bots] of [['light-cycles', 24], ['peg-fever', 24],
  ['hot-potato', 24]] as const) {
  test(`${game} selects an offline take whose browser result replays exactly`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/play?game=${game}&bots=${bots}&seed=1&fast=1&mute=1`);
    await page.waitForFunction(() => window.__chaos?.phase === 'RESULT');
    const result = await page.evaluate(() => window.__chaos.result) as RoundResult;
    expect(result.replay.setup!.participants).toHaveLength(bots);
    expect(result.bestTake!.candidates.length).toBeGreaterThan(0);
    expect(result.winner.kind).not.toBe('void');
    if (game === 'peg-fever') {
      const inspection = await page.evaluate(() => window.__chaos.inspect());
      const details = inspection.details!;
      expect(details.version).toBe(2);
      expect(details.fired).toEqual(Array(bots).fill(3));
      expect(details.landed).toEqual(Array(bots).fill(3));
      const landings = details.landings as { time: number; total: number }[];
      expect(landings).toHaveLength(bots * 3);
      expect(landings.at(-1)!.time).toBe(inspection.time);
      expect(landings.reduce((sum, landing) => sum + landing.total, 0))
        .toBe(Object.values(result.perUser).reduce((sum, player) => sum + player.score, 0));
    }
    const replay = await simulate({ game, seed: result.replay.seed,
      setup: result.replay.setup, replay: result.replay.inputs });
    assertReplayResult(replay.result, result);
    expect(errors).toEqual([]);
  });
}
