import type { GameInstance } from '../games/contract';

export const SUDDEN_DEATH_SECONDS = 150;
/** Worker/tool observation budget only. The live show never ends on this limit. */
export const SIMULATION_LIMIT_SECONDS = 360;
const activated = new WeakSet<GameInstance>();

export function advanceGame(game: GameInstance, dt: number, elapsed: number): void {
  game.step(dt);
  if (elapsed >= SUDDEN_DEATH_SECONDS && !activated.has(game)) {
    activated.add(game);
    game.suddenDeath?.();
  }
}
