import type { GameEvent, RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { PX } from '../../engine/physics';
import definition, { PegFever } from './index';
import type { Shot } from './types';

export const DT = 1 / 60;

export function fixture(count = 6, seed = 26, faction = false) {
  const events: GameEvent[] = [];
  const setup: RoundSetup = {
    gameId: definition.id,
    seed,
    mode: faction ? 'faction' : 'cvs',
    format: faction ? 'faction' : 'ffa',
    difficulty: 1,
    modifiers: [],
    streamerName: 'Host',
    teams: faction ? ['red', 'blue'] : undefined,
    participants: Array.from({ length: count }, (_, index) => ({
      userId: `p${index}`,
      login: `p${index}`,
      displayName: `Viewer ${index + 1}`,
      color: '#ffffff',
      teamId: faction ? index % 2 ? 'blue' : 'red' : undefined
    }))
  };
  const ctx = headlessContext(definition, setup, event => events.push(event));
  const game = new PegFever(ctx);
  return {
    ctx,
    game,
    events,
    destroy() {
      game.destroy();
      ctx.physics.destroy();
    }
  };
}

export function place(shot: Shot, x: number, y: number, vx = 0, vy = 0): void {
  shot.body.setTranslation({ x: x / PX, y: y / PX }, true);
  shot.body.setLinvel({ x: vx / PX, y: vy / PX }, true);
  shot.x = shot.prevX = x;
  shot.y = shot.prevY = y;
}

export function advance(game: PegFever, seconds: number): void {
  for (let tick = 0; tick < Math.round(seconds / DT); tick++) game.step(DT);
}
