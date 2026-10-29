import { test,expect } from 'vitest';
import { Participants } from '../../apps/show/src/director/participants';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { registry } from '../../apps/show/src/games/registry';
import { JOIN_LIMITS } from '../../apps/show/src/games/catalog';
import type { BaseGame } from '../../apps/show/src/kit/base-game';
import { predictionOptions } from '../../apps/show/src/director/roster';
const person=(n:number)=>({userId:`viewer-${n}`,login:`viewer-${n}`,displayName:`Viewer ${n}`,color:'#ffffff'});
function director(practice=true){return new Director({send:()=>false,context:(def,setup)=>createContext(def,setup),announce(){},toast(){},feed(){},reset(){}},{practice,fast:true,game:'ring-escape',seed:42});}

test('ten thousand viewers retain first-come order; repeating join never jumps the queue',()=>{
  const p=new Participants();for(let n=0;n<10000;n++)p.join(person(n),n/1000);
  const first=p.roster(100,10);expect(first.map(m=>m.userId)).toEqual(Array.from({length:100},(_,n)=>person(n).userId));expect(p.crowd).toBe(9900);
  p.join(person(9999),100);p.join(person(100),101);expect(p.roster(100,101).map(m=>m.userId)).toEqual(first.map(m=>m.userId));expect(p.queuePosition(person(100).userId,first.map(m=>m.userId))).toBe(1);
  p.finishRound(first.map(m=>m.userId));expect(p.roster(100,101).map(m=>m.userId)).toEqual(Array.from({length:100},(_,n)=>person(n+100).userId));expect(p.members.size).toBe(10000);
});

test('large live join bursts stay bounded without resetting the clock or admitting beyond the configured cap',async()=>{
  await initPhysics();const d=director();try{
    d.startPractice({gameId:'ring-escape',mode:'faction',seed:42,bots:11,team:'red',capacity:12});d.practiceChat('!join');for(let i=0;i<60;i++)d.step(1/60);
    const game=d.instance as BaseGame,handles=game.marbles.map(m=>m.body.handle),time=game.time;
    for(let n=0;n<2000;n++){const p=person(n);d.receive({type:'chat',...p,text:'!join',isMod:false,isBroadcaster:false,receivedAt:0});}
    expect(game.time).toBe(time);expect(game.marbles.map(m=>m.body.handle)).toEqual(handles);expect(game.marbles).toHaveLength(11);expect(d.queuePosition(person(0).userId)).toBe(2);expect(d.participants.crowd).toBe(2001);expect(d.inputs.filter(i=>i.kind==='join')).toHaveLength(0);
    d.command({type:'director.command',cmd:'setCapacity',arg:{'ring-escape':5}});expect(d.capacity).toBe(12);expect(d.capacityFor()).toBe(5);expect(game.marbles).toHaveLength(11);
    d.startPractice({gameId:'ring-escape',mode:'faction',seed:42,bots:4,team:'red'});expect(d.capacity).toBe(5);expect(d.ctx!.setup.participants).toHaveLength(5);
    d.setCapacity('blade-brawl',10000);expect(d.capacityFor('blade-brawl')).toBe(32);d.setCapacity('ring-escape',-2);expect(d.capacityFor()).toBe(1);
  }finally{d.destroy();}
});

test('waiting viewers take the next round in arrival order while memberships persist',async()=>{
  await initPhysics();const d=director(false);try{
    d.participants=new Participants();for(let n=0;n<6;n++)d.participants.join(person(n),0);d.mockCount=0;d.enabled=new Set(['ring-escape']);d.setCapacity('ring-escape',2);d.start(3);
    for(let tick=0;tick<70000&&d.results.length<3;tick++){d.frame(1/60);d.step(1/60);}
    expect(d.results.map(r=>Object.keys(r.perUser))).toEqual([[person(0).userId,person(1).userId],[person(2).userId,person(3).userId],[person(4).userId,person(5).userId]]);expect(d.participants.members.size).toBe(6);
  }finally{d.destroy();}
});

test('dashboard limit metadata matches every join-only physical game',()=>{
  for(const def of registry.values())if(def.joinOnly)expect(JOIN_LIMITS[def.id]).toBe(def.maxParticipants);
});

