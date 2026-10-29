import type { Vec2 } from '@chaos/shared';
import { TRAIL_LENGTH } from './theme';

// Compatibility for existing plugins; all ball artwork now belongs to the Toy kit.
export { ToyBalls as NeonBalls } from '../theme/balls';
export type { ToyBall as NeonBall } from '../theme/balls';

export function rememberTrail(trail: Vec2[], x: number, y: number): void {
  trail.push({ x, y });
  if (trail.length > TRAIL_LENGTH) trail.shift();
}
