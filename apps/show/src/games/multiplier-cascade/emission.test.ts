import { beforeAll, expect, test } from 'vitest';
import { initPhysics, PX } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import { makeSetup } from '../../../../../tools/simulation';
import definition, { MultiplierCascade } from './index';
import { BALL_RADIUS, GATE_Y, SHELF_Y } from './course-layout';

beforeAll(async () => initPhysics());

test.each([2, 4, 6])('every %i-team split creates its full offspring in the crossing step', teams => {
  const ctx = headlessContext(definition, makeSetup({ game: definition.id, seed: 2, teams }), () => {});
  const game = new MultiplierCascade(ctx);
  try {
    game.start();
    let multiplications = 0;
    for (let tick = 0; tick < 150 * 60 && game.phase === 'drop'; tick++) {
      const previous = new Set(game.units.keys());
      const before = game.splits.length;
      game.step(1 / 60);
      const splits = game.splits.slice(before);
      const expected = splits.reduce((sum, split) => sum + Math.max(0, split.factor - 1), 0);
      const children = [...game.units.keys()].filter(id => !previous.has(id));
      expect(children.length, `frame ${tick}`).toBe(expected);
      expect(ctx.physics.entities.size).toBeLessThanOrEqual(definition.maxBodies);
      multiplications += splits.filter(split => split.factor > 1).length;
    }
    expect(game.phase).toBe('relay');
    expect(multiplications).toBeGreaterThan(40);
    expect(game.drops[0].expired).toBe(0);
    expect(game.drops[0].born).toBe(game.drops[0].banked + game.drops[0].lost);
    expect(SHELF_Y.every((y, stage) => y + BALL_RADIUS * 2 < GATE_Y[stage])).toBe(true);
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});

test('freeing capacity cannot produce clones owed by a previously saturated gate', () => {
  const ctx = headlessContext({ ...definition, maxBodies: 70 },
    makeSetup({ game: definition.id, seed: 1, teams: 4 }), () => {});
  const game = new MultiplierCascade(ctx);
  try {
    game.start();
    const parent = [...game.units.values()][0];
    parent.stage = 2;
    parent.marble.x = parent.marble.prevX = 790;
    parent.marble.y = parent.marble.prevY = GATE_Y[2] + 1;
    parent.marble.body.setTranslation({ x: 790 / PX, y: parent.marble.y / PX }, true);
    parent.marble.body.setLinvel({ x: 0, y: 0 }, true);
    game.step(1 / 60);
    expect(game.splits[0]).toMatchObject({ requested: 3, factor: 1 });
    expect(game.board.factor(2)).toBe(1);
    for (const unit of [...game.units.values()].filter(unit => unit !== parent).slice(0, 2)) {
      unit.marble.alive = false;
      ctx.physics.remove(unit.marble.body);
      game.units.delete(unit.marble.id);
    }
    for (let tick = 0; tick < 18; tick++) game.step(1 / 60);
    expect(game.board.factor(2)).toBe(3);
    expect([...game.units.values()].filter(unit => unit.root === parent.root)).toEqual([parent]);
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});

test('parents crossing together reserve separate space for their newborn clones', () => {
  const ctx = headlessContext(definition, makeSetup({ game: definition.id, seed: 1, teams: 4 }), () => {});
  const game = new MultiplierCascade(ctx);
  try {
    game.start();
    const parents = [...game.units.values()].slice(0, 2);
    const before = new Set(game.units.keys());
    for (const [index, parent] of parents.entries()) {
      parent.stage = 2;
      parent.marble.x = parent.marble.prevX = 790 + index * BALL_RADIUS * 2;
      parent.marble.y = parent.marble.prevY = GATE_Y[2] + 1;
      parent.marble.body.setTranslation({ x: parent.marble.x / PX, y: parent.marble.y / PX }, true);
      parent.marble.body.setLinvel({ x: 0, y: 0 }, true);
    }
    game.step(1 / 60);
    const children = [...game.units.values()].filter(unit => !before.has(unit.marble.id));
    expect(children).toHaveLength(4);
    for (const [index, child] of children.entries()) {
      for (const other of children.slice(index + 1)) {
        expect(Math.hypot(child.marble.prevX - other.marble.prevX,
          child.marble.prevY - other.marble.prevY)).toBeGreaterThanOrEqual(BALL_RADIUS * 2 + 1);
      }
    }
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});
