const HOLD_SECONDS = 1;
const MAX_SAMPLES = 128;

/** Presentation observes recent earned combos; other entrants cannot prolong an old peak. */
export class ComboWindow {
  private samples: { time: number; count: number }[] = [];

  add(time: number, count: number): void {
    this.samples.push({ time, count });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  value(time: number): number {
    this.samples = this.samples.filter(sample => time - sample.time < HOLD_SECONDS);
    return Math.max(0, ...this.samples.map(sample => sample.count));
  }

  clear(): void { this.samples = []; }
}
