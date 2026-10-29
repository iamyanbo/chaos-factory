import type { Graphics } from 'pixi.js';
import { RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import { MachineGeometry } from './machine-geometry';
import { drawBody } from './draw-body';

export const CIRCUIT_ROOMS=['PINWHEEL FALLS','PEG CASCADE','CROSSING GATES','TIPPING POINT','FINAL DROP'];
interface Motor {body:RAPIER.RigidBody;x:number;y:number;room:number;kind:'spin'|'slide'|'swing';phase:number}
interface Door {left:RAPIER.RigidBody;right:RAPIER.RigidBody;y:number;duration:number;opened?:number}

/** One connected shaft. Doors move; entrants are never transported between rooms. */
export class EliminationCourse {
  readonly geometry:MachineGeometry;readonly motors:Motor[]=[];readonly decks:RAPIER.RigidBody[]=[];
  private deckMotors:RAPIER.RevoluteImpulseJoint[]=[];
  readonly doors:Door[]=[];readonly exits:Door[]=[];readonly hatch:Door;
  readonly releaseAfter=8;
  constructor(readonly ctx:GameContext){
    this.geometry=new MachineGeometry(ctx);
    this.geometry.rail(350,2400,20,4320);this.geometry.rail(1570,2400,20,4320);
    for(let room=0;room<5;room++){
      const b=this.base(room);this.doors.push(this.door(b+830));this.exits.push(this.door(b+650,1.5));
      // Leave the wall lanes open. Fixed ramps beside a moving deck form pinch pockets.
      if(room===0){
        for(const [x,y,direction]of[[700,b+365,1],[1220,b+365,-1],[960,b+460,1]])this.motor(x,y,220,room,'spin',direction);
      }else if(room===1){
        for(let row=0;row<3;row++)for(let col=0;col<7;col++)this.geometry.peg(490+col*145+(row%2?55:0),b+270+row*85,18,0x667ea0);
        this.motor(960,b+190,400,room,'swing',0);
      }else if(room===2){
        for(let row=0;row<3;row++){
          this.motor(650,b+230+row*100,330,room,'slide',row*Math.PI*.7);
          this.motor(1270,b+230+row*100,330,room,'slide',row*Math.PI*.7+Math.PI);
        }
      }else if(room===3){
        for(const [x,y]of[[650,b+290],[1270,b+290],[960,b+420]]){
          const deck=ctx.physics.box(x,y,330,18,{density:.2,friction:.05,restitution:.3,entity:'circuit-seesaw'});
          const joint=ctx.physics.revolute(this.geometry.body,deck,{x,y},{x:0,y:0}) as RAPIER.RevoluteImpulseJoint;
          joint.setLimits(-.8,.8);joint.configureMotorPosition(0,2,.2);deck.setAngularDamping(.3);this.decks.push(deck);this.deckMotors.push(joint);
        }
      }else{
        this.motor(660,b+265,270,room,'spin',1);this.motor(1260,b+265,270,room,'spin',-1);
        this.motor(960,b+420,450,room,'swing',Math.PI);
        for(const x of[520,800,1120,1400])this.geometry.peg(x,b+390,25,0x5ff2c4);
      }
    }
    this.hatch=this.door(this.base(0)+285);
  }
  base(room:number):number{return 240+room*860;}
  line(room:number):number{return this.base(room)+710;}
  private door(y:number,duration=.75):Door{
    return{y,duration,left:this.ctx.physics.box(655,y,610,16,{kinematic:true,friction:.03,entity:'circuit-door'}),right:this.ctx.physics.box(1265,y,610,16,{kinematic:true,friction:.03,entity:'circuit-door'})};
  }
  private motor(x:number,y:number,w:number,room:number,kind:Motor['kind'],phase:number):void{
    this.motors.push({x,y,room,kind,phase,body:this.ctx.physics.box(x,y,w,18,{kinematic:true,restitution:.4,friction:.03,entity:'circuit-motor'})});
  }
  open(room:number,time:number):void{this.doors[room].opened??=time;}
  step(time:number,active=0,elapsed=time-5):void{
    if(time>=5)this.hatch.opened??=time;
    if(elapsed>=this.releaseAfter)this.exits[active].opened??=time;
    for(const d of [...this.doors,...this.exits,this.hatch]){
      const t=d.opened===undefined?0:Math.min(1,(time-d.opened)/d.duration),slide=640*t;
      this.ctx.physics.move(d.left,655-slide,d.y);this.ctx.physics.move(d.right,1265+slide,d.y);
    }
    for(const m of this.motors){
      if(m.kind==='slide')this.ctx.physics.move(m.body,m.x+Math.sin(time*1.9+m.phase)*150,m.y);
      else m.body.setNextKinematicRotation(m.kind==='spin'?time*m.phase*1.65:Math.sin(time*1.7+m.phase)*.9);
    }
    for(const [i,joint]of this.deckMotors.entries())joint.configureMotorPosition(Math.sin(time*.9+i*2)*.6,2,.2);
  }
  draw(g:Graphics,active:number,time:number):void{
    // Only draw nearby rooms; their colliders all remain in the continuous world.
    for(let i=Math.max(0,active-1);i<=Math.min(4,active+1);i++){
      const b=this.base(i);g.roundRect(365,b+30,1190,795,20).fill({color:i%2?0x131e32:0x101b2d,alpha:.8});
      for(let x=385;x<1550;x+=45)g.moveTo(x,b+810).lineTo(x+20,b+830).stroke({color:0xffd23f,width:8,alpha:.35});
      const y=this.line(i),color=i===4?0xffd23f:0x5ff2c4;
      g.moveTo(370,y).lineTo(1550,y).stroke({color,width:4,alpha:.8});
      for(let x=380;x<1540;x+=44)g.rect(x,y-6,22,12).fill({color,alpha:.6});
      for(const d of [this.doors[i],this.exits[i],...(i===0?[this.hatch]:[])])if(d.opened===undefined||time-d.opened<d.duration){const color=d===this.exits[i]?0x5ff2c4:0xffd23f;drawBody(g,d.left,color);drawBody(g,d.right,color);}
    }
    this.geometry.draw(g);
    for(const m of this.motors)if(Math.abs(m.room-active)<=1){drawBody(g,m.body,0xf4a44c);g.circle(m.x,m.y,10).fill(0x90a5c3).stroke({color:0x05070f,width:3});}
    for(const deck of this.decks){drawBody(g,deck,0x9b8afb);const p=this.ctx.physics.position(deck);g.circle(p.x,p.y,10).fill(0xffd23f);}
    if(time<5){const y=this.base(0)+285;g.moveTo(380,y-4).lineTo(1540,y-4).stroke({color:0xffd23f,width:5});}
  }
}
