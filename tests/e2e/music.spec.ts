import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('licensed music reaches the capture mix; its toggle keeps effects independent and remembers mute', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play?game=multiplier-cascade&seed=2&take=seed');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY');
  await page.locator('#practice-sound').uncheck();
  const music = page.locator('.music-toggle');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() => window.__chaos.audio.playing && window.__chaos.audio.track === 'factory');

  const signal = async () => page.evaluate(async () => {
    const stream = await window.__chaos.captureStream(1);
    const ctx = new AudioContext();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let peak = 0;
    for (let sample = 0; sample < 20; sample++) {
      await new Promise(resolve => setTimeout(resolve, 30));
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length));
    }
    source.disconnect();
    for (const track of stream.getVideoTracks()) track.stop();
    await ctx.close();
    return peak;
  });
  expect(await signal()).toBeGreaterThan(.0001);
  await music.click();
  await page.waitForFunction(() => !window.__chaos.audio.playing);
  expect(await signal()).toBeLessThan(.00001);
  await page.locator('#practice-sound').check();
  await expect(music).toHaveAttribute('aria-label', 'Enable music');
  expect(await page.evaluate(() => window.__chaos.audio)).toMatchObject({ musicEnabled: false, sfxEnabled: true, master: .5 });
  await mkdir('qa/checks', { recursive: true });
  await page.screenshot({ path: 'qa/checks/music-controls.png' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__chaos));
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__chaos.audio.musicEnabled)).toBe(false);
  await music.click();
  await page.waitForFunction(() => window.__chaos.audio.playing);
  expect(errors).toEqual([]);
});

test('dashboard music icon controls a show in a different browser context through the bridge', async ({ browser, baseURL }) => {
  const showContext = await browser.newContext();
  const dashboardContext = await browser.newContext();
  try {
    const show = await showContext.newPage();
    const dashboard = await dashboardContext.newPage();
    await show.goto(`${baseURL}/show?manual=1`);
    await show.waitForFunction(() => window.__chaos?.connected && window.__chaos.audio.playing);
    await dashboard.goto(`${baseURL}/dashboard`);
    await expect(dashboard.locator('#connection')).toHaveText('● Bridge connected');
    const music = dashboard.locator('.music-toggle');
    await expect(music).toHaveAttribute('aria-pressed', 'true');
    await music.click();
    await show.waitForFunction(() => !window.__chaos.audio.musicEnabled && !window.__chaos.audio.playing);
    await expect(show.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'false');
    await music.click();
    await show.waitForFunction(() => window.__chaos.audio.musicEnabled && window.__chaos.audio.playing);
    expect(await show.evaluate(() => window.__chaos.audio.master)).toBe(.5);
  } finally {
    await showContext.close();
    await dashboardContext.close();
  }
});

test('the first music click resumes a suspended audio context', async ({ page }) => {
  test.setTimeout(30000);
  // Headless Chrome permits autoplay. Keep real audio contexts suspended until
  // an actual user gesture, exercising the same resume path as a blocked browser.
  await page.addInitScript(() => {
    let allowResume = false;
    addEventListener('pointerdown', event => { allowResume ||= event.isTrusted; }, { capture: true });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        void this.suspend();
      }
      override resume(): Promise<void> {
        return allowResume ? super.resume() : Promise.resolve();
      }
    };
  });
  await page.goto('/play?game=multiplier-cascade&take=seed');
  await page.waitForFunction(() => window.__chaos?.audio.blocked);
  await page.locator('.music-toggle').click();
  await page.waitForFunction(() => window.__chaos.audio.playing && !window.__chaos.audio.blocked);
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('missing audio files fall back without stalling the round', async ({ page }) => {
  await page.route('**/music/*', route => route.fulfill({ status: 404, body: 'Missing' }));
  await page.goto('/play?game=multiplier-cascade&take=seed');
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.audio.state === 'failed');
  const start = await page.evaluate(() => window.__chaos.inspect().time);
  await page.waitForFunction(time => window.__chaos.inspect().time > time + 2, start);
  expect(await page.evaluate(() => window.__chaos.phase)).toBe('PLAY');
});
