import { RAPIER, PX } from "../../engine/physics";
import type { GameContext } from "../../games/contract";
import { CENTER, STROKE } from "./theme";

const WALL_SEGMENTS = 144;

export function circleVertices(radius: number): Float32Array {
  const points: number[] = [];
  for (let index = 0; index <= WALL_SEGMENTS; index++) {
    const angle = (index / WALL_SEGMENTS) * Math.PI * 2;
    points.push(
      (Math.cos(angle) * radius) / PX,
      (Math.sin(angle) * radius) / PX,
    );
  }
  return new Float32Array(points);
}

export function circleWall(ctx: GameContext, radius: number): RAPIER.RigidBody {
  const body = ctx.physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(CENTER.x / PX, CENTER.y / PX),
  );
  const shape = RAPIER.ColliderDesc.polyline(circleVertices(radius))
    .setContactSkin(STROKE / 2 / PX)
    .setRestitution(1)
    .setFriction(0)
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);
  const collider = ctx.physics.world.createCollider(shape, body);
  ctx.physics.entities.set(body.handle, "neon:wall");
  ctx.physics.colliders.set(collider.handle, "neon:wall");
  return body;
}

export function resizeCircleWall(body: RAPIER.RigidBody, radius: number): void {
  body.collider(0).setShape(new RAPIER.Polyline(circleVertices(radius)));
}
