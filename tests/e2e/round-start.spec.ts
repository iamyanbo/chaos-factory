import { expect, test } from '@playwright/test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from '../../apps/server/src/app';

let runtime: Awaited<ReturnType<typeof createServer>>;
let origin: string;

test.beforeEach(async () => {
  await mkdir('.data', { recursive: true });
  runtime = await createServer({ TWITCH_MODE: 'mock', MOCK_VIEWERS: 0,
    MOCK_DELAY_MS: '0-0', DATA_DIR: await mkdtemp(resolve('.data/round-start-qa-')) });
  origin = await runtime.app.listen({ host: '127.0.0.1', port: 0 });
  await runtime.connect();
});

test.afterEach(async () => { await runtime?.app.close(); });

test('optional games queue for live shows and rotation preferences survive a dashboard reload', async ({ page, context }) => {
  const show = await context.newPage();
  try {
    await show.goto(`${origin}/show?manual=1&take=seed&mute=1`);
    await show.waitForFunction(() => window.__chaos?.connected);
    await page.goto(`${origin}/dashboard`);
    await expect(page.locator('#round-start')).toBeEnabled();
    await page.locator('#round-start').selectOption('manual');
    await page.locator('#show-settings > summary').click();
    const rotation = page.locator('[data-enable="pong-wars"]');
    await expect(rotation).not.toBeChecked();
    await rotation.check();
    await expect.poll(() => runtime.hub.state?.enabledGames).toContain('pong-wars');
    await page.reload();
    await page.locator('#show-settings > summary').click();
    await expect(rotation).toBeChecked();
    await rotation.uncheck();
    await expect.poll(() => runtime.hub.state?.enabledGames).not.toContain('pong-wars');
    await page.locator('#show-settings > summary').click();
    for (const id of ['pong-wars', 'light-cycles', 'ring-escape']) {
      await page.locator(`[data-add="${id}"]`).click();
    }
    await expect.poll(() => runtime.hub.state?.queue).toEqual(['pong-wars', 'light-cycles', 'ring-escape']);
    await page.getByRole('button', { name: 'Start a Cup' }).click();
    await expect(page.locator('#live-title')).toHaveText('PONG WARS');
    await expect(page.locator('#live-state')).toContainText('Faction supporters');
    await expect(page.getByText('SUPPORTERS', { exact: true })).toBeVisible();
    await expect(page.locator('#start-round')).toBeEnabled();
    expect(runtime.hub.state?.enabledGames).not.toContain('pong-wars');
    expect(runtime.hub.state?.format).toBe('faction');
    await page.screenshot({ path: 'qa/checks/optional-queue-dashboard.png', fullPage: true });
  } finally { await show.close(); }
});

test('host can keep joins open, admit viewers and start the round from the dashboard', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const show = await context.newPage();
  show.on('pageerror', error => errors.push(error.message));
  try {
    await show.goto(`${origin}/show?manual=1&take=seed&mute=1`);
    await show.waitForFunction(() => window.__chaos?.connected);
    await page.goto(`${origin}/dashboard`);
    await expect(page.locator('#round-start')).toBeEnabled();
    await page.locator('#round-start').selectOption('manual');
    await page.locator('#show-settings > summary').click();
    await page.locator('#wagers').uncheck();
    await page.locator('#show-settings > summary').click();
    await page.locator('[data-add="blade-brawl"]').click();
    await page.getByRole('button', { name: 'Start a Cup' }).click();
    await expect(page.locator('#start-round')).toBeVisible();
    await expect(page.locator('#start-round')).toBeDisabled();
    await expect(page.locator('#live-state')).toContainText('Waiting for players');
    // The ordinary 30-second lobby expires; manual mode must keep accepting joins.
    await page.waitForTimeout(31000);
    expect(await show.evaluate(() => window.__chaos.phase)).toBe('LOBBY_BET');
    await page.locator('#mock-testing > summary').click();
    for (const login of ['first_viewer', 'second_viewer']) {
      await page.locator('#login').fill(login);
      await page.locator('#chat').fill('!join');
      await page.locator('#chat-form').getByRole('button').click();
    }
    await expect(page.locator('#viewers')).toContainText('2/');
    await expect(page.locator('#start-round')).toBeEnabled();
    await mkdir('qa/checks', { recursive: true });
    await show.screenshot({ path: 'qa/checks/round-waiting-joins.png' });
    await page.locator('.cup-card').screenshot({ path: 'qa/checks/round-start-control.png' });
    await page.locator('#start-round').click();
    await show.waitForFunction(() => window.__chaos.phase === 'LOCK_COUNTDOWN');
    await show.waitForFunction(() => (window.__chaos.show?.phaseTime ?? 0) > .5);
    await show.screenshot({ path: 'qa/checks/round-countdown-three.png' });
    await show.waitForFunction(() => (window.__chaos.show?.phaseTime ?? 0) > 1.05);
    await show.screenshot({ path: 'qa/checks/round-countdown-two.png' });
    await show.waitForFunction(() => window.__chaos.phase === 'PLAY');
    expect(await show.evaluate(() => window.__chaos.participants.length)).toBe(2);
    await expect(page.locator('#start-round')).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await show.close(); }
});

