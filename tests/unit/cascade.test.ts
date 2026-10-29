import { test,expect } from 'vitest';
import { resultSchema,type TeamId } from '@chaos/shared';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { createContext } from '../../apps/show/src/engine/context';
import { registry } from '../../apps/show/src/games/registry';
import { MultiplierCascade } from '../../apps/show/src/games/multiplier-cascade';
import { GATE_Y } from '../../apps/show/src/games/multiplier-cascade/board';
import { COURSE,RELEASE_AT,SHELF_Y,BALL_RADIUS,LINE_WIDTH,FACTORS } from '../../apps/show/src/games/multiplier-cascade/course-layout';
import { makeSetup,simulate } from '../../tools/simulation';

async function scene(work:(game:MultiplierCascade)=>void,teams=4,seed=42){
  await initPhysics();const def=registry.get('multiplier-cascade')!,ctx=createContext(def,makeSetup({game:'multiplier-cascade',seed,teams})),game=def.create(ctx) as MultiplierCascade;
  try{game.start();work(game);}finally{game.destroy();ctx.physics.destroy();}
}
function steps(game:MultiplierCascade,seconds:number){for(let n=0;n<seconds*60&&!game.result;n++)game.step(1/60);}
function place(game:MultiplierCascade,unit:MultiplierCascade['units'] extends Map<string,infer T>?T:never,x:number,y:number){const m=unit.marble;game.ctx.physics.move(m.body,x,y);m.x=m.prevX=x;m.y=m.prevY=y;m.body.setLinvel({x:0,y:0},true);}

test('Cascade is an automatic faction game without an individual roster or steering',()=>{
  const def=registry.get('multiplier-cascade')!;expect(def.title).toBe('MULTIPLIER CASCADE');expect(def.spectator).toBe(true);expect(def.experimental).toBeUndefined();expect(def.competition).toBe('score');expect(def.modes).toEqual(['faction']);expect(def.chatVerbs).toEqual([]);expect(def.streamerControls).toEqual([]);expect(def.maxParticipants).toBe(0);
});

test('a multiplication keeps its parent body and forms new physical children exactly once',async()=>scene(game=>{
  const unit=[...game.units.values()][0],m=unit.marble,handle=m.body.handle,b=game.board.bay(game.teams.indexOf(m.team as TeamId)),count=game.units.size;
  place(game,unit,b.left+b.w*.32,GATE_Y[0]+1);game.step(1/60);
  expect(m.body.handle).toBe(handle);expect(unit.stage).toBe(1);expect(game.units.size).toBe(count+1);expect([...game.units.values()].filter(u=>u.root===unit.root)).toHaveLength(2);
  steps(game,.1);expect(game.splits.filter(s=>s.id===m.id&&s.stage===0)).toHaveLength(1);expect(game.marbles.every(m=>m.showLabel===false)).toBe(true);
}));

test('a triple multiplier creates three bodies and a bounded drain banks no points',async()=>scene(game=>{
  const unit = [...game.units.values()][0];
  const bay = game.board.bay();
  const count = game.units.size;
  const stage = FACTORS.indexOf(3);
  unit.stage = stage;
  place(game, unit, bay.x, GATE_Y[stage] + 1);
  game.step(1 / 60);
  expect(game.units.size).toBe(count + 2);
  expect([...game.units.values()].filter(child => child.root === unit.root)).toHaveLength(3);
  const target = [...game.units.values()].find(child => child.root !== unit.root)!;
  place(game, target, bay.left + bay.w * .84, GATE_Y[0] + 1);
  game.step(1 / 60);
  expect(target.marble.alive).toBe(false);
  expect(game.bankings).toEqual([]);
  expect([...game.scores.values()]).toEqual([0, 0, 0, 0]);
}));

test('pocket points require an actual sensor entry and credit one pocket once',async()=>scene(game=>{
  const unit=[...game.units.values()][0],team=unit.marble.team as TeamId,b=game.board.bay(game.teams.indexOf(team));unit.stage=GATE_Y.length;
  place(game,unit,b.left+b.w*5/6,COURSE.bankY-90);steps(game,.05);expect(game.scores.get(team)).toBe(0);steps(game,1.2);
  expect(game.scores.get(team)).toBe(20);expect(game.bankings.filter(b=>b.id===unit.marble.id)).toHaveLength(1);expect(unit.marble.alive).toBe(false);
}));

test('release doors hold the first crowd and then open through physical motion',async()=>scene(game=>{
  steps(game,RELEASE_AT[0]-.1);expect(game.board.doors[0].every(d=>Math.abs(d.body.rotation())<.001)).toBe(true);expect(game.bankings).toHaveLength(0);
  steps(game,2.5);expect(game.board.doors[0].every(d=>Math.abs(d.body.rotation())>1.5)).toBe(true);expect([...game.units.values()].some(u=>u.marble.y>SHELF_Y[0]+BALL_RADIUS)).toBe(true);
}));

