import { TITLE_SCREEN_SECONDS } from './video-titles';

/** Measured from Stage 2's low-frequency onset grid (10 ms analysis hop).
 * The 56.1039 s author loop is exactly 144 beats at 154 BPM.
 */
export const EDIT_BPM = 154;
export const EDIT_BEAT_SECONDS = 60 / EDIT_BPM;
export const EDIT_FPS = 30;
export const INTRO_SECONDS = TITLE_SCREEN_SECONDS;
const FIRST_SOURCE_BEAT = .02;
const INTRO_SOURCE_BEAT = 12;
export const MUSIC_START_SECONDS = FIRST_SOURCE_BEAT + INTRO_SOURCE_BEAT * EDIT_BEAT_SECONDS - INTRO_SECONDS;

/** Only extend a shot, preserving its reviewed physical payoff. */
export function durationToBeat(start: number, minimum: number): number {
  const requiredEnd = start + minimum;
  let beat = Math.ceil((requiredEnd - INTRO_SECONDS) / EDIT_BEAT_SECONDS - 1e-8);
  let end = Math.round((INTRO_SECONDS + beat * EDIT_BEAT_SECONDS) * EDIT_FPS) / EDIT_FPS;
  if (end < requiredEnd - 1e-8) {
    beat++;
    end = Math.round((INTRO_SECONDS + beat * EDIT_BEAT_SECONDS) * EDIT_FPS) / EDIT_FPS;
  }
  return end - start;
}
