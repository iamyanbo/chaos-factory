import { expect, test } from 'vitest';
import { messageSchema, type Message } from '@chaos/shared';

test('every current protocol message round-trips through JSON and zod', () => {
  const messages: Message[] = [
    { type: 'hello', role: 'show' },
    { type: 'chat', userId: 'a', login: 'a', displayName: 'A', color: '#fff', text: '!join',
      isMod: false, isBroadcaster: false, receivedAt: 0 },
    { type: 'streamer.input', action: 'left', pressed: true, seq: 1 },
    { type: 'director.command', cmd: 'stop' },
    { type: 'twitch.status', mode: 'mock', connected: true, channel: 'mock' },
    { type: 'director.state', phase: 'PLAY', gameId: 'blade-brawl', mode: 'cvs', timeLeft: 60, round: 1 },
    { type: 'mock.chat', login: 'you', text: '!join' },
    { type: 'mock.swarm', viewers: 60, activity: .5, delayMs: [2500, 4500] },
    { type: 'mock.status', viewers: 60, activity: .5, delayMs: [2500, 4500], personalities: {} },
    { type: 'server.log', level: 'info', message: 'Ready', at: 0 },
    { type: 'ping', at: 0 }, { type: 'pong', at: 0 }
  ];
  for (const message of messages) expect(messageSchema.parse(JSON.parse(JSON.stringify(message)))).toEqual(message);
  expect(new Set(messages.map(message => message.type)))
    .toEqual(new Set(messageSchema.options.map(schema => schema.shape.type.value)));
});

test('retired betting, progression writes and Cup commands are rejected', () => {
  for (const type of ['prediction.create', 'prediction.lock', 'prediction.resolve', 'prediction.cancel',
    'prediction.update', 'round.record', 'profiles.snapshot', 'stats.snapshot']) {
    expect(messageSchema.safeParse({ type }).success).toBe(false);
  }
  for (const cmd of ['endCup', 'toggleWagers', 'betWindow']) {
    expect(messageSchema.safeParse({ type: 'director.command', cmd }).success).toBe(false);
  }
});
