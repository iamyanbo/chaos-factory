import { expect, test } from 'vitest';
import { submissionVideoPlan, type CupVideo, type CrowdVideo } from '../../tools/video-plan';
import { EDIT_BEAT_SECONDS, INTRO_SECONDS } from '../../tools/video-rhythm';
import { CHAPTER_TIMING, TITLE_CREDIT } from '../../tools/video-titles';

function cup(): CupVideo {
  const transitions = ['multiplier-cascade', 'hot-potato', 'peg-fever', 'marble-race', 'blade-brawl']
    .flatMap((game, index) => [
      { game, round: index + 1, phase: 'PLAY', stage: 0, wall: index * 100 + 5 },
      { game, round: index + 1, phase: 'PLAY', stage: 1, wall: index * 100 + 30 },
      { game, round: index + 1, phase: 'RESULT', stage: 2, wall: index * 100 + (['marble-race', 'blade-brawl'].includes(game) ? 96 : 80) },
      { game, round: index + 1, phase: index === 4 ? 'CUP_RESULTS' : 'STANDINGS', stage: 2,
        wall: index * 100 + (['marble-race', 'blade-brawl'].includes(game) ? 102 : 86) }
    ]);
  return { transitions, wallSeconds: 510, media: { duration: 510 } };
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
  expect(duration).toBeLessThan(180);
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
  expect(plan.filter(row => row.gameId === 'hot-potato').reduce((sum, row) => sum + row.seconds, 0)).toBeGreaterThanOrEqual(15);
  expect(plan.filter(row => row.gameId === 'marble-race').reduce((sum, row) => sum + row.seconds, 0)).toBeGreaterThanOrEqual(18);
});

test('editorial impacts stay within the retained source shot and never carry across a cut', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const cues = plan.flatMap(segment => (segment.cues ?? []).map(cue => ({ segment, cue })));
  expect(cues).toHaveLength(5);
  for (const { segment, cue } of cues) {
    expect(cue.at).toBeGreaterThan(1);
    expect(cue.at + cue.seconds).toBeLessThan(segment.seconds - .2);
    expect(segment.source).toBe('cup');
  }
  expect(plan.find(row => row.cues?.some(cue => cue.kind === 'score'))?.title).toBe('PEG FEVER');
});

test('all game names remain canonical; the short Codex credit appears only on the opening title', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const games = plan.filter(row => row.source === 'cup' && row.title !== 'TOP EIGHT' && row.body);
  expect(games.map(row => row.title)).toEqual([
    'MULTIPLIER CASCADE', 'HOT POTATO', 'PEG FEVER', 'MARBLE RACE', 'BLADE BRAWL'
  ]);
  expect(plan[0].subtitle).toBe(TITLE_CREDIT);
  expect(TITLE_CREDIT).toBe('Implemented with Codex');
  expect(plan.slice(1).every(row => !row.subtitle && !row.body.includes('Codex') && !Object.hasOwn(row, 'credit'))).toBe(true);
  expect(CHAPTER_TIMING.hold).toBeGreaterThanOrEqual(2);
  expect(CHAPTER_TIMING.rulesAt).toBeGreaterThan(2);
  expect(plan.slice(-2).map(row => row.source)).toEqual(['cup', 'outro']);
  expect(plan.at(-2)?.title).toBe('');
  expect(plan.filter(row => row.source === 'cup').every(row => row.from >= 0
    && row.from + row.seconds <= cup().media.duration)).toBe(true);
});

