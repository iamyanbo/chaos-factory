import type { Participant } from "@chaos/shared";
import type { RAPIER } from "../../engine/physics";
import type { NeonBall } from "../../kit/neon";
import type { BossRage } from './rage';

export type WeaponKind = "Sword" | "Dagger" | "Spear" | "Hammer";
export interface Weapon {
  id: number;
  kind: WeaponKind;
  angle: number;
  previous: number;
  direction: number;
  spin: number;
  length: number;
  damage: number;
  knockback: number;
  hits: number;
}
export interface Fighter extends NeonBall {
  owner: Participant;
  body: RAPIER.RigidBody;
  group: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  isStreamer: boolean;
  weapons: Weapon[];
  trail: { x: number; y: number }[];
  knockbackLeft?: number;
  rage?: BossRage;
}
export interface WeaponPose {
  weapon: Weapon;
  owner: Fighter;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  angle: number;
  head: boolean;
}
export interface ContactMark {
  x: number;
  y: number;
  color: number;
  until: number;
  attacker: string;
  victim: string;
}
