import { Container, Graphics, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';
import type { GameContext } from '../contract';
import { NeonSparks, WHITE, type NeonBall } from '../../kit/neon';
import {
  ARENA_LEFT, ARENA_SIZE, CELL_SIZE, CRASH_COLOR_SPARKS, CRASH_WHITE_SPARKS,
  FADE_SECONDS, GRID_SIZE, NAME_HIDE_DISTANCE, NAME_REVEAL_DISTANCE,
  WALL_WIDTH, cellCenter,
  TRAIL_PAINT_WIDTH, TRAIL_OUTLINE_WIDTH, TRAIL_SHADOW_DROP
} from './config';
import type { LightModel } from './model';
import { TOY, toyColor, shade, worldPixels } from '../../kit/theme';
import { CycleArrows } from './arrows';
import { trailTexture, TURN_RADIUS } from './trail-texture';

interface TrailView {
  container: ParticleContainer; outline: ParticleContainer; shadow: ParticleContainer; points: number;
  last?: Particle[];
  start?: { x: number; y: number };
}

/** Permanent trail quads are batched; old segments are never re-tessellated. */
export class LightView {
  private paths = new Container();
  private tips = new Graphics();
  private shutters = new Graphics();
  private border = new Graphics();
  private heads: CycleArrows;
  private sparks: NeonSparks;
  private trails = new Map<number, TrailView>();
  private names = new Set<string>();
  private coreTexture = trailTexture(worldPixels(TRAIL_PAINT_WIDTH));
  private edgeTexture = trailTexture(worldPixels(TRAIL_PAINT_WIDTH + TRAIL_OUTLINE_WIDTH * 2));

  constructor(ctx: GameContext) {
    ctx.stage.world.addChild(this.paths, this.tips, this.shutters, this.border);
    this.heads = new CycleArrows(ctx);
    this.sparks = new NeonSparks(ctx);
  }

  private trail(ordinal: number): TrailView {
    let view = this.trails.get(ordinal);
    if (view) return view;
    const make = (texture: Texture) => {
      const result = new ParticleContainer({ texture,
        dynamicProperties: { position: false, rotation: false, vertex: false, uvs: false, color: false } });
      result.boundsArea = new Rectangle(ARENA_LEFT, 0, ARENA_SIZE, ARENA_SIZE);
      return result;
    };
    const container = make(this.coreTexture.straight);
    const outline = make(this.edgeTexture.straight);
    const shadow = make(this.edgeTexture.straight);
    this.paths.addChild(shadow, outline, container);
    view = { container, outline, shadow, points: 1 };
    this.trails.set(ordinal, view);
    return view;
  }

  render(model: LightModel, actors: NeonBall[], alpha: number): void {
    this.tips.clear();
    for (const cycle of model.cycles) {
      if (cycle.cleared) {
        const removed = this.trails.get(cycle.ordinal);
        removed?.container.destroy();
        removed?.outline.destroy();
        removed?.shadow.destroy();
        this.trails.delete(cycle.ordinal);
        continue;
      }
      const view = this.trail(cycle.ordinal);
      const color = toyColor(actors[cycle.ordinal].color);
      while (view.points < cycle.cells.length) {
        const before = cycle.cells[view.points - 1];
        const after = cycle.cells[view.points++];
        const a = cellCenter(before % GRID_SIZE, Math.floor(before / GRID_SIZE));
        const b = cellCenter(after % GRID_SIZE, Math.floor(after / GRID_SIZE));
        const previous = cycle.cells[view.points - 3];
        const p = previous === undefined ? a : cellCenter(previous % GRID_SIZE, Math.floor(previous / GRID_SIZE));
        const incoming = { x: Math.sign(a.x - p.x), y: Math.sign(a.y - p.y) };
        const outgoing = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
        const bend = Math.sign(incoming.x * outgoing.y - incoming.y * outgoing.x);
        const start = { x: a.x + outgoing.x * TURN_RADIUS * Math.abs(bend),
          y: a.y + outgoing.y * TURN_RADIUS * Math.abs(bend) };
        const next: Particle[] = [];
        const layers = [
          [view.shadow, shade(color, .65), worldPixels(TRAIL_SHADOW_DROP), this.edgeTexture],
          [view.outline, TOY.color.ink, 0, this.edgeTexture],
          [view.container, color, 0, this.coreTexture],
        ] as const;
        for (const [index, [target, tint, shadowY, paint]] of layers.entries()) {
          if (bend && view.last && view.start) {
            const end = { x: a.x - incoming.x * TURN_RADIUS, y: a.y - incoming.y * TURN_RADIUS };
            const last = view.last[index];
            last.x = (view.start.x + end.x) / 2;
            last.y = (view.start.y + end.y) / 2 + shadowY;
            last.scaleX = (Math.hypot(end.x - view.start.x, end.y - view.start.y) + paint.width) / paint.straight.width;
            target.addParticle(new Particle({ texture: paint.turn, anchorX: .5, anchorY: .5,
              x: a.x - incoming.x * TURN_RADIUS / 2 + outgoing.x * TURN_RADIUS / 2,
              y: a.y - incoming.y * TURN_RADIUS / 2 + outgoing.y * TURN_RADIUS / 2 + shadowY,
              scaleX: (TURN_RADIUS + paint.width) / paint.turn.width,
              scaleY: bend * (TURN_RADIUS + paint.width) / paint.turn.height,
              rotation: Math.atan2(incoming.y, incoming.x), tint }));
          }
          const particle = new Particle({ texture: paint.straight,
            x: (start.x + b.x) / 2, y: (start.y + b.y) / 2 + shadowY, anchorX: .5, anchorY: .5,
            scaleX: (Math.hypot(b.x - start.x, b.y - start.y) + paint.width) / paint.straight.width,
            scaleY: paint.width / paint.straight.height,
            rotation: Math.atan2(outgoing.y, outgoing.x), tint });
          target.addParticle(particle);
          next.push(particle);
        }
        view.last = next;
        view.start = start;
      }
      const fade = cycle.alive ? 1 : Math.max(0, 1 - (model.time - cycle.diedAt!) / FADE_SECONDS);
      view.container.alpha = fade;
      view.outline.alpha = view.shadow.alpha = fade;
      const cell = cycle.cells[cycle.cells.length - 1];
      const origin = cellCenter(cell % GRID_SIZE, Math.floor(cell / GRID_SIZE));
      const x = cycle.prevX + (cycle.x - cycle.prevX) * alpha;
      const y = cycle.prevY + (cycle.y - cycle.prevY) * alpha;
      this.tips.moveTo(origin.x, origin.y).lineTo(x, y)
        .stroke({ width: worldPixels(TRAIL_PAINT_WIDTH), color, alpha: fade, cap: 'round', join: 'round' });
    }
    // The inner face is the exact wall used by TrailGrid, not a rounded shortcut.
    const inset = model.grid.border * CELL_SIZE + WALL_WIDTH;
    this.shutters.clear()
      .rect(ARENA_LEFT, 0, ARENA_SIZE, inset)
      .rect(ARENA_LEFT, ARENA_SIZE - inset, ARENA_SIZE, inset)
      .rect(ARENA_LEFT, 0, inset, ARENA_SIZE)
      .rect(ARENA_LEFT + ARENA_SIZE - inset, 0, inset, ARENA_SIZE).fill(TOY.color.rimShadow);
    const halfWall = WALL_WIDTH / 2;
    this.border.clear().rect(ARENA_LEFT + inset - halfWall, inset - halfWall,
      ARENA_SIZE - inset * 2 + WALL_WIDTH, ARENA_SIZE - inset * 2 + WALL_WIDTH)
      .stroke({ width: WALL_WIDTH, color: TOY.color.white, join: 'miter' });
    const finalists = actors.filter(actor => actor.alive).length <= 3;
    this.heads.render(model, actors.map(actor => {
      const threshold = this.names.has(actor.id) ? NAME_HIDE_DISTANCE : NAME_REVEAL_DISTANCE;
      const crowded = actors.some(other => other !== actor && other.alive
        && Math.hypot(actor.x - other.x, actor.y - other.y) < threshold);
      const leader = finalists && actor.alive !== false;
      const visible = !crowded || leader;
      if (visible) this.names.add(actor.id);
      else this.names.delete(actor.id);
      return { ...actor, leader, hideName: !visible };
    }), alpha);
    this.sparks.render(model.time);
  }

  crash(x: number, y: number, color: number, time: number): void {
    this.sparks.burst(x, y, color, time, CRASH_COLOR_SPARKS);
    this.sparks.burst(x, y, WHITE, time, CRASH_WHITE_SPARKS);
  }

  destroy(): void {
    this.paths.destroy({ children: true });
    this.tips.destroy();
    this.shutters.destroy();
    this.border.destroy();
    this.heads.destroy();
    this.sparks.destroy();
    this.trails.clear();
    this.coreTexture.destroy();
    this.edgeTexture.destroy();
    this.names.clear();
  }
}
