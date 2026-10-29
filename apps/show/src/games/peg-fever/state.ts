import { TEAMS, type RoundResult, type TeamId } from '@chaos/shared';
import type { GameContext } from '../contract';
import type { PegScoring } from './scoring';
import { BALLS_PER_VIEWER } from './config';

export function playerTeam(ctx: GameContext, ordinal: number): TeamId {
  const teams = ctx.setup.teams ?? ['red', 'blue'];
  return ctx.setup.participants[ordinal].teamId ?? teams[ordinal % teams.length];
}

export function ranking(score: PegScoring): number[] {
  return score.scores.map((_, ordinal) => ordinal).sort((a, b) => score.scores[b] - score.scores[a]
    || score.oranges[b] - score.oranges[a] || score.hits[b] - score.hits[a] || a - b);
}

export function teamTotals(ctx: GameContext, score: PegScoring) {
  const teams = ctx.setup.teams ?? [...new Set(ctx.setup.participants.map((_, index) => playerTeam(ctx, index)))];
  return teams.map(teamId => {
    const players = score.scores.map((_, ordinal) => ordinal).filter(index => playerTeam(ctx, index) === teamId);
    return { teamId, score: players.reduce((sum, index) => sum + score.scores[index], 0),
      oranges: players.reduce((sum, index) => sum + score.oranges[index], 0),
      hits: players.reduce((sum, index) => sum + score.hits[index], 0) };
  }).sort((a, b) => b.score - a.score || b.oranges - a.oranges || b.hits - a.hits);
}

export function makeResult(ctx: GameContext, score: PegScoring): RoundResult {
  const order = ranking(score);
  const faction = ctx.setup.mode === 'faction';
  const standings = teamTotals(ctx, score);
  const team = faction ? standings[0]?.teamId : undefined;
  const best = order.find(index => !faction || playerTeam(ctx, index) === team);
  const champion = best === undefined ? undefined : ctx.setup.participants[best];
  return {
    winner: !champion ? { kind: 'void', reason: 'No entrants' } : team
      ? { kind: 'team', teamId: team } : { kind: 'chat' },
    champion: champion ? { userId: champion.userId, displayName: champion.displayName,
      reason: 'Highest total when the last ball landed' } : undefined,
    standings: faction ? standings.map(row => ({ teamId: row.teamId, score: row.score,
      stat: `${row.score.toLocaleString()} POINTS` })) : undefined,
    mvps: [], highlights: [],
    perUser: Object.fromEntries(ctx.setup.participants.map((player, index) => [player.userId, {
      score: score.scores[index], tags: [`place:${order.indexOf(index) + 1}`,
        `pegs:${score.hits[index]}`, `orange:${score.oranges[index]}`, `landed:${score.landed[index]}`,
        ...(faction ? [`team:${playerTeam(ctx, index)}`] : []),
        ...((team ? playerTeam(ctx, index) === team : best === index) ? ['win'] : [])]
    }])), replay: { seed: ctx.setup.seed, inputs: [] }
  };
}

export function updateHud(ctx: GameContext, score: PegScoring, fever: boolean,
  sudden: boolean, active: number, lastBalls: boolean): void {
  const leaders = ranking(score).slice(0, 5);
  const teams = teamTotals(ctx, score);
  const recent = score.landings.slice(-3).reverse();
  const landed = score.landings.length;
  const total = ctx.setup.participants.length * BALLS_PER_VIEWER;
  ctx.hud.setSide?.({
    countLabel: lastBalls ? `LAST BALLS / ${active} IN FLIGHT` : `${landed} / ${total} BALLS LANDED`,
    subtitle: fever ? 'FEVER / ALL SLOTS x2' : sudden ? 'SUDDEN DEATH / PEG RACK LIFTS'
      : 'BLUE 10 / ORANGE 50 / GOLD x2',
    rows: [
      ...(ctx.setup.mode === 'faction' ? [{ label: 'TEAM TOTALS', names: teams.map(team =>
        `${TEAMS[team.teamId].name}: ${team.score.toLocaleString()}`) }] : []),
      { label: 'TOP 5 / TOTAL POINTS', names: leaders.map(index =>
        `${ctx.setup.participants[index].displayName}: ${score.scores[index].toLocaleString()}`) },
      { label: 'JUST LANDED / OWNER TOTAL', names: recent.map(landing =>
        `${ctx.setup.participants[landing.owner].displayName}: ${score.scores[landing.owner].toLocaleString()}`) }
    ],
    feed: [`${score.remaining} / 20 orange pegs left`,
      `${BALLS_PER_VIEWER} balls each / join order`,
      'Lit pegs clear when their ball lands',
      fever ? 'Gold slots stay doubled' : 'Last orange doubles every slot'],
    bars: []
  });
}
