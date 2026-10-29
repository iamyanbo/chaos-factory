import { ARENA } from "../../kit/neon";
import {
  CONTACT_EPSILON as EPS,
  GRID_SIZE,
  MAX_CONTACTS_PER_STEP,
  TILE_SIZE,
  WALL_SKIN,
} from "./config";
import { tileRect, type TerritoryGrid } from "./board";
import type { Contact, MotionHooks, PongBall } from "./types";

function tileContact(ball: PongBall, index: number, limit: number): Contact | undefined {
  const { x: left, y: top, size } = tileRect(index);
  const right = left + size;
  const bottom = top + size;
  let contact: Contact | undefined;
  const consider = (time: number, nx: number, ny: number) => {
    if (time < -EPS || time > limit + EPS) return;
    if (!contact || time < contact.time - EPS)
      contact = { time: Math.max(0, time), nx, ny, tile: index };
  };
  const nearX = Math.max(left, Math.min(right, ball.x));
  const nearY = Math.max(top, Math.min(bottom, ball.y));
  const dx = ball.x - nearX;
  const dy = ball.y - nearY;
  const distance = Math.hypot(dx, dy);
  if (distance < ball.radius - EPS) {
    if (distance > EPS) consider(0, dx / distance, dy / distance);
    else {
      // A rival can flip a tile while a ball is inside it. The nearest visible
      // edge supplies its contact normal; the tile is reclaimed at contact.
      const faces = [
        { depth: ball.x - left, nx: -1, ny: 0 },
        { depth: right - ball.x, nx: 1, ny: 0 },
        { depth: ball.y - top, nx: 0, ny: -1 },
        { depth: bottom - ball.y, nx: 0, ny: 1 },
      ];
      faces.sort((a, b) => a.depth - b.depth);
      consider(0, faces[0].nx, faces[0].ny);
    }
    return contact;
  }
  if (ball.vx !== 0) {
    const nx = ball.vx > 0 ? -1 : 1;
    const edge = ball.vx > 0 ? left - ball.radius : right + ball.radius;
    const time = (edge - ball.x) / ball.vx;
    const y = ball.y + ball.vy * time;
    if (y >= top - EPS && y <= bottom + EPS) consider(time, nx, 0);
  }
  if (ball.vy !== 0) {
    const ny = ball.vy > 0 ? -1 : 1;
    const edge = ball.vy > 0 ? top - ball.radius : bottom + ball.radius;
    const time = (edge - ball.y) / ball.vy;
    const x = ball.x + ball.vx * time;
    if (x >= left - EPS && x <= right + EPS) consider(time, 0, ny);
  }
  // Rounded Minkowski corners: reflect along the actual circle–corner normal.
  const speedSquared = ball.vx * ball.vx + ball.vy * ball.vy;
  for (const cx of [left, right]) {
    for (const cy of [top, bottom]) {
      const ox = ball.x - cx;
      const oy = ball.y - cy;
      const projection = ox * ball.vx + oy * ball.vy;
      const discriminant = projection * projection - speedSquared *
        (ox * ox + oy * oy - ball.radius * ball.radius);
      if (discriminant < 0 || speedSquared < EPS) continue;
      const time = (-projection - Math.sqrt(discriminant)) / speedSquared;
      const x = ball.x + ball.vx * time;
      const y = ball.y + ball.vy * time;
      const outsideX = cx === left ? x <= left + EPS : x >= right - EPS;
      const outsideY = cy === top ? y <= top + EPS : y >= bottom - EPS;
      if (outsideX && outsideY)
        consider(time, (x - cx) / ball.radius, (y - cy) / ball.radius);
    }
  }
  return contact;
}

function firstContact(ball: PongBall, grid: TerritoryGrid, limit: number): Contact | undefined {
  let best: Contact | undefined;
  const consider = (time: number, nx: number, ny: number) => {
    if (time >= -EPS && time <= limit + EPS && (!best || time < best.time))
      best = { time: Math.max(0, time), nx, ny, tile: -1 };
  };
  const pad = WALL_SKIN + ball.radius;
  if (ball.vx < 0) consider((ARENA.left + pad - ball.x) / ball.vx, 1, 0);
  if (ball.vx > 0) consider((ARENA.right - pad - ball.x) / ball.vx, -1, 0);
  if (ball.vy < 0) consider((ARENA.top + pad - ball.y) / ball.vy, 0, 1);
  if (ball.vy > 0) consider((ARENA.bottom - pad - ball.y) / ball.vy, 0, -1);
  const endX = ball.x + ball.vx * limit;
  const endY = ball.y + ball.vy * limit;
  const minCol = Math.max(0, Math.floor((Math.min(ball.x, endX) - ball.radius - ARENA.left) / TILE_SIZE));
  const maxCol = Math.min(GRID_SIZE - 1, Math.floor((Math.max(ball.x, endX) + ball.radius - ARENA.left) / TILE_SIZE));
  const minRow = Math.max(0, Math.floor((Math.min(ball.y, endY) - ball.radius) / TILE_SIZE));
  const maxRow = Math.min(GRID_SIZE - 1, Math.floor((Math.max(ball.y, endY) + ball.radius) / TILE_SIZE));
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const index = row * GRID_SIZE + col;
      if (grid.cells[index] === ball.ordinal) continue;
      const hit = tileContact(ball, index, best?.time ?? limit);
      if (hit && (!best || hit.time < best.time)) best = hit;
    }
  }
  return best;
}

export function moveBall(ball: PongBall, grid: TerritoryGrid, dt: number, hooks: MotionHooks): void {
  let remaining = dt;
  for (let collision = 0; collision < MAX_CONTACTS_PER_STEP && remaining > EPS; collision++) {
    const hit = firstContact(ball, grid, remaining);
    const travel = hit?.time ?? remaining;
    ball.x += ball.vx * travel;
    ball.y += ball.vy * travel;
    remaining -= travel;
    if (!hit) break;
    const approach = ball.vx * hit.nx + ball.vy * hit.ny;
    if (approach < 0) {
      ball.vx -= 2 * approach * hit.nx;
      ball.vy -= 2 * approach * hit.ny;
    }
    hooks.contact(ball, hit.tile, ball.x - hit.nx * ball.radius, ball.y - hit.ny * ball.radius);
    ball.x += hit.nx * EPS;
    ball.y += hit.ny * EPS;
  }
}
