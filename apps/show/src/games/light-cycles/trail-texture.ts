import { Rectangle, Texture } from 'pixi.js';
import { CELL_SIZE } from './config';

const RESOLUTION = 8;
export const TURN_RADIUS = CELL_SIZE * .45;

export interface TrailInk {
  straight: Texture;
  turn: Texture;
  width: number;
  destroy(): void;
}

/** One rounded, filled capsule per grid step; adjoining ends overlap completely. */
export function trailTexture(width: number): TrailInk {
  const canvas = document.createElement('canvas');
  const length = Math.ceil((CELL_SIZE + width) * RESOLUTION);
  const height = Math.ceil(width * RESOLUTION);
  const bend = Math.ceil((TURN_RADIUS + width) * RESOLUTION);
  canvas.width = Math.max(length, bend);
  canvas.height = height + bend + 4;
  const ink = canvas.getContext('2d')!;
  ink.fillStyle = '#ffffff';
  ink.beginPath();
  ink.roundRect(0, 0, length, height, height / 2);
  ink.fill();
  ink.strokeStyle = '#ffffff';
  ink.lineWidth = width * RESOLUTION;
  ink.lineCap = 'round';
  ink.beginPath();
  ink.arc(width * RESOLUTION / 2, height + 4 + (TURN_RADIUS + width / 2) * RESOLUTION,
    TURN_RADIUS * RESOLUTION, -Math.PI / 2, 0);
  ink.stroke();
  const atlas = Texture.from(canvas);
  const straight = new Texture({ source: atlas.source, frame: new Rectangle(0, 0, length, height) });
  const turn = new Texture({ source: atlas.source, frame: new Rectangle(0, height + 4, bend, bend) });
  return { straight, turn, width, destroy() {
    straight.destroy();
    turn.destroy();
    atlas.destroy(true);
  } };
}
