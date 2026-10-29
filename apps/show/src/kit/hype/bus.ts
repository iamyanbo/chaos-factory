import { Rng } from '@chaos/shared';
import type { HypeEvent, HypeKind, HypeSink, HypeSubject } from './types';

const QUEUE_LIMIT = 128;
const COMBO_GAP = 1;
const NEAR_MISS_GAP = 1.5;
const JACKPOT_GAP = 1;
const MAX_DECISIVE = 2;

/** Simulation-time telemetry only. This class never imports rendering or physics. */
export class HypeBus implements HypeSink {
  private time = 0;
  private queue: HypeEvent[] = [];
  private decisiveCount = 0;
  private won = false;
  private lastJackpot = -Infinity;
  private combos = new Map<string, { time: number; count: number }>();
  private nearMisses = new Map<string, number>();

  constructor(private emit: (event: HypeEvent) => void = () => {}, private retain = true) {}

  at(time: number): void {
    if (Number.isFinite(time)) this.time = Math.max(this.time, time);
  }

  private event(kind: HypeKind, x: number, y: number, subject: HypeSubject = {}, count?: number): void {
    if (!Number.isFinite(x + y)) return;
    const event: HypeEvent = { t: 'hype', kind, time: this.time, x, y, ...subject, count };
    if (this.retain) {
      if (this.queue.length >= QUEUE_LIMIT) this.queue.shift();
      this.queue.push(event);
    }
    this.emit(event);
  }

  decisive(x: number, y: number, subject?: HypeSubject): void {
    if (this.decisiveCount >= MAX_DECISIVE) return;
    this.decisiveCount++;
    this.event('decisive', x, y, subject);
  }

  nearMiss(x: number, y: number, subject: HypeSubject = {}): void {
    const key = subject.key ?? subject.userId ?? 'leader';
    if (this.time - (this.nearMisses.get(key) ?? -Infinity) < NEAR_MISS_GAP) return;
    this.nearMisses.set(key, this.time);
    this.event('nearMiss', x, y, { ...subject, text: 'SO CLOSE' });
  }

  jackpot(x: number, y: number, subject: HypeSubject = {}): void {
    if (this.time - this.lastJackpot < JACKPOT_GAP) return;
    this.lastJackpot = this.time;
    this.event('jackpot', x, y, { ...subject, text: subject.text ?? 'JACKPOT!' });
  }

  kill(x: number, y: number, subject: HypeSubject = {}): void {
    this.event('kill', x, y, subject);
  }

  combo(x: number, y: number, subject: HypeSubject = {}): void {
    const key = subject.key ?? subject.userId ?? 'hits';
    const before = this.combos.get(key);
    const count = before && this.time - before.time <= COMBO_GAP ? before.count + 1 : 1;
    this.combos.set(key, { time: this.time, count });
    this.event('combo', x, y, subject, count);
  }

  win(x: number, y: number, subject?: HypeSubject): void {
    if (this.won) return;
    this.won = true;
    this.event('win', x, y, subject);
  }

  callout(x: number, y: number, subject: HypeSubject): void {
    this.event('callout', x, y, subject);
  }

  drain(): HypeEvent[] {
    const queued = this.queue;
    this.queue = [];
    return queued;
  }
}

/** Arms a celebration on one third of seeds; callers still require a real feat.
 * Its independent RNG never consumes a game's physics RNG or changes an outcome.
 */
export class RareCelebration {
  readonly armed: boolean;
  private paid = false;
  constructor(seed: number) { this.armed = new Rng(seed ^ 0x48f102c3).next() < 1 / 3; }
  celebrate(hype: HypeSink, x: number, y: number, subject?: HypeSubject): boolean {
    if (!this.armed || this.paid) return false;
    this.paid = true;
    hype.jackpot(x, y, subject);
    return true;
  }
}
