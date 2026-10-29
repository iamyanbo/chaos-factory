import type { GameContext } from '../contract';
import { FINISH_Y } from './config';
import type { Racer } from './types';

/** Only the actual first finish earns a celebration; course traffic is not a combo. */
export class RaceHype {
  constructor(private ctx: GameContext) {}

  finish(racer: Racer, _suddenDeath: boolean): void {
    if (racer.place !== 1) return;
    this.ctx.hype.decisive(racer.x, FINISH_Y,
      { userId: racer.id, name: racer.name, color: racer.color });
  }
}
