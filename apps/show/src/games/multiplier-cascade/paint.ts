import type { Graphics } from 'pixi.js';
import type { CascadeBoard } from './board';
import { COURSE, GATE_Y, PORTS } from './course-layout';
import { TOY, block } from '../../kit/theme';

export const MULTIPLY_COLOR = TOY.color.green;
export const TRIPLE_COLOR = TOY.color.yellow;
export const KEEP_COLOR = TOY.color.accentA;
export const DRAIN_COLOR = TOY.color.accentB;
export const MACHINE_COLORS = { wheel: TOY.color.accentA, seesaw: TOY.color.green, sweeper: TOY.color.yellow };
const PORT_HEIGHT = 48;
const PULSE_SECONDS = .24;

export function gateColor(factor: number): number {
  return factor === 0 ? DRAIN_COLOR : factor === 1 ? KEEP_COLOR
    : factor === 3 ? TRIPLE_COLOR : MULTIPLY_COLOR;
}

/** Translucent colored portals mark sensors; the opaque white shelves are solid. */
export function drawCascadePorts(g: Graphics, board: CascadeBoard, age: number): void {
  const bay = board.bay();
  for (let stage = 0; stage < GATE_Y.length; stage++) {
    const y = GATE_Y[stage];
    for (const port of PORTS) {
      const { start: u, width } = port;
      const factor = port.multiply ? board.factor(stage) : port.factor;
      const x = bay.left + bay.w * (board.mirrored(stage) ? 1 - u - width : u);
      const left = x + 10;
      const right = x + bay.w * width - 10;
      const color = gateColor(factor);
      const pulse = factor > 1 ? Math.max(0, 1 - (age - board.pulses[stage]) / PULSE_SECONDS) : 0;
      g.roundRect(left, y - 9, right - left, PORT_HEIGHT, 10)
        .fill({ color, alpha: .35 + pulse * .2 });
      for (const edge of [left, right - 10]) block(g,
        { x: edge, y: y - 9, width: 10, height: PORT_HEIGHT }, color);
    }
  }
  for (let slot = 0; slot < 3; slot++) {
    const value = board.pocketValue(slot);
    const color = value === 20 ? TRIPLE_COLOR : value === 5 ? MULTIPLY_COLOR : KEEP_COLOR;
    const x = bay.left + bay.w * slot / 3 + 10;
    g.roundRect(x, COURSE.bankY - 10, bay.w / 3 - 20, 43, 10)
      .fill({ color, alpha: .5 }).stroke({ color: TOY.color.ink, width: TOY.wall.outline });
  }
}