test('the single course never resupplies roots when a team has a larger bank',async()=>scene(game=>{
  const roots = new Set([...game.units.values()].map(unit => unit.root));
  for (const team of game.teams) {
    expect([...game.units.values()].filter(unit => unit.marble.team === team)).toHaveLength(3);
  }
  game.scores.set(game.teams[0], 10000);
  steps(game, 18);
  expect(game.wave).toBe(1);
  expect([...game.units.values()].every(unit => roots.has(unit.root))).toBe(true);
}));

test('different team colors collide in the same shared shaft',async()=>scene(game=>{
  const a=[...game.units.values()][0],b=[...game.units.values()].find(u=>u.marble.team!==a.marble.team)!;
  place(game,a,900,280);place(game,b,944,280);a.marble.body.setLinvel({x:2,y:0},true);b.marble.body.setLinvel({x:-2,y:0},true);steps(game,.15);
  expect(game.contacts.marble).toBeGreaterThan(0);expect(a.marble.body.linvel().x).toBeLessThan(2);
}));

test('a jointed bridge tips under a real marble load',async()=>{
  const angles:number[]=[];
  for(const loaded of[false,true])await scene(game=>{
    const bridge=game.board.machinery.machines.find(m=>m.kind==='seesaw')!;bridge.body.setRotation(0,true);bridge.body.setAngvel(0,true);
    if(loaded){const unit=[...game.units.values()][0];unit.stage=1;place(game,unit,bridge.x+bridge.width*.35,bridge.y-BALL_RADIUS-LINE_WIDTH/2-2);}
    // Both runs use the same weak drive; the only difference is the real load.
    steps(game,.65);angles.push(bridge.body.rotation());if(loaded)expect(game.contacts.seesaw).toBeGreaterThan(0);
  });
  expect(Math.abs(angles[1]-angles[0])).toBeGreaterThan(.04);
});

test('the tall physical course scrolls downward at constant full-size zoom',async()=>scene(game=>{
  expect(COURSE.bottom-COURSE.top).toBeGreaterThan(1080 * 3);
  let previousY = game.ctx.camera.target.y;
  for(let tick=0;tick<18*60;tick++){
    game.step(1/60);
    expect(game.ctx.camera.target.x).toBe(960);
    expect(game.ctx.camera.target.y).toBeGreaterThanOrEqual(previousY);
    previousY = game.ctx.camera.target.y;
    expect(game.ctx.camera.zoom).toBe(1);
    expect(game.ctx.camera.targetZoom).toBe(1);
  }
  expect(previousY).toBeGreaterThan(540);
  expect(new Set(game.board.machinery.machines.map(machine => machine.kind)))
    .toEqual(new Set(['wheel', 'seesaw', 'sweeper']));
}));

test('banked score cannot secretly alter multiplication or ball trajectories',async()=>{
  const traces:unknown[]=[];
  for(const advantage of[0,10000])await scene(game=>{game.scores.set(game.teams[0],advantage);steps(game,18);traces.push({splits:game.splits,balls:[...game.units.values()].map(u=>({id:u.marble.id,x:u.marble.x,y:u.marble.y,stage:u.stage}))});});
  expect(traces[1]).toEqual(traces[0]);
});

test.each([{teams:2,seed:4},{teams:4,seed:4},{teams:6,seed:4},{teams:6,seed:46}])(
  '$teams-team seed $seed turns one continuous course into supply and ends on the fifth real finisher', async ({teams,seed}) => {
    let completed: MultiplierCascade | undefined;
    const run = await simulate({ game: 'multiplier-cascade', seed, teams,
      observe: instance => { if (instance.result) completed = instance as MultiplierCascade; } });
    expect(run.timeout).toBe(false);
    expect(run.bodies).toBeLessThanOrEqual(200);
    expect(completed!.drops).toHaveLength(1);
    expect(completed!.drops.every(drop => drop.expired === 0 && drop.born === drop.banked + drop.lost)).toBe(true);
    expect(run.duration).toBeGreaterThan(completed!.waveStart);
    const parsed = resultSchema.parse(run.result);
    expect(parsed.perUser).toEqual({});
    expect(parsed.mvps).toEqual([]);
    expect(parsed.standings![0].score).toBe(5);
    for (const row of parsed.standings!) {
      expect(row.score).toBe(completed!.relay!.finished.get(row.teamId));
      expect(row.score).toBeLessThanOrEqual(5);
      expect(completed!.scores.get(row.teamId)).toBe(completed!.bankings
        .filter(bank => bank.team === row.teamId).reduce((sum, bank) => sum + bank.value, 0));
    }
  });
