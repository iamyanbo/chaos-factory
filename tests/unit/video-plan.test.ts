import { expect, test } from 'vitest';
import { submissionVideoPlan, type RoundVideo, type CrowdVideo } from '../../tools/video-plan';
import { EDIT_BEAT_SECONDS, INTRO_SECONDS } from '../../tools/video-rhythm';
import { CHAPTER_TIMING, TITLE_CREDIT } from '../../tools/video-titles';

const ids = ['multiplier-cascade', 'hot-potato', 'peg-fever', 'marble-race', 'blade-brawl'];
function recording(): RoundVideo {
  return { transitions: ids.flatMap((game, index) => [
    { game, round: index + 1, phase: 'PLAY', stage: 0, wall: index * 100 + 5 },
    { game, round: index + 1, phase: 'RESULT', stage: 2, wall: index * 100 + 95 }
  ]), wallSeconds: 510, media: { duration: 510 },
  reviewed: Object.fromEntries(ids.map(game => [game, [
    { offset: 18, seconds: 10, cues: [{ at: 5, seconds: 1.1, kind: 'burst' as const,
      title: '', reactionsOnly: true, moment: 'elimination' as const }] },
    { offset: 66, seconds: 6 }
  ]])) };
}
function crowd(): CrowdVideo {
  return { mode: 'mock', viewers: 48, startedAt: 11, playAt: 14,
    joins: Array.from({ length: 48 }, (_, index) => ({ wall: 2 + index / 8,
      name: `viewer_${index}`, color: '#ff4f7b' })), media: { duration: 23 } };
}
const live = { mode: 'live', joinedAt: 12, startedAt: 15,
  member: { displayName: 'iamyanbo' }, media: { duration: 42 } };
const extras = ['pong-wars', 'light-cycles', 'ring-escape'].map(game => ({
  game, mode: 'mock', normalSpeed: true, resultAt: 60, media: { duration: 62 },
  result: { winner: { kind: 'team' } }
}));
const host = { mode: 'mock', authenticated: false, connected: true, readyAt: 1,
  actions: [{ at: 2.7, action: 'queue:hot-potato' }, { at: 4.1, action: 'queue:multiplier-cascade' },
    { at: 6.4, action: 'drag-reorder' }, { at: 7.7, action: 'start-show' }], media: { duration: 12 } };
const plan = () => submissionVideoPlan(recording(), live, crowd(), false, host, extras);

