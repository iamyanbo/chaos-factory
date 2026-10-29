import type { Graphics } from 'pixi.js';
import type { TeamId } from '@chaos/shared';
import { PX, RAPIER } from '../../engine/physics';
import type { GameContext } from '../contract';
import { MachineGeometry } from '../../kit/machine-geometry';
import { WHITE } from '../../kit/neon';
import { CascadeMachines } from './course-machines';
import { drawBody, drawGeometry } from './geometry-view';
import { drawCascadePorts } from './paint';
import { TOY } from '../../kit/theme/toy';
import { buildScenery } from './course-variants';
import {
  COURSE, GATE_Y, SHELF_Y, RELEASE_AT, FACTORS, CLEAR_AT, LINE_WIDTH,
  HATCH_Y, HATCH_PANEL_WIDTH, SHELF_PANELS, FLAP_RETRACT_SECONDS, PORTS,
  GATE_SWING_SECONDS, HATCH_SWING_SECONDS,
} from './course-layout';
export { COURSE, GATE_Y, SHELF_Y, RELEASE_AT, FACTORS, BALL_RADIUS } from './course-layout';

const BYPASS_SECONDS = .15;

interface Door {
  body: RAPIER.RigidBody;
  anchorX: number;
  y: number;
  side: number;
  length: number;
}

/** A compact shared shaft with physical holding flaps and scoring pockets. */
export class CascadeBoard {
  readonly pulses = GATE_Y.map(() => -Infinity);
  readonly frame: MachineGeometry;
  scenery: MachineGeometry;
  machinery: CascadeMachines;
  readonly doors: Door[][] = [];
  readonly hatch: Door[];
  private wave = 1;
  private age = 0;
  private bypassUntil = GATE_Y.map(() => -Infinity);
  private cleared = false;

  constructor(readonly ctx: GameContext, readonly teams: TeamId[]) {
    this.frame = new MachineGeometry(ctx);
    this.scenery = new MachineGeometry(ctx);
    const b = this.bay();
    const height = COURSE.bottom - COURSE.top;
    this.frame.rail(b.left - LINE_WIDTH / 2, COURSE.top + height / 2, LINE_WIDTH, height);
    this.frame.rail(b.right + LINE_WIDTH / 2, COURSE.top + height / 2, LINE_WIDTH, height);
    this.frame.rail(b.x, COURSE.bottom, b.w, LINE_WIDTH);
    this.machinery = new CascadeMachines(ctx, this.frame.body);
    for (const y of SHELF_Y) this.doors.push(this.door(y));
    const feeders = teams.length * (teams.length > 4 ? 2 : 3);
    this.hatch = this.door(HATCH_Y, feeders, HATCH_PANEL_WIDTH);
    for (let slot = 0; slot < 3; slot++) {
      const x = b.left + b.w * (slot + 0.5) / 3;
      const sensor = ctx.physics.world.createCollider(RAPIER.ColliderDesc
        .cuboid((b.w / 3 - 20) / PX / 2, 12 / PX)
        .setTranslation(x / PX, COURSE.bankY / PX).setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.frame.body);
      ctx.physics.colliders.set(sensor.handle, `cascade-pocket:${slot}`);
      if (slot) this.frame.rail(b.left + b.w * slot / 3,
        COURSE.bankY + 20, LINE_WIDTH, 40, 0, WHITE, 0);
    }
  }

  bay(_seat?: number) {
    return { x: 960, w: COURSE.right - COURSE.left, left: COURSE.left, right: COURSE.right };
  }

  private door(y: number, count = SHELF_PANELS, panelWidth?: number): Door[] {
    const b = this.bay();
    return Array.from({ length: count }, (_, index) => {
      const side = index % 2 ? 1 : -1;
      const length = panelWidth ?? b.w / count;
      const center = b.left + (index + 0.5) * b.w / count;
      const anchorX = center + side * length / 2;
      const body = this.ctx.physics.box(center, y, length, LINE_WIDTH, {
        kinematic: true, entity: `cascade-door:${y}:${side}`, friction: 0.035, restitution: 0.2
      });
      return { body, anchorX, y, side, length };
    });
  }

