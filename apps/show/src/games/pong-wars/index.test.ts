import { expect, test } from "vitest";
import { Rng, type RoundSetup, type TeamId } from "@chaos/shared";
import { initPhysics } from "../../engine/physics";
import { headlessContext } from "../../engine/headless";
import definition, { PongWars } from "./index";
import { TerritoryGrid, tileRect } from "./board";
import { PongModel, type PongHooks } from "./model";
import { moveBall } from "./motion";
import { BALL_SPEED, SPRINT_FACTOR, TILE_COUNT, ROUND_SECONDS, SPRINT_AT, WALL_OWNER } from "./config";

const TEAMS: TeamId[] = ["red", "blue", "mint", "gold"];
const quiet: PongHooks = { contact() {}, birth() {}, sprint() {} };

function setup(seed: number, count: number, names = 0): RoundSetup {
  const teams = TEAMS.slice(0, count);
  return {
    gameId: definition.id,
    seed,
    mode: "faction",
    format: "faction",
    difficulty: 0.5,
    modifiers: [],
    teams,
    streamerName: "HOST",
    participants: Array.from({ length: names }, (_, i) => ({
      userId: `user${i}`,
      login: `user${i}`,
      displayName: `VIEWER ${i}`,
      color: "#ffffff",
      teamId: teams[i % teams.length],
    })),
  };
}

test("20×20 layouts start with equal claimable territory and permanent neutral walls", () => {
  for (const count of [2, 3, 4]) {
    for (let seed = 1; seed <= 12; seed++) {
      const grid = new TerritoryGrid(count, new Rng(seed));
      expect([...grid.cells]).toHaveLength(TILE_COUNT);
      expect(new Set(grid.counts).size).toBe(1);
      expect([...grid.cells].filter((owner) => owner === WALL_OWNER)).toHaveLength(8);
      expect([...grid.cells].filter((owner) => owner === -1).length)
        .toBe(TILE_COUNT - 8 - grid.counts[0] * count);
      expect(tileRect(0).size).toBe(52);
      expect(tileRect(1).x - tileRect(0).x - tileRect(0).size).toBe(2);
    }
  }
});

test("a ball passes its own tiles, reflects at the rival face and flips only on contact", () => {
  const model = new PongModel(TEAMS.slice(0, 2), new Rng(1));
  model.grid.cells.fill(0);
  model.grid.counts.splice(0, 2, 399, 1);
  const index = 10 * 20 + 10;
  model.grid.cells[index] = 1;
  const rect = tileRect(index);
  const ball = model.balls[0];
  ball.x = rect.x - ball.radius - 4;
  ball.y = rect.y + rect.size / 2;
  ball.vx = BALL_SPEED;
  ball.vy = 0;
  let flips = 0;
  moveBall(ball, model.grid, 1 / 60, {
    contact: (actor, tile) => {
      if (tile < 0) return;
      expect(tile).toBe(index);
      model.grid.flip(tile, actor.ordinal, 0);
      flips++;
    },
  });
  expect(flips).toBe(1);
  expect(ball.vx).toBe(-BALL_SPEED);
  expect(ball.x).toBeCloseTo(rect.x - ball.radius - 1, 4);
  expect(model.grid.counts).toEqual([400, 0]);
  const before = ball.x;
  moveBall(ball, model.grid, 1 / 60, { contact() { throw new Error("Own tile bounced"); } });
  expect(ball.x).toBeCloseTo(before - 5, 4);
});

test("swept corner collisions preserve speed, and white outer walls reflect", () => {
  const model = new PongModel(TEAMS.slice(0, 2), new Rng(2));
  model.grid.cells.fill(0);
  const index = 10 * 20 + 10;
  model.grid.cells[index] = 1;
  const rect = tileRect(index);
  const ball = model.balls[0];
  ball.x = rect.x - 12;
  ball.y = rect.y - 12;
  ball.vx = BALL_SPEED / Math.sqrt(2);
  ball.vy = BALL_SPEED / Math.sqrt(2);
  moveBall(ball, model.grid, 0.05, {
    contact: (actor, tile) => model.grid.flip(tile, actor.ordinal, 0),
  });
  expect(ball.vx).toBeLessThan(0);
  expect(ball.vy).toBeLessThan(0);
  expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL_SPEED, 6);
  ball.x = 440;
  ball.y = 300;
  ball.vx = -BALL_SPEED;
  ball.vy = 0;
  moveBall(ball, model.grid, 1 / 60, { contact() {} });
  expect(ball.vx).toBe(BALL_SPEED);
  expect(ball.x).toBeGreaterThan(440);
});

