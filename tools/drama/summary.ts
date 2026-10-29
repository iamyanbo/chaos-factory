import type { TeamId } from '@chaos/shared';
import { median,type DramaRun } from './metrics';

export interface DramaMetric {name:string;value:number|Record<string,number>|null;target:string;pass:boolean|null;detail?:string}
export interface DramaSummary {metrics:DramaMetric[];pass:boolean;reliability:{timeouts:number;errors:number;voids:number;invalidTelemetry:number};fairnessSeeds:number;measuredRuns:number}
const EPS=1e-9,mean=(n:number[])=>n.reduce((a,b)=>a+b,0)/Math.max(1,n.length);
export const OPERATIONAL_DEFINITIONS=[
  'Actual round duration is fixed-step game time through the published result, including simulated finale time. Curve T is the configured target; it is never fitted to actual duration.',
  'Attrition target is kit/drama-curve.ts: max(1/N,min(clamp(1-(t/T)^1.6),cap)). The cap smoothsteps 1→3/N over .65T–.8T, holds through .9T, then declines linearly to1/N atT. Curve error is a time-weighted trapezoidal mean over each actual round, with N equal to the initial live population, then an arithmetic mean of per-round errors.',
  'Eliminations are actual alive/non-dormant→not-alive transitions, including disappearance. All eliminations remain in the burst denominator; only the last two chronological eliminations are removed from its closed3-second numerator windows. burstMax is the worst run, not a median.',
  'quietMax is the median per-run longest event gap including time0 and the actual round end. Only eliminations, qualified near misses, physical hazard hits/ring passes and confirmed lead changes are events.',
  'finalContest reconstructs the fixed upfront population from all elimination times and stops at the physical decision, excluding post-win finale time; aggregate is the median. A personal Ring race uses the champion ring:6 crossing timestamp, then its first finished flag as fallback. A team Ring race uses its winning team’s third distinct ring:6 finisher; a depth-points bell with no quota uses result publication. Personal survival stops at the first sole contender, then a champion finished flag as fallback. Team survival without a personal champion stops at the first sole winning color only if multiple colors started; a one-color practice field or missing team decision falls back to publication. Later joins/resurrections are unsupported by this reconstruction.',
  'Race lead changes require a different unique leader to hold for1second; the first established leader is not a change and ties never choose an artificial leader.',
  'Race lateDecision requires the eventual champion to hold an uninterrupted >=1ring/checkpoint lead through the ending, starting before75% of actual duration. A later margin below1is a challenge. Without a champion, use the winning team’s best live progress versus other teams. Survival lateDecision means the first sole contender appeared before75% of actual duration.',
  'Near-miss radius and clearance are physical world units, clearance is nonnegative surface separation <=0.5radius; reported radius must match the physical actor radius. An approach latches until an unrecorded far-clearance sample >radius rearms it. Approaches have a1second actor/hazard debounce and qualify only after >=1second subsequent survival. End-censored candidates do not count. nearMisses uses the minimum run count, not an average.',
  'Faction fairness always uses exactly seeds1–300; pacing runs are reused when seeds overlap. Shares divide by300, including voids/timeouts in the denominator. Every team must be within±6percentage points of1/teamCount. CvS fairness and survival leadChanges are N/A.',
  'Old Ring baseline reads its existing physical crossing ledger and ring-depth/radial fraction. Old Tray baseline reads alive states. Neither baseline fabricates hazard hits or near misses. New games use dramaState() and ctx.drama.',
  'Reports contain per-round summaries and accepted events, not per-tick poses. Any metric failure, timeout, game/data error or void result makes the overall report fail. Passing does not replace the user’s viewing approval.'
];
export function summarizeDrama(measured:DramaRun[],fairness:DramaRun[],teams:readonly TeamId[],faction:boolean,all:DramaRun[]=[...measured,...fairness]):DramaSummary {
  const race=measured.some(r=>r.kind==='race'),changes=measured.map(r=>r.leadChanges??0),withChange=mean(changes.map(n=>Number(n>=1))),duration=median(measured.map(r=>r.duration)),quiet=median(measured.map(r=>r.quietMax)),burst=Math.max(0,...measured.map(r=>r.burstMax)),curve=mean(measured.map(r=>r.curveError)),contest=median(measured.map(r=>r.finalContest)),lead=median(changes),late=mean(measured.map(r=>Number(r.lateDecision))),near=measured.length?Math.min(...measured.map(r=>r.nearMisses)):0;
  const shares=Object.fromEntries(teams.map(team=>[team,fairness.filter(r=>r.winner.kind==='team'&&r.winner.teamId===team).length/300]));
  const metrics:DramaMetric[]=[
    {name:'durationMedian',value:duration,target:'50–80 s',pass:duration>=50-EPS&&duration<=80+EPS},
    {name:'quietMax',value:quiet,target:'≤4 s median',pass:quiet<=4+EPS},
    {name:'burstMax',value:burst,target:'≤0.25 worst run',pass:burst<=.25+EPS},
    {name:'curveError',value:curve,target:'≤0.12 mean',pass:curve<=.12+EPS},
    {name:'finalContest',value:contest,target:'≥8 s median',pass:contest>=8-EPS},
    {name:'leadChanges',value:race?lead:null,target:'≥2 median; ≥1 in85% of rounds',pass:race?lead>=2&&withChange>=.85-EPS:null,detail:race?`${(100*withChange).toFixed(1)}% have at least one confirmed change`:'N/A: survival'},
    {name:'lateDecision',value:late,target:'≤30% of rounds',pass:late<=.3+EPS},
    {name:'nearMisses',value:near,target:'≥6 in every round',pass:near>=6},
    {name:'teamFairness',value:faction?shares:null,target:'300 seeds; each ±6pp of1/teams',pass:faction?fairness.length===300&&teams.every(t=>Math.abs(shares[t]-1/teams.length)<=.06+EPS):null,detail:faction?`${fairness.length} seeds; voids/timeouts retained in denominator`:'N/A: non-faction'}
  ];
  const unique=[...new Map(all.map(r=>[r.seed,r])).values()],reliability={timeouts:unique.filter(r=>r.timeout).length,errors:unique.filter(r=>r.error).length,voids:unique.filter(r=>r.winner.kind==='void').length,invalidTelemetry:unique.reduce((n,r)=>n+r.invalidTelemetry,0)};
  return {metrics,pass:measured.length>0&&metrics.every(m=>m.pass!==false)&&Object.values(reliability).every(n=>n===0),reliability,fairnessSeeds:fairness.length,measuredRuns:measured.length};
}
function value(metric:DramaMetric):string {if(metric.value===null)return'N/A';if(typeof metric.value==='object')return Object.entries(metric.value).map(([k,v])=>`${k} ${(100*v).toFixed(1)}%`).join(', ');if(metric.name==='leadChanges'&&metric.detail)return`${metric.value.toFixed(3)}; ${metric.detail}`;return metric.name==='lateDecision'?`${(100*metric.value).toFixed(1)}%`:metric.value.toFixed(3);}
export function metricTable(summary:DramaSummary):string {return ['| Metric | Measured | Target | Result |','| --- | --- | --- | --- |',...summary.metrics.map(m=>`| ${m.name} | ${value(m)} | ${m.target} | ${m.pass===null?'N/A':m.pass?'PASS':'FAIL'} |`)].join('\n');}
