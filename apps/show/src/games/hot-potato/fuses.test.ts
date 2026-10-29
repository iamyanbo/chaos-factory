import { expect, test } from 'vitest';
import { CENTER, MEGA_RADIUS, SHORT_FUSE_FACTOR } from './config';
import { bomb, fixture, park, place, ticks } from './fixture';

test('two armed balls can physically collide without duplicating or losing their bombs', async () => {
  const { game, dispose } = await fixture(7);
  try {
    park(game);
    place(game, 0, CENTER.x - 30, CENTER.y, 180);
    place(game, 1, CENTER.x + 30, CENTER.y, -180);
    game.bombs.active = [bomb(0, 4, 10), bomb(1, 6, 11)];
    ticks(game, 12);
    expect(game.bombs.active.map(active => active.holder)).toEqual([0, 1]);
    expect(game.bombs.active[0].remaining).toBeCloseTo(3.8, 8);
    expect(game.bombs.active[1].remaining).toBeCloseTo(5.8, 8);
    expect(game.marbles[0].tags + game.marbles[1].tags).toBe(0);
  } finally { dispose(); }
});

test('crossing below four shortens an already burning fuse once, without resetting its burn', async () => {
  const { game, dispose } = await fixture(4);
  try {
    park(game);
    place(game, 0, CENTER.x, CENTER.y);
    game.bombs.active = [bomb(0, 1 / 60, 10), bomb(1, 10, 11)];
    ticks(game, 1);
    const before = game.bombs.active[0].remaining;
    ticks(game, 1);
    expect(game.bombs.active[0].duration).toBe(10 * SHORT_FUSE_FACTOR);
    expect(game.bombs.active[0].remaining).toBeCloseTo(before * SHORT_FUSE_FACTOR - 1 / 60, 8);
    ticks(game, 1);
    expect(game.bombs.active[0].duration).toBe(7);
    expect(game.inspect().details.stage).toBe(2);
  } finally { dispose(); }
});

test('the rare gold bomb creates its visibly larger physical wave without a fake prize announcement', async () => {
  const { game, events, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x, CENTER.y);
    game.bombs.active = [{ ...bomb(0, 1 / 60), mega: true }];
    ticks(game, 1);
    expect(game.waves.active[0].mega).toBe(true);
    expect(game.waves.active[0].range).toBe(MEGA_RADIUS);
    expect(events.filter(event => event.t === 'hype' && event.kind === 'jackpot')).toHaveLength(0);
  } finally { dispose(); }
});

test('procedural fuse beeps become measurably faster as the visible fuse burns', async () => {
  const { game, ctx, dispose } = await fixture();
  try {
    park(game);
    const times: number[] = [];
    ctx.headless = false;
    ctx.audio.bounce = () => times.push(game.time);
    game.bombs.active = [{ ...bomb(0, 10), beepAt: 0 }];
    ticks(game, 580);
    const gaps = times.slice(1).map((time, index) => time - times[index]);
    expect(times.length).toBeGreaterThan(20);
    expect(gaps.slice(0, 3).every(gap => gap > .6)).toBe(true);
    expect(gaps.slice(-3).every(gap => gap < .15)).toBe(true);
  } finally { dispose(); }
});
