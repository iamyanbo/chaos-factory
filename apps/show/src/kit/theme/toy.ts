import { TEAMS } from '@chaos/shared';

/** Doc 24 is the single visual source. None of these values configure physics. */
export const TOY = {
  color: {
    backgroundTop: 0xffd56b, backgroundBottom: 0xff8f6b,
    floorCenter: 0x5fc9f8, floorEdge: 0x3a8ee6, rimShadow: 0x1d4f9c,
    ink: 0x1b1b3a, white: 0xffffff, accentA: 0x3a8ee6, accentB: 0xff4f7b,
    yellow: 0xffde3b, muted: 0x50506b, track: 0xffe1eb, pale: 0xe9f3ff,
    green: 0x2ecc71, purple: 0x8e5cff, cyan: 0x00c2d1, orange: 0xff7a1a,
  },
  palette: [0xff4f7b, 0xffb000, 0x2ecc71, 0x8e5cff, 0x00c2d1, 0xff7a1a, 0xe84393, 0x4b7bec],
  font: { display: 'Lilita One', body: 'Fredoka' },
  type: { title: 54, label: 20, number: 44, body: 26, small: 24, name: 24, callout: 110 },
  card: { radius: 26, border: 5, shadow: 8, shadowAlpha: .2, padX: 26, padY: 22 },
  bar: { height: 26, easeSeconds: .16 },
  wall: { width: 14, outline: 4, underside: 6, rim: 26, rimDrop: 10 },
  ball: { radius: 20, crowdedRadius: 16, crowdedAt: 40, outline: 4,
    shadowAlpha: .25, shadowDrop: 5, hitSeconds: .08 },
  pattern: { radius: 5, grid: 48, alpha: .22, ringAlpha: .08 },
  layout: { width: 1920, height: 1080, column: 380, margin: 40, gap: 22,
    left: 40, right: 1500, arenaLeft: 420, arenaRight: 1500,
    worldScale: .94, centerX: 960, centerY: 540 },
  boards: {
    'blade-brawl': { shape: 'circle', x: 460, y: 40, width: 1000, height: 1000, rim: true },
    'ring-escape': { shape: 'circle', x: 460, y: 40, width: 1000, height: 1000, rim: true },
    'hot-potato': { shape: 'circle', x: 500, y: 80, width: 920, height: 920, rim: false },
    'pong-wars': { shape: 'panel', x: 420, y: 0, width: 1080, height: 1080, rim: true },
    'light-cycles': { shape: 'panel', x: 420, y: 0, width: 1080, height: 1080, rim: true },
    'marble-race': { shape: 'panel', x: 470, y: 24, width: 980, height: 1032, rim: true },
    'peg-fever': { shape: 'panel', x: 484, y: 46, width: 952, height: 1014, rim: true },
    'multiplier-cascade': { shape: 'panel', x: 480, y: 24, width: 960, height: 1032, rim: true },
  },
} as const;

export const cssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
const surfaceColors = new Set<number>(Object.values(TOY.color));
const paletteColors = new Map<number, number>([
  [TEAMS.red.hex, TOY.palette[0]], [TEAMS.blue.hex, TOY.palette[7]],
  [TEAMS.mint.hex, TOY.palette[2]], [TEAMS.gold.hex, TOY.palette[1]],
  [TEAMS.violet.hex, TOY.palette[3]], [TEAMS.orange.hex, TOY.palette[5]],
  [0xff626b, TOY.palette[0]], [0x36baff, TOY.palette[7]],
  [0x22e6ce, TOY.palette[2]], [0xe8ed52, TOY.palette[1]],
]);
for (const color of TOY.palette) paletteColors.set(color, color);

export function shade(color: number, factor: number): number {
  const channel = (shift: number) => Math.round(Math.min(255, ((color >> shift) & 255) * factor));
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}

/** Presentation mapping preserves source/team identity and never rewrites game data. */
export function toyColor(color: number): number {
  if (color === TOY.color.white || color === TOY.color.ink) return color;
  const mapped = paletteColors.get(color);
  if (mapped !== undefined) return mapped;
  const hue = (value: number) => {
    const r = (value >> 16 & 255) / 255;
    const g = (value >> 8 & 255) / 255;
    const b = (value & 255) / 255;
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    const delta = high - low;
    if (!delta) return 0;
    const sector = high === r ? (g - b) / delta : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return (sector * 60 + 360) % 360;
  };
  const target = hue(color);
  const distance = (candidate: number) => {
    const delta = Math.abs(target - hue(candidate));
    return Math.min(delta, 360 - delta);
  };
  const result = TOY.palette.reduce((best, candidate) => distance(candidate) < distance(best) ? candidate : best);
  paletteColors.set(color, result);
  return result;
}

export function surfaceColor(color: number): number {
  return surfaceColors.has(color) ? color : toyColor(color);
}

export interface Box { x: number; y: number; width: number; height: number }
export interface ArenaBounds extends Box { shape?: 'circle' | 'panel' }
export const ARENA_BOX: Box = { x: 448, y: 28, width: 1024, height: 1024 };
export const worldPixels = (pixels: number): number => pixels / TOY.layout.worldScale;

export function worldToScreen(point: { x: number; y: number }): { x: number; y: number } {
  const { centerX, centerY, worldScale } = TOY.layout;
  return { x: centerX + (point.x - centerX) * worldScale,
    y: centerY + (point.y - centerY) * worldScale };
}

export function arenaBounds(gameId: string): ArenaBounds {
  const board = TOY.boards[gameId as keyof typeof TOY.boards] ?? TOY.boards['blade-brawl'];
  const point = worldToScreen(board);
  const inset = TOY.wall.rim;
  return { x: point.x + inset, y: point.y + inset,
    width: board.width * TOY.layout.worldScale - inset * 2,
    height: board.height * TOY.layout.worldScale - inset * 2, shape: board.shape };
}
