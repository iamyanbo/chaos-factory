import type { GameInstance } from '../games/contract';

export interface RaceSummary {
  finished: number;
  total: number;
  podium: { id: string; name: string; place: number; time: number }[];
}

export function readRaceSummary(game: GameInstance | undefined): RaceSummary | undefined {
  const details = game?.inspect?.().details;
  if (typeof details?.finished !== 'number' || typeof details.total !== 'number') return;
  const podium = Array.isArray(details.podium) ? details.podium.filter(row =>
    row && typeof row.id === 'string' && typeof row.name === 'string'
    && typeof row.place === 'number' && typeof row.time === 'number') : [];
  return { finished: details.finished, total: details.total, podium };
}
