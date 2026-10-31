import { expect,test,vi } from 'vitest';
import type { Message } from '@chaos/shared';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';
import type { BaseGame } from '../../apps/show/src/kit/base-game';

function scene(messages:Message[]=[]){const director=new Director({send:m=>{messages.push(m);return true;},context:(def,setup,emit)=>createContext(def,setup,{emit}),announce(){},toast(){},feed(){},reset(){}},{fast:true,game:'blade-brawl'});director.enabled=new Set(['blade-brawl']);return director;}
function play(d:Director){d.start();d.frame(1);d.frame(5);d.frame(.5);expect(d.phase).toBe('PLAY');}

test('optional games honor the host queue without joining the default rotation', async () => {
  await initPhysics();
  const messages: Message[] = [];
  const d = scene(messages);
  try {
    const defaults = ['hot-potato', 'blade-brawl', 'multiplier-cascade', 'peg-fever', 'marble-race'];
    d.enabled = new Set(defaults);
    d.command({ type: 'director.command', cmd: 'queue',
      arg: ['pong-wars', 'light-cycles', 'ring-escape', 'peg-fever'] });
    d.start();
    expect(d.game.id).toBe('pong-wars');
    expect(d.format).toBe('faction');
    expect(d.queue).toEqual(['light-cycles', 'ring-escape', 'peg-fever']);
    expect([...d.enabled]).toEqual(defaults);
    d.broadcast();
    const state = messages.filter(message => message.type === 'director.state').at(-1)!;
    expect(state.enabledGames).toEqual(defaults);
    expect(state.format).toBe('faction');
    for (const [round, id, format] of [[2, 'light-cycles', 'ffa'], [3, 'ring-escape', 'ffa']] as const) {
      d.round = round;
      d.modeOverride = 'cvs';
      d.select();
      expect(d.game.id).toBe(id);
      expect(d.format).toBe(format);
    }
  } finally { d.destroy(); }
});

test('optional automatic rotation selection is reported to every dashboard', async () => {
  await initPhysics();
  const messages: Message[] = [];
  const d = scene(messages);
  try {
    d.command({ type: 'director.command', cmd: 'enableGame', arg: 'pong-wars' });
    d.broadcast();
    expect(messages.filter(message => message.type === 'director.state').at(-1)?.enabledGames)
      .toContain('pong-wars');
    d.command({ type: 'director.command', cmd: 'enableGame', arg: 'pong-wars' });
    d.broadcast();
    expect(messages.filter(message => message.type === 'director.state').at(-1)?.enabledGames)
      .not.toContain('pong-wars');
  } finally { d.destroy(); }
});

test('the authenticated display name reaches the locked fighter, cards', async () => {
  await initPhysics();
  const d = scene();
  try {
    d.receive({ type: 'twitch.status', mode: 'live', connected: true,
      authenticated: true, channel: 'test_caster', displayName: 'TestCaster' });
    d.receive({ type: 'chat', userId: 'viewer', login: 'viewer', displayName: 'Viewer',
      color: '#ffffff', text: '!join', isMod: false, isBroadcaster: false, receivedAt: 0 });
    expect(d.ctx?.setup.streamerName).toBe('TestCaster');
    expect(d.instance?.inspect?.().marbles.find(ball => ball.isStreamer)?.id).toBe('streamer');
    expect((d.instance as import('../../apps/show/src/games/blade-brawl').BladeBrawl)
      .marbles.find(ball => ball.isStreamer)?.name).toBe('TestCaster');
    expect(d.view().streamerName).toBe('TestCaster');
  } finally { d.destroy(); }
});

test('retired games cannot return through a saved queue or enable command', async () => {
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
    d.start();
    expect(d.game.id).toBe('peg-fever');
    expect(d.queue[0]).toBe('hot-potato');
    expect(d.queue.at(-1)).toBe('hot-potato');
    expect(d.queue.every(id => d.registry.has(id))).toBe(true);
  } finally { d.destroy(); }
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
  } finally { d.destroy(); }
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
