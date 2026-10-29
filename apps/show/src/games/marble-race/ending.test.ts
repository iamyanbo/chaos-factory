import { beforeAll, expect, test } from 'vitest';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics, PX } from '../../engine/physics';
import definition, { MarbleRace } from './index';
import { AUDIT_SECONDS, COURSE_OPEN_SECONDS, FINISH_GRACE_SECONDS, FINISH_Y, HARD_CAP } from './config';
import type { NeonSideUpdate } from '../../kit/neon';

const DT = 1 / 60;

beforeAll(async () => initPhysics());

function create(count = 4) {
  const setup: RoundSetup = {
    gameId: definition.id, seed: 26, mode: 'cvs', format: 'ffa',
    difficulty: 1, modifiers: [], streamerName: 'Host',
    participants: Array.from({ length: count }, (_, index) => ({
      userId: `p${index}`, login: `p${index}`, displayName: `Runner ${index + 1}`, color: '#ffffff'
    }))
  };
  const ctx = headlessContext(definition, setup, () => {});
  const sides: NeonSideUpdate[] = [];
  ctx.hud.setSide = side => sides.push(side);
  const game = new MarbleRace(ctx);
  return { ctx, game, sides, destroy() { game.destroy(); ctx.physics.destroy(); } };
}

test('actual crossings earn the podium, then every entrant gets ten seconds to finish', () => {
  const fixture = create();
  const { game, sides } = fixture;
  try {
    // Set up the final straight physically. A fourth entrant remains at the start.
    for (let index = 0; index < 3; index++) {
      const racer = game.marbles[index];
      racer.body.setTranslation({ x: (700 + index * 220) / PX, y: (FINISH_Y - 18) / PX }, true);
      racer.body.setLinvel({ x: 0, y: [6, 2, 1][index] }, true);
    }
    game.start();
    while (!game.marbles[0].finished) game.step(DT);
    expect(game.status()).toBe('playing');
    const firstFinish = game.marbles[0].finishTime!;
    while (game.time + DT < firstFinish + FINISH_GRACE_SECONDS) {
      game.step(DT);
      expect(game.status()).toBe('playing');
    }
    game.step(DT);
    expect(game.time - firstFinish).toBeGreaterThanOrEqual(FINISH_GRACE_SECONDS - 1e-6);
    expect(game.time - firstFinish).toBeLessThan(FINISH_GRACE_SECONDS + DT);
    const status = game.status();
    if (status === 'playing' || !('done' in status)) throw new Error('Expected a naturally completed race');
    expect(status.done.champion?.userId).toBe('p0');
    expect(game.inspect().details.podium.map(row => row.id)).toEqual(['p0', 'p1', 'p2']);
    expect(game.inspect().details).toMatchObject({ finished: 3, total: 4 });
    expect(status.done.perUser.p3.tags).toEqual(['dnf']);
    expect(sides.at(-1)?.countLabel).toBe('finished 3/4');
    expect(sides.at(-1)?.rows?.map(row => row.names[0])).toEqual(['Runner 1', 'Runner 2', 'Runner 3']);
  } finally { fixture.destroy(); }
});

test('even a solo finisher gets the full grace period', () => {
  const fixture = create(1);
  const { game } = fixture;
  try {
    game.marbles[0].body.setTranslation({ x: 960 / PX, y: (FINISH_Y - 1) / PX }, true);
    game.marbles[0].body.setLinvel({ x: 0, y: 5 }, true);
    game.start();
    game.step(DT);
    expect(game.marbles[0].finished).toBe(true);
    expect(game.status()).toBe('playing');
    for (let tick = 0; tick < FINISH_GRACE_SECONDS * 60 - 1; tick++) game.step(DT);
    expect(game.status()).toBe('playing');
    game.step(DT);
    expect(game.status()).not.toBe('playing');
  } finally { fixture.destroy(); }
});

test('150 seconds starts visible collider retraction, never a clock verdict', () => {
  const fixture = create(1);
  const { game, ctx } = fixture;
  try {
    game.time = HARD_CAP - DT;
    game.start();
    const rail = game.course.rails.find(rail => rail.ax !== rail.bx && rail.ay !== rail.by)!;
    const originalLength = Math.hypot(rail.bx - rail.ax, rail.by - rail.ay);
    const bodies = ctx.physics.entities.size;
    game.step(DT);
    expect(game.status()).toBe('playing');
    expect(game.marbles.every(racer => !racer.finished)).toBe(true);
    expect(game.inspect().details.suddenDeath).toBe(true);
    game.suddenDeath();
    expect(game.events.filter(event => event.t === 'moment')).toHaveLength(1);
    for (let tick = 0; tick < COURSE_OPEN_SECONDS * 60 / 2; tick++) game.step(DT);
    expect(Math.hypot(rail.bx - rail.ax, rail.by - rail.ay)).toBeCloseTo(originalLength / 2, 4);
    expect(game.course.pegs[0].radius).toBeCloseTo(5, 4);
    for (const machine of game.course.machines) {
      expect(machine.body.collider(0).halfExtents()!.x * PX * 2).toBeCloseTo(machine.width, 5);
    }
    for (let tick = 0; tick < COURSE_OPEN_SECONDS * 60 / 2 + 1; tick++) game.step(DT);
    expect(game.course.pegs.every(peg => peg.radius === 0)).toBe(true);
    expect(game.course.machines.every(machine => !machine.body.isValid())).toBe(true);
    expect(ctx.physics.entities.size).toBeLessThanOrEqual(bodies);
    while (game.status() === 'playing' && game.time < AUDIT_SECONDS) game.step(DT);
    expect(game.marbles[0].finished).toBe(true);
    expect(game.status()).not.toBe('playing');
  } finally { fixture.destroy(); }
});
