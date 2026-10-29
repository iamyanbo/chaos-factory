import type { GameEvent, RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics, PX } from '../../engine/physics';
import definition, { HotPotato } from './index';
import { CENTER } from './config';
import type { Bomb } from './types';

export function setup(seed = 7, count = 24, format: 'ffa' | 'boss' = 'ffa'): RoundSetup {
  return { gameId: definition.id, seed, mode: 'cvs', format, competition: 'individual',
    difficulty: .5, modifiers: [], streamerName: 'HOST',
    participants: Array.from({ length: count }, (_, index) => ({ userId: `player-${index}`,
      login: `player-${index}`, displayName: `PLAYER ${index}`, color: '#ffffff' })) };
}

export async function fixture(count = 8, seed = 7, format: 'ffa' | 'boss' = 'ffa') {
  await initPhysics();
  const events: GameEvent[] = [];
  const ctx = headlessContext(definition, setup(seed, count, format), event => events.push(event));
  const game = new HotPotato(ctx);
  game.start();
  return { game, ctx, events, dispose: () => { game.destroy(); ctx.physics.destroy(); } };
}

export function place(game: HotPotato, ordinal: number, x: number, y: number, vx = 0, vy = 0): void {
  const marble = game.marbles[ordinal];
  game.ctx.physics.move(marble.body, x, y);
  marble.x = marble.prevX = x;
  marble.y = marble.prevY = y;
  marble.body.setLinvel({ x: vx / PX, y: vy / PX }, true);
}

export function park(game: HotPotato): void {
  game.marbles.forEach((_, index) => {
    const angle = .3 + index / game.marbles.length * Math.PI * 2;
    place(game, index, CENTER.x + Math.cos(angle) * 270, CENTER.y + Math.sin(angle) * 270);
  });
}

export function bomb(holder: number, remaining = 10, id = 100): Bomb {
  return { id, holder, remaining, duration: 10, transferAt: 0, beepAt: 1000, mega: false, shortened: false };
}

export function ticks(game: HotPotato, count: number): void {
  for (let tick = 0; tick < count; tick++) game.step(1 / 60);
}
