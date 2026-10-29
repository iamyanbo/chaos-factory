import 'dotenv/config';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
export const config = z.object({
  TWITCH_MODE: z.enum(['mock', 'live']).default('mock'), PORT: z.coerce.number().int().min(1).max(65535).default(4174),
  MOCK_VIEWERS: z.coerce.number().int().min(0).max(500).default(60), MOCK_DELAY_MS: z.string().regex(/^\d+-\d+$/).default('2500-4500'),
  DASHBOARD_LAN: z.enum(['0', '1']).default('0'), DATA_DIR: z.string().default(fileURLToPath(new URL('../../../.data', import.meta.url))),
  TWITCH_CLIENT_ID: z.string().default(''),
  TWITCH_CLIENT_SECRET: z.string().default(''),
  TWITCH_AUTH_FLOW: z.enum(['auto', 'device', 'code']).default('auto'),
  TWITCH_REDIRECT_URI: z.string().url().default('http://localhost:4174/auth/callback')
}).parse(process.env);
export function delayRange(value: string): [number, number] { const [a, b] = value.split('-').map(Number); return [Math.min(a, b, 15000), Math.min(Math.max(a, b), 15000)]; }
