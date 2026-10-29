import { Container, Graphics, Text } from 'pixi.js';
import type { GameContext } from '../contract';
import type { NeonBall } from '../../kit/neon';
import { placeLabel, type LabelBox } from '../../kit/neon/labels';
import { nameTag, shade, TOY, toyColor, worldPixels } from '../../kit/theme';
import { ARENA_LEFT, ARENA_SIZE, CELL_SIZE, WALL_WIDTH } from './config';
import type { LightModel } from './model';

const ARROW_OUTLINE = 3;
const ARROW_DROP = 3;
const ARROW_SCALE = .85;
const NAME_GAP = 4;
const CROWN_WIDTH = 20;
interface ArrowView { root: Container; body: Graphics; crown: Graphics; name: Text }

function arrow(g: Graphics): Graphics {
  return g.moveTo(11, -2).quadraticCurveTo(14, 0, 11, 2)
    .lineTo(-6, 10).quadraticCurveTo(-11, 12, -9, 7)
    .lineTo(-6, 1).quadraticCurveTo(-5, 0, -6, -1)
    .lineTo(-9, -7).quadraticCurveTo(-11, -12, -6, -10).closePath();
}

/** Direction is the actual grid heading; drawing never changes the simulation. */
export class CycleArrows {
  private root = new Container();
  private labels = new Container();
  private views = new Map<string, ArrowView>();

  constructor(private ctx: GameContext) {
    ctx.stage.world.addChild(this.root, this.labels);
  }

  private view(actor: NeonBall): ArrowView {
    const cached = this.views.get(actor.id);
    if (cached) return cached;
    const root = this.root.addChild(new Container());
    const body = root.addChild(new Graphics());
    const color = toyColor(actor.color);
    arrow(body).fill(color)
      .stroke({ color: TOY.color.ink, width: ARROW_OUTLINE, join: 'round' });
    body.moveTo(9, 2).lineTo(-5, 8).quadraticCurveTo(-8, 9, -7, 6)
      .lineTo(-4, 2).quadraticCurveTo(2, 4, 9, 2).closePath().fill(shade(color, .77));
    const shadow = root.addChildAt(new Graphics(), 0);
    arrow(shadow).fill(shade(color, .6));
    shadow.y = ARROW_DROP;
    const crown = this.labels.addChild(new Graphics());
    crown.poly([-10, 4, -12, -5, -5, -1, 0, -8, 5, -1, 12, -5, 10, 4])
      .fill(TOY.color.yellow).stroke({ color: TOY.color.ink, width: 2, join: 'round' });
    const name = this.labels.addChild(nameTag(actor.name));
    name.style.fontSize = worldPixels(TOY.type.name);
    const view = { root, body, crown, name };
    this.views.set(actor.id, view);
    return view;
  }

  render(model: LightModel, actors: NeonBall[], alpha: number): void {
    const live = actors.filter(actor => actor.alive !== false);
    const ids = new Set(live.map(actor => actor.id));
    const placed: LabelBox[] = [];
    const edge = model.grid.border * CELL_SIZE + WALL_WIDTH;
    const left = ARENA_LEFT + edge + NAME_GAP;
    const right = ARENA_LEFT + ARENA_SIZE - edge - NAME_GAP;
    const top = edge + NAME_GAP;
    const bottom = ARENA_SIZE - edge - NAME_GAP;
    const names = new Set(live.filter(actor => !actor.hideName || actor.leader)
      .slice(0, 8).map(actor => actor.id));
    for (const [id, view] of this.views) {
      if (ids.has(id)) continue;
      view.root.destroy({ children: true });
      view.name.destroy();
      view.crown.destroy();
      this.views.delete(id);
    }
    for (const cycle of model.cycles) {
      if (!cycle.alive) continue;
      const actor = actors[cycle.ordinal];
      const view = this.view(actor);
      const x = cycle.prevX + (cycle.x - cycle.prevX) * alpha;
      const y = cycle.prevY + (cycle.y - cycle.prevY) * alpha;
      view.root.position.set(x, y);
      view.root.rotation = cycle.direction * Math.PI / 2;
      view.root.scale.set(worldPixels(ARROW_SCALE));
      const crowned = (actor.profileId ?? actor.id) === this.ctx.setup.crownUserId;
      view.crown.visible = crowned && right - left >= CROWN_WIDTH;
      view.crown.position.set(Math.max(left + 12, Math.min(right - 12, x)),
        Math.max(top + 8, Math.min(bottom - 4, y - 22)));
      view.name.visible = Boolean(actor.name) && (crowned || live.length <= 5 || names.has(actor.id))
        && right - left > view.name.width && bottom - top > view.name.height;
      if (view.name.visible) {
        const box = placeLabel({ ...actor, radius: 12 }, alpha, view.name.width,
          view.name.height, ARENA_SIZE / 2, live, placed, { left, right });
        box.x = Math.max(left, Math.min(right - box.width, box.x));
        box.y = Math.max(top, Math.min(bottom - box.height, box.y));
        view.name.position.set(box.x, box.y);
      }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.labels.destroy({ children: true });
    this.views.clear();
  }
}
