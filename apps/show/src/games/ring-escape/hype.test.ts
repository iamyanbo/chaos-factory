import { expect, test } from 'vitest';
import definition, { RingRun } from './index';
import { RingHype } from './hype';
import { CENTER, RADII, STROKE } from './config';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import { HypeBus, RareCelebration, type HypeEvent, type HypeSink } from '../../kit/hype';
import { makeSetup } from '../../../../../tools/simulation';

function silent(): HypeSink {
  return { at() {}, decisive() {}, nearMiss() {}, jackpot() {}, kill() {}, combo() {},
    win() {}, callout() {}, drain: () => [] };
}

async function scene(count: number, seed: number, work: (game: RingRun) => void): Promise<void> {
  await initPhysics();
  const setup = makeSetup({ game: definition.id, seed, participants: count, format: 'ffa' });
  const context = headlessContext(definition, setup, () => {});
  context.hype = new HypeBus();
  const game = new RingRun(context);
  try { work(game); } finally { game.destroy(); context.physics.destroy(); }
}

test('a living crowned leader narrowly clearing a deadly red arc emits SO CLOSE', async () =>
  scene(1, 1, game => {
    const runner = game.marbles[0];
    runner.owner.crowned = true;
    const ring = game.rings[3];
    ring.angle = ring.previous = 0;
    const distance = ring.radius + STROKE / 2 + runner.radius;
    runner.prevX = CENTER.x - distance - 0.5;
    runner.x = CENTER.x - distance - 1;
    runner.y = runner.prevY = CENTER.y;
    const feedback = new RingHype(game.ctx);
    game.ctx.hype.at(31);
    feedback.observe(game.marbles, game.rings, 31);
    expect(game.ctx.hype.drain().map(event => event.kind)).toEqual(['nearMiss']);
    runner.alive = false;
    game.ctx.hype.at(33);
    feedback.observe(game.marbles, game.rings, 33);
    expect(game.ctx.hype.drain()).toEqual([]);
  }));

test('actual outer passes anticipate the finale without advertising a combo or prize', async () => {
  const seed = Array.from({ length: 50 }, (_, index) => index + 1)
    .find(candidate => new RareCelebration(candidate).armed)!;
  await scene(1, seed, game => {
    for (const ring of game.rings) {
      ring.speed = 0;
      ring.angle = ring.previous = 0;
      ring.body.setRotation(0, true);
    }
    game.time = 31;
    const runner = game.marbles[0];
    runner.body.setLinvel({ x: 3, y: 0 }, true);
    game.start();
    for (let tick = 0; tick < 600 && game.status() === 'playing'; tick++) game.step(1 / 60);
    expect(runner.depth).toBe(RADII.length);
    const events = game.ctx.hype.drain();
    expect(events.filter(event => event.kind === 'combo')).toHaveLength(0);
    expect(events.filter(event => event.kind === 'decisive')).toHaveLength(2);
    expect(events.filter(event => event.kind === 'jackpot')).toHaveLength(0);
  });
});

test('hype leaves Ring Run results, physical positions and RNG identical', async () => {
  const run = async (enabled: boolean) => {
    let snapshot: unknown;
    const events: HypeEvent[] = [];
    await scene(8, 8, game => {
      game.ctx.hype = enabled ? new HypeBus(event => events.push(event)) : silent();
      game.start();
      for (let tick = 0; tick < 360 * 60 && game.status() === 'playing'; tick++) game.step(1 / 60);
      expect(game.status()).not.toBe('playing');
      snapshot = { status: game.status(), inspection: game.inspect(), rng: game.ctx.rng.next() };
    });
    return { snapshot, events };
  };
  const live = await run(true);
  expect(live.snapshot).toEqual((await run(false)).snapshot);
  expect(live.events.some(event => event.kind === 'combo' || event.kind === 'jackpot')).toBe(false);
  expect(live.events.some(event => event.kind === 'decisive')).toBe(true);
  expect(live.events.filter(event => event.kind === 'decisive').length).toBeLessThanOrEqual(2);
});
