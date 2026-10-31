import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { TwitchAuth } from '../apps/server/src/twitch/auth';
import { JsonStore } from '../apps/server/src/storage';
import { config } from '../apps/server/src/config';

const directory = resolve('qa/submission-video/twitch-emotes');
const store = new JsonStore(resolve(config.DATA_DIR, 'live'));
const client = await store.read<{ clientId?: string }>('twitch-client.json', {});
const auth = new TwitchAuth({ clientId: client.clientId || config.TWITCH_CLIENT_ID,
  clientSecret: config.TWITCH_CLIENT_SECRET, redirectUri: config.TWITCH_REDIRECT_URI, deviceFlow: true }, store);
const wanted = ['SeemsGood', 'PartyHat', 'TwitchLit'];
try {
  await auth.connect();
  if (!auth.user || !auth.api) throw new Error('Connect Twitch locally before fetching official global emotes.');
  const token = await auth.provider!.getAccessTokenForUser(auth.userId!);
  if (!token) throw new Error('Connect Twitch locally before fetching emotes.');
  const result = await fetch('https://api.twitch.tv/helix/chat/emotes/global', {
    headers: { 'Client-Id': auth.settings.clientId, Authorization: `Bearer ${token.accessToken}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!result.ok) throw new Error(`Twitch emote lookup failed (${result.status}).`);
  const global = (await result.json() as { data: { id: string; name: string }[] }).data;
  await mkdir(directory, { recursive: true });
  const assets = [];
  for (const name of wanted) {
    const emote = global.find(row => row.name === name);
    if (!emote) throw new Error(`Twitch no longer lists ${name} as a global emote.`);
    const url = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emote.id)}/static/dark/3.0`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Could not fetch ${name}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = `${name}.png`;
    await writeFile(resolve(directory, file), bytes);
    assets.push({ name, id: emote.id, url, file, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await writeFile(resolve(directory, 'assets.json'), JSON.stringify({
    source: 'Twitch Get Global Emotes API', endpoint: 'https://api.twitch.tv/helix/chat/emotes/global',
    downloadedAt: new Date().toISOString(), usage: 'Editorial stickers, not real chat messages or viewer reactions',
    rights: 'Twitch/respective rights holders; not CC0. Downloaded media is excluded from the source package.', assets
  }, null, 2));
  console.log(JSON.stringify(assets.map(({ name, id, url }) => ({ name, id, url })), null, 2));
} finally { auth.disconnect(); }
