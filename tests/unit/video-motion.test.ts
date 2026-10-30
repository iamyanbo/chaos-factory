import { expect, test } from 'vitest';
import { pointerPoint } from '../../tools/video-pointer';
import { cameraAt, cameraKeys, editorialCameraFilter, editorialPictureFilters } from '../../tools/video-motion';
import type { VideoSegment } from '../../tools/video-plan';

const shot = (extra: Partial<VideoSegment> = {}): VideoSegment => ({ source: 'cup',
  from: 0, seconds: 13.6, title: '', body: '', evidence: 'mock', ...extra });

test('cursor approaches controls without an endpoint jump or constant-speed snap', () => {
  const from = { x: 1200, y: 220 };
  const to = { x: 420, y: 760 };
  expect(pointerPoint(from, to, 0, 24)).toEqual(from);
  const last = pointerPoint(from, to, 1, 24);
  expect(last.x).toBeCloseTo(to.x, 8);
  expect(last.y).toBeCloseTo(to.y, 8);
  const distance = (a: typeof from, b: typeof from) => Math.hypot(a.x - b.x, a.y - b.y);
  expect(distance(from, pointerPoint(from, to, .01, 24))).toBeLessThan(.02);
  expect(distance(to, pointerPoint(from, to, .99, 24))).toBeLessThan(.02);
  const middle = pointerPoint(from, to, .5, 24);
  expect(distance(middle, { x: 810, y: 490 })).toBeCloseTo(24);
});

test('editorial camera leaves the Race record and finish stable and titles readable', () => {
  const race = cameraKeys(shot({ gameId: 'marble-race', buildProof: true }));
  expect(editorialCameraFilter(race)).toBe('null');
  const hot = cameraKeys(shot({ gameId: 'hot-potato', chapter: 2,
    cues: [{ at: 3.4, seconds: .9, kind: 'burst', title: 'BOOM!' }] }));
  expect(cameraAt(hot, 2.9).zoom).toBe(1);
  expect(cameraAt(hot, 3.4).zoom).toBeCloseTo(1.1);
  expect(cameraAt(hot, 5).zoom).toBe(1);
  expect(editorialCameraFilter(hot)).toContain('d=1:s=1920x1080:fps=30');
});

test('setup close-ups hold still between deliberate cuts', () => {
  const host = { mode: 'live', authenticated: true, connected: true, readyAt: 1,
    actions: [{ at: 2.7, action: 'queue:hot-potato' }, { at: 4.1, action: 'queue:multiplier-cascade' },
      { at: 6.4, action: 'drag-reorder' }, { at: 7.7, action: 'start-cup' }], media: { duration: 12 } };
  const keys = cameraKeys(shot({ source: 'setup', from: 1, seconds: 9.4 }), host);
  expect(keys.every((row, index) => index === 0 || row.at > keys[index - 1].at)).toBe(true);
  expect(cameraAt(keys, 5.4).zoom).toBeCloseTo(1.7);
  expect(cameraAt(keys, 9.3).zoom).toBe(1);
  const poses = new Set(keys.map(row => `${row.zoom},${row.x},${row.y}`));
  for (let time = 0; time < 9.4; time += 1 / 30) {
    const pose = cameraAt(keys, time);
    expect(poses.has(`${pose.zoom},${pose.x},${pose.y}`)).toBe(true);
  }
  expect(editorialCameraFilter(keys)).not.toContain('(on/30-');
});


test('punch-ins protect both source HUD columns; dashboard reframing remains unrestricted', () => {
  const game = shot({ gameId: 'blade-brawl' });
  const filters = editorialPictureFilters(game, cameraKeys(game)).join(';');
  expect(filters).toContain('crop=448:1080:0:0');
  expect(filters).toContain('crop=448:1080:1472:0');
  const setup = editorialPictureFilters(shot({ source: 'setup' }), [
    { at: 0, zoom: 1, x: 960, y: 540 }, { at: 1, zoom: 1.7, x: 1400, y: 700 }
  ]).join(';');
  expect(setup).not.toContain('crop=448');
});
