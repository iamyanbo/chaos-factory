import { ARENA, PALETTE, STROKE } from "../../kit/neon";
import type { TeamId } from "@chaos/shared";

export const GRID_SIZE = 20;
export const TILE_COUNT = GRID_SIZE * GRID_SIZE;
export const TILE_SIZE = ARENA.size / GRID_SIZE;
export const TILE_GAP = 2;
export const BALL_RADIUS = 12;
export const BALL_SPEED = 300;
export const INITIAL_BALLS = 4;
export const REINFORCEMENTS = [30, 45] as const;
export const SPRINT_AT = 80;
export const SPRINT_FACTOR = 1.4;
export const ROUND_SECONDS = 90;
export const MAX_BALLS_PER_TEAM = 8;
export const SPLIT_FAN_ANGLE = Math.PI / 4;
export const SPECIAL_ORBITS = { split: 4, bomb: 2, wall: 2 } as const;
export const COMEBACK_AT = 45;
export const COMEBACK_INTERVAL = 15;
export const SHOCKWAVE_SECONDS = 0.55;
export const WALL_OWNER = -2;
export const TICK_SECONDS = 1 / 60;
export const POP_SECONDS = 0.24;
export const TILE_ALPHA = 0.22;
export const NEUTRAL_ALPHA = 0.32;
export const POP_ALPHA = 0.55;
export const POP_INSET = 3;
export const POP_OUTLINE_ALPHA = 0.65;
export const POP_OUTLINE_WIDTH = 1.5;
export const FLIP_FLASH_SECONDS = 0.06;
export const BIRTH_FLASH_SECONDS = 0.2;
export const FLIP_SPARKS = 4;
export const BIRTH_SPARKS = 18;
export const HUD_REFRESH_TICKS = 6;
export const LEADER_FLASH_SECONDS = 5;
export const LEADER_FLASH_HZ = 5;
export const SPAWN_ATTEMPTS = 16;
export const SPAWN_CLEARANCE_RADII = 3;
export const MAX_SUPPORTERS = 256;
export const DEFAULT_SUPPORTERS = 24;
export const TAKE_BASE_SCORE = 100;
export const TAKE_LEAD_WEIGHT = 6;
export const TAKE_CLOSENESS_WEIGHT = 30;
export const TAKE_QUIET_LIMIT = 6;
export const TAKE_QUIET_WEIGHT = 6;
export const TAKE_DURATION_WEIGHT = 4;
export const WALL_SKIN = STROKE;
export const CONTACT_EPSILON = 0.000001;
export const MAX_CONTACTS_PER_STEP = 12;
export const TEAM_COLORS: Record<TeamId, number> = {
  red: PALETTE[6],
  blue: PALETTE[1],
  mint: PALETTE[5],
  gold: PALETTE[7],
  violet: PALETTE[0],
  orange: PALETTE[4],
};
