/** Only score-at-the-end games have a gameplay clock, and only for their finale. */
export function roundCountdown(ending: 'natural' | 'timed' | undefined,
  phase: string, remaining: number): number | undefined {
  return ending === 'timed' && phase === 'PLAY' && remaining > 0 && remaining <= 10
    ? Math.ceil(remaining) : undefined;
}
