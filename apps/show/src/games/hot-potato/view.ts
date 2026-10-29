import { Container, Graphics } from 'pixi.js';
import type { GameContext } from '../contract';
import { INK, NeonBalls, NeonSparks, strokeArc, strokeLine, WHITE } from '../../kit/neon';
import { BLAST_FADE_SECONDS, BLAST_SPEED, BOMB_COLOR, CLUTCH_SECONDS, FUSE_RING_PAD,
  MEGA_COLOR, SPARK_RADIUS, STROKE } from './config';
import type { HotPotato } from './index';
import type { Bomb, Potato, RimSegment } from './types';
import { TOY, toyColor, rimArc, arenaFloor } from '../../kit/theme';
import { ARENA_RADIUS, CENTER } from './config';

const TRANSFER_SECONDS = .28;
const URGENT_SECONDS = 2;
const URGENT_PULSE_RATE = 15;

export class PotatoView {
  private rim = new Graphics();
  private rimShadow = new Graphics();
  private plate = new Container();
  private bombs = new Graphics();
  private waves = new Graphics();
  private actors: NeonBalls;
  private sparks: NeonSparks;
  private rimCount = -1;
  private transfers: { from: Potato; to: Potato; at: number }[] = [];

  constructor(private ctx: GameContext) {
    ctx.stage.world.addChild(this.rimShadow, this.plate, this.rim);
    arenaFloor(this.plate, 'circle', CENTER.x - ARENA_RADIUS, CENTER.y - ARENA_RADIUS,
      ARENA_RADIUS * 2, ARENA_RADIUS * 2, false);
    this.actors = new NeonBalls(ctx);
    ctx.stage.world.addChild(this.bombs, this.waves);
    this.sparks = new NeonSparks(ctx);
  }

  breakRim(segments: RimSegment[], time: number): void {
    for (const segment of segments) this.sparks.burst((segment.ax + segment.bx) / 2,
      (segment.ay + segment.by) / 2, WHITE, time, 5);
  }

  explosion(holder: Potato, bomb: Bomb, time: number): void {
    this.sparks.burst(holder.x, holder.y, holder.color, time, bomb.mega ? 70 : 40);
    this.ctx.camera.shakePixels(bomb.mega ? 7 : 4);
    this.ctx.fx.flash(bomb.mega ? MEGA_COLOR : BOMB_COLOR);
    this.ctx.audio.play('explosion', bomb.mega ? 0 : 1);
  }

  ringOut(marble: Potato, time: number): void {
    this.sparks.burst(marble.x, marble.y, marble.color, time, 22);
  }

  tag(a: Potato, b: Potato, time: number): void {
    this.sparks.burst((a.x + b.x) / 2, (a.y + b.y) / 2, BOMB_COLOR, time, 6);
    this.transfers.push({ from: a, to: b, at: time });
  }

  render(game: HotPotato, alpha: number): void {
    const active = game.arena.segments.filter(segment => segment.active);
    if (this.rimCount !== active.length) {
      this.rimCount = active.length;
      this.rim.clear();
      this.rimShadow.clear();
      if (active.length === game.arena.segments.length) {
        rimArc(this.rim, CENTER.x, CENTER.y, ARENA_RADIUS, 0, Math.PI * 2, this.rimShadow);
      } else {
        let start = -1;
        const segments = game.arena.segments;
        for (let index = 0; index <= segments.length; index++) {
          if (segments[index]?.active && start < 0) start = index;
          if ((!segments[index]?.active || index === segments.length) && start >= 0) {
            const angle = Math.atan2(segments[start].ay - CENTER.y, segments[start].ax - CENTER.x);
            rimArc(this.rim, CENTER.x, CENTER.y, ARENA_RADIUS, angle,
              angle + (index - start) * Math.PI * 2 / segments.length, this.rimShadow);
            start = -1;
          }
        }
      }
    }
    const top = new Set([...game.marbles].filter(marble => marble.alive)
      .sort((a, b) => b.tags - a.tags || a.ordinal - b.ordinal).slice(0, 8));
    this.actors.render(game.marbles.map(marble => ({ ...marble, leader: top.has(marble) })), alpha, game.time);
    const g = this.bombs.clear();
    this.transfers = this.transfers.filter(transfer => game.time - transfer.at < TRANSFER_SECONDS);
    for (const transfer of this.transfers) {
      const fade = 1 - (game.time - transfer.at) / TRANSFER_SECONDS;
      const { from, to } = transfer;
      g.moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: TOY.color.orange, width: 4, alpha: fade, cap: 'round' });
    }
    for (const bomb of game.bombs.active) {
      const holder = game.marbles[bomb.holder];
      if (!holder.alive) continue;
      const x = holder.prevX + (holder.x - holder.prevX) * alpha;
      const y = holder.prevY + (holder.y - holder.prevY) * alpha;
      const radius = Math.max(holder.radius, TOY.ball.radius / TOY.layout.worldScale) + FUSE_RING_PAD;
      const fraction = Math.max(0, bomb.remaining / bomb.duration);
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * fraction;
      const color = bomb.mega ? TOY.color.yellow : bomb.remaining < CLUTCH_SECONDS
        ? TOY.color.accentB : TOY.color.orange;
      if (bomb.remaining <= URGENT_SECONDS) {
        const pulse = .5 + .5 * Math.sin(game.time * URGENT_PULSE_RATE);
        g.circle(x, y, radius + 5 + pulse * 5).fill({ color: TOY.color.accentB, alpha: .08 + pulse * .1 });
      }
      g.circle(x, y, radius).stroke({ color: TOY.color.ink, width: 9 });
      g.moveTo(x, y - radius).arc(x, y, radius, start, end)
        .stroke({ color, width: 5, cap: 'round' });
      const sx = x + Math.cos(end) * radius;
      const sy = y + Math.sin(end) * radius;
      g.circle(sx, sy, SPARK_RADIUS * 2).fill(TOY.color.yellow)
        .stroke({ color: TOY.color.ink, width: 3 });
      const icon = Math.max(9, holder.radius * (bomb.mega ? .62 : .48));
      const bx = x + radius * .65;
      const by = y - radius * .65;
      g.circle(bx, by, icon).fill(TOY.color.ink).stroke({ color: TOY.color.white, width: 4 });
      if (game.sudden) {
        for (const offset of [-.18, .18]) g.circle(x + Math.cos(end + offset) * radius,
          y + Math.sin(end + offset) * radius, SPARK_RADIUS * .6).fill(TOY.color.yellow);
      }
    }
    const waves = this.waves.clear();
    for (const wave of game.waves.active) {
      const fade = Math.max(0, Math.min(1,
        1 - (game.time - wave.at - wave.range / BLAST_SPEED) / BLAST_FADE_SECONDS));
      waves.circle(wave.x, wave.y, wave.radius)
        .fill({ color: toyColor(wave.color), alpha: fade * .1 })
        .stroke({ color: toyColor(wave.color), width: wave.mega ? 9 : 6, alpha: fade * .85 });
    }
    this.sparks.render(game.time);
  }

  destroy(): void {
    this.rim.destroy();
    this.rimShadow.destroy();
    this.plate.destroy({ children: true });
    this.bombs.destroy();
    this.waves.destroy();
    this.actors.destroy();
    this.sparks.destroy();
  }
}
