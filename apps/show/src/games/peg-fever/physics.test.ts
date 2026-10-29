import { beforeAll, expect, test } from 'vitest';
import { initPhysics, PX } from '../../engine/physics';
import { BALL_RADIUS, BOTTOM, MAX_SHOTS, RACK_LIFT_SPEED, SLOTS, SLOT_TOP,
  SUDDEN_AT, WALL } from './config';
import { DT, advance, fixture, place } from './test-fixture';

beforeAll(async () => initPhysics());

test('real peg contact bounces and lights a target; the owner landing alone clears its colliders', () => {
  const f = fixture(2);
  try {
    f.game.start();
    f.game.step(DT);
    const shot = f.game.flights.shots[0];
    const peg = f.game.board.pegs.filter(target => target.kind === 'blue')
      .sort((a, b) => a.y - b.y)[0];
    const collider = peg.collider!;
    place(shot, peg.x, peg.y - peg.radius - BALL_RADIUS - 1, 0, 100);
    for (let tick = 0; tick < 4 && peg.claim === undefined; tick++) f.game.step(DT);
    expect(peg.claim).toBe(shot.life);
    expect(shot.points).toBe(110);
    expect(f.game.scoring.scores[0]).toBe(0);
    expect(collider.isValid()).toBe(true);
    expect(shot.body.linvel().y).toBeLessThan(0);
    const rival = f.game.flights.launch(1, f.game.time)!;
    const other = f.game.board.pegs.find(target => target.kind === 'blue' && target !== peg)!;
    f.game.scoring.hit(rival, other, f.game.time);
    place(shot, SLOTS[3].center, BOTTOM - WALL / 2 - BALL_RADIUS - 1, 0, 100);
    for (let tick = 0; tick < 5 && shot.active; tick++) f.game.step(DT);
    expect(shot.active).toBe(false);
    expect(f.game.scoring.landings[0]).toMatchObject({ owner: 0, run: 110, multiplier: 5, total: 550 });
    expect(f.game.scoring.scores[0]).toBe(550);
    expect(peg.removed).toBe(true);
    expect(collider.isValid()).toBe(false);
    expect(other.removed).toBe(false);
    expect(other.collider?.isValid()).toBe(true);
  } finally { f.destroy(); }
});

test('slot dividers exist before Fever and physically keep balls inside their landing lanes', () => {
  const f = fixture(1);
  try {
    f.game.start();
    f.game.step(DT);
    expect(f.game.fever).toBe(false);
    expect(f.game.board.dividers).toHaveLength(8);
    const shot = f.game.flights.shots[0];
    const edge = SLOTS[3].right;
    place(shot, edge - WALL / 2 - BALL_RADIUS - 1, SLOT_TOP + 25, 120, 0);
    advance(f.game, DT * 4);
    expect(shot.x).toBeLessThan(edge - BALL_RADIUS);
    expect(shot.body.linvel().x).toBeLessThan(0);
    expect(f.game.scoring.landings).toHaveLength(0);
  } finally { f.destroy(); }
});

test('a ball missing the pegs pays its visible run base only on real floor contact', () => {
  const f = fixture(1);
  try {
    f.game.start();
    f.game.step(DT);
    const shot = f.game.flights.shots[0];
    expect(f.game.scoring.scores[0]).toBe(0);
    place(shot, SLOTS[0].center, BOTTOM - WALL / 2 - BALL_RADIUS - 1, 0, 100);
    for (let tick = 0; tick < 5 && shot.active; tick++) f.game.step(DT);
    expect(shot.active).toBe(false);
    expect(f.game.scoring.landings[0]).toMatchObject({ run: 100, total: 100, multiplier: 1 });
    expect(f.game.scoring.landed[0]).toBe(1);
    expect(f.game.scoring.scores[0]).toBe(100);
    expect(f.events.filter(event => event.t === 'activity' && event.kind === 'checkpoint')).toHaveLength(1);
    expect(f.game.status()).toBe('playing');
  } finally { f.destroy(); }
});

test('the hidden 150s threshold lifts the drawn physical peg rack without settling any ball', () => {
  const f = fixture(1);
  try {
    f.game.time = SUDDEN_AT - DT;
    f.game.start();
    const peg = f.game.board.pegs[0];
    const oldY = peg.y;
    f.game.step(DT);
    expect(f.game.sudden).toBe(true);
    expect(f.game.status()).toBe('playing');
    f.game.suddenDeath();
    advance(f.game, 1);
    expect(f.game.board.lift).toBeCloseTo(RACK_LIFT_SPEED, 5);
    expect(peg.y).toBeCloseTo(oldY - RACK_LIFT_SPEED, 5);
    expect(peg.collider!.translation().y * PX).toBeCloseTo(peg.y, 3);
    expect(f.events.filter(event => event.t === 'moment')).toHaveLength(1);
  } finally { f.destroy(); }
});

test('ball reuse resets runs and claims within the body budget with all nine slots present', () => {
  const f = fixture(64);
  try {
    for (let index = 0; index < MAX_SHOTS; index++) {
      expect(f.game.flights.launch(index, index * .1)).toBeDefined();
    }
    expect(f.game.flights.launch(63, 4)).toBeUndefined();
    const shot = f.game.flights.shots[0];
    const body = shot.body;
    const oldLife = shot.life;
    shot.points = 500;
    shot.multiplier = 2;
    shot.landed = true;
    f.game.flights.release(shot);
    const reused = f.game.flights.launch(63, 4)!;
    expect(reused.body).toBe(body);
    expect(reused.life).toBeGreaterThan(oldLife);
    expect([reused.points, reused.multiplier, reused.landed]).toEqual([100, 1, false]);
    expect(f.ctx.physics.entities.size).toBe(49);
    expect(f.ctx.physics.colliders.size).toBe(178);
    expect(f.game.board.dividers.every(divider => divider.isEnabled())).toBe(true);
  } finally { f.destroy(); }
});
