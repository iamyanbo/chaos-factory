export interface ViewerProfile {
  userId: string;
  login: string;
  displayName: string;
  color: string;
  wins: number;
  cupsWon: number;
  xp: number;
  level: number;
  title: string;
  gameWins: Record<string, number>;
}

const COLORS = ['#9b82ff', '#45c5ff', '#49f5bc', '#ff59bc', '#ff9f43', '#d4ef36',
  '#ff626b', '#41e5de', '#efc14c', '#75a2ff', '#bc68ff', '#7eeb46'];

export const PROFILE_TITLES = [
  { title: 'Ring Runner', game: 'ring-escape', wins: 3 },
  { title: 'Blade Master', game: 'blade-brawl', wins: 3 },
  { title: 'Cup Champion', cups: 1 }
] as const;

export function stableViewerColor(userId: string): string {
  let hash = 2166136261;
  for (const character of userId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return COLORS[(hash >>> 0) % COLORS.length];
}

export function profileLevel(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 10));
}

export function profileTitle(profile: ViewerProfile): string {
  for (const rule of [...PROFILE_TITLES].reverse()) {
    if ('cups' in rule && profile.cupsWon >= rule.cups) return rule.title;
    if ('game' in rule && (profile.gameWins[rule.game] ?? 0) >= rule.wins) return rule.title;
  }
  return '';
}

export function newViewerProfile(user: { userId: string; login: string; displayName: string }): ViewerProfile {
  return { userId: user.userId, login: user.login, displayName: user.displayName,
    color: stableViewerColor(user.userId), wins: 0, cupsWon: 0,
    xp: 0, level: 1, title: '', gameWins: {} };
}

export function roundWinnerLabel(result: RoundResult): string | undefined {
  if (result.winnerLabel) return result.winnerLabel;
  if (result.champion) return '@' + result.champion.displayName;
  if (result.winner.kind === 'team') return TEAMS[result.winner.teamId].name;
  if (result.winner.kind === 'streamer') return result.replay.setup?.streamerName ?? 'Streamer';
  if (result.winner.kind === 'chat') return 'CHAT';
  return undefined;
}

export interface CupStanding {
  userId: string;
  displayName: string;
  color: string;
  points: number;
  wins: number;
  rank: number;
  previousRank: number;
  level: number;
  title: string;
  crowned: boolean;
}

export interface RoundAward {
  userId: string;
  login: string;
  displayName: string;
  points: number;
  place: number;
  won: boolean;
  reason: string;
}

export interface CupRoundRecord {
  cupId: string;
  round: number;
  final: boolean;
  awards: RoundAward[];
  championId?: string;
}
import type { RoundResult } from './types';
import { TEAMS } from './teams';

