import { afterEach, expect, test, vi } from 'vitest';
import { type ChatMessage } from '@chaos/shared';
import { TwitchAuth, TWITCH_SCOPES } from '../../apps/server/src/twitch/auth';
import { LiveBridge } from '../../apps/server/src/twitch/live';
import { AUTH_SETTINGS, chatEvent, eventSocket, temporaryStore, twitchHttp, until } from './twitch-fixture';

afterEach(() => vi.unstubAllGlobals());

test.each(['', 'affiliate', 'partner'] as const)('a %s channel uses only chat-read authorization', async broadcasterType => {
  const fixture = await connected({ broadcasterType });
  try {
    expect(TWITCH_SCOPES).toEqual(['user:read:chat']);
    expect(fixture.http.subscriptions.map(subscription => subscription.type)).toEqual(['channel.chat.message']);
    expect(fixture.http.calls.some(call => call.url.pathname.endsWith('/predictions'))).toBe(false);
    expect(fixture.bridge.status()).not.toHaveProperty('canPredict');
    expect(JSON.stringify(fixture.bridge.status())).not.toMatch(/test-access|test-refresh|test-secret/);
  } finally { await fixture.clean(); }
});

async function connected(options: Parameters<typeof twitchHttp>[0] = {}) {
  const http = twitchHttp(options);
  const socket = await eventSocket(http.subscriptions);
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  const bridge = new LiveBridge(auth, socket.url);
  await bridge.connect();
  await auth.authorize('test-code');
  const subscriptions = 1;
  await until(() => http.subscriptions.length === subscriptions && bridge.status().connected);
  await new Promise(done => setTimeout(done, 20));
  return { http, socket, storage, auth, bridge, clean: async () => {
    bridge.disconnect();
    await socket.close();
    await storage.clean();
  } };
}

test('actual Twurple EventSub listener delivers !join, de-duplicates messages, reconnects and revokes safely', async () => {
  const fixture = await connected();
  const { bridge, socket, http } = fixture;
  const chats: ChatMessage[] = [];
  bridge.onChat = chat => chats.push(chat);
  try {
    expect(http.subscriptions.map(subscription => subscription.type).sort()).toEqual([
      'channel.chat.message'
    ]);
    const chat = chatEvent('!join blue');
    socket.notify('channel.chat.message', chat);
    await until(() => chats.length === 1);
    socket.notify('channel.chat.message', chat);
    await new Promise(done => setTimeout(done, 40));
    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({ userId: '200', login: 'viewer', displayName: 'Viewer', text: '!join blue' });
    socket.reconnect();
    await until(() => socket.connections >= 2);
    await new Promise(done => setTimeout(done, 50));
    socket.notify('channel.chat.message', chatEvent('!join'));
    await until(() => chats.length === 2);
    expect(bridge.status().connected).toBe(true);
    socket.revoke();
    await until(() => !bridge.status().connected);
    expect(bridge.status().connected).toBe(false);
    expect(bridge.status().lastError).toContain('revoked');
  } finally { await fixture.clean(); }
});

test('actual EventSub ignores ordinary chat and removed commands', async () => {
  const fixture = await connected();
  const messages: ChatMessage[] = [];
  fixture.bridge.onChat = message => messages.push(message);
  try {
    for (const text of ['hello', '!help', '!stats', '!vote 2', '!boost']) {
      fixture.socket.notify('channel.chat.message', chatEvent(text));
    }
    fixture.socket.notify('channel.chat.message', chatEvent('!join'));
    await until(() => messages.length === 1);
    expect(messages[0].text).toBe('!join');
  } finally { await fixture.clean(); }
});
