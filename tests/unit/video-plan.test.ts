import { expect, test } from 'vitest';
import { submissionVideoPlan, type CupVideo, type CrowdVideo } from '../../tools/video-plan';
import { EDIT_BEAT_SECONDS, INTRO_SECONDS } from '../../tools/video-rhythm';

function cup(): CupVideo {
  const transitions = ['multiplier-cascade', 'hot-potato', 'peg-fever', 'marble-race', 'blade-brawl']
    .flatMap((game, index) => [
      { game, round: index + 1, phase: 'PLAY', stage: 0, wall: index * 100 + 5 },
      { game, round: index + 1, phase: 'PLAY', stage: 1, wall: index * 100 + 30 },
      { game, round: index + 1, phase: 'RESULT', stage: 2, wall: index * 100 + (game === 'marble-race' ? 90 : 80) },
      { game, round: index + 1, phase: index === 4 ? 'CUP_RESULTS' : 'STANDINGS', stage: 2,
        wall: index * 100 + (game === 'marble-race' ? 96 : 86) }
    ]);
  return { transitions, wallSeconds: 493, media: { duration: 493 } };
}

function crowd(): CrowdVideo {
  return { mode: 'mock', viewers: 48, startedAt: 11, playAt: 14,
    joins: Array.from({ length: 48 }, (_, index) => ({ wall: 2 + index / 8, name: `viewer_${index}`, color: '#ff4f7b' })),
    media: { duration: 23 } };
}
const live = { mode: 'live', joinedAt: 12, startedAt: 15,
  member: { displayName: 'iamyanbo' }, media: { duration: 42 } };

test('populated join stays continuous; the actual Twitch test is a separately labeled inset', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const duration = plan.reduce((sum, row) => sum + row.seconds, 0);
  expect(duration).toBeGreaterThan(80);
  expect(duration).toBeLessThan(120);
  expect(plan[0].source).toBe('title');
  const join = plan.find(row => row.source === 'crowd')!;
  expect(join.evidence).toBe('mock');
  expect(join.inset).toMatchObject({ evidence: 'real-chat', name: 'iamyanbo', seconds: 4 });
  expect(join.inset!.at + join.inset!.seconds).toBeLessThanOrEqual(join.seconds);
  expect(join.from).toBeLessThan(crowd().joins[0].wall);
  expect(join.from + join.seconds).toBeGreaterThan(crowd().playAt! + 4);
});

test('chapter boundaries land on the measured music pulse without shortening reviewed gameplay', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  let elapsed = 0;
  for (const segment of plan.slice(0, -1)) {
    elapsed += segment.seconds;
    const beat = Math.round((elapsed - INTRO_SECONDS) / EDIT_BEAT_SECONDS);
    const exact = INTRO_SECONDS + beat * EDIT_BEAT_SECONDS;
    expect(Math.abs(elapsed - exact)).toBeLessThanOrEqual(1 / 60 + 1e-7);
  }
  expect(plan.filter(row => row.chapter).map(row => row.chapter)).toEqual([1, 2, 3, 4, 5]);
  expect(plan.find(row => row.title === 'HOT POTATO')!.seconds).toBeGreaterThanOrEqual(20);
  expect(plan.find(row => row.title === 'MARBLE RACE')!.seconds).toBeGreaterThanOrEqual(12);
});

test('editorial impacts stay within the retained source shot and never carry across a cut', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const cues = plan.flatMap(segment => (segment.cues ?? []).map(cue => ({ segment, cue })));
  expect(cues).toHaveLength(4);
  for (const { segment, cue } of cues) {
    expect(cue.at).toBeGreaterThan(1);
    expect(cue.at + cue.seconds).toBeLessThan(segment.seconds - .2);
    expect(segment.source).toBe('cup');
  }
  expect(plan.find(row => row.cues?.some(cue => cue.kind === 'score'))?.title).toBe('PEG FEVER');
});

test('all five games use their actual names and rules; the whole-project credit appears once', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const games = plan.filter(row => row.source === 'cup' && row.title !== 'TOP EIGHT' && row.body);
  expect(games.map(row => row.title)).toEqual([
    'MULTIPLIER CASCADE', 'HOT POTATO', 'PEG FEVER', 'MARBLE RACE', 'BLADE BRAWL'
  ]);
  const credits = plan.filter(row => row.credit);
  expect(credits).toHaveLength(1);
  expect(credits[0].credit).toBe('Codex implemented the entire project.\nI directed and reviewed it.');
  expect(plan.slice(-2).map(row => row.source)).toEqual(['cup', 'outro']);
  expect(plan.at(-2)?.title).toBe('');
  expect(plan.filter(row => row.source === 'cup').every(row => row.from >= 0
    && row.from + row.seconds <= cup().media.duration)).toBe(true);
});

test('Hot Potato includes the reviewed fuse expiries and aftermath instead of only two quiet survivors', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const potato = plan.find(row => row.title === 'HOT POTATO')!;
  const play = cup().transitions.find(row => row.game === 'hot-potato' && row.phase === 'PLAY')!.wall;
  const firstBlast = play + 11.83;
  const secondBlast = play + 22.13;
  expect(potato.from).toBeLessThan(firstBlast - 1);
  expect(potato.from + potato.seconds).toBeGreaterThan(secondBlast + 3);
  expect(potato.seconds).toBeGreaterThanOrEqual(20);
});

test('sparse joins and mock chat cannot be passed off as real Twitch evidence', () => {
  expect(() => submissionVideoPlan(cup(), live, { ...crowd(), joins: crowd().joins.slice(0, 1) })).toThrow('populated mock lobby');
  expect(() => submissionVideoPlan(cup(), { ...live, mode: 'mock' }, crowd())).toThrow('Real Twitch join proof');
  const draft = submissionVideoPlan(cup(), undefined, crowd(), true);
  expect(draft.some(row => row.inset)).toBe(false);
  expect(draft.find(row => row.source === 'crowd')?.evidence).toBe('mock');
});

test('missing game, standings or champion footage cannot be replaced with fabricated results', () => {
  for (const [phase, game, message] of [
    ['PLAY', 'peg-fever', 'Missing completed peg-fever'],
    ['STANDINGS', 'marble-race', 'standings'],
    ['CUP_RESULTS', 'blade-brawl', 'champion']
  ]) {
    const missing = cup();
    missing.transitions = missing.transitions.filter(row => row.phase !== phase || row.game !== game);
    expect(() => submissionVideoPlan(missing, live, crowd())).toThrow(message);
  }
});