  multiplier(_seat: number, stage: number, x: number): number {
    const b = this.bay();
    const u = (x - b.left) / b.w;
    const q = this.mirrored(stage) ? 1 - u : u;
    const port = PORTS.find(port => q < port.start + port.width) ?? PORTS[PORTS.length - 1];
    return port.multiply ? this.factor(stage) : port.factor;
  }

  factor(stage: number): number {
    return this.age < this.bypassUntil[stage] ? 1 : FACTORS[stage];
  }

  bypass(stage: number, age: number): void {
    this.bypassUntil[stage] = age + BYPASS_SECONDS;
  }

  mirrored(stage: number): boolean { return (this.wave + stage) % 2 === 0; }
  pocketValue(slot: number): number { return [[1, 5, 20], [20, 1, 5], [5, 20, 1]][this.wave - 1][slot]; }

  reset(wave: number): void {
    this.pulses.fill(-Infinity);
    this.bypassUntil.fill(-Infinity);
    this.age = 0;
    this.wave = wave;
    this.cleared = false;
    this.ctx.physics.remove(this.scenery.body);
    this.scenery = new MachineGeometry(this.ctx);
    buildScenery(this.scenery);
    this.machinery.reset();
    for (const row of [...this.doors, this.hatch]) {
      for (const door of row) {
        door.body.setEnabled(true);
        door.body.collider(0).setShape(new RAPIER.Cuboid(door.length / PX / 2, LINE_WIDTH / PX / 2));
        door.body.setTranslation({ x: (door.anchorX - door.side * door.length / 2) / PX, y: door.y / PX }, true);
        door.body.setRotation(0, true);
      }
    }
    this.step(0);
  }

  step(age: number): void {
    this.age = age;
    if (age >= CLEAR_AT && !this.cleared) {
      this.cleared = true;
      this.scenery.body.setEnabled(false);
      this.machinery.clear();
    }
    if (!this.cleared) this.machinery.step(age);
    for (const [index, row] of [...this.doors, this.hatch].entries()) {
      const hatch = index === this.doors.length;
      const release = hatch ? 1.2 : RELEASE_AT[index];
      const swingSeconds = hatch ? HATCH_SWING_SECONDS : GATE_SWING_SECONDS;
      const opening = Math.max(0, Math.min(1, (age - release) / swingSeconds));
      const retraction = Math.max(0, Math.min(1,
        (age - release - swingSeconds) / FLAP_RETRACT_SECONDS));
      for (const door of row) {
        if (retraction >= 1) {
          door.body.setEnabled(false);
          continue;
        }
        const length = door.length * (1 - retraction);
        if (retraction > 0) {
          door.body.collider(0).setShape(new RAPIER.Cuboid(length / PX / 2, LINE_WIDTH / PX / 2));
        }
        door.body.wakeUp();
        const angle = -door.side * opening * Math.PI / 2;
        this.ctx.physics.move(door.body,
          door.anchorX - door.side * Math.cos(angle) * length / 2,
          door.y - door.side * Math.sin(angle) * length / 2);
        door.body.setNextKinematicRotation(angle);
      }
    }
  }

  draw(g: Graphics, age = 0): void {
    drawGeometry(g, this.frame);
    if (!this.cleared) drawGeometry(g, this.scenery, TOY.color.white);
    this.machinery.draw(g);
    drawCascadePorts(g, this, age);
    const colors = [TOY.color.accentA, TOY.color.green, TOY.color.yellow, TOY.color.white];
    for (const [index, row] of [...this.doors, this.hatch].entries()) {
      for (const door of row) drawBody(g, door.body, 0, colors[index % colors.length]);
    }
  }

  retire(): void {
    this.frame.body.setEnabled(false);
    this.scenery.body.setEnabled(false);
    this.machinery.clear();
    for (const row of [...this.doors, this.hatch]) for (const door of row) door.body.setEnabled(false);
  }
}
