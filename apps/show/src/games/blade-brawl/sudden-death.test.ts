import { expect, test } from 'vitest';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import { makeSetup } from '../../../../../tools/simulation';
import definition, { BladeBrawl } from './index';
import { arenaRadiusAt } from './arena';
import {
  BOSS_RADIUS,
  FIGHTER_RADIUS,
  HARD_CAP,
  SUDDEN_DEATH_RADIUS,
} from './config';

async function scene(work: (game: BladeBrawl) => void): Promise<void> {
  await initPhysics();
  const setup = makeSetup({
    game: definition.id,
    seed: 12,
    participants: 2,
    format: 'ffa',
  });
  const context = headlessContext(definition, setup, () => {});
  const game = new BladeBrawl(context);
  try {
    work(game);
  } finally {
    game.destroy();
    expect(context.physics.entities.size).toBe(0);
    context.physics.destroy();
  }
}

function advance(game: BladeBrawl, seconds: number): void {
  for (let tick = 0; tick < seconds * 60; tick++) game.step(1 / 60);
}

test('sudden death closes the visible collider while leaving space for the Boss', () => {
  expect(arenaRadiusAt(0)).toBe(500);
  expect(arenaRadiusAt(75)).toBe(300);
  expect(arenaRadiusAt(149)).toBe(300);
  expect(arenaRadiusAt(150, 150)).toBe(300);
  expect(arenaRadiusAt(156, 150)).toBe(210);
  expect(arenaRadiusAt(162, 150)).toBe(SUDDEN_DEATH_RADIUS);
  expect(arenaRadiusAt(250, 150)).toBe(SUDDEN_DEATH_RADIUS);
  expect(SUDDEN_DEATH_RADIUS).toBeGreaterThan(BOSS_RADIUS + FIGHTER_RADIUS + 4);
  expect(definition.ending).toBe('natural');
  expect(definition.durationSec.hardCap).toBe(150);
});

test('150 s starts shrinking and repeated sudden-death calls do not restart it', async () =>
  scene(game => {
    for (const fighter of game.marbles) fighter.weapons = [];
    game.time = HARD_CAP - 1;
    game.start();
    advance(game, 8);
    expect(game.radius).toBeLessThan(220);
    expect(game.radius).toBeGreaterThan(180);
    game.suddenDeath();
    advance(game, 8);
    expect(game.radius).toBe(SUDDEN_DEATH_RADIUS);
    expect(game.status()).toBe('playing');
    for (const fighter of game.marbles) {
      const position = game.ctx.physics.position(fighter.body);
      expect(Math.hypot(position.x - 960, position.y - 540) + fighter.radius)
        .toBeLessThanOrEqual(SUDDEN_DEATH_RADIUS);
    }
  }));

test('passing the old 180 s cap cannot cause a verdict or passive HP loss', async () =>
  scene(game => {
    for (const fighter of game.marbles) fighter.weapons = [];
    const health = game.marbles.map(fighter => fighter.hp);
    game.time = HARD_CAP - 1;
    game.start();
    advance(game, 33);
    expect(game.time).toBeGreaterThan(180);
    expect(game.status()).toBe('playing');
    expect(game.marbles.every(fighter => fighter.alive)).toBe(true);
    expect(game.marbles.map(fighter => fighter.hp)).toEqual(health);
  }));

test('existing visible weapon hits still decide the natural survivor after sudden death', async () =>
  scene(game => {
    game.time = HARD_CAP;
    game.start();
    advance(game, 90);
    const status = game.status();
    expect(status).not.toBe('playing');
    if (typeof status === 'object' && 'done' in status) {
      expect(status.done.winner.kind).toBe('chat');
      expect(status.done.champion?.userId).toBeTruthy();
      expect(game.marbles.filter(fighter => fighter.alive)).toHaveLength(1);
      expect(game.marbles.some(fighter => fighter.hp <= 0)).toBe(true);
    }
  }));
