import { BitmapFont, BitmapText, Container, Sprite, Text } from 'pixi.js';
import type { Vec2 } from '@chaos/shared';
import type { GameContext } from '../../games/contract';
import { placeLabel, type LabelBox } from '../neon/labels';
import { BallTextures } from './ball-textures';
import { ballStyle } from './ball-style';
import { nameTag } from './text';
import { TOY, toyColor, worldPixels } from './toy';

export interface ToyBall {
  id: string; name: string; x: number; y: number; prevX: number; prevY: number;
  radius: number; color: number; alive?: boolean; trail?: Vec2[];
  hp?: number; detail?: string; flashUntil?: number; leader?: boolean; hideName?: boolean;
  profileId?: string; crownVisible?: boolean; numberLabel?: number; isStreamer?: boolean;
}
interface BallView {
  body: Container; fill: Sprite; shadow: Sprite; eyes: [Sprite, Sprite];
  name: Text; number: BitmapText; crown: Sprite;
  dx: number; dy: number; impactAt: number; flashing: boolean;
}
let digitsInstalled = false;
function installDigits(): void {
  if (digitsInstalled) return;
  BitmapFont.install({ name: 'ToyDigits', chars: '0123456789,.×',
    style: { fontFamily: TOY.font.display, fontSize: 50, fill: TOY.color.white,
      stroke: { color: TOY.color.ink, width: 6, join: 'round' } },
    resolution: 2, skipKerning: true });
  digitsInstalled = true;
}

/** Batched matte/jelly/face sprites. This class never writes a game or body. */
export class ToyBalls {
  readonly root = new Container();
  private shadows = new Container();
  private bodies = new Container();
  private labels = new Container();
  private views = new Map<string, BallView>();
  private textures = new BallTextures();
  private style = ballStyle();

  constructor(private ctx: GameContext, private options: { minimumRadius?: number } = {}) {
    installDigits();
    this.root.addChild(this.shadows, this.bodies, this.labels);
    ctx.stage.world.addChild(this.root);
  }

  private sprite(kind: 'shadow' | 'eye' | 'crown', parent: Container): Sprite {
    const view = new Sprite(this.textures.shape(kind));
    view.anchor.set(.5);
    parent.addChild(view);
    return view;
  }

  private view(ball: ToyBall): BallView {
    const cached = this.views.get(ball.id);
    if (cached) return cached;
    const body = new Container();
    this.bodies.addChild(body);
    const fill = new Sprite();
    fill.anchor.set(.5);
    body.addChild(fill);
    const shadow = this.sprite('shadow', this.shadows);
    shadow.alpha = TOY.ball.shadowAlpha;
    const eyes: [Sprite, Sprite] = [this.sprite('eye', body), this.sprite('eye', body)];
    const name = nameTag(ball.name);
    const number = new BitmapText({ text: '', style: { fontFamily: 'ToyDigits', fontSize: 24 } });
    number.anchor.set(.5);
    const crown = this.sprite('crown', this.labels);
    crown.anchor.set(.5, 1);
    this.labels.addChild(name, number);
    const view = { body, fill, shadow, eyes, name, number, crown,
      dx: 0, dy: 0, impactAt: -Infinity, flashing: false };
    this.views.set(ball.id, view);
    return view;
  }

