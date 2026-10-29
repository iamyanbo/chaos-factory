import { expect, test, vi } from 'vitest';
import { TEAMS, type GameEvent, type RoundSetup } from '@chaos/shared';
import definition, { RingRun } from './index';
import { CENTER, GAP, MAX_SPEED, PASS_GROWTH, RADII, RED_ARC_DIAMETERS, STROKE, LARGE_BALL_RADIUS, MAX_ROTATION } from './config';
import { hazardWarning, hazardState } from './rings';
import { deepestFirst } from './runners';
import { createContext } from '../../engine/context';
import { initPhysics, PX } from '../../engine/physics';
import { NeonSound } from '../../kit/neon';
import { simulateTake } from '../../kit/take-simulation';
import { escapedChampion } from './outcome';

function setup(count: number, faction = false): RoundSetup {
  return {
    gameId: definition.id, mode: faction ? 'faction' : 'cvs',
    format: faction ? 'faction' : 'ffa', seed: 8, difficulty: 0.5,
    modifiers: [], teams: ['red', 'blue'], streamerName: 'HOST',
    participants: Array.from({ length: count }, (_, ordinal) => ({
      userId: `runner-${ordinal}`, login: `runner-${ordinal}`,
      displayName: `RUNNER ${ordinal}`, color: '#ffffff',
      teamId: faction ? ordinal % 2 ? 'blue' as const : 'red' as const : undefined
    }))
  };
}

async function scene(count: number, work: (game: RingRun, events: GameEvent[]) => void,
  faction = false): Promise<void> {
  await initPhysics();
  const events: GameEvent[] = [];
  const ctx = createContext(definition, setup(count, faction), { emit: e => events.push(e) });
  const game = new RingRun(ctx);
  try {
    work(game, events);
  } finally {
    game.destroy();
    expect(ctx.physics.entities.size).toBe(0);
    ctx.physics.destroy();
  }
}

function freezeRings(game: RingRun, angle = 0): void {
  for (const ring of game.rings) {
    ring.speed = 0;
    ring.angle = ring.previous = angle;
    ring.body.setRotation(angle, true);
  }
}

function advance(game: RingRun, ticks: number): void {
  for (let tick = 0; tick < ticks && game.status() === 'playing'; tick++) game.step(1 / 60);
}

test('Ring Run+ offers locked FFA/faction with two late red arcs per outer ring and generous physical lanes', async () => {
  expect(definition.formats).toEqual(['ffa', 'faction']);
  expect(definition.camera).toBe('fixed');
  expect(definition.joinOnly).toBe(true);
  await scene(24, game => {
    expect(game.rings.slice(0, 3).every(r => r.hazards.length === 0)).toBe(true);
    expect(game.rings).toHaveLength(5);
    const largestActiveDiameter = LARGE_BALL_RADIUS * 2 * PASS_GROWTH ** 4;
    for (let i = 1; i < RADII.length; i++) {
      expect(RADII[i] - RADII[i - 1] - STROKE).toBeGreaterThanOrEqual(4.5 * largestActiveDiameter);
    }
    for (const ring of game.rings.slice(3)) {
      expect(ring.hazards).toHaveLength(2);
      for (const hazard of ring.hazards) {
        expect((hazard.end - hazard.start) * ring.radius + STROKE)
          .toBeCloseTo(LARGE_BALL_RADIUS * 2 * RED_ARC_DIAMETERS);
        expect(hazard.start).toBeGreaterThan(GAP / 2);
        expect(hazard.end).toBeLessThan(Math.PI * 2 - GAP / 2);
      }
      expect(ring.body.numColliders()).toBe(5);
      for (let i = 0; i < 5; i++) expect(ring.body.collider(i).isSensor()).toBe(false);
    }
  });
});

test('each actual pass grows both the rendered ball and its Rapier shape by six percent', async () => {
  await scene(1, (game, events) => {
    freezeRings(game);
    const ball = game.marbles[0];
    game.ctx.physics.move(ball.body, CENTER.x, CENTER.y);
    ball.body.setLinvel({ x: 3, y: 0 }, true);
    game.start();
    for (let tick = 0; tick < 300 && game.status() === 'playing'; tick++) {
      game.step(1 / 60);
      expect(ball.radius).toBeCloseTo(LARGE_BALL_RADIUS * PASS_GROWTH ** ball.depth);
      expect(ball.body.collider(0).radius() * PX).toBeCloseTo(ball.radius);
    }
    expect(ball.depth).toBe(5);
    expect(ball.finished).toBe(true);
    expect(Math.hypot(ball.x - CENTER.x, ball.y - CENTER.y))
      .toBeGreaterThan(RADII[4] + STROKE / 2 + ball.radius);
    expect(events.filter(e => e.t === 'pass')).toHaveLength(5);
    expect(game.finale).toBe(true);
    expect(game.rings.every(r => r.body.isValid())).toBe(true);
  });
});

