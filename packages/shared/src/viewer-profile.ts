import type { RoundResult } from './types';
import { TEAMS } from './teams';

const COLORS = ['#9b82ff', '#45c5ff', '#49f5bc', '#ff59bc', '#ff9f43', '#d4ef36',
  '#ff626b', '#41e5de', '#efc14c', '#75a2ff', '#bc68ff', '#7eeb46'];

export function stableViewerColor(userId: string): string {
  let hash = 2166136261;
  for (const character of userId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return COLORS[(hash >>> 0) % COLORS.length];
}

export function roundWinnerLabel(result: RoundResult): string | undefined {
  if (result.winnerLabel) return result.winnerLabel;
  if (result.champion) return '@' + result.champion.displayName;
  if (result.winner.kind === 'team') return TEAMS[result.winner.teamId].name;
  if (result.winner.kind === 'streamer') return result.replay.setup?.streamerName ?? 'Streamer';
  if (result.winner.kind === 'chat') return 'CHAT';
  return undefined;
}

