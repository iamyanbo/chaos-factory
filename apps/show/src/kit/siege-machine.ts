import type { Graphics } from 'pixi.js';
import { TEAMS,type TeamId } from '@chaos/shared';
import { PX,RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import { drawBody } from './draw-body';
export interface SiegePart {id:string;team:TeamId;body:RAPIER.RigidBody;hp:number;maxHp:number;broken:boolean;core:boolean;brokenAt?:number}
export interface SiegeShot {id:string;team:TeamId;owner:string;body:RAPIER.RigidBody;born:number;spent:boolean}

/** Physical walls fall when broken; only projectile contact can damage a fort. */
export class SiegeMachine {
  readonly parts:SiegePart[]=[];readonly shots:SiegeShot[]=[];private serial=0;time=0;
  hits=0;broken=0;volleys=0;
  private targeting=new Map<TeamId,TeamId[]>();private turns=new Map<TeamId,number>();
  constructor(readonly ctx:GameContext,readonly teams:TeamId[],readonly kind:'fort'|'tree',readonly onHit:(owner:string,amount:number)=>void){
    ctx.physics.onCollision=(a,b,started)=>{if(started)this.contact(a,b);};
    for(const team of teams)this.targeting.set(team,ctx.rng.shuffle(teams.filter(t=>t!==team)));
    for(const[ti,team]of teams.entries()){
      const x=this.center(ti),core=ctx.physics.ball(x,860,22,{dynamic:false,entity:`core:${team}`});
      this.parts.push({id:`core:${team}`,team,body:core,hp:kind==='tree'?16:32,maxHp:kind==='tree'?16:32,broken:false,core:true});
      for(let j=0;j<(kind==='tree'?6:6);j++){
        const id=`wall:${team}:${j}`,side=j%2?1:-1,row=Math.floor(j/2);
        const body=ctx.physics.box(x+side*(kind==='tree'?34:40),840-row*43,kind==='tree'?65:20,kind==='tree'?12:40,{dynamic:false,angle:kind==='tree'?side*-.3:0,entity:id,friction:.6});
        if(kind==='tree')body.setEnabled(false);
        this.parts.push({id,team,body,hp:kind==='tree'?2:5,maxHp:kind==='tree'?2:5,broken:false,core:false});
      }
    }
  }
  center(index:number):number{return 180+(index+.5)*1560/this.teams.length;}
  core(team:TeamId):SiegePart{return this.parts.find(p=>p.team===team&&p.core)!;}
  branches(team:TeamId):number{return this.parts.filter(p=>p.team===team&&!p.core&&!p.broken&&p.body.isEnabled()).length;}
  grow(team:TeamId):boolean{
    const part=this.parts.find(p=>p.team===team&&!p.core&&!p.broken&&p.body.isValid()&&!p.body.isEnabled());if(!part)return false;
    part.body.setEnabled(true);const p=this.ctx.physics.position(part.body);this.ctx.fx.burst(p.x,p.y,TEAMS[team].hex,12);this.ctx.audio.play('chime');return true;
  }
  fire(team:TeamId,owner:string,amount:number,time:number):number{
    if(this.core(team).hp<=0)return 0;
    const ti=this.teams.indexOf(team),targets=this.targeting.get(team)!.filter(t=>this.core(t).hp>0);if(!targets.length)return 0;
    const target=targets[(this.turns.get(team)??0)%targets.length],tx=this.center(this.teams.indexOf(target)),sx=this.center(ti),direction=Math.sign(tx-sx);
    const available=Math.max(0,32-this.shots.length),count=Math.min(amount,available);if(!count)return 0;this.volleys++;this.turns.set(team,(this.turns.get(team)??0)+1);
    for(let j=0;j<count;j++){
      const id=`shot:${this.serial++}`,startX=sx+direction*62,startY=740-j%3*8;
      const body=this.ctx.physics.ball(startX,startY,7,{density:2,restitution:.25,entity:id});
      const flight=.9+Math.abs(tx-startX)/1800;
      body.setLinvel({x:(tx-startX)/PX/flight,y:(850-startY)/PX/flight-this.ctx.physics.world.gravity.y*flight/2+(j%3-1)*.16},true);
      this.shots.push({id,team,owner,body,born:time,spent:false});
    }
    this.ctx.fx.ring(sx,740,TEAMS[team].hex);this.ctx.audio.play('whoosh');return count;
  }
  private contact(a:string,b:string):void{
    const shot=this.shots.find(s=>s.id===a||s.id===b);if(!shot||shot.spent)return;
    const other=shot.id===a?b:a,part=this.parts.find(p=>p.id===other);
    if(!part||part.team===shot.team||part.broken||part.hp<=0)return;
    shot.spent=true;part.hp--;this.hits++;this.onHit(shot.owner,part.core?4:1);
    const p=this.ctx.physics.position(part.body);this.ctx.fx.burst(p.x,p.y,TEAMS[shot.team].hex,8);this.ctx.audio.play('clack');
    if(part.hp<=0){
      part.broken=true;part.brokenAt=this.time;this.broken++;part.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);part.body.applyImpulse({x:shot.body.linvel().x*.02,y:-.15},true);
      this.ctx.fx.ring(p.x,p.y,0xffd23f);this.ctx.audio.play('explosion');
      if(part.core)for(const branch of this.parts.filter(b=>b.team===part.team&&!b.core&&!b.broken)){branch.broken=true;branch.brokenAt=this.time;branch.body.setEnabled(true);branch.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);}
    }
  }
  step(time:number):void{
    this.time=time;for(let i=this.shots.length-1;i>=0;i--){const s=this.shots[i];if(s.spent||time-s.born>4||this.ctx.physics.position(s.body).y>960){this.ctx.physics.remove(s.body);this.shots.splice(i,1);}}
    for(const p of this.parts)if(p.broken&&p.body.isValid()&&time-(p.brokenAt??time)>4){const at=this.ctx.physics.position(p.body);this.ctx.fx.burst(at.x,at.y,0x536176,8);this.ctx.physics.remove(p.body);}
  }
  draw(g:Graphics):void{
    for(const team of this.teams){const i=this.teams.indexOf(team),x=this.center(i),c=TEAMS[team].hex;
      if(this.kind==='tree')g.roundRect(x-13,775,26,105,10).fill(this.core(team).hp>0?0x8c6952:0x413c48).stroke({color:0x05070f,width:4});
      g.roundRect(x-47,900,94,12,5).fill(0x142139);g.roundRect(x-47,900,94*Math.max(0,this.core(team).hp)/this.core(team).maxHp,12,5).fill(c);
      g.circle(x,740,18).fill(0x293654).stroke({color:c,width:5});
    }
    for(const part of this.parts)if(part.body.isValid()&&part.body.isEnabled()){
      drawBody(g,part.body,part.core?TEAMS[part.team].hex:part.broken?0x536176:this.kind==='tree'?0x5cab79:0x94a4b9);
      if(this.kind==='tree'&&!part.core&&!part.broken){const p=this.ctx.physics.position(part.body),side=p.x<this.center(this.teams.indexOf(part.team))?-1:1;g.circle(p.x+side*28,p.y-10,17).fill(0x5cab79).stroke({color:0x173e32,width:3});g.circle(p.x+side*15,p.y-15,12).fill(0x79c88c);}
    }
    for(const shot of this.shots)drawBody(g,shot.body,TEAMS[shot.team].hex);
  }
  inspect(){return{hits:this.hits,broken:this.broken,volleys:this.volleys,shots:this.shots.length,cores:this.teams.map(team=>({team,hp:this.core(team).hp,branches:this.branches(team)}))};}
}
