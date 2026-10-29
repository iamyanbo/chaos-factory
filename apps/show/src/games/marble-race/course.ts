import { PX, RAPIER } from '../../engine/physics';
import type { GameContext } from '../contract';
import { BreakthroughGates } from './breakthrough';
import { buildRoutes, type RouteBuilder } from './routes';
import {
  LEFT, RIGHT, MODULE_TOP, MODULE_HEIGHT, MODULE_STOREYS, MODULE_STORY_HEIGHT,
  FINAL_SECTION_TOP, COURSE_BOTTOM,
  RAIL_FRICTION, RAIL_BOUNCE, TRAP_CLOSED, TRAP_PERIOD,
  TRAP_OPEN_SECONDS, TRAP_CLOSE_SECONDS,
  COURSE_OPEN_SECONDS,
} from './config';

export interface Rail { id: string; ax: number; ay: number; bx: number; by: number }
export interface Peg { x: number; y: number; radius: number }
interface RetractingRail { rail: Rail; collider: RAPIER.Collider; bx: number; by: number }
interface RetractingPeg { peg: Peg; collider: RAPIER.Collider; radius: number }
export type ModuleKind = 'zigzag' | 'paddles' | 'breakthrough' | 'seesaw' | 'trapdoor';
export interface Module { kind: ModuleKind; y: number; mirrored: boolean }
export interface Machine {
  kind: 'paddle' | 'seesaw' | 'door';
  body: RAPIER.RigidBody;
  x: number;
  y: number;
  width: number;
  originalWidth: number;
  phase: number;
  direction: number;
  timeOffset: number;
  joint?: RAPIER.RevoluteImpulseJoint;
}

/** Every drawn line is the centerline of an eight-pixel round collider. */
export class RaceCourse {
  readonly rails: Rail[] = [];
  readonly pegs: Peg[] = [];
  readonly machines: Machine[] = [];
  readonly modules: Module[];
  readonly frame: RAPIER.RigidBody;
  readonly breakthrough: BreakthroughGates;
  private ramps: RetractingRail[] = [];
  private pegCaps: RetractingPeg[] = [];
  private openingAt?: number;

  get opening(): boolean { return this.openingAt !== undefined; }

  constructor(private ctx: GameContext) {
    this.frame = ctx.physics.box(0, 0, 1, 1,
      { dynamic: false, entity: 'race-track' });
    this.breakthrough = new BreakthroughGates(ctx, this.frame);
    this.line(LEFT, 24, LEFT, COURSE_BOTTOM, false);
    this.line(RIGHT, 24, RIGHT, COURSE_BOTTOM, false);
    this.line(LEFT, COURSE_BOTTOM, RIGHT, COURSE_BOTTOM, false);
    this.line(LEFT, 180, 825, 440);
    this.line(RIGHT, 180, 1095, 440);
    const order = ctx.rng.shuffle<ModuleKind>(['zigzag', 'paddles', 'breakthrough', 'seesaw', 'trapdoor']);
    this.modules = order.map((kind, index) => ({
      kind, y: MODULE_TOP + index * MODULE_HEIGHT,
      mirrored: ctx.rng.chance(0.5)
    }));
    for (const module of this.modules) this.build(module);
    this.line(LEFT, FINAL_SECTION_TOP + 120, 810, FINAL_SECTION_TOP + 320);
    this.line(RIGHT, FINAL_SECTION_TOP + 120, 1110, FINAL_SECTION_TOP + 320);
    this.step(0);
  }

