import { expect, test } from '@playwright/test';
import type { RoundResult } from '@chaos/shared';
import { simulate } from '../../tools/simulation';
import { assertReplayResult } from '../../tools/replay-compare';

for (const game of ['blade-brawl', 'pong-wars', 'ring-escape', 'marble-race',
  'multiplier-cascade', 'light-cycles', 'peg-fever', 'hot-potato']) {
  test(`${game} completes in the browser without generic combo or jackpot overlays`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/play?game=${game}&seed=4&take=seed&bots=24&fast=1&mute=1`);
    await page.waitForFunction(() => window.__chaos?.phase === 'RESULT');
    const state = await page.evaluate(() => ({ result: window.__chaos.result,
      counters: window.__chaos.hype.events, caption: window.__chaos.hype.callout?.text }));
    expect(state.result).toBeDefined();
    expect(state.counters.combo).toBe(0);
    expect(state.counters.jackpot).toBe(0);
    expect(['DOUBLE KILL', 'UPSET!', 'CLUTCH!']).not.toContain(state.caption);
    expect(errors).toEqual([]);
    if (game === 'multiplier-cascade') {
      const result = state.result as RoundResult;
      expect(result.replay.setup).toBeDefined();
      const replay = await simulate({ game, seed: result.replay.seed,
        setup: result.replay.setup, replay: result.replay.inputs });
      assertReplayResult(replay.result, result);
    }
  });
}
