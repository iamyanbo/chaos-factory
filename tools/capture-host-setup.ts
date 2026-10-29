import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizeRecording } from './drama/capture-media';

const base = 'http://127.0.0.1:4181';
const directory = resolve('qa/submission-video/host-setup');
const status = await (await fetch(`${base}/api/twitch/status`)).json();
if (status.mode !== 'live' || !status.authenticated || !status.connected || status.canPredict) {
  throw new Error('Host capture requires the connected standard test channel, without native wagers.');
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
    window.__chaos.command('toggleWagers', false);
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
  await page.evaluate(async () => { await document.fonts.ready; document.documentElement.style.zoom = '.75'; });
  await page.addStyleTag({ content: `#edit-pointer{position:fixed;width:25px;height:32px;z-index:99999;
    pointer-events:none;left:1600px;top:220px;filter:drop-shadow(2px 3px 0 #1b1b3a44)}
    .edit-click{position:fixed;width:50px;height:50px;border:4px solid #ff4f7b;border-radius:50%;
    pointer-events:none;z-index:99998;animation:edit-click .5s ease-out forwards}
    @keyframes edit-click{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}` });
  await page.evaluate(() => {
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
  const readyAt = (Date.now() - start) / 1000;
  const actions: { at: number; action: string }[] = [];
  const mark = (action: string) => actions.push({ at: (Date.now() - start) / 1000, action });
  await page.screenshot({ path: resolve(directory, 'ready.png') });
  await page.waitForTimeout(900);
  for (const id of ['hot-potato', 'multiplier-cascade']) {
    const button = page.locator(`[data-add="${id}"]`);
    const box = await button.boundingBox();
    if (!box) throw new Error('Queue button is not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await button.click();
    mark(`queue:${id}`);
    await page.waitForTimeout(750);
  }
  const first = await page.locator('#queue .queue-grip').nth(0).boundingBox();
  const second = await page.locator('#queue .queue-grip').nth(1).boundingBox();
  if (!first || !second) throw new Error('Queue did not update');
  await page.mouse.move(second.x + 12, second.y + 18, { steps: 8 });
  await page.mouse.down();
  await page.mouse.move(first.x + 12, first.y + 5, { steps: 18 });
  await page.mouse.up();
  mark('drag-reorder');
  await page.waitForTimeout(700);
  const queue = await page.locator('#queue .queue-row').evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.game));
  if (queue.join(',') !== 'multiplier-cascade,hot-potato') throw new Error('Actual drag reorder failed');
  await page.locator('#start').click();
  mark('start-cup');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForFunction(() => document.querySelector('#live-title')?.textContent === 'MULTIPLIER CASCADE'
    && !(document.querySelector('[data-cmd="pause"]') as HTMLElement).hidden);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: resolve(directory, 'started.png') });
  await context.close();
  const raw = resolve(directory, 'dashboard-raw.webm');
  await recording.saveAs(raw);
  const media = finalizeRecording(raw, resolve(directory, 'dashboard.webm'));
  await show.close();
  await writeFile(resolve(directory, 'capture.json'), JSON.stringify({ mode: 'live', channel: status.channel,
    authenticated: true, connected: true, nativeWagers: false, desktopCaptured: false,
    pointerOverlay: true, readyAt, actions, queue, media, errors }, null, 2));
  if (errors.length) throw new Error('Host capture had browser errors');
  console.log(JSON.stringify({ readyAt, actions, duration: media.duration, errors }));
} finally { await browser.close(); }
