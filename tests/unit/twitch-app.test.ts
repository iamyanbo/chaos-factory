import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { afterEach, expect, test, vi } from 'vitest';
import { stableViewerColor, type Message } from '@chaos/shared';
import { createServer } from '../../apps/server/src/app';
import { TwitchAuth } from '../../apps/server/src/twitch/auth';
import { LiveBridge } from '../../apps/server/src/twitch/live';
import { AUTH_SETTINGS, chatEvent, eventSocket, temporaryStore, twitchHttp, until } from './twitch-fixture';

afterEach(() => vi.unstubAllGlobals());

async function client(port: number, role: 'show' | 'dashboard', messages: Message[]) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  socket.on('message', data => messages.push(JSON.parse(String(data))));
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'hello', role }));
  return socket;
}

test('mock remains the default with delayed-bot controls and manual offline !join', async () => {
  const storage = await temporaryStore();
  const runtime = await createServer({ DATA_DIR: storage.directory, MOCK_VIEWERS: 0 });
  const sockets: WebSocket[] = [];
  const messages: Message[] = [];
  try {
    await runtime.app.listen({ host: '127.0.0.1', port: 0 });
    const port = (runtime.app.server.address() as { port: number }).port;
    await runtime.connect();
    sockets.push(await client(port, 'show', messages));
    const dashboard = await client(port, 'dashboard', messages);
    sockets.push(dashboard);
    await until(() => messages.some(message => message.type === 'mock.status'));
    dashboard.send(JSON.stringify({ type: 'mock.chat', login: 'offline_viewer', text: '!join' }));
    await until(() => messages.some(message => message.type === 'chat' && message.login === 'offline_viewer'));
    expect((await runtime.app.inject('/api/health')).json()).toMatchObject({ mode: 'mock', liveTwitch: false });
    expect(messages).toContainEqual(expect.objectContaining({ type: 'twitch.status', mode: 'mock', canPredict: true }));
    expect(messages).toContainEqual(expect.objectContaining({ type: 'profiles.snapshot' }));
  } finally {
    for (const socket of sockets) socket.close();
    await runtime.app.close();
    await storage.clean();
  }
});

