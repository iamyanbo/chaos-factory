import { afterEach, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TEAMS, type ChatMessage, type Message, type Prediction } from '@chaos/shared';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { Predictions } from '../../apps/server/src/predictions';
import { TwitchAuth } from '../../apps/server/src/twitch/auth';
import { LiveBridge } from '../../apps/server/src/twitch/live';
import { AUTH_SETTINGS, DATE, chatEvent, eventSocket, rawPrediction, temporaryStore, twitchHttp, until } from './twitch-fixture';

afterEach(() => vi.unstubAllGlobals());

async function connected(options: Parameters<typeof twitchHttp>[0] = {}) {
  const http = twitchHttp(options);
  const socket = await eventSocket(http.subscriptions);
  const storage = await temporaryStore();
  const auth = new TwitchAuth(AUTH_SETTINGS, storage.store);
  const bridge = new LiveBridge(auth, socket.url);
  await bridge.connect();
  await auth.authorize('test-code');
  const subscriptions = options.broadcasterType === '' ? 1 : 5;
  await until(() => http.subscriptions.length === subscriptions && bridge.status().connected);
  await new Promise(done => setTimeout(done, 20));
  return { http, socket, storage, auth, bridge, clean: async () => {
    bridge.disconnect();
    await socket.close();
    await storage.clean();
  } };
}

test('a standard channel admits chat joins without making a native Prediction request', async () => {
  const fixture = await connected({ broadcasterType: '' });
  const chats: ChatMessage[] = [];
  fixture.bridge.onChat = chat => chats.push(chat);
  try {
    expect(fixture.bridge.status().canPredict).toBe(false);
    await expect(fixture.bridge.createPrediction('Who wins?', ['RED', 'BLUE'], 30))
      .rejects.toMatchObject({ code: 'NO_WAGERS' });
    expect(fixture.http.calls.some(call => call.url.pathname.endsWith('/predictions'))).toBe(false);
    fixture.socket.notify('channel.chat.message', chatEvent('!join'));
    await until(() => chats.length === 1);
    expect(chats[0].text).toBe('!join');
  } finally { await fixture.clean(); }
});

test('the SDK preserves all eight finalist outcomes and resolves the actual selected outcome ID', async () => {
  const fixture = await connected();
  try {
    const names = Array.from({ length: 8 }, (_, index) => `finalist_${index}`);
    const prediction = await fixture.bridge.createPrediction('Who takes the Cup?', names, 30);
    expect(prediction.outcomes.map(outcome => outcome.title)).toEqual(names);
    await fixture.bridge.lockPrediction();
    await fixture.bridge.resolvePrediction(7);
    expect(fixture.http.prediction?.status).toBe('RESOLVED');
    expect(fixture.http.prediction?.winning_outcome_id).toBe('outcome-7');
  } finally { await fixture.clean(); }
});

test('a naturally completed four-faction Pong round settles the correct native outcome through the SDK', async () => {
  await initPhysics();
  const fixture = await connected();
  const messages: Message[] = [];
  const operations: Promise<void>[] = [];
  let manager: Predictions | undefined;
  const director = new Director({
    send(message) {
      messages.push(message);
      if (manager && ['prediction.create', 'prediction.lock', 'prediction.resolve', 'prediction.cancel'].includes(message.type)) {
        operations.push(manager.handle(message));
      }
      return true;
    },
    context: (definition, setup, emit) => createContext(definition, setup, { emit }),
    announce() {}, toast() {}, feed() {}, reset() {}
  }, { fast: true, seed: 1 });
  const flush = async () => {
    for (let index = 0; index < operations.length; index++) await operations[index];
  };
  fixture.bridge.onChat = chat => director.receive(chat);
  fixture.bridge.onPrediction = prediction => director.receive({ type: 'prediction.update', ...prediction });
  manager = new Predictions(fixture.bridge, fixture.storage.store, message => {
    messages.push(message);
    director.receive(message);
  });
  try {
    await manager.recover();
    director.receive({ type: 'twitch.status', ...fixture.bridge.status() });
    for (const [index, team] of ['red', 'blue', 'mint', 'gold'].entries()) {
      fixture.socket.notify('channel.chat.message', { ...chatEvent(`!join ${team}`),
        chatter_user_id: String(200 + index), chatter_user_login: `viewer_${index}`,
        chatter_user_name: `Viewer ${index}` });
    }
    await until(() => director.participants.members.size === 4);
    director.command({ type: 'director.command', cmd: 'setRoundStart', arg: 'automatic' });
    director.command({ type: 'director.command', cmd: 'queue', arg: ['pong-wars'] });
    director.start(5);
    director.roundSeed = 1;
    director.preview(false);
    director.frame(1);
    await flush();
    expect(director.game.id).toBe('pong-wars');
    expect(director.format).toBe('faction');
    expect(fixture.http.prediction?.outcomes.map(outcome => outcome.title))
      .toEqual(director.participants.teams.map(team => TEAMS[team].name));
    expect(fixture.http.prediction?.outcomes).toHaveLength(4);
    director.frame(4);
    await flush();
    expect(fixture.http.prediction?.status).toBe('LOCKED');
    director.frame(.5);
    expect(director.phase).toBe('PLAY');
    for (let tick = 0; tick < 10000 && director.phase === 'PLAY'; tick++) director.step(1 / 60);
    await flush();
    const winner = director.result?.winner;
    expect(winner?.kind).toBe('team');
    if (winner?.kind !== 'team') throw new Error('The fixed fixture must complete with its actual team winner.');
    const index = director.predictionUsers.indexOf(winner.teamId);
    expect(fixture.http.prediction?.status).toBe('RESOLVED');
    expect(fixture.http.prediction?.winning_outcome_id).toBe(`outcome-${index}`);
    expect(director.cupShow.awards.filter(award => award.won)).toHaveLength(1);
    expect(director.cupShow.awards.find(award => award.won)?.points).toBe(5);
    expect(messages.some(message => message.type === 'prediction.error')).toBe(false);
  } finally {
    await manager.shutdown();
    director.destroy();
    await fixture.clean();
  }
});

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
