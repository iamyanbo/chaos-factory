import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizeRecording } from './drama/capture-media';

const base = 'http://localhost:4181';
const directory = resolve('qa/submission-video/live-join');
const WAIT_LIMIT_SECONDS = 900;
const status = await (await fetch(`${base}/api/twitch/status`)).json();
if (!status.authenticated || !status.connected || status.mode !== 'live') {
  throw new Error('An authenticated live Twitch chat connection is required.');
}
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript('globalThis.__name = fn => fn;');
try {
  await page.goto(`${base}/show?manual=1`);
  await page.waitForFunction(() => window.__chaos?.connected);
  await page.evaluate(() => {
    window.__chaos.command('queue', ['peg-fever']);
    window.__chaos.command('start', 5);
  });
  await page.waitForFunction(() => window.__chaos.phase === 'LOBBY_BET');
  await page.mouse.click(960, 540);
  const download = page.waitForEvent('download', { timeout: (WAIT_LIMIT_SECONDS + 60) * 1000 });
  console.log('LIVE READY: waiting for a real !join.');
  const recording = await page.evaluate(async (waitLimit) => {
    const stream = await window.__chaos.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8_000_000
    });
    const chunks: Blob[] = [];
    const initialIds = new Set((window.__chaos.participants as { userId: string }[]).map(user => user.userId));
    const start = performance.now();
    let joinedAt: number | undefined;
    let startedAt: number | undefined;
    let member: unknown;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start(1000);
    await new Promise<void>((done, fail) => {
      recorder.onstop = () => done();
      recorder.onerror = event => fail(new Error(String(event)));
      const timer = setInterval(() => {
        const current = window.__chaos;
        const wall = (performance.now() - start) / 1000;
        const entrant = (current.participants as { userId: string; displayName: string }[])
          .find(user => !initialIds.has(user.userId));
        if (entrant && joinedAt === undefined) { joinedAt = wall; member = entrant; }
        if (joinedAt !== undefined && startedAt === undefined && wall >= joinedAt + 3) {
          current.command('startRound');
          startedAt = wall;
        }
        if (startedAt !== undefined && wall >= startedAt + 26 || wall > waitLimit) {
          clearInterval(timer);
          recorder.stop();
        }
      }, 100);
    });
    const blob = new Blob(chunks, { type: recorder.mimeType });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'live-join-raw.webm';
    anchor.click();
    stream.getVideoTracks().forEach(track => track.stop());
    return { wallSeconds: (performance.now() - start) / 1000,
      joinedAt, startedAt, member, predictions: window.__chaos.predictions,
      phase: window.__chaos.phase, game: window.__chaos.gameId };
  }, WAIT_LIMIT_SECONDS);
  const raw = resolve(directory, 'raw.webm');
  await (await download).saveAs(raw);
  const media = finalizeRecording(raw, resolve(directory, 'live-join.webm'));
  const after = await (await fetch(`${base}/api/twitch/status`)).json();
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ mode: 'live',
    channel: status.channel, broadcasterType: status.broadcasterType,
    eventSubConnected: after.eventSubConnected, lastJoinAt: after.lastJoinAt,
    noWagers: !after.canPredict,
    ...recording, media, errors }, null, 2));
  if (recording.joinedAt === undefined || errors.length) throw new Error('Real join was not observed.');
  console.log('Live Twitch join capture saved. No chat or prediction was simulated.');
} finally { await browser.close(); }
