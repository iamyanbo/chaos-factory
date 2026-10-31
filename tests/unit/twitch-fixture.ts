import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { vi } from 'vitest';
import { JsonStore } from '../../apps/server/src/storage';
import { TWITCH_SCOPES } from '../../apps/server/src/twitch/auth';

export const AUTH_SETTINGS = { clientId: 'test-client', clientSecret: 'test-secret',
  redirectUri: 'http://localhost:4174/auth/callback' };
export const DATE = '2026-10-26T00:00:00.000Z';
export const USER = { id: '100', login: 'host', display_name: 'Host', type: '', broadcaster_type: 'affiliate',
  description: '', profile_image_url: '', offline_image_url: '', view_count: 0, created_at: DATE };

export async function temporaryStore() {
  const directory = await mkdtemp(join(tmpdir(), 'chaos-twitch-'));
  const store = new JsonStore(directory);
  return { directory, store, clean: async () => {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('chaos-twitch-'))
      throw new Error('Refusing to remove an unexpected test directory');
    await rm(directory, { recursive: true, force: true });
  } };
}

export async function until(test: () => boolean, timeout = 5000): Promise<void> {
  const end = Date.now() + timeout;
  while (!test()) {
    if (Date.now() > end) throw new Error('Fixture condition timed out');
    await new Promise(done => setTimeout(done, 10));
  }
}

/** Real Twurple calls hit these HTTP fixtures, never an external Twitch account. */
export function twitchHttp(options: { clientId?: string; broadcasterType?: '' | 'affiliate' | 'partner' } = {}) {
  const calls: { url: URL; method: string; body?: Record<string, unknown> }[] = [];
  const subscriptions: Record<string, unknown>[] = [];
  let scopes = [...TWITCH_SCOPES];
  let authorized = true;
  let tokenCounter = 0;
  let deviceState: 'pending' | 'authorized' | 'denied' | 'slow_down' | 'unavailable' = 'pending';
  let deviceLifetime = 60;
  let rejectDevice = false;
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
    headers: { 'Content-Type': 'application/json', 'Ratelimit-Limit': '800', 'Ratelimit-Remaining': '799',
      'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60) } });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = init.body instanceof URLSearchParams ? Object.fromEntries(init.body)
      : typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url.hostname === 'id.twitch.tv' && url.pathname.endsWith('/device')) {
      if (rejectDevice) return response({ message: 'invalid client' }, 400);
      return response({ device_code: 'private-device-code', user_code: 'TESTCODE', expires_in: deviceLifetime,
        interval: 5, verification_uri: 'https://www.twitch.tv/activate?public=true&device-code=TESTCODE' });
    }
    if (url.hostname === 'id.twitch.tv' && url.pathname.endsWith('/token')) {
      if (body?.grant_type === 'urn:ietf:params:oauth:grant-type:device_code' && deviceState !== 'authorized') {
        const message = { pending: 'authorization_pending', denied: 'access_denied',
          slow_down: 'slow_down', unavailable: 'service unavailable' }[deviceState];
        return response({ message }, deviceState === 'unavailable' ? 503 : 400);
      }
      tokenCounter++;
      return response({ access_token: `test-access-${tokenCounter}`, refresh_token: `test-refresh-${tokenCounter}`,
        expires_in: 3600, scope: scopes, token_type: 'bearer' });
    }
    if (url.hostname === 'id.twitch.tv' && url.pathname.endsWith('/validate')) {
      return authorized ? response({ client_id: options.clientId ?? AUTH_SETTINGS.clientId, user_id: '100', login: 'host',
        scopes, expires_in: 3600 }) : response({ status: 401, message: 'invalid access token' }, 401);
    }
    if (url.hostname !== 'api.twitch.tv') throw new Error('Unexpected external fixture request');
    if (url.pathname.endsWith('/users')) return response({ data: [{ ...USER,
      broadcaster_type: options.broadcasterType ?? USER.broadcaster_type }] });
    if (url.pathname.endsWith('/eventsub/subscriptions')) {
      if (method === 'DELETE') return new Response(null, { status: 204 });
      const subscription = { ...body, id: `subscription-${subscriptions.length + 1}`, status: 'enabled',
        created_at: DATE, cost: 0 };
      subscriptions.push(subscription);
      return response({ data: [subscription], total: subscriptions.length, total_cost: 0, max_total_cost: 10 }, 202);
    }
    throw new Error(`Unexpected fixture endpoint ${url.pathname}`);
  }));
  return { calls, subscriptions,
    set deviceState(value: typeof deviceState) { deviceState = value; },
    set deviceLifetime(value: number) { deviceLifetime = value; },
    set rejectDevice(value: boolean) { rejectDevice = value; },
    set scopes(value: string[]) { scopes = value; }, set authorized(value: boolean) { authorized = value; } };
}

export async function eventSocket(subscriptions: Record<string, unknown>[]) {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(wss, 'listening');
  const port = (wss.address() as { port: number }).port;
  const url = `ws://127.0.0.1:${port}`;
  let connections = 0;
  const metadata = (type: string) => ({ message_id: randomUUID(), message_type: type,
    message_timestamp: new Date().toISOString() });
  wss.on('connection', socket => {
    connections++;
    socket.send(JSON.stringify({ metadata: metadata('session_welcome'), payload: { session: {
      id: `session-${connections}`, status: 'connected', connected_at: DATE,
      keepalive_timeout_seconds: 10, reconnect_url: null } } }));
  });
  const send = (message: unknown) => {
    for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  };
  return { url, get connections() { return connections; },
    notify(type: string, event: unknown, messageId = randomUUID()) {
      const subscription = subscriptions.find(value => value.type === type);
      if (!subscription) throw new Error('Subscription was not registered');
      send({ metadata: { ...metadata('notification'), message_id: messageId,
        subscription_type: type, subscription_version: '1' }, payload: { subscription, event } });
    },
    reconnect() { send({ metadata: metadata('session_reconnect'), payload: { session: {
      id: `session-${connections}`, status: 'reconnecting', connected_at: DATE,
      keepalive_timeout_seconds: 10, reconnect_url: url } } }); },
    revoke() {
      send({ metadata: metadata('revocation'), payload: { subscription: {
        ...subscriptions[0], status: 'authorization_revoked' } } });
    },
    async close() { for (const client of wss.clients) client.terminate(); await new Promise<void>(done => wss.close(() => done())); }
  };
}

export function chatEvent(text = '!join') {
  return { broadcaster_user_id: '100', broadcaster_user_login: 'host', broadcaster_user_name: 'Host',
    chatter_user_id: '200', chatter_user_login: 'viewer', chatter_user_name: 'Viewer',
    message_id: randomUUID(), message: { text, fragments: [{ type: 'text', text, cheermote: null, emote: null, mention: null }] },
    color: '#f472b6', badges: [], message_type: 'text', cheer: null, reply: null,
    channel_points_custom_reward_id: null, source_broadcaster_user_id: null,
    source_broadcaster_user_login: null, source_broadcaster_user_name: null,
    source_message_id: null, source_badges: null, is_source_only: null };
}
