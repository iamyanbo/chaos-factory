import { PX } from '../../engine/physics';
import { SPEED } from './config';
import type { Fighter } from './types';
import type { GameContext } from '../contract';
import { CENTER } from '../../kit/neon';

/** Resolve the same visible circle analytically when a shrinking wall overlaps. */
export function containAtWall(fighter: Fighter, radius: number, ctx: GameContext): void {
  const point = ctx.physics.position(fighter.body);
  const dx = point.x - CENTER.x;
  const dy = point.y - CENTER.y;
  const distance = Math.hypot(dx, dy);
  const limit = radius - fighter.radius - 4;
  if (distance <= limit || !distance) return;
  const nx = dx / distance;
  const ny = dy / distance;
  ctx.physics.move(fighter.body, CENTER.x + nx * limit, CENTER.y + ny * limit);
  const velocity = fighter.body.linvel();
  const outward = velocity.x * nx + velocity.y * ny;
  if (outward > 0) fighter.body.setLinvel({ x: velocity.x - 2 * outward * nx,
    y: velocity.y - 2 * outward * ny }, true);
  fighter.knockbackLeft = 0;
}

export function normalizeSpeed(fighter: Fighter): void {
  const velocity = fighter.body.linvel();
  const length = Math.hypot(velocity.x, velocity.y) || 1;
  fighter.body.setLinvel({ x: velocity.x / length * SPEED / PX,
    y: velocity.y / length * SPEED / PX }, true);
}

/** Extra travel from the visible weapon impact is bounded, never a teleport. */
export function budgetKnockback(fighter: Fighter, dt: number): void {
  if (!fighter.knockbackLeft) return;
  const velocity = fighter.body.linvel();
  const speed = Math.hypot(velocity.x, velocity.y) * PX;
  const extra = Math.max(0, speed - SPEED);
  const allowed = Math.min(extra, fighter.knockbackLeft / dt);
  if (extra > allowed) {
    const ratio = (SPEED + allowed) / speed;
    fighter.body.setLinvel({ x: velocity.x * ratio, y: velocity.y * ratio }, true);
  }
  fighter.knockbackLeft = Math.max(0, fighter.knockbackLeft - allowed * dt);
}
