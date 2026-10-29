import type { Rng } from '@chaos/shared';
import { CENTER, PEG_RADIUS } from './config';
import type { Peg } from './types';

export const PEG_PATTERNS = ['rings', 'weave', 'chevrons'] as const;
export type PegPattern = typeof PEG_PATTERNS[number];

/** Different routes, identical target counts and mirrored opportunities. */
export function makeLayout(rng: Rng, pattern?: PegPattern): Peg[] {
  const pairs: { x: number; y: number }[] = [];
  const selected = PEG_PATTERNS[rng.int(0, PEG_PATTERNS.length - 1)];
  pattern ??= selected;
  if (pattern === 'rings') {
    for (const [radius, count] of [[150, 10], [245, 18], [340, 24]]) {
      for (let index = 0; index < count; index++) {
        const angle = (index + .5) * Math.PI / count;
        pairs.push({ x: Math.sin(angle) * radius, y: Math.cos(angle) * radius });
      }
    }
    for (let index = 0; index < 8; index++) {
      const angle = (index + .5) * 1.18 / 8;
      pairs.push({ x: Math.sin(angle) * 430, y: Math.cos(angle) * 430 });
    }
  } else if (pattern === 'weave') {
    // Alternating offset rows split falling streams into repeated branching paths.
    for (let row = 0; row < 10; row++) {
      for (let column = 0; column < 6; column++) {
        pairs.push({ x: 40 + column * 65 + (row % 2) * 12, y: -315 + row * 70 });
      }
    }
  } else {
    // Nested chevrons open a wide center and deflect streams toward the outer slots.
    for (let band = 0; band < 5; band++) {
      for (let column = 0; column < 12; column++) {
        pairs.push({ x: 44 + column * 34, y: -350 + band * 130 + column * 22 });
      }
    }
  }
  const oranges = new Set(rng.shuffle(pairs.map((_, index) => index)).slice(0, 10));
  const pegs: Peg[] = [];
  pairs.forEach((point, pair) => {
    for (const direction of [-1, 1]) {
      const localX = direction * point.x;
      pegs.push({ id: pegs.length, kind: oranges.has(pair) ? 'orange' : 'blue',
        localX, localY: point.y, x: CENTER.x + localX, y: CENTER.y + point.y,
        radius: PEG_RADIUS, removed: false });
    }
  });
  pegs.push({ id: pegs.length, kind: 'gold', x: CENTER.x, y: CENTER.y,
    localX: 0, localY: 0, radius: PEG_RADIUS, removed: false });
  return pegs;
}
