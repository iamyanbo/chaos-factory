import type { GameContext } from '../contract';
import { type HypeSubject } from '../../kit/hype';
import { CENTER, RADII, STROKE } from './config';
import { hazardState, type RedArc, type Ring } from './rings';
import { deepestFirst, type Runner } from './runners';

const TAU = Math.PI * 2;
const NEAR_MISS_RADII = 0.3;

function subject(runner: Runner): HypeSubject {
  return { userId: runner.id, name: runner.owner.displayName,
    color: runner.color, key: runner.id };
}

/** Distance to the same round-capped arc that is drawn and collides. */
function arcGap(runner: Runner, ring: Ring, arc: RedArc, previous = false): number {
  const dx = (previous ? runner.prevX : runner.x) - CENTER.x;
  const dy = (previous ? runner.prevY : runner.y) - CENTER.y;
  const angle = previous ? ring.previous : ring.angle;
  const local = ((Math.atan2(dy, dx) - angle) % TAU + TAU) % TAU;
  let distance: number;
  if (local >= arc.start && local <= arc.end) {
    distance = Math.abs(Math.hypot(dx, dy) - ring.radius);
  } else {
    distance = Math.min(...[arc.start, arc.end].map(end => Math.hypot(
      dx - Math.cos(angle + end) * ring.radius,
      dy - Math.sin(angle + end) * ring.radius,
    )));
  }
  return distance - runner.radius - STROKE / 2;
}

/** Cosmetic observations of real ring passes and deadly red-arc geometry. */
export class RingHype {
  private finalRing = false;
  private survivorFinale = false;

  constructor(private ctx: GameContext) {}

  pass(runner: Runner, ring: Ring, time: number): void {
    const owner = subject(runner);
    if (runner.depth === RADII.length - 1 && !this.finalRing) {
      this.finalRing = true;
      this.ctx.hype.decisive(runner.x, runner.y, owner);
    }
    if (runner.depth === RADII.length) {
      this.ctx.hype.decisive(runner.x, runner.y, owner);
    }
  }

  pop(runner: Runner): void {
    const victim = subject(runner);
    this.ctx.hype.kill(runner.x, runner.y, victim);
    if (runner.owner.crowned || runner.id === this.ctx.setup.crownUserId) {
      this.ctx.hype.callout(runner.x, runner.y, { ...victim, text: 'DETHRONED' });
    }
  }

  observe(runners: Runner[], rings: Ring[], time: number): void {
    const alive = runners.filter(runner => runner.alive && !runner.finished);
    if (!this.survivorFinale && alive.length === 1 && runners.length > 1
      && !runners.some(runner => runner.finished)) {
      this.survivorFinale = true;
      this.ctx.hype.decisive(alive[0].x, alive[0].y, subject(alive[0]));
    }
    let leader = alive[0];
    for (const runner of alive) if (deepestFirst(runner, leader) < 0) leader = runner;
    for (const runner of alive) {
      if (runner !== leader && !runner.owner.crowned && runner.id !== this.ctx.setup.crownUserId) continue;
      for (const ring of rings) {
        for (const arc of ring.hazards) {
          if (hazardState(arc, time) !== 'deadly') continue;
          const before = arcGap(runner, ring, arc, true);
          const after = arcGap(runner, ring, arc);
          if (before > 0 && before <= runner.radius * NEAR_MISS_RADII && after > before) {
            this.ctx.hype.nearMiss(runner.x, runner.y, subject(runner));
          }
        }
      }
    }
  }
}
