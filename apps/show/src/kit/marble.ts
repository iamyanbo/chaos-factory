import { Graphics } from 'pixi.js';
import { TEAMS, type Participant } from '@chaos/shared';
import type { RAPIER } from '../engine/physics';
import type { GameContext } from '../games/contract';
import { updateMarbleView } from './marble-view';
export interface Marble {
  id: string; owner: Participant; team: string; color: number; radius: number; baseRadius:number; body: RAPIER.RigidBody;
  alive: boolean; score: number; finished: boolean; shield: number; heat: number; boost: number; x: number; y: number; prevX: number; prevY: number;
  isStreamer: boolean; dormant?:boolean;staged?:boolean;customView?:boolean;showLabel?:boolean;labelPriority?:number;labelSize?:number;view?: Graphics; trail: { x: number; y: number }[]; born: number;
}
export function spawnMarble(ctx: GameContext, owner: Participant, x: number, y: number, opts: { radius?: number; streamer?: boolean; team?: string } = {}): Marble {
  const radius = (opts.radius ?? 16) * (ctx.setup.modifiers.includes('tiny') ? .65 : ctx.setup.modifiers.includes('big-heads') ? 1.4 : 1);
  const team = opts.team ?? (opts.streamer ? 'streamer' : ctx.setup.mode==='faction' ? owner.teamId??'red' : 'chat');
  const color = opts.streamer ? 0xff5d9e : owner.golden ? 0xffd23f : ctx.setup.mode==='faction'&&owner.teamId ? TEAMS[owner.teamId].hex : 0x4db4ff;
  const body = ctx.physics.ball(x, y, radius, { entity: owner.userId, restitution: ctx.setup.modifiers.includes('bouncy') ? .95 : .7, friction: ctx.setup.modifiers.includes('ice') ? .001 : .15, density: (opts.streamer ? 3 : 1) * (ctx.setup.modifiers.includes('heavy') ? 2.5 : 1) });
  const view = ctx.headless ? undefined : new Graphics(); if (view) ctx.stage.world.addChild(view);
  return { id: owner.userId, owner, team, color, radius,baseRadius:radius, body, alive: true, score: 0, finished: false, shield: 0, heat: 0, boost: 0, x, y, prevX: x, prevY: y, isStreamer: !!opts.streamer, view, trail: [], born: 0 };
}
export function renderMarble(m: Marble, ctx: GameContext, time: number, alpha: number,preview=false): void {
  const g = m.view; if (!g) return; g.visible = m.alive&&!m.customView&&(!m.staged||preview);
  if (!g.visible) return;
  const x = m.prevX + (m.x - m.prevX) * alpha; const y = m.prevY + (m.y - m.prevY) * alpha;
  g.position.set(x, y);
  if(m.dormant){g.alpha=.55;g.scale.set(1);updateMarbleView(g,m,ctx.setup.mode==='faction',0,{x:0,y:0});return;}
  g.alpha=1;
  if (!m.trail.length || Math.hypot(m.trail[0].x-x,m.trail[0].y-y)>3) {m.trail.unshift({x,y});if(m.trail.length>8)m.trail.pop();}
  const v = m.body.linvel(); const speed = Math.hypot(v.x, v.y);
  const stretch = Math.min(.2, speed * .012); const appear = Math.min(1, (time - m.born) * 5);
  g.scale.set((1 + stretch) * appear, (1 - stretch * .4) * appear);
  updateMarbleView(g,m,ctx.setup.mode==='faction',time,v);
}
