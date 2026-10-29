import { expect, test } from 'vitest';
import { PX } from '../../engine/physics';
import { ARENA_RADIUS, BLAST_RADIUS, CENTER, RIM_SEGMENTS, STROKE } from './config';
import { segmentDistance } from './arena';
import { bomb, fixture, park, place, ticks } from './fixture';

test('only a real Rapier touch transfers a bomb, and its fuse keeps burning', async () => {
  const { game, events, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x - 30, CENTER.y, 180);
    place(game, 1, CENTER.x + 30, CENTER.y, -180);
    game.bombs.active = [bomb(0)];
    ticks(game, 12);
    expect(game.bombs.active[0].holder).toBe(1);
    expect(game.bombs.active[0].remaining).toBeCloseTo(9.8, 8);
    expect(game.marbles[0].tags).toBe(1);
    expect(events.some(event => event.t === 'hype' && event.kind === 'combo')).toBe(false);
    expect(game.marbles[0].body.linvel().x).toBeLessThan(0);
    expect(game.marbles[1].body.linvel().x).toBeGreaterThan(0);
  } finally { dispose(); }
});

test('proximity without contact never transfers or accelerates a ball', async () => {
  const { game, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x, CENTER.y, 180);
    place(game, 1, CENTER.x, CENTER.y + 100);
    game.bombs.active = [bomb(0)];
    ticks(game, 30);
    expect(game.bombs.active[0].holder).toBe(0);
    expect(game.marbles[0].x).toBeCloseTo(CENTER.x + 90, 2);
    expect(Math.hypot(...Object.values(game.marbles[0].body.linvel())) * PX).toBeCloseTo(180, 4);
  } finally { dispose(); }
});

test('the visible unbroken rim is an elastic physical boundary', async () => {
  const { game, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x + ARENA_RADIUS - 50, CENTER.y, 180);
    game.bombs.active = [bomb(1)];
    ticks(game, 30);
    expect(game.marbles[0].alive).toBe(true);
    expect(game.marbles[0].body.linvel().x).toBeLessThan(0);
    expect(game.arena.segments.every(segment => segment.active)).toBe(true);
  } finally { dispose(); }
});

test('a last half-second physical pass earns near miss and anticipation without a generic banner', async () => {
  const { game, events, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x - 30, CENTER.y, 180);
    place(game, 1, CENTER.x + 30, CENTER.y, -180);
    game.bombs.active = [bomb(0, .4)];
    ticks(game, 12);
    expect(game.bombs.active[0].holder).toBe(1);
    expect(events.filter(event => event.t === 'hype' && event.kind === 'decisive')).toHaveLength(1);
    expect(events.some(event => event.t === 'hype' && event.text === 'CLUTCH!')).toBe(false);
    expect(events.some(event => event.t === 'hype' && event.kind === 'nearMiss')).toBe(true);
  } finally { dispose(); }
});

test('blast impulses wait for the drawn wave front to reach a nearby body', async () => {
  const { game, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x + 220, CENTER.y);
    place(game, 1, CENTER.x + 370, CENTER.y);
    game.bombs.active = [bomb(0, 1 / 60)];
    ticks(game, 7);
    expect(game.marbles[0].alive).toBe(false);
    expect(game.marbles[1].body.linvel().x).toBe(0);
    ticks(game, 6);
    expect(game.marbles[1].body.linvel().x).toBeGreaterThan(0);
    expect(game.marbles[1].blast?.hit.has(1)).toBe(true);
  } finally { dispose(); }
});

test('a reached rim breaks its exact colliders and physical blast ring-outs have no generic kill-streak popup', async () => {
  const { game, events, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x + 370, CENTER.y);
    place(game, 1, CENTER.x + 406, CENTER.y);
    game.bombs.active = [{ ...bomb(0, 1 / 60), passer: 2 }];
    ticks(game, 60);
    const broken = game.arena.segments.filter(segment => !segment.active);
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.every(segment => segmentDistance(CENTER.x + 370, CENTER.y, segment)
      <= BLAST_RADIUS + STROKE / 2)).toBe(true);
    expect(game.arena.body.numColliders()).toBe(RIM_SEGMENTS - broken.length);
    expect(game.marbles[1].alive).toBe(false);
    expect(events.some(event => event.t === 'elim' && event.victim === game.marbles[1].id
      && event.cause === 'ring out' && event.by === game.marbles[2].id)).toBe(true);
    expect(events.some(event => event.t === 'hype' && event.text === 'DOUBLE KILL')).toBe(false);
  } finally { dispose(); }
});
