import type { Rng } from "@chaos/shared";
import { GRID_SIZE, SPECIAL_ORBITS, TILE_COUNT } from "./config";
import type { TerritoryGrid } from "./board";

export const SPECIAL = { none: 0, split: 1, bomb: 2, wall: 3 } as const;

/** Every initial item has an exact partner across both arena center lines. */
export function mirrorOrbit(index: number): number[] {
  const x = index % GRID_SIZE;
  const y = Math.floor(index / GRID_SIZE);
  const last = GRID_SIZE - 1;
  return [y * GRID_SIZE + x, y * GRID_SIZE + last - x,
    (last - y) * GRID_SIZE + x, (last - y) * GRID_SIZE + last - x];
}

export function createSpecials(rng: Rng): Uint8Array {
  const result = new Uint8Array(TILE_COUNT);
  const candidates: number[] = [];
  // Leave the outer lane clear, and avoid the exact center of the opening.
  for (let y = 1; y < GRID_SIZE / 2 - 1; y++) {
    for (let x = 1; x < GRID_SIZE / 2 - 1; x++) candidates.push(y * GRID_SIZE + x);
  }
  const shuffled = rng.shuffle(candidates);
  let cursor = 0;
  for (const kind of ["split", "bomb", "wall"] as const) {
    for (let group = 0; group < SPECIAL_ORBITS[kind]; group++) {
      for (const index of mirrorOrbit(shuffled[cursor++])) result[index] = SPECIAL[kind];
    }
  }
  return result;
}

/** A local mirror pair belongs entirely to the trailing team's current area. */
export function comebackPair(grid: TerritoryGrid, owner: number, rng: Rng): number[] {
  const owned = grid.owned(owner);
  if (owned.length < 2) return [];
  const xs = owned.map(index => index % GRID_SIZE);
  const ys = owned.map(index => Math.floor(index / GRID_SIZE));
  const middleX = Math.min(...xs) + Math.max(...xs);
  const middleY = Math.min(...ys) + Math.max(...ys);
  const eligible = new Set(owned.filter(index => grid.specials[index] === SPECIAL.none));
  const pairs: number[][] = [];
  for (const index of eligible) {
    const x = index % GRID_SIZE;
    const y = Math.floor(index / GRID_SIZE);
    // Reflect across the territory's horizontal, vertical or central axis.
    for (const [mx, my] of [[middleX - x, y], [x, middleY - y], [middleX - x, middleY - y]]) {
      if (mx < 0 || mx >= GRID_SIZE || my < 0 || my >= GRID_SIZE) continue;
      const other = my * GRID_SIZE + mx;
      if (other > index && eligible.has(other)) pairs.push([index, other]);
    }
  }
  return pairs.length ? rng.pick(pairs) : [];
}
