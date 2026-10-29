import { spawnSync } from 'node:child_process';

export type MediaCommand=(binary:string,params:string[])=>string;
export interface MediaInfo {duration:number;video:{width:number;height:number};audioTracks:number}
interface ProbeData {format?:{duration?:unknown};streams?:{codec_type?:string;width?:number;height?:number}[]}
export const command:MediaCommand=(binary,params)=>{
  const result=spawnSync(binary,params,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||`${binary} failed`);
  return result.stdout;
};
export function parseProbe(data:ProbeData,path='media'):MediaInfo {
  const duration=Number(data.format?.duration),streams=data.streams??[],video=streams.find(s=>s.codec_type==='video');
  if(!Number.isFinite(duration)||duration<=0)throw new Error(`Missing finite positive duration for ${path}; finalize the MediaRecorder WebM by remuxing before probing`);
  return {duration,video:{width:video?.width??0,height:video?.height??0},audioTracks:streams.filter(s=>s.codec_type==='audio').length};
}
export function probe(path:string,run:MediaCommand=command):MediaInfo {
  return parseProbe(JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',path])) as ProbeData,path);
}
/** MediaRecorder's non-seekable WebM commonly omits its duration header.
 * Preserve it separately, then write a finalized container without altering packets.
 */
export function finalizeRecording(rawPath:string,fullPath:string,run:MediaCommand=command):MediaInfo {
  if(rawPath===fullPath)throw new Error('Raw recording and finalized recording need different paths');
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',rawPath,'-map','0:v:0','-map','0:a?','-c','copy',fullPath]);
  return probe(fullPath,run);
}
