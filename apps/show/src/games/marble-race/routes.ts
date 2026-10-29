import type { Machine, Module } from './course';
import { LEFT, RIGHT, TRAP_PERIOD } from './config';

const CENTER = (LEFT + RIGHT) / 2;
const LANE_OFFSET = 260;
const PADDLE_WIDTH = 260;
const SEESAW_WIDTH = 350;
const DOOR_WIDTH = 240;
const DOOR_HINGE_INSET = 120;
const CHUTE_HALF_WIDTH = 100;
const PEG_STAGGER = 18;
type Segment = readonly [number, number, number, number];

// Staggered switchbacks leave an inside drop and a longer outside line.
const SLALOM: readonly Segment[] = [
  [LEFT, 40, CENTER - 110, 170],
  [RIGHT, 90, CENTER + 150, 230],
  [CENTER - 30, 260, LEFT + 150, 400],
  [CENTER + 50, 330, RIGHT - 150, 470],
  [LEFT, 490, CENTER - 100, 600],
  [RIGHT, 530, CENTER + 120, 610],
];
const ROTOR_RAMPS: readonly Segment[] = [
  [LEFT, 30, CENTER - 260, 140],
  [RIGHT, 30, CENTER + 260, 140],
  [LEFT, 390, CENTER - 50, 520],
  [RIGHT, 500, CENTER + 70, 600],
];
const TILT_RAMPS: readonly Segment[] = [
  [LEFT, 35, CENTER - 80, 150],
  [RIGHT, 35, CENTER + 240, 180],
  [RIGHT, 530, CENTER + 100, 610],
];
const GATE_RAMPS: readonly Segment[] = [
  [CENTER - 20, 25, CENTER - LANE_OFFSET, 150],
  [CENTER + 20, 25, CENTER + LANE_OFFSET, 150],
  [LEFT, 370, CENTER - 100, 510],
  [RIGHT, 530, CENTER + 110, 610],
];

export interface RouteBuilder {
  line(ax: number, ay: number, bx: number, by: number): void;
  peg(x: number, y: number): void;
  machine(kind: Machine['kind'], x: number, y: number, width: number,
    direction?: number, timeOffset?: number): unknown;
  gate(x: number, y: number): void;
}

/** Each chamber routes the field differently. Everything here is visible collision geometry. */
export function buildRoutes(builder: RouteBuilder, module: Module, timeOffset: number): void {
  const { kind, y, mirrored } = module;
  const x = (value: number) => mirrored ? CENTER * 2 - value : value;
  const line = (ax: number, ay: number, bx: number, by: number) =>
    builder.line(x(ax), y + ay, x(bx), y + by);
  const peg = (px: number, py: number) => builder.peg(x(px), y + py);
  const rails = (segments: readonly Segment[]) => {
    for (const segment of segments) line(...segment);
  };

  if (kind === 'zigzag') {
    rails(SLALOM);
    peg(CENTER + PEG_STAGGER, 210);
    peg(CENTER - 110, 440);
  } else if (kind === 'paddles') {
    rails(ROTOR_RAMPS);
    builder.machine('paddle', x(CENTER - 210), y + 250, PADDLE_WIDTH, mirrored ? -1 : 1);
    builder.machine('paddle', x(CENTER + 210), y + 400, PADDLE_WIDTH, mirrored ? 1 : -1);
    peg(CENTER + PEG_STAGGER, 180);
    peg(CENTER - PEG_STAGGER, 410);
  } else if (kind === 'seesaw') {
    rails(TILT_RAMPS);
    builder.machine('seesaw', x(CENTER - 180), y + 245, SEESAW_WIDTH);
    builder.machine('seesaw', x(CENTER + 180), y + 425, SEESAW_WIDTH);
    peg(CENTER - 100, 550);
    peg(CENTER + 60, 580);
  } else if (kind === 'trapdoor') {
    rails(GATE_RAMPS);
    builder.machine('door', x(LEFT + DOOR_HINGE_INSET), y + 250,
      DOOR_WIDTH, mirrored ? 1 : -1, timeOffset);
    builder.machine('door', x(RIGHT - DOOR_HINGE_INSET), y + 430,
      DOOR_WIDTH, mirrored ? -1 : 1, timeOffset + TRAP_PERIOD / 2);
    peg(CENTER + PEG_STAGGER, 350);
    peg(CENTER - 60, 570);
  } else {
    for (const [center, outer, inner] of [
      [CENTER - LANE_OFFSET, LEFT, CENTER], [CENTER + LANE_OFFSET, RIGHT, CENTER],
    ]) {
      const direction = center < CENTER ? 1 : -1;
      line(outer, 75, center - direction * CHUTE_HALF_WIDTH, 190);
      line(inner, 75, center + direction * CHUTE_HALF_WIDTH, 190);
      for (const wall of [center - CHUTE_HALF_WIDTH, center + CHUTE_HALF_WIDTH]) {
        line(wall, 190, wall, 365);
      }
      builder.gate(x(center), y + 300);
      peg(center + direction * PEG_STAGGER, 410);
      peg(center - 60, 465);
      peg(center + 60, 465);
      peg(center - direction * PEG_STAGGER, 525);
    }
  }
}
