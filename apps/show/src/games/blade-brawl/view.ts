import { Graphics } from "pixi.js";
import type { GameContext } from "../contract";
import {
  CENTER,
  NeonBalls,
  NeonSparks,
  WHITE,
  strokeCircle,
  strokeLine,
} from "../../kit/neon";
import { pose } from "./weapons";
import type { ContactMark, Fighter, WeaponKind } from "./types";
import { TOY, block, wallArc } from '../../kit/theme';

const WEAPON_COLORS: Record<WeaponKind, number> = {
  Sword: TOY.color.white, Dagger: TOY.color.yellow,
  Spear: TOY.color.cyan, Hammer: TOY.color.orange,
};

export class BladeView {
  private arena = new Graphics();
  private weapons = new Graphics();
  private marks = new Graphics();
  private balls: NeonBalls;
  readonly sparks: NeonSparks;
  private drawnRadius = -1;

  constructor(ctx: GameContext) {
    ctx.stage.world.addChild(this.arena);
    ctx.stage.world.addChild(this.weapons);
    this.balls = new NeonBalls(ctx);
    ctx.stage.fx.addChild(this.marks);
    this.sparks = new NeonSparks(ctx);
  }

  render(
    fighters: Fighter[],
    radius: number,
    time: number,
    alpha: number,
    contacts: ContactMark[],
  ): void {
    if (radius !== this.drawnRadius) {
      this.arena.clear();
      if (radius < 499) for (let segment = 0; segment < 40; segment++) {
        const start = segment * Math.PI * 2 / 40;
        wallArc(this.arena, CENTER.x, CENTER.y, radius, start,
          start + Math.PI * 2 / 40 * .55, TOY.color.accentB);
      }
      this.drawnRadius = radius;
    }
    this.balls.render(fighters, alpha, time);
    const g = this.weapons.clear();
    for (const fighter of fighters) {
      if (!fighter.alive) continue;
      const raging = fighter.rage?.active(time);
      if (raging) {
        g.circle(fighter.x, fighter.y, fighter.radius + 12)
          .stroke({ color: TOY.color.ink, width: 12 })
          .circle(fighter.x, fighter.y, fighter.radius + 12)
          .stroke({ color: TOY.color.yellow, width: 6 });
      }
      for (const weapon of fighter.weapons) {
        const p = pose(fighter, weapon, radius, alpha);
        const dx = Math.cos(p.angle);
        const dy = Math.sin(p.angle);
        const length = Math.hypot(p.bx - p.ax, p.by - p.ay);
        if (length < 2) continue;
        const width =
          weapon.kind === "Spear" ? 3 : weapon.kind === "Dagger" ? 5 : 7;
        const color = raging ? TOY.color.yellow : WEAPON_COLORS[weapon.kind];
        strokeLine(g, p.ax, p.ay, p.bx, p.by, color, width);
        if (weapon.kind === "Spear") {
          g.moveTo(p.bx, p.by)
            .lineTo(p.bx - dx * 15 - dy * 6, p.by - dy * 15 + dx * 6)
            .lineTo(p.bx - dx * 15 + dy * 6, p.by - dy * 15 - dx * 6)
            .closePath()
            .fill(color).stroke({ color: TOY.color.ink, width: TOY.wall.outline });
        }
        if (weapon.kind === "Hammer" && p.head) {
          block(g, { x: p.bx - 12, y: p.by - 20, width: 24, height: 40 },
            raging ? TOY.color.yellow : fighter.color, p.angle);
        }
      }
    }
    this.marks.clear();
    for (const contact of contacts) {
      if (contact.until <= time) continue;
      this.marks.circle(contact.x, contact.y, 10).stroke({
        color: TOY.color.yellow,
        width: TOY.wall.outline,
        alpha: Math.min(1, (contact.until - time) / 0.2),
      });
    }
    this.sparks.render(time);
  }

  destroy(): void {
    this.arena.destroy();
    this.weapons.destroy();
    this.marks.destroy();
    this.balls.destroy();
    this.sparks.destroy();
  }
}
