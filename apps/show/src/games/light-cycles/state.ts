import type { RoundResult } from '@chaos/shared';
import type { GameContext } from '../contract';
import { SIDEBAR_NAMES } from './config';
import type { LightModel } from './model';

export function buildResult(ctx: GameContext, model: LightModel, champion?: number,
  reason = 'No lone survivor: simultaneous crash'): RoundResult {
  const winner = champion === undefined ? undefined : ctx.setup.participants[champion];
  const order = [...model.cycles].sort((a, b) => Number(b.alive) - Number(a.alive)
    || (b.diedAt ?? model.time) - (a.diedAt ?? model.time) || a.ordinal - b.ordinal);
  return {
    winner: winner ? { kind: 'chat' } : { kind: 'void', reason },
    champion: winner ? { userId: winner.userId, displayName: winner.displayName,
      reason: 'LAST CYCLE STILL RIDING' } : undefined,
    mvps: [], highlights: [],
    perUser: Object.fromEntries(order.map((cycle, index) => [ctx.setup.participants[cycle.ordinal].userId,
      { score: cycle.diedAt ?? model.time,
        tags: [`place:${index + 1}`, ...(cycle.ordinal === champion ? ['win'] : [])] }])),
    replay: { seed: ctx.setup.seed, inputs: [] }
  };
}

export function updateHud(ctx: GameContext, model: LightModel, feed: string[]): void {
  const alive = model.cycles.filter(cycle => cycle.alive);
  ctx.hud.setSide?.({
    subtitle: 'LAST CYCLE STILL RIDING WINS',
    countLabel: `${alive.length} / ${model.cycles.length} still riding`,
    rows: [{ label: 'STILL RIDING', names: alive.slice(0, SIDEBAR_NAMES)
      .map(cycle => ctx.setup.participants[cycle.ordinal].displayName) }],
    feed
  });
}
