import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { loadBuildProof, validateBuildProof } from '../../tools/video-proof';

test.skipIf(!existsSync('.git'))('build record resolves to the actual committed camera fix', async () => {
  const proof = await loadBuildProof();
  expect(proof.request.excerpt).toContain('backwards in time');
  expect(proof.origin).toContain('not a recording of the Codex app UI');
  expect(proof.after).toBe('this.focusedCamera.hypeFocus(this.slowFocus, 0);');
});

test('an unrelated or invented patch cannot validate build evidence', () => {
  const proof = JSON.parse(readFileSync('docs/build-evidence.json', 'utf8'));
  expect(() => validateBuildProof(proof, 'unrelated patch')).toThrow('actual committed patch');
  expect(() => validateBuildProof({ ...proof, internalReasoning: 'private' }, '')).toThrow();
});
