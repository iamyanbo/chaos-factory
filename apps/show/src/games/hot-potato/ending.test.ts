import { expect, test } from 'vitest';
import type { GameEvent } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { simulateTake } from '../../kit/take-simulation';
import definition, { HotPotato } from './index';
import { CENTER, FUSE_MAX, FUSE_MIN, SHORT_FUSE_FACTOR } from './config';
import { bomb, fixture, park, place, setup, ticks } from './fixture';

test('seeded fuses are 8–14 seconds, with distinct carriers and shorter final fuses', async () => {
  for (const count of [24, 7, 3]) {
    const { game, dispose } = await fixture(count);
    try {
      const expected = count < 8 ? 2 : 1;
      expect(game.bombs.active).toHaveLength(expected);
      expect(new Set(game.bombs.active.map(active => active.holder)).size).toBe(expected);
      const factor = count < 4 ? SHORT_FUSE_FACTOR : 1;
      for (const active of game.bombs.active) {
        expect(active.duration).toBeGreaterThanOrEqual(FUSE_MIN * factor);
        expect(active.duration).toBeLessThanOrEqual(FUSE_MAX * factor);
      }
      expect(game.inspect().details.stage).toBe(count < 4 ? 2 : count < 8 ? 1 : 0);
    } finally { dispose(); }
  }
});

test('explosion waits for its real fuse and replacement waits for the two-second breather', async () => {
  const { game, dispose } = await fixture();
  try {
    park(game);
    place(game, 0, CENTER.x, CENTER.y);
    game.bombs.active = [bomb(0, .25)];
    ticks(game, 14);
    expect(game.marbles[0].alive).toBe(true);
    ticks(game, 1);
    expect(game.marbles[0].alive).toBe(false);
    expect(game.bombs.active).toHaveLength(0);
    ticks(game, 119);
    expect(game.bombs.active).toHaveLength(0);
    ticks(game, 2);
    expect(game.bombs.active).toHaveLength(2);
    expect(game.bombs.active.every(active => game.marbles[active.holder].alive)).toBe(true);
  } finally { dispose(); }
});

test('150 seconds visibly triples fuse burn and never awards a clock verdict', async () => {
  const { game, events, dispose } = await fixture();
  try {
    park(game);
    game.bombs.active = [bomb(0, 5)];
    game.time = 149.99;
    ticks(game, 1);
    expect(game.inspect().details.burnRate).toBe(3);
    expect(game.inspect().details.suddenDeath).toBe(true);
    expect(game.bombs.active[0].remaining).toBeCloseTo(4.95, 8);
    expect(game.status()).toBe('playing');
    game.suddenDeath();
    expect(events.filter(event => event.t === 'moment' && event.text.includes('FUSES BURN'))).toHaveLength(1);
  } finally { dispose(); }
});

test('all same-tick explosions resolve before a winner is considered, in either array order', async () => {
  for (const reverse of [false, true]) {
    const { game, events, dispose } = await fixture(2);
    try {
      park(game);
      game.bombs.active = [bomb(0, 1 / 60, 10), bomb(1, 1 / 60, 11)];
      if (reverse) game.bombs.active.reverse();
      ticks(game, 1);
      expect(game.marbles.every(marble => !marble.alive)).toBe(true);
      expect(events.filter(event => event.t === 'elim')).toHaveLength(2);
      const state = game.status();
      expect(typeof state === 'object' && 'done' in state && state.done.winner.kind).toBe('void');
    } finally { dispose(); }
  }
});

test('an unexpired second carrier wins as the actual last survivor', async () => {
  const { game, dispose } = await fixture(2);
  try {
    park(game);
    game.bombs.active = [bomb(0, 1 / 60, 10), bomb(1, 5, 11)];
    ticks(game, 1);
    const state = game.status();
    expect(game.marbles.filter(marble => marble.alive)).toEqual([game.marbles[1]]);
    expect(typeof state === 'object' && 'done' in state && state.done.champion?.userId).toBe(game.marbles[1].id);
  } finally { dispose(); }
});

test('CvS chat must eliminate the larger boss while more than three chatters remain', async () => {
  const { game, dispose } = await fixture(4, 7, 'boss');
  try {
    park(game);
    place(game, 0, CENTER.x, CENTER.y);
    expect(game.marbles[0].radius).toBeGreaterThan(game.marbles[1].radius);
    game.bombs.active = [{ ...bomb(0, 1 / 60), passer: 1 }];
    ticks(game, 1);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.winner.kind).toBe('chat');
    if (typeof state === 'object' && 'done' in state) {
      expect(state.done.champion?.userId).toBe(game.marbles[1].id);
      expect(Object.values(state.done.perUser).every(user => user.tags.includes('win'))).toBe(true);
    }
  } finally { dispose(); }
});

