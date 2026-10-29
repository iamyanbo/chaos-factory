import type { Graphics } from 'pixi.js';
import type { GameContext } from '../contract';
import { PX, RAPIER } from '../../engine/physics';
import { WHITE, strokeLine } from '../../kit/neon';
import { TOY } from '../../kit/theme/toy';

export const GATE_HITS = 3;
export const GATE_WIDTH = 224;
export const GATE_THICKNESS = 12;
const GATE_COLOR = TOY.color.yellow;
const DEBRIS_SECONDS = 1.1;

export interface CrackedGate {
  id: string;
  x: number;
  y: number;
  damage: number;
  brokenAt?: number;
  collider: RAPIER.Collider;
}

/** A gate only cracks on a new, physical marble contact. No timer damage. */
export class BreakthroughGates {
  readonly gates: CrackedGate[] = [];
  constructor(private ctx: GameContext, private frame: RAPIER.RigidBody) {}

  add(x: number, y: number): void {
    const id = `race-breakthrough:${this.gates.length}`;
    const collider = this.ctx.physics.world.createCollider(RAPIER.ColliderDesc
      .cuboid(GATE_WIDTH / PX / 2, GATE_THICKNESS / PX / 2)
      .setTranslation(x / PX, y / PX).setFriction(.02).setRestitution(.9)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.frame);
    this.ctx.physics.colliders.set(collider.handle, id);
    this.gates.push({ id, x, y, damage: 0, collider });
  }

  hit(entity: string, time: number): CrackedGate | undefined {
    const gate = this.gates.find(value => value.id === entity);
    if (!gate || gate.brokenAt !== undefined) return;
    gate.damage++;
    if (gate.damage === GATE_HITS) this.remove(gate, time);
    return gate;
  }

  private remove(gate: CrackedGate, time: number): void {
    gate.brokenAt = time;
    if (!gate.collider.isValid()) return;
    this.ctx.physics.colliders.delete(gate.collider.handle);
    this.ctx.physics.world.removeCollider(gate.collider, true);
  }

  open(time: number): void {
    for (const gate of this.gates) if (gate.brokenAt === undefined) this.remove(gate, time);
  }

  draw(g: Graphics, time: number): void {
    for (const gate of this.gates) {
      if (gate.brokenAt !== undefined) {
        const age = time - gate.brokenAt;
        if (age > DEBRIS_SECONDS) continue;
        for (let shard = 0; shard < 8; shard++) {
          const side = shard < 4 ? -1 : 1;
          const x = gate.x + (shard - 3.5) * 28 + side * age * 55;
          const y = gate.y - Math.sin(shard * 2) * age * 80 + age * age * 120;
          g.rect(x, y, 7, 3).fill({ color: GATE_COLOR, alpha: 1 - age / DEBRIS_SECONDS });
        }
        continue;
      }
      strokeLine(g, gate.x - GATE_WIDTH / 2, gate.y, gate.x + GATE_WIDTH / 2, gate.y,
        GATE_COLOR, GATE_THICKNESS);
      for (let crack = 0; crack < gate.damage; crack++) {
        const x = gate.x + (crack - .5) * 66;
        g.moveTo(x - 5, gate.y - 8).lineTo(x + 3, gate.y - 2)
          .lineTo(x - 3, gate.y + 3).lineTo(x + 5, gate.y + 8)
          .stroke({ color: TOY.color.ink, width: TOY.wall.outline });
      }
    }
  }
}
