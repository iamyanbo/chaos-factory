import { beforeAll, expect, test } from 'vitest';
import { initPhysics } from '../../engine/physics';
import { BALLS_PER_VIEWER, SLOTS, WAVE_SECONDS } from './config';
import { DT, advance, fixture } from './test-fixture';
import definition from './index';

beforeAll(async () => initPhysics());

test('four-ball bursts repeat every 2.5s in join order, exactly three trips through the roster', () => {
  const f = fixture(6);
  try {
    f.game.start();
    const births: { owner: number; at: number; life: number }[] = [];
    let latest = 0;
    while (f.game.status() === 'playing' && f.game.time < 50) {
      f.game.step(DT);
      for (const shot of f.game.flights.shots) if (shot.life > latest) {
        births.push({ owner: shot.owner, at: shot.firedAt, life: shot.life });
      }
      latest = Math.max(latest, ...f.game.flights.shots.map(shot => shot.life));
    }
    expect(births.map(shot => shot.owner)).toEqual(Array.from({ length: 18 }, (_, index) => index % 6));
    expect(births.slice(0, 4).every(shot => shot.at < .6)).toBe(true);
    expect(births[4].at - births[0].at).toBeCloseTo(WAVE_SECONDS, 5);
    expect(f.game.fired).toEqual(Array(6).fill(BALLS_PER_VIEWER));
    expect(f.game.scoring.landed).toEqual(Array(6).fill(BALLS_PER_VIEWER));
  } finally { f.destroy(); }
});

test('a finite round ends on its last real landing even when oranges remain and Fever never starts', () => {
  const f = fixture(1, 26);
  try {
    f.game.start();
    while (f.game.status() === 'playing' && f.game.time < 180) f.game.step(DT);
    expect(f.game.status()).toHaveProperty('done');
    expect(f.game.fever).toBe(false);
    expect(f.game.scoring.remaining).toBeGreaterThan(0);
    expect(f.game.lastBalls).toBe(true);
    expect(f.game.scoring.landings).toHaveLength(3);
    expect(f.game.scoring.landings.at(-1)!.time).toBe(f.game.time);
    expect(f.game.flights.shots.every(shot => !shot.active)).toBe(true);
    const result = f.game.status();
    const time = f.game.time;
    advance(f.game, 2);
    expect(f.game.status()).toEqual(result);
    expect(f.game.time).toBe(time);
  } finally { f.destroy(); }
});

test('the last orange doubles every later landing without cancelling queued second or third balls', () => {
  const f = fixture(2);
  try {
    f.game.start();
    f.game.step(DT);
    const shot = f.game.flights.shots[0];
    for (const peg of f.game.board.pegs.filter(peg => peg.kind === 'orange')) {
      f.game.scoring.hit(shot, peg, f.game.time);
    }
    expect(f.game.fever).toBe(true);
    expect(f.game.scoring.remaining).toBe(0);
    expect(f.game.status()).toBe('playing');
    expect(f.game.lastBalls).toBe(false);
    expect(f.game.scoring.landings).toHaveLength(0);
    expect(f.game.board.dividers).toHaveLength(8);
    expect(f.events.filter(event => event.t === 'hype' && event.kind === 'decisive')).toHaveLength(1);
    while (f.game.status() === 'playing' && f.game.time < 180) f.game.step(DT);
    expect(f.game.status()).toHaveProperty('done');
    expect(f.game.fired).toEqual([3, 3]);
    expect(f.game.scoring.landed).toEqual([3, 3]);
    expect(f.game.scoring.landings.every(landing => landing.multiplier === SLOTS[landing.slot].multiplier * 2)).toBe(true);
    expect(f.game.scoring.scores.reduce((sum, total) => sum + total, 0))
      .toBe(f.game.scoring.landings.reduce((sum, landing) => sum + landing.total, 0));
  } finally { f.destroy(); }
});

test('empty admission is void without generating balls', () => {
  const f = fixture(0);
  try {
    f.game.start();
    f.game.step(DT);
    expect(f.game.status()).toMatchObject({ done: { winner: { kind: 'void' } } });
    expect(f.game.flights.shots).toHaveLength(0);
  } finally { f.destroy(); }
});

test('every score, landing, physics event and natural result replay exactly', () => {
  const runs = [fixture(24, 1), fixture(24, 1)];
  try {
    for (const f of runs) {
      f.game.start();
      while (f.game.status() === 'playing' && f.game.time < 240) f.game.step(DT);
      expect(f.game.status()).toHaveProperty('done');
      expect(f.game.scoring.landings).toHaveLength(72);
      expect(f.game.fired.every(count => count === 3)).toBe(true);
    }
    expect(runs[0].game.inspect()).toEqual(runs[1].game.inspect());
    expect(runs[0].game.status()).toEqual(runs[1].game.status());
    expect(runs[0].events).toEqual(runs[1].events);
  } finally { for (const f of runs) f.destroy(); }
});

test('small and full rosters all fire and land exactly three balls per viewer', () => {
  for (const count of [1, 4, 24, 64]) {
    const f = fixture(count, 210);
    try {
      f.game.start();
      while (f.game.status() === 'playing' && f.game.time < 240) f.game.step(DT);
      expect(f.game.status()).toHaveProperty('done');
      expect(f.game.scoring.landings).toHaveLength(count * 3);
      expect(f.game.scoring.landed.every(landed => landed === 3)).toBe(true);
      expect(f.ctx.physics.entities.size).toBeLessThanOrEqual(definition.maxBodies);
    } finally { f.destroy(); }
  }
});

test('take scoring rewards completed active rounds using anonymous watchability only', () => {
  const events = { duration: 60, finished: true, leadChanges: 2, finalCloseness: .6, quietMax: 3, passes: 123 };
  expect(definition.scoreTake!(events)).toBeGreaterThan(definition.scoreTake!({ ...events, quietMax: 25 }));
  expect(definition.scoreTake!(events)).toBeGreaterThan(definition.scoreTake!({ ...events, finished: false }));
});
