import { TEAMS,type ChatGameInput,type StreamerInput,type TeamId,type Winner,type RoundResult } from '@chaos/shared';
import type { GameContext } from '../games/contract';
import { BaseGame } from './base-game';
import type { Marble } from './marble';

export type EventStanding=NonNullable<RoundResult['standings']>[number];
/** Machine pieces have no viewer ownership. Audience size and wagers never enter physics. */
export abstract class SpectatorGame extends BaseGame {
  readonly teams:TeamId[];
  constructor(ctx:GameContext,target:number){
    super(ctx,target);ctx.setup.participants=[];this.teams=ctx.rng.shuffle(ctx.setup.teams??['red','blue','mint','gold']);
  }
  onChat(_input:ChatGameInput):void{}
  onStreamer(_input:StreamerInput):void{}
  protected machineBall(team:TeamId,index:number,x:number,y:number,radius=14):Marble{
    const m=this.spawn({userId:`machine:${team}:${index}`,login:'machine',displayName:`${team.toUpperCase()} FEEDER ${index+1}`,color:TEAMS[team].color,teamId:team},x,y,radius);
    m.showLabel=false;return m;
  }
  protected teamProgress(value:(team:TeamId)=>number):void{this.ctx.hud.setTeams(this.teams.map(team=>({team,value:Math.max(0,Math.min(1,value(team)))})));}
  protected abstract ranking():EventStanding[];
  protected rankedWinner():Winner{
    const rows=this.ranking(),best=Math.max(...rows.map(row=>row.score));return this.winner(this.ctx.rng.pick(rows.filter(row=>row.score===best)).teamId);
  }
  protected complete(winner:Winner):void{
    // Projectiles already in flight keep moving through the slow-motion finish.
    // Rank the final physical state if they destroy the provisional winner.
    if(winner.kind==='team'){
      const teamId=winner.teamId,rows=this.ranking(),chosen=rows.find(row=>row.teamId===teamId);
      if(chosen&&chosen.score<Math.max(...rows.map(row=>row.score)))winner=this.rankedWinner();
    }
    super.complete(winner);if(!this.result)return;
    this.result.perUser={};this.result.mvps=[];
    this.result.standings=this.ranking().sort((a,b)=>b.score-a.score);
    if(winner.kind==='team')this.result.standings.sort((a,b)=>Number(b.teamId===winner.teamId)-Number(a.teamId===winner.teamId));
  }
}
