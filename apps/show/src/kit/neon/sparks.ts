import { Container, Sprite, Texture } from 'pixi.js';
import { Rng } from '@chaos/shared';
import type { GameContext } from '../../games/contract';
import { TOY, toyColor } from '../theme/toy';

interface Spark {
  view: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  start: number;
  life: number;
}
const MAX_SPARKS = 600;

/** Both sprites and simulation records are reused; impacts allocate no Graphics. */
export class NeonSparks {
  private root = new Container();
  private active: Spark[] = [];
  private pool: Spark[] = [];
  private rng = new Rng(20261025);

  constructor(ctx: GameContext) {
    ctx.stage.fx.addChild(this.root);
  }

  burst(x: number, y: number, color: number, time: number, count = 16): void {
    for (let index = 0; index < count && this.active.length < MAX_SPARKS; index++) {
      let spark = this.pool.pop();
      if (!spark) {
        const view = new Sprite(Texture.WHITE);
        view.anchor.set(.5);
        this.root.addChild(view);
        spark = { view, x: 0, y: 0, vx: 0, vy: 0, start: 0, life: 0 };
      }
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(70, 240);
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * speed;
      spark.vy = Math.sin(angle) * speed;
      spark.start = time;
      spark.life = this.rng.range(.18, .5);
      spark.view.tint = toyColor(color);
      spark.view.rotation = angle;
      spark.view.width = Math.max(TOY.wall.outline, speed * .025);
      spark.view.height = TOY.wall.outline;
      spark.view.visible = true;
      this.active.push(spark);
    }
  }

  render(time: number): void {
    for (let index = this.active.length - 1; index >= 0; index--) {
      const spark = this.active[index];
      const age = Math.max(0, time - spark.start);
      if (age >= spark.life) {
        spark.view.visible = false;
        this.pool.push(spark);
        this.active[index] = this.active[this.active.length - 1];
        this.active.pop();
        continue;
      }
      spark.view.position.set(spark.x + spark.vx * age, spark.y + spark.vy * age);
      spark.view.alpha = 1 - age / spark.life;
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.active = [];
    this.pool = [];
  }
}
