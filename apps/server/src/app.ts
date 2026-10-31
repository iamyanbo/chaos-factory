import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableViewerColor, parseChat, type Message } from '@chaos/shared';
import { config, delayRange } from './config';
import { Hub } from './hub';
import { JsonStore } from './storage';
import { RateLimit } from './chat/limits';
import { MockBridge } from './twitch/mock';
import { LiveBridge } from './twitch/live';
import { TwitchAuth } from './twitch/auth';
import { registerOAuth } from './twitch/oauth';
import { registerDeviceLogin } from './twitch/device-routes';
import { publicClientId } from './twitch/device-login';
import type { TwitchBridge } from './twitch/bridge';

export async function createServer(overrides: Partial<typeof config> = {}, logger = false,
  suppliedBridge?: TwitchBridge) {
  const settings = { ...config, ...overrides };
  const app = Fastify({ logger, bodyLimit: 16384 });
  const store = new JsonStore(resolve(settings.DATA_DIR));
  const hub = new Hub(app.server);
  const savedClient = settings.TWITCH_MODE === 'live'
    ? await store.read<{ clientId?: string }>('twitch-client.json', {}) : {};
  const savedId = publicClientId.safeParse(savedClient?.clientId);
  const clientId = settings.TWITCH_CLIENT_ID || (savedId.success ? savedId.data : '');
  const bridge: TwitchBridge = suppliedBridge ?? (settings.TWITCH_MODE === 'live'
    ? new LiveBridge(new TwitchAuth({ clientId,
      clientSecret: settings.TWITCH_CLIENT_ID ? settings.TWITCH_CLIENT_SECRET : '',
      deviceFlow: settings.TWITCH_AUTH_FLOW === 'device', redirectUri: settings.TWITCH_REDIRECT_URI }, store))
    : new MockBridge(settings.MOCK_VIEWERS, delayRange(settings.MOCK_DELAY_MS)));
  const mock = bridge instanceof MockBridge ? bridge : undefined;
  if (bridge instanceof LiveBridge) {
    registerOAuth(app, bridge.auth);
    registerDeviceLogin(app, bridge.auth, () => hub.broadcast({ type: 'twitch.status', ...bridge.status() }));
  }
  const limits = new RateLimit();
  const logs: Extract<Message, { type: 'server.log' }>[] = [];
  const log = (message: string, level: 'info' | 'error' = 'info') => {
    const entry = { type: 'server.log' as const, message: message.slice(0, 500), level, at: Date.now() };
    logs.push(entry);
    if (logs.length > 80) logs.shift();
    hub.broadcast(entry);
  };
  bridge.onStatus = status => hub.broadcast({ type: 'twitch.status', ...status });
  bridge.onChat = chat => {
    const parsed = parseChat(chat.text);
    if (!parsed || !limits.allow(chat.userId, Date.now(), 400)) return;
    chat.color = stableViewerColor(chat.userId);
    hub.broadcast(chat, ['show']);
  };
  const mockStatus = (): Extract<Message, { type: 'mock.status' }> => ({ type: 'mock.status',
    viewers: mock!.bots.length, activity: mock!.activity, delayMs: mock!.delay, personalities: mock!.personalities });
  hub.onHello = send => {
    send({ type: 'twitch.status', ...bridge.status() });
    if (mock) send(mockStatus());
    for (const entry of logs.slice(-10)) send(entry);
  };
  hub.onShowDisconnect = () => log('Show disconnected. Reopen it to start a new round.');
  hub.onMessage = message => {
    if (message.type === 'director.state') {
      mock?.state(message);
    } else if (message.type === 'mock.chat' && mock) mock.manual(message.login, message.text);
    else if (message.type === 'mock.swarm' && mock) {
      mock.configure(message.viewers, message.activity, message.delayMs);
      hub.broadcast(mockStatus());
      log(`Mock swarm: ${message.viewers} viewers, ${message.delayMs.join('–')} ms delay`);
    }
  };
  app.get('/api/health', async () => ({ ok: true, application: 'chaos-factory', mode: bridge.status().mode,
    liveTwitch: bridge.status().mode === 'live', viewers: mock?.bots.length ?? 0, state: hub.state ?? null }));
  app.get('/api/twitch/status', async () => bridge.status());
  app.get('/api/logs', async () => logs);
  const dist = fileURLToPath(new URL('../../show/dist/', import.meta.url));
  if (existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((request, reply) => request.url.startsWith('/api')
      ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'));
  } else {
    app.get('/', async (_request, reply) => reply.redirect('http://127.0.0.1:5173/dashboard'));
    app.get('/dashboard', async (_request, reply) => reply.redirect('http://127.0.0.1:5173/dashboard'));
  }
  app.addHook('preClose', async () => {
    bridge.disconnect();
    hub.close();
  });
  const connect = async () => {
    try { await bridge.connect(); }
    catch { log('Twitch is unavailable. Reconnect from the dashboard; the show continues.', 'error'); }
    hub.broadcast({ type: 'twitch.status', ...bridge.status() });
    log(bridge.status().mode === 'mock' ? 'Mock bridge ready.' : 'Live Twitch bridge ready for broadcaster login.');
  };
  return { app, hub, bridge, store, connect };
}
