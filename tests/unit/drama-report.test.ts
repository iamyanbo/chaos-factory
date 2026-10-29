import { describe,expect,test } from 'vitest';
import type { RoundResult,TeamId } from '@chaos/shared';
import { targetAliveFraction,targetAliveCount } from '../../apps/show/src/kit/drama-curve';
import { DramaCollector,eliminationBurst,longestQuiet,preDecisionContest,type DramaFrame,type DramaRun } from '../../tools/drama/metrics';
import { summarizeDrama,metricTable } from '../../tools/drama/summary';
import { parseDramaArgs as parseArgs } from '../../tools/drama/args';
import { dramaSeeds } from '../../tools/drama/seeds';

const result=(id='a',team:TeamId='red'):RoundResult=>({winner:{kind:'team',teamId:team},champion:{userId:id,displayName:id,reason:'test'},mvps:[],highlights:[],perUser:{},replay:{seed:1,inputs:[]}});
function frame(time:number,kind:'race'|'survival'='survival',a=0,b=0,alive=['a','b']):DramaFrame{return{time,kind,actors:['a','b'].map((id,i)=>({id,team:i?'blue':'red',alive:alive.includes(id),radius:20,progress:i?b:a}))};}
function near(c:DramaCollector,time:number,clearance:number,radius=20){c.physical({kind:'near-miss',time,actorId:'a',hazardId:'piston:0',clearance,radius});c.observe(frame(time));}
const finish=(c:DramaCollector)=>c.finish(1,result(),false);

describe('canonical drama curve',()=>{
  test('keeps the literal early curve, reaches at most three by .8T, and one at T',()=>{
    expect(targetAliveFraction(30,60,24)).toBeCloseTo(1-.5**1.6,12);expect(targetAliveCount(48,60,24)).toBeCloseTo(3,10);expect(targetAliveCount(54,60,24)).toBeCloseTo(3,10);expect(targetAliveCount(60,60,24)).toBeCloseTo(1,10);expect(targetAliveCount(100,60,24)).toBeCloseTo(1,10);expect(targetAliveCount(10,60,0)).toBe(0);
  });
  test('does not fit the curve to the observed finish time',()=>{expect(targetAliveFraction(30,100,24)).toBeGreaterThan(targetAliveFraction(30,60,24));expect(()=>targetAliveFraction(0,0,24)).toThrow();});
});
test('quiet intervals include the initial and trailing gaps',()=>{expect(longestQuiet(10,[1,3])).toBe(7);expect(longestQuiet(8,[5,7])).toBe(5);expect(longestQuiet(8,[])).toBe(8);});
test('burst excludes only final two numerator events and keeps every loss in its denominator',()=>{
  expect(eliminationBurst([0,1,2,10,11,12,20,21])).toBe(3/8);expect(eliminationBurst([0,10,20,30,31,32])).toBe(1/6);expect(eliminationBurst(Array(24).fill(1))).toBe(22/24);expect(eliminationBurst([1,2])).toBe(0);
});

