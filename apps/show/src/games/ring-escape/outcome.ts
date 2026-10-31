import { TEAMS, type RoundResult } from '@chaos/shared';
import type { GameContext } from '../contract';
import { RADII } from './config';
import { deepestFirst, type Runner } from './runners';

export function escapedChampion(runners: Runner[]): Runner | undefined {
  return runners.filter(runner => runner.finished).sort(deepestFirst)[0];
}

export function makeResult(ctx: GameContext, runners: Runner[], faction: boolean,
  champion: Runner | undefined, reason: string): RoundResult {
  const winningTeam = faction ? champion?.team : undefined;
  const winner = winningTeam ? { kind: 'team' as const, teamId: winningTeam }
    : champion ? { kind: 'chat' as const } : { kind: 'void' as const, reason };
  const teams = [...new Set(runners.flatMap(r => r.team ? [r.team] : []))];
  return {
    winner,
    champion: champion ? {
      userId: champion.id, displayName: champion.owner.displayName, reason
    } : undefined,
    standings: faction ? teams.map(teamId => ({
      teamId,
      score: runners.filter(r => r.team === teamId && r.finished).length,
      stat: `${runners.filter(r => r.team === teamId && r.finished).length} escaped`
    })) : undefined,
    mvps: [], highlights: [],
    perUser: Object.fromEntries(runners.map(r => [r.id, {
      score: r.depth,
      tags: r === champion || (winningTeam && r.team === winningTeam) ? ['win'] : []
    }])),
    replay: { seed: ctx.setup.seed, inputs: [] }
  };
}

export function updateHud(ctx: GameContext, runners: Runner[], faction: boolean, sudden = false): void {
  ctx.hud.setLadder?.(Array.from({ length: RADII.length }, (_, index) => ({
    label: `RING ${index + 1}`,
    names: runners.filter(r => r.alive && !r.finished && r.depth === index)
      .sort(deepestFirst).slice(0, 5).map(r => r.owner.displayName)
  })));
  const subtitle = sudden ? 'SUDDEN DEATH: GAPS OPENING' : 'FIRST OUT / LAST SURVIVOR';
  const remaining = runners.filter(runner => runner.alive && !runner.finished).length;
  const countLabel = `${remaining}/${runners.length} marbles`;
  if (!faction) ctx.hud.setSide?.({ subtitle, countLabel });
  if (faction) {
    const teams = [...new Set(runners.flatMap(r => r.team ? [r.team] : []))];
    ctx.hud.setSide?.({
      subtitle,
      countLabel,
      bars: teams.map(team => {
        const escaped = runners.filter(r => r.team === team && r.finished).length;
        return { label: TEAMS[team].name, value: escaped,
          color: TEAMS[team].hex, text: `${escaped} OUT` };
      })
    });
  }
}
