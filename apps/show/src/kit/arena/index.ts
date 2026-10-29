import type { GameContext } from '../../games/contract';
export function boxArena(ctx: GameContext, x = 130, y = 200, w = 1650, h = 650): void {
  ctx.physics.box(x - 15, y + h / 2, 30, h, { dynamic: false }); ctx.physics.box(x + w + 15, y + h / 2, 30, h, { dynamic: false });
  ctx.physics.box(x + w / 2, y - 15, w, 30, { dynamic: false }); ctx.physics.box(x + w / 2, y + h + 15, w, 30, { dynamic: false });
}
