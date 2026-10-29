import type { Rng, TeamId } from "@chaos/shared";
import { TerritoryGrid, tileRect } from "./board";
import {
  BALL_RADIUS,
  BALL_SPEED,
  COMEBACK_AT,
  COMEBACK_INTERVAL,
  GRID_SIZE,
  INITIAL_BALLS,
  MAX_BALLS_PER_TEAM,
  REINFORCEMENTS,
  ROUND_SECONDS,
  SPRINT_AT,
  SPRINT_FACTOR,
  SPAWN_ATTEMPTS,
  SPAWN_CLEARANCE_RADII,
  TEAM_COLORS,
  TICK_SECONDS,
  SHOCKWAVE_SECONDS,
  SPLIT_FAN_ANGLE,
} from "./config";
import { moveBall } from "./motion";
import type { MotionHooks, PongBall } from "./types";
import { comebackPair, SPECIAL } from "./specials";

export interface PongHooks extends MotionHooks {
  birth(ball: PongBall, reason?: "split" | "reinforcement"): void;
  sprint(): void;
  special?(kind: "split" | "bomb", ball: PongBall, tile: number): void;
  comeback?(owner: number, tiles: number[]): void;
  territory?(ball: PongBall, from: number, to: number): void;
}

/** The same fixed-step model runs live, in best-take workers and balance tests. */
export class PongModel {
  readonly grid: TerritoryGrid;
  readonly balls: PongBall[] = [];
  tick = 0;
  flips = 0;
  sprinting = false;
  private rng: Rng;
  private comebackRng: Rng;
  readonly shockwaves: { x: number; y: number; color: number; at: number }[] = [];
  readonly comebacks: { at: number; owner: number; tiles: number[] }[] = [];
  splits = 0;
  bombs = 0;

  constructor(readonly teams: TeamId[], rng: Rng) {
    this.rng = rng.fork("pong-motion");
    this.comebackRng = rng.fork("pong-comebacks");
    this.grid = new TerritoryGrid(teams.length, rng.fork("pong-board"));
    for (const ordinal of this.grid.seats) {
      for (let slot = 0; slot < INITIAL_BALLS; slot++) this.addBall(ordinal);
    }
  }

  get time(): number {
    return this.tick * TICK_SECONDS;
  }

  get done(): boolean {
    return this.tick >= ROUND_SECONDS / TICK_SECONDS;
  }

