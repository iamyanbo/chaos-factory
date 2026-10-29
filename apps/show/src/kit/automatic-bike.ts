import type { Graphics } from 'pixi.js';
import { PX,RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import type { Marble } from './marble';
import { teamIcon } from './team-icon';
export class AutomaticBike {
  readonly wheels:RAPIER.RigidBody[]=[];readonly carriers:RAPIER.RigidBody[]=[];readonly motors:RAPIER.RevoluteImpulseJoint[]=[];readonly head:RAPIER.RigidBody;
  crashAt=0;
  constructor(readonly ctx:GameContext,readonly marble:Marble,slot:number){
    const m=marble;m.customView=true;m.radius=26;const frame=m.body;frame.collider(0).setShape(new RAPIER.Cuboid(.4,.09));frame.collider(0).setDensity(.45);frame.setLinearDamping(.02);frame.setAngularDamping(.1);
    for(const side of[-1,1]){
      const x=m.x+side*19,y=m.y+13;
      const carrier=ctx.physics.ball(x,y,2,{sensor:true,density:.01,entity:`suspension:${m.id}:${side}`});this.carriers.push(carrier);
      const spring=ctx.physics.world.createImpulseJoint(RAPIER.JointData.prismatic({x:side*19/PX,y:13/PX},{x:0,y:0},{x:0,y:1}),frame,carrier,true) as RAPIER.PrismaticImpulseJoint;
      spring.setContactsEnabled(false);spring.setLimits(-.07,.09);spring.configureMotorPosition(0,80,2);
      const wheel=ctx.physics.ball(x,y,14,{density:1.4,friction:2,restitution:.05,entity:`wheel:${m.id}:${side}`});wheel.setLinearDamping(.015);this.wheels.push(wheel);
      const motor=ctx.physics.revolute(carrier,wheel,{x:0,y:0},{x:0,y:0}) as RAPIER.RevoluteImpulseJoint;motor.setMotorMaxForce(.24);this.motors.push(motor);
    }
    this.head=ctx.physics.ball(m.x,m.y-24,8,{density:.12,restitution:.05,entity:`rider:${m.id}`});
    const neck=ctx.physics.revolute(frame,this.head,{x:0,y:-10},{x:0,y:14}) as RAPIER.RevoluteImpulseJoint;neck.setLimits(-.35,.35);neck.configureMotorPosition(0,1,.1);
    // Sixteen distinct memberships prevent a bike's wheels intersecting its own
    // chassis while preserving all contacts with other bikes and the terrain.
    const bit=1<<slot,groups=((bit<<16)|(0xffff^bit))>>>0;
    for(const body of[frame,...this.wheels,...this.carriers,this.head])body.collider(0).setCollisionGroups(groups);
  }
  drive():void{for(const b of[this.marble.body,...this.carriers,...this.wheels,this.head])b.wakeUp();for(const motor of this.motors)motor.configureMotorVelocity(17,1);}
  stop():void{for(const motor of this.motors)if(motor.isValid())motor.configureMotorVelocity(0,0);}
  draw(g:Graphics):void{
    if(!this.marble.alive)return;const m=this.marble,frame=m.body.translation(),a=m.body.rotation(),x=frame.x*PX,y=frame.y*PX;
    const point=(dx:number,dy:number)=>({x:x+Math.cos(a)*dx-Math.sin(a)*dy,y:y+Math.sin(a)*dx+Math.cos(a)*dy});
    const left=this.ctx.physics.position(this.wheels[0]),right=this.ctx.physics.position(this.wheels[1]),seat=point(0,-8),head=this.ctx.physics.position(this.head);
    for(const[i,w]of this.wheels.entries()){const p=i?right:left;g.circle(p.x,p.y,14).fill(0x090d18).stroke({color:0xd0d8e9,width:4});g.moveTo(p.x,p.y).lineTo(p.x+Math.cos(w.rotation())*12,p.y+Math.sin(w.rotation())*12).stroke({color:m.color,width:3});}
    g.poly([left.x,left.y,seat.x,seat.y,right.x,right.y,left.x,left.y]).stroke({color:0x05070f,width:8});g.poly([left.x,left.y,seat.x,seat.y,right.x,right.y,left.x,left.y]).stroke({color:m.color,width:5});
    g.moveTo(seat.x,seat.y).lineTo(head.x,head.y+7).stroke({color:0xffd23f,width:6});g.circle(head.x,head.y,8).fill(m.color).stroke({color:0x05070f,width:3});g.circle(head.x+3,head.y-1,2.5).fill(0xffffff);
    g.circle(x,y,7).fill(m.color);teamIcon(g,m.team,x,y,3.5);
  }
  inspect(){return{wheelAngles:this.wheels.map(w=>w.isValid()?w.rotation():0),suspension:this.carriers.filter(b=>b.isValid()).map(b=>this.ctx.physics.position(b)),angle:this.marble.body.isValid()?this.marble.body.rotation():null,head:this.head.isValid()?this.ctx.physics.position(this.head):null};}
}
