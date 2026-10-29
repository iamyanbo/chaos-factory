import type { GameContext } from '../contract';
import { PX, RAPIER } from '../../engine/physics';
import { makeLayout } from './layout';
import { BOTTOM, CENTER, LEFT, PEG_BOUNCE, RACK_LIFT_DISTANCE,
  RACK_LIFT_SPEED, RIGHT, SLOTS, SLOT_TOP, TOP, WALL } from './config';
import type { Peg } from './types';

export class PegBoard {
  readonly pegs: Peg[];
  readonly anchor: RAPIER.RigidBody;
  readonly dividers: RAPIER.RigidBody[] = [];
  private bodies: RAPIER.RigidBody[] = [];
  lift = 0;
  private suddenAt?: number;

  constructor(readonly ctx: GameContext) {
    this.pegs = makeLayout(ctx.rng);
    this.anchor = ctx.physics.box(CENTER.x, CENTER.y, 1, 1,
      { kinematic: true, sensor: true, entity: 'rack' });
    for (const peg of this.pegs) {
      peg.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(peg.radius / PX)
        .setTranslation(peg.localX / PX, peg.localY / PX).setRestitution(PEG_BOUNCE)
        .setFriction(0).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.anchor);
      ctx.physics.colliders.set(peg.collider.handle, `peg:${peg.id}`);
    }
    const wall = (x: number, y: number, width: number, height: number, entity = 'wall') => {
      const body = ctx.physics.box(x, y, width, height,
        { dynamic: false, restitution: .65, friction: 0, entity });
      this.bodies.push(body);
      return body;
    };
    wall(LEFT, (TOP + BOTTOM) / 2, WALL, BOTTOM - TOP);
    wall(RIGHT, (TOP + BOTTOM) / 2, WALL, BOTTOM - TOP);
    wall(CENTER.x, TOP - 18, RIGHT - LEFT, WALL);
    wall(CENTER.x, BOTTOM, RIGHT - LEFT, WALL, 'landing-floor');
    for (const slot of SLOTS.slice(0, -1)) {
      const body = wall(slot.right, (SLOT_TOP + BOTTOM) / 2,
        WALL, BOTTOM - SLOT_TOP, 'slot-wall');
      const cap = ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(WALL / 2 / PX)
        .setTranslation(0, -(BOTTOM - SLOT_TOP) / 2 / PX).setRestitution(.65)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      ctx.physics.colliders.set(cap.handle, 'slot-cap');
      this.dividers.push(body);
    }
  }

  update(time: number): void {
    this.lift = this.suddenAt === undefined ? 0
      : Math.min(RACK_LIFT_DISTANCE, (time - this.suddenAt) * RACK_LIFT_SPEED);
    this.anchor.setNextKinematicTranslation({ x: CENTER.x / PX, y: (CENTER.y - this.lift) / PX });
  }

  sync(): void {
    for (const peg of this.pegs) {
      peg.x = CENTER.x + peg.localX;
      peg.y = CENTER.y + peg.localY - this.lift;
    }
  }

  suddenDeath(time: number): void { this.suddenAt ??= time; }

  clear(life: number): Peg[] {
    const cleared: Peg[] = [];
    for (const peg of this.pegs) {
      if (peg.removed || peg.claim !== life) continue;
      if (peg.collider) {
        this.ctx.physics.colliders.delete(peg.collider.handle);
        this.ctx.physics.world.removeCollider(peg.collider, true);
      }
      peg.collider = undefined;
      peg.removed = true;
      cleared.push(peg);
    }
    return cleared;
  }

  destroy(): void {
    this.ctx.physics.remove(this.anchor);
    for (const body of this.bodies) this.ctx.physics.remove(body);
  }
}
