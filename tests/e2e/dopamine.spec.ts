import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Message, Participant, RoundResult, ViewerProfile } from '@chaos/shared';

const GAMES = ['hot-potato', 'peg-fever', 'light-cycles', 'pong-wars', 'blade-brawl'];
const ARTIFACTS = 'qa/dopamine-browser-artifacts';
const REPORT = 'qa/dopamine-browser-cup.json';
const FIELD_SIZE = 24;
const MOCK_BETTORS = 64;
const DATA_DIRECTORY = process.env.DOPAMINE_CUP_DATA_DIR;
type Profiles = Extract<Message, { type: 'profiles.snapshot' }>;
interface Packet { direction: 'sent' | 'received'; at: number; message: Message }
interface StoredProfiles { users: Record<string, ViewerProfile>; crownUserId?: string; processed: string[] }

test.use({ video: 'off', trace: 'off', launchOptions: {
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required',
    '--js-flags=--wasm-num-compilation-tasks=1 --max-old-space-size=512 --max-semi-space-size=4']
} });

test('doc 22 production Cup runs the new games, real standings, top-eight final and mock predictions',
  async ({ page, request }) => {
    test.setTimeout(240000);
    test.skip(!DATA_DIRECTORY, 'Run only against the explicitly isolated doc 22 mock server.');
    expect(resolve(DATA_DIRECTORY!)).toBe(resolve('qa/cup-doc22-data'));
    const health = await (await request.get('/api/health')).json();
    expect(health.mode).toBe('mock');
    expect(health.liveTwitch).toBe(false);
    expect(await (await request.get('/show')).text()).not.toContain('/@vite/client');
    const before = await (await request.get('/api/profiles')).json() as Profiles;
    const started = Date.now();
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    const packets: Packet[] = [];
    const sockets: string[] = [];
    const relevant = new Set(['director.state', 'round.record', 'prediction.create', 'prediction.lock',
      'prediction.resolve', 'prediction.cancel', 'prediction.update', 'prediction.error', 'mock.status']);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('websocket', socket => {
      sockets.push(socket.url());
      const record = (direction: Packet['direction'], frame: { payload: string | Buffer }) => {
        try {
          const message = JSON.parse(String(frame.payload)) as Message;
          if (relevant.has(message.type)) packets.push({ direction, at: (Date.now() - started) / 1000, message });
        } catch { /* Non-JSON frames are outside the app protocol. */ }
      };
      socket.on('framesent', frame => record('sent', frame));
      socket.on('framereceived', frame => record('received', frame));
    });
    await mkdir(ARTIFACTS, { recursive: true });
    await page.addInitScript('globalThis.__name = fn => fn;');
    await page.goto('/show?manual=1&fast=1&seed=42&mute=1');
    await page.waitForFunction(() => window.__chaos?.phase === 'ATTRACT' && window.__chaos.connected);
    await page.evaluate(async ({ games, field, bettors }) => {
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
      await new Promise<void>((done, fail) => {
        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'hello', role: 'dashboard' }));
          socket.send(JSON.stringify({ type: 'mock.swarm', viewers: bettors, activity: 1,
            delayMs: [2500, 4500], personalities: { spammer: 1 } }));
        };
        socket.onerror = () => fail(new Error('The isolated mock bridge is unavailable'));
        socket.onmessage = event => {
          const message = JSON.parse(String(event.data));
          if (message.type === 'mock.status' && message.viewers === bettors && message.activity === 1) {
            socket.close();
            done();
          }
        };
      });
      window.__chaos.command('setCapacity', Object.fromEntries(games.map(game => [game, field])));
      window.__chaos.command('betWindow', 60);
      window.__chaos.command('queue', games.slice(0, 4));
      window.__chaos.command('start', 5);
    }, { games: GAMES, field: FIELD_SIZE, bettors: MOCK_BETTORS });

    const rounds = [];
    const standingsScreens = [];
    for (let round = 1; round <= 4; round++) {
      await page.waitForFunction(expected => window.__chaos.phase === 'STANDINGS'
        && window.__chaos.show?.round === expected && window.__chaos.show.phaseTime >= 2,
      round, { timeout: 90000 });
      await page.evaluate(() => window.__chaos.command('pause'));
      await page.waitForFunction(() => window.__chaos.paused);
      const snapshot = await page.evaluate(() => ({ game: window.__chaos.gameId,
        show: window.__chaos.show!, result: window.__chaos.result as RoundResult,
        inspection: window.__chaos.inspect(), fps: window.__chaos.fps }));
      expect(snapshot.game).toBe(GAMES[round - 1]);
      expect(snapshot.result.winner.kind).not.toBe('void');
      expect(snapshot.result.replay.setup!.participants).toHaveLength(FIELD_SIZE);
      expect(snapshot.show.standings.length).toBeGreaterThanOrEqual(8);
      expect(snapshot.show.standings.every(row => row.points >= 0 && row.level >= 1)).toBe(true);
      expect(snapshot.show.stages).toHaveLength(3);
      expect(snapshot.show.stageIndex).toBeGreaterThanOrEqual(0);
      expect(snapshot.show.stageIndex).toBeLessThanOrEqual(2);
      expect(snapshot.show.stages.slice(0, snapshot.show.stageIndex + 1)
        .every(stage => Number.isFinite(stage.startedAt))).toBe(true);
      const screenshot = `${ARTIFACTS}/standings-${round}.png`;
      await page.screenshot({ path: screenshot });
      standingsScreens.push(screenshot);
      rounds.push(snapshot);
      await page.evaluate(() => window.__chaos.command('resume'));
    }

    await page.waitForFunction(() => window.__chaos.show?.grandFinal && window.__chaos.phase === 'INTRO');
    await page.evaluate(() => window.__chaos.command('pause'));
    const finalists = await page.evaluate(() => ({ game: window.__chaos.gameId,
      qualified: window.__chaos.show!.qualified, participants: window.__chaos.participants as Participant[] }));
    expect(finalists.game).toBe('blade-brawl');
    expect(finalists.qualified).toHaveLength(8);
    expect(finalists.qualified).toEqual(rounds[3].show.standings.slice(0, 8).map(row => row.userId));
    expect(finalists.participants.map(player => player.userId)).toEqual(finalists.qualified);
    await page.screenshot({ path: `${ARTIFACTS}/grand-final.png` });
    await page.evaluate(() => window.__chaos.command('resume'));
    await page.waitForFunction(() => window.__chaos.phase === 'CUP_RESULTS', undefined, { timeout: 90000 });
    await page.evaluate(() => window.__chaos.command('pause'));
    const cup = await page.evaluate(() => ({ results: window.__chaos.results as RoundResult[],
      show: window.__chaos.show!, inspection: window.__chaos.inspect(),
      predictions: window.__chaos.predictions, replay: window.__chaos.instantReplay }));
    expect(cup.results.map(result => result.replay.setup!.gameId)).toEqual(GAMES);
    expect(cup.results.map(result => result.replay.setup!.format)).toEqual(['boss', 'faction', 'ffa', 'faction', 'ffa']);
    expect(cup.results.every(result => result.winner.kind !== 'void')).toBe(true);
    const final = cup.results[4];
    const champion = final.champion!;
    expect(champion.userId).toBeTruthy();
    expect(final.replay.setup!.participants.map(player => player.userId)).toEqual(finalists.qualified);
    expect(cup.inspection.marbles.filter(actor => actor.alive).map(actor => actor.id)).toEqual([champion.userId]);
    expect(cup.show.championId).toBe(champion.userId);
    expect(cup.replay).toEqual({ frames: 0, bytes: 0, playing: false, failures: 0 });
    await page.screenshot({ path: `${ARTIFACTS}/champion.png` });
    await writeFile(REPORT, JSON.stringify({ capturedAt: new Date().toISOString(),
      fastMode: true, videoRecorded: false, rounds, finalists, cup, errors, consoleErrors, packets }, null, 2));

    await expect.poll(async () => (await (await request.get('/api/profiles')).json()).crownUserId)
      .toBe(champion.userId);
    const profiles = await (await request.get('/api/profiles')).json() as Profiles;
    expect(profiles.users[champion.userId].cupsWon).toBe((before.users[champion.userId]?.cupsWon ?? 0) + 1);
    expect(profiles.users[champion.userId].title).toBe('Cup Champion');
    expect(profiles.users[champion.userId].xp).toBeGreaterThan(before.users[champion.userId]?.xp ?? 0);
    const storedPath = resolve(DATA_DIRECTORY!, 'profiles.json');
    await expect.poll(async () => {
      try { return (JSON.parse(await readFile(storedPath, 'utf8')) as StoredProfiles).crownUserId; }
      catch { return undefined; }
    }).toBe(champion.userId);
    const stored = JSON.parse(await readFile(storedPath, 'utf8')) as StoredProfiles;
    expect(stored.users[champion.userId]).toEqual(profiles.users[champion.userId]);
    for (const result of cup.results) for (const player of result.replay.setup!.participants) {
      expect(stored.users[player.userId].color).toBe(player.color);
    }

    const creates = packets.filter(packet => packet.direction === 'sent' && packet.message.type === 'prediction.create');
    expect(creates).toHaveLength(4);
    const lifecycles = creates.map(packet => {
      const create = packet.message as Extract<Message, { type: 'prediction.create' }>;
      const lock = packets.find(entry => entry.direction === 'sent' && entry.message.type === 'prediction.lock'
        && entry.message.roundId === create.roundId);
      const resolution = packets.find(entry => entry.direction === 'sent' && entry.message.type === 'prediction.resolve'
        && entry.message.roundId === create.roundId);
      const nextCreate = creates.find(entry => entry.at > packet.at);
      const active = packets.find(entry => entry.direction === 'received' && entry.at >= packet.at
        && entry.at < (nextCreate?.at ?? Infinity) && entry.message.type === 'prediction.update'
        && entry.message.status === 'ACTIVE')?.message as Extract<Message, { type: 'prediction.update' }> | undefined;
      const updates = packets.filter(entry => entry.direction === 'received' && entry.message.type === 'prediction.update'
        && entry.message.id === active?.id).map(entry => entry.message as Extract<Message, { type: 'prediction.update' }>);
      expect(lock).toBeTruthy();
      expect(resolution).toBeTruthy();
      expect(updates.some(update => update.status === 'ACTIVE')).toBe(true);
      expect(updates.some(update => update.status === 'LOCKED')).toBe(true);
      expect(updates.some(update => update.status === 'RESOLVED')).toBe(true);
      expect(updates.at(-1)!.outcomes.some(outcome => outcome.users > 0)).toBe(true);
      return { roundId: create.roundId, id: active!.id, title: create.title,
        statuses: [...new Set(updates.map(update => update.status))], resolved: updates.at(-1) };
    });
    expect(packets.filter(packet => packet.message.type === 'prediction.error')).toEqual([]);
    const records = packets.filter(packet => packet.direction === 'sent' && packet.message.type === 'round.record')
      .map(packet => packet.message as Extract<Message, { type: 'round.record' }>);
    expect(records.map(record => record.gameId)).toEqual(GAMES);
    expect(records.every(record => stored.processed.includes(record.roundId!))).toBe(true);

    // Hot Potato admits all 64 mock identities, so a returning finalist cannot be outside its field.
    await page.goto('/show?manual=1&seed=43&game=hot-potato&mute=1');
    await page.waitForFunction(expected => window.__chaos?.phase === 'ATTRACT' && window.__chaos.connected
      && window.__chaos.show?.crownName === expected, champion.displayName);
    const returning = await page.evaluate(() => (window.__chaos.participants as Participant[]).find(player => player.crowned));
    expect(returning?.userId).toBe(champion.userId);
    await page.screenshot({ path: `${ARTIFACTS}/persisted-crown.png` });
    expect(sockets.every(url => new URL(url).pathname === '/ws')).toBe(true);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await writeFile(REPORT, JSON.stringify({ capturedAt: new Date().toISOString(),
      baseURL: test.info().project.use.baseURL, fastMode: true, videoRecorded: false,
      dataDirectory: DATA_DIRECTORY, fieldSize: FIELD_SIZE, mockBettors: MOCK_BETTORS,
      delayMs: [2500, 4500], rounds, standingsScreens, finalists, cup, lifecycles,
      profiles, returning, errors, consoleErrors, packets }, null, 2));
  });
