import type { Rng } from '../engine/rng';
export class Vote {
  private votes = new Map<string, string>();
  constructor(readonly options: string[]) {}
  cast(userId: string, option: string): void { if (this.options.includes(option)) this.votes.set(userId, option); }
  counts(): number[] { return this.options.map(o => [...this.votes.values()].filter(v => v === o).length); }
  winner(rng: Rng): string { const counts = this.counts(); const max = Math.max(...counts); return rng.pick(this.options.filter((_o, i) => counts[i] === max)); }
  reset(): void { this.votes.clear(); }
}
