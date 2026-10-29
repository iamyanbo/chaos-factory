import { expect, test } from 'vitest';
import { assertEffectsOnly } from '../../tools/video-audio';

test('old mixed music and incomplete capture proofs cannot enter a single-bed edit', () => {
  expect(() => assertEffectsOnly({ audioMode: 'mixed', samples: [] })).toThrow('Recapture with --sfx-only');
  expect(() => assertEffectsOnly({ audioMode: 'sfx-only', samples: [] })).toThrow();
  expect(() => assertEffectsOnly({ audioMode: 'sfx-only', samples: [{}] })).toThrow();
  expect(() => assertEffectsOnly({ audioMode: 'sfx-only', samples: [
    { musicEnabled: false, musicPlaying: false }, { musicEnabled: false, musicPlaying: true }
  ] })).toThrow();
  expect(() => assertEffectsOnly({ audioMode: 'sfx-only', samples: [
    { musicEnabled: false, musicPlaying: false }
  ] })).not.toThrow();
});
