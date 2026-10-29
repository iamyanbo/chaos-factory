import type { TeamId } from './types';
export const TEAM_IDS: TeamId[] = ['red', 'blue', 'mint', 'gold', 'violet', 'orange'];
export const TEAMS: Record<TeamId, { name: string; color: string; hex: number; shape: string }> = {
  red: { name: 'RED RIOT', color: '#ff5d73', hex: 0xff5d73, shape: '▲' },
  blue: { name: 'BLUE BLITZ', color: '#4db4ff', hex: 0x4db4ff, shape: '●' },
  mint: { name: 'MINT MOB', color: '#5ff2c4', hex: 0x5ff2c4, shape: '■' },
  gold: { name: 'GOLD RUSH', color: '#ffd23f', hex: 0xffd23f, shape: '★' },
  violet: { name: 'VIOLET VOID', color: '#a98bff', hex: 0xa98bff, shape: '◆' },
  orange: { name: 'ORANGE CRUSH', color: '#ff9a3d', hex: 0xff9a3d, shape: '⬢' }
};
export function predictionTitle(title: string, mode: 'cvs' | 'faction'): string {
  const suffix = mode === 'cvs' ? ': CHAT or STREAMER?' : ': WHICH TEAM WINS?';
  return title.slice(0, 45 - suffix.length) + suffix;
}
