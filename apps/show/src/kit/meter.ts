export class Meter {
  private active = new Map<string, number>(); private cooldownUntil = 0;
  constructor(readonly windowSec = 6, readonly threshold = .55) {}
  add(userId: string, time: number): void { this.active.set(userId, time); }
  value(time: number, eligible: number): number { for (const [id, t] of this.active) if (time - t > this.windowSec) this.active.delete(id); return Math.min(1, this.active.size / Math.max(1, eligible) / this.threshold); }
  consume(time: number, eligible: number): boolean { if (time < this.cooldownUntil || this.value(time, eligible) < 1) return false; this.active.clear(); this.cooldownUntil = time + 4; return true; }
}
