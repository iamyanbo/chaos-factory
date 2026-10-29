import type { HypeEvent } from './types';

/** Anonymous reaction times only: player, color, team and winner never enter. */
export function reactionSummary(events: readonly Pick<HypeEvent, 'kind' | 'time'>[], duration: number) {
  const finalThird = duration * 2 / 3;
  const jackpots = events.filter(event => event.kind === 'jackpot');
  const nearMisses = events.filter(event => event.kind === 'nearMiss');
  return { jackpots: jackpots.length, nearMisses: nearMisses.length,
    finalThirdJackpots: jackpots.filter(event => event.time >= finalThird).length,
    finalThirdNearMisses: nearMisses.filter(event => event.time >= finalThird).length };
}

export function reactionTakeBonus(events: { finalThirdJackpots?: number; finalThirdNearMisses?: number }): number {
  return (events.finalThirdJackpots ?? 0) * 28 + (events.finalThirdNearMisses ?? 0) * 8;
}
