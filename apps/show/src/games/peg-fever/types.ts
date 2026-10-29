import type { Participant } from '@chaos/shared';
import type { RAPIER } from '../../engine/physics';
import type { NeonBall } from '../../kit/neon';

export type PegKind = 'blue' | 'orange' | 'gold';

export interface Peg {
  id: number;
  kind: PegKind;
  x: number;
  y: number;
  localX: number;
  localY: number;
  radius: number;
  claim?: number;
  litAt?: number;
  removed: boolean;
  collider?: RAPIER.Collider;
}

export interface Shot extends NeonBall {
  slot: number;
  body: RAPIER.RigidBody;
  active: boolean;
  landed: boolean;
  owner: number;
  player: Participant;
  life: number;
  combo: number;
  multiplier: number;
  points: number;
  firedAt: number;
}

export interface Landing {
  life: number;
  owner: number;
  run: number;
  slot: number;
  multiplier: number;
  total: number;
  ownerTotal: number;
  x: number;
  time: number;
}
