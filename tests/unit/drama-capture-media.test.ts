import { expect,test } from 'vitest';
import { finalizeRecording,parseProbe,type MediaCommand } from '../../tools/drama/capture-media';
import { coverage } from '../../tools/drama/capture-format';

test('unknown MediaRecorder duration cannot silently become NaN/null metadata',()=>{
  for(const duration of [undefined,null,'N/A','NaN','Infinity','',0,-1])expect(()=>parseProbe({format:{duration}})).toThrow('finite positive duration');
  expect(()=>parseProbe({streams:[]})).toThrow('remuxing before probing');
});
test('finalized probe preserves a real finite duration and stream properties',()=>{
  expect(parseProbe({format:{duration:'69.819'},streams:[{codec_type:'video',width:1920,height:1080},{codec_type:'audio'}]})).toEqual({duration:69.819,video:{width:1920,height:1080},audioTracks:1});
});
test('full recording remux precedes probing and stream-copies without speed filters',()=>{
  const calls:{binary:string;params:string[]}[]=[],run:MediaCommand=(binary,params)=>{calls.push({binary,params});return binary==='ffprobe'?JSON.stringify({format:{duration:'68.2'},streams:[{codec_type:'video'}]}):'';};
  expect(finalizeRecording('raw-capture.webm','full-round.webm',run).duration).toBe(68.2);
  expect(calls.map(c=>c.binary)).toEqual(['ffmpeg','ffprobe']);
  expect(calls[0].params).toEqual(['-hide_banner','-loglevel','error','-y','-i','raw-capture.webm','-map','0:v:0','-map','0:a?','-c','copy','full-round.webm']);
  expect(calls[1].params.at(-1)).toBe('full-round.webm');
  expect(()=>finalizeRecording('same.webm','same.webm',run)).toThrow('different paths');
});
test('nonfinite coverage inputs fail explicitly and a genuinely short payoff remains incomplete',()=>{
  const recording={wallSeconds:68.3096,publishedResult:{wall:63.188,game:61.733}};
  expect(()=>coverage(recording,NaN)).toThrow('finite measured');
  expect(()=>coverage(recording,Infinity)).toThrow('finite measured');
  expect(coverage(recording,69.819)).toMatchObject({includesResult:true,includesFullPayoff:true,postResultSeconds:68.3096-63.188});
  expect(coverage(recording,68.18)).toMatchObject({includesResult:true,includesFullPayoff:false,postResultSeconds:68.18-63.188});
});
