import type { Graphics } from 'pixi.js';
import { RAPIER,PX } from '../engine/physics';
import type { GameContext } from '../games/contract';
import type { Marble } from './marble';
import { MachineGeometry } from './machine-geometry';
import { drawBody } from './draw-body';
interface ReturnTrip {marble:Marble;at:number;x:number;y:number}
export class PhysicalSelector {
  readonly geometry:MachineGeometry;readonly paddles:RAPIER.RigidBody[]=[];
  private trips=new Map<string,ReturnTrip>();private phases:number[];
  readonly exits=new Map<string,number>();
  readonly inactive=new Set<number>();
  constructor(readonly ctx:GameContext,readonly count:number,readonly onExit:(marble:Marble,left:boolean)=>void){
    this.geometry=new MachineGeometry(ctx);this.phases=Array.from({length:count},()=>ctx.rng.range(0,Math.PI*2));
    for(let i=0;i<count;i++){
      const c=this.center(i),w=this.width();
      this.geometry.rail(c-w*.43,390,10,440);this.geometry.rail(c+w*.43,390,10,440);this.geometry.rail(c,170,w*.86,10);
      this.geometry.segment(c-w*.41,285,c-25,325,9);this.geometry.segment(c+w*.41,285,c+25,325,9);
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)this.geometry.peg(c+(col-1)*w*.19+(row%2?w*.08:0),380+row*55,8);
      this.geometry.rail(c,565,10,62);this.geometry.rail(c,610,w*.86,12);
      this.paddles.push(ctx.physics.box(c,350,65,9,{kinematic:true,entity:`selector-paddle-${i}`}));
    }
  }
  width():number{return 1560/this.count;}
  center(team:number):number{return 180+(team+.5)*this.width();}
  spawnPoint(team:number,index:number):{x:number;y:number}{const c=this.center(team),columns=Math.max(3,Math.floor(this.width()*.7/26));return{x:c+(index%columns-(columns-1)/2)*26,y:245-Math.floor(index/columns)*24};}
  retire(i:number,marbles:Marble[]):void{
    this.inactive.add(i);this.paddles[i].setBodyType(RAPIER.RigidBodyType.Fixed,true);
    for(const m of marbles){this.trips.delete(m.id);m.dormant=true;m.color=0x667080;m.trail=[];m.body.setLinvel({x:0,y:0},true);m.body.setAngvel(0,true);m.body.setBodyType(RAPIER.RigidBodyType.Fixed,true);m.body.collider(0).setSensor(true);}
  }
  step(time:number,marbles:Marble[],teamIndex:(m:Marble)=>number):void{
    for(let i=0;i<this.count;i++)if(!this.inactive.has(i))this.paddles[i].setNextKinematicRotation(Math.sin(time*1.3+this.phases[i])*.65);
    for(const m of marbles){
      if(m.dormant)continue;
      const i=teamIndex(m),c=this.center(i),w=this.width(),trip=this.trips.get(m.id);
      if(trip){
        const t=Math.min(1,(time-trip.at)/2.2),side=c+w*.48;
        const p=t<.22?{x:trip.x+(side-trip.x)*t/.22,y:trip.y}:t<.82?{x:side,y:trip.y+(220-trip.y)*(t-.22)/.6}:{x:side+(c-side)*(t-.82)/.18,y:220};
        this.ctx.physics.move(m.body,p.x,p.y);
        if(t>=1){m.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);m.body.collider(0).setSensor(false);m.body.setLinvel({x:0,y:0},true);this.trips.delete(m.id);}
      }else if(m.y>574){
        const left=m.x<c;if(Math.abs(m.x-c)<w*.43){this.onExit(m,left);this.exits.set(m.id,(this.exits.get(m.id)??0)+1);}
        this.trips.set(m.id,{marble:m,at:time,x:m.x,y:m.y});m.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);m.body.setNextKinematicTranslation(m.body.translation());m.body.collider(0).setSensor(true);m.body.setLinvel({x:0,y:0},true);
      }
    }
  }
  draw(g:Graphics):void{
    this.geometry.draw(g);for(const p of this.paddles)drawBody(g,p,0xffd23f);
    for(let i=0;i<this.count;i++){const c=this.center(i),w=this.width();g.moveTo(c+w*.48,600).lineTo(c+w*.48,220).lineTo(c,220).stroke({color:0x5ff2c4,width:5,alpha:.35});g.poly([c+w*.48-8,245,c+w*.48,230,c+w*.48+8,245]).fill(0x5ff2c4);}
  }
  inspect(){return{exits:Object.fromEntries(this.exits),returning:[...this.trips.keys()]};}
}
