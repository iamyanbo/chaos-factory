import { TEAMS } from '@chaos/shared';
import type { GameContext } from '../contract';
import { PX } from '../../engine/physics';
import { rememberTrail, viewerColor } from '../../kit/neon';
import { BALL_BASE_POINTS, BALL_BOUNCE, BALL_RADIUS, BARREL_LENGTH, LAUNCH_ANGLE_JITTER, LAUNCH_SPEED, LAUNCH_Y,
  MAX_SHOTS, launcherAngle, launcherX } from './config';
import { playerTeam } from './state';
import type { Shot } from './types';

export class FlightPool {
  readonly shots: Shot[] = [];
  readonly phase: number;
  lastAngle = 0;
  lastLaunch = -Infinity;
  private life = 0;

  constructor(readonly ctx: GameContext) {
    this.phase = ctx.rng.range(-Math.PI, Math.PI);
  }

  launch(owner: number, time: number): Shot | undefined {
    let shot = this.shots.find(ball => !ball.active);
    const player = this.ctx.setup.participants[owner];
    if (!player || !shot && this.shots.length >= MAX_SHOTS) return undefined;
    const angle = launcherAngle(time, this.phase) + this.ctx.rng.range(-LAUNCH_ANGLE_JITTER, LAUNCH_ANGLE_JITTER);
    const x = launcherX(time, this.phase) + Math.sin(angle) * (BARREL_LENGTH + BALL_RADIUS);
    const y = LAUNCH_Y + Math.cos(angle) * (BARREL_LENGTH + BALL_RADIUS);
    if (!shot) {
      const slot = this.shots.length;
      const body = this.ctx.physics.ball(x, y, BALL_RADIUS,
        { restitution: BALL_BOUNCE, friction: 0, entity: `shot:${slot}` });
      body.setLinearDamping(0);
      body.setAngularDamping(0);
      shot = { id: `shot-${slot}`, slot, body, active: false, landed: false, owner, player, life: 0,
        name: player.displayName, x, y, prevX: x, prevY: y, radius: BALL_RADIUS,
        color: 0xffffff, combo: 0, multiplier: 1, points: 0, firedAt: time, trail: [] };
      this.shots.push(shot);
    }
    Object.assign(shot, { owner, player, active: true, alive: true, landed: false, life: ++this.life,
      profileId: player.userId, name: player.displayName, x, y, prevX: x, prevY: y,
      combo: 0, multiplier: 1, points: BALL_BASE_POINTS, firedAt: time, trail: [],
      color: this.ctx.setup.mode === 'faction' ? TEAMS[playerTeam(this.ctx, owner)].hex : viewerColor(player) });
    shot.body.setTranslation({ x: x / PX, y: y / PX }, true);
    shot.body.setEnabled(true);
    // This is the visible cannon's launch, never an in-flight correction.
    shot.body.setLinvel({ x: Math.sin(angle) * LAUNCH_SPEED / PX,
      y: Math.cos(angle) * LAUNCH_SPEED / PX }, true);
    shot.body.setAngvel(0, true);
    this.lastAngle = angle;
    this.lastLaunch = time;
    return shot;
  }

  before(): void {
    for (const shot of this.shots) if (shot.active) {
      shot.prevX = shot.x;
      shot.prevY = shot.y;
    }
  }

  sync(): void {
    for (const shot of this.shots) if (shot.active) {
      const point = this.ctx.physics.position(shot.body);
      shot.x = point.x;
      shot.y = point.y;
      if (!this.ctx.headless) rememberTrail(shot.trail!, shot.x, shot.y);
    }
  }

  release(shot: Shot): void {
    shot.active = false;
    shot.alive = false;
    shot.body.setEnabled(false);
    shot.trail = [];
  }

  destroy(): void {
    for (const shot of this.shots) this.ctx.physics.remove(shot.body);
  }
}
