import type { Graphics } from 'pixi.js';
import { PX, RAPIER } from '../../engine/physics';
import type { GameContext } from '../contract';
import { WHITE, strokeCircle, strokeLine } from '../../kit/neon';
import { drawBody } from './geometry-view';
import { LINE_WIDTH } from './course-layout';
import { MACHINE_COLORS } from './paint';
import { TOY } from '../../kit/theme/toy';
import { MACHINE_LAYOUT } from './course-variants';

interface Machine {
  body: RAPIER.RigidBody;
  kind: 'wheel' | 'seesaw' | 'sweeper';
  x: number;
  y: number;
  width: number;
  phase: number;
  joint?: RAPIER.RevoluteImpulseJoint;
}

/** Compact rotating contacts and genuinely load-responsive jointed decks. */
export class CascadeMachines {
  readonly machines: Machine[] = [];

  constructor(readonly ctx: GameContext, frame: RAPIER.RigidBody) {
    const layout = MACHINE_LAYOUT;
    for (const [x, y, width] of layout.wheels) this.add('wheel', x, y, width);
    for (const [x, y, width] of layout.bridges) {
      const machine = this.add('seesaw', x, y, width);
      const joint = ctx.physics.revolute(frame, machine.body, { x, y }, { x: 0, y: 0 }) as RAPIER.RevoluteImpulseJoint;
      joint.setLimits(-0.8, 0.8);
      joint.configureMotorPosition(0, 4, 0.6);
      machine.body.setAngularDamping(0.35);
      machine.joint = joint;
    }
    for (const [x, y, width] of layout.sweepers) this.add('sweeper', x, y, width);
  }

  private add(kind: Machine['kind'], x: number, y: number, width: number): Machine {
    const body = this.ctx.physics.box(x, y, width, LINE_WIDTH, {
      kinematic: kind !== 'seesaw', density: 0.18, friction: 0.035,
      restitution: 0.4, entity: `cascade-${kind}:${this.machines.length}`
    });
    if (kind === 'wheel') {
      const collider = this.ctx.physics.world.createCollider(RAPIER.ColliderDesc
        .cuboid(LINE_WIDTH / PX / 2, width / PX / 2).setFriction(0.035).setRestitution(0.5)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      this.ctx.physics.colliders.set(collider.handle, `cascade-wheel:${this.machines.length}`);
    }
    const machine = { body, kind, x, y, width, phase: this.ctx.rng.range(0, Math.PI * 2) };
    this.machines.push(machine);
    return machine;
  }

  reset(): void {
    for (const machine of this.machines) {
      machine.body.setEnabled(true);
      machine.body.setTranslation({ x: machine.x / PX, y: machine.y / PX }, true);
      machine.body.setRotation(machine.kind === 'seesaw' ? 0.3 * Math.sin(machine.phase) : 0, true);
      machine.body.setLinvel({ x: 0, y: 0 }, true);
      machine.body.setAngvel(0, true);
    }
  }

  step(age: number): void {
    for (const [index, machine] of this.machines.entries()) {
      machine.body.wakeUp();
      if (machine.kind === 'wheel') {
        machine.body.setNextKinematicRotation(machine.phase + age * (index % 2 ? -0.75 : 0.7));
      } else if (machine.kind === 'seesaw') {
        machine.joint!.configureMotorPosition(Math.sin(age * 0.75 + machine.phase) * 0.6, 4, 0.6);
      } else {
        this.ctx.physics.move(machine.body, machine.x + Math.sin(age * 1.2 + machine.phase) * 35, machine.y);
        machine.body.setNextKinematicRotation(Math.sin(age * 0.7 + machine.phase) * 0.22);
      }
    }
  }

  clear(): void { for (const machine of this.machines) machine.body.setEnabled(false); }

  draw(g: Graphics): void {
    for (const machine of this.machines) {
      if (!machine.body.isEnabled()) continue;
      const position = this.ctx.physics.position(machine.body);
      if (machine.kind === 'sweeper') strokeLine(g, machine.x - 45, machine.y,
        machine.x + 45, machine.y, WHITE, LINE_WIDTH);
      const color = MACHINE_COLORS[machine.kind];
      drawBody(g, machine.body, 0, color);
      if (machine.kind === 'wheel') drawBody(g, machine.body, 1, color);
      g.circle(position.x, position.y, 12).fill(TOY.color.ink);
      strokeCircle(g, position.x, position.y, 7, color, 5);
    }
  }

  inspect() {
    return this.machines.map(machine => ({ kind: machine.kind, handle: machine.body.handle,
      x: this.ctx.physics.position(machine.body).x, y: this.ctx.physics.position(machine.body).y,
      angle: machine.body.rotation(), dynamic: machine.body.isDynamic(), enabled: machine.body.isEnabled() }));
  }
}
