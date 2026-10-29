import { Graphics } from 'pixi.js';
import type { GameContext } from '../contract';
import { hazardState, hazardWarning, type Ring } from './rings';
import { deepestFirst, type Runner } from './runners';
import { NeonBalls, NeonSparks, strokeArc, CENTER, WHITE } from '../../kit/neon';
import { TOY } from '../../kit/theme/toy';
import {
  GOLD, PASS_FLASH_SECONDS, POP_COLOR_SPARKS, POP_WHITE_SPARKS,
  PULSE_ALPHA, PULSE_AMPLITUDE, PULSE_HZ, RED, RED_ALPHA,
  SPEED_FLASH_ALPHA, SPEED_FLASH_SECONDS, SPEED_FLASH_WIDTH, WARNING_RED,
  NAME_HIDE_DISTANCE, NAME_REVEAL_DISTANCE
} from './config';

export class RingView {
  private graphics = new Graphics();
  private balls: NeonBalls;
  private sparks: NeonSparks;
  private visibleNames = new Set<string>();

  constructor(ctx: GameContext) {
    ctx.stage.world.addChild(this.graphics);
    this.balls = new NeonBalls(ctx);
    this.sparks = new NeonSparks(ctx);
  }

  render(rings: Ring[], runners: Runner[], time: number, alpha: number,
    speedFlashUntil: number, finale: boolean): void {
    this.graphics.clear();
    for (const [index, ring] of rings.entries()) {
      const angle = ring.previous + (ring.angle - ring.previous) * alpha;
      const color = index === rings.length - 1 && finale && speedFlashUntil <= time
        ? TOY.color.yellow : index % 2 ? TOY.color.pale : TOY.color.white;
      strokeArc(this.graphics, CENTER.x, CENTER.y, ring.radius,
        angle + ring.gap / 2, angle + Math.PI * 2 - ring.gap / 2, color);
      for (const arc of ring.hazards) {
        const state = hazardState(arc, time);
        if (state === 'hidden') continue;
        const warning = state === 'warning' || hazardWarning(ring, arc, angle);
        const pulse = warning
          ? PULSE_ALPHA + PULSE_AMPLITUDE * Math.sin(time * Math.PI * 2 * PULSE_HZ)
          : RED_ALPHA;
        strokeArc(this.graphics, CENTER.x, CENTER.y, ring.radius,
          angle + arc.start, angle + arc.end, warning ? TOY.color.yellow : TOY.color.accentB,
          undefined, state === 'warning' ? pulse * 0.6 : pulse);
      }
      if (speedFlashUntil > time) {
        // Paint flashes follow the real ring; every gap stays open.
        const flash = SPEED_FLASH_ALPHA * (speedFlashUntil - time) / SPEED_FLASH_SECONDS;
        strokeArc(this.graphics, CENTER.x, CENTER.y, ring.radius,
          angle + ring.gap / 2, angle + Math.PI * 2 - ring.gap / 2,
          TOY.color.yellow, SPEED_FLASH_WIDTH, flash);
      }
      if (ring.flashUntil > time) {
        for (const edge of [-1, 1]) {
          const theta = angle + edge * ring.gap / 2;
          this.graphics.circle(CENTER.x + Math.cos(theta) * ring.radius,
            CENTER.y + Math.sin(theta) * ring.radius, 9)
            .fill({ color: TOY.color.yellow, alpha: (ring.flashUntil - time) / PASS_FLASH_SECONDS });
        }
      }
    }
    const leaders = runners.filter(r => r.alive).sort(deepestFirst).slice(0, 8);
    this.balls.render(runners.map(runner => ({ ...runner,
      name: runner.owner.displayName,
      leader: leaders.includes(runner),
      hideName: this.hideName(runner, runners, leaders.includes(runner))
    })), alpha, time);
    this.sparks.render(time);
  }

  private hideName(runner: Runner, runners: Runner[], leader: boolean): boolean {
    const threshold = this.visibleNames.has(runner.id) ? NAME_HIDE_DISTANCE : NAME_REVEAL_DISTANCE;
    const crowded = runners.some(other => other !== runner && other.alive
      && Math.hypot(other.x - runner.x, other.y - runner.y) < threshold);
    const show = leader || !crowded;
    if (show) this.visibleNames.add(runner.id);
    else this.visibleNames.delete(runner.id);
    return !show;
  }

  pop(runner: Runner, time: number): void {
    this.sparks.burst(runner.x, runner.y, runner.color, time, POP_COLOR_SPARKS);
    this.sparks.burst(runner.x, runner.y, WHITE, time, POP_WHITE_SPARKS);
  }

  destroy(): void {
    this.graphics.destroy();
    this.balls.destroy();
    this.sparks.destroy();
    this.visibleNames.clear();
  }
}
