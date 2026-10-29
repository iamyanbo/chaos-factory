import type { TakeEvents } from '../../kit/take-types';

const BASE_SCORE = 1000;
const TARGET_DURATION = 55;
const DURATION_TOLERANCE = 15;
const DURATION_WEIGHT = 5;
const LEAD_WEIGHT = 20;
const CLOSENESS_WEIGHT = 40;
const QUIET_LIMIT = 6;
const QUIET_WEIGHT = 80;
const UNFINISHED_PENALTY = 3000;

/** Only real contacts and paid landings count as progress, never launches. */
export function scorePegTake(events: TakeEvents): number {
  const durationDistance = Math.max(0, Math.abs(events.duration - TARGET_DURATION) - DURATION_TOLERANCE);
  return BASE_SCORE + events.leadChanges * LEAD_WEIGHT + events.finalCloseness * CLOSENESS_WEIGHT
    - durationDistance * DURATION_WEIGHT
    - Math.max(0, events.quietMax - QUIET_LIMIT) * QUIET_WEIGHT
    - (events.finished ? 0 : UNFINISHED_PENALTY);
}
