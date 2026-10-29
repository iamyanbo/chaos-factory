import type { RoundResult } from '@chaos/shared';
import type { DramaKind,DramaPhysicalEvent } from '../../apps/show/src/kit/drama-types';
import { targetAliveFraction } from '../../apps/show/src/kit/drama-curve';

export interface ActorFrame {id:string;team?:string;alive:boolean;radius:number;progress:number;finished?:boolean}
export interface DramaFrame {time:number;kind:DramaKind;actors:ActorFrame[]}
export interface DramaEvent extends Omit<DramaPhysicalEvent,'kind'> {kind:DramaPhysicalEvent['kind']|'elimination'|'lead-change';fromActorId?:string;source?:string}
export interface DramaRun {
  seed:number;kind:DramaKind;duration:number;targetDuration:number;initial:number;final:number;
  winner:RoundResult['winner'];championId?:string;timeout:boolean;error?:string;
  quietMax:number;burstMax:number;curveError:number;finalContest:number;leadChanges:number|null;
  lateDecision:boolean;nearMisses:number;nearMissCandidates:number;nearMissRejected:number;nearMissCensored:number;
  firstBlood:number|null;finalFewAt:number|null;decisionAt:number|null;events:DramaEvent[];invalidTelemetry:number;
}
export function median(values:number[]):number {if(!values.length)return 0;const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
export function longestQuiet(duration:number,times:number[]):number {const points=[0,...times.filter(t=>t>=0&&t<=duration).sort((a,b)=>a-b),duration];return Math.max(0,...points.slice(1).map((t,i)=>t-points[i]));}
/** Exclude the final two events only from the numerator; denominator is ALL losses. */
export function eliminationBurst(times:number[]):number {
  const all=[...times].sort((a,b)=>a-b),eligible=all.slice(0,Math.max(0,all.length-2));let left=0,best=0;
  for(let right=0;right<eligible.length;right++){while(eligible[right]-eligible[left]>3+1e-9)left++;best=Math.max(best,right-left+1);}return all.length?best/all.length:0;
}
/** Fixed upfront population: count only still-undecided time, never the finale. */
export function preDecisionContest(initial:number,eliminationTimes:number[],decisionAt:number):number {
  if(!Number.isSafeInteger(initial)||initial<0||!Number.isFinite(decisionAt)||decisionAt<0||eliminationTimes.some(t=>!Number.isFinite(t)||t<0))throw new Error('Invalid fixed-population contest timeline');
  let alive=initial,previous=0,contest=0;
  for(const at of [...eliminationTimes].sort((a,b)=>a-b)){
    if(at>decisionAt)break;
    if(alive>=2&&alive<=4)contest+=at-previous;
    alive--;previous=at;
  }
  if(alive>=2&&alive<=4)contest+=decisionAt-previous;
  return contest;
}
const EPS=1e-8;
interface Approach {armed:boolean;last:number}
interface PendingNear {event:DramaPhysicalEvent;done:boolean}

export class DramaCollector {
  readonly events:DramaEvent[]=[];readonly actorTeams=new Map<string,string>();
  private frame?:DramaFrame;private queue:DramaPhysicalEvent[]=[];private approaches=new Map<string,Approach>();
  private pending:PendingNear[]=[];private deaths=new Map<string,number[]>();private hitAt=new Map<string,number>();
  private confirmed?:string;private candidate?:string;private candidateAt=0;
  private actorLock?:{id:string;since:number};private teamLock?:{id:string;since:number};private soleAt?:number;
  private initialTeams=0;private soleTeam?:{id:string;at:number};
  private finishedAt=new Map<string,number>();private errorIntegral=0;private n=0;
  private firstBlood:number|null=null;private finalFewAt:number|null=null;private invalid=0;private rejected=0;
  constructor(readonly targetDuration:number){}
  physical=(event:DramaPhysicalEvent):void=>{this.queue.push({...event});};
  observe(next:DramaFrame):void {
    const previous=this.frame;if(previous&&next.time<previous.time-EPS)throw new Error('Drama time moved backwards');
    if(previous&&next.kind!==previous.kind)throw new Error('Drama kind changed during a round');
    const old=new Map(previous?.actors.map(a=>[a.id,a])??[]),current=new Map(next.actors.map(a=>[a.id,a]));
    if(current.size!==next.actors.length)throw new Error('Duplicate drama actor IDs');
    for(const actor of next.actors){if(actor.team)this.actorTeams.set(actor.id,actor.team);if(next.kind==='race'&&actor.alive&&!Number.isFinite(actor.progress))throw new Error(`Missing/non-finite race progress: ${actor.id}`);if(actor.finished&&!this.finishedAt.has(actor.id))this.finishedAt.set(actor.id,next.time);}
    const alive=next.actors.filter(a=>a.alive),before=previous?.actors.filter(a=>a.alive).length??alive.length;
    if(!previous){this.n=alive.length;this.initialTeams=new Set(alive.flatMap(a=>a.team?[a.team]:[])).size;}
    else {
      const dt=next.time-previous.time;
      if(this.n)this.errorIntegral+=(Math.abs(before/this.n-targetAliveFraction(previous.time,this.targetDuration,this.n))+Math.abs(alive.length/this.n-targetAliveFraction(next.time,this.targetDuration,this.n)))*dt/2;
      for(const actor of previous.actors)if(actor.alive&&!current.get(actor.id)?.alive){const at=next.time;this.events.push({kind:'elimination',time:at,actorId:actor.id,source:'alive-transition'});const times=this.deaths.get(actor.id)??[];times.push(at);this.deaths.set(actor.id,times);this.firstBlood??=at;}
    }
    if(alive.length>=2&&alive.length<=4)this.finalFewAt??=next.time;
    if(alive.length===1)this.soleAt??=next.time;
    if(this.initialTeams>1&&alive.length){const teams=new Set(alive.flatMap(a=>a.team?[a.team]:[]));if(teams.size===1)this.soleTeam??={id:[...teams][0],at:next.time};}
    for(const event of this.queue){
      if(!['hazard-hit','near-miss','ring-pass'].includes(event.kind)||!Number.isFinite(event.time)||event.time<0||event.time>next.time+EPS||event.time<(previous?.time??0)-1/60-EPS||!event.actorId||(!old.get(event.actorId)?.alive&&!current.get(event.actorId)?.alive)) {this.invalid++;continue;}
      if(event.kind==='near-miss')this.near(event,[old.get(event.actorId)?.radius,current.get(event.actorId)?.radius]);
      else {
        const key=`${event.kind}:${event.actorId}:${event.hazardId??''}`,at=this.hitAt.get(key)??-Infinity;
        if(event.time-at<1-EPS)continue;this.hitAt.set(key,event.time);this.events.push({...event,source:'physical-callback'});
      }
    }this.queue=[];
    for(const p of this.pending){if(p.done||next.time<p.event.time+1-EPS)continue;p.done=true;const lost=(this.deaths.get(p.event.actorId)??[]).some(t=>t>=p.event.time-EPS&&t<p.event.time+1-EPS);if(lost){this.rejected++;continue;}this.events.push({...p.event,source:'physical-near-miss-survived-1s'});}
    if(next.kind==='race')this.race(next.time,alive);
    this.frame=next;
  }
  private near(event:DramaPhysicalEvent,physicalRadii:(number|undefined)[]):void {
    const {radius:r,clearance:d,hazardId}=event;
    if(!hazardId||r===undefined||d===undefined||!Number.isFinite(r)||!Number.isFinite(d)||r<=0||!physicalRadii.some(actual=>actual!==undefined&&Math.abs(actual-r)<EPS)){this.invalid++;return;}
    const key=`${event.actorId}:${hazardId}`,state=this.approaches.get(key)??{armed:true,last:-Infinity};this.approaches.set(key,state);
    // Far samples are hysteresis telemetry, never events or quiet-gap fillers.
    if(d>r){state.armed=true;return;}if(d<0||d>.5*r||!state.armed)return;
    state.armed=false;if(event.time-state.last<1-EPS)return;state.last=event.time;this.pending.push({event,done:false});
  }
  private race(time:number,alive:ActorFrame[]):void {
    const ranked=[...alive].sort((a,b)=>b.progress-a.progress),unique=ranked.length&&(ranked.length===1||ranked[0].progress-ranked[1].progress>EPS)?ranked[0]:undefined;
    if(!unique){this.candidate=undefined;this.actorLock=undefined;}
    else {
      if(this.candidate!==unique.id){this.candidate=unique.id;this.candidateAt=time;}
      if(time-this.candidateAt>=1-EPS&&this.confirmed!==unique.id){if(this.confirmed)this.events.push({kind:'lead-change',time,actorId:unique.id,fromActorId:this.confirmed,source:'unique-leader-dwell-1s'});this.confirmed=unique.id;}
      const margin=ranked.length>1?unique.progress-ranked[1].progress:Infinity;
      if(margin>=1-EPS){if(this.actorLock?.id!==unique.id)this.actorLock={id:unique.id,since:time};}else this.actorLock=undefined;
    }
    const teams=new Map<string,number>();for(const a of alive)if(a.team)teams.set(a.team,Math.max(teams.get(a.team)??-Infinity,a.progress));
    const front=[...teams].sort((a,b)=>b[1]-a[1]);if(front.length&&(front.length===1||front[0][1]-front[1][1]>=1-EPS)){if(this.teamLock?.id!==front[0][0])this.teamLock={id:front[0][0],since:time};}else this.teamLock=undefined;
  }
  finish(seed:number,result:RoundResult|undefined,timeout:boolean,error?:string):DramaRun {
    const frame=this.frame??{time:0,kind:'survival' as const,actors:[]},duration=frame.time,winner=result?.winner??{kind:'void' as const,reason:error??'Simulation hard cap'},championId=result?.champion?.userId;
    const events=[...this.events].sort((a,b)=>a.time-b.time||a.kind.localeCompare(b.kind)||a.actorId.localeCompare(b.actorId)),elims=events.filter(e=>e.kind==='elimination').map(e=>e.time);
    const winningTeam=winner.kind==='team'?winner.teamId:winner.kind==='chat'?'chat':winner.kind==='streamer'?'streamer':undefined;
    const lock=championId?this.actorLock?.id===championId?this.actorLock:undefined:winningTeam&&this.teamLock?.id===winningTeam?this.teamLock:undefined;
    const late=frame.kind==='race'?Boolean(lock&&lock.since<.75*duration-EPS):this.soleAt!==undefined&&this.soleAt<.75*duration-EPS;
    const championFinished=championId?this.finishedAt.get(championId):undefined,escape=championId?events.find(e=>e.kind==='ring-pass'&&e.actorId===championId&&e.hazardId==='ring:6')?.time:undefined;
    const teamFinishers=new Set<string>(),teamEscapes=winningTeam&&!championId?events.filter(e=>{if(e.kind!=='ring-pass'||e.hazardId!=='ring:6'||this.actorTeams.get(e.actorId)!==winningTeam||teamFinishers.has(e.actorId))return false;teamFinishers.add(e.actorId);return true;}):[];
    const survivalDecision=!championId&&winner.kind==='team'?(this.initialTeams>1&&this.soleTeam&&this.soleTeam.id===winningTeam?this.soleTeam.at:duration):this.soleAt??championFinished??duration;
    const decisionAt=Math.min(duration,frame.kind==='survival'?survivalDecision:escape??championFinished??teamEscapes[2]?.time??duration);
    return {seed,kind:frame.kind,duration,targetDuration:this.targetDuration,initial:this.n,final:frame.actors.filter(a=>a.alive).length,winner,...(championId?{championId}:{}),timeout,...(error?{error}:{}),quietMax:longestQuiet(duration,events.map(e=>e.time)),burstMax:eliminationBurst(elims),curveError:duration&&this.n?this.errorIntegral/duration:1,finalContest:preDecisionContest(this.n,elims,decisionAt),leadChanges:frame.kind==='race'?events.filter(e=>e.kind==='lead-change').length:null,lateDecision:late,nearMisses:events.filter(e=>e.kind==='near-miss').length,nearMissCandidates:this.pending.length,nearMissRejected:this.rejected,nearMissCensored:this.pending.filter(p=>!p.done).length,firstBlood:this.firstBlood,finalFewAt:this.finalFewAt,decisionAt,events,invalidTelemetry:this.invalid};
  }
}
