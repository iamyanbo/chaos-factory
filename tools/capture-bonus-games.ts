import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizeRecording } from './drama/capture-media';
import { assertEffectsOnly } from './video-audio';
import type { RoundResult } from '@chaos/shared';

const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:4180';
const available = ['pong-wars', 'light-cycles', 'ring-escape'];
const flag = process.argv.indexOf('--game');
const games = flag < 0 ? available : [process.argv[flag + 1]];
if (games.some(game => !available.includes(game))) throw new Error('Choose a supported optional game.');
const health = await (await fetch(`${base}/api/health`)).json();
if (health.mode !== 'mock') throw new Error('Optional-game capture requires an isolated mock server.');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const game of games) {
    const directory = resolve('qa/submission-video/optional-games', game);
    await mkdir(directory, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.addInitScript('globalThis.__name = fn => fn;');
    await page.routeWebSocket('**', socket => socket.close());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${base}/play?game=${game}&seed=1&bots=24&teams=4&record=1&paused=1`);
      await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.paused,
        undefined, { timeout: 60000 });
      await page.mouse.click(960, 540);
      await page.evaluate(() => window.__chaos.command('music', false));
      await page.waitForFunction(() => !window.__chaos.audio.musicEnabled && !window.__chaos.audio.playing);
      const download = page.waitForEvent('download', { timeout: 240000 });
      const capture = await page.evaluate(async () => {
        const api = window.__chaos;
        const stream = await api.captureStream(30);
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8_000_000
        });
        const chunks: Blob[] = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        const started = performance.now();
        let resultAt: number | undefined;
        const samples: { wall: number; game: number; fps: number; phase: string;
          musicEnabled: boolean; musicPlaying: boolean; details: unknown; alive: number }[] = [];
        recorder.start(1000);
        api.command('resume');
        await new Promise<void>((done, fail) => {
          recorder.onerror = event => fail(new Error(String(event)));
          recorder.onstop = () => done();
          const timer = setInterval(() => {
            const current = window.__chaos;
            const wall = (performance.now() - started) / 1000;
            const inspection = current.inspect();
            samples.push({ wall, game: inspection.time, fps: current.fps, phase: current.phase,
              musicEnabled: current.audio.musicEnabled, musicPlaying: Boolean(current.audio.playing),
              details: inspection.details,
              alive: inspection.marbles.filter(marble => marble.alive !== false).length });
            if (current.phase === 'RESULT') resultAt ??= wall;
            if (resultAt !== undefined && wall >= resultAt + 1 || wall > 210) {
              clearInterval(timer);
              recorder.stop();
            }
          }, 250);
        });
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        anchor.download = 'raw.webm';
        anchor.click();
        stream.getVideoTracks().forEach(track => track.stop());
        const current = window.__chaos;
        return { mode: 'mock', audioMode: 'sfx-only', normalSpeed: true, resultAt,
          selectedSeed: current.seed, bestTake: current.bestTake, samples,
          result: current.result as RoundResult | undefined, wallSeconds: (performance.now() - started) / 1000 };
      });
      await (await download).saveAs(resolve(directory, 'raw.webm'));
      const media = finalizeRecording(resolve(directory, 'raw.webm'), resolve(directory, 'game.webm'));
      assertEffectsOnly(capture);
      await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ game, ...capture, media, errors }, null, 2));
      if (errors.length || capture.resultAt === undefined || !capture.result
        || capture.result.winner.kind === 'void' || media.audioTracks !== 1) {
        throw new Error(`${game} capture did not complete cleanly; inspect its metadata.`);
      }
      console.log(`${game}: ${media.duration.toFixed(2)}s, selected seed ${capture.selectedSeed}, actual result retained`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
