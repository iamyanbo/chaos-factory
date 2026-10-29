import { expect, test } from 'vitest';
import { simulate } from '../../tools/simulation';

test.each(['peg-fever'])('%s collects a completed plugin through its public inspection', async game => {
  const options = { game, seed: 1, participants: 24, format: 'ffa' as const };
  const first = await simulate(options);
  expect(first.timeout).toBe(false);
  expect(first.result.winner.kind).not.toBe('void');
  expect(first.positions.every(Number.isFinite)).toBe(true);
  const replay = await simulate({ ...options, setup: first.result.replay.setup,
    replay: first.result.replay.inputs });
  expect(replay.result).toEqual(first.result);
  expect(replay.positions).toEqual(first.positions);
});
