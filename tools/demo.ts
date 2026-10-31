import { fileURLToPath } from 'node:url';

const port = 4182;
const base = `http://127.0.0.1:${port}`;
let running = false;
try {
  const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
  const health = await response.json() as { application?: string; mode?: string };
  if (health.application !== 'chaos-factory' || health.mode !== 'mock') {
    throw new Error('Port 4182 is occupied by a different application.');
  }
  running = true;
} catch (error) {
  if (error instanceof Error && error.message.includes('occupied')) throw error;
}
if (!running) {
  // Explicit values override a local .env: this command never connects to Twitch.
  process.env.TWITCH_MODE = 'mock';
  process.env.PORT = String(port);
  process.env.MOCK_VIEWERS = '24';
  process.env.MOCK_DELAY_MS = '2500-4500';
  process.env.DATA_DIR = fileURLToPath(new URL('../.data/demo', import.meta.url));
  await import('../apps/server/src/index');
}
console.log(`\nChaos Factory offline demo${running ? ' is already running' : ''}.`);
console.log(`Play any game: ${base}/play`);
console.log(`Automatic show: ${base}/show`);
console.log(`Host controls: ${base}/dashboard`);
console.log('24 simulated viewers; no Twitch account or credentials required.');
