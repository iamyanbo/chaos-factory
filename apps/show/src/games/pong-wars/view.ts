import { Graphics } from "pixi.js";
import type { GameContext } from "../contract";
import { ARENA, INK, STROKE, WHITE, NeonBalls, NeonSparks } from "../../kit/neon";
import {
  TILE_ALPHA,
  NEUTRAL_ALPHA,
  POP_SECONDS,
  POP_ALPHA,
  POP_INSET,
  POP_OUTLINE_ALPHA,
  POP_OUTLINE_WIDTH,
  TEAM_COLORS,
  SHOCKWAVE_SECONDS,
  TILE_SIZE,
  WALL_OWNER,
} from "./config";
import { tileRect } from "./board";
import type { PongModel } from "./model";
import { SPECIAL } from "./specials";
import { block, TOY, toyColor } from '../../kit/theme';

export class PongView {
  private tiles = new Graphics();
  private pops = new Graphics();
  private wall = new Graphics();
  private icons = new Graphics();
  private actors: NeonBalls;
  readonly sparks: NeonSparks;
  private version = -1;

  constructor(ctx: GameContext) {
    ctx.stage.world.addChild(this.tiles, this.pops, this.icons, this.wall);
    this.actors = new NeonBalls(ctx);
    this.sparks = new NeonSparks(ctx);
  }

  render(model: PongModel, alpha: number): void {
    if (this.version !== model.grid.version) {
      this.version = model.grid.version;
      this.tiles.clear();
      this.icons.clear();
      for (let index = 0; index < model.grid.cells.length; index++) {
        const owner = model.grid.cells[index];
        const color = owner < 0 ? TOY.color.pale : toyColor(TEAM_COLORS[model.teams[owner]]);
        const rect = tileRect(index);
        if (owner === WALL_OWNER) {
          block(this.tiles, { x: rect.x + 3, y: rect.y + 3,
            width: rect.size - 6, height: rect.size - 6 }, TOY.color.white);
          continue;
        }
        this.tiles.roundRect(rect.x, rect.y, rect.size, rect.size, 7)
          .fill({ color, alpha: owner < 0 ? .65 : .85 });
        this.icon(model.grid.specials[index], rect.x + rect.size / 2, rect.y + rect.size / 2);
      }
    }
    this.pops.clear();
    for (let index = 0; index < model.grid.cells.length; index++) {
      const age = model.time - model.grid.changedAt[index];
      if (age < 0 || age >= POP_SECONDS) continue;
      const fade = 1 - age / POP_SECONDS;
      const owner = model.grid.cells[index];
      const color = owner < 0 ? TOY.color.white : toyColor(TEAM_COLORS[model.teams[owner]]);
      const rect = tileRect(index);
      const inset = POP_INSET * fade;
      this.pops.rect(rect.x + inset, rect.y + inset, rect.size - 2 * inset, rect.size - 2 * inset)
        .fill({ color, alpha: fade * POP_ALPHA })
        .stroke({ color: TOY.color.white, width: TOY.wall.outline, alpha: fade * POP_OUTLINE_ALPHA });
    }
    for (const wave of model.shockwaves) {
      const age = (model.time - wave.at) / SHOCKWAVE_SECONDS;
      this.pops.circle(wave.x, wave.y, TILE_SIZE * (0.2 + age * 1.6))
        .stroke({ color: toyColor(wave.color), width: 6, alpha: 1 - age });
    }
    this.actors.render(model.balls, alpha, model.time);
    this.sparks.render(model.time);
  }

  destroy(): void {
    this.tiles.destroy();
    this.pops.destroy();
    this.wall.destroy();
    this.icons.destroy();
    this.actors.destroy();
    this.sparks.destroy();
  }

  private icon(kind: number, x: number, y: number): void {
    if (kind === SPECIAL.split) {
      const points: number[] = [];
      for (let tip = 0; tip < 10; tip++) {
        const angle = -Math.PI / 2 + tip * Math.PI / 5;
        const radius = tip % 2 === 0 ? 13 : 5.5;
        points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      }
      this.icons.poly(points).fill(TOY.color.yellow).stroke({ color: TOY.color.ink, width: 3 });
    }
    if (kind === SPECIAL.bomb) {
      this.icons.circle(x, y, 9).fill(TOY.color.ink);
      for (let ray = 0; ray < 8; ray++) {
        const angle = ray * Math.PI / 4;
        this.icons.moveTo(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8)
          .lineTo(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14)
          .stroke({ color: TOY.color.yellow, width: TOY.wall.outline, cap: "round" });
      }
    }
  }
}
