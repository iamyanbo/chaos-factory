import { ARENA_LEFT, ARENA_SIZE, CELL_SIZE, DIRECTIONS, GRID_SIZE, HEAD_RADIUS,
  SPACE_SEARCH_LIMIT, WALL_WIDTH } from './config';

/** The same occupied cells are drawn as solid trails and used by the steering. */
export class TrailGrid {
  readonly owners = new Uint8Array(GRID_SIZE * GRID_SIZE);
  border = 0;
  private visited = new Uint32Array(GRID_SIZE * GRID_SIZE);
  private queue = new Int32Array(SPACE_SEARCH_LIMIT);
  private stamp = 0;

  index(column: number, row: number): number {
    return row * GRID_SIZE + column;
  }

  playable(column: number, row: number): boolean {
    const x = (column + 0.5) * CELL_SIZE;
    const y = (row + 0.5) * CELL_SIZE;
    const edge = this.border * CELL_SIZE + HEAD_RADIUS + WALL_WIDTH;
    return column >= 0 && row >= 0 && column < GRID_SIZE && row < GRID_SIZE
      && x >= edge && y >= edge && x <= ARENA_SIZE - edge && y <= ARENA_SIZE - edge;
  }

  owner(column: number, row: number): number {
    return this.playable(column, row) ? this.owners[this.index(column, row)] : -1;
  }

  open(column: number, row: number): boolean {
    return this.owner(column, row) === 0;
  }

  inside(x: number, y: number): boolean {
    const edge = this.border * CELL_SIZE + HEAD_RADIUS + WALL_WIDTH;
    return x >= ARENA_LEFT + edge && x <= ARENA_LEFT + ARENA_SIZE - edge
      && y >= edge && y <= ARENA_SIZE - edge;
  }

  /** A bounded free-space search avoids entering a tiny sealed pocket. */
  space(column: number, row: number): number {
    this.stamp++;
    if (this.stamp >= 0xffffffff) {
      this.visited.fill(0);
      this.stamp = 1;
    }
    const first = this.index(column, row);
    this.queue[0] = first;
    this.visited[first] = this.stamp;
    let count = 1;
    for (let at = 0; at < count && count < SPACE_SEARCH_LIMIT; at++) {
      const x = this.queue[at] % GRID_SIZE;
      const y = Math.floor(this.queue[at] / GRID_SIZE);
      for (const heading of DIRECTIONS) {
        const nextX = x + heading.x;
        const nextY = y + heading.y;
        const next = this.index(nextX, nextY);
        if (this.visited[next] !== this.stamp && this.open(nextX, nextY)) {
          this.visited[next] = this.stamp;
          this.queue[count++] = next;
          if (count === SPACE_SEARCH_LIMIT) break;
        }
      }
    }
    return count;
  }

  clear(owner: number, cells: readonly number[]): void {
    for (const cell of cells) if (this.owners[cell] === owner) this.owners[cell] = 0;
  }
}
