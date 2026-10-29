import { createHash } from 'node:crypto';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { HypeBus, type HypeEvent } from '../../kit/hype';
import definition, { MarbleRace } from './index';

/** Complete seeded trajectory fingerprint; presentation must not alter physics or RNG. */
export async function raceHypeFixture(enabled = true, seed = 8) {
  await initPhysics();
  const setup: RoundSetup = {
    gameId: definition.id, seed, mode: 'cvs', format: 'ffa',
    difficulty: 1, modifiers: [], streamerName: 'Host',
    participants: Array.from({ length: 8 }, (_, index) => ({
      userId: `p${index}`, login: `p${index}`, displayName: `Runner ${index + 1}`, color: '#ffffff'
    }))
  };
  const ctx = headlessContext(definition, setup, () => {});
  const events: HypeEvent[] = [];
  if (enabled) ctx.hype = new HypeBus(event => events.push(event), false);
  else ctx.hype = {
    at() {}, decisive() {}, nearMiss() {}, jackpot() {}, kill() {},
    combo() {}, win() {}, callout() {}, drain: () => []
  };
  const game = new MarbleRace(ctx);
  const fingerprint = createHash('sha256');
  game.start();
  try {
    for (let tick = 0; tick < 360 * 60 && game.status() === 'playing'; tick++) {
      game.step(1 / 60);
      if (tick % 60 === 0) fingerprint.update(JSON.stringify({ time: game.time,
        balls: game.marbles.map(ball => ({ id: ball.id, x: ball.x, y: ball.y, alive: ball.alive,
          velocity: ball.body.isValid() ? ball.body.linvel() : null })) }));
    }
    fingerprint.update(JSON.stringify({ status: game.status(), nextRandom: ctx.rng.next() }));
    return { hash: fingerprint.digest('hex'), events, status: game.status() };
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
}
