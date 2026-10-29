import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { games } from '../apps/show/src/games/registry';
import { simulate } from './simulation';
const args=process.argv.slice(2);const get=(name:string,fallback:string)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1];};
const selected=get('game','all');const runs=Number(get('runs','200'));const mode=get('mode','all');const difficulty=Number(get('difficulty','.5'));const seed=Number(get('seed','1'));
if(!Number.isInteger(runs)||runs<1||runs>10000)throw new Error('--runs must be 1–10000');
const rows:string[]=[];let failed=false;
for(const game of games.filter(g=>selected==='all'||g.id===selected))for(const m of game.modes.filter(m=>mode==='all'||m===mode)){
  let streamer=0,chat=0,timeouts=0,duration=0,highlights=0,bodies=0;const teams:Record<string,number>={};
  for(let i=0;i<runs;i++){const sim=await simulate({game:game.id,seed:seed+i,mode:m,difficulty,participants:Number(get('participants','60')),teams:Number(get('teams','4')),modifiers:get('modifier','').split(',').filter(Boolean)});const w=sim.result.winner;if(w.kind==='streamer')streamer++;if(w.kind==='chat')chat++;if(w.kind==='team')teams[w.teamId]=(teams[w.teamId]??0)+1;timeouts+=Number(sim.timeout);duration+=sim.duration;highlights+=sim.result.highlights.filter(e=>e.t==='moment').length;bodies=Math.max(bodies,sim.bodies);if(i%20===19)process.stderr.write(`${game.id}/${m}: ${i+1}/${runs}\n`);}
  const rate=streamer/runs*100;const balance=m==='cvs'?(rate>=40&&rate<=60?'PASS':'NEEDS TUNING'):'—';
  const row=`| ${game.id} | ${m} | ${runs} | ${m==='cvs'?rate.toFixed(1)+'%':Object.entries(teams).map(([t,n])=>`${t}:${n}`).join(' ')} | ${(duration/runs).toFixed(1)}s | ${timeouts} | ${(highlights/runs).toFixed(1)} | ${bodies} | ${balance} |`;rows.push(row);console.log(row);if(timeouts)failed=true;
}
if(!rows.length)throw new Error('No matching game/mode');
await mkdir('qa',{recursive:true});const reportPath=get('report','qa/sim-report.md');let outputRows=rows;
if(args.includes('--merge')){try{const old=await readFile(reportPath,'utf8');const map=new Map(old.split('\n').filter(r=>/^\| [a-z]/.test(r)).map(r=>[r.split('|').slice(1,3).join('|'),r]));for(const row of rows)map.set(row.split('|').slice(1,3).join('|'),row);outputRows=[...map.values()];}catch{/* First report. */}}
const report=`# Headless simulation report\n\nGenerated ${new Date().toISOString()}. Seed starts at ${seed}; difficulty ${difficulty}; bot input delay 2.5–4.5 s. Results are measured, not hand-picked.\n\n| Game | Mode | Runs | Streamer win rate / team wins | Mean duration | Timeouts | Big moments | Max bodies | CvS balance |\n|---|---|---:|---|---:|---:|---:|---:|---|\n${outputRows.join('\n')}\n`;
await writeFile(reportPath,report);
if(args.includes('--update-readmes'))for(const game of games){const path=`apps/show/src/games/${game.id}/README.md`;try{const body=await readFile(path,'utf8');const data=rows.filter(r=>r.includes(`| ${game.id} |`));if(data.length)await writeFile(path,body.split('## Measured simulation')[0]+`## Measured simulation\n\n${report.split('| Game |')[0].split('\n').slice(2).join('\n')}\n\n| Game | Mode | Runs | Streamer win rate / team wins | Mean duration | Timeouts | Big moments | Max bodies | CvS balance |\n|---|---|---:|---|---:|---:|---:|---:|---|\n${data.join('\n')}\n`);}catch{/* Documentation generator can run separately. */}}
if(failed)process.exitCode=1;
