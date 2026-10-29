import type { Graphics } from 'pixi.js';
import { PX,RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
export interface Rail {x:number;y:number;w:number;h:number;angle:number;color:number}
export interface Peg {x:number;y:number;r:number;color:number}

/** Compound fixed scenery: one rigid body, with matching drawn collider geometry. */
export class MachineGeometry {
  readonly body:RAPIER.RigidBody;readonly rails:Rail[]=[];readonly pegs:Peg[]=[];
  constructor(readonly ctx:GameContext,kinematic=false){this.body=ctx.physics.box(-10000,-10000,1,1,{dynamic:false,kinematic,entity:'machine-frame'});this.body.setTranslation({x:0,y:0},true);}
  rail(x:number,y:number,w:number,h:number,angle=0,color=0x354968,friction=.35):void{
    const collider=this.ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w/PX/2,h/PX/2).setTranslation(x/PX,y/PX).setRotation(angle).setFriction(friction).setRestitution(.12),this.body);this.ctx.physics.colliders.set(collider.handle,'machine-frame');
    this.rails.push({x,y,w,h,angle,color});
  }
  segment(x1:number,y1:number,x2:number,y2:number,h=14,color=0x354968,friction=.35):void{this.rail((x1+x2)/2,(y1+y2)/2,Math.hypot(x2-x1,y2-y1),h,Math.atan2(y2-y1,x2-x1),color,friction);}
  peg(x:number,y:number,r=9,color=0x6c839e):void{
    const collider=this.ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(r/PX).setTranslation(x/PX,y/PX).setRestitution(.65).setFriction(.05),this.body);this.ctx.physics.colliders.set(collider.handle,'machine-frame');this.pegs.push({x,y,r,color});
  }
  draw(g:Graphics):void{
    const offset=this.ctx.physics.position(this.body);
    for(const r of this.rails){const c=Math.cos(r.angle),s=Math.sin(r.angle);g.poly([-r.w/2,-r.h/2,r.w/2,-r.h/2,r.w/2,r.h/2,-r.w/2,r.h/2].map((v,i,a)=>i%2?offset.y+r.y+a[i-1]*s+v*c:offset.x+r.x+v*c-a[i+1]*s)).fill(r.color).stroke({color:0x05070f,width:4});}
    for(const p of this.pegs)g.circle(p.x+offset.x,p.y+offset.y,p.r).fill(p.color).stroke({color:0x05070f,width:3});
  }
}
