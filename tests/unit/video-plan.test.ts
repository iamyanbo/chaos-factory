import { expect, test } from 'vitest';
import { submissionVideoPlan, type CupVideo } from '../../tools/video-plan';

function cup(): CupVideo {
  const transitions = ['multiplier-cascade', 'hot-potato', 'peg-fever', 'marble-race', 'blade-brawl']
    .flatMap((game, index) => [
      { game, round: index + 1, phase: 'PLAY', stage: 0, wall: index * 100 + 5 },
      { game, round: index + 1, phase: 'PLAY', stage: 1, wall: index * 100 + 30 },
      { game, round: index + 1, phase: 'RESULT', stage: 2, wall: index * 100 + 80 },
      { game, round: index + 1, phase: index === 4 ? 'CUP_RESULTS' : 'STANDINGS', stage: 2, wall: index * 100 + 86 }
    ]);
  return { transitions, wallSeconds: 493, media: { duration: 493 } };
}

test('story cut uses real phases, compact join proof and a complete Cup payoff under two minutes', () => {
  const plan = submissionVideoPlan(cup(), { mode: 'live', joinedAt: 12, startedAt: 15,
    member: { displayName: 'iamyanbo' }, media: { duration: 42 } });
  const duration = plan.reduce((sum, row) => sum + row.seconds, 0);
  expect(duration).toBeGreaterThan(80);
  expect(duration).toBeLessThan(120);
  expect(plan.find(row => row.evidence === 'real-chat')).toMatchObject({ source: 'live', from: 11 });
  expect(plan.filter(row => row.evidence === 'real-chat').reduce((sum, row) => sum + row.seconds, 0)).toBeLessThan(15);
  expect(plan.filter(row => row.source === 'brief' || row.source === 'review')).toHaveLength(2);
  expect(plan.slice(0, 3).every(row => row.crop && row.crop.x >= 0 && row.crop.y >= 0
    && row.crop.x + row.crop.width <= 1920 && row.crop.y + row.crop.height <= 1080)).toBe(true);
  expect(plan.filter(row => row.source === 'cup').every(row => row.from >= 0
    && row.from + row.seconds <= cup().media.duration)).toBe(true);
});

test('never labels missing or mock chat proof as real Twitch', () => {
  expect(() => submissionVideoPlan(cup())).toThrow('Real Twitch join proof is missing');
  const draft = submissionVideoPlan(cup(), undefined, true);
  expect(draft.some(row => row.evidence === 'real-chat')).toBe(false);
  expect(draft.find(row => row.source === 'pending')?.body).toContain('offline preview');
});

test('incomplete games or missing standings cannot be replaced with fabricated results', () => {
  const missing = cup();
  missing.transitions = missing.transitions.filter(row => row.game !== 'peg-fever');
  expect(() => submissionVideoPlan(missing, undefined, true)).toThrow('Missing completed peg-fever');
  const noStandings = cup();
  noStandings.transitions = noStandings.transitions.filter(row => row.phase !== 'STANDINGS');
  expect(() => submissionVideoPlan(noStandings, undefined, true)).toThrow('standings are missing');
});
