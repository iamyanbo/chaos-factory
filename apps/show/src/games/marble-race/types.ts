import type { Participant, Vec2 } from '@chaos/shared';
import type { RAPIER } from '../../engine/physics';

export interface Racer {
  id: string;
  name: string;
  owner: Participant;
  team: string;
  body: RAPIER.RigidBody;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
  color: number;
  checkpoint: number;
  checkpointTimes: number[];
  alive: boolean;
  finished: boolean;
  place?: number;
  finishTime?: number;
  trail: Vec2[];
}
