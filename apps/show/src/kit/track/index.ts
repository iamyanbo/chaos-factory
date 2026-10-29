import type { GameContext } from '../../games/contract';
export interface TrackPiece { x: number; y: number; w: number; h: number; angle: number; kind: string }
export function buildTrack(ctx: GameContext, spec: { x: number; y: number; width: number; height: number; pegs?: number }): TrackPiece[] {
  const parts: TrackPiece[] = [];
  function box(x: number, y: number, w: number, h: number, angle = 0, kind = 'rail'): void { parts.push({ x, y, w, h, angle, kind }); ctx.physics.box(x, y, w, h, { dynamic: false, angle, restitution: .35 }); }
  box(spec.x, spec.y + spec.height / 2, 20, spec.height); box(spec.x + spec.width, spec.y + spec.height / 2, 20, spec.height);
  const gap = 68; const cols = Math.min(spec.pegs ?? 9, Math.floor(spec.width / gap) - 1); const spacing = spec.width / (cols + 1);
  for (let row = 0; row < 5; row++) for (let col = 0; col < cols; col++) {
    const x = spec.x + spacing * (col + .7 + (row % 2) * .4); const y = spec.y + 110 + row * (spec.height - 180) / 5;
    ctx.physics.ball(x, y, 8, { dynamic: false, restitution: .75 }); parts.push({ x, y, w: 16, h: 16, angle: 0, kind: 'peg' });
  }
  return parts;
}
