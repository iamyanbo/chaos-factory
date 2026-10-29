import { Text } from 'pixi.js';
import type { GameContext } from '../contract';
import { TOY } from '../../kit/theme/toy';

const LIMIT = 16;
const LIFE = .65;
const GAP = .08;
interface Burst { text: Text; x: number; y: number; at: number }

/** Local arithmetic feedback only when a ball really multiplies. */
export class CascadeBursts {
  private views: Burst[] = [];
  private serial = 0;
  private last = -Infinity;
  constructor(private ctx: GameContext) {}

  multiply(x: number, y: number, factor: number, time: number): void {
    if (time - this.last < GAP) return;
    this.last = time;
    const index = this.serial++ % LIMIT;
    const view = this.views[index] ??= { text: this.ctx.stage.hudWorld.addChild(new Text({
      text: '', style: { fontFamily: TOY.font.display, fontSize: 46,
        fill: TOY.color.yellow, stroke: { color: TOY.color.ink, width: 5, join: 'round' } }
    })), x, y, at: time };
    Object.assign(view, { x, y, at: time });
    view.text.text = `×${factor}`;
    view.text.style.fill = factor === 0 ? TOY.color.accentB : TOY.color.yellow;
    view.text.anchor.set(.5);
  }

  render(time: number): void {
    for (const view of this.views) {
      const age = time - view.at;
      view.text.visible = age < LIFE;
      if (!view.text.visible) continue;
      view.text.position.set(view.x, view.y - age * 55);
      view.text.scale.set(1 + .2 * Math.sin(Math.min(1, age * 8) * Math.PI));
      view.text.alpha = Math.min(1, (LIFE - age) * 5);
    }
  }

  destroy(): void { for (const view of this.views) view.text.destroy(); }
}
