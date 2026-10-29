import { TEAMS, TEAM_IDS, type Participant, type TeamId, type Vec2 } from '@chaos/shared';
import { RAPIER, PX } from '../../engine/physics';
import type { GameContext } from '../contract';
import { viewerColor } from '../../kit/neon';
import {
  CENTER, LARGE_BALL_LIMIT, LARGE_BALL_RADIUS, MAX_ENTRANTS, NEON,
  SMALL_BALL_RADIUS, SPAWN_CLEARANCE, START_SPEED
} from './config';

export interface Runner {
  id: string;
  ordinal: number;
  owner: Participant;
  team?: TeamId;
  body: RAPIER.RigidBody;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
  color: number;
  depth: number;
  arrivedAt: number;
  alive: boolean;
  isStreamer: boolean;
  finished: boolean;
  trail: Vec2[];
}

export function fieldRadius(count: number): number {
  return count <= LARGE_BALL_LIMIT ? LARGE_BALL_RADIUS : SMALL_BALL_RADIUS;
}

export function createRunners(ctx: GameContext, faction: boolean): Runner[] {
  if (ctx.setup.participants.length > MAX_ENTRANTS) {
    throw new Error('Ring Run+ admits at most 64 entrants');
  }
  const radius = fieldRadius(ctx.setup.participants.length);
  const teams = ctx.setup.teams?.length ? ctx.setup.teams : TEAM_IDS.slice(0, 2);
  return ctx.setup.participants.map((owner, ordinal) => {
    const angle = ordinal * Math.PI * (3 - Math.sqrt(5));
    const distance = Math.sqrt(ordinal + 0.5)
      * (radius * 2 + SPAWN_CLEARANCE) / Math.sqrt(Math.PI);
    const x = CENTER.x + Math.cos(angle) * distance;
    const y = CENTER.y + Math.sin(angle) * distance;
    const body = ctx.physics.ball(x, y, radius,
      { restitution: 1, friction: 0, entity: owner.userId });
    body.setLinearDamping(0);
    body.setAngularDamping(0);
    const heading = ctx.rng.range(0, Math.PI * 2);
    body.setLinvel({
      x: Math.cos(heading) * START_SPEED / PX,
      y: Math.sin(heading) * START_SPEED / PX
    }, true);
    const team = faction ? owner.teamId ?? teams[ordinal % teams.length] : undefined;
    return {
      id: owner.userId, ordinal, owner, team, body, x, y, prevX: x, prevY: y,
      radius, color: team ? TEAMS[team].hex : viewerColor(owner),
      depth: 0, arrivedAt: 0, alive: true, isStreamer: false, finished: false, trail: []
    };
  });
}

/** Stable order breaks an exact simultaneous arrival without consulting identity. */
export function deepestFirst(a: Runner, b: Runner): number {
  return b.depth - a.depth || a.arrivedAt - b.arrivedAt || a.ordinal - b.ordinal;
}
