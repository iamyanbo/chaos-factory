import type { TakeEvents } from '../../kit/take-types';

/** Watchability only: the continuous course and finish use identical physics. */
export function scoreCascadeTake(events: TakeEvents): number {
  const distance = Math.max(0, 90 - events.duration, events.duration - 120);
  return 100 - distance * 5 + Math.min(10, events.leadChanges) * 8
    + events.finalCloseness * 40 + Math.min(100, events.passes) * 0.25
    - Math.max(0, events.quietMax - 6) * 7 - Math.max(0, 75 - events.duration) * 10
    - (events.finished ? 0 : 300);
}
