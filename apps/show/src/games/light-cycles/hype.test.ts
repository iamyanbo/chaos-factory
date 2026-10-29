import { expect, test } from 'vitest';
import definition, { LightCycles } from './index';
import { LightHype } from './hype';
import { cellCenter } from './config';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import { HypeBus, RareCelebration, type HypeEvent, type HypeSink } from '../../kit/hype';
import { makeSetup } from '../../../../../tools/simulation';

function silent(): HypeSink {
  return { at() {}, decisive() {}, nearMiss() {}, jackpot() {}, kill() {}, combo() {},
    win() {}, callout() {}, drain: () => [] };
}

async function scene(count: number, seed: number, work: (game: LightCycles) => void): Promise<void> {
  await initPhysics();
  const setup = makeSetup({ game: definition.id, seed, participants: count, format: 'ffa' });
  const context = headlessContext(definition, setup, () => {});
  context.hype = new HypeBus();
  const game = new LightCycles(context);
  try { work(game); } finally { game.destroy(); context.physics.destroy(); }
}

test('a surviving leader turning away within 0.3 radius of a solid trail emits a near miss', async () =>
  scene(2, 1, game => {
    const cycle = game.model.cycles[0];
    game.ctx.setup.participants[0].crowned = true;
    game.model.grid.owners.fill(0);
    Object.assign(cycle, { column: 30, row: 30, direction: 0, ...cellCenter(30, 30) });
    const occupied = game.model.grid.index(31, 30);
    game.model.grid.owners[occupied] = 2;
    game.model.cycles[1].cells = [game.model.grid.index(31, 29), occupied];
    const feedback = new LightHype(game.ctx);
    feedback.before(game.model);
    cycle.direction = 1;
    cycle.y += 0.5;
    game.ctx.hype.at(10);
    feedback.observe(game.model, { turns: [0], crashes: [] }, game.marbles);
    expect(game.ctx.hype.drain().map(event => event.kind)).toEqual(['nearMiss']);
    game.model.grid.owners[occupied] = 0;
    game.ctx.hype.at(12);
    feedback.observe(game.model, { turns: [0], crashes: [] }, game.marbles);
    expect(game.ctx.hype.drain()).toEqual([]);
  }));

test('two trail crashes report the victims without a kill-streak or jackpot popup', async () => {
  const seed = Array.from({ length: 50 }, (_, index) => index + 1)
    .find(candidate => new RareCelebration(candidate).armed)!;
  await scene(3, seed, game => {
    const feedback = new LightHype(game.ctx);
    const cycle = game.model.cycles[1];
    cycle.alive = false;
    const crash = { ordinal: 1, by: 0, cause: 'trail' as const, x: cycle.x, y: cycle.y };
    game.ctx.hype.at(10);
    feedback.crash(crash, game.marbles, game.model);
    game.model.cycles[2].alive = false;
    feedback.crash({ ...crash, ordinal: 2 }, game.marbles, game.model);
    const events = game.ctx.hype.drain();
    expect(events.filter(event => event.kind === 'jackpot')).toHaveLength(0);
    expect(events.filter(event => event.kind === 'kill').map(event => event.userId)).toEqual([game.marbles[1].id, game.marbles[2].id]);
    expect(events.some(event => event.text === 'DOUBLE KILL' || event.kind === 'combo')).toBe(false);
  });
});

test('live hype never changes Light Cycles survival, grid ownership or RNG', async () => {
  const run = async (enabled: boolean) => {
    let snapshot: unknown;
    const events: HypeEvent[] = [];
    await scene(24, 8, game => {
      game.ctx.hype = enabled ? new HypeBus(event => events.push(event)) : silent();
      game.start();
      for (let tick = 0; tick < 360 * 60 && game.status() === 'playing'; tick++) game.step(1 / 60);
      expect(game.status()).not.toBe('playing');
      snapshot = { status: game.status(), cycles: structuredClone(game.model.cycles),
        grid: [...game.model.grid.owners], rng: game.ctx.rng.next() };
    });
    return { snapshot, events };
  };
  const live = await run(true);
  expect(live.snapshot).toEqual((await run(false)).snapshot);
  expect(live.events.filter(event => event.kind === 'kill')).toHaveLength(23);
  expect(live.events.some(event => event.kind === 'combo' || event.kind === 'jackpot')).toBe(false);
  expect(live.events.filter(event => event.kind === 'decisive').length).toBeLessThanOrEqual(2);
});
