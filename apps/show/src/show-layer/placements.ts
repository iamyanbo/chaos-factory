import type { Participant, RoundResult } from '@chaos/shared';
import type { GameInstance } from '../games/contract';

/** Finish order, then live physical progress, then reverse elimination order. */
export function placementOrder(roster: Participant[], result: RoundResult,
  game: GameInstance | undefined, eliminated: readonly string[], finished: readonly string[]): string[] {
  const inspected = game?.inspect?.().marbles ?? [];
  const progress = game?.takeState?.() ?? [];
  const progressById = new Map(inspected.map((actor, index) => [actor.id, progress[index] ?? 0]));
  const alive = new Set(inspected.filter(actor => actor.alive).map(actor => actor.id));
  const placeTags = (id: string) => {
    const tag = result.perUser[id]?.tags.find(value => value.startsWith('place:'));
    return tag ? Number(tag.slice(6)) : Infinity;
  };
  const indices = new Map(roster.map((user, index) => [user.userId, index]));
  const finishRank = (id: string) => {
    if (result.champion?.userId === id) return 0;
    const index = finished.indexOf(id);
    return index >= 0 ? index + 1 : placeTags(id);
  };
  return roster.map(user => user.userId).sort((a, b) => {
    const finish = finishRank(a) - finishRank(b);
    if (Number.isFinite(finish) && finish) return finish;
    if (Number.isFinite(finishRank(a)) !== Number.isFinite(finishRank(b))) return Number.isFinite(finishRank(a)) ? -1 : 1;
    const living = Number(alive.has(b)) - Number(alive.has(a));
    if (living) return living;
    const distance = (progressById.get(b) ?? 0) - (progressById.get(a) ?? 0);
    if (distance) return distance;
    const death = eliminated.lastIndexOf(b) - eliminated.lastIndexOf(a);
    if (death) return death;
    return (result.perUser[b]?.score ?? 0) - (result.perUser[a]?.score ?? 0)
      || indices.get(a)! - indices.get(b)!;
  });
}

export function placementPoints(place: number, entrants: number): number {
  if (place === 1) return 10;
  if (place === 2) return 7;
  if (place === 3) return 5;
  if (place <= Math.ceil(entrants / 4)) return 3;
  return 1;
}
