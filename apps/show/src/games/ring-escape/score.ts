import type { TakeEvents } from '../../kit/take-types';

const MIN_DURATION = 90;
const MAX_DURATION = 90;
const SHORT_ROUND_THRESHOLD = 75;
const SHORT_ROUND_WEIGHT = 12;
const MAX_QUIET = 6;
const DURATION_WEIGHT = 8;
const LEAD_WEIGHT = 8;
const CLOSENESS_WEIGHT = 35;
const QUIET_WEIGHT = 6;
const UNFINISHED_PENALTY = 300;
const POP_LIMIT = 0.25;
const POP_WEIGHT = 1200;
const POP_FAILURE_PENALTY = 2000;

/** Selection rewards watchability only. No outcome data reaches this function. */
export function scoreRingTake(events: TakeEvents): number {
  const distance = Math.max(0, MIN_DURATION - events.duration, events.duration - MAX_DURATION);
  const duration = 100 - distance * DURATION_WEIGHT;
  const reversals = Math.min(8, events.leadChanges) * LEAD_WEIGHT;
  const closeness = events.finalCloseness * CLOSENESS_WEIGHT;
  const quiet = Math.max(0, events.quietMax - MAX_QUIET) * QUIET_WEIGHT;
  const short = Math.max(0, SHORT_ROUND_THRESHOLD - events.duration) * SHORT_ROUND_WEIGHT;
  const popFraction = (events.pops ?? 0) / Math.max(1, events.entrants ?? 1);
  const pops = popFraction >= POP_LIMIT
    ? POP_FAILURE_PENALTY + (popFraction - POP_LIMIT) * POP_WEIGHT : 0;
  return duration + reversals + closeness - quiet - short - pops
    - (events.finished ? 0 : UNFINISHED_PENALTY);
}
