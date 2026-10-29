import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Vec2 } from '@chaos/shared';
let initialization: Promise<void> | undefined;
export function initPhysics(): Promise<void> {
  return initialization ??= RAPIER.init().then(() => {
    // Compile Rapier's first-contact/CCD paths during loading, before animation.
    // This disposable world never touches a game, its RNG or its input log.
    const warmup = new RAPIER.World({ x: 0, y: 0 });
    const events = new RAPIER.EventQueue(true);
    const wall = warmup.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    warmup.createCollider(RAPIER.ColliderDesc.polyline(new Float32Array([
      -10, -10, 10, -10, 10, 10, -10, 10, -10, -10
    ])), wall);
    for (let index = 0; index < 33; index++) {
      const body = warmup.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation((index % 6) - 3, Math.floor(index / 6) - 3)
        .setLinvel(index % 2 ? 3 : -3, index % 3 ? 2 : -2).setCcdEnabled(true));
      warmup.createCollider(RAPIER.ColliderDesc.ball(.5).setRestitution(1)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    }
    for (let tick = 0; tick < 60; tick++) {
      warmup.step(events);
      events.drainCollisionEvents(() => {});
    }
    events.free();
    warmup.free();
  });
}
export { RAPIER };
export const PX = 50;
export interface BodyOptions { dynamic?: boolean; kinematic?: boolean; restitution?: number; friction?: number; density?: number; angle?: number; sensor?: boolean; entity?: string }
export class PhysicsWorld {
  readonly world: RAPIER.World; readonly events = new RAPIER.EventQueue(true);
  readonly entities = new Map<number, string>(); readonly colliders = new Map<number, string>();
  onCollision: (a: string, b: string, started: boolean) => void = () => {};
  constructor(gravity = 9.81, readonly cap = 250) { this.world = new RAPIER.World({ x: 0, y: gravity }); this.world.timestep = 1 / 60; }
  private body(x: number, y: number, shape: RAPIER.ColliderDesc, opts: BodyOptions): RAPIER.RigidBody {
    if (this.entities.size >= this.cap) throw new Error(`Rigid-body cap ${this.cap} exceeded`);
    const desc = opts.kinematic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : opts.dynamic === false ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(x / PX, y / PX).setRotation(opts.angle ?? 0);
    if (opts.dynamic !== false && !opts.kinematic) desc.setLinearDamping(.12).setCcdEnabled(true);
    const b = this.world.createRigidBody(desc);
    const c = this.world.createCollider(shape.setRestitution(opts.restitution ?? .65).setFriction(opts.friction ?? .2).setDensity(opts.density ?? 1).setSensor(opts.sensor ?? false).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), b);
    this.entities.set(b.handle, opts.entity ?? String(b.handle)); this.colliders.set(c.handle, opts.entity ?? String(b.handle)); return b;
  }
  ball(x: number, y: number, radius: number, opts: BodyOptions = {}): RAPIER.RigidBody { return this.body(x, y, RAPIER.ColliderDesc.ball(radius / PX), opts); }
  box(x: number, y: number, w: number, h: number, opts: BodyOptions = {}): RAPIER.RigidBody { return this.body(x, y, RAPIER.ColliderDesc.cuboid(w / PX / 2, h / PX / 2), opts); }
  polygon(x: number, y: number, vertices: number[], opts: BodyOptions = {}): RAPIER.RigidBody { const shape = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices.map(v => v / PX))); if (!shape) throw new Error('Invalid convex polygon'); return this.body(x, y, shape, opts); }
  revolute(a: RAPIER.RigidBody, b: RAPIER.RigidBody, anchorA: Vec2, anchorB: Vec2): RAPIER.ImpulseJoint { const joint = this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: anchorA.x / PX, y: anchorA.y / PX }, { x: anchorB.x / PX, y: anchorB.y / PX }), a, b, true); joint.setContactsEnabled(false); return joint; }
  fixed(a:RAPIER.RigidBody,b:RAPIER.RigidBody,anchorA:Vec2,anchorB:Vec2):RAPIER.ImpulseJoint{const joint=this.world.createImpulseJoint(RAPIER.JointData.fixed({x:anchorA.x/PX,y:anchorA.y/PX},0,{x:anchorB.x/PX,y:anchorB.y/PX},0),a,b,true);joint.setContactsEnabled(false);return joint;}
  spring(a:RAPIER.RigidBody,b:RAPIER.RigidBody,anchorA:Vec2,anchorB:Vec2,stiffness=15):void{const j=this.revolute(a,b,anchorA,anchorB) as RAPIER.RevoluteImpulseJoint;j.setLimits(-.45,.45);j.configureMotorPosition(0,stiffness,3);}
  position(b: RAPIER.RigidBody): Vec2 { const p = b.translation(); return { x: p.x * PX, y: p.y * PX }; }
  radius(b:RAPIER.RigidBody,radius:number):void{b.collider(0).setShape(new RAPIER.Ball(radius/PX));b.recomputeMassPropertiesFromColliders();}
  move(b: RAPIER.RigidBody, x: number, y: number): void { if (b.isKinematic()) b.setNextKinematicTranslation({ x: x / PX, y: y / PX }); else b.setTranslation({ x: x / PX, y: y / PX }, true); }
  remove(b: RAPIER.RigidBody): void { if (!b.isValid()) return; for (let i = 0; i < b.numColliders(); i++) this.colliders.delete(b.collider(i).handle); this.entities.delete(b.handle); this.world.removeRigidBody(b); }
  step(): void { this.world.step(this.events); this.events.drainCollisionEvents((a, b, started) => this.onCollision(this.colliders.get(a) ?? '', this.colliders.get(b) ?? '', started)); }
  destroy(): void { this.entities.clear(); this.colliders.clear(); this.events.free(); this.world.free(); }
}
