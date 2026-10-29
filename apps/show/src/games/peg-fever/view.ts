import { Container, Graphics, Text } from 'pixi.js';
import type { GameContext } from '../contract';
import { NeonBalls, NeonSparks, STROKE, WHITE, type NeonBall } from '../../kit/neon';
import { ranking } from './state';
import { LandingPayoffs } from './payoffs';
import { BARREL_LENGTH, BOTTOM, CENTER, FEVER_MULTIPLIER, LAUNCH_SWEEP_WIDTH,
  LAUNCH_Y, LEFT, PEG_COLORS, RIGHT, SLOTS, SLOT_TOP, TOP,
  launcherAngle, launcherX } from './config';
import type { PegFever } from './index';
import type { Landing, Peg, Shot } from './types';
import { peg as toyPeg, wall, TOY } from '../../kit/theme';

interface PegSprite { view: Graphics; lit: boolean }

export class PegView {
  private frame = new Graphics();
  private pegRoot = new Container();
  private machines = new Graphics();
  private slotLabels: Text[] = [];
  private pegs: PegSprite[] = [];
  private actors: NeonBalls;
  private sparks: NeonSparks;
  private payoffs: LandingPayoffs;
  private pooled: NeonBall[] = [];
  private previousWall = performance.now();
  private endingAge = 0;

  constructor(private ctx: GameContext) {
    ctx.stage.world.addChild(this.frame, this.pegRoot, this.machines);
    this.actors = new NeonBalls(ctx);
    this.sparks = new NeonSparks(ctx);
    this.payoffs = new LandingPayoffs(ctx);
    for (const slot of SLOTS) {
      const label = new Text({ text: `×${slot.multiplier}`,
        style: { fontFamily: TOY.font.display, fontSize: slot.multiplier === 10 ? 26 : 32,
          fill: TOY.color.ink } });
      label.anchor.set(.5);
      label.position.set(slot.center, 1020);
      ctx.stage.world.addChild(label);
      this.slotLabels.push(label);
    }
  }

  hit(peg: Peg, time: number): void {
    this.sparks.burst(peg.x, peg.y, PEG_COLORS[peg.kind], time, 4);
  }

  clear(pegs: Peg[], color: number, time: number): void {
    for (const peg of pegs) this.sparks.burst(peg.x, peg.y, PEG_COLORS[peg.kind], time, 7);
    if (pegs.length >= 8) this.sparks.burst(CENTER.x, 920, color, time, 20);
  }

  land(shot: Shot, landing: Landing): void {
    this.payoffs.add(shot, landing);
    this.sparks.burst(shot.x, BOTTOM - 16, shot.color, landing.time, landing.slot === 4 ? 35 : 14);
  }

  fever(x: number, y: number, time: number): void {
    this.sparks.burst(x, y, PEG_COLORS.gold, time, 60);
  }

  render(game: PegFever, alpha: number): void {
    const { board, flights, scoring, time } = game;
    const wallClock = performance.now();
    if (game.status() !== 'playing') this.endingAge += Math.min(.1, (wallClock - this.previousWall) / 1000);
    this.previousWall = wallClock;
    for (const peg of board.pegs) {
      let sprite = this.pegs[peg.id];
      const lit = peg.claim !== undefined;
      if (!sprite) {
        const view = new Graphics();
        this.pegRoot.addChild(view);
        sprite = { view, lit: !lit };
        this.pegs[peg.id] = sprite;
      }
      sprite.view.visible = !peg.removed;
      if (peg.removed) continue;
      if (sprite.lit !== lit) {
        sprite.lit = lit;
        const color = peg.kind === 'gold' ? TOY.color.yellow
          : peg.kind === 'orange' ? TOY.color.orange : TOY.color.accentA;
        toyPeg(sprite.view.clear(), 0, 0, peg.radius, lit ? TOY.color.white : color);
        if (peg.kind === 'gold') {
          const points = Array.from({ length: 10 }, (_, index) => {
            const angle = index * Math.PI / 5 - Math.PI / 2;
            const radius = index % 2 ? 3 : 7;
            return [Math.cos(angle) * radius, Math.sin(angle) * radius];
          }).flat();
          sprite.view.poly(points).fill(TOY.color.ink);
        }
      }
      sprite.view.position.set(peg.x, peg.y);
      sprite.view.alpha = 1;
    }
    const g = this.machines.clear();
    const x = launcherX(time, flights.phase);
    const angle = time - flights.lastLaunch < .18 ? flights.lastAngle : launcherAngle(time, flights.phase);
    wall(g, CENTER.x - LAUNCH_SWEEP_WIDTH, LAUNCH_Y, CENTER.x + LAUNCH_SWEEP_WIDTH,
      LAUNCH_Y, TOY.color.pale);
    toyPeg(g, x, LAUNCH_Y, 16, TOY.color.accentA);
    wall(g, x, LAUNCH_Y, x + Math.sin(angle) * BARREL_LENGTH,
      LAUNCH_Y + Math.cos(angle) * BARREL_LENGTH);
    for (const slot of SLOTS) {
      const color = game.fever || slot.multiplier === 10 ? TOY.color.yellow
        : slot.multiplier >= 5 ? TOY.color.green : TOY.color.pale;
      g.rect(slot.left + 8, SLOT_TOP + 4, slot.right - slot.left - 16,
        BOTTOM - SLOT_TOP - 4).fill({ color, alpha: .8 });
    }
    for (const slot of SLOTS.slice(0, -1)) {
      wall(g, slot.right, SLOT_TOP, slot.right, BOTTOM, game.fever ? TOY.color.yellow : TOY.color.white);
    }
    this.slotLabels.forEach((label, index) => {
      label.text = `×${SLOTS[index].multiplier * (game.fever ? FEVER_MULTIPLIER : 1)}`;
      label.style.fill = TOY.color.ink;
      label.scale.set(1);
      label.scale.set(Math.min(1, (SLOTS[index].right - SLOTS[index].left - 22) / label.width));
    });
    const top = new Set(ranking(scoring).slice(0, 8));
    for (const shot of flights.shots) {
      let actor = this.pooled[shot.slot];
      if (!actor) actor = this.pooled[shot.slot] = { ...shot, alive: true };
      actor.x = shot.active ? shot.x : -3000;
      actor.y = shot.active ? shot.y : -3000;
      actor.prevX = shot.active ? shot.prevX : -3000;
      actor.prevY = shot.active ? shot.prevY : -3000;
      actor.color = shot.color;
      actor.name = shot.name;
      actor.profileId = shot.player.userId;
      actor.trail = shot.trail;
      actor.numberLabel = shot.points;
      actor.leader = top.has(shot.owner);
      actor.hideName = !shot.active || !actor.leader && flights.shots.some(other => other.active
        && other !== shot && Math.hypot(other.x - shot.x, other.y - shot.y) < 55);
    }
    this.actors.render(this.pooled, alpha, time);
    this.sparks.render(time + this.endingAge);
    this.payoffs.render(time + this.endingAge, scoring);
  }

  destroy(): void {
    this.frame.destroy();
    this.pegRoot.destroy({ children: true });
    this.machines.destroy();
    this.actors.destroy();
    this.sparks.destroy();
    this.payoffs.destroy();
    for (const label of this.slotLabels) label.destroy();
  }
}
