import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { buildCodeLines } from '../../tools/video-build-card';
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
