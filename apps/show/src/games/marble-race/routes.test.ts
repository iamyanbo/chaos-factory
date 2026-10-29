import { beforeAll, expect, test } from 'vitest';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import definition, { MarbleRace } from './index';
import { HARD_CAP, MODULE_STOREYS, MODULE_STORY_HEIGHT } from './config';

beforeAll(async () => initPhysics());

test('real fields use both branches and every internal ramp is reachable before sudden death', () => {
  const paths = new Map<string, Set<string>>();
  const surfaces = new Map<string, boolean>();
  for (let seed = 1; seed <= 8; seed++) {
    const setup: RoundSetup = { gameId: definition.id, seed, mode: 'cvs', format: 'ffa',
      difficulty: .5, modifiers: [], streamerName: 'Host',
      participants: Array.from({ length: 48 }, (_, index) => ({ userId: `p${index}`,
        login: `p${index}`, displayName: `Runner ${index}`, color: '#ffffff' })) };
    const ctx = headlessContext(definition, setup, () => {});
    const game = new MarbleRace(ctx);
    const touched = new Set<string>();
    const collision = ctx.physics.onCollision;
    ctx.physics.onCollision = (a, b, started) => {
      if (started) {
        if (a.startsWith('race-rail:')) touched.add(a);
        if (b.startsWith('race-rail:')) touched.add(b);
      }
      collision(a, b, started);
    };
    const stories = game.course.modules.flatMap(module =>
      Array.from({ length: MODULE_STOREYS }, (_, storey) => ({
        ...module, storey, y: module.y + storey * MODULE_STORY_HEIGHT,
        mirrored: storey % 2 === 0 ? module.mirrored : !module.mirrored,
      })));
    game.start();
    try {
      while (game.status() === 'playing' && game.time < HARD_CAP) {
        game.step(1 / 60);
        for (const story of stories) for (const marble of game.marbles) {
          if (marble.prevY < story.y + 300 && marble.y >= story.y + 300) {
            const key = `${story.kind}/${story.storey}`;
            const sides = paths.get(key) ?? new Set<string>();
            sides.add(marble.x < 960 ? 'left' : 'right');
            paths.set(key, sides);
          }
        }
      }
      expect(game.course.opening, `seed ${seed} should finish without emergency clearing`).toBe(false);
      expect(game.status()).not.toBe('playing');
      expect(ctx.physics.entities.size).toBeLessThanOrEqual(definition.maxBodies);
      for (const rail of game.course.rails) {
        const story = stories.find(part => Math.min(rail.ay, rail.by) >= part.y
          && Math.max(rail.ay, rail.by) <= part.y + MODULE_STORY_HEIGHT);
        if (!story) continue;
        const x = (value: number) => story.mirrored ? 1920 - value : value;
        const key = `${story.kind}/${x(rail.ax)},${rail.ay - story.y}->${x(rail.bx)},${rail.by - story.y}`;
        surfaces.set(key, Boolean(surfaces.get(key) || touched.has(rail.id)));
      }
    } finally {
      game.destroy();
      ctx.physics.destroy();
    }
  }
  expect(paths.size).toBe(10);
  for (const [story, sides] of paths) expect([...sides].sort(), story).toEqual(['left', 'right']);
  expect([...surfaces].filter(([, reached]) => !reached).map(([shape]) => shape)).toEqual([]);
}, 60000);
