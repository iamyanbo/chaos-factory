import {
  CAMERA_BOTTOM_Y,
  CAMERA_DEAD_ZONE,
  CAMERA_MAX_ACCELERATION,
  CAMERA_MAX_SPEED,
  CAMERA_LOOK_AHEAD,
  CAMERA_OMEGA,
  CAMERA_START_Y,
} from './config';

interface CameraRunner {
  y: number;
  alive: boolean;
  finished: boolean;
}

/** A display-only spring. It never writes to a runner or the physics world. */
export class RaceCamera {
  y = CAMERA_START_Y;
  velocity = 0;
  targetY = CAMERA_START_Y;

  step(runners: readonly CameraRunner[], dt: number): number {
    const active = runners.filter(runner => runner.alive && !runner.finished)
      .sort((a, b) => b.y - a.y);
    const focus = active[0];
    if (focus) {
      const candidate = Math.min(CAMERA_BOTTOM_Y,
        Math.max(CAMERA_START_Y, focus.y + CAMERA_LOOK_AHEAD));
      // Retain the furthest accepted target. Bounces and changes of leader
      // cannot pull the viewport upward or make it hunt around a threshold.
      if (candidate - this.targetY >= CAMERA_DEAD_ZONE) this.targetY = candidate;
    }

    const acceleration = CAMERA_OMEGA ** 2 * (this.targetY - this.y)
      - 2 * CAMERA_OMEGA * this.velocity;
    const bounded = Math.max(-CAMERA_MAX_ACCELERATION,
      Math.min(CAMERA_MAX_ACCELERATION, acceleration));
    this.velocity = Math.max(0, Math.min(CAMERA_MAX_SPEED, this.velocity + bounded * dt));
    this.y += this.velocity * dt;
    return this.y;
  }
}
