import { expect, test } from 'vitest';
import { Rng } from '@chaos/shared';
import { LightModel } from './model';
import definition from './index';
import { ROUND_LIMIT } from './config';
import { simulateTake } from '../../kit/take-simulation';

test('small, default and full fields reach honest last-survivor outcomes with three-stage pacing', () => {
  for (const count of [8, 24, 32]) {
    const durations: number[] = [];
    let valid = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const model = new LightModel(count, new Rng(seed));
      const dead = new Set<number>();
      let revived = false;
      for (let tick = 0; tick < ROUND_LIMIT * 60; tick++) {
        model.step(1 / 60);
        let living = 0;
        for (const cycle of model.cycles) {
          if (cycle.alive) {
            living++;
            if (dead.has(cycle.ordinal)) revived = true;
          } else dead.add(cycle.ordinal);
        }
        if (living <= 1) {
          if (living === 1) valid++;
          break;
        }
      }
      durations.push(model.time);
      expect(revived).toBe(false);
      expect(model.cycles).toHaveLength(count);
      expect(model.time).toBeLessThanOrEqual(ROUND_LIMIT + 0.000001);
    }
    durations.sort((a, b) => a - b);
    expect(valid).toBeGreaterThanOrEqual(11);
    expect(durations[Math.floor(durations.length / 2)]).toBeGreaterThanOrEqual(75);
  }
});

test('the standard 24-candidate seed family selects a natural 90–120s round', async () => {
  const requested = 1;
  const rng = new Rng(requested).fork('best-take-v1');
  const used = new Set<number>();
  const takes = [];
  for (let index = 0; index < 24; index++) {
    let seed = index ? rng.int(1, 2147483647) : requested;
    while (used.has(seed)) seed = rng.int(1, 2147483647);
    used.add(seed);
    takes.push(await simulateTake(definition, {
      gameId: definition.id, seed, mode: 'cvs', format: 'ffa', difficulty: 0.5,
      modifiers: [], streamerName: 'HOST',
      participants: Array.from({ length: 24 }, (_, ordinal) => ({
        userId: `cycle-${ordinal}`, login: `cycle-${ordinal}`,
        displayName: `CYCLE ${ordinal}`, color: '#ffffff'
      }))
    }));
  }
  takes.sort((a, b) => b.score - a.score);
  expect(takes[0].events.finished).toBe(true);
  expect(takes[0].events.duration).toBeGreaterThanOrEqual(90);
  expect(takes[0].events.duration).toBeLessThanOrEqual(120);
});
