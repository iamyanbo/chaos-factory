export const GRID_SIZE = 160;
export const ARENA_SIZE = 1080;
export const ARENA_LEFT = 420;
export const CELL_SIZE = ARENA_SIZE / GRID_SIZE;
export const MAX_PLAYERS = 32;
export const DEFAULT_PLAYERS = 24;
export const HEAD_RADIUS = 5;
export const TRAIL_WIDTH = 3;
export const WALL_WIDTH = 8;
export const BASE_SPEED = 8;
export const SPACE_SEARCH_LIMIT = 64;
export const SPEED_UP_AT = 40;
export const SPEED_UP_FACTOR = 1.3;
export const CLOSE_AT = 70;
export const CLOSE_SPEED = 1.75;
export const MAX_BORDER = 77;
export const ROUND_LIMIT = 150;
export const SUDDEN_CLOSE_SPEED = 3;
export const TURN_CHANCE = 0.04;
export const LOOK_AHEAD = 3;
export const FADE_SECONDS = 3;
export const SPAWN_PADDING = 12;
export const SPAWN_COLUMNS = 8;
export const SPAWN_ROWS = 4;
export const SPAWN_JITTER = 3;
export const TURN_TONE_INTERVAL = 0.12;
export const CRASH_SOUND_DAMAGE = 100;
export const CRASH_COLOR_SPARKS = 24;
export const CRASH_WHITE_SPARKS = 8;
export const HUD_REFRESH_TICKS = 6;
export const FEED_LENGTH = 6;
export const SIDEBAR_NAMES = 10;
// Paint fits inside one 6.75px cell so neighboring routes remain distinguishable.
export const TRAIL_PAINT_WIDTH = 4;
export const TRAIL_OUTLINE_WIDTH = .65;
export const TRAIL_SHADOW_DROP = 1;
export const ROUND_TARGET = 105;
export const TAKE_BASE_SCORE = 100;
export const TAKE_MIN_DURATION = 90;
export const TAKE_DURATION_WEIGHT = 20;
export const TAKE_QUIET_LIMIT = 20;
export const TAKE_QUIET_WEIGHT = 1;
export const TAKE_UNFINISHED_PENALTY = 500;
export const NAME_HIDE_DISTANCE = 48;
export const NAME_REVEAL_DISTANCE = 72;
export const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 }
] as const;

export function cellCenter(x: number, y: number): { x: number; y: number } {
  return { x: ARENA_LEFT + (x + 0.5) * CELL_SIZE, y: (y + 0.5) * CELL_SIZE };
}

export function borderAt(time: number): number {
  if (time >= ROUND_LIMIT) return MAX_BORDER + (time - ROUND_LIMIT) * SUDDEN_CLOSE_SPEED;
  return Math.min(MAX_BORDER, Math.max(0, time - CLOSE_AT) * CLOSE_SPEED);
}

export function speedAt(time: number): number {
  return BASE_SPEED * (time >= SPEED_UP_AT - 0.000001 ? SPEED_UP_FACTOR : 1);
}
