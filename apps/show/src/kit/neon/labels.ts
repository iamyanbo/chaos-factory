import type { NeonBall } from './balls';
import { ARENA } from './theme';

export interface LabelBox { x: number; y: number; width: number; height: number }
interface LabelBounds { circleRadius?: number; left?: number; right?: number; below?: boolean }

function overlap(a: LabelBox, b: LabelBox): number {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

/** Keep the name and its weapon counter together, close to their own ball. */
export function placeLabel(ball: NeonBall, alpha: number, width: number, height: number,
  centerY: number, actors: readonly NeonBall[], placed: LabelBox[], bounds: LabelBounds = {}): LabelBox {
  const x = ball.prevX + (ball.x - ball.prevX) * alpha;
  const y = ball.prevY + (ball.y - ball.prevY) * alpha;
  const r = ball.radius + 5;
  const candidates = (bounds.below ? [{ x: x - width / 2, y: y + r }] : [
    { x: x + r, y: y - r },
    { x: x - r - width, y: y - r },
    { x: x - width / 2, y: y - r - height },
    { x: x - width / 2, y: y + r }
  ]).map(point => ({
    x: Math.max((bounds.left ?? ARENA.left) + 16, Math.min((bounds.right ?? ARENA.right) - width - 16, point.x)),
    y: Math.max(centerY - 530, Math.min(centerY + 530 - height, point.y)), width, height
  }));
  const circleRadius = bounds.circleRadius;
  if (circleRadius) for (const box of candidates) {
    box.y = Math.max(centerY - circleRadius + 12,
      Math.min(centerY + circleRadius - height - 12, box.y));
    const vertical = Math.max(Math.abs(box.y - centerY), Math.abs(box.y + height - centerY));
    const span = Math.sqrt(Math.max(0, circleRadius ** 2 - vertical ** 2)) - 10;
    box.x = Math.max(960 - span, Math.min(960 + span - width, box.x));
  }
  const obstacles = actors.filter(other => other.alive !== false).map(other => ({
    x: other.prevX + (other.x - other.prevX) * alpha - other.radius - 2,
    y: other.prevY + (other.y - other.prevY) * alpha - other.radius - 2,
    width: other.radius * 2 + 4, height: other.radius * 2 + 4
  }));
  const cost = (box: LabelBox) => [...placed, ...obstacles].reduce((sum, other) => sum + overlap(box, other), 0);
  const best = candidates.reduce((best, next) => cost(next) < cost(best) ? next : best);
  placed.push(best);
  return best;
}
