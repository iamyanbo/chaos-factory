import { TEAMS, type RoundResult } from '@chaos/shared';
import type { GameContext } from '../../games/contract';

/** Shared winner identity for every automatic game, also usable by raw sims. */
export function celebrateResult(ctx: GameContext, result: RoundResult,
  point = { x: 960, y: 540 }): void {
  const winner = result.winner;
  if (winner.kind === 'void') return;
  const champion = result.champion;
  const owner = ctx.setup.participants.find(player => player.userId === champion?.userId);
  const name = result.winnerLabel ?? champion?.displayName ?? (winner.kind === 'team' ? TEAMS[winner.teamId].name
    : winner.kind === 'streamer' ? ctx.setup.streamerName : 'CHAT WINS');
  const parsed = Number.parseInt(owner?.color.replace('#', '') ?? '', 16);
  const color = result.winnerColor ?? (winner.kind === 'team' ? TEAMS[winner.teamId].hex
    : Number.isFinite(parsed) ? parsed : winner.kind === 'streamer' ? 0xffd86b : 0xa28bff);
  ctx.hype.win(point.x, point.y, { userId: champion?.userId, name, color });
}
