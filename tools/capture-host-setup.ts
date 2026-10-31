import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VideoPointer } from './video-pointer';
import { finalizeRecording } from './drama/capture-media';

const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:4181';
const outputFlag = process.argv.indexOf('--out');
const directory = resolve(outputFlag < 0 ? 'qa/submission-video/host-setup' : process.argv[outputFlag + 1]);
const mock = process.argv.includes('--mock');
const status = await (await fetch(`${base}/api/twitch/status`)).json();
if (mock ? status.mode !== 'mock'
  : status.mode !== 'live' || !status.authenticated || !status.connected) {
  throw new Error('Choose an explicit mock capture or an authenticated live chat connection.');
}
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const errors: string[] = [];
try {
  const show = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await show.addInitScript('globalThis.__name = fn => fn;');
  show.on('pageerror', error => errors.push(error.message));
  await show.goto(`${base}/show?manual=1&take=seed&mute=1`);
  await show.waitForFunction(() => window.__chaos?.connected && window.__chaos.phase === 'ATTRACT');
  await show.evaluate(() => {
    window.__chaos.command('queue', []);
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: resolve(directory, 'raw'), size: { width: 1920, height: 1080 } } });
  const start = Date.now();
  const page = await context.newPage();
  const recording = page.video()!;
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/dashboard`);
  await page.waitForFunction(() => document.querySelector('#bridge-mode')?.getAttribute('data-connected') === 'true'
    && document.querySelector('#live-title')?.textContent !== 'No show open');
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.zoom = '.75';
    // Keep focus rings without CSS-zoom focus scrolling during the recorded drag.
    const original = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function(options) { original.call(this, { ...options, preventScroll: true }); };
  });
  await page.addStyleTag({ content: `#edit-pointer{position:fixed;width:25px;height:32px;z-index:99999;
    pointer-events:none;left:1600px;top:293.333px;filter:drop-shadow(2px 3px 0 #1b1b3a44)}
    .edit-click{position:fixed;width:50px;height:50px;border:4px solid #ff4f7b;border-radius:50%;
    pointer-events:none;z-index:99998;animation:edit-click .5s ease-out forwards}
    .queue-drag-preview{zoom:1.3333333333;transform:scale(.75) rotate(-1deg);transform-origin:0 0}
    @keyframes edit-click{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}` });
  await page.evaluate(() => {
    // The drag portal uses viewport coordinates; cancel the recording-only page scale.
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.classList.contains('queue-drag-preview')) {
          node.style.width = `${parseFloat(node.style.width) / .75}px`;
        }
      }
    }).observe(document.body, { childList: true });
    const cursor = document.createElement('div');
    cursor.id = 'edit-pointer';
    cursor.innerHTML = '<svg viewBox="0 0 25 32"><path d="M3 2L22 18L13 19L9 29Z" fill="white" stroke="#1b1b3a" stroke-width="3"/></svg>';
    document.body.append(cursor);
    addEventListener('pointermove', event => { cursor.style.left = `${event.clientX / .75}px`; cursor.style.top = `${event.clientY / .75}px`; });
    addEventListener('click', event => {
      const ring = document.createElement('div');
      ring.className = 'edit-click';
      Object.assign(ring.style, { left: `${event.clientX / .75 - 25}px`, top: `${event.clientY / .75 - 25}px` });
      document.body.append(ring);
      setTimeout(() => ring.remove(), 550);
    });
  });
  const pointer = new VideoPointer(page, { x: 1200, y: 220 });
  await page.mouse.move(1200, 220);
  const readyAt = (Date.now() - start) / 1000;
  const actions: { at: number; action: string }[] = [];
  const mark = (action: string) => actions.push({ at: (Date.now() - start) / 1000, action });
  await page.screenshot({ path: resolve(directory, 'ready.png') });
  await page.waitForTimeout(500);
  for (const id of ['hot-potato', 'multiplier-cascade']) {
    const button = page.locator(`[data-add="${id}"]`);
    await pointer.click(button, id === 'hot-potato' ? 720 : 820);
    mark(`queue:${id}`);
    await page.waitForTimeout(280);
  }
  const first = await page.locator('#queue .queue-grip').nth(0).boundingBox();
  const second = await page.locator('#queue .queue-grip').nth(1).boundingBox();
  if (!first || !second) throw new Error('Queue did not update');
  await pointer.move({ x: second.x + second.width / 2, y: second.y + second.height / 2 }, 720, -26);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await pointer.move({ x: first.x + first.width / 2, y: first.y + 5 }, 650, 5);
  await page.waitForTimeout(100);
  await page.mouse.up();
  mark('drag-reorder');
  await page.waitForTimeout(320);
  const queue = await page.locator('#queue .queue-row').evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.game));
  if (queue.join(',') !== 'multiplier-cascade,hot-potato') throw new Error('Actual drag reorder failed');
  await pointer.click(page.locator('#start'), 740);
  mark('start-show');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForFunction(() => document.querySelector('#live-title')?.textContent === 'MULTIPLIER CASCADE'
    && !(document.querySelector('[data-cmd="pause"]') as HTMLElement).hidden);
  await pointer.move({ x: 1510, y: 410 }, 600, 12);
  await page.waitForTimeout(1700);
  await page.screenshot({ path: resolve(directory, 'started.png') });
  await context.close();
  const raw = resolve(directory, 'dashboard-raw.webm');
  await recording.saveAs(raw);
  const media = finalizeRecording(raw, resolve(directory, 'dashboard.webm'));
  await show.close();
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ mode: status.mode, channel: status.channel,
    authenticated: Boolean(status.authenticated), connected: Boolean(status.connected), nativeWagers: false, desktopCaptured: false,
    pointerOverlay: true, pointerMotion: '60 Hz wall-clock-paced minimum-jerk curves', readyAt, actions, queue, media, errors }, null, 2));
  if (errors.length) throw new Error('Host capture had browser errors');
  console.log(JSON.stringify({ readyAt, actions, duration: media.duration, errors }));
} finally { await browser.close(); }