  private line(ax: number, ay: number, bx: number, by: number, retractable = true): void {
    const rail = { id: `race-rail:${this.rails.length}`, ax, ay, bx, by };
    this.rails.push(rail);
    const length = Math.hypot(bx - ax, by - ay);
    const collider = this.ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(length / PX / 2, 4 / PX)
        .setTranslation((ax + bx) / PX / 2, (ay + by) / PX / 2)
        .setRotation(Math.atan2(by - ay, bx - ax) - Math.PI / 2)
        .setFriction(RAIL_FRICTION).setRestitution(RAIL_BOUNCE)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.frame);
    this.ctx.physics.colliders.set(collider.handle, rail.id);
    if (retractable) this.ramps.push({ rail, collider, bx, by });
  }

  private peg(x: number, y: number, radius = 10): void {
    const peg = { x, y, radius };
    this.pegs.push(peg);
    const collider = this.ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.ball(radius / PX).setTranslation(x / PX, y / PX)
        .setFriction(0.02).setRestitution(0.62)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.frame);
    this.ctx.physics.colliders.set(collider.handle, 'race-peg');
    this.pegCaps.push({ peg, collider, radius });
  }

  private machine(kind: Machine['kind'], x: number, y: number,
    width: number, direction = 1, timeOffset = 0): Machine {
    const body = this.ctx.physics.box(x, y, width, 8, {
      kinematic: kind !== 'seesaw', density: 0.25,
      restitution: 0.4, friction: 0.06, entity: `race-${kind}`
    });
    const machine: Machine = {
      kind, body, x, y, width, originalWidth: width, direction, timeOffset,
      phase: this.ctx.rng.range(-0.3, 0.3)
    };
    if (kind === 'paddle') {
      const collider = this.ctx.physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(4 / PX, width / PX / 2)
          .setRestitution(0.4).setFriction(0.06)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      this.ctx.physics.colliders.set(collider.handle, 'race-paddle');
    }
    if (kind === 'seesaw') {
      const joint = this.ctx.physics.revolute(this.frame, body,
        { x, y }, { x: 0, y: 0 }) as RAPIER.RevoluteImpulseJoint;
      joint.setLimits(-0.45, 0.45);
      joint.configureMotorPosition(0, 0.7, 0.2);
      body.setAngularDamping(0.4);
      body.setRotation(machine.phase, true);
      machine.joint = joint;
    }
    this.machines.push(machine);
    return machine;
  }

  private build(module: Module): void {
    const builder: RouteBuilder = {
      line: this.line.bind(this),
      peg: this.peg.bind(this),
      machine: this.machine.bind(this),
      gate: this.breakthrough.add.bind(this.breakthrough),
    };
    for (let storey = 0; storey < MODULE_STOREYS; storey++) {
      buildRoutes(builder, {
        ...module,
        y: module.y + storey * MODULE_STORY_HEIGHT,
        mirrored: storey % 2 === 0 ? module.mirrored : !module.mirrored,
      }, storey * TRAP_PERIOD / 2);
    }
  }

  trapRemaining(time: number, timeOffset = 0): number {
    if (this.opening) return 0;
    return Math.max(0, TRAP_CLOSED - (time + timeOffset) % TRAP_PERIOD);
  }

  open(time: number): void {
    this.openingAt ??= time;
    this.breakthrough.open(time);
  }

  private retract(time: number): void {
    const remaining = Math.max(0, 1 - (time - this.openingAt!) / COURSE_OPEN_SECONDS);
    for (const support of this.ramps) {
      const { rail, collider, bx, by } = support;
      rail.bx = rail.ax + (bx - rail.ax) * remaining;
      rail.by = rail.ay + (by - rail.ay) * remaining;
      if (!collider.isValid()) continue;
      if (remaining === 0) this.removeCollider(collider);
      else {
        collider.setShape(new RAPIER.Capsule(Math.hypot(rail.bx - rail.ax, rail.by - rail.ay) / PX / 2, 4 / PX));
        collider.setTranslationWrtParent({ x: (rail.ax + rail.bx) / PX / 2, y: (rail.ay + rail.by) / PX / 2 });
      }
    }
    for (const { peg, collider, radius } of this.pegCaps) {
      peg.radius = radius * remaining;
      if (!collider.isValid()) continue;
      if (remaining === 0) this.removeCollider(collider);
      else collider.setShape(new RAPIER.Ball(peg.radius / PX));
    }
    for (const machine of this.machines) {
      const { body, originalWidth } = machine;
      machine.width = originalWidth * remaining;
      if (!body.isValid()) continue;
      if (remaining === 0) this.ctx.physics.remove(body);
      else {
        body.collider(0).setShape(new RAPIER.Cuboid(machine.width / PX / 2, 4 / PX));
        if (machine.kind === 'paddle') body.collider(1).setShape(new RAPIER.Cuboid(4 / PX, machine.width / PX / 2));
      }
    }
  }

  private removeCollider(collider: RAPIER.Collider): void {
    this.ctx.physics.colliders.delete(collider.handle);
    this.ctx.physics.world.removeCollider(collider, true);
  }

  step(time: number): void {
    if (this.opening) this.retract(time);
    for (const machine of this.machines) {
      const { body, kind, x, y, width, direction } = machine;
      if (!body.isValid()) continue;
      body.wakeUp();
      if (kind === 'paddle') {
        body.setNextKinematicRotation(machine.phase + time * 0.72 * direction);
      } else if (kind === 'seesaw') {
        machine.joint!.configureMotorPosition(Math.sin(time * 0.45 + machine.phase) * 0.27, 0.7, 0.2);
      } else {
        const phase = (time + machine.timeOffset) % TRAP_PERIOD;
        const opening = phase < TRAP_CLOSED ? 0
          : Math.min(1, (phase - TRAP_CLOSED) / TRAP_OPEN_SECONDS,
            (TRAP_PERIOD - phase) / TRAP_CLOSE_SECONDS);
        const angle = -direction * opening * Math.PI / 2;
        this.ctx.physics.move(body,
          x - direction * Math.cos(angle) * width / 2,
          y - direction * Math.sin(angle) * width / 2);
        body.setNextKinematicRotation(angle);
      }
    }
  }

  destroy(): void {
    for (const machine of this.machines) this.ctx.physics.remove(machine.body);
    this.ctx.physics.remove(this.frame);
  }
}
