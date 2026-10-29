import { expect, test } from 'vitest';
import { raceHypeFixture } from './hype-fixture';

// New physical branching course baseline; enabled/silent traces must still agree.
const BRANCHING_FINGERPRINT = 'bb7fe174b82ed1a6dfd2709f4f52c7050318940aa9c8d6e1dfaebfbb3e60214c';

test('hype preserves the existing seeded race motion, natural result and physics RNG', async () => {
  const visible = await raceHypeFixture();
  const silent = await raceHypeFixture(false);
  expect(visible.hash).toBe(BRANCHING_FINGERPRINT);
  expect(silent.hash).toBe(BRANCHING_FINGERPRINT);
  expect(visible.status).toEqual(silent.status);
  expect(visible.events.filter(event => event.kind === 'decisive')).toHaveLength(1);
  expect(visible.events.some(event => event.kind === 'combo' || event.kind === 'jackpot')).toBe(false);
  // A gravity course has no lethal boundary; bumps are not advertised as escapes from death.
  expect(visible.events.some(event => event.kind === 'nearMiss' || event.kind === 'kill')).toBe(false);
});

test('the actual first finisher receives anticipation without an invented prize', async () => {
  const run = await raceHypeFixture(true, 1);
  const status = run.status;
  if (status === 'playing' || !('done' in status)) throw new Error('Race did not finish');
  const finales = run.events.filter(event => event.kind === 'decisive');
  expect(finales).toHaveLength(1);
  expect(finales[0].userId).toBe(status.done.champion?.userId);
  expect(run.events.filter(event => event.kind === 'combo' || event.kind === 'jackpot')).toHaveLength(0);
  expect(finales[0].time).toBeLessThan(150);
});
