import type { Participant } from '@chaos/shared';
import type { GameContext } from '../contract';
import { PX } from '../../engine/physics';
import { viewerColor } from '../../kit/neon';
import { BALL_RADIUS, BOSS_RADIUS, CENTER, GOLDEN_ANGLE, MAX_PARTICIPANTS,
  SMALL_FIELD_AT, SMALL_RADIUS, SPAWN_INNER, SPAWN_OUTER, START_SPEED } from './config';
import type { Potato } from './types';

export function createPotatoes(ctx: GameContext, boss: boolean): Potato[] {
  if (ctx.setup.participants.length > MAX_PARTICIPANTS) {
    throw new Error('Hot Potato admits at most 64 chatters');
  }
  const marbles: Potato[] = [];
  const radius = ctx.setup.participants.length > SMALL_FIELD_AT ? SMALL_RADIUS : BALL_RADIUS;
  const spawn = (owner: Participant, x: number, y: number, size: number, isStreamer: boolean) => {
    const ordinal = marbles.length;
    const body = ctx.physics.ball(x, y, size,
      { restitution: 1, friction: 0, entity: `potato:${ordinal}` });
    body.setLinearDamping(0);
    body.setAngularDamping(0);
    const angle = ctx.rng.range(0, Math.PI * 2);
    body.setLinvel({ x: Math.cos(angle) * START_SPEED / PX,
      y: Math.sin(angle) * START_SPEED / PX }, true);
    marbles.push({ id: owner.userId, ordinal, owner, name: owner.displayName,
      body, x, y, prevX: x, prevY: y, radius: size,
      color: isStreamer ? 0xff5ec4 : viewerColor(owner), alive: true,
      isStreamer, tags: 0, edgeDanger: false, trail: [] });
  };
  if (boss && ctx.setup.participants.length) {
    spawn({ userId: 'streamer', login: 'streamer', displayName: ctx.setup.streamerName,
      color: '#ff5ec4' }, CENTER.x, CENTER.y, BOSS_RADIUS, true);
  }
  const phase = ctx.rng.range(0, Math.PI * 2);
  ctx.setup.participants.forEach((owner, index) => {
    const angle = phase + index * GOLDEN_ANGLE;
    const distance = SPAWN_INNER + Math.sqrt((index + .5) / ctx.setup.participants.length)
      * (SPAWN_OUTER - SPAWN_INNER);
    spawn(owner, CENTER.x + Math.cos(angle) * distance,
      CENTER.y + Math.sin(angle) * distance, radius, false);
  });
  return marbles;
}

export function syncPotatoes(ctx: GameContext, marbles: Potato[]): void {
  for (const marble of marbles) {
    if (!marble.alive) continue;
    const point = ctx.physics.position(marble.body);
    marble.x = point.x;
    marble.y = point.y;
  }
}

export function leadingPotato(marbles: Potato[]): Potato | undefined {
  return marbles.filter(marble => marble.alive)
    .sort((a, b) => b.tags - a.tags || a.ordinal - b.ordinal)[0];
}
