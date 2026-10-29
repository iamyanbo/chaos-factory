import type { Rng } from "@chaos/shared";
import { ARENA } from "../../kit/neon";
import { GRID_SIZE, TILE_COUNT, TILE_GAP, TILE_SIZE, WALL_OWNER } from "./config";
import { createSpecials, SPECIAL } from "./specials";

export function tileRect(index: number) {
  return {
    x: ARENA.left + (index % GRID_SIZE) * TILE_SIZE + TILE_GAP / 2,
    y: Math.floor(index / GRID_SIZE) * TILE_SIZE + TILE_GAP / 2,
    size: TILE_SIZE - TILE_GAP,
  };
}

/** Layout seats are shuffled before play, independently of names and outcomes. */
export class TerritoryGrid {
  readonly cells = new Int8Array(TILE_COUNT);
  readonly counts: number[];
  readonly changedAt = new Float64Array(TILE_COUNT).fill(-Infinity);
  readonly initial: Int8Array;
  readonly seats: number[];
  readonly specials: Uint8Array;
  version = 0;

  constructor(readonly teamCount: number, rng: Rng) {
    if (teamCount < 2 || teamCount > 4) throw new Error("Pong needs 2–4 teams");
    this.seats = rng.fork("ownership").shuffle(Array.from({ length: teamCount }, (_, i) => i));
    this.counts = Array(teamCount).fill(0);
    const thirds = new Map<number, number>();
    if (teamCount === 3) {
      // 400 cannot divide by three. One white tile starts unclaimed.
      const middle = GRID_SIZE / 2;
      const neutral = middle * GRID_SIZE + middle;
      const indices = Array.from({ length: TILE_COUNT }, (_, i) => i)
        .filter((i) => i !== neutral)
        .sort((a, b) => this.angle(a) - this.angle(b) || a - b);
      const share = Math.floor(TILE_COUNT / teamCount);
      indices.forEach((index, rank) => thirds.set(index, Math.floor(rank / share)));
    }
    const orientation = rng.fork("orientation");
    const turns = orientation.int(0, 3);
    const mirror = orientation.chance(0.5);
    for (let index = 0; index < TILE_COUNT; index++) {
      let x = index % GRID_SIZE;
      let y = Math.floor(index / GRID_SIZE);
      if (mirror) x = GRID_SIZE - 1 - x;
      for (let turn = 0; turn < turns; turn++) [x, y] = [GRID_SIZE - 1 - y, x];
      let seat: number;
      if (teamCount === 2) seat = x < GRID_SIZE / 2 ? 0 : 1;
      else if (teamCount === 4) {
        const west = x < GRID_SIZE / 2;
        seat = y < GRID_SIZE / 2 ? (west ? 0 : 1) : west ? 3 : 2;
      }
      else seat = thirds.get(y * GRID_SIZE + x) ?? -1;
      const owner = seat < 0 ? -1 : this.seats[seat];
      this.cells[index] = owner;
      if (owner >= 0) this.counts[owner]++;
    }
    this.specials = createSpecials(rng.fork("specials"));
    for (let index = 0; index < TILE_COUNT; index++) {
      if (this.specials[index] === SPECIAL.wall) this.setOwner(index, WALL_OWNER, -Infinity);
    }
    // Eight mirrored walls do not divide into three equal thirds. Leave the
    // small remainder visibly neutral rather than granting extra starting area.
    const equalShare = Math.min(...this.counts);
    const neutralRng = rng.fork("neutral-start");
    for (const owner of this.seats) {
      const remainder = this.counts[owner] - equalShare;
      const candidates = neutralRng.shuffle(this.owned(owner));
      for (const index of candidates.slice(0, remainder)) this.setOwner(index, -1, -Infinity);
    }
    this.initial = this.cells.slice();
  }

  private angle(index: number): number {
    const middle = (GRID_SIZE - 1) / 2;
    return Math.atan2(Math.floor(index / GRID_SIZE) - middle, (index % GRID_SIZE) - middle);
  }

  flip(index: number, owner: number, time: number): boolean {
    if (this.cells[index] === WALL_OWNER) return false;
    return this.setOwner(index, owner, time);
  }

  setOwner(index: number, owner: number, time: number): boolean {
    const previous = this.cells[index];
    if (previous === owner) return false;
    if (previous >= 0) this.counts[previous]--;
    this.cells[index] = owner;
    if (owner >= 0) this.counts[owner]++;
    this.changedAt[index] = time;
    this.version++;
    return true;
  }

  consume(index: number): number {
    const special = this.specials[index];
    if (special !== SPECIAL.none && special !== SPECIAL.wall) {
      this.specials[index] = SPECIAL.none;
      this.version++;
    }
    return special;
  }

  owned(owner: number, initial = false): number[] {
    const cells = initial ? this.initial : this.cells;
    const indices: number[] = [];
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] === owner) indices.push(index);
    }
    return indices;
  }
}
