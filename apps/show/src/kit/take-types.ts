import type { RoundSetup } from '@chaos/shared';

/** Deliberately contains no player, team, color, wager or winner information. */
export interface TakeEvents {
  duration: number;
  finished: boolean;
  leadChanges: number;
  finalCloseness: number;
  quietMax: number;
  passes: number;
  pops?: number;
  entrants?: number;
  jackpots?: number;
  nearMisses?: number;
  finalThirdJackpots?: number;
  finalThirdNearMisses?: number;
}

export interface ScoredTake {
  seed: number;
  score: number;
  events: TakeEvents;
}

export interface BestTakeResult {
  requestedSeed: number;
  selectedSeed: number;
  candidates: ScoredTake[];
  elapsedMs: number;
  budgetMs: number;
  timedOut: boolean;
  reason?: string;
}

export interface TakeRequest {
  setup: RoundSetup;
  count: number;
}
