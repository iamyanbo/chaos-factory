import type { GameContext } from '../contract';
import { type HypeSubject } from '../../kit/hype';
import type { NeonBall } from '../../kit/neon';
import {
  ARENA_LEFT, ARENA_SIZE, CELL_SIZE, DIRECTIONS, HEAD_RADIUS, TRAIL_WIDTH,
  WALL_WIDTH, cellCenter,
} from './config';
import type { LightModel } from './model';
import type { Crash, Cycle, ModelEvents } from './types';

const NEAR_MISS_RADII = 0.3;

function subject(actor: NeonBall): HypeSubject {
  return { userId: actor.id, name: actor.name, color: actor.color, key: actor.id };
}

function wallGap(cycle: Cycle, border: number): number {
  const inset = border * CELL_SIZE + WALL_WIDTH;
  return Math.min(cycle.x - ARENA_LEFT - inset, ARENA_LEFT + ARENA_SIZE - inset - cycle.x,
    cycle.y - inset, ARENA_SIZE - inset - cycle.y) - HEAD_RADIUS;
}

/** Feedback observes the exact solid grid; it never steers or consumes its RNG. */
export class LightHype {
  private directions: number[] = [];
  private duel = false;

  constructor(private ctx: GameContext) {}

  before(model: LightModel): void {
    for (const cycle of model.cycles) this.directions[cycle.ordinal] = cycle.direction;
  }

  crash(crash: Crash, actors: NeonBall[], model: LightModel): void {
    const owner = subject(actors[crash.ordinal]);
    this.ctx.hype.kill(crash.x, crash.y, owner);
    const victim = this.ctx.setup.participants[crash.ordinal];
    if (victim.crowned || victim.userId === this.ctx.setup.crownUserId) {
      this.ctx.hype.callout(crash.x, crash.y, { ...owner, text: 'DETHRONED' });
    }
    if (model.cycles.filter(cycle => cycle.alive).length === 1) {
      this.ctx.hype.decisive(crash.x, crash.y, owner);
    }
  }

  observe(model: LightModel, events: ModelEvents, actors: NeonBall[]): void {
    const alive = model.cycles.filter(cycle => cycle.alive);
    let leader = alive[0];
    for (const cycle of alive) if (cycle.cells.length > leader.cells.length) leader = cycle;
    if (!this.duel && alive.length === 2 && model.cycles.length > 2) {
      this.duel = true;
      this.ctx.hype.decisive(alive[0].x, alive[0].y, subject(actors[alive[0].ordinal]));
    }
    for (const ordinal of events.turns) {
      const cycle = model.cycles[ordinal];
      if (!cycle.alive) continue;
      const member = this.ctx.setup.participants[ordinal];
      if (cycle !== leader && !member.crowned && member.userId !== this.ctx.setup.crownUserId) continue;
      const heading = DIRECTIONS[this.directions[ordinal]];
      const column = cycle.column + heading.x;
      const row = cycle.row + heading.y;
      const obstacle = model.grid.owner(column, row);
      if (!obstacle) continue;
      const point = cellCenter(column, row);
      const gap = obstacle > 0
        ? Math.hypot(cycle.x - point.x, cycle.y - point.y) - HEAD_RADIUS - TRAIL_WIDTH / 2
        : wallGap(cycle, model.grid.border);
      if (gap >= 0 && gap <= HEAD_RADIUS * NEAR_MISS_RADII) {
        this.ctx.hype.nearMiss(cycle.x, cycle.y, subject(actors[ordinal]));
      }
    }
  }
}
