import type { CupStanding, RoundAward } from '@chaos/shared';
import type { RoundStage } from './stages';
import type { RaceSummary } from './race-summary';

export interface ShowState {
  raceSummary?: RaceSummary;
  round: number;
  rounds: number;
  phaseTime: number;
  grandFinal: boolean;
  standings: CupStanding[];
  podium: RoundAward[];
  roundAwards?: readonly RoundAward[];
  qualified: string[];
  championId?: string;
  crownName?: string;
  lastWinner?: string;
  nextGameTitle?: string;
  question: string;
  stages: RoundStage[];
  stageIndex: number;
  elapsed: number;
  notifications: string[];
}
