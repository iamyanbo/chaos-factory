import { beforeAll, expect, test } from 'vitest';
import { Rng } from '@chaos/shared';
import { initPhysics } from '../../engine/physics';
import { BALL_RADIUS, CENTER, LEFT, RIGHT, SLOTS, SLOT_TOP } from './config';
import { makeLayout, PEG_PATTERNS } from './layout';
import { makeResult, teamTotals } from './state';
import { fixture } from './test-fixture';

beforeAll(async () => initPhysics());

test('all three boards change the physical routes, rather than just target colors', () => {
  const shapes = PEG_PATTERNS.map(pattern => makeLayout(new Rng(1), pattern)
    .map(peg => [peg.localX, peg.localY]));
  expect(new Set(shapes.map(shape => JSON.stringify(shape))).size).toBe(3);
  const randomShapes = new Set(Array.from({ length: 24 }, (_, seed) =>
    JSON.stringify(makeLayout(new Rng(seed + 1)).map(peg => [peg.localX, peg.localY]))));
  expect(randomShapes.size).toBe(3);
});

test('121 seeded targets have exact colors, mirror symmetry and ball-sized open gaps', () => {
  for (let seed = 1; seed <= 24; seed++) {
    const pegs = makeLayout(new Rng(seed));
    expect(pegs).toHaveLength(121);
    expect(['blue', 'orange', 'gold'].map(kind => pegs.filter(peg => peg.kind === kind).length))
      .toEqual([100, 20, 1]);
    for (const peg of pegs) {
      expect(pegs.some(other => other.kind === peg.kind && other.localX === -peg.localX
        && other.localY === peg.localY)).toBe(true);
      expect(peg.y + peg.radius).toBeLessThan(SLOT_TOP - 8);
      expect(Math.abs(peg.x - CENTER.x)).toBeLessThan(440);
      for (const other of pegs) if (other.id !== peg.id) {
        expect(Math.hypot(peg.x - other.x, peg.y - other.y))
          .toBeGreaterThan(peg.radius + other.radius + BALL_RADIUS * 2);
      }
    }
    expect(makeLayout(new Rng(seed))).toEqual(pegs);
  }
  expect(makeLayout(new Rng(1))).not.toEqual(makeLayout(new Rng(2)));
});

test('runs stay in escrow until landing; hit bonuses grow and gold doubles the whole run', () => {
  const f = fixture(2);
  try {
    const shot = f.game.flights.launch(0, 0)!;
    const blue = f.game.board.pegs.filter(peg => peg.kind === 'blue');
    const orange = f.game.board.pegs.find(peg => peg.kind === 'orange')!;
    const gold = f.game.board.pegs.find(peg => peg.kind === 'gold')!;
    f.game.scoring.hit(shot, blue[0], 0);
    expect(shot.points).toBe(110);
    f.game.scoring.hit(shot, orange, .1);
    expect(shot.points).toBe(210);
    f.game.scoring.hit(shot, gold, .2);
    expect(shot.points).toBe(420);
    f.game.scoring.hit(shot, blue[1], .3);
    expect(shot.points).toBe(500);
    expect(shot.multiplier).toBe(2);
    expect(f.game.scoring.scores).toEqual([0, 0]);
    const rival = f.game.flights.launch(1, .5)!;
    expect(f.game.scoring.hit(rival, orange, .5)).toBe(false);
    expect(f.game.scoring.hit(shot, blue[0], .6)).toBe(false);
    expect(shot.points).toBe(500);
    expect(f.events.filter(event => event.t === 'hype' && event.kind === 'jackpot')).toHaveLength(0);
    const payment = f.game.scoring.settle(shot, 3, false, 1)!;
    expect(payment).toMatchObject({ run: 500, multiplier: 5, total: 2500, ownerTotal: 2500 });
    expect(f.game.scoring.scores).toEqual([2500, 0]);
    expect(f.game.scoring.settle(shot, 4, true, 2)).toBeUndefined();
    expect(f.game.scoring.scores[0]).toBe(2500);
  } finally { f.destroy(); }
});

test('nine permanent symmetric slots multiply every run; Fever doubles existing multipliers', () => {
  expect(SLOTS.map(slot => slot.multiplier)).toEqual([1, 2, 3, 5, 10, 5, 3, 2, 1]);
  expect(SLOTS[0].left).toBe(LEFT);
  expect(SLOTS[8].right).toBe(RIGHT);
  expect(SLOTS[4].right - SLOTS[4].left).toBeLessThan(SLOTS[3].right - SLOTS[3].left);
  const f = fixture(1);
  try {
    let expected = 0;
    for (const fever of [false, true]) for (let slot = 0; slot < SLOTS.length; slot++) {
      const shot = f.game.flights.launch(0, 0)!;
      shot.points = 120;
      const payment = f.game.scoring.settle(shot, slot, fever, 0)!;
      const multiplier = SLOTS[slot].multiplier * (fever ? 2 : 1);
      expect(payment.total).toBe(120 * multiplier);
      expected += payment.total;
      f.game.flights.release(shot);
    }
    expect(f.game.scoring.scores[0]).toBe(expected);
    expect(f.game.scoring.landed[0]).toBe(18);
  } finally { f.destroy(); }
});

test('every viewer gets the same visible run base, so empty-board Fever landings still pay', () => {
  const f = fixture(2);
  try {
    const early = f.game.flights.launch(0, 0)!;
    const late = f.game.flights.launch(1, 40)!;
    expect(early.points).toBe(100);
    expect(late.points).toBe(early.points);
    expect(f.game.scoring.scores).toEqual([0, 0]);
    expect(f.game.scoring.settle(early, 4, false, 41)?.total).toBe(1000);
    expect(f.game.scoring.settle(late, 4, true, 42)?.total).toBe(2000);
    expect(f.game.scoring.scores).toEqual([1000, 2000]);
  } finally { f.destroy(); }
});

test('faction winners use paid team totals and preserve every member placement', () => {
  const f = fixture(4, 26, true);
  try {
    f.game.scoring.scores.splice(0, 4, 100, 300, 250, 100);
    expect(teamTotals(f.ctx, f.game.scoring).map(row => [row.teamId, row.score]))
      .toEqual([['blue', 400], ['red', 350]]);
    const result = makeResult(f.ctx, f.game.scoring);
    expect(result.winner).toEqual({ kind: 'team', teamId: 'blue' });
    expect(result.champion?.userId).toBe('p1');
    expect(result.perUser.p3.tags).toContain('win');
    expect(result.perUser.p2.tags).not.toContain('win');
  } finally { f.destroy(); }
});
