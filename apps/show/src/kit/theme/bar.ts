import type { Graphics } from 'pixi.js';
import { TOY } from './toy';

export class ToyBar {
  private current?: number;

  draw(g: Graphics, x: number, y: number, width: number, target: number, dt: number,
    fill = TOY.color.accentB as number, remainder = TOY.color.track as number): void {
    const value = Math.max(0, Math.min(1, Number.isFinite(target) ? target : 0));
    this.current ??= value;
    this.current += (value - this.current) * (1 - Math.exp(-Math.max(0, dt) / TOY.bar.easeSeconds));
    const height = TOY.bar.height;
    g.roundRect(x, y, width, height, height / 2).fill(remainder);
    const pixels = width * this.current;
    const radius = height / 2;
    if (pixels >= radius && pixels <= width - radius) {
      g.moveTo(x + radius, y).lineTo(x + pixels, y).lineTo(x + pixels, y + height)
        .lineTo(x + radius, y + height).arc(x + radius, y + radius, radius, Math.PI / 2, Math.PI * 1.5)
        .closePath().fill(fill);
    } else if (pixels > .1) {
      g.roundRect(x, y, pixels, height, Math.min(radius, pixels / 2)).fill(fill);
    }
  }
}
