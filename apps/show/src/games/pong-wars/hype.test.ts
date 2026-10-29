import { expect, test } from 'vitest';
import type { HypeEvent } from '@chaos/shared';
import { initPhysics } from '../../engine/physics';
import { createContext } from '../../engine/context';
import definition, { PongWars } from './index';
import { makeSetup } from '../../../../../tools/simulation';

async function round(enabled: boolean) {
  await initPhysics();
  const events: HypeEvent[] = [];
  const ctx = createContext(definition, makeSetup({ game: definition.id, seed: 1,
    mode: 'faction', participants: 16, teams: 4 }), {
    emit: event => { if (event.t === 'hype') events.push(event); }
  });
  if (!enabled) {
    const silent = () => {};
    ctx.hype = { at: silent, decisive: silent, nearMiss: silent, jackpot: silent,
      kill: silent, combo: silent, win: silent, callout: silent, drain: () => [] };
  }
  const game = new PongWars(ctx);
  try {
    game.start();
    for (let tick = 0; tick < 5400; tick++) game.step(1 / 60);
    return { status: game.status(), grid: [...game.model.grid.cells],
      balls: game.marbles.map(ball => [ball.x, ball.y, ball.vx, ball.vy]), events };
  } finally { game.destroy(); ctx.physics.destroy(); }
}

test('hype preserves Pong trajectories, territory and its deadline result exactly', async () => {
  const withHype = await round(true);
  const silent = await round(false);
  expect(withHype.status).toEqual(silent.status);
  expect(withHype.grid).toEqual(silent.grid);
  expect(withHype.balls).toEqual(silent.balls);
  expect(withHype.events.filter(event => event.kind === 'combo')).toEqual([]);
  expect(withHype.events.filter(event => event.kind === 'decisive').length).toBeLessThanOrEqual(2);
  expect(withHype.events.filter(event => event.kind === 'kill' || event.kind === 'nearMiss')).toEqual([]);
});
