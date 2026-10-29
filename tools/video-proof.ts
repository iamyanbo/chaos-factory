import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';

const excerpt = z.object({ at: z.string().datetime(), excerpt: z.string().min(10).max(160) }).strict();
const proofSchema = z.object({
  origin: z.string(),
  sessionId: z.string().uuid(),
  request: excerpt,
  response: excerpt,
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  file: z.literal('apps/show/src/kit/hype/view.ts'),
  before: z.string().min(10).max(160),
  after: z.string().min(10).max(160)
}).strict();
export type BuildProof = z.infer<typeof proofSchema>;

export function validateBuildProof(value: unknown, patch: string): BuildProof {
  const proof = proofSchema.parse(value);
  if (!patch.includes(proof.before) || !patch.includes(`+    ${proof.after}`)) {
    throw new Error('Build evidence does not match the actual committed patch.');
  }
  return proof;
}

export async function loadBuildProof(): Promise<BuildProof> {
  const data = proofSchema.parse(JSON.parse(await readFile('docs/build-evidence.json', 'utf8')));
  const patch = execFileSync('git', ['show', data.commit, '--format=', '--', data.file],
    { encoding: 'utf8', windowsHide: true });
  return validateBuildProof(data, patch);
}
