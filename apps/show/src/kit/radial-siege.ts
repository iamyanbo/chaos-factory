import type { Graphics } from 'pixi.js';
import { TEAMS,type TeamId } from '@chaos/shared';
import { PX,RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import { drawBody } from './draw-body';
import { teamIcon } from './team-icon';
import type { SiegePart,SiegeShot } from './siege-machine';

const ALL_FORTS=0x3f,SHOT=1<<9;
export interface SeatExposure {team:TeamId;seat:number;fired:number;targeted:number;impacts:number;coreDamage:number;destroyedAt:number|null}
export interface AmmoTraits {radius?:number;damage?:number;penetration?:number}
interface RadialShot extends SiegeShot {incoming:{x:number;y:number};damage:number;penetration:number;contacts:Set<string>}
interface ArmorBlueprint {x:number;y:number;angle:number;seat:number}
export interface SiegeOptions {coreHp?:number;armorHp?:number;armorLayers?:number;initialLayers?:number;theme?:'tree'}
/** Top-down artillery: a regular polygon gives every fort equivalent lines of fire. */
export class RadialSiege {
  readonly parts:SiegePart[]=[];readonly shots:RadialShot[]=[];readonly exposure:SeatExposure[]=[];
  readonly center={x:1280,y:555};readonly radius=235;time=0;hits=0;broken=0;volleys=0;
  private serial=0;private turns=new Map<TeamId,number>();private aim=new Map<TeamId,TeamId>();
  private blueprints=new Map<string,ArmorBlueprint>();builds=0;repairs=0;
  constructor(readonly ctx:GameContext,readonly teams:TeamId[],readonly onHit:(id:string,n:number)=>void,readonly options:SiegeOptions={}){
    ctx.physics.onCollision=(a,b,started)=>{if(started)this.contact(a,b);};
    for(const [i,team]of teams.entries()){
      const p=this.position(i),id=`radial-core:${team}`;
      const core=ctx.physics.ball(p.x,p.y,28,{dynamic:false,entity:id});core.collider(0).setCollisionGroups(((1<<i)<<16)|SHOT);
      this.parts.push({id,team,body:core,hp:options.coreHp??100,maxHp:options.coreHp??100,core:true,broken:false});
      this.exposure.push({team,seat:i,fired:0,targeted:0,impacts:0,coreDamage:0,destroyedAt:null});
      for(let layer=0;layer<(options.armorLayers??1);layer++)for(let j=1;j<teams.length;j++){
        const q=this.position((i+j)%teams.length),a=Math.atan2(q.y-p.y,q.x-p.x),wallId=`radial-wall:${team}:${j}${layer?`:${layer}`:''}`;
        // One plate faces each incoming lane. No seams sit on a firing line.
        const bp={x:p.x+Math.cos(a)*(60+layer*28),y:p.y+Math.sin(a)*(60+layer*28),angle:a+Math.PI/2,seat:i};this.blueprints.set(wallId,bp);
        const body=ctx.physics.box(bp.x,bp.y,28,16,{dynamic:false,angle:bp.angle,entity:wallId,restitution:.2}),built=layer<(options.initialLayers??1),hp=options.armorHp??10;
        body.collider(0).setCollisionGroups(((1<<i)<<16)|SHOT);
        if(!built)body.setEnabled(false);this.parts.push({id:wallId,team,body,hp:built?hp:0,maxHp:hp,core:false,broken:!built});
      }
    }
  }
  angle(i:number):number{return -Math.PI/2+i*Math.PI*2/this.teams.length;}
  position(i:number):{x:number;y:number}{const a=this.angle(i);return{x:this.center.x+Math.cos(a)*this.radius,y:this.center.y+Math.sin(a)*this.radius};}
  core(team:TeamId):SiegePart{return this.parts.find(p=>p.team===team&&p.core)!;}
  branches(team:TeamId):number{return this.parts.filter(p=>p.team===team&&!p.core&&!p.broken).length;}
  grow(team:TeamId):boolean{return this.build(team);}
  build(team:TeamId):boolean{
    if(this.core(team).hp<=0)return false;const part=this.parts.find(p=>p.team===team&&!p.core&&p.broken);if(!part)return false;
    const bp=this.blueprints.get(part.id)!;if(part.body.isValid())this.ctx.physics.remove(part.body);
    part.body=this.ctx.physics.box(bp.x,bp.y,28,16,{dynamic:false,angle:bp.angle,entity:part.id,restitution:.2});part.body.collider(0).setCollisionGroups(((1<<bp.seat)<<16)|SHOT);
    part.hp=part.maxHp;part.broken=false;part.brokenAt=undefined;this.builds++;this.ctx.fx.ring(bp.x,bp.y,TEAMS[team].hex,35);this.ctx.audio.play('chime');return true;
  }
  repair(team:TeamId,amount=6):number{
    const core=this.core(team);if(core.hp<=0)return 0;const part=[core,...this.parts.filter(p=>p.team===team&&!p.core&&!p.broken)].find(p=>p.hp<p.maxHp);if(!part)return 0;
    const healed=Math.min(amount,part.maxHp-part.hp);part.hp+=healed;this.repairs+=healed;const p=this.ctx.physics.position(part.body);this.ctx.fx.ring(p.x,p.y,0x5ff2c4,36);this.ctx.audio.play('coin');return healed;
  }
  target(team:TeamId):TeamId|undefined{
    const from=this.teams.indexOf(team),offset=this.turns.get(team)??0;
    // Each source cycles offsets in the same order. No special middle or end seat.
    for(let n=0;n<this.teams.length-1;n++){const t=this.teams[(from+1+(offset+n)%(this.teams.length-1))%this.teams.length];if(this.core(t).hp>0){this.turns.set(team,offset+n+1);return t;}}
  }
  fire(team:TeamId,owner:string,amount:number,time:number,chosen?:TeamId,traits:AmmoTraits={}):number{
    if(this.core(team).hp<=0)return 0;
    const target=chosen&&chosen!==team&&this.core(chosen).hp>0?chosen:this.target(team);if(!target)return 0;
    const count=Math.min(amount,Math.max(0,32-this.shots.length));if(count<=0)return 0;
    const i=this.teams.indexOf(team),to=this.teams.indexOf(target),p=this.position(i),q=this.position(to),a=Math.atan2(q.y-p.y,q.x-p.x);
    this.volleys++;this.aim.set(team,target);this.exposure[i].fired+=count;this.exposure[to].targeted+=count;
    for(let j=0;j<count;j++){
      const spread=(j%3-1)*6,id=`radial-shot:${this.serial++}`,x=p.x+Math.cos(a)*85-Math.sin(a)*spread,y=p.y+Math.sin(a)*85+Math.cos(a)*spread;
      const body=this.ctx.physics.ball(x,y,traits.radius??7,{entity:id,density:2,restitution:.35});
      body.setGravityScale(0,true);body.setLinearDamping(0);body.collider(0).setCollisionGroups((SHOT<<16)|(ALL_FORTS&~(1<<i)));
      const incoming={x:Math.cos(a)*750/PX,y:Math.sin(a)*750/PX};body.setLinvel(incoming,true);this.shots.push({id,team,owner,body,born:time,spent:false,incoming,damage:traits.damage??1,penetration:traits.penetration??0,contacts:new Set()});
    }
    this.ctx.fx.ring(p.x+Math.cos(a)*85,p.y+Math.sin(a)*85,TEAMS[team].hex,28);this.ctx.audio.play('whoosh');return count;
  }
  private contact(a:string,b:string):void{
    const shot=this.shots.find(s=>s.id===a||s.id===b);if(!shot||shot.spent)return;
    const part=this.parts.find(p=>p.id===(shot.id===a?b:a));if(!part||part.team===shot.team)return;
    if(shot.contacts.has(part.id))return;shot.contacts.add(part.id);
    // Simultaneous contacts all struck solid armor in this physics step, even if
    // an earlier callback broke it. Consume those bolts rather than bouncing ghosts.
    shot.spent=true;this.hits++;const seat=this.exposure[this.teams.indexOf(part.team)];seat.impacts++;
    if(shot.penetration>0){shot.spent=false;shot.penetration--;shot.body.collider(0).setSensor(true);shot.body.setLinvel(shot.incoming,true);}
    if(part.broken)return;const damage=Math.min(part.hp,shot.damage);part.hp-=damage;this.onHit(shot.owner,damage*(part.core?4:1));if(part.core)seat.coreDamage+=damage;
    const p=this.ctx.physics.position(part.body);this.ctx.fx.burst(p.x,p.y,TEAMS[shot.team].hex,8);this.ctx.audio.play('clack');
    if(part.hp<=0){
      this.breakPart(part,shot.incoming);
      if(part.core){seat.destroyedAt=this.time;for(const wall of this.parts)if(wall.team===part.team&&!wall.broken)this.breakPart(wall,shot.incoming);this.ctx.hud.announce(`${part.team.toUpperCase()} CORE DESTROYED`);}
    }
  }
  private breakPart(part:SiegePart,velocity:{x:number;y:number}):void{
    part.broken=true;part.brokenAt=this.time;this.broken++;part.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);part.body.setGravityScale(0,true);
    part.body.collider(0).setCollisionGroups(0);part.body.setLinvel({x:velocity.x*.15,y:velocity.y*.15},true);part.body.setAngvel(2,true);
    const p=this.ctx.physics.position(part.body);this.ctx.fx.ring(p.x,p.y,0xffd23f,55);this.ctx.audio.play('explosion');
  }
  step(time:number):void{
    this.time=time;
    for(let i=this.shots.length-1;i>=0;i--){const shot=this.shots[i];if(shot.spent||time-shot.born>2){this.ctx.physics.remove(shot.body);this.shots.splice(i,1);}else shot.incoming={...shot.body.linvel()};}
    for(const p of this.parts)if(p.broken&&p.body.isValid()&&time-(p.brokenAt??time)>3)this.ctx.physics.remove(p.body);
  }
  draw(g:Graphics):void{
    const {x,y}=this.center;g.circle(x,y,327).fill(0x111e33).stroke({color:0x354968,width:4});
    for(const r of[100,180,235,305])g.circle(x,y,r).stroke({color:0x354968,width:2,alpha:.45});
    for(const [i,t]of this.teams.entries()){
      const p=this.position(i),core=this.core(t),color=TEAMS[t].hex,target=this.aim.get(t),q=target?this.position(this.teams.indexOf(target)):this.center,a=Math.atan2(q.y-p.y,q.x-p.x);
      if(core.hp>0){
        g.circle(p.x,p.y,80).fill({color,alpha:.08}).stroke({color,width:2,alpha:.5});
        g.moveTo(p.x,p.y).lineTo(p.x+Math.cos(a)*90,p.y+Math.sin(a)*90).stroke({color:0x05070f,width:22});
        g.moveTo(p.x,p.y).lineTo(p.x+Math.cos(a)*90,p.y+Math.sin(a)*90).stroke({color,width:13});
        g.arc(p.x,p.y,36,-Math.PI/2,-Math.PI/2+Math.PI*2*core.hp/core.maxHp).stroke({color:0xffffff,width:5});
      }else g.circle(p.x,p.y,65).fill({color:0x05070f,alpha:.6}).stroke({color:0xff5d73,width:3});
    }
    if(this.options.theme==='tree')for(const part of this.parts)if(!part.core&&!part.broken&&part.body.isValid()){const p=this.ctx.physics.position(part.body),root=this.position(this.teams.indexOf(part.team));g.moveTo(root.x,root.y).lineTo(p.x,p.y).stroke({color:0x705345,width:7});}
    for(const p of this.parts)if(p.body.isValid()&&p.body.isEnabled())drawBody(g,p.body,p.broken?0x536176:p.core?TEAMS[p.team].hex:this.options.theme==='tree'?0x69bc87:p.hp/p.maxHp<.4?0xe6a05d:0x9aaec6);
    for(const [i,team]of this.teams.entries())if(this.core(team).hp>0){const p=this.position(i);teamIcon(g,team,p.x,p.y,13);}
    for(const s of this.shots){const p=this.ctx.physics.position(s.body),v=s.body.linvel();g.moveTo(p.x-v.x*1.5,p.y-v.y*1.5).lineTo(p.x,p.y).stroke({color:TEAMS[s.team].hex,width:s.body.collider(0).radius()*PX,alpha:.65});drawBody(g,s.body,TEAMS[s.team].hex);if(s.penetration||s.body.collider(0).isSensor())g.circle(p.x,p.y,5).fill(0xffffff);}
  }
  inspect(){return{hits:this.hits,broken:this.broken,builds:this.builds,repairs:this.repairs,volleys:this.volleys,shots:this.shots.length,layout:'regular-polygon',exposure:this.exposure.map(s=>({...s})),cores:this.teams.map(team=>({team,hp:this.core(team).hp,branches:this.parts.filter(p=>p.team===team&&!p.core&&!p.broken).length}))};}
}
