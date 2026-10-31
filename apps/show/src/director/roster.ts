import type { Participant } from '@chaos/shared';
import type { Director } from './director';

export function roundRoster(d: Director): Participant[] {
  if (d.game.spectator) return [];
  return d.participants.roster(d.capacityFor(), 0).map(member => ({
    ...member, teamId: d.mode === 'faction' ? member.teamId : undefined
  }));
}

export function audienceRoster(d: Director): Participant[] {
  return d.game.spectator ? d.participants.ordered().slice(0, 500) : roundRoster(d);
}

/** Explicit host choices run in order; an empty queue uses the enabled rotation. */
export function chooseGame(d: Director): void {
  const queued = d.queue.shift();
  const choices = d.games.filter(game => d.enabled.has(game.id));
  d.game = queued && d.registry.has(queued) ? d.registry.get(queued)!
    : d.rng.pick(choices.length ? choices : d.games);
  const preferred = d.modeOverride === 'faction' ? 'faction' : 'boss';
  d.format = d.game.formats?.includes(preferred) ? preferred : d.game.formats?.[0];
  d.mode = d.format === 'faction' ? 'faction' : 'cvs';
  d.competition = d.format === 'ffa' ? 'individual' : 'team';
}
