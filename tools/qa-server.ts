import { fileURLToPath } from 'node:url';
process.env.PORT='4180';process.env.DATA_DIR=fileURLToPath(new URL('../.data/qa',import.meta.url));process.env.TWITCH_MODE='mock';
await import('../apps/server/src/index');
