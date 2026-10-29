import type { TeamId } from "@chaos/shared";
import type { NeonBall } from "../../kit/neon";

export interface PongBall extends NeonBall {
  team: TeamId;
  ordinal: number;
  slot: number;
  vx: number;
  vy: number;
  alive: boolean;
  isStreamer: false;
  flips: number;
  trail: { x: number; y: number }[];
}

export interface Contact {
  time: number;
  nx: number;
  ny: number;
  tile: number;
}

export interface MotionHooks {
  contact(ball: PongBall, tile: number, x: number, y: number, flips?: number): void;
}
