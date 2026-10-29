import type { TeamId } from '@chaos/shared';
import type { GameContext } from '../contract';
import type { Marble } from '../../kit/marble';
import type { CascadeBoard } from './board';
import type { Unit } from './types';
import { PX, RAPIER } from '../../engine/physics';
import { BALL_RADIUS, GATE_Y } from './course-layout';

const CHILD_CLEARANCE = 1;
const CHILD_HORIZONTAL_SPEED = 0.7;
const CHILD_SPEED_VARIANCE = 0.12;
const MIN_CHILD_FALL_SPEED = 0.2;
const EMISSION_ROWS = [36, 72];
const EMISSION_STEPS = [0, -1, 1, -2, 2, -3, 3, -4, 4];
interface Exit { x: number; y: number }

export function prepareUnit(marble: Marble, stage: number, root: string,
  vx: number, vy: number, lineage: number): Unit {
  marble.view?.destroy();
  marble.view = undefined;
  marble.body.collider(0).setRestitution(0.38);
  marble.body.collider(0).setFriction(0.012);
  marble.body.setLinearDamping(0.025);
  marble.body.setLinvel({ x: vx, y: vy }, true);
  return { marble, stage, root, lineage };
}

type Spawn = (team: TeamId, x: number, y: number, stage: number,
  root: string, vx: number, vy: number, lineage?: number) => Marble;

/** Reserve the entire split beside its parent, or do not multiply this crossing.
 * Nothing is queued, counted early, or emitted later from an empty gate. */
export function planChildren(ctx: GameContext, board: CascadeBoard, parent: Unit,
  count: number, units: ReadonlyMap<string, Unit>): Exit[] | undefined {
  if (ctx.physics.entities.size + count > ctx.physics.cap) return undefined;
  const bay = board.bay();
  const gate = GATE_Y[parent.stage];
  const exits: Exit[] = [];
  const spacing = BALL_RADIUS * 2 + CHILD_CLEARANCE;
  const shape = new RAPIER.Ball((BALL_RADIUS + CHILD_CLEARANCE) / PX);
  for (const offset of EMISSION_ROWS) {
    for (const step of EMISSION_STEPS) {
      const slot = { x: parent.marble.x + step * spacing, y: gate + offset };
      if (slot.x < bay.left + spacing || slot.x > bay.right - spacing) continue;
      if (board.multiplier(0, parent.stage, slot.x - BALL_RADIUS) <= 1
        || board.multiplier(0, parent.stage, slot.x + BALL_RADIUS) <= 1) continue;
      if (exits.some(exit => Math.hypot(exit.x - slot.x, exit.y - slot.y) < spacing)) continue;
      let occupied = false;
      // Rapier's spatial index is refreshed by world.step. Include clones created
      // by earlier parents in this very tick, before querying the static geometry.
      for (const unit of units.values()) {
        const dx = unit.marble.x - slot.x;
        const dy = unit.marble.y - slot.y;
        if (dx * dx + dy * dy >= spacing * spacing) continue;
        occupied = true;
        break;
      }
      if (occupied) continue;
      ctx.physics.world.intersectionsWithShape({ x: slot.x / PX, y: slot.y / PX }, 0, shape, collider => {
        if (!collider.isSensor()) occupied = true;
        return !occupied;
      });
      if (occupied) continue;
      exits.push(slot);
      if (exits.length === count) return exits;
    }
  }
  return undefined;
}

export function cloneChildren(ctx: GameContext, parent: Unit, exits: Exit[],
  spawn: Spawn, onBirth: (marble: Marble) => void): void {
  const velocity = parent.marble.body.linvel();
  for (const exit of exits) {
    const marble = spawn(parent.marble.team as TeamId, exit.x, exit.y, parent.stage, parent.root,
      velocity.x * CHILD_HORIZONTAL_SPEED + ctx.rng.range(-CHILD_SPEED_VARIANCE, CHILD_SPEED_VARIANCE),
      Math.max(MIN_CHILD_FALL_SPEED, velocity.y), parent.lineage);
    onBirth(marble);
  }
}

export function collisionHandler(units: Map<string, Unit>,
  contacts: { wheel: number; seesaw: number; sweeper: number; marble: number },
  pocket: (id: string, slot: number) => void, impact: (marble: Marble) => void) {
  return (a: string, b: string, started: boolean): void => {
    if (!started) return;
    const id = units.has(a) ? a : units.has(b) ? b : undefined;
    const other = id === a ? b : a;
    if (!id) return;
    if (units.has(other) && units.get(id)!.marble.team !== units.get(other)!.marble.team) contacts.marble++;
    if (other.startsWith('cascade-pocket:')) pocket(id, Number(other.split(':')[1]));
    else impact(units.get(id)!.marble);
    for (const kind of ['wheel', 'seesaw', 'sweeper'] as const) {
      if (!other.startsWith(`cascade-${kind}:`)) continue;
      contacts[kind]++;
    }
  };
}
