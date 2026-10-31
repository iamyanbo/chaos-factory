import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RoundResult } from '@chaos/shared';
import { createServer } from '../../apps/server/src/app';
import { registry } from '../../apps/show/src/games/registry';

test('six independent rounds honor the queue, keep full fields, and never emit wagering or progression',
  async ({ page }) => {
    test.setTimeout(180000);
    await mkdir('.data', { recursive: true });
    const runtime = await createServer({ TWITCH_MODE: 'mock', MOCK_VIEWERS: 24,
      DATA_DIR: await mkdtemp(resolve('.data/round-sequence-qa-')) });
    const origin = await runtime.app.listen({ host: '127.0.0.1', port: 0 });
    await runtime.connect();
    const packets: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('websocket', socket => {
      const record = (frame: { payload: string | Buffer }) => {
        try { packets.push(JSON.parse(String(frame.payload)).type); } catch { /* Non-JSON. */ }
      };
      socket.on('framesent', record);
      socket.on('framereceived', record);
    });
    try {
      await page.addInitScript('globalThis.__name = fn => fn;');
      await page.goto(`${origin}/show?manual=1&fast=1&take=seed&seed=42&mute=1`);
      await page.waitForFunction(() => window.__chaos?.connected);
      const queue = ['pong-wars', 'light-cycles', 'ring-escape', 'multiplier-cascade', 'hot-potato', 'blade-brawl'];
      await page.evaluate(queue => {
        window.__chaos.command('queue', queue);
        window.__chaos.command('start');
      }, queue);
      for (let index = 0; index < queue.length; index++) {
        await page.waitForFunction(expected => window.__chaos.phase === 'RESULT'
          && window.__chaos.show?.round === expected, index + 1, { timeout: 90000 });
        const result = await page.evaluate(() => window.__chaos.result) as RoundResult;
        expect(result.winner.kind).not.toBe('void');
        expect(result.replay.setup?.gameId).toBe(queue[index]);
        const spectator = registry.get(queue[index])!.spectator;
        expect(result.replay.setup?.participants).toHaveLength(spectator ? 0 : 24);
        expect(result.replay.setup?.audience).toHaveLength(24);
        expect(result.replay.setup).not.toHaveProperty('crownUserId');
        if (index >= 4) expect(result.replay.setup?.format).toBe('boss');
        const show = await page.evaluate(() => window.__chaos.show!);
        expect(show).not.toHaveProperty('standings');
        expect(show).not.toHaveProperty('qualified');
        expect(show).not.toHaveProperty('championId');
      }
      expect(packets.some(type => /prediction|profile|stats|round\.record/.test(type))).toBe(false);
      expect(errors).toEqual([]);
    } finally { await page.close(); await runtime.app.close(); }
  });