test('all eight games appear as independent rounds without tournament or wagering claims', () => {
  const film = plan();
  expect(new Set(film.map(row => row.gameId).filter(Boolean)).size).toBe(8);
  expect(film.filter(row => row.chapter).map(row => row.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(film.filter(row => row.source === 'section').map(row => row.title))
    .toEqual(['MINIGAMES', 'CHAT VS STREAMER']);
  expect(film.every(row => !/cup|grand final|top eight|qualification|wager|prediction/i
    .test([row.title, row.body, row.category ?? '', ...row.captions?.map(c => c.text) ?? []].join(' '))))
    .toBe(true);
  expect(film.find(row => row.gameId === 'hot-potato')?.body).toContain('three chatters');
  expect(film.find(row => row.gameId === 'blade-brawl')?.category).toBe('CHAT VS STREAMER');
  expect(film.filter(row => row.gameId === 'hot-potato').reduce((n, row) => n + row.seconds, 0)).toBeGreaterThanOrEqual(16);
  expect(film.at(-2)).toMatchObject({ source: 'rounds', celebrate: true });
});

test('the continuous populated lobby keeps a separately labeled historical real join inset', () => {
  const join = plan().find(row => row.source === 'crowd')!;
  expect(join.evidence).toBe('mock');
  expect(join.inset).toMatchObject({ evidence: 'real-chat', name: 'iamyanbo', seconds: 4 });
  expect(join.inset!.at + join.inset!.seconds).toBeLessThanOrEqual(join.seconds);
  expect(join.from).toBeLessThan(crowd().joins[0].wall);
  expect(join.from + join.seconds).toBeGreaterThan(crowd().playAt! + 4);
  expect(() => submissionVideoPlan(recording(), { ...live, mode: 'mock' }, crowd(), false, host, extras))
    .toThrow('Real Twitch join proof');
  expect(() => submissionVideoPlan(recording(), live, { ...crowd(), joins: [] }, false, host, extras))
    .toThrow('populated mock lobby');
});

test('only reviewed source windows and real results are accepted', () => {
  const historical = recording();
  historical.transitions.push({ game: 'blade-brawl', round: 5, phase: 'CUP_RESULTS', stage: 2, wall: 500 });
  expect(() => submissionVideoPlan(historical, live, crowd(), false, host, extras)).toThrow('Recapture independent rounds');
  const missing = recording();
  delete missing.reviewed['peg-fever'];
  expect(() => submissionVideoPlan(missing, live, crowd(), false, host, extras)).toThrow('Reviewed event windows');
  missing.reviewed['peg-fever'] = [{ offset: 88, seconds: 10 }];
  expect(() => submissionVideoPlan(missing, live, crowd(), false, host, extras)).toThrow('outside its recorded round');
  const noResult = recording();
  noResult.transitions = noResult.transitions.filter(row => row.game !== 'blade-brawl' || row.phase !== 'RESULT');
  expect(() => submissionVideoPlan(noResult, live, crowd(), false, host, extras)).toThrow('Missing completed blade-brawl');
  expect(() => submissionVideoPlan(recording(), live, crowd(), false, host, extras.slice(0, 2)))
    .toThrow('all three optional games');
});

test('queue captions match the recorded current controls and preserve the smooth workflow', () => {
  const film = plan();
  expect(film[1]).toMatchObject({ source: 'setup', hostMode: 'mock' });
  expect(film[1].captions?.map(row => row.text)).toEqual([
    'Click "+ Queue" to add games.', 'Drag the grip to change the order.', 'Click "Start show" to begin.'
  ]);
  expect(film[1].captions?.every(row => row.to > row.from && row.to <= 9.3)).toBe(true);
  expect(film[0].subtitle).toBe(TITLE_CREDIT);
  expect(film.slice(1).every(row => !row.subtitle && !row.body.includes('Codex'))).toBe(true);
  expect(CHAPTER_TIMING.hold).toBeGreaterThanOrEqual(2);
});

test('a slower real host capture gets a readable hold after Start show', () => {
  const slow = { ...host, actions: host.actions.map(row => row.action === 'start-show'
    ? { ...row, at: 10 } : row), media: { duration: 15 } };
  const setup = submissionVideoPlan(recording(), live, crowd(), false, slow, extras)[1];
  const last = setup.captions!.at(-1)!;
  expect(last.to - last.from).toBeGreaterThan(2);
  expect(setup.from + setup.seconds).toBeLessThan(slow.media.duration);
});

test('cuts align to the music, keep cues inside their shots, and stay under three minutes', () => {
  let elapsed = 0;
  const previousEnd = new Map<string, number>();
  for (const segment of plan()) {
    if (segment.gameId) {
      expect(segment.from).toBeGreaterThanOrEqual(previousEnd.get(segment.gameId) ?? 0);
      previousEnd.set(segment.gameId, segment.from + segment.seconds);
    }
    for (const cue of segment.cues ?? []) {
      expect(cue.at + cue.seconds).toBeLessThan(segment.seconds - .2);
    }
    elapsed += segment.seconds;
    if (segment.source === 'outro') continue;
    const beat = Math.round((elapsed - INTRO_SECONDS) / EDIT_BEAT_SECONDS);
    expect(Math.abs(elapsed - INTRO_SECONDS - beat * EDIT_BEAT_SECONDS)).toBeLessThanOrEqual(1 / 60 + 1e-7);
  }
  expect(elapsed).toBeLessThan(180);
});
