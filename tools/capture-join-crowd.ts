import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizeRecording } from './drama/capture-media';

const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:4182';
const directory = resolve('qa/submission-video/join-crowd');
const VIEWERS = 48;
const health = await (await fetch(`${base}/api/health`)).json();
if (health.mode !== 'mock') throw new Error('Crowd demonstration requires the mock server.');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript('globalThis.__name = fn => fn;');
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/show?manual=1&seed=82&take=seed`);
  await page.waitForFunction(() => window.__chaos?.connected);
  await page.evaluate(async () => {
    const socket = new WebSocket(`ws://${location.host}/ws`);
    await new Promise<void>(done => {
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'hello', role: 'dashboard' }));
        socket.send(JSON.stringify({ type: 'mock.swarm', viewers: 0, activity: 1, delayMs: [2000, 5000] }));
      };
      socket.onmessage = event => {
        const message = JSON.parse(String(event.data));
        if (message.type === 'mock.status' && message.viewers === 0) { socket.close(); done(); }
      };
    });
    window.__chaos.command('music', false);
    window.__chaos.command('toggleWagers', false);
    window.__chaos.command('setRoundStart', 'automatic');
    window.__chaos.command('setCapacity', { 'peg-fever': 48 });
    window.__chaos.command('queue', ['peg-fever']);
    window.__chaos.command('start');
  });
  await page.waitForFunction(() => window.__chaos.phase === 'LOBBY_BET');
  await page.mouse.click(960, 540);
  const download = page.waitForEvent('download', { timeout: 120_000 });
  const capture = await page.evaluate(async viewers => {
    const stream = await window.__chaos.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    const samples: { wall: number; count: number; phase: string;
      musicEnabled: boolean; musicPlaying: boolean }[] = [];
    const joins: { wall: number; name: string; color: string }[] = [];
    const known = new Set<string>();
    const start = performance.now();
    let startedAt: number | undefined;
    let playAt: number | undefined;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start(100);
    const socket = new WebSocket(`ws://${location.host}/ws`);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'hello', role: 'dashboard' }));
      socket.send(JSON.stringify({ type: 'mock.swarm', viewers, activity: 1,
        delayMs: [2000, 5000], personalities: { spammer: 1 } }));
    };
    await new Promise<void>((done, fail) => {
      recorder.onstop = () => done();
      const timer = setInterval(() => {
        const state = window.__chaos;
        const wall = (performance.now() - start) / 1000;
        const members = state.participants as { userId: string; displayName: string; color: string }[];
        for (const member of members) if (!known.has(member.userId)) {
          known.add(member.userId);
          joins.push({ wall, name: member.displayName, color: member.color });
        }
        samples.push({ wall, count: members.length, phase: state.phase,
          musicEnabled: state.audio.musicEnabled, musicPlaying: Boolean(state.audio.playing) });
        if (state.phase === 'LOCK_COUNTDOWN' && startedAt === undefined) {
          startedAt = wall;
        }
        if (state.phase === 'PLAY' && playAt === undefined) playAt = wall;
        if (playAt !== undefined && wall > playAt + 7) { clearInterval(timer); recorder.stop(); }
        if (wall > 60) { clearInterval(timer); recorder.stop(); fail(new Error('Crowd did not fill/start.')); }
      }, 100);
    });
    socket.close();
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
    anchor.download = 'crowd-raw.webm';
    anchor.click();
    stream.getVideoTracks().forEach(track => track.stop());
    return { mode: 'mock', audioMode: 'sfx-only', viewers, startedAt, playAt, samples, joins };
  }, VIEWERS);
  await (await download).saveAs(resolve(directory, 'raw.webm'));
  const media = finalizeRecording(resolve(directory, 'raw.webm'), resolve(directory, 'crowd.webm'));
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ ...capture, media, errors }, null, 2));
  if (errors.length || capture.joins.length !== VIEWERS) throw new Error('Inspect crowd capture.json.');
  console.log(JSON.stringify({ directory, viewers: capture.joins.length, playAt: capture.playAt, errors }));
} finally { await browser.close(); }
