import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizeRecording } from './drama/capture-media';

const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:4182';
const outputIndex = process.argv.indexOf('--out');
const directory = resolve(outputIndex < 0 ? 'qa/rounds' : process.argv[outputIndex + 1]);
const sfxOnly = process.argv.includes('--sfx-only');
const health = await (await fetch(`${base}/api/health`)).json();
if (health.application !== 'chaos-factory' || health.mode !== 'mock') {
  throw new Error('Round capture requires an explicitly mock Chaos Factory server.');
}
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript('globalThis.__name = fn => fn;');
await page.routeWebSocket(url => url.pathname !== '/ws', socket => socket.close());
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.text().startsWith('ROUND ')) console.log(message.text()); });
try {
  await page.goto(`${base}/show?manual=1&seed=42`);
  await page.waitForFunction(() => window.__chaos?.phase === 'ATTRACT' && window.__chaos.connected);
  await page.evaluate(async () => {
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    await new Promise<void>((done, fail) => {
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'hello', role: 'dashboard' }));
        socket.send(JSON.stringify({ type: 'mock.swarm', viewers: 24, activity: .45, delayMs: [2500, 4500] }));
      };
      socket.onerror = () => fail(new Error('QA mock bridge unavailable'));
      socket.onmessage = event => {
        const message = JSON.parse(String(event.data));
        if (message.type === 'mock.status' && message.viewers === 24) { socket.close(); done(); }
      };
    });
  });
  await page.waitForTimeout(500);
  await page.mouse.click(960, 540);
  if (sfxOnly) {
    await page.evaluate(() => window.__chaos.command('music', false));
    await page.waitForFunction(() => !window.__chaos.audio.musicEnabled && !window.__chaos.audio.playing);
  }
  const download = page.waitForEvent('download', { timeout: 1_200_000 });
  const recording = await page.evaluate(async (sfxOnly) => {
    const stream = await window.__chaos.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8_000_000
    });
    const chunks: Blob[] = [];
    const transitions: { wall: number; phase: string; round: number; game: string;
      entrants: string[]; stage: number }[] = [];
    const samples: { wall: number; game: number; fps: number; musicEnabled: boolean; musicPlaying: boolean }[] = [];
    let previous = '';
    let nextSample = 0;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const start = performance.now();
    recorder.start(1000);
    window.__chaos.command('queue', ['multiplier-cascade', 'hot-potato', 'peg-fever', 'marble-race', 'blade-brawl']);
    window.__chaos.command('start');
    await new Promise<void>((done, fail) => {
      recorder.onerror = event => fail(new Error(String(event)));
      recorder.onstop = () => done();
      const timer = setInterval(() => {
        const current = window.__chaos;
        const wall = (performance.now() - start) / 1000;
        const show = current.show!;
        const key = `${show.round}:${current.phase}:${show.stageIndex}`;
        if (key !== previous) {
          previous = key;
          transitions.push({ wall, phase: current.phase, round: show.round, game: current.gameId,
            entrants: (current.participants as { userId: string }[]).map(user => user.userId),
            stage: show.stageIndex });
          console.log(`ROUND ${show.round} ${current.gameId} ${current.phase} stage ${show.stageIndex + 1} / ${wall.toFixed(1)}s`);
        }
        if (wall >= nextSample) {
          nextSample = wall + 1;
          samples.push({ wall, game: current.inspect().time, fps: current.fps,
            musicEnabled: current.audio.musicEnabled, musicPlaying: Boolean(current.audio.playing) });
        }
        if (current.phase === 'RESULT' && show.round >= 5 && show.phaseTime >= 6 || wall > 1100) {
          clearInterval(timer);
          recorder.stop();
        }
      }, 100);
    });
    const blob = new Blob(chunks, { type: recorder.mimeType });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'rounds-raw.webm';
    anchor.click();
    stream.getVideoTracks().forEach(track => track.stop());
    return { normalSpeed: 1, fast: false, audioMode: sfxOnly ? 'sfx-only' : 'mixed',
      wallSeconds: (performance.now() - start) / 1000,
      transitions, samples, results: window.__chaos.results, final: window.__chaos.show };
  }, sfxOnly);
  const raw = resolve(directory, 'rounds-raw.webm');
  await (await download).saveAs(raw);
  const media = finalizeRecording(raw, resolve(directory, 'rounds.webm'));
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ ...recording, media, errors }, null, 2));
  if (errors.length || recording.results.length !== 5
    || !media.audioTracks || sfxOnly && recording.samples.some(sample => sample.musicEnabled || sample.musicPlaying)) {
    throw new Error('Round capture validation failed; inspect capture.json');
  }
  console.log(JSON.stringify({ video: resolve(directory, 'rounds.webm'), duration: media.duration,
    rounds: recording.results.length, errors }, null, 2));
} finally {
  await browser.close();
}
