import { readFile } from 'node:fs/promises';
import { assertEffectsOnly, type AudioCaptureProof } from './video-audio';
import type { OptionalGameVideo, RoundVideo } from './video-plan';

/** A separately recorded take still uses the current game, normal speed and effects-only audio. */
export async function loadAlternateVideo(rounds: RoundVideo, game: string): Promise<void> {
  const path = `qa/submission-video/alternate-games/${game}/capture.json`;
  const capture = JSON.parse(await readFile(path, 'utf8')) as OptionalGameVideo & AudioCaptureProof;
  assertEffectsOnly(capture);
  if (capture.game !== game) throw new Error(`Alternate recording identity mismatch: ${game}`);
  rounds.alternate = { ...rounds.alternate, [game]: capture };
}

export const OPTIONAL_VIDEO_GAMES = ['pong-wars', 'light-cycles', 'ring-escape'] as const;

export async function optionalVideos(): Promise<OptionalGameVideo[]> {
  return Promise.all(OPTIONAL_VIDEO_GAMES.map(async game => {
    const path = `qa/submission-video/optional-games/${game}/capture.json`;
    const capture = JSON.parse(await readFile(path, 'utf8')) as OptionalGameVideo & AudioCaptureProof;
    assertEffectsOnly(capture);
    if (capture.game !== game) throw new Error(`Optional recording identity mismatch: ${game}`);
    return capture;
  }));
}
