import { expect, test } from '@playwright/test';
import type { RoundResult } from '@chaos/shared';
import { simulate } from '../../tools/simulation';
import { assertReplayResult } from '../../tools/replay-compare';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

test('the real worker selects a blind take and the fixed-view browser result replays exactly', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/api/**', route => route.abort());
  await page.goto('/play?game=ring-escape&bots=24&seed=1&fast=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'RESULT');
  expect(await page.locator('#practice-game option').evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value))).toEqual([
      'blade-brawl', 'pong-wars', 'ring-escape', 'marble-race', 'multiplier-cascade',
      'light-cycles', 'peg-fever', 'hot-potato'
    ]);
  const state = await page.evaluate(() => ({ result: window.__chaos.result,
    zoom: window.__chaos.cameraZoom, target: window.__chaos.cameraTarget,
    replay: window.__chaos.instantReplay }));
  const result = state.result as RoundResult;
  expect(result.bestTake!.candidates.length).toBeGreaterThan(0);
  expect(result.bestTake!.candidates.length).toBeLessThanOrEqual(24);
  expect(result.bestTake!.reason).toBeUndefined();
  expect(result.bestTake!.elapsedMs).toBeLessThan(6500);
  expect(result.replay.setup!.seed).toBe(result.bestTake!.selectedSeed);
  expect(result.bestTake!.candidates.some(take => take.seed === result.replay.seed)).toBe(true);
  expect(state.zoom).toBe(1);
  expect(state.target).toEqual({ x: 960, y: 540 });
  expect(state.replay).toEqual({ frames: 0, bytes: 0, playing: false, failures: 0 });
  const replay = await simulate({ game: 'ring-escape', seed: result.replay.seed,
    setup: result.replay.setup, replay: result.replay.inputs });
  assertReplayResult(replay.result, result);
  expect(errors).toEqual([]);
});

test('an empty offline field admits an ordinary YOU and pause freezes it without a bridge', async ({ page }) => {
  const sockets: string[] = [];
  const errors: string[] = [];
  page.on('websocket', socket => sockets.push(socket.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play?game=ring-escape&bots=0&seed=8&take=seed&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  await page.locator('#practice-join').click();
  await expect.poll(() => page.evaluate(() => window.__chaos.participants.length)).toBe(1);
  const ball = await page.evaluate(() => window.__chaos.inspect().marbles[0]);
  expect(ball.id).toBe('offline-player');
  expect(ball.name).toBe('YOU');
  expect(ball.isStreamer).toBe(false);
  await page.locator('#practice-pause').click();
  const time = await page.evaluate(() => window.__chaos.inspect().time);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__chaos.inspect().time)).toBe(time);
  expect(await page.evaluate(() => window.__chaos.cameraZoom)).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(sockets).toEqual([]);
  expect(errors).toEqual([]);
});

test('restart during take search cannot apply a stale roster or seed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play?game=ring-escape&bots=24&seed=1&mute=1');
  await page.waitForFunction(() => window.__chaos?.selectingTake);
  await page.getByRole('button', { name: 'Show settings', exact: true }).click();
  await page.locator('#practice-seed').fill('2026');
  await page.locator('#practice-bots').fill('12');
  await page.getByRole('button', { name: 'Restart round', exact: true }).click();
  await page.waitForFunction(() => window.__chaos.phase === 'PLAY' && !window.__chaos.selectingTake);
  const state = await page.evaluate(() => ({ take: window.__chaos.bestTake,
    participants: window.__chaos.participants.length }));
  expect(state.take!.requestedSeed).toBe(2026);
  expect(state.participants).toBe(12);
  expect(errors).toEqual([]);
});

test('ring paths never draw connectors through the empty canvas corner', async ({ page }) => {
  await page.goto('/play?game=ring-escape&bots=24&seed=1&record=1&paused=1&take=seed&mute=1');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.paused);
  await mkdir('qa/frames/ring-escape', { recursive: true });
  const path = 'qa/frames/ring-escape/arena-check.png';
  await page.screenshot({ path });
  const pixels = execFileSync('python', ['-c',
    'from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGB"); print(max(max(p) for p in im.crop((0,0,40,40)).getdata()))', path],
  { encoding: 'utf8' });
  expect(Number(pixels.trim())).toBeLessThanOrEqual(20);
});
