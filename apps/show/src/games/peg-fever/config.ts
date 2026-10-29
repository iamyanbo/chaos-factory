export const CENTER = { x: 960, y: 480 };
export const LEFT = 484;
export const RIGHT = 1436;
export const TOP = 64;
export const BOTTOM = 1060;
export const WALL = 8;
export const PEG_RADIUS = 10;
export const BALL_RADIUS = 8.5;
export const GRAVITY = 320;
export const PEG_BOUNCE = .83;
export const BALL_BOUNCE = .85;
export const MAX_SHOTS = 36;
export const BALLS_PER_VIEWER = 3;
export const WAVE_SIZE = 4;
export const WAVE_SECONDS = 2.5;
export const SHOT_INTERVAL = .14;
export const LAUNCH_Y = 62;
export const LAUNCH_SPEED = 140;
export const BARREL_LENGTH = 30;
export const LAUNCH_SWEEP_WIDTH = 340;
export const LAUNCH_SWEEP_RATE = .7;
export const LAUNCH_AIM_RATE = .93;
export const LAUNCH_AIM_SWEEP = .24;
export const LAUNCH_ANGLE_JITTER = .1;
export const SLOT_TOP = 946;
export const SLOT_MULTIPLIERS = [1, 2, 3, 5, 10, 5, 3, 2, 1] as const;
export const SLOT_WIDTHS = [140, 125, 100, 85, 52, 85, 100, 125, 140] as const;
export const SUDDEN_AT = 150;
export const RACK_LIFT_SPEED = 180;
export const RACK_LIFT_DISTANCE = 1000;
export const BLUE_POINTS = 10;
export const BALL_BASE_POINTS = 100;
export const ORANGE_POINTS = 50;
export const GOLD_MULTIPLIER = 2;
export const FEVER_MULTIPLIER = 2;
export const HUD_TICKS = 6;
export const PEG_COLORS = { blue: 0x36baff, orange: 0xff952b, gold: 0xffd86b } as const;

export function launcherX(time: number, phase: number): number {
  return CENTER.x + Math.sin(time * LAUNCH_SWEEP_RATE + phase) * LAUNCH_SWEEP_WIDTH;
}

export function launcherAngle(time: number, phase: number): number {
  return Math.sin(time * LAUNCH_AIM_RATE + phase) * LAUNCH_AIM_SWEEP;
}

export const SLOTS = SLOT_WIDTHS.map((width, index) => {
  const left = LEFT + SLOT_WIDTHS.slice(0, index).reduce((sum, value) => sum + value, 0);
  return { left, right: left + width, center: left + width / 2,
    multiplier: SLOT_MULTIPLIERS[index] };
});

export function landingSlot(x: number): number {
  return Math.max(0, SLOTS.findIndex((slot, index) => x < slot.right || index === SLOTS.length - 1));
}
