import { Texture } from 'pixi.js';
import { cssColor, shade, TOY, worldPixels } from './toy';
import type { BallStyle } from './ball-style';

const TEXTURE_SIZE = 192;
const PADDING = 6;

export class BallTextures {
  private textures = new Map<string, Texture>();

  disc(color: number, radius: number, style: BallStyle): { texture: Texture; size: number } {
    const r = Math.round(radius * 10) / 10;
    const key = `${style === 'c' ? 'a' : style}:${color}:${r}`;
    const size = (r + PADDING) * 2;
    const cached = this.textures.get(key);
    if (cached) return { texture: cached, size };
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    const brush = canvas.getContext('2d')!;
    brush.scale(TEXTURE_SIZE / size, TEXTURE_SIZE / size);
    brush.translate(size / 2, size / 2);
    const outline = worldPixels(style === 'b' ? 3 : TOY.ball.outline);
    const fillRadius = r - outline / 2;
    brush.save();
    brush.beginPath();
    brush.arc(0, 0, fillRadius, 0, Math.PI * 2);
    brush.clip();
    if (style === 'b') {
      brush.globalAlpha = .9;
      brush.fillStyle = cssColor(color);
      brush.fillRect(-r, -r, r * 2, r * 2);
      brush.globalAlpha = .45;
      brush.strokeStyle = 'white';
      brush.lineWidth = 2;
      brush.beginPath();
      brush.arc(0, 0, r * .75, 0, Math.PI * 2);
      brush.stroke();
      brush.globalAlpha = .65;
      brush.lineWidth = Math.max(2, r * .1);
      brush.lineCap = 'round';
      brush.beginPath();
      brush.arc(-r * .03, -r * .03, r * .6, Math.PI * 1.08, Math.PI * 1.45);
      brush.stroke();
    } else {
      brush.fillStyle = cssColor(shade(color, .75));
      brush.fillRect(-r, -r, r * 2, r * 2);
      brush.fillStyle = cssColor(color);
      brush.beginPath();
      brush.arc(-r * .22, -r * .22, r * .99, 0, Math.PI * 2);
      brush.fill();
    }
    brush.restore();
    brush.beginPath();
    brush.arc(0, 0, fillRadius, 0, Math.PI * 2);
    brush.strokeStyle = cssColor(style === 'b' ? shade(color, .7) : TOY.color.ink);
    brush.lineWidth = outline;
    brush.stroke();
    const texture = Texture.from(canvas);
    this.textures.set(key, texture);
    return { texture, size };
  }

  shape(kind: 'shadow' | 'eye' | 'crown'): Texture {
    const cached = this.textures.get(kind);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const brush = canvas.getContext('2d')!;
    if (kind === 'shadow') {
      const gradient = brush.createRadialGradient(64, 64, 24, 64, 64, 62);
      gradient.addColorStop(0, cssColor(TOY.color.ink));
      gradient.addColorStop(1, 'transparent');
      brush.fillStyle = gradient;
      brush.fillRect(0, 0, 128, 128);
    } else if (kind === 'eye') {
      brush.fillStyle = cssColor(TOY.color.ink);
      brush.beginPath();
      brush.arc(64, 64, 62, 0, Math.PI * 2);
      brush.fill();
    } else {
      brush.fillStyle = cssColor(TOY.color.yellow);
      brush.strokeStyle = cssColor(TOY.color.ink);
      brush.lineWidth = 6;
      brush.lineJoin = 'round';
      brush.beginPath();
      for (const [x, y] of [[18, 98], [9, 32], [41, 56], [64, 13], [87, 56], [119, 32], [110, 98]]) {
        brush.lineTo(x, y);
      }
      brush.closePath();
      brush.fill();
      brush.stroke();
      brush.fillRect(20, 110, 88, 9);
    }
    const texture = Texture.from(canvas);
    this.textures.set(kind, texture);
    return texture;
  }

  destroy(): void {
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }
}
