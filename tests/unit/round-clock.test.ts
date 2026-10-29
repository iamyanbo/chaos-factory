import { expect, test } from 'vitest';
import { roundCountdown } from '../../apps/show/src/hud/round-clock';

test('natural games never expose a gameplay clock, including their 150s threshold', () => {
  for (const remaining of [150, 90, 10, 1, 0, -1, -150]) {
    expect(roundCountdown('natural', 'PLAY', remaining)).toBeUndefined();
    expect(roundCountdown(undefined, 'PLAY', remaining)).toBeUndefined();
  }
});

test('score games expose only the final ten seconds while actually playing', () => {
  expect(roundCountdown('timed', 'PLAY', 10.01)).toBeUndefined();
  expect(roundCountdown('timed', 'PLAY', 10)).toBe(10);
  expect(roundCountdown('timed', 'PLAY', .01)).toBe(1);
  for (const phase of ['INTRO', 'LOBBY_BET', 'RESULT', 'STANDINGS']) {
    expect(roundCountdown('timed', phase, 6)).toBeUndefined();
  }
});
