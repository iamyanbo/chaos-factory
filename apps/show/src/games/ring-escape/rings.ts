import { RAPIER, PX } from '../../engine/physics';
import type { GameContext } from '../contract';
import {
  ARC_SEGMENTS, CENTER, GAP, PULSE_WARNING_SECONDS, RADII, RED_ARC_ANGLES,
  RED_ARC_DIAMETERS, RED_ARC_FIRST_RING, ROTATION, ROTATION_VARIANCE,
  RED_ARC_WARNING_AT, RED_ARC_DEADLY_AT, SECOND_RED_ARC_AT, STAGGER, STROKE,
  GAP_CLEARANCE_DIAMETERS, PASS_GROWTH
} from './config';

const TAU = Math.PI * 2;
const BOTTOM = Math.PI / 2;

export interface Ring {
  body: RAPIER.RigidBody;
  radius: number;
  gap: number;
  baseGap: number;
  angle: number;
  previous: number;
  speed: number;
  flashUntil: number;
  hazards: RedArc[];
  white: WhiteArc[];
}

interface WhiteArc {
  start: number;
  end: number;
  collider: RAPIER.Collider;
}

export interface RedArc {
  start: number;
  end: number;
  warningAt: number;
  deadlyAt: number;
}

export function hazardState(arc: RedArc, time: number): 'hidden' | 'warning' | 'deadly' {
  if (time >= arc.deadlyAt - 0.000001) return 'deadly';
  return time >= arc.warningAt - 0.000001 ? 'warning' : 'hidden';
}

function verticesForArc(radius: number, start: number, end: number): Float32Array {
  const segments = Math.ceil(ARC_SEGMENTS * (end - start) / (TAU - GAP));
  const vertices: number[] = [];
  for (let step = 0; step <= segments; step++) {
    const theta = start + (end - start) * step / segments;
    vertices.push(Math.cos(theta) * radius / PX, Math.sin(theta) * radius / PX);
  }
  return new Float32Array(vertices);
}

function addArc(ctx: GameContext, body: RAPIER.RigidBody, radius: number,
  start: number, end: number, entity: string): RAPIER.Collider {
  const shape = RAPIER.ColliderDesc.polyline(verticesForArc(radius, start, end))
    .setContactSkin(STROKE / 2 / PX)
    .setRestitution(1)
    .setFriction(0)
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = ctx.physics.world.createCollider(shape, body);
  ctx.physics.colliders.set(collider.handle, entity);
  return collider;
}

/** Red and white arcs share their visible centerline, stroke skin and real gaps. */
export function createRings(ctx: GameContext, ballRadius: number): Ring[] {
  const phase = ctx.rng.range(0, TAU);
  return RADII.map((radius, index) => {
    const largestDiameter = ballRadius * 2 * PASS_GROWTH ** (RADII.length - 1);
    const opening = STROKE + largestDiameter * GAP_CLEARANCE_DIAMETERS;
    const gap = Math.min(GAP, 2 * Math.asin(opening / (2 * radius)));
    const angle = phase + STAGGER * index;
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(CENTER.x / PX, CENTER.y / PX)
      .setRotation(angle);
    const body = ctx.physics.world.createRigidBody(desc);
    ctx.physics.entities.set(body.handle, `ring:${index}`);
    // Round caps add one stroke width to the path's visible/contact extent.
    // Include them in the promised one-diameter red section, rather than making
    // a 15 px ball face a 23 px hazard.
    const hazardLength = RED_ARC_DIAMETERS * ballRadius * 2 - STROKE;
    const hazardHalf = hazardLength / (2 * radius);
    const hazards: RedArc[] = index >= RED_ARC_FIRST_RING
      ? RED_ARC_ANGLES.map((center, arc) => ({
        start: center - hazardHalf,
        end: center + hazardHalf,
        warningAt: arc ? SECOND_RED_ARC_AT - (RED_ARC_DEADLY_AT - RED_ARC_WARNING_AT) : RED_ARC_WARNING_AT,
        deadlyAt: arc ? SECOND_RED_ARC_AT : RED_ARC_DEADLY_AT
      })) : [];
    let start = gap / 2;
    const white: WhiteArc[] = [];
    for (const [arc, hazard] of hazards.entries()) {
      white.push({ start, end: hazard.start,
        collider: addArc(ctx, body, radius, start, hazard.start, `ring:${index}`) });
      addArc(ctx, body, radius, hazard.start, hazard.end, `hazard:${index}:${arc}`);
      start = hazard.end;
    }
    white.push({ start, end: TAU - gap / 2,
      collider: addArc(ctx, body, radius, start, TAU - gap / 2, `ring:${index}`) });
    return {
      body, radius, gap, baseGap: gap, angle, previous: angle, flashUntil: 0, hazards, white,
      speed: ROTATION * (index % 2 ? -1 : 1)
        * ctx.rng.range(1 - ROTATION_VARIANCE, 1 + ROTATION_VARIANCE)
    };
  });
}

/** Retract the same two visible stroke ends and their existing collision shapes. */
export function widenGap(ring: Ring, gap: number): void {
  if (gap <= ring.gap + 0.000001) return;
  ring.gap = gap;
  const first = ring.white[0];
  const last = ring.white[ring.white.length - 1];
  first.start = gap / 2;
  last.end = TAU - gap / 2;
  for (const arc of first === last ? [first] : [first, last]) {
    arc.collider.setShape(new RAPIER.Polyline(verticesForArc(ring.radius, arc.start, arc.end)));
  }
}

/** Warn only before the red arc's center next crosses the bottom. */
export function hazardWarning(ring: Ring, arc: RedArc, angle = ring.angle): boolean {
  if (ring.speed === 0) return false;
  const center = angle + (arc.start + arc.end) / 2;
  const forward = (BOTTOM - center) * Math.sign(ring.speed);
  const distance = ((forward % TAU) + TAU) % TAU;
  return distance / Math.abs(ring.speed) <= PULSE_WARNING_SECONDS;
}

export function turnRings(rings: Ring[], dt: number): void {
  for (const ring of rings) {
    ring.previous = ring.angle;
    ring.angle += ring.speed * dt;
    ring.body.setNextKinematicRotation(ring.angle);
  }
}
