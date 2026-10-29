import { Container, Graphics, Text } from 'pixi.js';
import { ARENA_BOX, TOY, type ArenaBounds } from './toy';
import { textStyle } from './text';

/** Overshoot and clamping are presentation only; the caller owns event timing. */
export class ToyCallout {
  readonly view = new Text({ text: '', style: { ...textStyle(TOY.type.callout, true),
    fill: TOY.color.yellow, stroke: { color: TOY.color.ink, width: 8, join: 'round' },
    dropShadow: { color: TOY.color.ink, distance: 10, angle: Math.PI / 2, blur: 0 } } });

  constructor(parent: Container) {
    this.view.anchor.set(.5);
    this.view.rotation = -Math.PI / 30;
    parent.addChild(this.view);
  }

  place(content: string, x: number, y: number, age: number, bounds: ArenaBounds = ARENA_BOX,
    maxWidth = Infinity): void {
    this.view.text = content;
    this.view.scale.set(1);
    const pop = 1 + .18 * Math.exp(-age * 11) * Math.sin(age * 20);
    const c = Math.cos(this.view.rotation);
    const s = Math.sin(this.view.rotation);
    const rotatedWidth = Math.abs(this.view.width * c) + Math.abs(this.view.height * s);
    const rotatedHeight = Math.abs(this.view.width * s) + Math.abs(this.view.height * c);
    const circleFit = bounds.shape === 'circle'
      ? (Math.min(bounds.width, bounds.height) - 32) / Math.hypot(rotatedWidth, rotatedHeight) : Infinity;
    this.view.scale.set(Math.min(pop, circleFit, maxWidth / Math.max(1, rotatedWidth), (bounds.width - 32) / Math.max(1, rotatedWidth),
      (bounds.height - 32) / Math.max(1, rotatedHeight)));
    const halfWidth = (Math.abs(this.view.width * c) + Math.abs(this.view.height * s)) / 2;
    const halfHeight = (Math.abs(this.view.width * s) + Math.abs(this.view.height * c)) / 2;
    this.view.position.set(Math.max(bounds.x + halfWidth + 8,
      Math.min(bounds.x + bounds.width - halfWidth - 8, x)),
    Math.max(bounds.y + halfHeight + 8, Math.min(bounds.y + bounds.height - halfHeight - 8, y)));
    if (bounds.shape === 'circle') {
      const radius = Math.min(bounds.width, bounds.height) / 2 - 8;
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const vertical = Math.max(0, Math.sqrt(Math.max(0, radius ** 2 - halfWidth ** 2)) - halfHeight);
      this.view.y = Math.max(cy - vertical, Math.min(cy + vertical, this.view.y));
      const farY = Math.abs(this.view.y - cy) + halfHeight;
      const horizontal = Math.max(0, Math.sqrt(Math.max(0, radius ** 2 - farY ** 2)) - halfWidth);
      this.view.x = Math.max(cx - horizontal, Math.min(cx + horizontal, this.view.x));
    }
  }
}

export class ToyToast {
  readonly root = new Container();
  private pill = new Graphics();
  private text = new Text({ text: '', style: { ...textStyle(TOY.type.body), fill: TOY.color.white } });

  constructor(parent: Container) {
    this.root.addChild(this.pill, this.text);
    parent.addChild(this.root);
    this.root.visible = false;
  }

  show(content?: string): void {
    this.root.visible = Boolean(content);
    if (!content) return;
    this.text.text = content;
    this.text.style.wordWrap = true;
    this.text.style.wordWrapWidth = 850;
    const width = Math.min(910, this.text.width + 56);
    const height = this.text.height + 24;
    this.pill.clear().roundRect(0, 0, width, height, height / 2).fill(TOY.color.ink);
    this.text.position.set(28, 10);
    this.root.position.set((TOY.layout.width - width) / 2, TOY.layout.height - height - 34);
  }
}
