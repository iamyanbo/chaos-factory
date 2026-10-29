import type { TeamId } from '@chaos/shared';
import type { TakeEvents } from '../../kit/take-types';
import type { Racer } from './types';

/** Missing finishes count as the place after the whole field, including short teams. */
export function factionStandings(racers: Racer[]) {
  const teams = [...new Set(racers.map(racer => racer.owner.teamId)
    .filter((team): team is TeamId => team !== undefined))];
  return teams.map(teamId => {
    const members = racers.filter(racer => racer.owner.teamId === teamId);
    const quota = Math.min(3, members.length);
    const places = members.map(racer => racer.place ?? racers.length + 1).sort((a, b) => a - b);
    const best = places.slice(0, quota);
    const average = best.reduce((sum, place) => sum + place, 0) / quota;
    const dnfs = best.filter(place => place > racers.length).length;
    return {
      teamId, score: -average, first: places[0], quota, dnfs,
      stat: `TOP ${quota} OF ${members.length} · AVG ${average.toFixed(2)}${dnfs ? ` · ${dnfs} DNF (${racers.length + 1})` : ''}`
    };
  }).sort((a, b) => b.score - a.score || a.first - b.first || a.teamId.localeCompare(b.teamId));
}

export function scoreRaceTake(events: TakeEvents): number {
  const durationPenalty = Math.max(0, 90 - events.duration, events.duration - 120) * 7
    + Math.max(0, 75 - events.duration) * 7;
  return 100 - durationPenalty + Math.min(12, events.leadChanges) * 7
    + events.finalCloseness * 40 + Math.min(50, events.passes) * 0.4
    - Math.max(0, events.quietMax - 6) * 8 - (events.finished ? 0 : 250);
}
