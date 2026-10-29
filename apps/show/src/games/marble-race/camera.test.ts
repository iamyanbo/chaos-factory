import { beforeAll, expect, test } from 'vitest';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { RaceCamera } from './camera';
import {
  CAMERA_BOTTOM_Y,
  CAMERA_MAX_ACCELERATION,
  CAMERA_MAX_SPEED,
  CAMERA_LOOK_AHEAD,
  CAMERA_OMEGA,
  AUDIT_SECONDS,
} from './config';
import definition, { MarbleRace } from './index';

const DT = 1 / 60;
const runner = (y: number, alive = true, finished = false) => ({ y, alive, finished });

beforeAll(async () => initPhysics());

test('camera follows the leader with course ahead, ignoring finished runners', () => {
  const camera = new RaceCamera();
  camera.step([runner(1700), runner(1500), runner(1300), runner(900),
    runner(4000, false, true)], DT);
  expect(camera.targetY).toBe(1700 + CAMERA_LOOK_AHEAD);
  const pair = new RaceCamera();
  pair.step([runner(1700), runner(900)], DT);
  expect(pair.targetY).toBe(1700 + CAMERA_LOOK_AHEAD);
  const solo = new RaceCamera();
  solo.step([runner(1700)], DT);
  expect(solo.targetY).toBe(1700 + CAMERA_LOOK_AHEAD);
  camera.step([runner(1600), runner(2000), runner(1800)], DT);
  expect(camera.targetY).toBe(2000 + CAMERA_LOOK_AHEAD);
  camera.step([runner(1800), runner(1900), runner(1700)], DT);
  expect(camera.targetY).toBe(2000 + CAMERA_LOOK_AHEAD);
});

test('dead zone holds small changes and the unsaturated spring uses the specified equation', () => {
  const camera = new RaceCamera();
  camera.step([runner(599 - CAMERA_LOOK_AHEAD)], DT);
  expect(camera.y).toBe(540);
  camera.step([runner(600 - CAMERA_LOOK_AHEAD)], DT);
  expect(camera.targetY).toBe(600);
  expect(camera.velocity).toBeCloseTo(CAMERA_OMEGA ** 2 * 60 * DT, 12);
  expect(camera.y).toBeCloseTo(540 + camera.velocity * DT, 12);
  for (let tick = 0; tick < 600; tick++) camera.step([runner(550 - CAMERA_LOOK_AHEAD)], DT);
  expect(camera.targetY).toBe(600);
  expect(camera.y).toBeCloseTo(600, 4);
});

test('camera remains monotonic with bounded acceleration over 200 real seeded courses', () => {
  let peakAcceleration = 0;
  let peakSpeed = 0;
  let finished = 0;
  const durations: number[] = [];
  const byRoster = new Map<number, number[]>();
  for (let seed = 1; seed <= 200; seed++) {
    const count = [1, 2, 24, 48][(seed - 1) % 4];
    const faction = seed % 3 === 0;
    const teams = ['red', 'blue', 'mint', 'gold'] as const;
    const setup: RoundSetup = {
      gameId: definition.id, seed, mode: faction ? 'faction' : 'cvs',
      format: faction ? 'faction' : 'ffa', difficulty: 1, modifiers: [],
      teams: [...teams], streamerName: 'Host',
      participants: Array.from({ length: count }, (_, index) => ({
        userId: `p${index}`, login: `p${index}`, displayName: `Runner ${index + 1}`,
        color: '#ffffff', teamId: faction ? teams[index % teams.length] : undefined,
      })),
    };
    const ctx = headlessContext(definition, setup, () => {});
    const game = new MarbleRace(ctx);
    let previousY = game.camera.y;
    let previousSpeed = 0;
    game.start();
    try {
      for (let tick = 0; tick <= AUDIT_SECONDS * 60 && game.status() === 'playing'; tick++) {
        game.step(DT);
        const y = game.camera.y;
        const speed = (y - previousY) / DT;
        const acceleration = Math.abs(speed - previousSpeed) / DT;
        peakAcceleration = Math.max(peakAcceleration, acceleration);
        peakSpeed = Math.max(peakSpeed, speed);
        if (y < previousY - 1e-9 || speed > CAMERA_MAX_SPEED + 1e-7
          || acceleration > CAMERA_MAX_ACCELERATION + 1e-6
          || y > CAMERA_BOTTOM_Y + 1e-6) {
          throw new Error(`Camera seed ${seed}, tick ${tick}: y=${y}, speed=${speed}, acceleration=${acceleration}`);
        }
        previousY = y;
        previousSpeed = speed;
      }
      durations.push(game.time);
      const group = byRoster.get(count) ?? [];
      group.push(game.time);
      byRoster.set(count, group);
      finished += Number(game.marbles.some(marble => marble.finished));
    } finally {
      game.destroy();
      ctx.physics.destroy();
    }
  }
  durations.sort((a, b) => a - b);
  console.info('Marble Race camera audit', JSON.stringify({
    seeds: durations.length, physicallyFinished: finished, peakAcceleration, peakSpeed,
    durations: { min: durations[0], median: durations[100], max: durations[199],
      under75: durations.filter(duration => duration < 75).length },
    byRoster: [...byRoster].map(([count, times]) => {
      times.sort((a, b) => a - b);
      return { count, min: times[0], median: times[Math.floor(times.length / 2)],
        max: times[times.length - 1] };
    }),
  }));
  expect(durations).toHaveLength(200);
  expect(peakAcceleration).toBeLessThanOrEqual(CAMERA_MAX_ACCELERATION + 1e-6);
  expect(peakSpeed).toBeLessThanOrEqual(CAMERA_MAX_SPEED + 1e-7);
}, 240000);
