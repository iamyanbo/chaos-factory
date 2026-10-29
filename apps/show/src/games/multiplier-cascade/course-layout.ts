export const COURSE = {
  left: 480, right: 1440, top: 24, bottom: 3520, bankY: 3475, viewHeight: 1080,
};
export const CAMERA_ZOOM = 1;
export const CAMERA_HEIGHT = 1080;
export const LINE_WIDTH = 8;
export const GATE_Y = [380, 780, 1180, 1580, 1980, 2380, 2780, 3180];
const HOLDING_FLOOR_OFFSET = 64;
export const SHELF_Y = GATE_Y.map(y => y - HOLDING_FLOOR_OFFSET);
export const RELEASE_AT = [3.5, 8, 12.5, 17, 21.5, 26, 30.5, 35];
export const FACTORS = [2, 2, 3, 2, 2, 3, 2, 3];
// The outer bypass survives. Drains are bounded red mouths, not the whole wall lane.
export const PORTS = [
  { start: 0, width: .64, multiply: true, factor: 1 },
  { start: .64, width: .14, multiply: false, factor: 1 },
  { start: .78, width: .12, multiply: false, factor: 0 },
  { start: .9, width: .1, multiply: false, factor: 1 },
];
export const BALL_RADIUS = 16;
export const GRAVITY = 4.25;
export const FEEDER_Y = 40;
export const HATCH_Y = 80;
export const HATCH_PANEL_WIDTH = 40;
export const SHELF_PANELS = 4;
export const FLAP_RETRACT_SECONDS = .5;
export const GATE_SWING_SECONDS = .75;
export const HATCH_SWING_SECONDS = .5;
export const CLEAR_AT = 40;
export const EXPIRE_AT = 75;
export const CHAMBERS = ['PINWHEELS', 'SPLIT BRIDGES', 'PEG MAZE', 'SWEEPERS',
  'GIANT ROTOR', 'CROSSROADS', 'TWIN ROTORS', 'FINAL SPLIT', 'FINISH'];
export const RELAY_TOP = COURSE.bottom + 100;
