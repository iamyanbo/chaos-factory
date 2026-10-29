import { TEAMS,TEAM_IDS,type Mode,type RoundSetup } from '@chaos/shared';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { createContext } from '../../apps/show/src/engine/context';
import { registry } from '../../apps/show/src/games/registry';
import type { GameDefinition,GameInstance } from '../../apps/show/src/games/contract';
import type { Marble } from '../../apps/show/src/kit/marble';
import type { DramaState } from '../../apps/show/src/kit/drama-types';
import { DramaCollector,type DramaFrame,type DramaRun } from './metrics';

export interface DramaOptions {game:string;participants:number;teams:number;mode:Mode;competition?:'individual'|'team'}
interface TrackedGame extends GameInstance {time:number;marbles:Marble[];progress?:Map<string,number>;crossings?:{id:string;ring:number;time:number}[];rings?:{rings:{rx:number;ry:number;body:{translation():{x:number;y:number}}}[]}}
export function dramaDefinition(id:string):GameDefinition {const def=registry.get(id);if(!def)throw new Error(`Unknown game: ${id}`);return def;}
export function dramaSetup(options:DramaOptions,seed:number):RoundSetup {
  const def=dramaDefinition(options.game),teams=TEAM_IDS.slice(0,options.teams),count=def.spectator?0:Math.min(options.participants,def.maxParticipants);
  if(!def.spectator&&count!==options.participants)throw new Error(`Requested ${options.participants} entrants exceeds ${def.maxParticipants} ceiling`);
  return {gameId:def.id,seed,mode:options.mode,competition:options.competition??'individual',difficulty:.5,modifiers:[],streamerName:'FACTORY BOSS',teams,participants:Array.from({length:count},(_,i)=>({userId:`bot${i}`,login:`bot${i}`,displayName:`BOT ${i}`,teamId:teams[i%teams.length],color:TEAMS[teams[i%teams.length]].color}))};
}
/** Structural baseline adapter; it never imports, changes or steps a game plugin. */
export class DramaAdapter {
  private crossed=0;
  constructor(readonly id:string,readonly game:TrackedGame,readonly collector:DramaCollector){}
  state():DramaState {
    if(this.game.dramaState)return this.game.dramaState();
    if(this.id==='last-on-tray')return {kind:'survival',progress:{}};
    if(this.id!=='ring-escape')throw new Error(`${this.id} needs GameInstance.dramaState() before it can be measured`);
    const progress:Record<string,number>={},rings=this.game.rings?.rings??[];
    for(const m of this.game.marbles){const depth=this.game.progress?.get(m.id)??Math.floor(m.score/10000),next=rings[depth],previous=rings[depth-1];let fraction=0;
      if(next){const origin=next.body.translation(),dx=m.x-origin.x*50,dy=m.y-origin.y*50,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),ray=(r:{rx:number;ry:number})=>1/Math.hypot(Math.cos(angle)/r.rx,Math.sin(angle)/r.ry),outer=ray(next),inner=previous?ray(previous):0;fraction=Math.max(0,Math.min(.999999,(d-inner)/Math.max(1,outer-inner)));}
      progress[m.id]=depth+fraction;
    }return {kind:'race',progress};
  }
  observe():void {
    if(!Array.isArray(this.game.marbles))throw new Error('Drama measurement requires physical marble actor state');
    const state=this.state();
    // Only the unchanged legacy Ring ledger is adapted. New games report their
    // own physical crossings via ctx.drama; progress snapshots are not events.
    if(!this.game.dramaState&&this.id==='ring-escape')for(const crossing of (this.game.crossings??[]).slice(this.crossed))this.collector.physical({kind:'ring-pass',time:crossing.time,actorId:crossing.id,hazardId:`ring:${crossing.ring}`});
    this.crossed=this.game.crossings?.length??0;
    const frame:DramaFrame={time:this.game.time,kind:state.kind,actors:this.game.marbles.map(m=>({id:m.id,team:m.team,alive:m.alive&&!m.dormant,radius:m.radius,finished:m.finished,progress:state.kind==='race'?state.progress[m.id]:0}))};this.collector.observe(frame);
  }
}
export async function measureDrama(options:DramaOptions,seed:number):Promise<DramaRun> {
  await initPhysics();const def=dramaDefinition(options.game),collector=new DramaCollector(def.durationSec.target),setup=dramaSetup(options,seed),ctx=createContext(def,setup,{drama:collector.physical});
  let game:TrackedGame|undefined,report:DramaRun|undefined;
  try {
    game=def.create(ctx) as TrackedGame;const adapter=new DramaAdapter(def.id,game,collector);adapter.observe();
    const admitted=game.marbles.filter(m=>m.alive&&!m.dormant).length;
    if(admitted!==setup.participants.length)throw new Error(`Requested ${setup.participants.length} entrants but only ${admitted} started`);
    game.start();
    for(let tick=0;tick<def.durationSec.hardCap*60;tick++){
      game.step(1/60);adapter.observe();const status=game.status();if(typeof status==='object'&&'done'in status){report=collector.finish(seed,status.done,false);break;}
    }report??=collector.finish(seed,undefined,true);
  }catch(error){report=collector.finish(seed,undefined,false,String(error));}
  finally{
    const cleanupErrors:string[]=[];try{game?.destroy();}catch(error){cleanupErrors.push(`Game cleanup: ${String(error)}`);}try{ctx.physics.destroy();}catch(error){cleanupErrors.push(`Physics cleanup: ${String(error)}`);}
    if(cleanupErrors.length){report??=collector.finish(seed,undefined,false);report.error=[report.error,...cleanupErrors].filter(Boolean).join('; ');}
  }
  return report;
}
