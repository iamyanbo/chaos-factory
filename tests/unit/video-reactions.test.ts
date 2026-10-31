import { expect, test } from 'vitest';
import { eventReactions } from '../../tools/video-reactions';
import type { VideoSegment } from '../../tools/video-plan';

const segment: VideoSegment = { source: 'cup', from: 0, seconds: 8, title: '', body: '',
  evidence: 'mock', gameId: 'peg-fever', chapter: 3,
  cues: [{ at: 3.65, seconds: 1.2, kind: 'score', title: '2,960' }] };

test('event emotes are staggered, iconic and scattered outside the centered caption', () => {
  const reactions = eventReactions(segment);
  expect(reactions.map(row => row.emote)).toContain('PogChamp');
  expect(new Set(reactions.map(row => row.x)).size).toBe(2);
  expect(reactions[0].at).toBeLessThan(reactions[1].at);
  expect(reactions.every(row => row.at + row.seconds < segment.seconds)).toBe(true);
  expect(reactions.every(row => Math.abs(row.y - 510) > 150)).toBe(true);
  expect(reactions.every(row => row.x >= 100 && row.x <= 1820 && row.y <= 960)).toBe(true);
});


test('scores, Fever, finishes and the champion use celebratory reactions, never ridicule', () => {
  for (const moment of ['score', 'fever', 'finish'] as const) {
    const reactions = eventReactions({ ...segment, cues: [{ at: 3, seconds: 1, kind: 'score', title: '', moment }] });
    expect(reactions.map(row => row.emote)).toContain('SeemsGood');
    expect(reactions.map(row => row.emote)).toContain('PogChamp');
    expect(reactions.some(row => ['LUL', 'Kappa', 'NotLikeThis'].includes(row.emote))).toBe(false);
  }
  const champion = eventReactions({ ...segment, chapter: undefined, cues: [], celebrate: true });
  expect(champion.every(row => ['SeemsGood', 'PogChamp'].includes(row.emote))).toBe(true);
});

test('ordinary eliminations express dismay; laughter is reserved for the reviewed comic spill', () => {
  const loss = eventReactions({ ...segment, cues: [{ at: 3, seconds: 1, kind: 'burst', title: '', moment: 'elimination' }] });
  expect(loss.every(row => row.emote === 'NotLikeThis')).toBe(true);
  const spill = eventReactions({ ...segment, cues: [{ at: 3, seconds: 1, kind: 'burst', title: '', moment: 'spill' }] });
  expect(spill.map(row => row.emote)).toContain('LUL');
  expect(spill.some(row => ['SeemsGood', 'Kappa'].includes(row.emote))).toBe(false);
});
