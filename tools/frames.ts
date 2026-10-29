import { chromium } from '@playwright/test';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command } from './drama/capture-media';

const args = process.argv.slice(2);
function option(key: string, fallback: string): string {
  const index = args.indexOf(`--${key}`);
  return index < 0 ? fallback : args[index + 1];
}
const game = option('game', 'ring-escape');
const seed = Number(option('seed', '1'));
if (!/^[a-z][a-z0-9-]*$/.test(game) || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
  throw new Error('Use --game <id> --seed <unsigned integer>');
}
const label = option('label', '');
const when = option('when', '');
const phase = option('phase', 'PLAY');
if (!['PLAY', 'RESULT'].includes(phase)) throw new Error('Capture phase must be PLAY or RESULT');
const from = Number(option('from', '0'));
if (phase === 'RESULT' && (when || from)) throw new Error('Capture RESULT without --when or --from');
if (label && !/^[a-z][a-z0-9-]*$/.test(label) || when && !/^[a-z][a-z0-9-]*$/.test(when)
  || !Number.isFinite(from) || from < 0 || from > 300) throw new Error('Invalid capture label, phase or start time');
const directory = resolve('qa/frames', game, label);
await mkdir(directory, { recursive: true });
const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required',
    '--js-flags=--wasm-num-compilation-tasks=1 --max-old-space-size=512 --max-semi-space-size=4']
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.addInitScript('globalThis.__name = fn => fn;');
await page.routeWebSocket('**', socket => socket.close());
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const url = new URL('/play', base);
  for (const [key, value] of Object.entries({ game, seed: String(seed), record: '1', paused: '1' })) {
    url.searchParams.set(key, value);
  }
  for (const key of ['format', 'bots', 'teams', 'ball']) {
    const value = option(key, '');
    if (value) url.searchParams.set(key, value);
  }
  if (args.includes('--exact')) url.searchParams.set('take', 'seed');
  await page.goto(url.href);
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.paused,
    undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.mouse.click(960, 540);
  await page.evaluate(() => window.__chaos.command('resume'));
  if (phase === 'RESULT') await page.waitForFunction(() => window.__chaos.phase === 'RESULT',
    undefined, { timeout: 300000 });
  if (when) await page.waitForFunction(phase => window.__chaos.inspect().details?.phase === phase,
    when, { timeout: 300000 });
  if (from) await page.waitForFunction(time => window.__chaos.inspect().time >= time,
    from, { timeout: 300000 });
  const started = Date.now();
  const observations = [];
  for (let seconds = 0; seconds <= 18; seconds += 2) {
    await page.waitForTimeout(Math.max(0, seconds * 1000 - (Date.now() - started)));
    const state = await page.evaluate(() => ({ time: window.__chaos.inspect().time,
      zoom: window.__chaos.cameraZoom, fps: window.__chaos.fps, phase: window.__chaos.phase }));
    const name = `frame-${String(seconds).padStart(2, '0')}.png`;
    await page.screenshot({ path: resolve(directory, name) });
    observations.push({ timestamp: seconds, wall: (Date.now() - started) / 1000, ...state });
    if ([2, 6, 12].includes(seconds)) await copyFile(resolve(directory, name),
      resolve(directory, `still-${String(seconds).padStart(2, '0')}s.png`));
  }
  const setup = await page.evaluate(() => ({ selectedSeed: window.__chaos.seed,
    ballStyle: window.__chaos.ballStyle,
    bestTake: window.__chaos.bestTake, participants: window.__chaos.participants.length,
    physicsVersion: window.__chaos.physicsVersion }));
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({
    game, requestedSeed: seed, base, label, when, phase, from, kind: 'stills', videoRecorded: false,
    normalSpeed: true, ...setup, observations, errors
  }, null, 2));
  command('python', ['tools/frame-sheet.py', directory]);
  console.log(JSON.stringify({ directory, selectedSeed: setup.selectedSeed,
    stills: [2, 6, 12], sheet: 'sheet.png', videoRecorded: false, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
