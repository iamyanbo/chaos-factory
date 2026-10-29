import type { Participant, Vec2 } from '@chaos/shared';
import type { RAPIER } from '../../engine/physics';

export interface Potato {
  id: string;
  ordinal: number;
  owner: Participant;
  name: string;
  body: RAPIER.RigidBody;
  radius: number;
  color: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  alive: boolean;
  isStreamer: boolean;
  tags: number;
  outAt?: number;
  blast?: Shockwave;
  blastAt?: number;
  edgeDanger: boolean;
  trail: Vec2[];
}

export interface Bomb {
  id: number;
  holder: number;
  remaining: number;
  duration: number;
  transferAt: number;
  beepAt: number;
  mega: boolean;
  shortened: boolean;
  passer?: number;
}

export interface Shockwave {
  id: number;
  x: number;
  y: number;
  at: number;
  radius: number;
  previousRadius: number;
  range: number;
  color: number;
  mega: boolean;
  attacker?: number;
  kills: number;
  hit: Set<number>;
}

export interface RimSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  active: boolean;
  collider: RAPIER.Collider;
}
