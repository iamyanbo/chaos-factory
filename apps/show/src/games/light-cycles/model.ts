import type { Rng } from '@chaos/shared';
import {
  CELL_SIZE, DIRECTIONS, FADE_SECONDS, GRID_SIZE, HEAD_RADIUS, MAX_PLAYERS,
  SPAWN_COLUMNS, SPAWN_JITTER, SPAWN_PADDING, SPAWN_ROWS, TRAIL_WIDTH,
  TURN_CHANCE, borderAt, cellCenter, speedAt
} from './config';
import { TrailGrid } from './grid';
import { chooseDirection } from './steering';
import type { Crash, Cycle, ModelEvents } from './types';

/** Fixed-step grid physics. Entrant names, colors, wagers and profiles never enter it. */
export class LightModel {
  readonly grid = new TrailGrid();
  readonly cycles: Cycle[];
  time = 0;
  phase = 0;
  private steer = true;

  constructor(count: number, private rng: Rng) {
    if (count > MAX_PLAYERS) throw new Error('Light Cycles admits at most 32 entrants');
    const seats = rng.shuffle(Array.from({ length: MAX_PLAYERS }, (_, index) => index));
    const span = GRID_SIZE - SPAWN_PADDING * 2;
    this.cycles = seats.slice(0, count).map((seat, ordinal) => {
      const column = Math.round(SPAWN_PADDING + (seat % SPAWN_COLUMNS + 0.5) * span / SPAWN_COLUMNS)
        + rng.int(-SPAWN_JITTER, SPAWN_JITTER);
      const row = Math.round(SPAWN_PADDING + (Math.floor(seat / SPAWN_COLUMNS) + 0.5) * span / SPAWN_ROWS)
        + rng.int(-SPAWN_JITTER, SPAWN_JITTER);
      const point = cellCenter(column, row);
      const cell = this.grid.index(column, row);
      this.grid.owners[cell] = ordinal + 1;
      return { ordinal, column, row, direction: rng.int(0, 3), pendingTurn: false,
        alive: true, x: point.x, y: point.y, prevX: point.x, prevY: point.y,
        cells: [cell], cleared: false };
    });
  }

  private crash(cycle: Cycle, cause: Crash['cause'], events: ModelEvents, by?: number): void {
    if (!cycle.alive) return;
    cycle.alive = false;
    cycle.diedAt = this.time;
    cycle.deathX = cycle.x;
    cycle.deathY = cycle.y;
    events.crashes.push({ ordinal: cycle.ordinal, by, cause, x: cycle.x, y: cycle.y });
  }

  private chooseTurns(events: ModelEvents): void {
    for (const cycle of this.cycles) {
      if (!cycle.alive) continue;
      const direction = chooseDirection(this.grid, cycle, this.rng);
      if (direction !== cycle.direction) events.turns.push(cycle.ordinal);
      cycle.direction = direction;
      cycle.pendingTurn = false;
    }
    this.steer = false;
  }

  private move(phase: number, events: ModelEvents): void {
    const contactPhase = Math.max(0, (CELL_SIZE - HEAD_RADIUS - TRAIL_WIDTH / 2) / CELL_SIZE);
    for (const cycle of this.cycles) {
      if (!cycle.alive) continue;
      const heading = DIRECTIONS[cycle.direction];
      const origin = cellCenter(cycle.column, cycle.row);
      const owner = this.grid.owner(cycle.column + heading.x, cycle.row + heading.y);
      const progress = owner > 0 && phase >= contactPhase ? contactPhase : phase;
      cycle.x = origin.x + heading.x * progress * CELL_SIZE;
      cycle.y = origin.y + heading.y * progress * CELL_SIZE;
      if (!this.grid.inside(cycle.x, cycle.y)) this.crash(cycle, 'wall', events);
      else if (owner > 0 && phase >= contactPhase) this.crash(cycle, 'trail', events, owner - 1);
    }
  }

  /** All intents resolve together before any entrant claims a new cell. */
  private arrive(events: ModelEvents): void {
    const intents = new Map<number, Cycle[]>();
    for (const cycle of this.cycles) {
      if (!cycle.alive) continue;
      const heading = DIRECTIONS[cycle.direction];
      const cell = this.grid.index(cycle.column + heading.x, cycle.row + heading.y);
      const group = intents.get(cell) ?? [];
      group.push(cycle);
      intents.set(cell, group);
    }
    for (const [cell, group] of intents) {
      if (group.length > 1) {
        for (const cycle of group) {
          cycle.cells.push(cell);
          this.crash(cycle, 'head-on', events, group.find(other => other !== cycle)!.ordinal);
        }
        this.grid.owners[cell] = group[0].ordinal + 1;
        continue;
      }
      const cycle = group[0];
      const heading = DIRECTIONS[cycle.direction];
      cycle.column += heading.x;
      cycle.row += heading.y;
      cycle.cells.push(cell);
      this.grid.owners[cell] = cycle.ordinal + 1;
    }
  }

  step(dt: number): ModelEvents {
    const events: ModelEvents = { crashes: [], turns: [] };
    this.time += dt;
    this.grid.border = borderAt(this.time);
    for (const cycle of this.cycles) {
      cycle.prevX = cycle.x;
      cycle.prevY = cycle.y;
      if (!cycle.alive) {
        if (!cycle.cleared && this.time - cycle.diedAt! >= FADE_SECONDS - 0.000001) {
          this.grid.clear(cycle.ordinal + 1, cycle.cells);
          cycle.cleared = true;
        }
      } else if (this.rng.chance(TURN_CHANCE)) cycle.pendingTurn = true;
    }
    let distance = speedAt(this.time) * dt;
    while (distance > 0.000001) {
      if (this.steer) this.chooseTurns(events);
      const travel = Math.min(distance, 1 - this.phase);
      this.phase += travel;
      distance -= travel;
      this.move(this.phase, events);
      if (this.phase >= 1 - 0.000001) {
        this.arrive(events);
        this.phase = 0;
        this.steer = true;
      }
    }
    return events;
  }
}
