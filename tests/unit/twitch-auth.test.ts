import Fastify from 'fastify';
import { afterEach, expect, test, vi } from 'vitest';
import { TwitchAuth, VALIDATE_INTERVAL_MS } from '../../apps/server/src/twitch/auth';
import { OAuthStates, registerOAuth } from '../../apps/server/src/twitch/oauth';
import { AUTH_SETTINGS, temporaryStore, twitchHttp } from './twitch-fixture';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test('OAuth state is browser-bound, expires and can be used only once', () => {
  let now = 0;
  const states = new OAuthStates(() => now);
  const state = states.issue();
  expect(states.consume(state, 'f'.repeat(64))).toBe(false);
  expect(states.consume(state, state)).toBe(true);
  expect(states.consume(state, state)).toBe(false);
  const expired = states.issue();
  now = 600001;
  expect(states.consume(expired, expired)).toBe(false);
  expect(states.consume(['bad'], expired)).toBe(false);
});

test('local OAuth callback protects the secret, rejects wrong/replayed state and removes code from redirect', async () => {
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  const authorize = vi.spyOn(auth, 'authorize').mockResolvedValue();
  const lines: string[] = [];
  const app = Fastify({ logger: { stream: { write: (line: string) => { lines.push(line); } } } });
  registerOAuth(app, auth);
  const headers = { host: 'localhost:4174' };
  try {
    const canonical = await app.inject({ url: '/auth/login', headers: { host: '127.0.0.1:4174' } });
    expect(canonical.headers.location).toBe('http://localhost:4174/auth/login');
    const login = await app.inject({ url: '/auth/login', headers });
    const location = new URL(login.headers.location!);
    expect(location.origin).toBe('https://id.twitch.tv');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.href).not.toContain(AUTH_SETTINGS.clientSecret);
    const state = location.searchParams.get('state')!;
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    const wrong = await app.inject({ url: `/auth/callback?code=test-code&state=${'0'.repeat(64)}`,
      headers: { ...headers, cookie } });
    expect(wrong.statusCode).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
    const callback = await app.inject({ url: `/auth/callback?code=test-code&state=${state}`,
      headers: { ...headers, cookie } });
    expect(callback.headers.location).toBe('/dashboard?twitch=connected');
    expect(callback.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(callback.headers)).not.toContain('test-code');
    expect(authorize).toHaveBeenCalledExactlyOnceWith('test-code');
    const replay = await app.inject({ url: `/auth/callback?code=test-code&state=${state}`,
      headers: { ...headers, cookie } });
    expect(replay.statusCode).toBe(400);
    const remote = await app.inject({ url: '/auth/login', headers, remoteAddress: '192.0.2.1' });
    expect(remote.statusCode).toBe(403);
    expect(lines.join('')).not.toContain('test-code');
    expect(lines.join('')).not.toContain(AUTH_SETTINGS.clientSecret);
  } finally { await app.close(); auth.disconnect(); await storage.clean(); }
});

test('actual RefreshingAuthProvider exchanges, persists and refreshes server-only tokens, validating hourly', async () => {
  vi.useFakeTimers();
  const http = twitchHttp();
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  let ready = 0;
  let lost = 0;
  auth.onReady = async () => { ready++; };
  auth.onLost = () => { lost++; };
  try {
    await auth.connect();
    await auth.authorize('test-code');
    expect(auth.user?.name).toBe('host');
    expect(ready).toBe(1);
    const first = await storage.store.read<{ token: { accessToken: string } }>('tokens.json', {} as never);
    expect(first.token.accessToken).toBeTruthy();
    await vi.advanceTimersByTimeAsync(VALIDATE_INTERVAL_MS + 1);
    await auth.validate();
    const refreshed = await storage.store.read<typeof first>('tokens.json', {} as never);
    expect(refreshed.token.accessToken).not.toBe(first.token.accessToken);
    expect(http.calls.filter(call => call.url.pathname.endsWith('/validate')).length).toBeGreaterThanOrEqual(2);
    http.authorized = false;
    await vi.advanceTimersByTimeAsync(VALIDATE_INTERVAL_MS);
    await auth.validate().catch(() => {});
    expect(auth.user).toBeUndefined();
    expect(lost).toBeGreaterThan(0);
  } finally { auth.disconnect(); await storage.clean(); }
});

test('missing scopes fail closed without sending an upstream error or credential to the browser', async () => {
  const http = twitchHttp();
  http.scopes = [];
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  try {
    await expect(auth.authorize('test-code')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(auth.user).toBeUndefined();
    expect(auth.lastError).not.toContain(AUTH_SETTINGS.clientSecret);
  } finally { auth.disconnect(); await storage.clean(); }
});
