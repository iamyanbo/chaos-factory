export type BallStyle = 'a' | 'b' | 'c';
let selected: BallStyle = 'a';

export function configureBallStyle(value: string | null): void {
  selected = value === 'b' || value === 'c' ? value : 'a';
}

export function ballStyle(): BallStyle { return selected; }
