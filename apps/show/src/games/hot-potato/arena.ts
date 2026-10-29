import type { GameContext } from '../contract';
import { PX, RAPIER } from '../../engine/physics';
import { ARENA_RADIUS, CENTER, RIM_SEGMENTS, STROKE } from './config';
import type { RimSegment } from './types';

export function segmentDistance(x: number, y: number, segment: RimSegment): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const fraction = Math.max(0, Math.min(1,
    ((x - segment.ax) * dx + (y - segment.ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - segment.ax - dx * fraction, y - segment.ay - dy * fraction);
}

/** Each visible short stroke has its own collider. A blast removes both together. */
export class PotatoArena {
  readonly body: RAPIER.RigidBody;
  readonly segments: RimSegment[] = [];

  constructor(private ctx: GameContext) {
    this.body = ctx.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    ctx.physics.entities.set(this.body.handle, 'potato:rim');
    for (let index = 0; index < RIM_SEGMENTS; index++) {
      const angle = index / RIM_SEGMENTS * Math.PI * 2;
      const next = (index + 1) / RIM_SEGMENTS * Math.PI * 2;
      const ax = CENTER.x + Math.cos(angle) * ARENA_RADIUS;
      const ay = CENTER.y + Math.sin(angle) * ARENA_RADIUS;
      const bx = CENTER.x + Math.cos(next) * ARENA_RADIUS;
      const by = CENTER.y + Math.sin(next) * ARENA_RADIUS;
      const shape = RAPIER.ColliderDesc.segment({ x: ax / PX, y: ay / PX },
        { x: bx / PX, y: by / PX })
        .setContactSkin(STROKE / 2 / PX).setFriction(0).setRestitution(1)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const collider = ctx.physics.world.createCollider(shape, this.body);
      ctx.physics.colliders.set(collider.handle, `rim:${index}`);
      this.segments.push({ ax, ay, bx, by, active: true, collider });
    }
  }

  breakReached(x: number, y: number, radius: number): RimSegment[] {
    const broken: RimSegment[] = [];
    for (const segment of this.segments) {
      if (!segment.active || segmentDistance(x, y, segment) > radius + STROKE / 2) continue;
      segment.active = false;
      this.ctx.physics.colliders.delete(segment.collider.handle);
      this.ctx.physics.world.removeCollider(segment.collider, true);
      broken.push(segment);
    }
    return broken;
  }

  destroy(): void {
    this.ctx.physics.remove(this.body);
  }
}
