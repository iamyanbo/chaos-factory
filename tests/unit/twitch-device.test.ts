import { afterEach, expect, test, vi } from 'vitest';
import { TwitchAuth, TWITCH_SCOPES } from '../../apps/server/src/twitch/auth';
import { DeviceLogin } from '../../apps/server/src/twitch/device-login';
import { temporaryStore, twitchHttp } from './twitch-fixture';

const CLIENT_ID = 'publicclientfixture1234567890';
const OWNER = 'a'.repeat(64);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function fixture() {
  const http = twitchHttp({ clientId: CLIENT_ID });
  const storage = await temporaryStore();
  const auth = new TwitchAuth({ clientId: '', clientSecret: '', redirectUri: 'http://localhost:4181/auth/callback' }, storage.store);
  const login = new DeviceLogin(auth);
  return { http, storage, auth, login, clean: async () => { login.close(); auth.disconnect(); await storage.clean(); } };
}

test('a public Client ID is the only configured value; device codes and tokens stay server-side', async () => {
  vi.useFakeTimers();
  const f = await fixture();
  try {
    const status = await f.login.start(OWNER, CLIENT_ID);
    expect(status).toMatchObject({ state: 'waiting', userCode: 'TESTCODE' });
    expect(status.verificationUri).toBe('https://www.twitch.tv/activate?public=true&device-code=TESTCODE');
    expect(JSON.stringify(status)).not.toContain('private-device-code');
    expect(f.http.calls[0].body).toEqual({ client_id: CLIENT_ID, scopes: TWITCH_SCOPES.join(' ') });
    expect(TWITCH_SCOPES).not.toContain('user:write:chat');
    expect(await f.storage.store.read('twitch-client.json', null)).toEqual({ clientId: CLIENT_ID });
    expect(await f.storage.store.read('tokens.json', null)).toBeNull();
    expect(f.auth.configured).toBe(true);
    expect(f.auth.flow).toBe('device');
    expect(f.http.calls.filter(call => call.url.pathname.endsWith('/token'))).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.login.status(OWNER)?.state).toBe('waiting');
    expect(f.http.calls.filter(call => call.url.pathname.endsWith('/token'))).toHaveLength(1);
  } finally { await f.clean(); }
});

test('Twitch slow_down increases the polling interval and repeated clicks reuse the same browser grant', async () => {
  vi.useFakeTimers();
  const f = await fixture();
  try {
    await f.login.start(OWNER, CLIENT_ID);
    expect(await f.login.start(OWNER)).toMatchObject({ state: 'waiting' });
    expect(f.http.calls.filter(call => call.url.pathname.endsWith('/device'))).toHaveLength(1);
    await expect(f.login.start('b'.repeat(64))).rejects.toMatchObject({ code: 'CONNECT_PENDING' });
    expect(f.login.status('b'.repeat(64))).toBeUndefined();
    f.http.deviceState = 'slow_down';
    await vi.advanceTimersByTimeAsync(5000);
    f.http.deviceState = 'pending';
    await vi.advanceTimersByTimeAsync(9999);
    expect(f.http.calls.filter(call => call.url.pathname.endsWith('/token'))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.http.calls.filter(call => call.url.pathname.endsWith('/token'))).toHaveLength(2);
  } finally { await f.clean(); }
});

test.each(['denied', 'expired', 'canceled'] as const)('%s login stops polling and never adopts a late grant', async failure => {
  vi.useFakeTimers();
  const f = await fixture();
  try {
    if (failure === 'expired') f.http.deviceLifetime = 4;
    await f.login.start(OWNER, CLIENT_ID);
    if (failure === 'denied') f.http.deviceState = 'denied';
    if (failure === 'canceled') {
      expect(f.login.cancel('b'.repeat(64))).toBe(false);
      expect(f.login.cancel(OWNER)).toBe(true);
    }
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.login.status(OWNER)?.state).toBe(failure === 'denied' ? 'error' : failure);
    const count = f.http.calls.length;
    f.http.deviceState = 'authorized';
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.http.calls).toHaveLength(count);
    expect(await f.storage.store.read('tokens.json', null)).toBeNull();
    expect(f.auth.user).toBeUndefined();
  } finally { await f.clean(); }
});

test('invalid IDs can be corrected without restarting, and missing permissions do not save a token', async () => {
  vi.useFakeTimers();
  const f = await fixture();
  try {
    f.http.rejectDevice = true;
    await expect(f.login.start(OWNER, CLIENT_ID)).rejects.toMatchObject({ code: 'DEVICE_START_FAILED' });
    expect(f.auth.configured).toBe(false);
    expect(await f.storage.store.read('twitch-client.json', null)).toBeNull();
    f.http.rejectDevice = false;
    await f.login.start(OWNER, CLIENT_ID);
    f.http.deviceState = 'authorized';
    f.http.scopes = ['user:read:chat'];
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.login.status(OWNER)).toMatchObject({ state: 'error' });
    expect(await f.storage.store.read('tokens.json', null)).toBeNull();
    expect(f.auth.user).toBeUndefined();
  } finally { await f.clean(); }
});

test('public grants refresh through the real SDK without a client secret and restore on the next launch', async () => {
  vi.useFakeTimers();
  const f = await fixture();
  let restored: TwitchAuth | undefined;
  try {
    await f.login.start(OWNER, CLIENT_ID);
    f.http.deviceState = 'authorized';
    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() => expect(f.login.status(OWNER)?.state).toBe('connected'));
    expect(f.login.status(OWNER)?.state).toBe('connected');
    expect(f.auth.user?.name).toBe('host');
    const first = await f.storage.store.read<{ token: { accessToken: string; refreshToken: string } }>('tokens.json', {} as never);
    await f.auth.provider!.refreshAccessTokenForUser('100');
    await f.auth.validate();
    const refreshed = await f.storage.store.read<typeof first>('tokens.json', {} as never);
    expect(refreshed.token.accessToken).not.toBe(first.token.accessToken);
    expect(refreshed.token.refreshToken).not.toBe(first.token.refreshToken);
    const refresh = f.http.calls.find(call => call.url.searchParams.get('grant_type') === 'refresh_token');
    expect(refresh).toBeDefined();
    expect(refresh!.url.searchParams.get('client_secret')).toBeNull();
    expect(JSON.stringify(f.login.status(OWNER))).not.toMatch(/test-access|test-refresh|private-device-code/);
    f.auth.disconnect();
    const deviceRequests = f.http.calls.filter(call => call.url.pathname.endsWith('/device')).length;
    restored = new TwitchAuth({ clientId: CLIENT_ID, clientSecret: '', redirectUri: 'http://localhost:4181/auth/callback' }, f.storage.store);
    await restored.connect();
    expect(restored.user?.id).toBe('100');
    expect(f.http.calls.filter(call => call.url.pathname.endsWith('/device'))).toHaveLength(deviceRequests);
  } finally { restored?.disconnect(); await f.clean(); }
});

test('a stalled Twitch request cannot freeze local work or configure the app after shutdown', async () => {
  const f = await fixture();
  vi.stubGlobal('fetch', vi.fn((_url: unknown, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  })));
  try {
    const start = f.login.start(OWNER, CLIENT_ID);
    const rejected = expect(start).rejects.toMatchObject({ code: 'DEVICE_START_FAILED' });
    f.login.close();
    await rejected;
    expect(f.auth.configured).toBe(false);
    expect(await f.storage.store.read('tokens.json', null)).toBeNull();
  } finally { await f.clean(); }
});
