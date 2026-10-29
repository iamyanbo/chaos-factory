import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { cssColor, TOY, worldPixels } from './toy';

const TEXTURE_SIZE = 1024;
const textures = new Map<string, Texture>();

function texture(kind: 'background' | 'circle' | 'panel' | 'square' | 'track'): Texture {
  const cached = textures.get(kind);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'background' ? TOY.layout.width : kind === 'track' ? 128 : TEXTURE_SIZE;
  canvas.height = kind === 'background' ? TOY.layout.height : kind === 'track' ? 64 : TEXTURE_SIZE;
  const brush = canvas.getContext('2d')!;
  if (kind === 'track') {
    brush.fillStyle = 'white';
    brush.beginPath();
    brush.roundRect(0, 0, 128, 64, 32);
    brush.fill();
  } else if (kind === 'background') {
    const gradient = brush.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, cssColor(TOY.color.backgroundTop));
    gradient.addColorStop(1, cssColor(TOY.color.backgroundBottom));
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, canvas.width, canvas.height);
    brush.fillStyle = 'white';
    brush.globalAlpha = TOY.pattern.alpha;
    for (let y = 0; y <= canvas.height; y += TOY.pattern.grid) {
      for (let x = (y / TOY.pattern.grid % 2) * 24; x <= canvas.width; x += TOY.pattern.grid) {
        brush.beginPath();
        brush.arc(x, y, TOY.pattern.radius, 0, Math.PI * 2);
        brush.fill();
      }
    }
  } else {
    const center = TEXTURE_SIZE / 2;
    brush.beginPath();
    if (kind === 'circle') brush.arc(center, center, center, 0, Math.PI * 2);
    else if (kind === 'square') brush.rect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    else brush.roundRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE, 40);
    brush.clip();
    const gradient = brush.createRadialGradient(center, center, 0, center, center, center * 1.4);
    gradient.addColorStop(0, cssColor(TOY.color.floorCenter));
    gradient.addColorStop(1, cssColor(TOY.color.floorEdge));
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    brush.strokeStyle = 'white';
    brush.globalAlpha = TOY.pattern.ringAlpha;
    brush.lineWidth = 3;
    for (let radius = 85; radius < TEXTURE_SIZE; radius += 85) {
      brush.beginPath();
      brush.arc(center, center, radius, 0, Math.PI * 2);
      brush.stroke();
    }
  }
  const value = Texture.from(canvas);
  textures.set(kind, value);
  return value;
}

export function backdrop(parent: Container): Sprite {
  const sprite = new Sprite(texture('background'));
  parent.addChild(sprite);
  return sprite;
}

export function trackTexture(): Texture { return texture('track'); }

export function arenaFloor(parent: Container, kind: 'circle' | 'panel' | 'square',
  x: number, y: number, width: number, height = width, rim = true): void {
  const sprite = new Sprite(texture(kind));
  sprite.position.set(x, y);
  sprite.width = width;
  sprite.height = height;
  if (!rim) { parent.addChild(sprite); return; }
  const shadow = new Graphics();
  const border = new Graphics();
  const path = (g: Graphics, offset: number) => kind === 'circle'
    ? g.circle(x + width / 2, y + height / 2 + offset, width / 2)
    : kind === 'square' ? g.rect(x, y + offset, width, height)
    : g.roundRect(x, y + offset, width, height, 40);
  path(shadow, worldPixels(TOY.wall.rimDrop)).stroke({ color: TOY.color.rimShadow, width: worldPixels(TOY.wall.rim) });
  path(border, 0).stroke({ color: TOY.color.white, width: worldPixels(TOY.wall.rim) });
  parent.addChild(shadow, sprite, border);
}
