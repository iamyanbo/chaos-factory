export interface AudioCaptureProof {
  audioMode?: string;
  samples?: readonly { musicEnabled?: boolean; musicPlaying?: boolean }[];
}

/** Reject an old mixed capture rather than hiding its music beneath another bed. */
export function assertEffectsOnly(capture: AudioCaptureProof): void {
  if (capture.audioMode !== 'sfx-only' || !capture.samples?.length
    || capture.samples.some(sample => sample.musicEnabled !== false || sample.musicPlaying !== false)) {
    throw new Error('Recapture with --sfx-only: source game music must be disabled throughout.');
  }
}