test('tighter Hot Potato cuts retain each fuse expiry and aftermath, with title-reading room', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const clips = plan.filter(row => row.gameId === 'hot-potato');
  const play = cup().transitions.find(row => row.game === 'hot-potato' && row.phase === 'PLAY')!.wall;
  const blasts = [play + 22.13, play + 38.3];
  expect(clips).toHaveLength(2);
  for (const [index, blast] of blasts.entries()) {
    expect(clips[index].from).toBeLessThan(blast - (index === 0 ? 3 : 2));
    expect(clips[index].from + clips[index].seconds).toBeGreaterThan(blast + 2);
  }
  expect(clips[0].chapter).toBe(2);
  expect(clips[1].chapter).toBeUndefined();
  expect(clips.every(row => row.from + row.seconds <= cup().media.duration)).toBe(true);
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


test('brief build evidence stays with the opening before host workflow and joins', () => {
  const host = { mode: 'live', authenticated: true, connected: true, readyAt: 1,
    actions: [{ at: 2.5, action: 'queue:hot-potato' }, { at: 4, action: 'queue:multiplier-cascade' },
      { at: 5, action: 'drag-reorder' }, { at: 6, action: 'start-cup' }], media: { duration: 12 } };
  const plan = submissionVideoPlan(cup(), live, crowd(), false, host);
  expect(plan[1].source).toBe('build');
  expect(plan[1].seconds).toBeLessThan(4.2);
  expect(plan[2]).toMatchObject({ source: 'setup', evidence: 'host-ui' });
  expect(plan[3].source).toBe('crowd');
  expect(plan.filter(row => row.source === 'build')).toHaveLength(1);
  expect(plan.filter(row => row.source === 'cup').every(row => !Object.hasOwn(row, 'buildProof'))).toBe(true);
  expect(() => submissionVideoPlan(cup(), live, crowd(), false, { ...host, connected: false }))
    .toThrow('Connected host workflow proof');
  expect(() => submissionVideoPlan(cup(), live, crowd(), false, { ...host, media: { duration: 7.1 } }))
    .toThrow('reading hold');
});


test('queue instructions explain actual actions; bold section cards separate games and the final', () => {
  const host = { mode: 'live', authenticated: true, connected: true, readyAt: 1,
    actions: [{ at: 2.7, action: 'queue:hot-potato' }, { at: 4.1, action: 'queue:multiplier-cascade' },
      { at: 6.4, action: 'drag-reorder' }, { at: 7.7, action: 'start-cup' }], media: { duration: 12 } };
  const plan = submissionVideoPlan(cup(), live, crowd(), false, host);
  const captions = plan.find(row => row.source === 'setup')!.captions!;
  expect(captions.map(row => row.text)).toEqual([
    'Click "+ Queue" to add games.', 'Drag the grip to change the order.', 'Click "Start a Cup" to begin.'
  ]);
  expect(captions.every(row => row.to > row.from && row.to <= 9.3)).toBe(true);
  expect(plan.filter(row => row.source === 'section').map(row => row.title)).toEqual(['MINIGAMES', 'GRAND FINAL']);
  expect(plan.findIndex(row => row.title === 'MINIGAMES')).toBeLessThan(plan.findIndex(row => row.gameId === 'multiplier-cascade'));
  expect(plan.findIndex(row => row.title === 'GRAND FINAL')).toBeLessThan(plan.findIndex(row => row.gameId === 'blade-brawl'));
  expect(plan.reduce((sum, row) => sum + row.seconds, 0)).toBeLessThan(180);
});


test('reviewed gameplay covers Fever, a gate breach, the launch pack and multiple final eliminations', () => {
  const plan = submissionVideoPlan(cup(), live, crowd());
  const covers = (game: string, offset: number) => {
    const play = cup().transitions.find(row => row.game === game && row.phase === 'PLAY')!.wall;
    return plan.some(row => row.gameId === game && row.from <= play + offset
      && row.from + row.seconds >= play + offset + 1.5);
  };
  for (const [game, offset] of [
    ['multiplier-cascade', 36], ['multiplier-cascade', 54.9],
    ['peg-fever', 33.6], ['marble-race', 4], ['marble-race', 62],
    ['blade-brawl', 35.5], ['blade-brawl', 39.5], ['blade-brawl', 75.9]
  ] as const) expect(covers(game, offset), `${game} +${offset}`).toBe(true);
  const fever = plan.find(row => row.gameId === 'peg-fever' && !row.chapter)!;
  expect(fever.cues?.[0].reactionsOnly).toBe(true);
});
