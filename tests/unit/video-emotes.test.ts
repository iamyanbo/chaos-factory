import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { validateEmoteAsset } from '../../tools/video-emotes';
import { IMPACT_CAPTION_LAYOUT } from '../../tools/video-impact';

const bytes = new Uint8Array([1, 2, 3]);
const asset = { name: 'SeemsGood', id: '64138', file: 'SeemsGood.png',
  url: 'https://static-cdn.jtvnw.net/emoticons/v2/64138/static/dark/3.0',
  sha256: createHash('sha256').update(bytes).digest('hex') };

test('emote cache accepts official CDN provenance and rejects altered data or local paths', () => {
  expect(() => validateEmoteAsset(asset, bytes)).not.toThrow();
  expect(() => validateEmoteAsset(asset, new Uint8Array([4]))).toThrow('provenance');
  expect(() => validateEmoteAsset({ ...asset, url: asset.url.replace('static-cdn.jtvnw.net', 'example.com') }, bytes)).toThrow();
  expect(() => validateEmoteAsset({ ...asset, file: '../private.png' }, bytes)).toThrow();
});

test('caption and flanking stickers fit the central arena, above the finish and outside the HUDs', () => {
  const layout = IMPACT_CAPTION_LAYOUT;
  expect(layout.x).toBe(1920 / 2);
  expect(layout.y).toBeLessThan(600);
  const halfWidth = layout.maxTextWidth / 2 + layout.stickerSize + layout.stickerGap + 12;
  expect(layout.x - halfWidth).toBeGreaterThan(448);
  expect(layout.x + halfWidth).toBeLessThan(1472);
});
