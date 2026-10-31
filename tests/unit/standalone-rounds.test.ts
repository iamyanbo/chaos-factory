import { beforeAll, expect, test } from 'vitest';
import { stableViewerColor, type Message } from '@chaos/shared';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';

beforeAll(initPhysics);

function scene() {
  const messages: Message[] = [];
  const director = new Director({
    send: message => { messages.push(message); return true; },
    context: (game, setup, emit) => createContext(game, setup, { emit }),
    announce() {}, toast() {}, feed() {}, reset() {}
  }, { fast: true, game: 'blade-brawl', seed: 42 });
  director.enabled = new Set(['blade-brawl']);
  return { director, messages };
}

test('the fifth and sixth queued rounds are ordinary full-field rounds with no qualification', () => {
  const { director: d, messages } = scene();
  try {
    const queue = ['blade-brawl', 'hot-potato', 'peg-fever', 'marble-race', 'pong-wars', 'ring-escape'];
    d.command({ type: 'director.command', cmd: 'queue', arg: queue });
    d.start();
    for (const [index, id] of queue.entries()) {
      expect(d.round).toBe(index + 1);
      expect(d.game.id).toBe(id);
      expect(d.ctx!.setup.participants).toHaveLength(Math.min(d.mockCount, d.capacity));
      d.void('Host cancellation');
      d.command({ type: 'director.command', cmd: 'skip' });
    }
    expect(messages.every(message => message.type === 'director.state')).toBe(true);
    expect(d.view().show).not.toHaveProperty('standings');
    expect(d.view().show).not.toHaveProperty('qualified');
  } finally { d.destroy(); }
});

test('pause, physics failure, skip and stop remain recoverable without betting', () => {
  const { director: d } = scene();
  try {
    d.start();
    d.frame(1);
    d.command({ type: 'director.command', cmd: 'pause' });
    d.frame(10);
    expect(d.phase).toBe('LOBBY');
    d.command({ type: 'director.command', cmd: 'resume' });
    d.frame(2);
    d.frame(.5);
    expect(d.phase).toBe('PLAY');
    const before = d.tick;
    d.connection(false);
    d.step(1 / 60);
    expect(d.tick).toBe(before + 1);
    d.instance!.step = () => { throw new Error('Injected failure'); };
    d.step(1 / 60);
    expect(d.result!.winner.kind).toBe('void');
    d.command({ type: 'director.command', cmd: 'skip' });
    expect(d.round).toBe(2);
    expect(d.phase).toBe('INTRO');
    d.command({ type: 'director.command', cmd: 'stop' });
    expect(d.phase).toBe('ATTRACT');
  } finally { d.destroy(); }
});

test('viewer colors remain stable without a profile or progression record', () => {
  expect(stableViewerColor('viewer')).toBe(stableViewerColor('viewer'));
  expect(stableViewerColor('viewer')).toMatch(/^#[0-9a-f]{6}$/);
});