test('Grand Final maps stable named outcomes; a partial field has no wager', async () => {
  await initPhysics();
  const d = director();
  try {
    d.startPractice({ gameId: 'blade-brawl', mode: 'cvs', format: 'ffa', seed: 1,
      bots: 2, team: 'red' });
    d.options.practice = false;
    d.cup.round = 5;
    expect(predictionOptions(d).users).toEqual(d.ctx!.setup.participants.map(user => user.userId));
    expect(predictionOptions(d).titles).toHaveLength(2);
    d.options.practice = true;
    d.startPractice({ gameId: 'blade-brawl', mode: 'cvs', format: 'ffa', seed: 1,
      bots: 1, team: 'red' });
    d.options.practice = false;
    d.cup.round = 5;
    expect(predictionOptions(d)).toEqual({ titles: [], users: [] });
  } finally { d.destroy(); }
});

test('Pong caps a six-team offline request to four without requiring viewers', async()=>{
  await initPhysics();
  const d=director();
  try {
    d.startPractice({gameId:'pong-wars',mode:'faction',format:'faction',seed:42,bots:0,team:'red',teamCount:6});
    expect(d.ctx!.setup.teams).toHaveLength(4);
    expect(d.ctx!.setup.participants).toHaveLength(0);
    for(let tick=0;tick<60;tick++)d.step(1/60);
    expect((d.instance as BaseGame).time).toBeGreaterThan(.9);
  } finally { d.destroy(); }
});

test('shrinking the supported team set preserves first-come order and all members',()=>{
  const p=new Participants();
  p.reset(6);
  p.fill(60,0);
  const order=p.ordered().map(member=>member.userId);
  p.capTeams(4);
  expect(p.ordered().map(member=>member.userId)).toEqual(order);
  expect(p.members.size).toBe(60);
  expect(p.ordered().every(member=>p.teams.includes(member.teamId!))).toBe(true);
  expect(p.teams.map(team=>p.ordered().filter(member=>member.teamId===team).length)).toEqual([15,15,15,15]);
});

test('Cascade offers the actual two team outcomes and runs with no chatters', async () => {
  await initPhysics();
  const d = director();
  try {
    d.startPractice({ gameId: 'multiplier-cascade', mode: 'faction', format: 'faction',
      seed: 3, bots: 0, team: 'red', teamCount: 2 });
    expect(d.ctx!.setup.teams).toEqual(['red', 'blue']);
    expect(d.ctx!.setup.participants).toEqual([]);
    expect(predictionOptions(d)).toEqual({ titles: ['RED RIOT', 'BLUE BLITZ'], users: ['red', 'blue'] });
    for (let tick = 0; tick < 60; tick++) d.step(1 / 60);
    expect(d.instance!.inspect!().time).toBeGreaterThan(.9);
  } finally { d.destroy(); }
});

test('Cascade creates, locks and resolves the winning team outcome in a show round', async () => {
  await initPhysics();
  const messages: import('@chaos/shared').Message[] = [];
  const d = new Director({ send: message => { messages.push(message); return true; },
    context: (definition, setup) => createContext(definition, setup),
    announce() {}, toast() {}, feed() {}, reset() {} },
  { fast: true, game: 'multiplier-cascade', seed: 26 });
  try {
    d.enabled = new Set(['multiplier-cascade']);
    d.participants.teams = ['red', 'blue'];
    d.mockCount = 0;
    d.start();
    for (let tick = 0; tick < 220 * 60 && !d.results.length; tick++) { d.frame(1 / 60); d.step(1 / 60); }
    expect(d.results).toHaveLength(1);
    const create = messages.find(message => message.type === 'prediction.create');
    expect(create).toMatchObject({ outcomes: ['RED RIOT', 'BLUE BLITZ'] });
    expect(messages.some(message => message.type === 'prediction.lock')).toBe(true);
    const winner = d.results[0].winner;
    if (winner.kind !== 'team') throw new Error('Expected the first team to five finishers');
    expect(messages.find(message => message.type === 'prediction.resolve')).toMatchObject({
      outcomeIndex: winner.teamId === 'red' ? 0 : 1 });
    expect(messages.some(message => message.type === 'prediction.cancel')).toBe(false);
  } finally { d.destroy(); }
});

test('offline named lineup games retain the selected team count and victory rule in round setup',async()=>{
  await initPhysics();const d=director();try{
    for(const gameId of ['blade-brawl','ring-escape','marble-race'])for(const teamCount of [2,4]){
      d.startPractice({gameId,mode:'faction',format:'faction',seed:42,bots:24,team:'red',teamCount,competition:'team'});
      expect(d.ctx!.setup.teams).toHaveLength(teamCount);expect(d.ctx!.setup.competition).toBe('team');
      expect(new Set(d.ctx!.setup.participants.map(p=>p.teamId)).size).toBe(teamCount);
    }
  }finally{d.destroy();}
});
