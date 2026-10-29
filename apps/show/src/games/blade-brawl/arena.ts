import {
  ARENA_RADIUS,
  FINAL_RADIUS,
  SHRINK_END,
  SHRINK_START,
  SUDDEN_DEATH_RADIUS,
  SUDDEN_DEATH_SHRINK_SECONDS,
} from './config';

/** The same radius drives the drawn circle and its physical collider. */
export function arenaRadiusAt(time: number, suddenDeathAt?: number): number {
  const progress = Math.max(0, Math.min(1,
    (time - SHRINK_START) / (SHRINK_END - SHRINK_START),
  ));
  const normalRadius = ARENA_RADIUS + (FINAL_RADIUS - ARENA_RADIUS) * progress;
  if (suddenDeathAt === undefined) return normalRadius;
  const closing = Math.max(0, Math.min(1,
    (time - suddenDeathAt) / SUDDEN_DEATH_SHRINK_SECONDS,
  ));
  // 120 px still fits the 66 px Boss beside a 22 px fighter, plus wall skin.
  return Math.min(normalRadius,
    FINAL_RADIUS + (SUDDEN_DEATH_RADIUS - FINAL_RADIUS) * closing,
  );
}