  addBall(ordinal: number): PongBall {
    if (this.ballCount(ordinal) >= MAX_BALLS_PER_TEAM) throw new Error("Pong ball cap reached");
    const team = this.teams[ordinal];
    let available = this.grid.owned(ordinal);
    if (!available.length) available = this.grid.owned(ordinal, true);
    let index = this.rng.pick(available);
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const rect = tileRect(index);
      const clear = this.balls.every((ball) =>
        Math.hypot(ball.x - rect.x - rect.size / 2, ball.y - rect.y - rect.size / 2)
          > BALL_RADIUS * SPAWN_CLEARANCE_RADII);
      if (clear) break;
      index = this.rng.pick(available);
    }
    const rect = tileRect(index);
    const x = rect.x + rect.size / 2;
    const y = rect.y + rect.size / 2;
    const angle = this.rng.range(0, Math.PI * 2);
    const speed = BALL_SPEED * (this.sprinting ? SPRINT_FACTOR : 1);
    const slot = this.balls.filter((ball) => ball.ordinal === ordinal).length;
    const ball: PongBall = {
      id: `pong:${team}:${slot}`,
      name: team.toUpperCase(),
      team,
      ordinal,
      slot,
      x,
      y,
      prevX: x,
      prevY: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: BALL_RADIUS,
      color: TEAM_COLORS[team],
      alive: true,
      isStreamer: false,
      flips: 0,
      trail: [],
      hideName: true,
    };
    this.balls.push(ball);
    return ball;
  }

  step(hooks: PongHooks): void {
    if (this.done) return;
    this.tick++;
    for (const at of REINFORCEMENTS) {
      if (this.tick !== at / TICK_SECONDS) continue;
      for (const ordinal of this.grid.seats) {
        if (this.ballCount(ordinal) < MAX_BALLS_PER_TEAM)
          hooks.birth(this.addBall(ordinal), "reinforcement");
      }
    }
    if (this.time >= COMEBACK_AT && this.time < ROUND_SECONDS && (this.tick - COMEBACK_AT / TICK_SECONDS)
      % (COMEBACK_INTERVAL / TICK_SECONDS) === 0) this.spawnComebacks(hooks);
    if (this.tick === SPRINT_AT / TICK_SECONDS) {
      this.sprinting = true;
      for (const ball of this.balls) {
        ball.vx *= SPRINT_FACTOR;
        ball.vy *= SPRINT_FACTOR;
      }
      hooks.sprint();
    }
    // Rotate contact priority so simultaneous grid flips do not favor array order.
    const actors = this.balls.slice();
    const first = this.tick % actors.length;
    for (let offset = 0; offset < actors.length; offset++) {
      const ball = actors[(first + offset) % actors.length];
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      moveBall(ball, this.grid, TICK_SECONDS, {
        contact: (actor, tile, x, y) => {
          if (tile >= 0) {
            const previous = this.grid.cells[tile];
            if (!this.grid.flip(tile, actor.ordinal, this.time)) {
              hooks.contact(actor, -1, x, y);
              return;
            }
            hooks.territory?.(actor, previous, actor.ordinal);
            const count = this.activate(actor, tile, hooks);
            actor.flips += count;
            this.flips += count;
            hooks.contact(actor, tile, x, y, count);
            return;
          }
          hooks.contact(actor, tile, x, y);
        },
      });
    }
    while (this.shockwaves.length && this.time - this.shockwaves[0].at > SHOCKWAVE_SECONDS)
      this.shockwaves.shift();
  }

  ballCount(ordinal: number): number {
    return this.balls.filter(ball => ball.ordinal === ordinal).length;
  }

  private activate(ball: PongBall, tile: number, hooks: PongHooks): number {
    const special = this.grid.consume(tile);
    let flips = 1;
    if (special === SPECIAL.split) {
      this.splits++;
      if (this.ballCount(ball.ordinal) < MAX_BALLS_PER_TEAM) {
        const newborn = this.addBall(ball.ordinal);
        // The child visibly separates from the striking ball in a 45° fan,
        // rather than appearing elsewhere or firing from inside a tile.
        const turn = (newborn.vx * ball.vy - newborn.vy * ball.vx >= 0 ? 1 : -1) * SPLIT_FAN_ANGLE;
        newborn.x = newborn.prevX = ball.x;
        newborn.y = newborn.prevY = ball.y;
        newborn.vx = ball.vx * Math.cos(turn) - ball.vy * Math.sin(turn);
        newborn.vy = ball.vx * Math.sin(turn) + ball.vy * Math.cos(turn);
        hooks.birth(newborn, "split");
      }
      hooks.special?.("split", ball, tile);
    }
    if (special === SPECIAL.bomb) {
      this.bombs++;
      const col = tile % GRID_SIZE;
      const row = Math.floor(tile / GRID_SIZE);
      for (let y = Math.max(0, row - 1); y <= Math.min(GRID_SIZE - 1, row + 1); y++) {
        for (let x = Math.max(0, col - 1); x <= Math.min(GRID_SIZE - 1, col + 1); x++) {
          const index = y * GRID_SIZE + x;
          const previous = this.grid.cells[index];
          if (this.grid.flip(index, ball.ordinal, this.time)) {
            flips++;
            hooks.territory?.(ball, previous, ball.ordinal);
          }
        }
      }
      const rect = tileRect(tile);
      this.shockwaves.push({ x: rect.x + rect.size / 2, y: rect.y + rect.size / 2,
        color: ball.color, at: this.time });
      hooks.special?.("bomb", ball, tile);
    }
    return flips;
  }

  private spawnComebacks(hooks: PongHooks): void {
    const lowest = Math.min(...this.grid.counts);
    for (const owner of this.grid.seats) {
      if (this.grid.counts[owner] !== lowest) continue;
      const tiles = comebackPair(this.grid, owner, this.comebackRng);
      if (!tiles.length) continue;
      for (const index of tiles) {
        this.grid.specials[index] = SPECIAL.split;
        // A neutral split can be collected by the trailing team's own balls.
        this.grid.setOwner(index, -1, this.time);
      }
      this.comebacks.push({ at: this.time, owner, tiles });
      hooks.comeback?.(owner, tiles);
    }
  }

  leaders(): number[] {
    const highest = Math.max(...this.grid.counts);
    return this.grid.counts.flatMap((count, index) => count === highest ? [index] : []);
  }
}
