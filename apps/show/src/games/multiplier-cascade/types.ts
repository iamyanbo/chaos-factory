import type { TeamId } from '@chaos/shared';
import type { Marble } from '../../kit/marble';

export interface Unit { marble: Marble; stage: number; root: string; lineage: number }
export interface PocketHit { id: string; slot: number }
export interface Stall { wave: number; team: string; stage: number; x: number; y: number }
export interface Banking {
  wave: number;
  team: TeamId;
  id: string;
  slot: number;
  value: number;
  time: number;
}
export interface Split {
  wave: number;
  team: TeamId;
  id: string;
  stage: number;
  factor: number;
  requested: number;
  time: number;
}
export interface DropResult {
  wave: number;
  points: Record<string, number>;
  totals: Record<string, number>;
  leaders: TeamId[];
  born: number;
  banked: number;
  lost: number;
  expired: number;
}
