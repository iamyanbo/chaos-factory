import type { MachineGeometry } from '../../kit/machine-geometry';
import { WHITE } from '../../kit/neon';
import { LINE_WIDTH } from './course-layout';

/** Eight different chambers in one continuous course. Outer drain lanes stay open. */
export function buildScenery(geometry: MachineGeometry): void {
  const peg = (x: number, y: number, radius = 16) => geometry.peg(x, y, radius, WHITE);
  const rail = (x1: number, y1: number, x2: number, y2: number) =>
    geometry.segment(x1, y1, x2, y2, LINE_WIDTH, WHITE, .035);
  for (const x of [690, 960, 1230]) peg(x, 300);
  rail(960, 500, 810, 565);
  rail(960, 500, 1110, 565);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 7; column++) {
      peg(660 + column * 92 + (row % 2) * 24, 930 + row * 57, 13);
    }
  }
  rail(700, 1310, 850, 1360);
  rail(1220, 1310, 1070, 1360);
  for (const x of [700, 1220]) peg(x, 1510, 22);
  rail(760, 1710, 680, 1810);
  rail(1160, 1710, 1240, 1810);
  for (const x of [800, 1120]) peg(x, 1930, 16);
  rail(960, 2110, 820, 2170);
  rail(960, 2110, 1100, 2170);
  for (const x of [680, 960, 1240]) peg(x, 2320);
  for (const [x, y] of [[680, 2520], [1240, 2520], [960, 2700]]) peg(x, y, 24);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 5; column++) peg(720 + column * 120,
      2900 + row * 65 + (column % 2) * 18, 15);
  }
  rail(660, 3350, 820, 3400);
  rail(1260, 3350, 1100, 3400);
}

export const MACHINE_LAYOUT = {
  wheels: [[760, 220, 140], [1160, 220, 140], [960, 1820, 190],
    [750, 2620, 140], [1170, 2620, 140]],
  bridges: [[750, 620, 220], [1170, 620, 220], [750, 2220, 240], [1170, 2220, 240]],
  sweepers: [[760, 1420, 220], [1160, 1420, 220], [960, 3080, 280]],
};