test('CvS reaching three chatters wins for the boss after all simultaneous blasts', async () => {
  const { game, dispose } = await fixture(4, 7, 'boss');
  try {
    park(game);
    game.bombs.active = [bomb(0, 1 / 60, 10), bomb(1, 1 / 60, 11)];
    ticks(game, 1);
    expect(game.marbles.filter(marble => marble.alive && !marble.isStreamer)).toHaveLength(3);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.winner.kind).toBe('streamer');
  } finally { dispose(); }
});

test('CvS cannot award a dead boss when that fixed step eliminates everybody', async () => {
  const { game, dispose } = await fixture(4, 7, 'boss');
  try {
    game.marbles.forEach((_, index) => place(game, index, CENTER.x + 600 + index * 40, CENTER.y));
    game.bombs.active = [bomb(0, 1 / 60)];
    ticks(game, 1);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.winner.kind).toBe('void');
  } finally { dispose(); }
});

test('a small CvS field keeps playing to the last survivor', async () => {
  const { game, dispose } = await fixture(3, 7, 'boss');
  try {
    park(game);
    expect(game.status()).toBe('playing');
    game.bombs.active = [bomb(0, 1 / 60, 10), bomb(1, 1 / 60, 11)];
    ticks(game, 1);
    expect(game.status()).toBe('playing');
    game.bombs.active = [bomb(2, 1 / 60)];
    ticks(game, 1);
    const state = game.status();
    expect(typeof state === 'object' && 'done' in state && state.done.champion?.userId).toBe(game.marbles[3].id);
  } finally { dispose(); }
});

test('seed and physics, rather than identity or color, determine a take', async () => {
  const original = setup(19);
  const renamed = structuredClone(original);
  renamed.participants.forEach((player, index) => Object.assign(player, {
    userId: `different-${index}`, displayName: 'OTHER', color: '#abcdef', level: 10, title: 'Champion'
  }));
  const first = await simulateTake(definition, original);
  expect(await simulateTake(definition, original)).toEqual(first);
  expect(await simulateTake(definition, renamed)).toEqual(first);
  expect(first.events.finished).toBe(true);
});

test('24 default-roster rounds reach physical natural outcomes in FFA and CvS', async () => {
  await initPhysics();
  const durations: number[] = [];
  for (const format of ['ffa', 'boss'] as const) for (let seed = 1; seed <= 12; seed++) {
    const events: GameEvent[] = [];
    const ctx = headlessContext(definition, setup(seed, 24, format), event => events.push(event));
    const game = new HotPotato(ctx);
    try {
      game.start();
      for (let tick = 0; tick < 360 * 60 && game.status() === 'playing'; tick++) game.step(1 / 60);
      const state = game.status();
      expect(state, `${format} seed ${seed}`).not.toBe('playing');
      if (typeof state === 'object' && 'done' in state) {
        expect(state.done.winner.kind, `${format} seed ${seed}`).not.toBe('void');
        if (format === 'ffa') {
          const living = game.marbles.filter(marble => marble.alive);
          expect(living).toHaveLength(1);
          expect(state.done.champion?.userId).toBe(living[0].id);
        }
      }
      expect(events.some(event => event.t === 'elim')).toBe(true);
      durations.push(Math.round(game.time * 10) / 10);
    } finally {
      game.destroy();
      expect(ctx.physics.entities.size).toBe(0);
      ctx.physics.destroy();
    }
  }
  console.info('Hot Potato natural outcomes (FFA 12 / CvS 12), seconds:', JSON.stringify(durations));
});

test('empty and single-player fields resolve naturally, and a full boss field fits its body cap', async () => {
  for (const count of [0, 1, 64]) {
    const { game, ctx, dispose } = await fixture(count, 9, count === 64 ? 'boss' : 'ffa');
    try {
      if (count <= 1) expect(game.status()).not.toBe('playing');
      else {
        expect(ctx.physics.entities.size).toBe(definition.maxBodies);
        expect(game.marbles).toHaveLength(65);
        ticks(game, 60);
        expect(game.status()).toBe('playing');
      }
    } finally { dispose(); }
  }
});
