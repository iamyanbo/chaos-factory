import type { RoundStage } from './stages';
import type { RaceSummary } from './race-summary';

export interface ShowState {
  raceSummary?: RaceSummary;
  round: number;
  phaseTime: number;
  nextGameTitle?: string;
  stages: RoundStage[];
  stageIndex: number;
  elapsed: number;
  notifications: string[];
}
