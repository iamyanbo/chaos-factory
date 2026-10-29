import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { RoundResult } from '@chaos/shared';

test('the plain mock show URL starts a Cup and reaches play without dashboard commands', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/show');
  await page.waitForFunction(() => window.__chaos?.connected && window.__chaos.phase !== 'ATTRACT');
  expect(await page.evaluate(() => window.__chaos.show?.round)).toBe(1);
  await page.waitForFunction(() => window.__chaos.phase === 'PLAY', undefined, { timeout: 80000 });
  expect(await page.evaluate(() => window.__chaos.selectingTake)).toBe(false);
  await page.waitForFunction(() => window.__chaos.inspect().time > 1);
  expect(errors).toEqual([]);
});

test('manual broadcast waits for the host and an extra show tab explains its connection rejection', async ({ page, context }) => {
  await page.goto('/show?manual=1');
  await page.waitForFunction(() => window.__chaos?.connected);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__chaos.phase)).toBe('ATTRACT');
  const extra = await context.newPage();
  try {
    await extra.goto('/show?manual=1');
    await expect(extra.getByRole('alert')).toContainText('A show is already running');
    await expect(extra.getByRole('link', { name: 'Open the dashboard to control the running show' }))
      .toHaveAttribute('href', '/dashboard');
    expect(await page.evaluate(() => window.__chaos.connected)).toBe(true);
  } finally {
    await extra.close();
  }
});

test('an automatically started mock Cup completes five rounds and all four standings screens', async ({ page }) => {
  const errors: string[] = [];
  const wagers: { type: string; roundId?: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framesent', event => {
    try {
      const message = JSON.parse(String(event.payload));
      if (typeof message.type === 'string' && message.type.startsWith('prediction.')) wagers.push(message);
    } catch { /* Development sockets may send non-JSON heartbeats. */ }
  }));
  // Speed up the clock for full-Cup coverage; no dashboard or debug commands start it.
  await page.goto('/show?fast=1&take=seed&seed=26&mute=1');
  const standings = new Set<number>();
  const deadline = Date.now() + 120000;
  await mkdir('qa/checks', { recursive: true });
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({ phase: window.__chaos?.phase,
      completed: window.__chaos?.results.length }));
    if (state.phase === 'STANDINGS' && !standings.has(state.completed)) {
      standings.add(state.completed);
      await page.screenshot({ path: `qa/checks/auto-cup-standing-${state.completed}.png` });
    }
    if (state.phase === 'CUP_RESULTS') break;
    await page.waitForTimeout(80);
  }
  const cup = await page.evaluate(() => ({ phase: window.__chaos.phase,
    results: window.__chaos.results as RoundResult[], predictions: window.__chaos.predictions }));
  expect(cup.phase).toBe('CUP_RESULTS');
  expect(cup.results).toHaveLength(5);
  expect(cup.results.every(result => result.winner.kind !== 'void')).toBe(true);
  const games = cup.results.map(result => result.replay.setup!.gameId);
  expect(new Set(games.slice(0, 4)).size).toBe(4);
  expect(games[4]).toBe('blade-brawl');
  expect(games).not.toContain('counterweight-clash');
  expect(games.every(game => ['hot-potato', 'blade-brawl', 'multiplier-cascade', 'peg-fever', 'marble-race'].includes(game))).toBe(true);
  expect(standings.size).toBe(4);
  const created = wagers.filter(message => message.type === 'prediction.create');
  expect(created.length).toBeGreaterThan(0);
  for (const wager of created) {
    expect(wagers.some(message => message.type === 'prediction.lock' && message.roundId === wager.roundId)).toBe(true);
    expect(wagers.some(message => message.type === 'prediction.resolve' && message.roundId === wager.roundId)).toBe(true);
    expect(wagers.some(message => message.type === 'prediction.cancel' && message.roundId === wager.roundId)).toBe(false);
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'qa/checks/auto-cup-champion.png' });
  await writeFile('qa/checks/auto-cup.json', JSON.stringify({ cup, wagers, standings: [...standings], errors }, null, 2));
});
