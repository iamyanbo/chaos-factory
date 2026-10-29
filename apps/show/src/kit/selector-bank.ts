import type { Graphics } from 'pixi.js';
import { RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import type { Marble } from './marble';
import { MachineGeometry } from './machine-geometry';
import { drawBody } from './draw-body';

export const SELECTOR_GROUP=(1<<8)<<16|(1<<8);
interface Trip {at:number;x:number;y:number}
/** Compact gravity machines beside the battle. Every seat has the same local geometry. */
export class SelectorBank {
  readonly geometry:MachineGeometry;readonly paddles:RAPIER.RigidBody[]=[];
  readonly exits=new Map<string,number>();private trips=new Map<string,Trip>();private phases:number[];
  readonly inactive=new Set<number>();
  private clock=0;private flashes=new Map<number,{lane:number;at:number}>();
  constructor(readonly ctx:GameContext,readonly count:number,readonly onExit:(marble:Marble,left:boolean)=>void,readonly lanes:2|3=2){
    this.geometry=new MachineGeometry(ctx);this.phases=Array.from({length:count},()=>ctx.rng.range(0,Math.PI*2));
    for(let i=0;i<count;i++){
      const {x,y,w,h}=this.bay(i);
      this.geometry.rail(x-w/2,y+h/2,10,h);this.geometry.rail(x+w/2,y+h/2,10,h);this.geometry.rail(x,y,w,10);
      const rows=Math.max(1,Math.floor(h/135));
      for(let row=0;row<rows;row++)for(let col=0;col<3;col++)this.geometry.peg(x+(col-1)*70+(row%2?20:0),y+h*.63+row*35,8);
      for(let lane=1;lane<lanes;lane++)this.geometry.rail(x-w/2+w*lane/lanes,y+h-25,8,50);
      const paddle=ctx.physics.box(x,y+h*.47,100,10,{kinematic:true,entity:`ammo-selector-${i}`,friction:.02,restitution:.4});
      paddle.collider(0).setCollisionGroups(SELECTOR_GROUP);this.paddles.push(paddle);
    }
    for(let i=0;i<this.geometry.body.numColliders();i++)this.geometry.body.collider(i).setCollisionGroups(SELECTOR_GROUP);
  }
  bay(i:number):{x:number;y:number;w:number;h:number}{const rows=Math.ceil(this.count/2),gap=48,h=(620-gap*(rows-1))/rows;return{x:255+i%2*350,y:255+Math.floor(i/2)*(h+gap),w:300,h};}
  spawnPoint(i:number,n:number,total=8):{x:number;y:number}{const b=this.bay(i),columns=Math.min(8,total);return{x:b.x+(n%columns-(columns-1)/2)*30,y:b.y+28+Math.floor(n/columns)*30};}
  lane(m:Marble,i:number):number{const b=this.bay(i);return Math.max(0,Math.min(this.lanes-1,Math.floor((m.x-b.x+b.w/2)/b.w*this.lanes)));}
  retire(i:number,marbles:Marble[]):void{
    this.inactive.add(i);this.paddles[i].setBodyType(RAPIER.RigidBodyType.Fixed,true);
    for(const m of marbles){
      this.trips.delete(m.id);m.dormant=true;m.color=0x667080;m.trail=[];m.shield=0;
      m.body.setLinvel({x:0,y:0},true);m.body.setAngvel(0,true);m.body.setBodyType(RAPIER.RigidBodyType.Fixed,true);m.body.collider(0).setSensor(true);
    }
  }
  step(time:number,marbles:Marble[],teamIndex:(m:Marble)=>number):void{
    this.clock=time;
    for(let i=0;i<this.count;i++)if(!this.inactive.has(i))this.paddles[i].setNextKinematicRotation(Math.sin(time*2.1+this.phases[i])*.9);
    for(const m of marbles){
      if(m.dormant)continue;
      const b=this.bay(teamIndex(m)),trip=this.trips.get(m.id);
      if(trip){
        const t=Math.min(1,(time-trip.at)/1.35),side=b.x+b.w/2+17,top=b.y+20;
        const p=t<.18?{x:trip.x+(side-trip.x)*t/.18,y:trip.y}:t<.82?{x:side,y:trip.y+(top-trip.y)*(t-.18)/.64}:{x:side+(b.x-side)*(t-.82)/.18,y:top};
        this.ctx.physics.move(m.body,p.x,p.y);
        if(t>=1){m.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);m.body.collider(0).setSensor(false);m.body.setLinvel({x:0,y:0},true);this.trips.delete(m.id);}
      }else if(m.y>b.y+b.h-12){
        this.flashes.set(teamIndex(m),{lane:this.lane(m,teamIndex(m)),at:time});
        this.onExit(m,m.x<b.x);this.exits.set(m.id,(this.exits.get(m.id)??0)+1);
        this.trips.set(m.id,{at:time,x:m.x,y:m.y});m.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);m.body.setNextKinematicTranslation(m.body.translation());m.body.collider(0).setSensor(true);
      }
    }
  }
  draw(g:Graphics):void{
    for(let i=0;i<this.count;i++){
      const b=this.bay(i);g.roundRect(b.x-b.w/2,b.y,b.w,b.h,8).fill(0x111e33);
      const dead=this.inactive.has(i),flash=this.flashes.get(i);for(let lane=0;lane<this.lanes;lane++)g.rect(b.x-b.w/2+b.w*lane/this.lanes+5,b.y+b.h-36,b.w/this.lanes-10,34).fill({color:dead?0x526078:[0xffd23f,this.lanes===3?0x5ff2c4:0xff5d73,0xff5d73][lane],alpha:flash?.lane===lane&&this.clock-flash.at<.45?.65:.2});
      g.moveTo(b.x+b.w/2+17,b.y+b.h-10).lineTo(b.x+b.w/2+17,b.y+20).lineTo(b.x,b.y+20).stroke({color:dead?0x526078:0x5ff2c4,width:5,alpha:.35});
    }
    this.geometry.draw(g);for(const[i,p]of this.paddles.entries())drawBody(g,p,this.inactive.has(i)?0x526078:0xffd23f);
  }
  inspect(){return{exits:Object.fromEntries(this.exits),returning:[...this.trips.keys()],inactiveSelectors:[...this.inactive]};}
}
