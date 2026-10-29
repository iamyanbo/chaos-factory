import { expect, test } from 'vitest';
import { Rng } from '@chaos/shared';
import { LightModel } from './model';
import { borderAt, MAX_BORDER } from './config';

test('overtime moves the actual white collision boundary past its old clamp', () => {
  expect(borderAt(149)).toBe(MAX_BORDER);
  expect(borderAt(150.25)).toBeGreaterThan(MAX_BORDER);
  const model = new LightModel(2, new Rng(5));
  model.time = 149.99;
  model.step(1 / 60);
  expect(model.grid.border).toBeGreaterThanOrEqual(MAX_BORDER);
  // The physical border eventually leaves no legal center; no clock verdict exists.
  for (let tick = 0; tick < 120; tick++) model.step(1 / 60);
  expect(model.cycles.every(cycle => !cycle.alive)).toBe(true);
});
