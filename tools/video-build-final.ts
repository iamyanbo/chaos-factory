import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, probe } from './drama/capture-media';
import { transitionAudio } from './video-edit-audio';
import { MUSIC_START_SECONDS } from './video-rhythm';
import { TITLE_CREDIT } from './video-titles';

// Retain every approved gameplay frame and source window from v16.
const ROOT = resolve('qa/submission-video');
const EDIT = resolve(ROOT, 'edit');
const OUTPUT = resolve(EDIT, 'segments-v17');
const PREVIEW = resolve(ROOT, 'codex-grid');
const SOURCE_MANIFEST = resolve(ROOT, 'edit-v16.json');
if (!existsSync(SOURCE_MANIFEST)) {
  const existing = JSON.parse(await readFile(resolve(ROOT, 'edit.json'), 'utf8'));
  if (existing.edition !== 16) throw new Error('Preserve the approved v16 manifest before assembling');
  await writeFile(SOURCE_MANIFEST, JSON.stringify(existing, null, 2) + '\n');
}
const previous = JSON.parse(await readFile(SOURCE_MANIFEST, 'utf8'));
const build = JSON.parse(await readFile(resolve(PREVIEW, 'manifest.json'), 'utf8'));
if (previous.edition !== 16 || previous.draft || build.simultaneousFiles !== 4 || build.credit !== TITLE_CREDIT) {
  throw new Error('Expected reviewed standalone v16 and the current four-file build insert');
}
const insertSeconds = probe(resolve(PREVIEW, 'codex-insert-preview.mp4')).duration;
if (Math.abs(insertSeconds - build.seconds) > 1 / 30) throw new Error('Build insert duration mismatch');
await mkdir(OUTPUT, { recursive: true });
const run = (args: string[]) => command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const silentPlate = async (source: string, seconds: number, output: string, enter: boolean) => {
  run(['-i', source, '-loop', '1', '-framerate', '30', '-i', resolve(EDIT, 'cards/wipe.png'),
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(seconds),
    '-filter_complex', '[0:v]fps=30,setpts=N/(30*TB),setsar=1[base];[1:v]format=rgba,split=2[wi][wo];'
      + `[base][wi]overlay=x='-200+12000*t':y=0:enable='${enter ? 'lt(t,0.2)' : '0'}':format=auto[arrived];`
      + `[arrived][wo]overlay=x='-2600+12000*(t-${seconds - .2})':y=0:enable='gte(t,${seconds - .2})':format=auto,format=yuv420p[out]`,
    '-map', '[out]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
};
await silentPlate(resolve(EDIT, 'cards/title-motion.webm'), previous.timeline[0].seconds,
  resolve(OUTPUT, 'title.mp4'), false);
await silentPlate(resolve(PREVIEW, 'codex-insert-preview.mp4'), insertSeconds,
  resolve(OUTPUT, 'build.mp4'), true);
const sources = [resolve(OUTPUT, 'title.mp4'), resolve(OUTPUT, 'build.mp4'),
  ...previous.timeline.slice(1).map((_: unknown, index: number) =>
    resolve(EDIT, 'segments-v16', `${String(index + 1).padStart(2, '0')}.mp4`))];
const timeline = [
  { ...previous.timeline[0], subtitle: TITLE_CREDIT },
  { start: previous.timeline[0].end, end: previous.timeline[0].end + insertSeconds,
    source: 'build', from: 0, seconds: insertSeconds, title: '', body: '',
    evidence: 'project-files', simultaneousFiles: 4, files: build.files, request: build.request,
    sourceFrom: 0, presentation: build.presentation },
  ...previous.timeline.slice(1).map((row: { start: number; end: number }) =>
    ({ ...row, start: row.start + insertSeconds, end: row.end + insertSeconds }))
];
const seconds = timeline.at(-1)!.end;
if (!(seconds < 180)) throw new Error('Keep the full film under three minutes');
for (const [index, source] of sources.entries()) {
  if (Math.abs(probe(source).duration - timeline[index].seconds) > .05) {
    throw new Error(`Unexpected segment duration: ${source}`);
  }
}
const concat = resolve(OUTPUT, 'concat.txt');
await writeFile(concat, sources.map(source => `file '${source.replace(/\\/g, '/')}'`).join('\n') + '\n');
const picture = resolve(EDIT, 'story-picture-v17.mp4');
run(['-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', picture]);
const swishes = resolve(EDIT, 'transition-swishes-v17.wav');
await transitionAudio(timeline.slice(0, -1).map(row => row.end), seconds, swishes);
const output = resolve(ROOT, 'chaos-factory-demo-v17.mp4');
// One uninterrupted CC0 bed mixed with original SFX-only segment audio.
run(['-i', picture, '-stream_loop', '-1', '-i', 'apps/show/public/music/adventure-2.ogg', '-i', swishes,
  '-filter_complex', '[0:v]fps=30,setpts=N/(30*TB)[picture];[0:a][2:a]amix=inputs=2:normalize=0[fx];[fx]asplit=2[game][key];'
    + `[1:a]atrim=start=${MUSIC_START_SECONDS},asetpts=PTS-STARTPTS,volume=0.22,afade=t=in:d=0.2,afade=t=out:st=${seconds - 1.2}:d=1.2[bed];`
    + '[bed][key]sidechaincompress=threshold=0.035:ratio=4:attack=8:release=180[duck];[game][duck]amix=inputs=2:normalize=0,'
    + 'alimiter=limit=0.89:level=false,loudnorm=I=-18:TP=-1.5:LRA=9,aresample=192000,alimiter=limit=0.60:level=false:attack=5:release=50,'
    + 'aresample=48000,volume=0.88[audio]',
  '-t', String(seconds), '-map', '[picture]', '-map', '[audio]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
  '-threads', '2', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
const media = probe(output);
if (Math.abs(media.duration - seconds) > 1 / 30 || media.audioTracks !== 1) {
  throw new Error('Final film duration/audio validation failed');
}
const manifest = { ...previous, output, edition: 17, duration: media.duration, timeline, media,
  buildEvidence: 'Verbatim original doc 24 request, four real source files scrolling together, and user-supplied GPT-6.1 Sol credit; editorial presentation, not native Codex UI footage.',
  sourceEdition: 16, retainedSegments: previous.timeline.length - 1,
  insertSeconds, buildCredit: TITLE_CREDIT, buildProof: build };
await writeFile(resolve(ROOT, 'edit.json'), JSON.stringify(manifest, null, 2) + '\n');
await copyFile(output, resolve(ROOT, 'chaos-factory-demo.mp4'));
console.log(JSON.stringify({ output, seconds: media.duration, inserted: insertSeconds, preservedSegments: sources.length - 2 }, null, 2));
