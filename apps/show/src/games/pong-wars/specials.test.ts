import { expect, test } from "vitest";
import { Rng } from "@chaos/shared";
import { TerritoryGrid, tileRect } from "./board";
import { PongModel, type PongHooks } from "./model";
import { createSpecials, mirrorOrbit, SPECIAL } from "./specials";
import { BALL_SPEED, MAX_BALLS_PER_TEAM, WALL_OWNER } from "./config";

const quiet: PongHooks = { contact() {}, birth() {}, sprint() {} };

test("exactly 8% of tiles are seeded specials with both mirror partners", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const specials = createSpecials(new Rng(seed));
    expect([...specials].filter(Boolean)).toHaveLength(32);
    expect([...specials].filter(kind => kind === SPECIAL.split)).toHaveLength(16);
    expect([...specials].filter(kind => kind === SPECIAL.bomb)).toHaveLength(8);
    expect([...specials].filter(kind => kind === SPECIAL.wall)).toHaveLength(8);
    for (let index = 0; index < specials.length; index++) {
      for (const partner of mirrorOrbit(index)) expect(specials[partner]).toBe(specials[index]);
    }
  }
});

test("white blocks stay unowned even after direct and bomb flips", () => {
  const grid = new TerritoryGrid(4, new Rng(3));
  const index = [...grid.cells].findIndex(owner => owner === WALL_OWNER);
  const counts = [...grid.counts];
  expect(grid.flip(index, 0, 10)).toBe(false);
  expect(grid.cells[index]).toBe(WALL_OWNER);
  expect(grid.counts).toEqual(counts);
});

test("renaming every team leaves the complete spatial battle unchanged", () => {
  for (const seed of [1, 17, 83]) {
    const a = new PongModel(["red", "blue", "mint", "gold"], new Rng(seed));
    const b = new PongModel(["violet", "orange", "blue", "red"], new Rng(seed));
    while (!a.done) {
      a.step(quiet);
      b.step(quiet);
    }
    expect(a.grid.cells).toEqual(b.grid.cells);
    expect(a.grid.counts).toEqual(b.grid.counts);
    expect(a.comebacks).toEqual(b.comebacks);
    const motion = (model: PongModel) => model.balls.map(ball =>
      [ball.ordinal, ball.slot, ball.x, ball.y, ball.vx, ball.vy, ball.flips]);
    expect(motion(a)).toEqual(motion(b));
    expect(a.splits).toBe(b.splits);
    expect(a.bombs).toBe(b.bombs);
  }
});

function arranged(kind: number) {
  const model = new PongModel(["red", "blue"], new Rng(7));
  const ball = model.balls.find(actor => actor.ordinal === 0)!;
  model.balls.splice(0, model.balls.length, ball);
  model.grid.cells.fill(0);
  model.grid.counts.splice(0, 2, 400, 0);
  model.grid.specials.fill(SPECIAL.none);
  const index = 210;
  model.grid.setOwner(index, 1, 0);
  model.grid.specials[index] = kind;
  const rect = tileRect(index);
  ball.x = rect.x - ball.radius - 4;
  ball.y = rect.y + rect.size / 2;
  ball.vx = BALL_SPEED;
  ball.vy = 0;
  return { model, ball, index };
}

test("a Split creates one team ball on contact and never exceeds the eight-ball cap", () => {
  const { model, ball, index } = arranged(SPECIAL.split);
  let births = 0;
  model.step({ ...quiet, birth(actor, reason) {
    expect(actor.ordinal).toBe(ball.ordinal);
    expect(reason).toBe("split");
    expect(actor.x).toBe(ball.x);
    expect(actor.y).toBe(ball.y);
    expect(Math.hypot(actor.vx, actor.vy)).toBeCloseTo(BALL_SPEED, 6);
    expect(actor.vx).toBeLessThan(0);
    births++;
  } });
  expect(births).toBe(1);
  expect(model.grid.specials[index]).toBe(SPECIAL.none);
  expect(model.ballCount(0)).toBe(2);
  while (model.ballCount(0) < MAX_BALLS_PER_TEAM) model.addBall(0);
  expect(() => model.addBall(0)).toThrow("cap");
  const capped = arranged(SPECIAL.split);
  while (capped.model.ballCount(0) < MAX_BALLS_PER_TEAM) {
    const other = capped.model.addBall(0);
    other.vx = other.vy = 0;
  }
  capped.model.step({ ...quiet, birth() { throw new Error("Cap exceeded"); } });
  expect(capped.model.splits).toBe(1);
  expect(capped.model.ballCount(0)).toBe(8);
});

test("Bomb claims only its 3×3 neighborhood and leaves a visible shockwave", () => {
  const { model, index } = arranged(SPECIAL.bomb);
  for (let row = 9; row <= 11; row++) {
    for (let col = 9; col <= 11; col++) model.grid.setOwner(row * 20 + col, 1, 0);
  }
  const wall = index + 1;
  model.grid.setOwner(wall, WALL_OWNER, 0);
  model.grid.specials[wall] = SPECIAL.wall;
  model.step(quiet);
  expect(model.bombs).toBe(1);
  expect(model.flips).toBe(8);
  expect(model.grid.counts).toEqual([399, 0]);
  expect(model.grid.cells[wall]).toBe(WALL_OWNER);
  expect(model.shockwaves).toHaveLength(1);
});

test("from 45s a trailing side receives a neutral mirror pair in its own territory", () => {
  const model = new PongModel(["red", "blue"], new Rng(12));
  model.grid.specials.fill(SPECIAL.none);
  model.grid.cells.fill(0);
  model.grid.cells.fill(1, 0, 100);
  model.grid.counts.splice(0, 2, 300, 100);
  for (const ball of model.balls) ball.vx = ball.vy = 0;
  model.tick = 45 * 60 - 1;
  const before = model.grid.cells.slice();
  model.step(quiet);
  expect(model.comebacks).toHaveLength(1);
  const event = model.comebacks[0];
  expect(event.owner).toBe(1);
  expect(event.tiles).toHaveLength(2);
  for (const tile of event.tiles) {
    expect(before[tile]).toBe(1);
    expect(model.grid.specials[tile]).toBe(SPECIAL.split);
  }
  const [a, b] = event.tiles;
  expect((a % 20 + b % 20 === 19)
    || (Math.floor(a / 20) + Math.floor(b / 20) === 4)).toBe(true);
});
