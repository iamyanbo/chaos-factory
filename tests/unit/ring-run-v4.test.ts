import { expect, test, vi } from 'vitest';
import definition, { RingRun } from '../../apps/show/src/games/ring-escape';
import { CENTER, MAX_SPEED, RADII, STROKE, BOUNCE_GAIN, LARGE_BALL_RADIUS, SMALL_BALL_RADIUS } from '../../apps/show/src/games/ring-escape/config';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics, PX } from '../../apps/show/src/engine/physics';
import { makeSetup, simulate } from '../../tools/simulation';
import { simulateTake } from '../../apps/show/src/kit/take-simulation';
import { assertReplayResult } from '../../tools/replay-compare';

async function scene(count: number, work: (game: RingRun) => void, seed = 8) {
  await initPhysics();
  const context = createContext(definition, makeSetup({ game: definition.id, seed, participants: count }));
  const game = new RingRun(context);
  try {
    work(game);
  } finally {
    game.destroy();
    expect(context.physics.entities.size).toBe(0);
    context.physics.destroy();
  }
}

test('the new individual game has one persistent body per entrant, correct radii and no gravity', async () => {
  for (const count of [1, 24, 30, 31, 64]) await scene(count, game => {
    expect(game.marbles).toHaveLength(count);
    expect(game.ctx.physics.entities.size).toBe(count + 5);
    expect(game.ctx.physics.world.gravity).toEqual({ x: 0, y: 0 });
    expect(game.marbles.every(m => m.radius === (count <= 30 ? LARGE_BALL_RADIUS : SMALL_BALL_RADIUS))).toBe(true);
    expect(game.marbles.every(m => !m.isStreamer)).toBe(true);
    for (const ball of game.marbles) {
      expect(Math.hypot(ball.x - CENTER.x, ball.y - CENTER.y) + ball.radius)
        .toBeLessThan(RADII[0] - STROKE / 2);
    }
    for (const [i, a] of game.marbles.entries()) for (const b of game.marbles.slice(i + 1)) {
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius);
    }
    expect(game.onJoin()).toBe(false);
    expect(definition.supportsModifiers).toEqual([]);
    expect(definition.chatVerbs).toEqual([]);
    expect(definition.streamerControls).toEqual([]);
  });
});

test('free flight has no unseen acceleration or steering', async () => scene(1, game => {
  const ball = game.marbles[0];
  const velocity = { ...ball.body.linvel() };
  game.start();
  for (let step = 0; step < 10; step++) game.step(1 / 60);
  expect(ball.body.linvel()).toEqual(velocity);
  expect(game.rings.every(r => r.body.isValid())).toBe(true);
}));

test('a solid ring reflects a ball and only its solved bounce adds the specified speed gain', async () => scene(1, game => {
  const ball = game.marbles[0];
  for (const ring of game.rings) {
    ring.speed = 0;
    ring.angle = ring.previous = Math.PI;
    ring.body.setRotation(Math.PI, true);
  }
  game.ctx.physics.move(ball.body, CENTER.x + RADII[0] - STROKE / 2 - ball.radius - 3, CENTER.y);
  ball.body.setLinvel({ x: 2, y: 0 }, true);
  const velocityRatios: number[] = [];
  const original = ball.body.setLinvel.bind(ball.body);
  vi.spyOn(ball.body, 'setLinvel').mockImplementation((value, wake) => {
    const before = ball.body.linvel();
    velocityRatios.push(Math.hypot(value.x, value.y) / Math.hypot(before.x, before.y));
    original(value, wake);
  });
  game.start();
  for (let step = 0; step < 10 && ball.body.linvel().x > 0; step++) game.step(1 / 60);
  const velocity = ball.body.linvel();
  expect(velocity.x).toBeLessThan(0);
  expect(velocityRatios).toHaveLength(1);
  expect(velocityRatios[0]).toBeCloseTo(BOUNCE_GAIN, 6);
  expect(ball.depth).toBe(0);
}));

test('actual gaps admit individual bodies while every ring remains solid and present', async () => scene(1, game => {
  const ball = game.marbles[0];
  for (const ring of game.rings) {
    ring.speed = 0;
    ring.angle = ring.previous = 0;
    ring.body.setRotation(0, true);
  }
  game.ctx.physics.move(ball.body, CENTER.x, CENTER.y);
  ball.body.setLinvel({ x: 3, y: 0 }, true);
  game.start();
  for (let step = 0; step < 240 && game.status() === 'playing'; step++) game.step(1 / 60);
  expect(ball.depth).toBe(5);
  expect(Math.hypot(ball.x - CENTER.x, ball.y - CENTER.y)).toBeGreaterThan(RADII[4] + ball.radius + STROKE / 2);
  expect(game.rings.every(r => r.body.isValid() && !r.body.collider(0).isSensor())).toBe(true);
  const status = game.status();
  expect(typeof status === 'object' && 'done' in status && status.done.champion?.userId).toBe(ball.id);
}));

test('the speed cap holds through rotating walls and ball collisions without replacing entrants', async () => {
  for (const seed of [1, 8, 1671279560]) await scene(24, game => {
    const handles = game.marbles.map(m => m.body.handle);
    let maximum = 0;
    game.start();
    for (let step = 0; step < 7200 && game.status() === 'playing'; step++) {
      game.step(1 / 60);
      for (const ball of game.marbles) {
        const velocity = ball.body.linvel();
        maximum = Math.max(maximum, Math.hypot(velocity.x, velocity.y) * PX);
      }
    }
    expect(maximum).toBeLessThanOrEqual(MAX_SPEED + 0.001);
    expect(game.marbles.map(m => m.body.handle)).toEqual(handles);
    expect(game.status()).not.toBe('playing');
  }, seed);
});

test('worker-safe simulation and the live plugin resolve at the same physical tick', async () => {
  const setup = makeSetup({ game: definition.id, seed: 8, participants: 24 });
  const take = await simulateTake(definition, setup);
  const replay = await simulate({ game: definition.id, seed: setup.seed, setup, replay: [] });
  expect(take.events.finished).toBe(true);
  expect(take.events.duration).toBe(replay.duration);
  const renamed = structuredClone(setup);
  renamed.participants.forEach((p, index) => {
    p.userId = `other-${index}`;
    p.displayName = `OTHER ${index}`;
    p.color = '#ffffff';
  });
  const other = await simulateTake(definition, renamed);
  expect(other).toEqual(take);
  const repeated = await simulate({ game: definition.id, seed: setup.seed, setup, replay: [] });
  assertReplayResult(repeated.result, replay.result);
  expect(repeated.positions).toEqual(replay.positions);
});
