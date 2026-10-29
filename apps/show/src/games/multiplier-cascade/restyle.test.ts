import { beforeAll, expect, test } from 'vitest';
import type { RoundSetup } from '@chaos/shared';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import definition, { MultiplierCascade } from './index';
import { CAMERA_ZOOM, LINE_WIDTH, COURSE, GATE_Y, BALL_RADIUS } from './course-layout';

beforeAll(async () => initPhysics());

function setup(): RoundSetup {
  return { gameId: 'multiplier-cascade', seed: 1, mode: 'faction', format: 'faction',
    difficulty: 0.5, modifiers: [], participants: [], teams: ['red', 'blue', 'mint', 'gold'],
    streamerName: 'Host' };
}

test('Cascade has eight full-size chambers and the requested scrolling camera', () => {
  expect(definition.id).toBe('multiplier-cascade');
  expect(definition.formats).toEqual(['faction']);
  expect(definition.spectator).toBe(true);
  expect(definition.presentation).toBe('minimal');
  expect(definition.camera).toBe('scroll');
  expect(definition.cameraZoom).toBe(CAMERA_ZOOM);
  expect(LINE_WIDTH * CAMERA_ZOOM).toBe(8);
  expect(CAMERA_ZOOM).toBe(1);
  expect(BALL_RADIUS).toBe(16);
  expect(COURSE.left).toBeGreaterThanOrEqual(420);
  expect(COURSE.right).toBeLessThanOrEqual(1500);
  expect(COURSE.top).toBeGreaterThanOrEqual(0);
  expect(COURSE.bottom).toBeGreaterThan(1080 * 3);
  expect(GATE_Y).toHaveLength(8);
});

test('real gates and child births emit activity while the camera keeps its declared scale', () => {
  const activity: string[] = [];
  const ctx = headlessContext(definition, setup(), event => {
    if (event.t === 'activity') activity.push(event.kind);
  });
  // A previous Race round can leave a displaced viewport until the next render.
  ctx.camera.setViewport({ left: 420, right: 1500, top: 0, bottom: 1080, minZoom: 1 });
  const game = new MultiplierCascade(ctx);
  try {
    expect(ctx.camera.zoom).toBe(CAMERA_ZOOM);
    expect(ctx.camera.targetZoom).toBe(CAMERA_ZOOM);
    expect(ctx.camera.target).toEqual({ x: 960, y: 540 });
    ctx.camera.setViewport({ left: 420, right: 1500, top: 0, bottom: 1080, minZoom: CAMERA_ZOOM });
    game.start();
    for (let tick = 0; tick < 18 * 60; tick++) {
      game.step(1 / 60);
      expect(ctx.camera.targetZoom).toBe(CAMERA_ZOOM);
      expect(ctx.camera.target.x).toBe(960);
      expect(ctx.camera.target.y).toBeGreaterThanOrEqual(540);
    }
    expect(activity).toContain('checkpoint');
    expect(ctx.camera.target.y).toBeGreaterThan(540);
    expect(activity).toContain('birth');
    expect(game.takeState()).toHaveLength(4);
    game.scores.set(game.teams[0], 100);
    game.scores.set(game.teams[1], 50);
    expect(game.takeState().slice(0, 2)).toEqual([6, 3]);
    expect(game.inspect().marbles.every(marble => Number.isFinite(marble.x + marble.y))).toBe(true);
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});

test('a saturated splitter visibly bypasses without creating deferred children', () => {
  const ctx = headlessContext({ ...definition, maxBodies: 70 }, setup(), () => {});
  const game = new MultiplierCascade(ctx);
  game.start();
  try {
    expect(ctx.physics.entities.size).toBe(70);
    const parents = [...game.units.values()].slice(0, 2);
    for (const [index, unit] of parents.entries()) {
      const x = 960 + index * 100;
      const y = GATE_Y[2] + 1;
      unit.stage = 2;
      unit.marble.x = unit.marble.prevX = x;
      unit.marble.y = unit.marble.prevY = y;
      ctx.physics.move(unit.marble.body, x, y);
      unit.marble.body.setLinvel({ x: 0, y: 0 }, true);
      game.step(1 / 60);
    }
    expect(ctx.physics.entities.size).toBe(70);
    expect(game.splits.filter(split => split.stage === 2).map(split => split.factor)).toEqual([1, 1]);
    expect(game.board.factor(2)).toBe(1);
    expect(parents.every(parent => parent.stage === 3 && parent.lineage === 1)).toBe(true);
    expect('births' in game).toBe(false);
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});
