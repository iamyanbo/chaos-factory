import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Participant, RoundResult } from '@chaos/shared';

const QUEUE = ['hot-potato', 'multiplier-cascade', 'peg-fever', 'marble-race'];
const DIRECTORY = 'qa/ship-cup';

test('the ship lineup completes a Cup, standings, real top-eight final and saved crown', async ({ page, request }) => {
  test.setTimeout(900000);
  test.skip(process.env.SHIP_CUP !== '1', 'Use the explicitly isolated mock release server.');
  const health = await (await request.get('/api/health')).json();
  expect(health.mode).toBe('mock');
  expect(health.liveTwitch).toBe(false);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir(DIRECTORY, { recursive: true });
  const fast = process.env.SHIP_FAST === '1';
  const started = Date.now();
  await page.goto(`/show?manual=1&seed=42&mute=1${fast ? '&fast=1' : ''}`);
  await page.waitForFunction(() => window.__chaos?.phase === 'ATTRACT' && window.__chaos.connected);
  await page.evaluate(queue => {
    window.__chaos.command('setRoundStart', 'automatic');
    window.__chaos.command('toggleWagers', false);
    window.__chaos.command('setCapacity', Object.fromEntries(queue.map(id => [id, 24])));
    window.__chaos.command('queue', queue);
    window.__chaos.command('start', 5);
  }, QUEUE);
  const rounds = [];
  for (let round = 1; round <= 4; round++) {
    await page.waitForFunction(expected => window.__chaos.phase === 'STANDINGS'
      && window.__chaos.show?.round === expected, round, { timeout: 240000 });
    const snapshot = await page.evaluate(() => ({ game: window.__chaos.gameId,
      show: window.__chaos.show!, result: window.__chaos.result as RoundResult,
      inspection: window.__chaos.inspect(), fps: window.__chaos.fps }));
    expect(snapshot.game).toBe(QUEUE[round - 1]);
    expect(snapshot.result.winner.kind).not.toBe('void');
    expect(snapshot.show.standings.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.show.standings.every(row => row.points >= 0)).toBe(true);
    rounds.push(snapshot);
    await page.screenshot({ path: `${DIRECTORY}/standings-${round}.png` });
  }
  await page.waitForFunction(() => window.__chaos.phase === 'INTRO' && window.__chaos.show?.grandFinal);
  const finalists = await page.evaluate(() => ({ qualified: window.__chaos.show!.qualified,
    participants: (window.__chaos.participants as Participant[]).map(player => player.userId) }));
  expect(finalists.qualified).toEqual(rounds[3].show.standings.slice(0, 8).map(row => row.userId));
  expect(finalists.participants).toEqual(finalists.qualified);
  expect(finalists.qualified).toHaveLength(8);
  await page.screenshot({ path: `${DIRECTORY}/finalists.png` });
  await page.waitForFunction(() => window.__chaos.phase === 'CUP_RESULTS', undefined, { timeout: 240000 });
  const result = await page.evaluate(() => ({ results: window.__chaos.results as RoundResult[],
    show: window.__chaos.show!, fps: window.__chaos.fps }));
  expect(result.results.map(round => round.replay.setup?.gameId)).toEqual([...QUEUE, 'blade-brawl']);
  const final = result.results[4];
  expect(final.replay.setup?.format).toBe('ffa');
  expect(final.champion?.userId).toBeTruthy();
  expect(result.show.championId).toBe(final.champion!.userId);
  await expect.poll(async () => (await (await request.get('/api/profiles')).json())
    .users[final.champion!.userId]?.cupsWon).toBeGreaterThan(0);
  await page.screenshot({ path: `${DIRECTORY}/champion.png` });
  await writeFile(`${DIRECTORY}/report.json`, JSON.stringify({ at: new Date().toISOString(),
    normalSpeed: !fast, elapsedSeconds: (Date.now() - started) / 1000,
    rounds, finalists, ...result, errors, videoRecorded: false }, null, 2));
  expect(errors).toEqual([]);
});