describe('qualified physical near misses',()=>{
  test('needs a far exit before another approach; repeated proximity cannot fill quiet time',()=>{
    const c=new DramaCollector(60);c.observe(frame(0));near(c,.1,5);c.observe(frame(1.1));near(c,1.2,4);c.observe(frame(2.2));near(c,2.3,21);near(c,2.4,10);c.observe(frame(3.4));const r=finish(c);
    expect(r.nearMisses).toBe(2);expect(r.events.map(e=>e.time)).toEqual([.1,2.4]);expect(r.quietMax).toBeCloseTo(2.3);expect(r.invalidTelemetry).toBe(0);
  });
  test('far samples alone never create events',()=>{const c=new DramaCollector(60);c.observe(frame(0));near(c,1,25);near(c,2,30);near(c,3,21);expect(finish(c).quietMax).toBe(3);expect(finish(c).events).toEqual([]);});
  test('rejects a fatal approach and censors the final second instead of assuming survival',()=>{
    const fatal=new DramaCollector(60);fatal.observe(frame(0));near(fatal,.1,2);fatal.observe(frame(.9,'survival',0,0,['b']));fatal.observe(frame(1.1,'survival',0,0,['b']));expect(finish(fatal).nearMisses).toBe(0);expect(finish(fatal).nearMissRejected).toBe(1);
    const censored=new DramaCollector(60);censored.observe(frame(0));near(censored,2.5,2);censored.observe(frame(3));expect(finish(censored).nearMisses).toBe(0);expect(finish(censored).nearMissCensored).toBe(1);
  });
  test('survival for exactly one second qualifies and physical contact is not a near miss',()=>{
    const c=new DramaCollector(60);c.observe(frame(0));near(c,.1,2);c.observe(frame(1.1,'survival',0,0,['b']));expect(finish(c).nearMisses).toBe(1);
    const contact=new DramaCollector(60);contact.observe(frame(0));near(contact,.1,-.01);contact.observe(frame(2));expect(finish(contact).nearMisses).toBe(0);
  });
  test('a rearmed approach still observes the one-second debounce',()=>{
    const c=new DramaCollector(60);c.observe(frame(0));near(c,.1,2);near(c,.4,25);near(c,.6,2);c.observe(frame(1.2));near(c,1.3,25);near(c,1.4,2);c.observe(frame(2.4));expect(finish(c).nearMisses).toBe(2);expect(finish(c).nearMissCandidates).toBe(2);
  });
  test('a larger reported radius cannot make a physically distant approach qualify',()=>{const c=new DramaCollector(60);c.observe(frame(0));near(c,.1,15,40);c.observe(frame(2));expect(finish(c).nearMisses).toBe(0);expect(finish(c).invalidTelemetry).toBe(1);});
});
test('unrecognized cosmetic/director payloads never become drama events',()=>{
  const c=new DramaCollector(60);c.observe(frame(0));c.physical({kind:'moment',time:1,actorId:'a'} as never);c.observe(frame(1));expect(finish(c).events).toEqual([]);expect(finish(c).invalidTelemetry).toBe(1);
});
test('lead changes need unique one-second dwell, ignore flicker and do not count initial establishment',()=>{
  const c=new DramaCollector(60);c.observe(frame(0,'race'));c.observe(frame(.1,'race',.2,.1));c.observe(frame(1.1,'race',.2,.1));c.observe(frame(1.2,'race',.2,.3));c.observe(frame(1.8,'race',.4,.3));c.observe(frame(2,'race',.4,.5));c.observe(frame(3,'race',.4,.5));c.observe(frame(3.1,'race',.6,.6));c.observe(frame(3.2,'race',.8,.6));c.observe(frame(4.2,'race',.9,.7));expect(finish(c).leadChanges).toBe(2);expect(finish(c).events.filter(e=>e.kind==='lead-change').map(e=>e.time)).toEqual([3,4.2]);
});
test('a later challenge resets an early unassailable race margin',()=>{
  const locked=new DramaCollector(60);locked.observe(frame(0,'race',2,0));locked.observe(frame(60,'race',6,4));expect(finish(locked).lateDecision).toBe(true);
  const challenged=new DramaCollector(60);challenged.observe(frame(0,'race',2,0));challenged.observe(frame(44,'race',4,3.2));challenged.observe(frame(46,'race',5,3));challenged.observe(frame(60,'race',6,4));expect(finish(challenged).lateDecision).toBe(false);
});
test('lateDecision uses actual duration and survival sole contenders',()=>{
  const short=new DramaCollector(100);short.observe(frame(0,'race'));short.observe(frame(46,'race',3,1));short.observe(frame(60,'race',4,1));expect(finish(short).lateDecision).toBe(false);
  const long=new DramaCollector(100);long.observe(frame(0,'race'));long.observe(frame(46,'race',3,1));long.observe(frame(80,'race',4,1));expect(finish(long).lateDecision).toBe(true);
  const survival=new DramaCollector(60);survival.observe(frame(0));survival.observe(frame(40,'survival',0,0,['a']));survival.observe(frame(60,'survival',0,0,['a']));expect(finish(survival).lateDecision).toBe(true);expect(finish(survival).leadChanges).toBeNull();
});
test('attrition error and final contest are weighted by simulated elapsed time',()=>{
  const c=new DramaCollector(60);c.observe(frame(0));c.observe(frame(9));c.observe(frame(10,'survival',0,0,['a']));c.observe(frame(60,'survival',0,0,['a']));expect(finish(c).finalContest).toBe(10);expect(finish(c).curveError).toBeGreaterThan(.1);
});
describe('final contest ends at the physical decision',()=>{
  test('reconstructs fixed populations, simultaneous losses and exact fractional clipping',()=>{
    expect(preDecisionContest(5,[40,10,30,20],35)).toBe(25);
    expect(preDecisionContest(3,[10,10],15)).toBe(10);
    expect(preDecisionContest(5,[10,10,11,11],10.375)).toBe(.375);
    expect(preDecisionContest(1,[],60)).toBe(0);
    expect(()=>preDecisionContest(2,[NaN],60)).toThrow();
  });
  test('a 0.8s post-finish finale does not extend still-undecided racing',()=>{
    const c=new DramaCollector(60);c.observe(frame(0,'race'));
    const decided=frame(10,'race',6,5.9);decided.actors[0].finished=true;c.observe(decided);
    c.observe({...decided,time:10.8});const r=finish(c);
    expect(r.duration).toBe(10.8);expect(r.decisionAt).toBe(10);expect(r.finalContest).toBe(10);
  });
  test('the actual champion ring6 crossing fraction takes precedence over its finished frame',()=>{
    const c=new DramaCollector(60);c.observe(frame(0,'race'));c.observe(frame(9.983333333333,'race',5.99,5.9));
    c.physical({kind:'ring-pass',time:9.99125,actorId:'a',hazardId:'ring:6'});
    const decided=frame(10,'race',6,5.9);decided.actors[0].finished=true;c.observe(decided);c.observe({...decided,time:10.8});
    const r=finish(c);expect(r.duration).toBe(10.8);expect(r.decisionAt).toBe(9.99125);expect(r.finalContest).toBe(9.99125);
  });
  test('survival uses the first sole contender rather than a later winner flag/publication',()=>{
    const c=new DramaCollector(60);c.observe(frame(0));c.observe(frame(8,'survival',0,0,['a']));
    const decided=frame(9,'survival',0,0,['a']);decided.actors[0].finished=true;c.observe(decided);c.observe({...decided,time:9.8});
    expect(finish(c).decisionAt).toBe(8);expect(finish(c).finalContest).toBe(8);expect(finish(c).duration).toBe(9.8);
  });
  test('team quota uses three distinct actual finishers rather than repeated passes or publication',()=>{
    const c=new DramaCollector(60),make=(time:number):DramaFrame=>({time,kind:'race',actors:['a','b','c','d'].map((id,i)=>({id,team:i<3?'red':'blue',alive:true,radius:22,progress:0}))});c.observe(make(0));
    for(const[id,time]of[['a',5],['b',6],['b',7],['c',9.99125]] as const){c.physical({kind:'ring-pass',time,actorId:id,hazardId:'ring:6'});c.observe(make(time));}
    c.observe(make(10.8));const team=result();delete team.champion;const r=c.finish(1,team,false);
    expect(r.duration).toBe(10.8);expect(r.decisionAt).toBe(9.99125);expect(r.finalContest).toBe(9.99125);
  });
  test('a team depth-points bell without three physical finishers keeps the bell as its decision',()=>{
    const c=new DramaCollector(60);c.observe(frame(0,'race'));c.physical({kind:'ring-pass',time:5,actorId:'a',hazardId:'ring:6'});c.observe(frame(5,'race'));c.observe(frame(10,'race'));
    const team=result();delete team.champion;expect(c.finish(1,team,false).decisionAt).toBe(10);
  });
  test('team survival stops when two same-color survivors win, before its 0.8s finale',()=>{
    const c=new DramaCollector(60),initial:DramaFrame={time:0,kind:'survival',actors:['a','b','c'].map((id,i)=>({id,team:i<2?'red':'blue',alive:true,radius:22,progress:0}))};c.observe(initial);
    const won={...initial,time:8,actors:initial.actors.map(a=>({...a,alive:a.id!=='c'}))};c.observe(won);c.observe({...won,time:8.8});
    const team=result();delete team.champion;const r=c.finish(1,team,false);expect(r.duration).toBe(8.8);expect(r.decisionAt).toBe(8);expect(r.finalContest).toBe(8);
  });
  test.each([1,2])('a one-color initial practice field of%i cannot invent a team win at time0',count=>{
    const c=new DramaCollector(60),initial:DramaFrame={time:0,kind:'survival',actors:['a','b'].slice(0,count).map(id=>({id,team:'red',alive:true,radius:22,progress:0}))};c.observe(initial);c.observe({...initial,time:8.8});
    const team=result();delete team.champion;expect(c.finish(1,team,false).decisionAt).toBe(8.8);
  });
});

