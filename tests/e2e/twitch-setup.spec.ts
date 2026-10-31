import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const clientId = 'publicclientfixture1234567890';
const pending = { state: 'waiting', userCode: 'TESTCODE', expiresAt: Date.now() + 600000,
  verificationUri: 'https://www.twitch.tv/activate?public=true&device-code=TESTCODE' };
const connection = { type: 'twitch.status', mode: 'live', configured: false, connected: false,
  authenticated: false, eventSubConnected: false, channel: 'Not connected', authFlow: 'device' };

async function wireStatus(page: Page, configured = false): Promise<() => WebSocketRoute> {
  let wire: WebSocketRoute;
  await page.routeWebSocket('**/ws', socket => {
    wire = socket;
    socket.onMessage(() => socket.send(JSON.stringify({ ...connection, configured })));
  });
  return () => wire;
}

test('first-time Twitch setup asks for only a public Client ID and reports readiness', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await wireStatus(page);
  await page.route('**/auth/device/**', route => route.fulfill({ json: { state: 'idle' } }));
  await page.goto('/dashboard');
  await expect(page.locator('#bridge-mode')).toContainText('Twitch not connected');
  await expect(page.getByLabel('Client ID (public)')).toBeVisible();
  await page.getByText('Register the app', { exact: true }).click();
  const registration = new URL('/auth/callback', page.url());
  registration.protocol = 'https:';
  await expect(page.locator('.twitch-first-time code')).toHaveText(registration.href);
  expect(new URL(page.url()).protocol).toBe('http:');
  await expect(page.getByRole('button', { name: 'Connect Twitch', exact: true })).toBeEnabled();
  await expect(page.locator('[data-twitch="authenticated"]')).toHaveText('Not authorized');
  await expect(page.locator('[data-twitch="eventsub"]')).toHaveText('Waiting for authorization');
  await expect(page.locator('[data-twitch="last-join"]')).toHaveText('No joins received yet');
  await expect(page.locator('input[name="accessToken"], input[name="clientSecret"], input[name="refreshToken"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  await mkdir('qa/checks', { recursive: true });
  await page.screenshot({ path: 'qa/checks/twitch-setup-first-time.png' });
});

test('one guided flow opens Twitch and automatically reports chat without pasted tokens', async ({ page, context }) => {
  const wire = await wireStatus(page);
  let started = false;
  let posted: Record<string, unknown> | undefined;
  await context.route('https://www.twitch.tv/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Twitch consent fixture</p>' }));
  await page.route('**/auth/device/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/start')) { started = true; posted = route.request().postDataJSON(); }
    await route.fulfill({ json: started ? pending : { state: 'idle' } });
  });
  await page.goto('/dashboard');
  await page.getByLabel('Client ID (public)').fill(clientId);
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Connect Twitch', exact: true }).click();
  const popup = await popupPromise;
  await expect.poll(() => new URL(popup.url()).hostname).toBe('www.twitch.tv');
  await expect(page.getByText('TESTCODE', { exact: true })).toBeVisible();
  expect(posted).toEqual({ clientId });
  await page.screenshot({ path: 'qa/checks/twitch-setup-pending.png' });
  wire().send(JSON.stringify({ ...connection, configured: true, connected: true, authenticated: true,
    eventSubConnected: true, channel: 'host', broadcasterType: 'affiliate', lastJoinAt: Date.now() }));
  await expect(page.locator('.connection-panel')).not.toHaveAttribute('open');
  await page.locator('.connection-panel > summary').click();
  await expect(page.locator('[data-twitch="authenticated"]')).toHaveText('Authorized as @host');
  await expect(page.locator('[data-twitch="eventsub"]')).toHaveText('Connected');
  await expect(page.locator('[data-twitch="last-join"]')).not.toContainText('No joins');
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByLabel('Client ID (public)')).toBeHidden();
  await page.screenshot({ path: 'qa/checks/twitch-setup-connected-fixture.png' });
});

test('canceling or failing a login leaves a working retry button and chat-only status stays clear', async ({ page, context }) => {
  const wire = await wireStatus(page, true);
  let state: 'idle' | 'waiting' | 'canceled' = 'idle';
  let unavailable = false;
  await context.route('https://www.twitch.tv/**', route => route.fulfill({ body: 'Consent fixture' }));
  await page.route('**/auth/device/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/start') && unavailable) {
      await route.fulfill({ status: 400, json: { error: 'Twitch is unavailable. Try again.' } });
      return;
    }
    if (path.endsWith('/start')) state = 'waiting';
    if (path.endsWith('/cancel')) state = 'canceled';
    await route.fulfill({ json: state === 'waiting' ? pending : { state } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Connect Twitch', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel login' }).click();
  await expect(page.getByText('Twitch login canceled.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Twitch', exact: true })).toBeEnabled();
  unavailable = true;
  await page.getByRole('button', { name: 'Connect Twitch', exact: true }).click();
  await expect(page.getByText('Twitch is unavailable. Try again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Twitch', exact: true })).toBeEnabled();
  wire().send(JSON.stringify({ ...connection, configured: true, connected: true, authenticated: true,
    eventSubConnected: true, channel: 'host', broadcasterType: '' }));
  await expect(page.locator('.connection-panel')).not.toHaveAttribute('open');
  await page.locator('.connection-panel > summary').click();
  await expect(page.locator('[data-twitch="account"]')).toHaveText('Standard · chat only');
  await expect(page.getByText('@host · viewers type !join to play.')).toBeVisible();
  await expect(page.locator('#wagers, #prediction-status, #bet-window')).toHaveCount(0);
});
