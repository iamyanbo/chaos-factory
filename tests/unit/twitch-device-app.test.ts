import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { afterEach, expect, test, vi } from 'vitest';
import type { Message } from '@chaos/shared';
import { createServer } from '../../apps/server/src/app';
import { TwitchAuth } from '../../apps/server/src/twitch/auth';
import { LiveBridge } from '../../apps/server/src/twitch/live';
import { chatEvent, eventSocket, temporaryStore, twitchHttp, until } from './twitch-fixture';

const CLIENT_ID = 'publicclientfixture1234567890';
const headers = { host: 'localhost:4181', origin: 'http://localhost:4181' };
afterEach(() => vi.unstubAllGlobals());

test('public setup routes reject foreign/local cross-origin requests and hide unowned login state', async () => {
  const storage = await temporaryStore();
  const http = twitchHttp({ clientId: CLIENT_ID });
  const runtime = await createServer({ DATA_DIR: storage.directory, TWITCH_MODE: 'live',
    TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' });
  try {
    await runtime.connect();
    const body = { clientId: CLIENT_ID };
    for (const request of [
      { headers: { host: 'localhost:4181', origin: 'https://foreign.example' } },
      { headers: { host: 'foreign.example', origin: 'http://foreign.example' } },
      { headers: { host: 'localhost:4181' } },
      { headers, remoteAddress: '192.0.2.1' },
    ]) expect((await runtime.app.inject({ method: 'POST', url: '/auth/device/start', payload: body, ...request })).statusCode).toBe(403);
    expect(http.calls).toHaveLength(0);
    const started = await runtime.app.inject({ method: 'POST', url: '/auth/device/start', headers, payload: body });
    expect(started.statusCode).toBe(200);
    expect(started.headers['set-cookie']).toContain('HttpOnly; SameSite=Strict');
    expect(started.body).not.toContain('private-device-code');
    expect(started.headers['cache-control']).toBe('no-store');
    const cookie = String(started.headers['set-cookie']).split(';')[0];
    expect((await runtime.app.inject({ url: '/auth/device/status', headers })).json()).toEqual({ state: 'idle' });
    expect((await runtime.app.inject({ url: '/auth/device/status', headers: { ...headers, cookie } })).json().state).toBe('waiting');
    expect((await runtime.app.inject({ method: 'POST', url: '/auth/device/cancel', headers, payload: {} })).statusCode).toBe(409);
    expect((await runtime.app.inject({ method: 'POST', url: '/auth/device/cancel', headers: { ...headers, cookie }, payload: {} })).statusCode).toBe(200);
    const status = (await runtime.app.inject('/api/twitch/status')).json();
    expect(status).toMatchObject({ mode: 'live', configured: true, authenticated: false, eventSubConnected: false });
    expect(JSON.stringify(status)).not.toMatch(/test-access|private-device-code|clientSecret/);
  } finally { await runtime.app.close(); await storage.clean(); }
});

test('device authorization starts real SDK chat, then the saved Client ID and tokens restore automatically', async () => {
  const http = twitchHttp({ clientId: CLIENT_ID });
  const socket = await eventSocket(http.subscriptions);
  const storage = await temporaryStore();
  const auth = new TwitchAuth({ clientId: '', clientSecret: '', redirectUri: 'http://localhost:4181/auth/callback' }, storage.store);
  const bridge = new LiveBridge(auth, socket.url);
  const runtime = await createServer({ DATA_DIR: storage.directory, TWITCH_MODE: 'live' }, false, bridge);
  const messages: Message[] = [];
  let show: WebSocket | undefined;
  let closed = false;
  try {
    await runtime.app.listen({ host: '127.0.0.1', port: 0 });
    await runtime.connect();
    const port = (runtime.app.server.address() as { port: number }).port;
    show = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    show.on('message', data => messages.push(JSON.parse(String(data))));
    await once(show, 'open');
    show.send(JSON.stringify({ type: 'hello', role: 'show' }));
    const start = await runtime.app.inject({ method: 'POST', url: '/auth/device/start', headers,
      payload: { clientId: CLIENT_ID } });
    expect(start.statusCode).toBe(200);
    http.deviceState = 'authorized';
    await until(() => bridge.status().connected, 8000);
    expect(bridge.status()).toMatchObject({ authenticated: true, eventSubConnected: true, channel: 'host' });
    socket.notify('channel.chat.message', chatEvent());
    await until(() => messages.some(message => message.type === 'chat'));
    expect(messages.find(message => message.type === 'chat')).toMatchObject({ text: '!join', userId: '200' });
    expect(bridge.status().lastJoinAt).toBeGreaterThan(0);
    expect(http.subscriptions.map(subscription => subscription.type)).toEqual(['channel.chat.message']);
    expect(http.calls.some(call => call.url.pathname.endsWith('/predictions'))).toBe(false);
    expect(JSON.stringify(messages)).not.toMatch(/test-access|test-refresh|private-device-code/);
    show.close();
    await once(show, 'close');
    show = undefined;
    await runtime.app.close();
    closed = true;
    const restored = await createServer({ DATA_DIR: storage.directory, TWITCH_MODE: 'live',
      TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' });
    try {
      expect((restored.bridge as LiveBridge).auth.settings.clientId).toBe(CLIENT_ID);
      // Validate the saved authorization without opening a real external socket in this fixture.
      (restored.bridge as LiveBridge).auth.onReady = async () => {};
      await restored.connect();
      expect(restored.bridge.status()).toMatchObject({ authenticated: true, authFlow: 'device', channel: 'host' });
      expect(http.calls.filter(call => call.url.pathname.endsWith('/device'))).toHaveLength(1);
    } finally { await restored.app.close(); }
  } finally {
    show?.close();
    if (!closed) await runtime.app.close();
    await socket.close();
    await storage.clean();
  }
});
