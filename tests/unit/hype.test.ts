import { expect, test } from 'vitest';
import { HypeBus, RareCelebration } from '../../apps/show/src/kit/hype/bus';
import type { HypeEvent } from '../../apps/show/src/kit/hype/types';
import { reactionSummary, reactionTakeBonus } from '../../apps/show/src/kit/hype/take-score';
import { Camera } from '../../apps/show/src/engine/camera';
import { FixedLoop } from '../../apps/show/src/engine/loop';

test('decisive slow motion is capped at two live events and wins pay once', () => {
  const bus = new HypeBus();
  for (let index = 0; index < 5; index++) bus.decisive(960, 540);
  bus.win(960, 540, { name: 'A' });
  bus.win(960, 540, { name: 'A' });
  expect(bus.drain().map(event => event.kind)).toEqual(['decisive', 'decisive', 'win']);
  expect(bus.drain()).toEqual([]);
});

test('combo chains belong to their actor and reset after one second without a hit', () => {
  const bus = new HypeBus();
  bus.at(1);
  bus.combo(900, 500, { key: 'ball:a' });
  bus.at(1.9);
  bus.combo(900, 500, { key: 'ball:a' });
  bus.combo(900, 500, { key: 'ball:b' });
  bus.at(2.91);
  bus.combo(900, 500, { key: 'ball:a' });
  expect(bus.drain().map(event => event.count)).toEqual([1, 2, 1, 1]);
});

test('near misses debounce per actor; ordinary deaths never imply kill streaks', () => {
  const events: HypeEvent[] = [];
  const bus = new HypeBus(event => events.push(event), false);
  bus.at(9);
  bus.nearMiss(800, 700, { userId: 'leader' });
  bus.nearMiss(800, 700, { userId: 'leader' });
  bus.kill(800, 700, { key: 'attacker' });
  bus.at(9.5);
  bus.kill(800, 700, { key: 'attacker' });
  bus.jackpot(800, 700);
  bus.at(9.8);
  bus.jackpot(800, 700);
  expect(events.filter(event => event.kind === 'nearMiss')).toHaveLength(1);
  expect(events.filter(event => event.kind === 'kill').every(event => event.text === undefined)).toBe(true);
  expect(events.filter(event => event.kind === 'jackpot').map(event => event.time)).toEqual([9.5]);
  expect(bus.drain()).toEqual([]);
});

test('visual queues remain bounded, reject invalid coordinates and use no game RNG', () => {
  const bus = new HypeBus();
  for (let index = 0; index < 1000; index++) bus.combo(900, 700);
  bus.callout(NaN, 700, { text: 'CLUTCH!' });
  expect(bus.drain()).toHaveLength(128);
  const first = Array.from({ length: 300 }, (_, seed) => new RareCelebration(seed).armed);
  expect(Array.from({ length: 300 }, (_, seed) => new RareCelebration(seed).armed)).toEqual(first);
  expect(first.filter(Boolean).length).toBeGreaterThan(75);
  expect(first.filter(Boolean).length).toBeLessThan(125);
  const reward = new RareCelebration(first.indexOf(true));
  expect(bus.drain()).toEqual([]);
  expect(reward.celebrate(bus, 900, 700)).toBe(true);
  expect(reward.celebrate(bus, 900, 700)).toBe(false);
  expect(bus.drain()).toHaveLength(1);
});

test('reaction bonuses count only the final third and never use winner identity', () => {
  const summary = reactionSummary([{ kind: 'jackpot', time: 20 },
    { kind: 'nearMiss', time: 60 }, { kind: 'jackpot', time: 80 }], 90);
  expect(summary).toEqual({ jackpots: 2, nearMisses: 1, finalThirdJackpots: 1, finalThirdNearMisses: 1 });
  expect(reactionTakeBonus(summary)).toBe(36);
  expect(reactionTakeBonus({})).toBe(0);
});

test('live emphasis preserves fixed camera target and 60Hz steps at 0.3 speed', () => {
  const camera = new Camera();
  camera.lockFrame();
  camera.hypeFocus({ x: 1200, y: 700 }, 1);
  camera.update(1 / 60);
  expect(camera.zoom).toBe(1);
  expect(camera.displayZoom).toBe(1.4);
  expect(camera.target).toEqual({ x: 960, y: 540 });
  expect(camera.project({ x: 1200, y: 700 })).toEqual({ x: 960, y: 540 });
  camera.hypeFocus({ x: 1200, y: 700 }, 0);
  camera.update(1 / 60);
  expect(camera.displayZoom).toBe(1);
  const steps: number[] = [];
  const loop = new FixedLoop(dt => steps.push(dt), () => {});
  loop.timeScale = .3;
  for (let frame = 0; frame < 60; frame++) loop.frame(1 / 60);
  expect(steps.length).toBeGreaterThanOrEqual(17);
  expect(steps.length).toBeLessThanOrEqual(18);
  expect(steps.every(dt => dt === 1 / 60)).toBe(true);
});
