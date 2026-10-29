import type { Graphics } from 'pixi.js';
import { PX,RAPIER } from '../engine/physics';

/** Draw the actual collider, including its rotation, so scenery cannot hide collision geometry. */
export function drawBody(g:Graphics,body:RAPIER.RigidBody,color:number):void{
  if(!body.isValid())return;const p=body.translation(),x=p.x*PX,y=p.y*PX,shape=body.collider(0).shape;
  if(shape.type===RAPIER.ShapeType.Ball){g.circle(x,y,(shape as RAPIER.Ball).radius*PX).fill(color).stroke({color:0x05070f,width:4});return;}
  if(shape.type!==RAPIER.ShapeType.Cuboid)return;const h=(shape as RAPIER.Cuboid).halfExtents,w=h.x*PX,height=h.y*PX,a=body.rotation(),c=Math.cos(a),s=Math.sin(a);
  g.poly([-w,-height,w,-height,w,height,-w,height].map((v,i,points)=>i%2?y+points[i-1]*s+v*c:x+v*c-points[i+1]*s)).fill(color).stroke({color:0x05070f,width:4});
}
