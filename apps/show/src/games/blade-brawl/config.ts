export const FIGHTER_RADIUS = 22;
export const BOSS_RADIUS = FIGHTER_RADIUS * 3;
export const START_HP = 100;
export const bossHpPerChatter = 55;
export function bossHp(viewers: number): number {
  return Math.round(bossHpPerChatter * viewers);
}
export const SPEED = 180;
export const ARENA_RADIUS = 500;
export const FINAL_RADIUS = 300;
export const SHRINK_START = 40;
export const SHRINK_END = 75;
export const SPIN_GROWTH = 1.01;
// This starts visible sudden death; it never declares a winner.
export const HARD_CAP = 150;
export const SUDDEN_DEATH_RADIUS = 120;
export const SUDDEN_DEATH_SHRINK_SECONDS = 12;
export const HIT_FLASH_SECONDS = 0.14;
export const HIT_KNOCKBACK = 320;
export const HAMMER_KNOCKBACK = 1000;
export const MAX_KNOCKBACK_RADII = 1.5;
export const PARRY_COOLDOWN = 0.3;
export const KILL_FREEZE_MS = 80;
export const KILL_FREEZE_COOLDOWN = 0.75;
export const BLADE_RADIUS_FRACTION = 0.45;
export const CONTACT_TRAVEL = 5;
export const MAX_CONTACT_SAMPLES = 12;
export const MAX_VIEWERS = 32;
export const STARTING_RADII = [230, 400] as const;
export const SEATS_PER_RING = 16;
// Equal translational mass keeps elastic contacts readable despite the Boss's
// larger hitbox. Radius, HP and the second weapon supply its visible advantage.
export const BOSS_DENSITY = 1 / 9;
