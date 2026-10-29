export const HYPE_KINDS = ['decisive', 'nearMiss', 'jackpot', 'kill', 'combo', 'win', 'callout'] as const;
export type HypeKind = typeof HYPE_KINDS[number];
export const HYPE_STAMPS = ['CLUTCH!', 'UPSET!', 'JACKPOT!', 'DOUBLE KILL', 'SO CLOSE',
  'COMEBACK', 'DETHRONED', 'FREE BALL!', 'EXTREME FEVER', 'RAGE!'] as const;
export type HypeStamp = typeof HYPE_STAMPS[number];
export interface HypeSubject {
  userId?: string;
  name?: string;
  color?: number;
  key?: string;
  text?: HypeStamp;
}
export interface HypeEvent extends HypeSubject {
  t: 'hype';
  kind: HypeKind;
  time: number;
  x: number;
  y: number;
  count?: number;
}
