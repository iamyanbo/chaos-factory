import { expect, test, vi } from 'vitest';
import { messageSchema, type Message } from '@chaos/shared';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';

function scene(messages: Message[] = []) {
  const d = new Director({
    send: message => { messages.push(message); return true; },
    context: (game, setup, emit) => createContext(game, setup, { emit }),
    announce() {}, toast() {}, feed() {}, reset() {},
  }, { game: 'blade-brawl', fast: true });
  d.enabled = new Set(['blade-brawl']);
  return d;
}

function join(d: Director, id: string): void {
  d.receive({ type: 'chat', userId: id, login: id, displayName: id, color: '#ff4f7b',
    text: '!join', isMod: false, isBroadcaster: false, receivedAt: 0 });
}

test('live rounds wait indefinitely for joins and the host; an empty arena cannot start', async () => {
  await initPhysics();
  const messages: Message[] = [];
  const d = scene(messages);
  try {
    d.broadcast();
    expect(messageSchema.safeParse(messages.at(-1)).success).toBe(true);
    d.receive({ type: 'twitch.status', mode: 'live', channel: 'host', connected: true });
    expect(d.roundStart).toBe('manual');
    d.start();
    d.frame(1);
    expect(d.waitingForHost).toBe(true);
    d.frame(1000);
    d.command({ type: 'director.command', cmd: 'startRound' });
    expect(d.phase).toBe('LOBBY');
    expect(d.waitingForHost).toBe(true);
    expect(messageSchema.safeParse(messages.at(-1)).success).toBe(true);
    join(d, 'alice');
    join(d, 'bob');
    expect(d.ctx!.setup.participants.map(p => p.userId)).toEqual(['alice', 'bob']);
    d.command({ type: 'director.command', cmd: 'startRound' });
    expect(d.phase).toBe('LOCK_COUNTDOWN');
    join(d, 'late');
    expect(d.ctx!.setup.participants.map(p => p.userId)).toEqual(['alice', 'bob']);
    d.frame(.31);
    expect(d.phase).toBe('PLAY');
    d.void('Test round');
    d.frame(1);
    d.frame(1);
    expect(d.waitingForHost).toBe(true);
  } finally { d.destroy(); }
});

test('host preference survives live status updates and automatic mode releases a waiting lobby', async () => {
  await initPhysics();
  const d = scene();
  try {
    d.command({ type: 'director.command', cmd: 'setRoundStart', arg: 'manual' });
    d.start();
    d.frame(1);
    d.command({ type: 'director.command', cmd: 'setRoundStart', arg: 'automatic' });
    expect(d.waitingForHost).toBe(false);
    expect(d.timeLeft()).toBe(10);
    d.receive({ type: 'twitch.status', mode: 'live', channel: 'host', connected: true });
    expect(d.roundStart).toBe('automatic');
  } finally { d.destroy(); }
});

test('game preparation completes before the visible three-second countdown begins', async () => {
  await initPhysics();
  const d = scene();
  try {
    const choose = vi.fn(async () => ({ requestedSeed: d.roundSeed, selectedSeed: 8,
      elapsedMs: 1, budgetMs: 6000, timedOut: false, candidates: [] }));
    d.hooks.chooseTake = choose;
    d.game = d.registry.get('ring-escape')!;
    d.preview();
    d.enter('LOCK_COUNTDOWN');
    d.frame(20);
    await Promise.resolve();
    expect(d.takePending).toBe(false);
    expect(d.phase).toBe('LOCK_COUNTDOWN');
    expect(d.timeLeft()).toBe(3);
    d.frame(.29);
    expect(d.phase).toBe('LOCK_COUNTDOWN');
    d.frame(.02);
    expect(d.phase).toBe('PLAY');
  } finally { d.destroy(); }
});

test('automatic rounds leave ten seconds to join, then start the countdown', async () => {
  await initPhysics();
  const messages: Message[] = [];
  const d = scene(messages);
  try {
    d.start();
    d.frame(1);
    expect(d.phase).toBe('LOBBY');
    expect(d.timeLeft()).toBe(10);
    d.frame(.99);
    expect(d.phase).toBe('LOBBY');
    d.frame(.02);
    expect(d.phase).toBe('LOCK_COUNTDOWN');
  } finally { d.destroy(); }
});
