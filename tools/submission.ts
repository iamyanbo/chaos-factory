import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { excludedSourcePath, submissionReadiness, submissionSchema } from './submission-readiness';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'qa/submission');
const git = (...args: string[]): string => execFileSync('git', args,
  { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const fields = submissionSchema.parse(JSON.parse(await readFile(resolve(root, 'docs/submission-fields.json'), 'utf8')));
const readiness = submissionReadiness(fields);
const commit = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain', '--untracked-files=no').length > 0;
console.log(`Submission readiness for ${commit.slice(0, 8)}:`);
for (const item of readiness) console.log(`${item.notApplicable ? 'N/A' : item.ready ? 'READY' : 'PENDING'}  ${item.label}`);
console.log('URL checks validate syntax only. Rehearsal/access flags are owner confirmations, not automated proof.');

if (process.argv.includes('--check')) {
  if (dirty) console.error('PENDING  Tracked changes must be committed before packaging.');
  process.exitCode = dirty || readiness.some(item => !item.ready) ? 1 : 0;
} else {
  // Archive exactly the reviewed commit, never a working directory or local credentials.
  if (dirty) throw new Error('Commit tracked changes first. The source bundle must match HEAD.');
  const paths = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n');
  const excluded = paths.filter(excludedSourcePath);
  if (excluded.length) throw new Error(`Refusing to package private/generated paths: ${excluded.join(', ')}`);
  await mkdir(output, { recursive: true });
  const source = resolve(output, 'chaos-factory-source.zip');
  git('archive', '--format=zip', '-o', source, 'HEAD');
  const copied = [
    ['docs/SUBMISSION.md', 'SUBMISSION.md'], ['docs/SHIP-CHECKLIST.md', 'SHIP-CHECKLIST.md'],
    ['docs/LIVE-TEST.md', 'LIVE-TEST.md'], ['README.md', 'README.md'],
    ['ASSETS.md', 'ASSETS.md'], ['CODEX_LOG.md', 'CODEX_LOG.md'],
    ['qa/known-issues.md', 'KNOWN-ISSUES.md']
  ];
  const games = ['blade-brawl', 'hot-potato', 'multiplier-cascade', 'peg-fever', 'marble-race', 'pong-wars', 'light-cycles', 'ring-escape'];
  for (const id of games) copied.push([`apps/show/public/game-previews/${id}.webp`, `images/${id}.webp`]);
  for (const [from, to] of copied) {
    await mkdir(dirname(resolve(output, to)), { recursive: true });
    await copyFile(resolve(root, from), resolve(output, to));
  }
  const sourceSha256 = createHash('sha256').update(await readFile(source)).digest('hex');
  const manifest = { createdAt: new Date().toISOString(), sourceCommit: commit, sourceSha256,
    fields, readiness, readyToSubmit: readiness.every(item => item.ready),
    note: 'No upload or Devpost submission performed. URL access, video contents and owner confirmations require manual verification.' };
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(resolve(output, 'START-HERE.md'), [
    '# Chaos Factory submission pack', '', `Source commit: ${commit}`, `ZIP SHA-256: ${sourceSha256}`, '',
    'Extract chaos-factory-source.zip, then run npm ci and npm run demo with Node 22 or newer.',
    'Play: http://127.0.0.1:4182/play | Cup: http://127.0.0.1:4182/show', '',
    'SUBMISSION.md contains the project copy. SHIP-CHECKLIST.md lists the owner steps.',
    'images/ contains our own game captures. These are still images, not proof of live Twitch.',
    'Full source includes the licensed runtime assets and notices. Local .env/.data are excluded.', '',
    ...readiness.map(item => `- [${item.ready ? 'x' : ' '}] ${item.label}`), '',
    'Update docs/submission-fields.json after completing the actual steps, commit, then rerun npm run submission.',
    'npm run submission:check exits nonzero until the required fields/confirmations are filled.',
    'This pack does not upload, publish, record or submit anything.'
  ].join('\n') + '\n');
  console.log(`\nPack created: ${output}`);
  console.log(`Source ZIP SHA-256: ${sourceSha256}`);
  console.log(readiness.every(item => item.ready) ? 'Fields complete; perform the final Devpost checks.'
    : 'Pack prepared; required owner steps remain. See START-HERE.md.');
}
