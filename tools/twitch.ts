import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from '../apps/server/src/app';
import { config } from '../apps/server/src/config';

const LIVE_PORT = 4181;
const ORIGIN = `http://localhost:${LIVE_PORT}`;
const dashboard = `${ORIGIN}/dashboard`;

function openBrowser(): void {
  if (process.argv.includes('--no-open')) return;
  const [command, args] = process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', dashboard]]
    : process.platform === 'darwin' ? ['open', [dashboard]] : ['xdg-open', [dashboard]];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Open ${dashboard}`));
  child.unref();
}

let existing = false;
try {
  const response = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1000) });
  const health = await response.json();
  existing = health.application === 'chaos-factory' && health.mode === 'live';
} catch { /* Start the live app when it is not already listening. */ }

if (existing) {
  console.log(`Twitch app is already running: ${dashboard}`);
  openBrowser();
} else {
  const runtime = await createServer({ PORT: LIVE_PORT, TWITCH_MODE: 'live',
    TWITCH_AUTH_FLOW: 'device', TWITCH_REDIRECT_URI: `${ORIGIN}/auth/callback`,
    DATA_DIR: resolve(config.DATA_DIR, 'live'), DASHBOARD_LAN: '0' });
  try {
    await runtime.app.listen({ port: LIVE_PORT, host: '127.0.0.1' });
  } catch {
    await runtime.app.close();
    console.error(`Port ${LIVE_PORT} is in use. Close the other service, then run npm run twitch again.`);
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    void runtime.connect().catch(() => console.error('Twitch connection is unavailable; the dashboard remains open.'));
    console.log(`Twitch setup and controls: ${dashboard}`);
    console.log(`OBS browser source: ${ORIGIN}/show?manual=1`);
    console.log('First time: enter your public Twitch app Client ID, then authorize on Twitch. No pasted tokens.');
    console.log('Saved authorization reconnects automatically. Offline development stays in mock mode.');
    openBrowser();
    let closing = false;
    const stop = async () => {
      if (closing) return;
      closing = true;
      await runtime.app.close();
    };
    process.on('SIGINT', () => { void stop(); });
    process.on('SIGTERM', () => { void stop(); });
  }
}
