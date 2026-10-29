import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizeRecording } from './drama/capture-media';

const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:4182';
const outputIndex = process.argv.indexOf('--out');
const directory = resolve(outputIndex < 0 ? 'qa/cup' : process.argv[outputIndex + 1]);
const sfxOnly = process.argv.includes('--sfx-only');
const health = await (await fetch(`${base}/api/health`)).json();
if (health.application !== 'chaos-factory' || health.mode !== 'mock') {
  throw new Error('Cup capture requires an explicitly mock Chaos Factory server.');
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
page.on('console', message => { if (message.text().startsWith('CUP ')) console.log(message.text()); });
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
      entrants: string[]; qualified: string[]; stage: number }[] = [];
    const samples: { wall: number; game: number; fps: number; musicEnabled: boolean; musicPlaying: boolean }[] = [];
    let previous = '';
    let nextSample = 0;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const start = performance.now();
    recorder.start(1000);
    window.__chaos.command('queue', ['multiplier-cascade', 'hot-potato', 'peg-fever', 'marble-race']);
    window.__chaos.command('start', 5);
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
            qualified: [...show.qualified], stage: show.stageIndex });
          console.log(`CUP ${show.round}/5 ${current.gameId} ${current.phase} stage ${show.stageIndex + 1} / ${wall.toFixed(1)}s`);
        }
        if (wall >= nextSample) {
          nextSample = wall + 1;
          samples.push({ wall, game: current.inspect().time, fps: current.fps,
            musicEnabled: current.audio.musicEnabled, musicPlaying: Boolean(current.audio.playing) });
        }
        if (current.phase === 'CUP_RESULTS' && show.phaseTime >= 6 || wall > 1100) {
          clearInterval(timer);
          recorder.stop();
        }
      }, 100);
    });
    const blob = new Blob(chunks, { type: recorder.mimeType });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'full-cup-raw.webm';
    anchor.click();
    stream.getVideoTracks().forEach(track => track.stop());
    return { normalSpeed: 1, fast: false, audioMode: sfxOnly ? 'sfx-only' : 'mixed',
      wallSeconds: (performance.now() - start) / 1000,
      transitions, samples, results: window.__chaos.results, final: window.__chaos.show };
  }, sfxOnly);
  const raw = resolve(directory, 'full-cup-raw.webm');
  await (await download).saveAs(raw);
  const media = finalizeRecording(raw, resolve(directory, 'full-cup.webm'));
  const profiles = await (await page.request.get(`${base}/api/profiles`)).json();
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ ...recording, media, profiles, errors }, null, 2));
  const standings = recording.transitions.filter(row => row.phase === 'STANDINGS');
  const final = recording.transitions.find(row => row.round === 5 && row.phase === 'PLAY');
  if (errors.length || recording.results.length !== 5 || standings.length !== 4
    || !final || final.game !== 'blade-brawl' || final.entrants.length > 8
    || final.entrants.some(id => !final.qualified.includes(id)) || !recording.final?.championId
    || !media.audioTracks || sfxOnly && recording.samples.some(sample => sample.musicEnabled || sample.musicPlaying)) {
    throw new Error('Cup capture validation failed; inspect the capture.json in the output directory');
  }
  console.log(JSON.stringify({ video: resolve(directory, 'full-cup.webm'), duration: media.duration,
    rounds: recording.results.length, standings: standings.length, champion: recording.final.championId, errors }, null, 2));
} finally {
  await browser.close();
}
