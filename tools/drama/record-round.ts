import type { RoundResult } from '@chaos/shared';
import type { RoundRecording } from './capture-format';

/** Serialized by Playwright; keep browser execution self-contained. */
export async function recordRound({minimum,safety,game,seed}:{minimum:number;safety:number;game:string;seed:number}):Promise<RoundRecording> {
  const stream=await window.__chaos.captureStream(),mimeType=['video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t)),recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6_000_000,audioBitsPerSecond:128_000});
  const chunks:Blob[]=[],samples:RoundRecording['samples']=[],finished=new Map<string,{wall:number;game:number;actorId:string;name:string}>(),captureErrors:string[]=[];
  const initialState=window.__chaos.inspect(),initial=initialState.marbles.filter(m=>m.alive&&!m.dormant).length;
  if(window.__chaos.gameId!==game||window.__chaos.seed!==seed||initialState.time!==0||!window.__chaos.paused)throw new Error('Recording must prepare the requested paused round at game time0');
  let previousAlive=new Set(initialState.marbles.filter(m=>m.alive&&!m.dormant).map(m=>m.id)),lastGame=0,firstBlood:RoundRecording['firstBlood']=null,finalFew:RoundRecording['finalFew']=null,publishedResult:RoundRecording['publishedResult']=null,result:RoundResult|null=null;
  let started=0,wallSeconds=0,stopping=false,interval:ReturnType<typeof setInterval>|undefined,capTimer:ReturnType<typeof setTimeout>|undefined,stopReason:RoundRecording['stopReason']='safety-cap',recorderOnstartDelaySeconds:number|undefined;
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const sample=()=>{
    const c=window.__chaos,s=c.inspect(),live=s.marbles.filter(m=>m.alive&&!m.dormant),wall=(performance.now()-started)/1000,stamp={wall,game:s.time};
    if(c.gameId!==game||c.seed!==seed||s.time<lastGame-1e-8)throw new Error('The round changed or restarted during recording');lastGame=s.time;
    const nowAlive=new Set(live.map(m=>m.id));if([...previousAlive].some(id=>!nowAlive.has(id)))firstBlood??=stamp;previousAlive=nowAlive;
    if(live.length>=2&&live.length<=4)finalFew??=stamp;
    for(const m of s.marbles)if(m.finished&&!finished.has(m.id))finished.set(m.id,{...stamp,actorId:m.id,name:m.name});
    if(c.phase==='RESULT'&&!publishedResult){if(!c.result)throw new Error('RESULT phase has no published result');publishedResult=stamp;result=structuredClone(c.result) as RoundResult;}
    samples.push({wall,time:s.time,alive:live.length,phase:c.phase,zoom:c.cameraZoom,minScreenRadius:live.length?Math.min(...live.map(m=>m.radius*c.cameraZoom)):0,contenders:live.length<=4?live.map(m=>m.name):[]});
    return wall;
  };
  const stop=(reason:RoundRecording['stopReason'])=>{if(stopping)return;stopping=true;stopReason=reason;wallSeconds=(performance.now()-started)/1000;if(interval)clearInterval(interval);if(capTimer)clearTimeout(capTimer);if(recorder.state!=='inactive')recorder.stop();};
  // Warm audio/encoder/stream first while paused, then ensure a running frame is
  // rendered. No PAUSED prefix is deliberately recorded while onstart is pending.
  window.__chaos.command('resume');
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const recordingStartGameSeconds=window.__chaos.inspect().time;
  await new Promise<void>((done,fail)=>{
    recorder.onerror=e=>{captureErrors.push(`MediaRecorder error: ${String(e)}`);stop('capture-error');};
    recorder.onstop=()=>done();
    recorder.onstart=()=>{recorderOnstartDelaySeconds=(performance.now()-started)/1000;};
    const tick=()=>{try{const wall=sample();if(wall>=minimum&&publishedResult&&wall>=publishedResult.wall+5.1)stop('result-and-payoff');else if(wall>=safety)stop('safety-cap');}catch(error){captureErrors.push(String(error));stop('capture-error');}};
    // MediaRecorder.onstart can arrive seconds after recording begins. Every
    // timer/sample uses this immediate invocation origin, never that callback.
    started=performance.now();
    try{
      recorder.start(1000);tick();if(stopping)return;
      interval=setInterval(tick,50);capTimer=setTimeout(()=>{
        try{const wall=sample();stop(wall>=minimum&&publishedResult&&wall>=publishedResult.wall+5?'result-and-payoff':'safety-cap');}
        catch(error){captureErrors.push(String(error));stop('capture-error');}
      },Math.max(0,safety*1000-(performance.now()-started)));
    }catch(error){fail(error);}
  });
  const blob=new Blob(chunks,{type:recorder.mimeType}),blobUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=blobUrl;a.download='raw-capture.webm';document.body.append(a);a.click();a.remove();for(const track of stream.getVideoTracks())track.stop();
  return {mimeType:recorder.mimeType,bytes:blob.size,physicsVersion:window.__chaos.physicsVersion,initial,wallSeconds,stopReason,captureErrors,firstBlood,finalFew,publishedResult,finishedByActor:Object.fromEntries(finished),result,samples,captureInvocationPerformanceMs:started,recordingStartGameSeconds,recorderOnstartDelaySeconds};
}
