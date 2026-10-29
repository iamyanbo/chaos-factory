import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beatLog,coverage,decisionBeat } from './drama/capture-format';
import { command,probe,finalizeRecording } from './drama/capture-media';
import { recordRound } from './drama/record-round';

const args=process.argv.slice(2),get=(name:string,fallback:string)=>{const n=args.indexOf(`--${name}`);return n<0?fallback:args[n+1];};
const game=get('game','ring-escape'),seed=Number(get('seed','1')),minimum=Number(get('seconds','60')),safety=Number(get('max-seconds','150')),competition=get('competition','individual');
if(!/^[a-z][a-z0-9-]*$/.test(game)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!Number.isFinite(minimum)||minimum<60||!Number.isFinite(safety)||safety<120||safety>150||minimum>safety||!['individual','team'].includes(competition))throw new Error('Use a valid game/seed, minimum --seconds >=60, --max-seconds in120–150, and --competition individual|team');
const name=game==='ring-escape'?'ring-run':game==='last-on-tray'?'hot-plate':game,directory=resolve(get('out',`qa/drama/${name}`)),base=process.env.CHAOS_TEST_URL??'http://127.0.0.1:5173';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,acceptDownloads:true});await page.addInitScript('globalThis.__name = (fn) => fn;');
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try {
  const url=new URL('/play',base);for(const [key,value]of Object.entries({game,seed:String(seed),bots:'24',teams:'4',competition,record:'1',paused:'1'}))url.searchParams.set(key,value);
  await page.goto(url.href);await page.waitForFunction(()=>window.__chaos?.phase==='PLAY'&&window.__chaos.paused);await page.mouse.click(960,540);
  const [capture,download]=await Promise.all([
    page.evaluate(recordRound,{minimum,safety,game,seed}),
    page.waitForEvent('download',{timeout:(safety+45)*1000})
  ]);
  const rawPath=resolve(directory,'raw-capture.webm'),fullPath=resolve(directory,'full-round.webm'),previewPath=resolve(directory,'normal-speed.webm');await download.saveAs(rawPath);const fullMedia=finalizeRecording(rawPath,fullPath);
  // Stream-copy the first nominal60seconds. There is no speed/fps filter or re-encoding.
  command('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',fullPath,'-t','60','-map','0:v:0','-map','0:a?','-c','copy',previewPath]);
  const previewMedia=probe(previewPath),fullCoverage=coverage(capture,fullMedia.duration),previewCoverage=coverage(capture,Math.min(60,previewMedia.duration));
  const metadata={game,seed,competition,participants:24,teams:4,fast:false,audioSource:'procedural game mix only',timestampBasis:'Immediate recorder.start invocation after two running renders; beat stamps are first observations and label video-wall and fixed-game clocks separately; recorder onstart callback delay is diagnostic only',minimumWallSeconds:minimum,safetyCapSeconds:safety,...capture,decision:decisionBeat(capture),rawCapture:{file:'raw-capture.webm',bytes:capture.bytes},fullRound:{file:'full-round.webm',sourceFile:'raw-capture.webm',streamCopy:true,...fullMedia,...fullCoverage},preview:{file:'normal-speed.webm',nominalSeconds:60,speed:1,...previewMedia,...previewCoverage}};
  await writeFile(resolve(directory,'capture.json'),JSON.stringify(metadata,null,2));await writeFile(resolve(directory,'beat-log.md'),beatLog(capture));
  command('python',['tools/drama-contact-sheet.py','--directory',directory]);
  console.log(JSON.stringify({game,seed,competition,fullRound:fullPath,preview:previewPath,contactSheet:resolve(directory,'contact-sheet.png'),beatLog:resolve(directory,'beat-log.md'),wallSeconds:capture.wallSeconds,stopReason:capture.stopReason,fullIncludesPayoff:fullCoverage.includesFullPayoff,previewIncludesResult:previewCoverage.includesResult,previewIncludesPayoff:previewCoverage.includesFullPayoff,errors:[...errors,...capture.captureErrors]},null,2));
  if(errors.length||capture.captureErrors.length||capture.stopReason!=='result-and-payoff'||!fullCoverage.includesFullPayoff||capture.initial!==24||fullMedia.duration<minimum-.25||Math.abs(previewMedia.duration-60)>.25||fullMedia.video.width!==1920||fullMedia.video.height!==1080||fullMedia.audioTracks===0)process.exitCode=1;
} finally {await browser.close();}
