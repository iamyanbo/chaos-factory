import type { GameContext } from '../contract';
import type { PongModel } from './model';

/** Only the actual close finale earns slow motion; flips are visible on the board. */
export class PongHype {
  private decisive = false;
  constructor(private ctx: GameContext) {}

  step(model: PongModel): void {
    const leaders = model.leaders();
    if (leaders.length !== 1) return;
    const ordinal = leaders[0];
    const ball = model.balls.find(actor => actor.ordinal === ordinal)!;
    const counts = [...model.grid.counts].sort((a, b) => b - a);
    if (!this.decisive && model.time >= 80 && counts[0] - counts[1] <= 20) {
      this.decisive = true;
      this.ctx.hype.decisive(ball.x, ball.y, { color: ball.color });
    }
  }
}
