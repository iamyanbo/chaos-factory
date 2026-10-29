import { expect, test } from 'vitest';
import { Rng } from '@chaos/shared';
import { LightModel } from './model';
import { chooseDirection, forwardSpace } from './steering';
import { BASE_SPEED, FADE_SECONDS, GRID_SIZE, MAX_BORDER, MAX_PLAYERS,
  SPEED_UP_FACTOR, borderAt, cellCenter, speedAt } from './config';

function place(model: LightModel, ordinal: number, column: number, row: number, direction: number): void {
  const cycle = model.cycles[ordinal];
  Object.assign(cycle, { column, row, direction, ...cellCenter(column, row) });
  cycle.cells = [model.grid.index(column, row)];
  model.grid.owners[cycle.cells[0]] = ordinal + 1;
}

test('all 32 starts are separate, inside the visible wall, with a single solid owned cell', () => {
  const model = new LightModel(MAX_PLAYERS, new Rng(1));
  const starts = model.cycles.map(cycle => cycle.cells[0]);
  expect(new Set(starts).size).toBe(MAX_PLAYERS);
  expect(model.grid.owners).toHaveLength(GRID_SIZE * GRID_SIZE);
  for (const cycle of model.cycles) {
    expect(model.grid.inside(cycle.x, cycle.y)).toBe(true);
    expect(model.grid.owners[cycle.cells[0]]).toBe(cycle.ordinal + 1);
  }
  expect(() => new LightModel(MAX_PLAYERS + 1, new Rng(1))).toThrow(/32/);
});

test('a blocked direction never beats the only safe turn', () => {
  const model = new LightModel(1, new Rng(2));
  model.grid.owners.fill(0);
  place(model, 0, 50, 50, 0);
  model.grid.owners[model.grid.index(51, 50)] = 2;
  model.grid.owners[model.grid.index(50, 49)] = 2;
  const cycle = model.cycles[0];
  for (const pendingTurn of [false, true]) {
    cycle.pendingTurn = pendingTurn;
    expect(chooseDirection(model.grid, cycle, new Rng(8))).toBe(1);
  }
  model.grid.owners.fill(0);
  model.grid.owners[model.grid.index(54, 50)] = 2;
  expect(forwardSpace(model.grid, cycle, 0)).toBe(3);
});

test('open-space preference avoids a sealed pocket even with three clear cells ahead', () => {
  const model = new LightModel(1, new Rng(3));
  model.grid.owners.fill(0);
  place(model, 0, 49, 50, 0);
  for (let column = 50; column <= 54; column++) {
    model.grid.owners[model.grid.index(column, 48)] = 2;
    model.grid.owners[model.grid.index(column, 52)] = 2;
  }
  for (let row = 48; row <= 52; row++) {
    model.grid.owners[model.grid.index(54, row)] = 2;
    if (row !== 50) model.grid.owners[model.grid.index(50, row)] = 2;
  }
  expect(forwardSpace(model.grid, model.cycles[0], 0)).toBe(3);
  expect(chooseDirection(model.grid, model.cycles[0], new Rng(8))).not.toBe(0);
});

test('two in-flight heads claiming the same cell crash together before either claims it', () => {
  const model = new LightModel(2, new Rng(4));
  model.step(1 / 60); // The headings have already been chosen for this cell crossing.
  model.grid.owners.fill(0);
  model.phase = 0.99;
  place(model, 0, 50, 50, 0);
  place(model, 1, 52, 50, 2);
  const events = model.step(1 / 60);
  expect(events.crashes.map(crash => crash.ordinal).sort()).toEqual([0, 1]);
  expect(events.crashes.every(crash => crash.cause === 'head-on')).toBe(true);
  expect(events.crashes.map(crash => crash.by).sort()).toEqual([0, 1]);
  expect(model.cycles.every(cycle => !cycle.alive)).toBe(true);
});

test('contact with an existing trail attributes its owner and does not turn into a bounce', () => {
  const model = new LightModel(2, new Rng(5));
  model.step(1 / 60);
  model.grid.owners.fill(0);
  place(model, 0, 50, 50, 0);
  place(model, 1, 51, 50, 0);
  model.cycles[1].alive = false;
  model.cycles[1].diedAt = model.time;
  const events = model.step(1 / 60);
  expect(events.crashes).toMatchObject([{ ordinal: 0, by: 1, cause: 'trail' }]);
  expect(model.cycles[0].alive).toBe(false);
  expect(model.cycles[0].x).toBeGreaterThan(cellCenter(50, 50).x);
  expect(model.cycles[0].x).toBeLessThan(cellCenter(51, 50).x);
});

test('a crashed trail blocks for the full three seconds, then those exact cells reopen', () => {
  const model = new LightModel(1, new Rng(6));
  const cycle = model.cycles[0];
  cycle.alive = false;
  cycle.diedAt = 0;
  const cell = cycle.cells[0];
  for (let tick = 0; tick < FADE_SECONDS * 60 - 1; tick++) model.step(1 / 60);
  expect(model.grid.owners[cell]).toBe(1);
  expect(cycle.cleared).toBe(false);
  model.step(1 / 60);
  expect(model.grid.owners[cell]).toBe(0);
  expect(cycle.cleared).toBe(true);
});

test('speed-up and closing walls follow the two announced physical stage boundaries', () => {
  expect(speedAt(39.99)).toBe(BASE_SPEED);
  expect(speedAt(40)).toBe(BASE_SPEED * SPEED_UP_FACTOR);
  expect(borderAt(69.99)).toBe(0);
  expect(borderAt(70)).toBe(0);
  expect(borderAt(71)).toBeGreaterThan(0);
  expect(borderAt(120)).toBe(MAX_BORDER);
});

test('fixed-seed motion, crashes and released cells replay exactly', () => {
  function simulate(seed: number) {
    const model = new LightModel(24, new Rng(seed));
    const deaths: unknown[] = [];
    for (let tick = 0; tick < 120 * 60 && model.cycles.filter(cycle => cycle.alive).length > 1; tick++) {
      deaths.push(...model.step(1 / 60).crashes);
    }
    return { time: model.time, grid: [...model.grid.owners], deaths,
      positions: model.cycles.map(cycle => [cycle.x, cycle.y, cycle.alive]) };
  }
  expect(simulate(8)).toEqual(simulate(8));
  expect(simulate(9)).not.toEqual(simulate(8));
});
