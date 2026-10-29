import { expect, test } from 'vitest';
import { Rng } from '@chaos/shared';
import definition, { BladeBrawl } from './index';
import { BladeHype } from './hype';
import { createWeapon } from './weapons';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import { HypeBus, RareCelebration, type HypeEvent, type HypeSink } from '../../kit/hype';
import { makeSetup } from '../../../../../tools/simulation';

function silent(): HypeSink {
  return { at() {}, decisive() {}, nearMiss() {}, jackpot() {}, kill() {}, combo() {},
    win() {}, callout() {}, drain: () => [] };
}

async function scene(count: number, seed: number, work: (game: BladeBrawl) => void): Promise<void> {
  await initPhysics();
  const setup = makeSetup({ game: definition.id, seed, participants: count, format: 'ffa' });
  const context = headlessContext(definition, setup, () => {});
  context.hype = new HypeBus();
  const game = new BladeBrawl(context);
  try { work(game); } finally { game.destroy(); context.physics.destroy(); }
}

test('a crowned fighter narrowly avoiding a lethal drawn blade emits a near miss', async () =>
  scene(2, 1, game => {
    const [attacker, target] = game.marbles;
    attacker.x = attacker.prevX = 900;
    attacker.y = attacker.prevY = target.y = target.prevY = 540;
    attacker.weapons = [createWeapon('Sword', 1, new Rng(1))];
    attacker.weapons[0].angle = attacker.weapons[0].previous = 0;
    target.weapons = [];
    target.owner.crowned = true;
    target.hp = 6;
    target.prevX = 1019;
    target.x = 1020;
    game.ctx.hype.at(10);
    const feedback = new BladeHype(game.ctx);
    feedback.observe(game.marbles, 500);
    expect(game.ctx.hype.drain().map(event => event.kind)).toEqual(['nearMiss']);
    target.prevX = 1020;
    target.x = 1019;
    feedback.observe(game.marbles, 500);
    expect(game.ctx.hype.drain().map(event => event.kind)).toEqual(['decisive']);
    target.prevX = 1100;
    target.x = 1110;
    feedback.observe(game.marbles, 500);
    expect(game.ctx.hype.drain()).toEqual([]);
  }));

test('crown loss is meaningful feedback; upgraded hits do not invent combos or prizes', async () => {
  const seed = Array.from({ length: 50 }, (_, index) => index + 1)
    .find(candidate => new RareCelebration(candidate).armed)!;
  await scene(2, seed, game => {
    const [attacker, target] = game.marbles;
    const weapon = attacker.weapons[0];
    weapon.hits = 2;
    target.owner.crowned = true;
    const before = structuredClone(game.inspect());
    const feedback = new BladeHype(game.ctx);
    game.ctx.hype.at(12);
    feedback.hit(attacker, target, weapon, target.x, target.y, true, game.marbles);
    feedback.hit(attacker, target, weapon, target.x, target.y, true, game.marbles);
    const events = game.ctx.hype.drain();
    expect(events.filter(event => event.kind === 'jackpot')).toHaveLength(0);
    expect(events.some(event => event.text === 'DETHRONED')).toBe(true);
    expect(events.filter(event => event.kind === 'combo')).toHaveLength(0);
    expect(game.inspect()).toEqual(before);
  });
});

test('the actual deciding kill emits decisive even when a fast sweep skipped anticipation', async () =>
  scene(2, 1, game => {
    const [attacker, target] = game.marbles;
    target.hp = 0;
    const feedback = new BladeHype(game.ctx);
    feedback.hit(attacker, target, attacker.weapons[0], target.x, target.y, true, game.marbles);
    expect(game.ctx.hype.drain().filter(event => event.kind === 'decisive')).toHaveLength(1);
  }));

test('live hype and a silent sink produce identical Blade results, bodies and RNG state', async () => {
  const run = async (enabled: boolean) => {
    let snapshot: unknown;
    const events: HypeEvent[] = [];
    await scene(8, 5, game => {
      game.ctx.hype = enabled ? new HypeBus(event => events.push(event)) : silent();
      game.start();
      for (let tick = 0; tick < 360 * 60 && game.status() === 'playing'; tick++) game.step(1 / 60);
      expect(game.status()).not.toBe('playing');
      snapshot = { status: game.status(), inspection: game.inspect(), rng: game.ctx.rng.next() };
    });
    return { snapshot, events };
  };
  const live = await run(true);
  const muted = await run(false);
  expect(live.snapshot).toEqual(muted.snapshot);
  expect(live.events.filter(event => event.kind === 'kill')).toHaveLength(7);
  expect(live.events.some(event => event.kind === 'combo' || event.kind === 'jackpot')).toBe(false);
  expect(live.events.some(event => event.kind === 'decisive')).toBe(true);
  expect(live.events.filter(event => event.kind === 'decisive').length).toBeLessThanOrEqual(2);
});