test("equal scheduled supplies respect fixed ticks and the final sprint starts at 80s", () => {
  for (const count of [2, 3, 4]) {
    const model = new PongModel(TEAMS.slice(0, count), new Rng(3));
    // Isolate the supply clock from contact-earned Split rewards.
    model.grid.specials.fill(0);
    for (const ball of model.balls) ball.vx = ball.vy = 0;
    let births = 0;
    const hooks = { ...quiet, birth(ball: typeof model.balls[number], reason?: string) {
      if (reason === "reinforcement") births++;
      ball.vx = ball.vy = 0;
    } };
    expect(model.balls).toHaveLength(4 * count);
    while (model.tick < 1799) model.step(hooks);
    expect(model.balls).toHaveLength(4 * count);
    model.step(hooks);
    expect(model.time).toBe(30);
    expect(model.balls).toHaveLength(5 * count);
    while (model.tick < 2700) model.step(hooks);
    expect(model.balls.length).toBeGreaterThanOrEqual(6 * count);
    expect(model.balls.length).toBeLessThanOrEqual(8 * count);
    while (model.tick < SPRINT_AT * 60 - 1) model.step(hooks);
    model.balls[0].vx = BALL_SPEED;
    model.balls[0].vy = 0;
    model.step(hooks);
    expect(model.sprinting).toBe(true);
    expect(Math.hypot(model.balls[0].vx, model.balls[0].vy)).toBeCloseTo(BALL_SPEED * SPRINT_FACTOR, 3);
    expect(births).toBe(2 * count);
    while (!model.done) model.step(hooks);
    expect(model.time).toBe(ROUND_SECONDS);
    model.step(hooks);
    expect(model.time).toBe(ROUND_SECONDS);
  }
});

test("roster size and names cannot change physics, and a zero-viewer game finishes", async () => {
  await initPhysics();
  const contexts = [0, 24].map((names) => headlessContext(definition, setup(17, 4, names), () => {}));
  const games = contexts.map((ctx) => new PongWars(ctx));
  try {
    for (const game of games) game.start();
    const seen = new Set(games[1].marbles.map((ball) => ball.name));
    for (let tick = 0; tick < ROUND_SECONDS * 60; tick++) {
      for (const game of games) game.step(1 / 60);
      for (const ball of games[1].marbles) seen.add(ball.name);
    }
    expect(games[0].model.grid.cells).toEqual(games[1].model.grid.cells);
    expect(games[0].marbles.map((ball) => [ball.x, ball.y])).toEqual(
      games[1].marbles.map((ball) => [ball.x, ball.y]));
    expect(seen.size).toBe(24);
    expect(games[0].status()).toHaveProperty("done");
    expect(games[1].inspect().marbles.every((actor) => actor.finished && !actor.dormant)).toBe(true);
    expect(games[0].takeState()).toHaveLength(4);
    expect(games[0].takeState().every((value) => value >= 0 && value <= 6)).toBe(true);
    expect(games[0].onJoin()).toBe(false);
  } finally {
    for (let i = 0; i < games.length; i++) {
      games[i].destroy();
      expect(contexts[i].physics.entities.size).toBe(0);
      contexts[i].physics.destroy();
    }
  }
});

test("all three supported team counts replay identically from a seed", () => {
  for (const count of [2, 3, 4]) {
    const models = [new PongModel(TEAMS.slice(0, count), new Rng(29)),
      new PongModel(TEAMS.slice(0, count), new Rng(29))];
    for (const model of models) while (!model.done) model.step(quiet);
    expect(models[0].grid.cells).toEqual(models[1].grid.cells);
    expect(models[0].balls).toEqual(models[1].balls);
    expect(models[0].leaders()).toEqual(models[1].leaders());
  }
});

test("tied territory is honestly voided, and take scoring has no outcome input", async () => {
  await initPhysics();
  const ctx = headlessContext(definition, setup(1, 2), () => {});
  const game = new PongWars(ctx);
  try {
    game.model.tick = ROUND_SECONDS * 60 - 1;
    game.model.grid.cells.fill(0, 0, 200);
    game.model.grid.cells.fill(1, 200);
    game.model.grid.counts.splice(0, 2, 200, 200);
    for (const ball of game.marbles) {
      ball.x = 600;
      ball.y = ball.ordinal === 0 ? 100 : 800;
      ball.vx = ball.vy = 0;
    }
    game.start();
    game.step(1 / 60);
    expect(game.status()).toMatchObject({ done: { winner: { kind: "void" } } });
    const events = { duration: 60, finished: true, leadChanges: 3, finalCloseness: 0.9, quietMax: 2, passes: 400 };
    expect(definition.scoreTake!(events)).toBe(definition.scoreTake!({ ...events, finished: false }));
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
});
