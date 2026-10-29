import { beforeAll, expect, test } from 'vitest';
import type { RoundSetup, TeamId } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import definition from './index';
import { CascadeRelay, RELAY_GOAL } from './relay';
import { prepareUnit } from './units';
import type { Unit } from './types';
import { BALL_RADIUS, GRAVITY } from './course-layout';

beforeAll(async () => initPhysics());
function run(supply = new Map<TeamId, number>()) {
  const setup: RoundSetup = { gameId: definition.id, seed: 26, mode: 'faction', format: 'faction',
    difficulty: .5, modifiers: [], streamerName: 'Host', participants: [], teams: ['red', 'blue'] };
  const ctx = headlessContext(definition, setup, () => {});
  ctx.physics.world.gravity.y = GRAVITY;
  const relay = new CascadeRelay(ctx, ['red', 'blue'], supply);
  const units = new Map<string, Unit>();
  const launches: TeamId[] = [];
  let serial = 0;
  let ticks = 0;
  try {
    for (; ticks < 180 * 60 && !relay.winner; ticks++) {
      const time = ticks / 60;
      relay.sudden = time >= 150;
      relay.step(time, time, units, (team, x, y) => {
        const id = `relay:${serial++}`;
        const marble = ctx.kit.marble(ctx, { userId: id, login: id,
          displayName: team, color: '#ffffff', teamId: team }, x, y, { radius: BALL_RADIUS });
        units.set(id, prepareUnit(marble, 3, id, 0, 0, 1));
        launches.push(team);
        return marble;
      }, unit => { units.delete(unit.marble.id); ctx.physics.remove(unit.marble.body); }, () => {});
      ctx.physics.step();
      for (const unit of units.values()) Object.assign(unit.marble, ctx.physics.position(unit.marble.body));
    }
    return { winner: relay.winner, time: ticks / 60, launches,
      stock: [...relay.stock], finished: [...relay.finished] };
  } finally {
    relay.destroy();
    ctx.physics.destroy();
  }
}

test('even zero-yield hoppers have five physical balls and can decide the race', () => {
  const result = run();
  expect(result.winner).toBeDefined();
  expect(new Map(result.finished).get(result.winner!)).toBe(RELAY_GOAL);
  expect(result.finished.every(([, count]) => count <= RELAY_GOAL)).toBe(true);
  expect(result.launches.filter(team => team === 'red')).toHaveLength(5);
  expect(result.launches.filter(team => team === 'blue')).toHaveLength(5);
});

test('earned hopper supply pours real balls, stays finite and replays exactly', () => {
  const supply = new Map<TeamId, number>([['red', 100], ['blue', 5]]);
  const first = run(supply);
  expect(first.winner).toBeDefined();
  expect(first.launches.filter(team => team === 'red').length).toBeGreaterThan(5);
  for (const [team, remaining] of first.stock) {
    expect(remaining + first.launches.filter(value => value === team).length).toBe(5 + supply.get(team)!);
  }
  expect(run(supply)).toEqual(first);
});
