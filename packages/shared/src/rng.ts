function hash(s: string): number { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export class Rng {
  private state: number;
  constructor(readonly seed: number) { this.state = seed >>> 0; }
  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number { return lo + (hi - lo) * this.next(); }
  int(lo: number, hi: number): number { return Math.floor(this.range(lo, hi + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(items: readonly T[]): T { if (!items.length) throw new Error('Empty RNG choice'); return items[this.int(0, items.length - 1)]; }
  shuffle<T>(items: readonly T[]): T[] { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = this.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    let n = this.range(0, items.reduce((sum, x) => sum + Math.max(0, x.weight), 0));
    for (const x of items) { n -= Math.max(0, x.weight); if (n <= 0) return x.value; } return items[items.length - 1].value;
  }
  fork(label: string): Rng { return new Rng(hash(`${this.seed}:${label}`)); }
}
