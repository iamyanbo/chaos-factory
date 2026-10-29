import { config } from './config';
import { createServer } from './app';

const runtime = await createServer({}, true);
await runtime.app.listen({ port: config.PORT, host: config.DASHBOARD_LAN === '1' ? '0.0.0.0' : '127.0.0.1' });
// Dashboard and games remain available while Twitch authorization initializes.
void runtime.connect();
let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await runtime.app.close();
}
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
