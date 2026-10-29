import type { RoundResult } from '@chaos/shared';

export interface BeatStamp {wall:number;game:number}
export interface FinishedStamp extends BeatStamp {actorId:string;name:string}
export interface CaptureSample {wall:number;time:number;alive:number;phase:string;zoom:number;minScreenRadius:number;contenders:string[]}
export interface RoundRecording {
  mimeType:string;bytes:number;physicsVersion:string;initial:number;wallSeconds:number;
  stopReason:'result-and-payoff'|'safety-cap'|'capture-error';captureErrors:string[];
  firstBlood:BeatStamp|null;finalFew:BeatStamp|null;publishedResult:BeatStamp|null;
  finishedByActor:Record<string,FinishedStamp>;result:RoundResult|null;samples:CaptureSample[];
  captureInvocationPerformanceMs?:number;recordingStartGameSeconds?:number;recorderOnstartDelaySeconds?:number;
}
export function decisionBeat(recording:Pick<RoundRecording,'result'|'finishedByActor'|'publishedResult'>):{kind:'champion-finished'|'published-result';stamp:BeatStamp;actorId?:string;name?:string}|null {
  const champion=recording.result?.champion,finished=champion?recording.finishedByActor[champion.userId]:undefined;
  if(finished)return {kind:'champion-finished',stamp:finished,actorId:champion!.userId,name:champion!.displayName};
  return recording.publishedResult?{kind:'published-result',stamp:recording.publishedResult}:null;
}
export function videoTime(seconds:number):string {const units=Math.max(0,Math.round(seconds*100)),minutes=Math.floor(units/6000),rest=(units%6000)/100;return`${String(minutes).padStart(2,'0')}:${rest.toFixed(2).padStart(5,'0')}`;}
export function stampText(stamp:BeatStamp|null):string{return stamp?`video ${videoTime(stamp.wall)} / game ${stamp.game.toFixed(3)}s`:'video not observed / game not observed';}
const singleLine=(s:string)=>s.replace(/[\r\n\t]+/g,' ');
export function beatLog(recording:RoundRecording):string {
  const decision=decisionBeat(recording),published=recording.publishedResult;
  const line=decision?.kind==='champion-finished'?`${stampText(decision.stamp)} — ${singleLine(decision.name??decision.actorId??'Champion')}'s finish first observed; result published ${stampText(published)}.`:decision?`${stampText(decision.stamp)} — round result published; no champion finish flag was observed.`:`${stampText(null)} — no published result within the full recording (${recording.stopReason}).`;
  return [`First blood: ${stampText(recording.firstBlood)} — first elimination observed.`,`Final few: ${stampText(recording.finalFew)} — first field of 2–4 live contenders observed.`,`Decision: ${line}`].join('\n')+'\n';
}
export function coverage(recording:Pick<RoundRecording,'publishedResult'|'wallSeconds'>,videoDuration:number):{includesResult:boolean;postResultSeconds:number;includesFullPayoff:boolean} {
  if(!Number.isFinite(videoDuration)||videoDuration<=0||!Number.isFinite(recording.wallSeconds)||recording.wallSeconds<0)throw new Error('Coverage requires finite measured media/wall durations');
  const end=Math.min(recording.wallSeconds,videoDuration),published=recording.publishedResult?.wall,includesResult=published!==undefined&&published<=end;
  const postResultSeconds=includesResult?Math.max(0,end-published!):0;
  return {includesResult,postResultSeconds,includesFullPayoff:includesResult&&postResultSeconds>=5-1e-6};
}