const teams:TeamId[]=['red','blue','mint','gold'];
function good(seed:number):DramaRun{return{seed,kind:'race',duration:60,targetDuration:60,initial:24,final:1,winner:{kind:'team',teamId:teams[(seed-1)%4]},timeout:false,quietMax:3,burstMax:.1,curveError:.1,finalContest:8,leadChanges:3,lateDecision:false,nearMisses:6,nearMissCandidates:6,nearMissRejected:0,nearMissCensored:0,firstBlood:10,finalFewAt:48,decisionAt:60,events:[],invalidTelemetry:0};}
const fair=()=>Array.from({length:300},(_,i)=>good(i+1));
const parseDramaArgs=(args:string[])=>parseArgs(args,()=>({modes:['faction']}));
describe('nine exact acceptance gates',()=>{
  test('all nine pass with valid data and exact 300-seed faction fairness',()=>{const runs=fair(),s=summarizeDrama(runs.slice(0,200),runs,teams,true);expect(s.metrics).toHaveLength(9);expect(s.pass).toBe(true);expect(metricTable(s)).toContain('100.0% have at least one confirmed change');});
  test('near misses use the minimum and bursts use the worst run',()=>{const runs=fair();runs[0].nearMisses=5;runs.slice(1).forEach(r=>r.nearMisses=20);runs[1].burstMax=.5;const s=summarizeDrama(runs.slice(0,200),runs,teams,true);expect(s.metrics.find(m=>m.name==='nearMisses')?.pass).toBe(false);expect(s.metrics.find(m=>m.name==='burstMax')?.value).toBe(.5);expect(s.pass).toBe(false);});
  test('lead median and 85-percent conditions both apply',()=>{const runs=fair().slice(0,200);runs.slice(169).forEach(r=>r.leadChanges=0);expect(summarizeDrama(runs,[],teams,false).metrics.find(m=>m.name==='leadChanges')?.pass).toBe(false);runs[169].leadChanges=3;expect(summarizeDrama(runs,[],teams,false).metrics.find(m=>m.name==='leadChanges')?.pass).toBe(true);runs.forEach((r,i)=>r.leadChanges=i<170?1:8);expect(summarizeDrama(runs,[],teams,false).metrics.find(m=>m.name==='leadChanges')?.pass).toBe(false);});
  test('fairness divides by all 300 outcomes, with N/A only for non-faction',()=>{const runs=fair();runs.slice(0,60).forEach(r=>r.winner={kind:'void',reason:'test'});const s=summarizeDrama(runs.slice(0,200),runs,teams,true),metric=s.metrics.find(m=>m.name==='teamFairness')!;expect((metric.value as Record<string,number>).red).toBe(.2);expect(s.pass).toBe(false);expect(summarizeDrama(runs.slice(0,200),runs.slice(0,200),teams,true).metrics.find(m=>m.name==='teamFairness')?.pass).toBe(false);expect(summarizeDrama([good(1)],[],teams,false).metrics.find(m=>m.name==='teamFairness')?.pass).toBeNull();});
  test('the six-percentage-point fairness boundary is inclusive and not widened',()=>{const runs=fair();runs.forEach((r,i)=>r.winner={kind:'team',teamId:i<93?'red':teams[1+Math.floor((i-93)/69)]});expect(summarizeDrama(runs.slice(0,200),runs,teams,true).metrics.find(m=>m.name==='teamFairness')?.pass).toBe(true);runs[93].winner={kind:'team',teamId:'red'};expect(summarizeDrama(runs.slice(0,200),runs,teams,true).metrics.find(m=>m.name==='teamFairness')?.pass).toBe(false);});
  test('one timeout or invalid telemetry fails even if every metric would otherwise pass',()=>{const runs=fair();runs[299].timeout=true;expect(summarizeDrama(runs.slice(0,200),runs,teams,true).pass).toBe(false);runs[299].timeout=false;runs[299].invalidTelemetry=1;expect(summarizeDrama(runs.slice(0,200),runs,teams,true).pass).toBe(false);});
});
test('CLI defaults are 200 pacing runs, 24 entrants, four teams, seed one and individual victory',()=>{expect(parseDramaArgs(['--game','ring-escape'])).toMatchObject({runs:200,participants:24,teams:4,seed:1,mode:'faction',competition:'individual'});expect(parseDramaArgs(['--game','ring-escape','--competition','team']).competition).toBe('team');expect(()=>parseDramaArgs(['--game','ring-escape','--competition','score'])).toThrow();expect(()=>parseDramaArgs(['--game','ring-escape','--runs','0'])).toThrow();});
test('a 200-run faction command reuses those runs but still measures exactly 300 fairness seeds',()=>{const p=dramaSeeds(200,1,true);expect(p.measured).toHaveLength(200);expect(p.fairness).toHaveLength(300);expect(p.unique).toHaveLength(300);expect(p.fairness[0]).toBe(1);expect(p.fairness[299]).toBe(300);const other=dramaSeeds(2,700,true);expect(other.unique).toHaveLength(302);expect(other.fairness).toEqual(p.fairness);expect(dramaSeeds(2,1,false).unique).toEqual([1,2]);});

