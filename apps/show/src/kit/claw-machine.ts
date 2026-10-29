import type { Graphics } from 'pixi.js';
import { TEAMS,type TeamId } from '@chaos/shared';
import { RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import { MachineGeometry } from './machine-geometry';
import { drawBody } from './draw-body';
import { teamIcon } from './team-icon';
const SHOT=1<<9,TERRAIN=1<<7,ALL=0x3f;
type Motion='idle'|'lift'|'travel'|'aim'|'return'|'lower'|'out';
interface Part {id:string;team:TeamId;body:RAPIER.RigidBody;core:boolean;hp:number;brokenAt?:number}
interface Payload {id:string;team:TeamId;kind:'light'|'heavy'|'bar';body:RAPIER.RigidBody;released?:number;spent:boolean;contacts:Set<string>;incoming:number}
interface Crane {team:TeamId;grip:RAPIER.RigidBody;phase:Motion;at:number;target?:TeamId;aimX:number;cargo?:Payload;joint?:RAPIER.ImpulseJoint;turn:number}
/** Rail motors move real joint-held cargo. Only released payload contact damages forts. */
export class ClawMachine {
  readonly geometry:MachineGeometry;readonly parts:Part[]=[];readonly cranes:Crane[]=[];readonly payloads:Payload[]=[];
  readonly damage=new Map<TeamId,number>();drops=0;grabs=0;hits=0;broken=0;time=0;private serial=0;
  constructor(readonly ctx:GameContext,readonly teams:TeamId[]){
    ctx.physics.world.gravity.y=12;ctx.physics.world.numSolverIterations=8;this.geometry=new MachineGeometry(ctx);
    this.geometry.rail(960,858,1640,18);this.geometry.rail(140,610,16,510);this.geometry.rail(1780,610,16,510);
    for(let i=0;i<this.geometry.body.numColliders();i++)this.geometry.body.collider(i).setCollisionGroups((TERRAIN<<16)|(ALL|SHOT|TERRAIN));
    for(const[i,team]of teams.entries()){
      const x=this.center(i),core=ctx.physics.ball(x,823,24,{dynamic:false,entity:`claw-core:${team}`});core.collider(0).setCollisionGroups(((1<<i)<<16)|(SHOT|(1<<i)));
      this.parts.push({id:`claw-core:${team}`,team,body:core,core:true,hp:120});
      for(let row=0;row<2;row++)for(const side of[-1,1])this.addBlock(team,x+side*48,828-row*43,30,40);
      this.addBlock(team,x,752,136,18);
      const grip=ctx.physics.box(this.home(i),751,32,12,{kinematic:true,sensor:true,entity:`claw-grip:${team}`});grip.collider(0).setCollisionGroups(0);
      this.cranes.push({team,grip,phase:'idle',at:ctx.rng.range(0,1.2),aimX:x,turn:0});
    }
    ctx.physics.onCollision=(a,b,started)=>{if(started)this.contact(a,b);};
  }
  center(i:number):number{return 180+(i+.5)*1560/this.teams.length;}
  home(i:number):number{return this.center(i)-94;}
  core(team:TeamId):Part{return this.parts.find(p=>p.team===team&&p.core)!;}
  private addBlock(team:TeamId,x:number,y:number,w:number,h:number):void{
    const id=`claw-block:${this.parts.length}`,i=this.teams.indexOf(team),body=this.ctx.physics.box(x,y,w,h,{entity:id,density:2,friction:.65,restitution:.03});
    body.collider(0).setCollisionGroups(((1<<i)<<16)|(SHOT|TERRAIN|(1<<i)));this.parts.push({id,team,body,core:false,hp:3});
  }
  private nextTarget(c:Crane):TeamId|undefined{
    const i=this.teams.indexOf(c.team);for(let n=0;n<this.teams.length-1;n++){const t=this.teams[(i+1+(c.turn+n)%(this.teams.length-1))%this.teams.length];if(this.core(t).hp>0){c.turn+=n+1;return t;}}
  }
  private grab(c:Crane,i:number):void{
    c.target=this.nextTarget(c);if(!c.target)return;c.aimX=this.center(this.teams.indexOf(c.target))+this.ctx.rng.range(-28,28);
    const id=`claw-payload:${this.serial++}`,kind=this.ctx.rng.pick(['light','heavy','bar'] as const),halfHeight=kind==='bar'?10:kind==='heavy'?30:18;
    const body=kind==='bar'?this.ctx.physics.box(this.home(i),781+halfHeight,92,20,{entity:id,density:5,restitution:.08,friction:.4}):this.ctx.physics.ball(this.home(i),781+halfHeight,halfHeight,{entity:id,density:7,restitution:.12,friction:.2});body.collider(0).setCollisionGroups(0);
    const payload:Payload={id,team:c.team,kind,body,spent:false,contacts:new Set(),incoming:0};this.payloads.push(payload);c.cargo=payload;
    c.joint=this.ctx.physics.fixed(c.grip,body,{x:0,y:30},{x:0,y:-halfHeight});c.phase='lift';c.at=this.time;this.grabs++;
    this.ctx.fx.ring(this.home(i),805,TEAMS[c.team].hex);this.ctx.audio.play('clack');
  }
  private release(c:Crane):void{
    if(c.joint?.isValid())this.ctx.physics.world.removeImpulseJoint(c.joint,true);c.joint=undefined;
    if(c.cargo){c.cargo.released=this.time;c.cargo.body.collider(0).setCollisionGroups((SHOT<<16)|((ALL&~(1<<this.teams.indexOf(c.team)))|TERRAIN));c.cargo=undefined;this.drops++;this.ctx.audio.play('whoosh');}
    c.phase='return';c.at=this.time;
  }
  private contact(a:string,b:string):void{
    const ball=this.payloads.find(p=>p.id===a||p.id===b);if(!ball||ball.released===undefined||ball.spent)return;
    const part=this.parts.find(p=>p.id===(ball.id===a?b:a));if(!part||part.team===ball.team||part.hp<=0||ball.contacts.has(part.id))return;
    ball.contacts.add(part.id);this.hits++;const p=this.ctx.physics.position(part.body),impact=Math.max(8,Math.min(30,Math.round(Math.abs(ball.incoming)*Math.sqrt(ball.body.mass())*.85))),amount=Math.min(part.hp,part.core?impact:3);part.hp-=amount;
    this.damage.set(ball.team,(this.damage.get(ball.team)??0)+amount);this.ctx.fx.burst(p.x,p.y,TEAMS[ball.team].hex,14);this.ctx.audio.play(part.core?'explosion':'clack');this.ctx.camera.shake(part.core?.25:.1);
    if(part.core){ball.spent=true;this.ctx.fx.text(p.x,p.y-35,`−${amount} CORE`,TEAMS[ball.team].hex);if(part.hp===0)this.ctx.hud.announce(`${part.team.toUpperCase()} FORT COLLAPSED`);}
    if(part.hp<=0){part.brokenAt=this.time;this.broken++;part.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);part.body.collider(0).setCollisionGroups((TERRAIN<<16)|TERRAIN);part.body.applyImpulse({x:this.ctx.rng.range(-.6,.6),y:-.35},true);this.ctx.fx.ring(p.x,p.y,0xffd23f);}
  }
  step(time:number):void{
    this.time=time;
    for(const[i,c]of this.cranes.entries()){
      if(this.core(c.team).hp<=0){
        if(c.phase!=='out'){if(c.joint?.isValid())this.ctx.physics.world.removeImpulseJoint(c.joint,true);c.joint=undefined;if(c.cargo)c.cargo.spent=true;c.cargo=undefined;c.phase='out';c.grip.setBodyType(RAPIER.RigidBodyType.Fixed,true);}continue;
      }
      const elapsed=time-c.at,home=this.home(i);
      if(c.phase==='idle'){if(elapsed>=0)this.grab(c,i);}
      else if(c.phase==='lift'){const t=Math.min(1,elapsed/1.6);this.ctx.physics.move(c.grip,home,751-421*t);if(t===1){c.phase='travel';c.at=time;}}
      else if(c.phase==='travel'){const t=Math.min(1,elapsed/2.6);this.ctx.physics.move(c.grip,home+(c.aimX-home)*t,330);if(t===1){c.phase='aim';c.at=time;this.ctx.fx.ring(c.aimX,700,0xff5d73);this.ctx.audio.play('charge');}}
      else if(c.phase==='aim'){this.ctx.physics.move(c.grip,c.aimX,330);if(elapsed>=1.2)this.release(c);}
      else if(c.phase==='return'){const t=Math.min(1,elapsed/2.6);this.ctx.physics.move(c.grip,c.aimX+(home-c.aimX)*t,330);if(t===1){c.phase='lower';c.at=time;}}
      else if(c.phase==='lower'){const t=Math.min(1,elapsed/1.6);this.ctx.physics.move(c.grip,home,330+421*t);if(t===1){c.phase='idle';c.at=time+.4;}}
    }
    for(let i=this.payloads.length-1;i>=0;i--){const b=this.payloads[i];if(b.spent||b.released!==undefined&&time-b.released>6){this.ctx.physics.remove(b.body);this.payloads.splice(i,1);}else b.incoming=b.body.linvel().y;}
    for(const part of this.parts)if(part.brokenAt!==undefined&&time-part.brokenAt>3&&part.body.isValid())this.ctx.physics.remove(part.body);
  }
  draw(g:Graphics):void{
    g.roundRect(140,285,1640,575,16).fill(0x101d32);this.geometry.draw(g);
    g.moveTo(140,304).lineTo(1780,304).stroke({color:0x526887,width:12});g.moveTo(140,304).lineTo(1780,304).stroke({color:0xffd23f,width:4});
    for(const[i,c]of this.cranes.entries()){
      const color=c.phase==='out'?0x667080:TEAMS[c.team].hex,p=this.ctx.physics.position(c.grip);
      g.roundRect(this.home(i)-34,787,68,65,10).fill(0x263753).stroke({color,width:4});g.circle(this.home(i),805,24).stroke({color,width:4});
      g.roundRect(p.x-23,291,46,26,6).fill(color).stroke({color:0x05070f,width:4});teamIcon(g,c.team,p.x,303,7);
      g.moveTo(p.x,316).lineTo(p.x,p.y).stroke({color:0x92a6c4,width:4});drawBody(g,c.grip,color);
      g.moveTo(p.x-14,p.y).lineTo(p.x-27,p.y+30).lineTo(p.x-13,p.y+43).moveTo(p.x+14,p.y).lineTo(p.x+27,p.y+30).lineTo(p.x+13,p.y+43).stroke({color,width:6});
      if(c.phase==='aim'){const alpha=.35+.35*Math.sin(this.time*14);g.circle(c.aimX,710,38).fill({color:0xff5d73,alpha:alpha*.25}).stroke({color:0xff5d73,width:5,alpha});g.poly([c.aimX-15,668,c.aimX+15,668,c.aimX,690]).fill(0xff5d73);}
    }
    for(const p of this.parts)if(p.body.isValid()){drawBody(g,p.body,p.core?TEAMS[p.team].hex:p.hp>0?0x91a6c1:0x4c5c75);if(p.core&&p.hp>0){const at=this.ctx.physics.position(p.body);teamIcon(g,p.team,at.x,at.y,11);}}
    for(const b of this.payloads){drawBody(g,b.body,TEAMS[b.team].hex);const p=this.ctx.physics.position(b.body);if(b.kind==='bar'){const a=b.body.rotation();for(const dx of[-30,0,30])g.circle(p.x+dx*Math.cos(a),p.y+dx*Math.sin(a),3).fill(0xdbe8f3);}else{g.circle(p.x-7,p.y-7,6).fill({color:0xffffff,alpha:.5});if(b.kind==='heavy')g.circle(p.x,p.y,22).stroke({color:0xdbe8f3,width:3});}}
  }
  inspect(){return{grabs:this.grabs,drops:this.drops,hits:this.hits,broken:this.broken,payloads:this.payloads.length,cargoKinds:this.payloads.map(p=>({kind:p.kind,mass:p.body.mass()})),held:this.cranes.filter(c=>c.joint?.isValid()).length,cranes:this.cranes.map(c=>({team:c.team,phase:c.phase,target:c.target,position:this.ctx.physics.position(c.grip),joint:Boolean(c.joint?.isValid()),cargo:c.cargo?this.ctx.physics.position(c.cargo.body):undefined})),cores:this.teams.map(team=>({team,hp:this.core(team).hp})),damage:Object.fromEntries(this.damage)};}
}
