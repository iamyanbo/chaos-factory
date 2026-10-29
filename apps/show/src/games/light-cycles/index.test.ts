import { expect, test } from 'vitest';
import type { GameEvent, RoundSetup } from '@chaos/shared';
import definition, { LightCycles } from './index';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { simulateTake } from '../../kit/take-simulation';

export function setup(seed = 8, count = 24): RoundSetup {
  return { gameId: definition.id, seed, mode: 'cvs', format: 'ffa', competition: 'individual',
    difficulty: 0.5, modifiers: [], streamerName: 'HOST',
    participants: Array.from({ length: count }, (_, index) => ({
      userId: `cycle-${index}`, login: `cycle-${index}`, displayName: `CYCLE ${index}`, color: '#ffffff'
    })) };
}

test('Light Cycles is a fixed-view join-only FFA with no streamer or reflex controls', async () => {
  await initPhysics();
  const context = headlessContext(definition, setup(), () => {});
  const game = new LightCycles(context);
  try {
    expect(definition.formats).toEqual(['ffa']);
    expect(definition.camera).toBe('fixed');
    expect(definition.chatVerbs).toEqual([]);
    expect(definition.streamerControls).toEqual([]);
    expect(game.marbles).toHaveLength(24);
    expect(game.inspect().marbles.every(actor => actor.isStreamer === false)).toBe(true);
    expect(game.onJoin()).toBe(false);
    expect(game.inspect().details.grid).toBe(160);
  } finally {
    game.destroy();
    expect(context.physics.entities.size).toBe(0);
    context.physics.destroy();
  }
});

test('the actual last survivor owns the result and trail eliminations have real user attribution', async () => {
  await initPhysics();
  const events: GameEvent[] = [];
  const context = headlessContext(definition, setup(), event => events.push(event));
  const game = new LightCycles(context);
  try {
    game.start();
    for (let tick = 0; tick < 120 * 60 && game.status() === 'playing'; tick++) game.step(1 / 60);
    const state = game.status();
    expect(state).not.toBe('playing');
    const living = game.marbles.filter(actor => actor.alive);
    expect(living).toHaveLength(1);
    if (typeof state === 'object' && 'done' in state) {
      expect(state.done.champion?.userId).toBe(living[0].id);
      expect(state.done.perUser[living[0].id].tags).toContain('win');
    }
    const deaths = events.filter(event => event.t === 'elim');
    expect(deaths).toHaveLength(23);
    expect(new Set(deaths.map(event => event.victim)).size).toBe(23);
    expect(deaths.some(event => event.by && event.by !== event.victim)).toBe(true);
  } finally {
    game.destroy();
    context.physics.destroy();
  }
});

test('changing identities, colors, levels and titles never changes a headless take', async () => {
  const original = setup();
  const renamed = structuredClone(original);
  renamed.participants.forEach((member, index) => Object.assign(member, {
    userId: `different-${index}`, displayName: `OTHER ${index}`, color: '#abcdef', level: 9, title: 'Cup Champion'
  }));
  const first = await simulateTake(definition, original);
  expect(await simulateTake(definition, original)).toEqual(first);
  expect(await simulateTake(definition, renamed)).toEqual(first);
  expect(first.events.finished).toBe(true);
});
