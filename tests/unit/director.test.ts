import { expect,test,vi } from 'vitest';
import type { Message } from '@chaos/shared';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';
import type { BaseGame } from '../../apps/show/src/kit/base-game';

function scene(messages:Message[]=[]){const director=new Director({send:m=>{messages.push(m);return true;},context:(def,setup,emit)=>createContext(def,setup,{emit}),announce(){},toast(){},feed(){},reset(){}},{fast:true,game:'blade-brawl'});director.enabled=new Set(['blade-brawl']);return director;}
function play(d:Director){d.start(3);d.frame(1);d.frame(5);d.frame(.5);expect(d.phase).toBe('PLAY');}

test('the authenticated display name reaches the locked fighter, cards and Prediction title', async () => {
  await initPhysics();
  const d = scene();
  try {
    d.receive({ type: 'twitch.status', mode: 'live', connected: true, canPredict: true,
      authenticated: true, channel: 'test_caster', displayName: 'TestCaster' });
    d.receive({ type: 'chat', userId: 'viewer', login: 'viewer', displayName: 'Viewer',
      color: '#ffffff', text: '!join', isMod: false, isBroadcaster: false, receivedAt: 0 });
    expect(d.ctx?.setup.streamerName).toBe('TestCaster');
    expect(d.instance?.inspect?.().marbles.find(ball => ball.isStreamer)?.id).toBe('streamer');
    expect((d.instance as import('../../apps/show/src/games/blade-brawl').BladeBrawl)
      .marbles.find(ball => ball.isStreamer)?.name).toBe('TestCaster');
    expect(d.view().streamerName).toBe('TestCaster');
    expect(d.cupShow.name('streamer')).toBe('TestCaster');
    expect(d.game.predictionTitle(d.ctx!.setup)).toContain('TestCaster');
  } finally { d.destroy(); }
});

test('retired games cannot return through a saved Cup queue or enable command', async () => {
  await initPhysics();
  const d = scene();
  try {
    d.enabled = new Set(d.registry.keys());
    d.command({ type: 'director.command', cmd: 'queue',
      arg: ['spinner-showdown', 'peg-fever', 'tower-topple', 'hot-potato'] });
    expect(d.queue).toEqual(['peg-fever', 'hot-potato']);
    for (const id of ['spinner-showdown', 'tower-topple']) {
      d.command({ type: 'director.command', cmd: 'enableGame', arg: id });
      expect(d.enabled.has(id)).toBe(false);
      expect(d.registry.has(id)).toBe(false);
    }
    d.start(5);
    expect(d.game.id).toBe('peg-fever');
    expect(d.queue[0]).toBe('hot-potato');
    expect(d.queue.at(-1)).toBe('blade-brawl');
    expect(d.queue.every(id => d.registry.has(id))).toBe(true);
  } finally { d.destroy(); }
});

test('automatic Cup pause, crash refund, skip and end recover cleanly',async()=>{
  await initPhysics();const messages:Message[]=[],d=scene(messages);
  try{
    d.start(3);d.frame(1);expect(d.phase).toBe('LOBBY_BET');expect(messages.some(m=>m.type==='prediction.create')).toBe(true);
    d.command({type:'director.command',cmd:'pause'});d.frame(10);expect(d.phase).toBe('LOBBY_BET');
    d.command({type:'director.command',cmd:'resume'});d.frame(5);expect(d.phase).toBe('LOCK_COUNTDOWN');const seed=d.roundSeed;d.frame(.5);expect(d.roundSeed).toBe(seed);
    d.instance!.step=()=>{throw new Error('Injected physics failure');};d.step(1/60);
    expect(d.phase).toBe('RESULT');expect(d.result?.winner.kind).toBe('void');expect(messages.some(m=>m.type==='prediction.cancel')).toBe(true);
    d.frame(2);expect(d.phase).toBe('STANDINGS');d.frame(1);expect(d.phase).toBe('INTRO');d.command({type:'director.command',cmd:'skip'});expect(d.results).toHaveLength(2);
    d.command({type:'director.command',cmd:'endCup'});expect(d.phase).toBe('CUP_RESULTS');
  }finally{d.destroy();}
});

test('the hidden 150s threshold starts sudden death and never invents a clock result',async()=>{
  await initPhysics();const messages:Message[]=[],d=scene(messages);
  try {
    play(d);
    const suddenDeath = vi.fn();
    d.instance!.suddenDeath = suddenDeath;
    d.instance!.step = () => {};
    d.instance!.status = () => 'playing';
    for (let n = 0; n < 8999; n++) d.step(1 / 60);
    expect(suddenDeath).not.toHaveBeenCalled();
    for (let n = 0; n < 3001; n++) d.step(1 / 60);
    expect(suddenDeath).toHaveBeenCalledOnce();
    expect(d.phase).toBe('PLAY');
    expect(d.result).toBeUndefined();
    expect(messages.some(message => message.type === 'prediction.cancel')).toBe(false);
  } finally { d.destroy(); }
});

test('connection loss drops wagers while the automatic physics keeps moving',async()=>{
  await initPhysics();const d=scene();
  try{play(d);expect(d.noWagers).toBe(false);d.connection(false);expect(d.noWagers).toBe(true);d.connection(true);expect(d.noWagers).toBe(true);const game=d.instance as BaseGame,time=game.time;d.step(1/60);expect(game.time).toBeGreaterThan(time);expect(d.paused).toBe(false);expect(d.phase).toBe('PLAY');}finally{d.destroy();}
});

test('a decided live arena gets its two-second payoff before the outro settles', async () => {
  await initPhysics();
  const d = scene();
  try {
    play(d);
    d.options.fast = false;
    d.ctx!.headless = false;
    d.instance!.step = () => {};
    d.instance!.status = () => ({ done: { winner: { kind: 'chat' }, mvps: [],
      highlights: [], perUser: {}, replay: { seed: d.roundSeed, inputs: [] } } });
    d.step(1 / 60);
    expect(d.phase).toBe('PLAY');
    expect(d.results).toHaveLength(0);
    const decidedTick = d.tick;
    d.step(1 / 60);
    expect(d.tick).toBe(decidedTick);
    d.frame(1.99);
    expect(d.phase).toBe('PLAY');
    d.frame(.02);
    expect(d.phase).toBe('RESULT');
    expect(d.results).toHaveLength(1);
  } finally { d.destroy(); }
});
