import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { buildCodeLines, landingExcerpt } from '../../tools/video-build-card';
import { loadBuildProof } from '../../tools/video-proof';

test.skipIf(!existsSync('.git'))('full-screen build card shows the actual full changed lines', async () => {
  const proof = await loadBuildProof();
  const patch = execFileSync('git', ['show', proof.commit, '--format=', '--', proof.file], { encoding: 'utf8' });
  const code = buildCodeLines(proof, patch);
  expect(code.before).toContain('this.focusedCamera.hypeFocus');
  expect(code.before).toContain(proof.before);
  expect(code.after).toBe(proof.after);
  expect(() => buildCodeLines(proof, '')).toThrow('actual removed/added Git lines');
});


test('opening source glimpse retains the real score calculation without invented conversation', async () => {
  const source = await readFile('apps/show/src/games/peg-fever/scoring.ts', 'utf8');
  const excerpt = landingExcerpt(source);
  expect(excerpt.join('\n')).toContain('const total = shot.points * multiplier;');
  expect(excerpt.every(line => source.includes(line))).toBe(true);
  expect(() => landingExcerpt('')).toThrow('review the build excerpt');
});
