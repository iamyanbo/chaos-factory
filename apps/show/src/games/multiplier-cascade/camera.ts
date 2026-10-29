import { COURSE, RELAY_TOP } from './course-layout';

const LOOK_AHEAD = 200;
const MAX_SPEED = 150;
const MAX_ACCELERATION = 180;
const RESPONSE = 2;
const START_Y = 540;
const BOTTOM_Y = RELAY_TOP + 540;
const POCKET_VIEW_Y = COURSE.bottom - COURSE.viewHeight / 2;

/** A downward-only display spring. It cannot change any ball or collider. */
export class CascadeCamera {
  y = START_Y;
  velocity = 0;
  targetY = START_Y;

  step(balls: readonly { y: number; alive: boolean }[], dt: number, finishOpen = true): number {
    const bottom = finishOpen ? BOTTOM_Y : POCKET_VIEW_Y;
    const front = balls.filter(ball => ball.alive).reduce((y, ball) => Math.max(y, ball.y), COURSE.top);
    this.targetY = Math.max(this.targetY, Math.min(bottom, Math.max(START_Y, front + LOOK_AHEAD)));
    const acceleration = RESPONSE ** 2 * (this.targetY - this.y) - 2 * RESPONSE * this.velocity;
    this.velocity = Math.max(0, Math.min(MAX_SPEED, this.velocity
      + Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, acceleration)) * dt));
    this.y = Math.min(bottom, this.y + this.velocity * dt);
    return this.y;
  }
}
