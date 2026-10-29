import { TEAMS,type Participant,type TeamId,type Winner,type ChatGameInput,type StreamerInput } from '@chaos/shared';
import { BaseGame } from './base-game';
import type { Marble } from './marble';
import type { GameContext } from '../games/contract';

/** Shared identity/lifecycle for automatic games. Each plugin owns its simulation. */
export abstract class JoinGame extends BaseGame {
  protected suppressInputFeed=true;
  readonly teams:TeamId[];
  protected admitted=new Set<string>();
  protected champion?:{marble:Marble;reason:string};
  protected admissionSeconds=5;
  private spawnOrder:number[];
  constructor(ctx:GameContext,target:number,readonly playerCap:number,readonly individual=false){
    super(ctx,target);this.teams=ctx.rng.shuffle(ctx.setup.teams??['red','blue']);this.spawnOrder=ctx.rng.shuffle(Array.from({length:playerCap},(_,i)=>i));
  }
  protected abstract createPlayer(owner:Participant,index:number):Marble;
  protected acceptsTeam(_team:TeamId):boolean{return true;}
  protected seedRoster():void{
    const roster=this.ctx.setup.participants.slice(0,this.playerCap);this.ctx.setup.participants=[];
    for(const p of roster)this.onJoin(p);
  }
  onJoin(participant:Participant):boolean{
    if(this.result||this.admitted.has(participant.userId)||this.admitted.size>=this.playerCap)return false;
    if(this.started&&this.time>this.admissionSeconds&&this.marbles.length>0)return false;
    const counts=this.teams.filter(t=>this.acceptsTeam(t)).map(team=>({team,n:this.ctx.setup.participants.filter(p=>p.teamId===team).length})).sort((a,b)=>a.n-b.n);if(!counts.length)return false;
    const team=participant.teamId&&counts.some(c=>c.team===participant.teamId)?participant.teamId:counts[0].team;
    const owner={...participant,teamId:team,color:TEAMS[team].color};
    const m=this.createPlayer(owner,this.spawnOrder[this.admitted.size]);m.labelPriority=owner.userId==='offline-player'?100:this.started?10:0;
    this.admitted.add(owner.userId);this.ctx.setup.participants.push(owner);
    if(this.started){this.ctx.fx.ring(m.x,m.y,m.color);this.ctx.fx.burst(m.x,m.y,m.color,10);this.ctx.audio.play('chime');}
    return true;
  }
  onChat(_input:ChatGameInput):void{}
  onStreamer(_input:StreamerInput):void{}
  protected playerWins(m:Marble,reason='FIRST TO THE FINISH'):void{
    if(this.champion||this.result)return;this.champion={marble:m,reason};m.finished=true;m.score+=100;
    this.big('PHOTO FINISH!',m.x,m.y,m.color);this.close(reason,m.x,m.y);this.complete(this.winner(m.team));
  }
  protected complete(winner:Winner):void{
    super.complete(winner);if(!this.result||!this.champion)return;
    const {marble:m,reason}=this.champion;this.result.champion={userId:m.id,displayName:m.owner.displayName,reason};
    if(this.individual)for(const[id,stats]of Object.entries(this.result.perUser)){
      stats.tags=stats.tags.filter(tag=>tag!=='win');if(id===m.id)stats.tags.push('win');
    }
    this.result.mvps.sort((a,b)=>Number(b.userId===m.id)-Number(a.userId===m.id));
    if(this.individual)for(const card of this.result.mvps){const racer=this.marbles.find(p=>p.id===card.userId)!;card.stat=this.ctx.setup.gameId==='jelly-jam'?`${racer.score} ESCAPE PTS`:racer.id===m.id?'ROUND CHAMPION':racer.alive?'SURVIVED':'ELIMINATED';}
  }
  protected finish():Winner{
    if(!this.marbles.length)return{kind:'void',reason:'Nobody joined this round'};
    if(this.individual){const m=[...this.marbles].sort((a,b)=>b.score-a.score)[0];this.champion??={marble:m,reason:'MOST PROGRESS AT THE BELL'};return this.winner(m.team);}
    return this.best(this.teamScores());
  }
  protected teamProgress(value:(team:TeamId)=>number):void{this.ctx.hud.setTeams(this.teams.map(team=>({team,value:Math.max(0,Math.min(1,value(team)))})));}
}
