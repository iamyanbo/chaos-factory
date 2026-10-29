import type { Graphics } from 'pixi.js';
import { PX, RAPIER } from '../../engine/physics';
import type { MachineGeometry } from '../../kit/machine-geometry';
import { WHITE, strokeLine } from '../../kit/neon';
import { LINE_WIDTH } from './course-layout';
import { block, peg } from '../../kit/theme';

function rectangle(g: Graphics, x: number, y: number, w: number, h: number, angle: number, color: number): void {
  if (Math.min(w, h) <= LINE_WIDTH + 0.001) {
    const thickness = Math.min(LINE_WIDTH, w, h);
    const direction = angle + (w < h ? Math.PI / 2 : 0);
    const half = Math.max(0, Math.max(w, h) - thickness) / 2;
    strokeLine(g, x - Math.cos(direction) * half, y - Math.sin(direction) * half,
      x + Math.cos(direction) * half, y + Math.sin(direction) * half, color, thickness);
    return;
  }
  block(g, { x: x - w / 2, y: y - h / 2, width: w, height: h }, color, angle);
}

/** Draw actual world dimensions; the camera never scales the machine. */
export function drawBody(g: Graphics, body: RAPIER.RigidBody, colliderIndex = 0, color = WHITE): void {
  if (!body.isEnabled()) return;
  const position = body.translation();
  const shape = body.collider(colliderIndex).shape;
  if (shape.type !== RAPIER.ShapeType.Cuboid) return;
  const half = (shape as RAPIER.Cuboid).halfExtents;
  rectangle(g, position.x * PX, position.y * PX, half.x * PX * 2, half.y * PX * 2, body.rotation(), color);
}

export function drawGeometry(g: Graphics, geometry: MachineGeometry, color = WHITE): void {
  const offset = geometry.ctx.physics.position(geometry.body);
  for (const rail of geometry.rails) {
    rectangle(g, rail.x + offset.x, rail.y + offset.y, rail.w, rail.h, rail.angle, color);
  }
  for (const point of geometry.pegs) {
    peg(g, point.x + offset.x, point.y + offset.y, point.r, color);
  }
}