test('only real red contact pops a ball, disables its collider and emits one hit activity', async () => {
  await scene(1, (game, events) => {
    freezeRings(game);
    const ball = game.marbles[0];
    const ring = game.rings[3];
    ball.depth = 3;
    game.time = 30;
    game.ctx.physics.move(ball.body,
      CENTER.x - ring.radius + ball.radius + STROKE / 2 + 3, CENTER.y);
    ball.body.setLinvel({ x: -2, y: 0 }, true);
    game.start();
    advance(game, 15);
    expect(ball.alive).toBe(false);
    expect(ball.body.isEnabled()).toBe(false);
    expect(game.takeState()).toEqual([-1]);
    expect(events.filter(e => e.t === 'activity')).toEqual([
      { t: 'activity', time: game.time, kind: 'hit' }
    ]);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.winner.kind).toBe('void');
  });
});

test('red arcs telegraph at 25 seconds, kill at 30, and add the second arc at 60', async () => {
  await scene(24, game => {
    for (const ring of game.rings.slice(3)) {
      const [first, second] = ring.hazards;
      expect(hazardState(first, 24.99)).toBe('hidden');
      expect(hazardState(first, 25)).toBe('warning');
      expect(hazardState(first, 29.99)).toBe('warning');
      expect(hazardState(first, 30)).toBe('deadly');
      expect(hazardState(second, 54.99)).toBe('hidden');
      expect(hazardState(second, 55)).toBe('warning');
      expect(hazardState(second, 59.99)).toBe('warning');
      expect(hazardState(second, 60)).toBe('deadly');
    }
  });
  for (const time of [0, 25, 29]) await scene(1, game => {
    freezeRings(game);
    const ball = game.marbles[0];
    const ring = game.rings[3];
    ball.depth = 3;
    game.time = time;
    game.ctx.physics.move(ball.body,
      CENTER.x - ring.radius + ball.radius + STROKE / 2 + 3, CENTER.y);
    ball.body.setLinvel({ x: -2, y: 0 }, true);
    game.start();
    advance(game, 15);
    expect(ball.alive).toBe(true);
    expect(ball.body.linvel().x).toBeGreaterThan(0);
  });
});

test('ordinary white ring contact bounces without elimination and free flight adds no activity', async () => {
  await scene(1, (game, events) => {
    freezeRings(game, Math.PI);
    const ball = game.marbles[0];
    game.ctx.physics.move(ball.body, CENTER.x + RADII[0] - ball.radius - STROKE / 2 - 3, CENTER.y);
    ball.body.setLinvel({ x: 2, y: 0 }, true);
    game.start();
    advance(game, 10);
    expect(ball.alive).toBe(true);
    expect(ball.body.linvel().x).toBeLessThan(0);
    expect(events).toEqual([]);
    expect(Math.hypot(ball.body.linvel().x, ball.body.linvel().y) * PX).toBeLessThan(MAX_SPEED);
  });
});

test('rings accelerate fifteen percent each fifteen seconds up to the calm rotation cap', async () => {
  await scene(1, game => {
    const speeds = game.rings.map(r => r.speed);
    const colliders = game.rings.map(r => r.body.numColliders());
    game.start();
    game.time = 14.99;
    game.step(1 / 60);
    game.rings.forEach((r, index) => expect(r.speed).toBeCloseTo(
      Math.sign(speeds[index]) * Math.min(MAX_ROTATION, Math.abs(speeds[index]) * 1.15)));
    expect(game.speedFlashUntil).toBeGreaterThan(game.time);
    game.time = 29.99;
    game.step(1 / 60);
    game.rings.forEach((r, index) => expect(r.speed).toBeCloseTo(
      Math.sign(speeds[index]) * Math.min(MAX_ROTATION, Math.abs(speeds[index]) * 1.15 ** 2)));
    expect(game.rings.map(r => r.body.numColliders())).toEqual(colliders);
  });
});

test('red pulse warns in the second before bottom in either rotation direction', async () => {
  await scene(1, game => {
    const ring = game.rings[3];
    for (const speed of [0.8, -0.8]) {
      ring.speed = speed;
      ring.angle = Math.PI / 2 - Math.PI - speed * 0.5;
      expect(hazardWarning(ring, ring.hazards[0])).toBe(true);
      ring.angle = Math.PI / 2 - Math.PI - speed * 1.1;
      expect(hazardWarning(ring, ring.hazards[0])).toBe(false);
      ring.angle = Math.PI / 2 - Math.PI + speed * 0.05;
      expect(hazardWarning(ring, ring.hazards[0])).toBe(false);
    }
  });
});

