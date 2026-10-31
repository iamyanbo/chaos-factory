import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export interface VideoEmote { name: string; id: string; url: string; file: string; sha256: string }
declare global { interface Window { videoEmoteImages: Record<string, HTMLImageElement> } }

export function validateEmoteAsset(asset: VideoEmote, bytes: Uint8Array): void {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || url.hostname !== 'static-cdn.jtvnw.net'
    || !/^[A-Za-z]+\.png$/.test(asset.file) || !url.pathname.includes(`/emoticons/v2/${encodeURIComponent(asset.id)}/`)
    || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new Error('Video emote provenance or content hash is invalid.');
  }
}

/** Browser receives only public image bytes, never Twitch credentials. */
export async function installVideoEmotes(page: Page): Promise<void> {
  const directory = resolve('qa/submission-video/twitch-emotes');
  const manifest = JSON.parse(await readFile(resolve(directory, 'assets.json'), 'utf8')) as { assets: VideoEmote[] };
  const images = await Promise.all(manifest.assets.map(async asset => {
    if (!/^[A-Za-z]+\.png$/.test(asset.file)) throw new Error('Invalid emote cache path');
    const bytes = await readFile(resolve(directory, asset.file));
    validateEmoteAsset(asset, bytes);
    return { name: asset.name, data: `data:image/png;base64,${bytes.toString('base64')}` };
  }));
  await page.evaluate(async images => {
    window.videoEmoteImages = {};
    await Promise.all(images.map(async ({ name, data }) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      window.videoEmoteImages[name] = image;
    }));
  }, images);
}
