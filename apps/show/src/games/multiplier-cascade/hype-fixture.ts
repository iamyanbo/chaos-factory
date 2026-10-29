import { createHash } from 'node:crypto';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { HypeBus, type HypeEvent } from '../../kit/hype';
import definition, { MultiplierCascade } from './index';

/** Captures motion, scoring and the physics RNG before any presentation changes. */
export async function cascadeHypeFixture(enabled = true) {
  await initPhysics();
  const setup: RoundSetup = {
    gameId: definition.id, seed: 4, mode: 'faction', format: 'faction',
    difficulty: 1, modifiers: [], streamerName: 'Host', participants: [],
    teams: ['red', 'blue', 'mint', 'gold', 'violet', 'orange']
  };
  const ctx = headlessContext(definition, setup, () => {});
  const events: HypeEvent[] = [];
  if (enabled) ctx.hype = new HypeBus(event => events.push(event), false);
  else ctx.hype = {
    at() {}, decisive() {}, nearMiss() {}, jackpot() {}, kill() {},
    combo() {}, win() {}, callout() {}, drain: () => []
  };
  const game = new MultiplierCascade(ctx);
  const fingerprint = createHash('sha256');
  game.start();
  try {
    for (let tick = 0; tick < 150 * 60 && !game.result; tick++) {
      game.step(1 / 60);
      if (tick % 60 === 0) fingerprint.update(JSON.stringify({ time: game.time,
        balls: game.marbles.map(ball => ({ id: ball.id, x: ball.x, y: ball.y, alive: ball.alive,
          velocity: ball.body.isValid() ? ball.body.linvel() : null })), scores: [...game.scores] }));
    }
    fingerprint.update(JSON.stringify({ status: game.status(), nextRandom: ctx.rng.next() }));
    return { hash: fingerprint.digest('hex'), events, status: game.status() };
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
}