test('a saved report cannot claim complete gates from duplicated or partial seed data',async()=>{
  const {saveDramaReport}=await import('../../tools/drama-report');
  const options={game:'ring-escape',runs:200,seed:1,participants:24,teams:4,mode:'faction' as const,competition:'individual' as const,out:'qa/drama-rejected-cache.md'};
  await expect(saveDramaReport(options,[good(1),good(1)])).rejects.toThrow('Duplicate completed seed');
  await expect(saveDramaReport(options,[good(1)])).rejects.toThrow('exactly match');
});

test('a healthy-looking batch still fails when a game quietly admits fewer than requested',async()=>{
  const {saveDramaReport}=await import('../../tools/drama-report');
  const {mkdtemp,readFile,unlink,rmdir}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const directory=await mkdtemp(join(tmpdir(),'chaos-drama-admission-'));
  try{
    const runs=fair();runs[0].initial=23;
    const options={game:'ring-escape',runs:200,seed:1,participants:24,teams:4,mode:'faction' as const,competition:'individual' as const,out:join(directory,'report.md')};
    expect(await saveDramaReport(options,runs)).toBe(false);
    const report=JSON.parse(await readFile(join(directory,'report.json'),'utf8'));
    expect(report.summary.reliability.errors).toBe(1);expect(report.runs[0].error).toContain('24 requested entrants; 23 actually started');
  }finally{for(const extension of['md','json'])await unlink(join(directory,`report.${extension}`)).catch(()=>{});await rmdir(directory);}
});
