import { expect, test } from 'vitest';
import { excludedSourcePath, submissionReadiness, submissionSchema } from '../../tools/submission-readiness';

const empty = { repositoryUrl: '', videoUrl: '', codexSessionId: '', teamMembers: [],
  repositoryAccessChecked: false, liveJoinVerified: false };

test('a prepared pack cannot imply that live Twitch or repository access was verified', () => {
  expect(submissionReadiness(empty).every(item => !item.ready)).toBe(true);
  const items = submissionReadiness({ ...empty, repositoryUrl: 'https://github.com/owner/project',
    videoUrl: 'https://youtu.be/abcdefghijk', codexSessionId: 'actual-main-session-id', teamMembers: ['Builder'] });
  expect(items.filter(item => item.ready)).toHaveLength(4);
  expect(items.filter(item => !item.ready)).toHaveLength(2);
  expect(() => submissionSchema.parse({ ...empty, liveJoinVerified: 'true' })).toThrow();
});

test('rejects credential-bearing, unsupported and incomplete repository/video URLs', () => {
  for (const repositoryUrl of ['http://github.com/a/b', 'https://github.com/a', 'https://user:secret@github.com/a/b', 'https://example.com/a/b']) {
    expect(submissionReadiness({ ...empty, repositoryUrl })[0].ready).toBe(false);
  }
  for (const videoUrl of ['https://youtube.com/', 'https://youtu.be/', 'https://example.com/watch?v=abcdefghijk']) {
    expect(submissionReadiness({ ...empty, videoUrl })[2].ready).toBe(false);
  }
  expect(submissionReadiness({ ...empty, videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' })[2].ready).toBe(true);
});

test('source packaging refuses credential/data/dependency paths while preserving the safe env example', () => {
  for (const path of ['.env', '.env.local', '.data/live/tokens.json', 'apps/server/.env',
    'node_modules/package/index.js', 'apps/show/dist/main.js', '.git/config', '.data\\tokens.json',
    'archive/rejected-game/index.ts', 'legacy/server.mjs']) {
    expect(excludedSourcePath(path)).toBe(true);
  }
  expect(excludedSourcePath('.env.example')).toBe(false);
  expect(excludedSourcePath('apps/server/src/twitch/auth.ts')).toBe(false);
});

test('submission requires a real chat join, without gating it on channel points or eligibility', () => {
  for (const broadcasterType of ['standard', 'affiliate', 'partner'] as const) {
    const items = submissionReadiness({ ...empty, broadcasterType, liveJoinVerified: true });
    expect(items).toHaveLength(6);
    expect(items[5]).toMatchObject({ ready: true });
    expect(items.some(item => /payout|prediction|wager/i.test(item.label))).toBe(false);
  }
});