test('shared waiting, loading and countdown screens keep the Toy style', async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.close());
  await mkdir('qa/checks', { recursive: true });
  for (const screen of ['waiting', 'loading', 'countdown']) {
    await page.goto(`${origin}/preview?screen=${screen}`);
    await expect(page.locator('html')).toHaveAttribute('data-preview', screen);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `qa/checks/round-${screen}-preview.png` });
  }
});

test('offline games show all three countdown numbers before the arena starts', async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto(`${origin}/play?game=blade-brawl&seed=1&mute=1`);
  await page.waitForFunction(() => window.__chaos?.phase === 'LOCK_COUNTDOWN');
  if (await page.evaluate(() => window.__chaos.selectingTake)) {
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'qa/checks/offline-loading-dots.png' });
  }
  await page.waitForFunction(() => window.__chaos.phase === 'LOCK_COUNTDOWN' && !window.__chaos.selectingTake);
  for (const elapsed of [.5, 1.1, 2.1]) {
    await page.waitForFunction(time => window.__chaos.phase === 'LOCK_COUNTDOWN'
      && (window.__chaos.show?.phaseTime ?? 0) >= time, elapsed);
    expect(await page.evaluate(() => window.__chaos.inspect().time)).toBe(0);
    await page.screenshot({ path: `qa/checks/offline-countdown-${3 - Math.floor(elapsed)}.png` });
  }
  await page.waitForFunction(() => window.__chaos.phase === 'PLAY');
  await page.waitForFunction(() => window.__chaos.inspect().time > .2);
});

test('queue drag, touch and keyboard reorder persist without arrow buttons', async ({ page, context }) => {
  test.setTimeout(60000);
  const show = await context.newPage();
  const order = () => page.locator('#queue > li').evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.game));
  try {
    await show.goto(`${origin}/show?manual=1&take=seed&mute=1`);
    await show.waitForFunction(() => window.__chaos?.connected);
    await page.goto(`${origin}/dashboard`);
    await expect(page.locator('#round-start')).toBeEnabled();
    const initial = ['hot-potato', 'blade-brawl', 'multiplier-cascade'];
    for (const [index, id] of initial.entries()) {
      await page.locator(`[data-add="${id}"]`).click();
      await expect.poll(() => runtime.hub.state?.queue?.length).toBe(index + 1);
    }
    await expect(page.locator('#queue .queue-action')).toHaveCount(0);
    await page.locator('#queue').scrollIntoViewIfNeeded();
    const grip = (await page.locator('#queue .queue-grip').first().boundingBox())!;
    const last = (await page.locator('#queue > li').last().boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, last.y + last.height - 8, { steps: 12 });
    await expect(page.locator('.queue-drag-preview')).toBeVisible();
    await page.screenshot({ path: 'qa/checks/queue-dragging.png' });
    await page.mouse.up();
    const dragged = ['blade-brawl', 'multiplier-cascade', 'hot-potato'];
    await expect.poll(order).toEqual(dragged);
    await expect.poll(() => runtime.hub.state?.queue).toEqual(dragged);
    await page.locator('#queue .queue-grip').first().focus();
    await page.keyboard.press('End');
    const keyed = ['multiplier-cascade', 'hot-potato', 'blade-brawl'];
    await expect.poll(() => runtime.hub.state?.queue).toEqual(keyed);
    await page.locator('#queue > li[data-game="hot-potato"] .queue-remove').click();
    await expect.poll(() => runtime.hub.state?.queue).toEqual(['multiplier-cascade', 'blade-brawl']);
    await page.locator('[data-add="blade-brawl"]').click();
    await expect.poll(() => runtime.hub.state?.queue?.length).toBe(3);
    await page.locator('#queue .queue-grip').last().focus();
    await page.keyboard.press('Home');
    await expect.poll(() => runtime.hub.state?.queue).toEqual(['blade-brawl', 'multiplier-cascade', 'blade-brawl']);
    await page.locator('#queue > li').first().locator('.queue-remove').click();
    await expect.poll(() => runtime.hub.state?.queue).toEqual(['multiplier-cascade', 'blade-brawl']);
    // A queue change from the show cancels an in-progress drag instead of restoring stale games.
    const current = (await page.locator('#queue .queue-grip').first().boundingBox())!;
    await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2);
    await page.mouse.down();
    runtime.hub.broadcast({ type: 'director.command', cmd: 'queue', arg: ['peg-fever', 'marble-race'] }, ['show']);
    await expect(page.locator('.queue-drag-preview')).toHaveCount(0);
    await page.mouse.up();
    await expect.poll(order).toEqual(['peg-fever', 'marble-race']);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#queue').scrollIntoViewIfNeeded();
    const firstTouch = (await page.locator('#queue .queue-grip').first().boundingBox())!;
    const lastTouch = (await page.locator('#queue > li').last().boundingBox())!;
    const touch = await context.newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const point = { x: firstTouch.x + firstTouch.width / 2, y: firstTouch.y + firstTouch.height / 2 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ ...point, y: lastTouch.y + lastTouch.height - 8 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => runtime.hub.state?.queue).toEqual(['marble-race', 'peg-fever']);
    await page.locator('.queue-card').screenshot({ path: 'qa/checks/queue-mobile.png' });
  } finally { await show.close(); }
});