test('first entry into ring five raises the melody octave once', async () => {
  const octave = vi.spyOn(NeonSound.prototype, 'setOctave');
  try {
    await scene(1, game => {
      freezeRings(game);
      const ball = game.marbles[0];
      ball.body.setLinvel({ x: 3, y: 0 }, true);
      game.ctx.physics.move(ball.body, CENTER.x, CENTER.y);
      game.start();
      advance(game, 300);
      expect(octave).toHaveBeenCalledExactlyOnceWith(1);
    });
  } finally {
    octave.mockRestore();
  }
});

test('the first real escape credits its faction at every roster size', async () => {
  for (const count of [2, 6]) await scene(count, game => {
    freezeRings(game);
    expect(game.target).toBe(1);
    for (const ball of game.marbles) ball.body.setLinvel({ x: 0, y: 0 }, true);
    const reds = game.marbles.filter(r => r.team === 'red');
    for (const [index, ball] of reds.entries()) {
      expect(ball.color).toBe(TEAMS.red.hex);
      ball.depth = 4;
      ball.radius = LARGE_BALL_RADIUS * PASS_GROWTH ** 4;
      game.ctx.physics.radius(ball.body, ball.radius);
      const y = (index - (reds.length - 1) / 2) * 50;
      const radial = RADII[4] + STROKE / 2 + ball.radius - 1;
      game.ctx.physics.move(ball.body, CENTER.x + Math.sqrt(radial ** 2 - y ** 2), CENTER.y + y);
      ball.body.setLinvel({ x: 3, y: 0 }, true);
    }
    game.start();
    advance(game, 3);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.winner).toEqual({ kind: 'team', teamId: 'red' });
    expect(reds.some(r => r.finished)).toBe(true);
  }, true);
});

test('an actual simultaneous all-pop is a void, never a depth-awarded winner', async () => {
  await scene(3, game => {
    const [a, b, c] = game.marbles;
    Object.assign(a, { depth: 4, arrivedAt: 9 });
    Object.assign(b, { depth: 4, arrivedAt: 8 });
    Object.assign(c, { depth: 3, arrivedAt: 1 });
    expect([...game.marbles].sort(deepestFirst)).toEqual([b, a, c]);
    for (const ball of game.marbles) {
      ball.alive = false;
      ball.body.setEnabled(false);
    }
    game.start();
    game.step(1 / 60);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.winner.kind).toBe('void');
  });
});

test('90s supplies no verdict and 150s visibly opens real gaps instead of choosing depth', async () => {
  await scene(3, game => {
    freezeRings(game);
    const [a, b, c] = game.marbles;
    Object.assign(a, { depth: 4, arrivedAt: 1, alive: false });
    a.body.setEnabled(false);
    Object.assign(b, { depth: 3, arrivedAt: 9 });
    Object.assign(c, { depth: 3, arrivedAt: 8 });
    game.time = 90 - 1 / 60;
    game.start();
    game.step(1 / 60);
    expect(game.status()).toBe('playing');
    const gaps = game.rings.map(ring => ring.gap);
    game.time = 150 - 1 / 60;
    game.step(1 / 60);
    expect(game.status()).toBe('playing');
    advance(game, 60);
    expect(game.rings.every((ring,index) => ring.gap > gaps[index])).toBe(true);
    expect(game.inspect().details.suddenDeath).toBe(true);
  });
});

test('faction victory follows the earliest physical escape rather than total escape count', async () => {
  await scene(6, game => {
    const red = game.marbles.filter(r => r.team === 'red');
    const blue = game.marbles.filter(r => r.team === 'blue');
    Object.assign(red[0], { finished: true, depth: 5, arrivedAt: 10 });
    Object.assign(red[1], { finished: true, depth: 5, arrivedAt: 12 });
    Object.assign(blue[0], { finished: true, depth: 5, arrivedAt: 8 });
    expect(escapedChampion(game.marbles)).toBe(blue[0]);
  }, true);
});

test('headless takes are deterministic and their scores ignore names and colors', async () => {
  const original = setup(24);
  const renamed = structuredClone(original);
  for (const [index, owner] of renamed.participants.entries()) {
    owner.userId = `different-${index}`;
    owner.displayName = `OTHER ${index}`;
    owner.color = '#123456';
  }
  const first = await simulateTake(definition, original);
  expect(await simulateTake(definition, original)).toEqual(first);
  expect(await simulateTake(definition, renamed)).toEqual(first);
  expect(first.events.finished).toBe(true);
});