test('live mode without credentials serves the dashboard and health with no fake crowd or secret payload', async () => {
  const storage = await temporaryStore();
  const fetch = vi.fn(() => { throw new Error('Unauthenticated server must not call Twitch'); });
  vi.stubGlobal('fetch', fetch);
  const runtime = await createServer({ DATA_DIR: storage.directory, TWITCH_MODE: 'live',
    TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' });
  try {
    await runtime.connect();
    const health = (await runtime.app.inject('/api/health')).json();
    const status = (await runtime.app.inject('/api/twitch/status')).json();
    expect(health).toMatchObject({ ok: true, mode: 'live', viewers: 0 });
    expect(status).toMatchObject({ configured: false, connected: false, canPredict: false });
    expect(status).not.toHaveProperty('accessToken');
    expect((await runtime.app.inject({ url: '/auth/login', headers: { host: 'localhost:4174' } })).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    await runtime.app.listen({ host: '127.0.0.1', port: 0 });
    const port = (runtime.app.server.address() as { port: number }).port;
    const rebound = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: 'http://foreign.example', headers: { host: 'foreign.example' }
    });
    const [code] = await once(rebound, 'close');
    expect(code).toBe(1008);
  } finally { await runtime.app.close(); await storage.clean(); }
});

test('only joins reach the show and ordinary chat does not consume the join cooldown', async () => {
  const storage = await temporaryStore();
  const runtime = await createServer({ DATA_DIR: storage.directory, MOCK_VIEWERS: 0 });
  const messages: Message[] = [];
  let show: WebSocket | undefined;
  try {
    await runtime.app.listen({ host: '127.0.0.1', port: 0 });
    const port = (runtime.app.server.address() as { port: number }).port;
    await runtime.connect();
    show = await client(port, 'show', messages);
    await until(() => messages.some(message => message.type === 'mock.status'));
    for (const text of ['hello', '!stats', '!help', '!vote 2', '!join']) runtime.bridge.onChat({
      type: 'chat', userId: 'one_viewer', login: 'one_viewer', displayName: 'One Viewer',
      color: '#36baff', text,
      isMod: false, isBroadcaster: false, receivedAt: Date.now()
    });
    await until(() => messages.some(message => message.type === 'chat'));
    const chats = messages.filter(message => message.type === 'chat');
    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({ text: '!join' });
  } finally {
    show?.close();
    await runtime.app.close();
    await storage.clean();
  }
});

test('real SDK !join and predictions reach the Show socket while Cup profile records remain intact', async () => {
  const http = twitchHttp();
  const eventsub = await eventSocket(http.subscriptions);
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  const bridge = new LiveBridge(auth, eventsub.url);
  const runtime = await createServer({ DATA_DIR: storage.directory, TWITCH_MODE: 'live' }, false, bridge);
  const messages: Message[] = [];
  let show: WebSocket | undefined;
  try {
    await runtime.app.listen({ host: '127.0.0.1', port: 0 });
    const port = (runtime.app.server.address() as { port: number }).port;
    await runtime.connect();
    show = await client(port, 'show', messages);
    await auth.authorize('test-code');
    await until(() => http.subscriptions.length === 5 && bridge.status().connected);
    await new Promise(done => setTimeout(done, 20));
    eventsub.notify('channel.chat.message', chatEvent());
    await until(() => messages.some(message => message.type === 'chat' && message.userId === '200'));
    const joined = messages.find(message => message.type === 'chat')!;
    expect(joined).toMatchObject({ text: '!join', color: stableViewerColor('200') });
    expect(messages.some(message => message.type === 'mock.status')).toBe(false);
    const roundId = randomUUID();
    show.send(JSON.stringify({ type: 'prediction.create', title: 'Who wins?', outcomes: ['RED', 'BLUE'], windowSec: 30, roundId }));
    await until(() => messages.some(message => message.type === 'prediction.update' && message.status === 'ACTIVE'));
    show.send(JSON.stringify({ type: 'prediction.lock', roundId }));
    await until(() => http.prediction?.status === 'LOCKED');
    show.send(JSON.stringify({ type: 'prediction.resolve', outcomeIndex: 1, roundId }));
    await until(() => messages.some(message => message.type === 'prediction.update' && message.status === 'RESOLVED'));
    show.send(JSON.stringify({ type: 'round.record', gameId: 'blade-brawl', mode: 'cvs', roundId,
      result: { winner: { kind: 'chat' }, champion: { userId: '200', displayName: 'Viewer', reason: 'Last standing' },
        mvps: [], highlights: [], perUser: { '200': { score: 10, tags: ['win'] } }, replay: { seed: 1, inputs: [] } },
      cup: { cupId: randomUUID(), round: 5, final: true, championId: '200', awards: [{ userId: '200',
        login: 'viewer', displayName: 'Viewer', points: 10, place: 1, won: true, reason: 'Grand Final' }] } }));
    await until(() => messages.some(message => message.type === 'profiles.snapshot' && message.users['200']?.cupsWon === 1)
      && messages.some(message => message.type === 'stats.snapshot' && message.users['200']?.rounds === 1));
    const profiles = (await runtime.app.inject('/api/profiles')).json();
    expect(profiles).toMatchObject({ crownUserId: '200', lastWinners: { 'blade-brawl': '@Viewer' },
      users: { '200': { wins: 1, cupsWon: 1, xp: 10, title: 'Cup Champion' } } });
    expect(JSON.stringify(messages)).not.toContain(AUTH_SETTINGS.clientSecret);
    expect(JSON.stringify(messages)).not.toContain('test-access');
  } finally {
    show?.close();
    await runtime.app.close();
    await eventsub.close();
    await storage.clean();
  }
});
