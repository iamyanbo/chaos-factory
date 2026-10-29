import { afterEach, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, Prediction } from '@chaos/shared';
import { TwitchAuth } from '../../apps/server/src/twitch/auth';
import { LiveBridge } from '../../apps/server/src/twitch/live';
import { AUTH_SETTINGS, DATE, chatEvent, eventSocket, rawPrediction, temporaryStore, twitchHttp, until } from './twitch-fixture';

afterEach(() => vi.unstubAllGlobals());

async function connected() {
  const http = twitchHttp();
  const socket = await eventSocket(http.subscriptions);
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  const bridge = new LiveBridge(auth, socket.url);
  await bridge.connect();
  await auth.authorize('test-code');
  await until(() => http.subscriptions.length === 5 && bridge.status().connected);
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
      'channel.chat.message', 'channel.prediction.begin', 'channel.prediction.end',
      'channel.prediction.lock', 'channel.prediction.progress'
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
    expect(bridge.status().canPredict).toBe(true);
    socket.revoke();
    await until(() => !bridge.status().connected);
    expect(bridge.status().canPredict).toBe(false);
    expect(bridge.status().lastError).toContain('revoked');
  } finally { await fixture.clean(); }
});

test('actual Helix SDK creates/locks/resolves/cancels with outcome IDs and preserves manual predictions', async () => {
  const fixture = await connected();
  const { bridge, http } = fixture;
  try {
    const prediction = await bridge.createPrediction('Who wins?', ['RED', 'BLUE'], 30);
    expect(prediction.outcomes.map(outcome => outcome.id)).toEqual(['outcome-0', 'outcome-1']);
    http.prediction!.status = 'LOCKED'; // Twitch auto-lock beat our own lock request.
    const patches = () => http.calls.filter(call => call.method === 'PATCH');
    await bridge.lockPrediction();
    expect(patches()).toHaveLength(0);
    await bridge.resolvePrediction(1);
    expect(patches().at(-1)?.body).toMatchObject({ status: 'RESOLVED', winning_outcome_id: 'outcome-1' });
    await bridge.createPrediction('Again?', ['RED', 'BLUE'], 30);
    await bridge.lockPrediction();
    await bridge.cancelPrediction('Void round');
    expect(patches().at(-1)?.body).toMatchObject({ status: 'CANCELED' });
    http.prediction = rawPrediction('ACTIVE', 'manual-prediction');
    const before = patches().length;
    await expect(bridge.createPrediction('Blocked?', ['RED', 'BLUE'], 30)).rejects.toMatchObject({ code: 'ALREADY_ACTIVE' });
    await bridge.cancelPrediction('No ownership of manual prediction');
    expect(patches()).toHaveLength(before);
    expect(http.prediction.status).toBe('ACTIVE');
    const publicStatus = JSON.stringify(bridge.status());
    expect(publicStatus).not.toContain(AUTH_SETTINGS.clientSecret);
    expect(publicStatus).not.toContain('test-access');
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

test('EventSub progress, lock and result map pools and top predictors without claiming every bettor', async () => {
  const fixture = await connected();
  const { socket, bridge } = fixture;
  const updates: Prediction[] = [];
  bridge.onPrediction = prediction => updates.push(prediction);
  const prediction = rawPrediction();
  const event = { id: prediction.id, broadcaster_user_id: '100', broadcaster_user_login: 'host',
    broadcaster_user_name: 'Host', title: 'Who wins?', started_at: DATE, locks_at: DATE,
    outcomes: prediction.outcomes };
  try {
    socket.notify('channel.prediction.begin', event);
    socket.notify('channel.prediction.progress', event);
    socket.notify('channel.prediction.lock', { ...event, locked_at: DATE });
    socket.notify('channel.prediction.end', { ...event, status: 'resolved', ended_at: DATE,
      winning_outcome_id: 'outcome-0' }, randomUUID());
    await until(() => updates.length === 4);
    expect(updates.map(update => update.status)).toEqual(['ACTIVE', 'ACTIVE', 'LOCKED', 'RESOLVED']);
    expect(updates[1].outcomes[0]).toMatchObject({ users: 2, points: 100,
      top: [{ userId: 'viewer-0', login: 'viewer_0', points: 100 }] });
    expect(updates[3].winnerIndex).toBe(0);
  } finally { await fixture.clean(); }
});
