import type { Rng } from '@chaos/shared';
import { DIRECTIONS, LOOK_AHEAD } from './config';
import type { TrailGrid } from './grid';
import type { Cycle } from './types';

export function forwardSpace(grid: TrailGrid, cycle: Cycle, direction: number): number {
  const heading = DIRECTIONS[direction];
  let clear = 0;
  for (let distance = 1; distance <= LOOK_AHEAD; distance++) {
    if (!grid.open(cycle.column + heading.x * distance, cycle.row + heading.y * distance)) break;
    clear++;
  }
  return clear;
}

function room(grid: TrailGrid, cycle: Cycle, direction: number): number {
  const heading = DIRECTIONS[direction];
  return grid.space(cycle.column + heading.x, cycle.row + heading.y);
}

/** Automatic ninety-degree steering. A blocked turn never beats a safe route. */
export function chooseDirection(grid: TrailGrid, cycle: Cycle, rng: Rng): number {
  const directions = [cycle.direction, (cycle.direction + 3) % 4, (cycle.direction + 1) % 4];
  const choices = directions.map(direction => ({
    direction,
    clear: forwardSpace(grid, cycle, direction),
    room: 0
  })).filter(choice => choice.clear > 0);
  if (!choices.length) return cycle.direction;
  for (const choice of choices) choice.room = room(grid, cycle, choice.direction);
  const forward = choices.find(choice => choice.direction === cycle.direction);
  const mostRoom = Math.max(...choices.map(choice => choice.room));
  const candidates = choices.filter(choice => choice.room === mostRoom);
  const safest = Math.max(...candidates.map(choice => choice.clear));
  if (!cycle.pendingTurn && forward?.room === mostRoom && forward.clear === safest) return cycle.direction;
  const safe = candidates.filter(choice => choice.clear === safest);
  const turns = cycle.pendingTurn ? safe.filter(choice => choice.direction !== cycle.direction) : [];
  return rng.pick(turns.length ? turns : safe).direction;
}