  render(balls: readonly ToyBall[], alpha: number, time: number): void {
    const labels: LabelBox[] = [];
    const live = balls.filter(ball => ball.alive !== false && ball.x > -1000 && ball.y > -1000);
    const living = new Set(live.map(ball => ball.id));
    const top = new Set([...live].sort((a, b) => Number(Boolean(b.leader)) - Number(Boolean(a.leader))
      || (b.hp ?? 0) - (a.hp ?? 0)).filter(ball => !ball.hideName || ball.leader).slice(0, 8).map(ball => ball.id));
    for (const [id, view] of this.views) {
      if (living.has(id)) continue;
      view.body.destroy({ children: true });
      for (const child of [view.shadow, view.name, view.number, view.crown]) child.destroy();
      this.views.delete(id);
    }
    const minimum = this.options.minimumRadius ?? (live.length > TOY.ball.crowdedAt
      ? TOY.ball.crowdedRadius : TOY.ball.radius) / TOY.layout.worldScale;
    for (const ball of live) {
      const view = this.view(ball);
      const radius = Math.max(minimum, ball.radius);
      const x = ball.prevX + (ball.x - ball.prevX) * alpha;
      const y = ball.prevY + (ball.y - ball.prevY) * alpha;
      const dx = ball.x - ball.prevX;
      const dy = ball.y - ball.prevY;
      const speed = Math.hypot(dx, dy);
      const previousSpeed = Math.hypot(view.dx, view.dy);
      const flashing = (ball.flashUntil ?? 0) > time;
      if (flashing && !view.flashing || speed > .1 && previousSpeed > .1
        && (dx * view.dx + dy * view.dy) / (speed * previousSpeed) < .65) view.impactAt = time;
      view.flashing = flashing;
      if (speed > .1) { view.dx = dx; view.dy = dy; }
      const impact = Math.max(0, 1 - (time - view.impactAt) / TOY.ball.hitSeconds);
      const squash = Math.sin(impact * Math.PI) * (this.style === 'b' ? .3 : .2);
      view.body.position.set(x, y);
      view.body.scale.set(1 + squash, 1 - squash);
      const color = flashing ? TOY.color.white : toyColor(ball.color);
      const disc = this.textures.disc(color, radius, this.style);
      view.fill.texture = disc.texture;
      view.fill.width = view.fill.height = disc.size;
      view.shadow.position.set(x + 2, y + worldPixels(TOY.ball.shadowDrop));
      view.shadow.width = radius * 2.25;
      view.shadow.height = radius * 1.9;
      for (const [index, eye] of view.eyes.entries()) {
        eye.visible = this.style === 'c';
        eye.width = Math.max(3, radius * .15);
        eye.height = Math.max(5, radius * .24) * (impact > .1 ? .25 : 1);
        eye.position.set((index ? 1 : -1) * radius * .24 + (speed ? dx / speed : 0) * radius * .08,
          -radius * .3 + (speed ? dy / speed : 0) * radius * .08);
      }
      const number = ball.numberLabel ?? ball.hp;
      view.number.visible = number !== undefined;
      if (number !== undefined) {
        view.number.text = String(Math.max(0, Math.ceil(number)));
        view.number.style.fontSize = Math.min(44, radius * 1.2,
          radius * 2.6 / Math.max(2, view.number.text.length));
        view.number.position.set(x, y);
      }
      const crowned = ball.crownVisible !== false && (ball.profileId ?? ball.id) === this.ctx.setup.crownUserId;
      view.crown.visible = crowned;
      view.crown.width = Math.max(28, Math.min(64, radius * 1.7));
      view.crown.height = view.crown.width;
      view.crown.position.set(x, y - radius - 4);
      view.name.visible = Boolean(ball.name) && (crowned || ball.isStreamer || live.length <= 5
        || top.has(ball.id) && !ball.hideName);
      if (view.name.visible) {
        view.name.text = ball.name.slice(0, 26);
        view.name.style.fontSize = TOY.type.name / TOY.layout.worldScale;
        const board = TOY.boards[this.ctx.setup.gameId as keyof typeof TOY.boards];
        const point = placeLabel({ ...ball, radius }, alpha, view.name.width,
          view.name.height, this.ctx.camera.target.y, live, labels,
          { circleRadius: board?.shape === 'circle' ? board.width / 2 : undefined,
            left: board?.x, right: board ? board.x + board.width : undefined,
            below: ball.isStreamer });
        view.name.position.set(point.x, point.y);
      }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.textures.destroy();
    this.views.clear();
  }
}
