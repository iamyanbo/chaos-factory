import type { HypeEvent, HypeSubject } from '@chaos/shared';
export type { HypeEvent, HypeKind, HypeStamp, HypeSubject } from '@chaos/shared';

export interface HypeSink {
  at(time: number): void;
  decisive(x: number, y: number, subject?: HypeSubject): void;
  nearMiss(x: number, y: number, subject?: HypeSubject): void;
  jackpot(x: number, y: number, subject?: HypeSubject): void;
  kill(x: number, y: number, subject?: HypeSubject): void;
  combo(x: number, y: number, subject?: HypeSubject): void;
  win(x: number, y: number, subject?: HypeSubject): void;
  callout(x: number, y: number, subject: HypeSubject): void;
  drain(): HypeEvent[];
}
