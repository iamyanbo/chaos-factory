import { expect, test } from 'vitest';
import { eventReactions } from '../../tools/video-reactions';
import type { VideoSegment } from '../../tools/video-plan';

const segment: VideoSegment = { source: 'cup', from: 0, seconds: 8, title: '', body: '',
  evidence: 'mock', gameId: 'peg-fever', chapter: 3,
  cues: [{ at: 3.65, seconds: 1.2, kind: 'score', title: '2,960' }] };

test('event emotes are staggered, iconic and scattered outside the centered caption', () => {
  const reactions = eventReactions(segment);
  expect(reactions.map(row => row.emote)).toContain('PogChamp');
  expect(new Set(reactions.map(row => row.x)).size).toBe(3);
  expect(reactions[0].at).toBeLessThan(reactions[1].at);
  expect(reactions[1].at).toBeLessThan(reactions[2].at);
  expect(reactions.every(row => row.at + row.seconds < segment.seconds)).toBe(true);
  expect(reactions.every(row => Math.abs(row.y - 510) > 150)).toBe(true);
  expect(reactions.every(row => row.x >= 100 && row.x <= 1820 && row.y <= 960)).toBe(true);
});
