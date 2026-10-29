import type { Graphics } from 'pixi.js';
import { PX,RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import type { Marble } from './marble';
import { teamIcon } from './team-icon';

/** Twelve colliding skin particles and a light center joined by real distance springs. */
export class SoftMarble {
  readonly skin:RAPIER.RigidBody[]=[];readonly radius=24;
  constructor(readonly ctx:GameContext,readonly marble:Marble){
    const m=marble;m.customView=true;m.radius=30;ctx.physics.radius(m.body,5);m.body.collider(0).setDensity(.25);m.body.setLinearDamping(.25);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const b=ctx.physics.ball(m.x+Math.cos(a)*24,m.y+Math.sin(a)*24,6,{density:.3,restitution:.05,friction:.015,entity:`skin:${m.id}:${i}`});b.setLinearDamping(.2);this.skin.push(b);this.link(m.body,b,24,9);}
    for(let i=0;i<12;i++){this.link(this.skin[i],this.skin[(i+1)%12],2*24*Math.sin(Math.PI/12),13);if(i<6)this.link(this.skin[i],this.skin[i+6],48,5);}
  }
  private link(a:RAPIER.RigidBody,b:RAPIER.RigidBody,length:number,stiffness:number):void{
    const j=this.ctx.physics.world.createImpulseJoint(RAPIER.JointData.spring(length/PX,stiffness,.15,{x:0,y:0},{x:0,y:0}),a,b,true);j.setContactsEnabled(false);
  }
  reset(x:number,y:number):void{
    this.marble.x=this.marble.prevX=x;this.marble.y=this.marble.prevY=y;this.marble.trail=[];
    for(const[i,b]of[this.marble.body,...this.skin].entries()){const a=(i-1)*Math.PI/6;this.ctx.physics.move(b,x+(i?Math.cos(a)*24:0),y+(i?Math.sin(a)*24:0));b.setLinvel({x:0,y:0},true);b.setAngvel(0,true);b.setEnabled(true);}
  }
  enable(value:boolean):void{for(const b of[this.marble.body,...this.skin])b.setEnabled(value);}
  points(){return this.skin.map(b=>this.ctx.physics.position(b));}
  deformation():number{const points=this.points(),xs=points.map(p=>p.x),ys=points.map(p=>p.y);return Math.abs((Math.max(...xs)-Math.min(...xs))/(Math.max(...ys)-Math.min(...ys)+1e-6)-1);}
  draw(g:Graphics):void{
    if(this.marble.staged||!this.marble.alive)return;const points=this.points(),m=this.marble;
    g.poly(points.flatMap(p=>[p.x,p.y])).fill({color:m.color,alpha:.85}).stroke({color:0x05070f,width:5,join:'round'});
    const v=m.body.linvel();for(const d of[-8,8]){g.ellipse(m.x+d,m.y-3,6,8).fill(0xffffff);g.circle(m.x+d+Math.max(-2,Math.min(2,v.x)),m.y-2,2.5).fill(0x090d18);}
    g.circle(m.x-7,m.y-13,5).fill({color:0xffffff,alpha:.25});
    teamIcon(g,m.team,m.x,m.y+13,4);
  }
}
