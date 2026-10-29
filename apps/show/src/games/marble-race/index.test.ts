import { beforeAll, expect, test } from 'vitest';
import { resultSchema, type RoundSetup, type TeamId } from '@chaos/shared';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import definition, { MarbleRace } from './index';
import { factionStandings } from './scoring';
import { AUDIT_SECONDS } from './config';

beforeAll(async () => initPhysics());

function setup(seed = 1, count = 24, faction = false): RoundSetup {
  const teams: TeamId[] = ['red', 'blue', 'mint', 'gold'];
  return { gameId: definition.id, seed, mode: faction ? 'faction' : 'cvs',
    format: faction ? 'faction' : 'ffa', difficulty: 1, modifiers: [], teams,
    streamerName: 'Host', participants: Array.from({ length: count }, (_, index) => ({
      userId: `p${index}`, login: `p${index}`, displayName: `Runner ${index + 1}`,
      color: '#ffffff', teamId: faction ? teams[index % teams.length] : undefined
    })) };
}

function run(seed = 1, count = 24, faction = false, renderCamera = true) {
  const ctx = headlessContext(definition, setup(seed, count, faction), () => {});
  if (!renderCamera) ctx.camera.follow = () => {};
  const game = new MarbleRace(ctx);
  game.start();
  let bodies = 0;
  try {
    for (let tick = 0; tick < AUDIT_SECONDS * 60 + 1 && game.status() === 'playing'; tick++) {
      game.step(1 / 60);
      bodies = Math.max(bodies, ctx.physics.entities.size);
    }
    const status = game.status();
    const result = typeof status === 'object' && 'done' in status ? status.done : undefined;
    return { result, bodies, time: game.time, positions: game.marbles.map(m => [m.x, m.y]),
      progress: game.takeState(), modules: game.course.modules, events: game.events };
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
}

test('course modules are seeded, replay is exact and camera cannot change physics', () => {
  const first = run(1);
  const replay = run(1, 24, false, false);
  expect(replay).toEqual(first);
  expect(first.modules.map(module => module.kind).sort()).toEqual(['breakthrough', 'paddles', 'seesaw', 'trapdoor', 'zigzag']);
  expect(first.bodies).toBeLessThanOrEqual(definition.maxBodies);
  expect(first.positions.flat().every(Number.isFinite)).toBe(true);
  expect(resultSchema.safeParse(first.result).success).toBe(true);
  expect(first.result?.champion).toBeDefined();
  expect(first.events.filter(event => event.t === 'activity').length).toBeGreaterThan(6);
});

test.each([{ count: 1, seed: 219 }, { count: 48, seed: 719 }, { count: 24, seed: 4 }])(
  '$count marbles seed $seed finish naturally after the full grace period', ({ count, seed }) => {
    const runResult = run(seed, count);
    expect(runResult.result?.champion).toBeDefined();
    expect(runResult.time).toBeLessThan(AUDIT_SECONDS);
  });

test('faction finish ranks use actual top-three places and short rosters with an explicit DNF penalty', () => {
  const ctx = headlessContext(definition, setup(8, 5, true), () => {});
  const game = new MarbleRace(ctx);
  try {
    game.marbles[0].place = 1;
    game.marbles[4].place = 4;
    game.marbles[1].place = 2;
    const rows = factionStandings(game.marbles);
    expect(rows.find(row => row.teamId === 'red')?.score).toBe(-2.5);
    expect(rows.find(row => row.teamId === 'blue')?.score).toBe(-2);
    expect(rows.find(row => row.teamId === 'mint')?.stat).toContain('1 DNF (6)');
    expect(rows.find(row => row.teamId === 'red')?.stat).toContain('TOP 2 OF 2');
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});

test('faction rounds report team standings and stable roster-ordinal take progress', () => {
  const round = run(42, 24, true);
  expect(round.result?.winner.kind).toBe('team');
  expect(round.result?.standings).toHaveLength(4);
  expect(round.progress).toHaveLength(24);
  expect(round.progress.every(progress => progress >= -1 && progress <= 6)).toBe(true);
});
