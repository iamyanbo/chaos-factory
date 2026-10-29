import type { Graphics } from 'pixi.js';
import { shade, TOY, surfaceColor, worldPixels, type Box } from './toy';

export function card(g: Graphics, box: Box): void {
  const { x, y, width, height } = box;
  const style = TOY.card;
  g.roundRect(x + style.shadow, y + style.shadow, width, height, style.radius)
    .fill({ color: TOY.color.ink, alpha: style.shadowAlpha });
  g.roundRect(x, y, width, height, style.radius).fill(TOY.color.white)
    .stroke({ color: TOY.color.ink, width: style.border });
}

function capsule(g: Graphics, ax: number, ay: number, bx: number, by: number,
  width: number, color: number, alpha = 1): void {
  const angle = Math.atan2(by - ay, bx - ax);
  const dx = -Math.sin(angle) * width / 2;
  const dy = Math.cos(angle) * width / 2;
  g.poly([ax + dx, ay + dy, bx + dx, by + dy, bx - dx, by - dy, ax - dx, ay - dy])
    .circle(ax, ay, width / 2).circle(bx, by, width / 2).fill({ color, alpha });
}

/** Filled capsule, outline and a solid underside; never adds a collider. */
export function wall(g: Graphics, ax: number, ay: number, bx: number, by: number,
  color = TOY.color.white as number, width = TOY.wall.width as number, alpha = 1): void {
  const size = worldPixels(Math.max(TOY.wall.width, width));
  color = surfaceColor(color);
  const outline = worldPixels(TOY.wall.outline);
  const underside = worldPixels(TOY.wall.underside);
  capsule(g, ax, ay + underside, bx, by + underside, size + outline * 2, shade(color, .65), alpha);
  capsule(g, ax, ay, bx, by, size + outline * 2, TOY.color.ink, alpha);
  capsule(g, ax, ay, bx, by, size, color, alpha);
}

export function peg(g: Graphics, x: number, y: number, radius: number,
  color = TOY.color.white as number): void {
  const r = Math.max(worldPixels(10), radius);
  const outline = worldPixels(TOY.wall.outline);
  color = surfaceColor(color);
  g.circle(x, y + worldPixels(TOY.wall.underside), r + outline).fill(shade(color, .65));
  g.circle(x, y, r + outline).fill(TOY.color.ink);
  g.circle(x, y, r).fill(color);
}

export function wallArc(g: Graphics, x: number, y: number, radius: number,
  start: number, end: number, color = TOY.color.white as number,
  width = TOY.wall.width as number, alpha = 1): void {
  if (end <= start || radius <= 0) return;
  const size = worldPixels(Math.max(TOY.wall.width, width));
  const outline = worldPixels(TOY.wall.outline);
  color = surfaceColor(color);
  const arc = (oy: number, stroke: number, fill: number) => {
    g.moveTo(x + Math.cos(start) * radius, y + oy + Math.sin(start) * radius)
      .arc(x, y + oy, radius, start, end)
      .stroke({ color: fill, width: stroke, alpha, cap: 'round' });
    for (const angle of [start, end]) g.circle(x + Math.cos(angle) * radius,
      y + oy + Math.sin(angle) * radius, stroke / 2).fill({ color: fill, alpha });
  };
  arc(worldPixels(TOY.wall.underside), size + outline * 2, shade(color, .65));
  arc(0, size + outline * 2, TOY.color.ink);
  arc(0, size, color);
}

export function wallCircle(g: Graphics, x: number, y: number, radius: number,
  color = TOY.color.white as number, width = TOY.wall.width as number): void {
  wallArc(g, x, y, radius, 0, Math.PI * 2, color, width);
}

/** Arena rims use the reference's blue drop, with no dark wall outline. */
export function rimArc(g: Graphics, x: number, y: number, radius: number,
  start = 0, end = Math.PI * 2, shadow: Graphics = g): void {
  const arc = (layer: Graphics, drop: number, color: number) => {
    layer.moveTo(x + Math.cos(start) * radius, y + drop + Math.sin(start) * radius)
      .arc(x, y + drop, radius, start, end)
      .stroke({ color, width: worldPixels(TOY.wall.rim), cap: 'round' });
  };
  arc(shadow, worldPixels(TOY.wall.rimDrop), TOY.color.rimShadow);
  arc(g, 0, TOY.color.white);
}

export function block(g: Graphics, box: Box, color = TOY.color.white as number, angle = 0): void {
  color = surfaceColor(color);
  const points = (oy: number) => {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([dx, dy]) => [
      cx + dx * box.width / 2 * c - dy * box.height / 2 * s,
      cy + dx * box.width / 2 * s + dy * box.height / 2 * c + oy]);
  };
  g.poly(points(TOY.wall.underside)).fill(shade(color, .65));
  g.poly(points(0)).fill(color).stroke({ color: TOY.color.ink, width: TOY.wall.outline, join: 'round' });
}
