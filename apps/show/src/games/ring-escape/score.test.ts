import { expect, test } from 'vitest';
import { scoreRingTake } from './score';

test('take scoring penalizes short rounds and real pop fractions of a quarter or more', () => {
  const events = { duration: 90, finished: true, leadChanges: 3,
    finalCloseness: 0.8, quietMax: 4, passes: 60, entrants: 24, pops: 4 };
  const score = scoreRingTake(events);
  expect(scoreRingTake({ ...events, pops: 5 })).toBe(score);
  expect(scoreRingTake({ ...events, pops: 6 })).toBeLessThan(score - 1000);
  expect(scoreRingTake({ ...events, pops: 7 })).toBeLessThan(scoreRingTake({ ...events, pops: 6 }));
  expect(scoreRingTake({ ...events, duration: 74 }))
    .toBeLessThan(scoreRingTake({ ...events, duration: 75 }));
  expect(scoreRingTake({ ...events, duration: 20 })).toBeLessThan(score);
});
