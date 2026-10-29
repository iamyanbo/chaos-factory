import { describe, expect, test } from 'vitest';
import { Rng, createPredictionSchema, messageSchema, predictionTitle, TEAMS } from '@chaos/shared';
import { FixedLoop } from '../../apps/show/src/engine/loop';
import { PhysicsWorld, initPhysics } from '../../apps/show/src/engine/physics';
import { parseChat } from '../../apps/server/src/chat/parse';
import { RateLimit } from '../../apps/server/src/chat/limits';
import { Participants } from '../../apps/show/src/director/participants';
import { Balance } from '../../apps/show/src/director/balance';
import { Meter } from '../../apps/show/src/kit/meter';
import { Vote } from '../../apps/show/src/kit/vote';
describe('deterministic engine',()=>{
  test('RNG streams repeat and forks are independent',()=>{const a=new Rng(42),b=new Rng(42);expect(Array.from({length:100},()=>a.next())).toEqual(Array.from({length:100},()=>b.next()));expect(a.fork('world').next()).toBe(b.fork('world').next());expect(a.fork('world').next()).not.toBe(a.fork('bots').next());expect(a.shuffle([1,2,3]).sort()).toEqual([1,2,3]);});
  test('loop caps steps, interpolates and keeps rendering during hit stop',()=>{let steps=0,renders=0;const loop=new FixedLoop(()=>steps++,()=>renders++);loop.frame(1/30);expect(steps).toBe(2);loop.hitStop(80);loop.frame(.05);expect(steps).toBe(2);expect(renders).toBe(2);loop.frame(.05);loop.frame(.1);expect(steps).toBe(7);loop.paused=true;loop.frame(.1);expect(steps).toBe(7);});
  test('Rapier repeats 600 steps exactly and cleans its registry',async()=>{await initPhysics();function run(){const p=new PhysicsWorld();p.box(0,800,1800,20,{dynamic:false});const rng=new Rng(91);const bodies=Array.from({length:50},()=>p.ball(rng.range(-400,400),rng.range(0,400),16));for(let i=0;i<600;i++)p.step();const positions=bodies.map(b=>p.position(b));p.destroy();expect(p.entities.size).toBe(0);return positions;}expect(run()).toEqual(run());});
});
describe('chat and social rules',()=>{
  test.each([['join',{kind:'join',teamId:undefined}],[' !JOIN red ',{kind:'join',teamId:'red'}],[' RED ',null],['!SLAM',null],['aim 50',null],['!stats',null],['!help',null],['!join purple',null],['!join red extra',null],['3',null],['😀',null],['',null]])('parses %s',(input,expected)=>expect(parseChat(input)).toEqual(expected));
  test('limits first input and cooldown, then permits at exact deadline',()=>{const l=new RateLimit();expect(l.allow('a',0,400)).toBe(true);expect(l.allow('a',399,400)).toBe(false);expect(l.allow('a',400,400)).toBe(true);});
  test('team lock, smallest team, first-come overflow and new Cup',()=>{const p=new Participants();p.reset(2);const u=(id:string)=>({userId:id,login:id,displayName:id,color:'#fff'});expect(p.join(u('a'),0,'red').teamId).toBe('red');expect(p.join(u('a'),1,'blue').teamId).toBe('red');expect(p.join(u('b'),2).teamId).toBe('blue');p.join(u('c'),3);expect(p.roster(1,3)[0].userId).toBe('a');expect(p.crowd).toBe(2);p.reset();expect(p.members.size).toBe(0);});
  test('meter is normalized and ignores repeat spam; votes are per user',()=>{const meter=new Meter(6,.5);meter.add('a',0);meter.add('a',1);expect(meter.value(1,4)).toBe(.5);meter.add('b',1);expect(meter.consume(1,4)).toBe(true);expect(meter.consume(2,4)).toBe(false);expect(meter.value(10,4)).toBe(0);const v=new Vote(['a','b']);v.cast('a','a');v.cast('a','b');expect(v.counts()).toEqual([0,1]);});
  test('difficulty moves toward fair odds and clamps',()=>{const b=new Balance();for(let i=0;i<20;i++)b.update('a',{kind:'streamer'});expect(b.get('a')).toBe(.85);for(let i=0;i<20;i++)b.update('a',{kind:'chat'});expect(b.get('a')).toBe(.15);});
});
describe('protocol',()=>{
  test('title and outcome limits',()=>{for(const mode of['cvs','faction']as const)expect(predictionTitle('X'.repeat(100),mode).length).toBe(45);expect(createPredictionSchema.safeParse({title:'ok',outcomes:['a','b'],windowSec:30}).success).toBe(true);expect(createPredictionSchema.safeParse({title:'ok',outcomes:['a'.repeat(26),'b'],windowSec:30}).success).toBe(false);expect(createPredictionSchema.safeParse({title:'ok',outcomes:['a','b'],windowSec:29}).success).toBe(false);expect(Object.values(TEAMS).every(t=>t.name.length<=25)).toBe(true);});
  test('rejects nonfinite inputs, bad roles and excessive predictions',()=>{expect(messageSchema.safeParse({type:'hello',role:'attacker'}).success).toBe(false);expect(messageSchema.safeParse({type:'streamer.input',action:'left',pressed:true,seq:0,value:NaN}).success).toBe(false);});
});
