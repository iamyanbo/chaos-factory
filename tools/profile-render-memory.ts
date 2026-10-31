import { chromium } from '@playwright/test';
import { WebSocket } from 'ws';
import { writeFile } from 'node:fs/promises';
const base='http://127.0.0.1:4180',browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-frame-rate-limit','--enable-precise-memory-info']}),page=await browser.newPage({viewport:{width:1920,height:1080}});
await page.addInitScript('globalThis.__name=(fn)=>fn;globalThis.__PIXI_RENDERER_INIT__=r=>globalThis.__profileRenderer=r;');const socket=new WebSocket(base.replace('http','ws')+'/ws');await new Promise<void>(r=>socket.once('open',r));socket.send(JSON.stringify({type:'hello',role:'dashboard'}));socket.send(JSON.stringify({type:'mock.swarm',viewers:200,activity:.45,delayMs:[2500,4500]}));
const samples:unknown[]=[];
try{
  await page.goto(base+'/show?fast=1&manual=1&seed=42&mute=1');await page.waitForFunction(()=>window.__chaos?.phase==='ATTRACT');const session=await page.context().newCDPSession(page);
  const rounds=process.argv.includes('--short')?3:10,sessions=process.argv.includes('--short')?1:2;
  for(let run=0;run<sessions;run++){
    await page.evaluate(n=>{window.__chaos.command('queue',Array.from({length:n},(_,i)=>i%2?'blade-brawl':'ring-escape'));window.__chaos.command('start');},rounds);
    await page.waitForFunction(()=>window.__chaos.phase==='PLAY');await session.send('HeapProfiler.collectGarbage');const initial=await session.send('Runtime.getHeapUsage');samples.push({run,phase:'first-play',...initial});console.log(JSON.stringify(samples.at(-1)));
    await page.waitForFunction(n=>window.__chaos.phase==='RESULT'&&(window.__chaos.show?.round??0)>=n,rounds,{timeout:240000});await page.evaluate(()=>window.__chaos.command('stop'));await session.send('HeapProfiler.collectGarbage');const final=await session.send('Runtime.getHeapUsage');samples.push({run,phase:'results',...final});console.log(JSON.stringify(samples.at(-1)));
    const resources=await page.evaluate(()=>{
      const r=(globalThis as unknown as {__profileRenderer:{gc:{_managedResources:{constructor:{name:string};data?:{byteLength?:number}}[];_managedResourceHashes:{context:{name:string;items:Record<string,unknown>}}[]};canvasText:{_activeTextures:Record<string,unknown>}}}).__profileRenderer;
      return{tracked:r.gc._managedResources.reduce((a,v)=>{const k=v.constructor.name;a[k]=(a[k]??0)+1;return a;},{} as Record<string,number>),hashes:r.gc._managedResourceHashes.map(h=>({name:h.context.name,count:Object.values(h.context.items??{}).filter(Boolean).length})),textKeys:Object.keys(r.canvasText._activeTextures).length,textures:Object.values(r.canvasText._activeTextures).filter(Boolean).length};
    });samples.push(resources);console.log(JSON.stringify(resources));
    if(process.argv.includes('--snapshot')){const chunks:string[]=[];session.on('HeapProfiler.addHeapSnapshotChunk',e=>chunks.push(e.chunk));await session.send('HeapProfiler.takeHeapSnapshot');await writeFile(`qa/session-${run}.heapsnapshot`,chunks.join(''));}
  }
  await writeFile('qa/render-memory-profile.json',JSON.stringify(samples,null,2));
}finally{socket.send(JSON.stringify({type:'mock.swarm',viewers:60,activity:.45,delayMs:[2500,4500]}));socket.close();await browser.close();}
