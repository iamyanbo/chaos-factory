import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { TEAM_IDS } from '@chaos/shared';
import { initPhysics,RAPIER } from '../apps/show/src/engine/physics';
import { dramaDefinition,measureDrama } from './drama/runner';
import { OPERATIONAL_DEFINITIONS,metricTable,summarizeDrama,type DramaSummary } from './drama/summary';
import type { DramaRun } from './drama/metrics';
import { parseDramaArgs as parseArgs,type DramaCli } from './drama/args';
import { dramaSeeds } from './drama/seeds';

export function parseDramaArgs(args:string[]):DramaCli{return parseArgs(args,dramaDefinition);}
export interface SavedDramaReport {
  generatedAt:string;spec:string;physicsVersion:string;options:DramaCli;targetDuration:number;
  definitions:string[];summary:DramaSummary;runs:(DramaRun&{measured:boolean;fairness:boolean})[];notes?:string[];
}
/** The same formatter is used when auditing retained physical event traces. */
export function dramaMarkdown(report:SavedDramaReport):string {
  const {options,summary}=report,def=dramaDefinition(options.game),measured=report.runs.filter(r=>r.measured),fairness=report.runs.filter(r=>r.fairness),json=resolve(options.out.replace(/\.(?:md|json)$/i,''))+'.json';
  return [`# Drama report: ${def.title}`,`\nGenerated ${report.generatedAt}. Rapier ${report.physicsVersion}. ${options.participants} requested entrants, ${options.teams} color teams, ${options.mode}; **${options.competition??'individual'} victory rule**; configured T=${report.targetDuration}s. Faction fairness measures winning colors in either victory rule.`, `\nOverall: **${summary.pass?'PASS':'FAIL'}**. ${options.runs} pacing runs, ${fairness.length} fairness seeds.`,metricTable(summary),`\nReliability: ${JSON.stringify(summary.reliability)}.`,...(report.notes??[]).map(n=>`\n${n}`), '\n## Operational definitions',...report.definitions.map(s=>`\n- ${s}`),'\n## Per-run pacing summaries','\n| Seed | Duration | Quiet | Burst | Curve | Final 2–4 | Leads | Early decision | Near misses | Outcome |','| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',...measured.map(r=>`| ${r.seed} | ${r.duration.toFixed(3)} | ${r.quietMax.toFixed(3)} | ${r.burstMax.toFixed(3)} | ${r.curveError.toFixed(3)} | ${r.finalContest.toFixed(3)} | ${r.leadChanges??'N/A'} | ${r.lateDecision?'YES':'no'} | ${r.nearMisses} | ${r.timeout?'TIMEOUT':r.error?'ERROR':JSON.stringify(r.winner)} |`),`\nPer-run events, discarded/censored near-miss counts and all fairness summaries: ${json}.`].join('\n');
}
export async function runDramaReport(options:DramaCli):Promise<boolean> {
  await initPhysics();const def=dramaDefinition(options.game),faction=options.mode==='faction',plan=dramaSeeds(options.runs,options.seed,faction),measuredSeeds=plan.measured,fairnessSeeds=plan.fairness,seeds=plan.unique,runs=new Map<number,DramaRun>();
  console.log(`Loaded ${def.id}, Rapier ${RAPIER.version()}, ${options.competition??'individual'} victory: ${options.runs} pacing runs; ${faction?'exactly 300 fairness seeds':'fairness N/A'}; ${seeds.length} unique simulations. Game modules are loaded before this message.`);
  for(const [i,seed]of seeds.entries()){
    const run=await measureDrama(options,seed);runs.set(seed,run);
    const pacing=measuredSeeds.includes(seed),problems=[...(run.timeout?['timeout']:[]),...(run.error?[run.error]:[]),...(run.winner.kind==='void'?['void']:[]),...(run.invalidTelemetry?[`${run.invalidTelemetry} invalid events`]:[]),...(pacing&&run.nearMisses<6?[`nearMisses=${run.nearMisses}`]:[]),...(pacing&&run.burstMax>.25+1e-9?[`burstMax=${run.burstMax.toFixed(3)}`]:[])];
    if(problems.length)console.error(`drama ${options.game} seed ${seed}: ${problems.join('; ')}`);
    if((i+1)%25===0||i+1===seeds.length)console.error(`drama ${options.game}: ${i+1}/${seeds.length}`);
  }
  return saveDramaReport(options,runs.values());
}
/** Reuse unchanged, source-verified pacing traces when completing fairness. */
export async function saveDramaReport(options:DramaCli,completed:Iterable<DramaRun>,notes:string[]=[]):Promise<boolean>{
  await initPhysics();const def=dramaDefinition(options.game),faction=options.mode==='faction',plan=dramaSeeds(options.runs,options.seed,faction),measuredSeeds=plan.measured,fairnessSeeds=plan.fairness,runs=new Map<number,DramaRun>();
  for(const run of completed){
    if(runs.has(run.seed))throw new Error(`Duplicate completed seed ${run.seed}`);
    // Games may replace setup.participants while admitting players; compare
    // the collector's initial population against the original CLI request.
    const checked=!def.spectator&&run.initial!==options.participants?{...run,error:[run.error,`${options.participants} requested entrants; ${run.initial} actually started`].filter(Boolean).join('; ')}:run;
    runs.set(run.seed,checked);
  }
  if(runs.size!==plan.unique.length||plan.unique.some(seed=>!runs.has(seed)))throw new Error('Completed runs must exactly match the requested pacing and fairness seed plan');
  const measured=measuredSeeds.map(s=>runs.get(s)!),fairness=fairnessSeeds.map(s=>runs.get(s)!),all=plan.unique.map(seed=>runs.get(seed)!),summary=summarizeDrama(measured,fairness,TEAM_IDS.slice(0,options.teams),faction,all),base=resolve(options.out.replace(/\.(?:md|json)$/i,'')),paths={markdown:`${base}.md`,json:`${base}.json`};
  const report={generatedAt:new Date().toISOString(),spec:'Historical pacing diagnostic; not a release gate',physicsVersion:RAPIER.version(),options,targetDuration:def.durationSec.target,definitions:OPERATIONAL_DEFINITIONS,summary,runs:all.map(r=>({...r,measured:measuredSeeds.includes(r.seed),fairness:fairnessSeeds.includes(r.seed)})),...(notes.length?{notes}:{})};
  const markdown=dramaMarkdown(report);
  await mkdir(dirname(base),{recursive:true});await writeFile(paths.markdown,markdown);await writeFile(paths.json,JSON.stringify(report,null,2));console.log(metricTable(summary));console.log(`Overall ${summary.pass?'PASS':'FAIL'}; ${paths.markdown}; ${paths.json}`);return summary.pass;
}
if(process.argv[1]&&/drama-report\.[cm]?[jt]s$/.test(process.argv[1])){
  try{process.exitCode=await runDramaReport(parseDramaArgs(process.argv.slice(2)))?0:1;}catch(error){console.error(String(error));process.exitCode=1;}
}
