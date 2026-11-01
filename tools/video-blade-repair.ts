import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { command, probe } from './drama/capture-media';
import { assertEffectsOnly } from './video-audio';
import { recordedCadence } from './video-cadence';
import { gameplayOverlay } from './video-overlays';
import { cameraKeys, editorialPictureFilters } from './video-motion';
import { eventReactions } from './video-reactions';
import { transitionAudio } from './video-edit-audio';
import { MUSIC_START_SECONDS } from './video-rhythm';
import type { VideoSegment } from './video-plan';

const ROOT = resolve('qa/submission-video');
const EDIT = resolve(ROOT, 'edit');
const OUTPUT = resolve(EDIT, 'segments-v18');
const CAPTURE = resolve(ROOT, 'blade-smooth');
const BACKUP = resolve(ROOT, 'edit-v17.json');
if (!existsSync(BACKUP)) {
  const current = JSON.parse(await readFile(resolve(ROOT, 'edit.json'), 'utf8'));
  if (current.edition !== 17) throw new Error('Expected the approved v17 edit');
  await writeFile(BACKUP, JSON.stringify(current, null, 2) + '\n');
}
const previous = JSON.parse(await readFile(BACKUP, 'utf8'));
const capture = JSON.parse(await readFile(resolve(CAPTURE, 'capture.json'), 'utf8'));
const oldCapture = JSON.parse(await readFile(resolve(ROOT, 'rounds-v16/capture.json'), 'utf8'));
const oldResult = oldCapture.results.at(-1);
assertEffectsOnly(capture);
if (capture.game !== 'blade-brawl' || capture.normalSpeed !== true
  || capture.samples[0].details.format !== 'boss' || capture.selectedSeed !== oldResult.replay.seed
  || !isDeepStrictEqual(capture.result.perUser, oldResult.perUser)
  || !isDeepStrictEqual(capture.result.champion, oldResult.champion)
  || !isDeepStrictEqual(capture.result.winner, oldResult.winner)) {
  throw new Error('Blade recapture must retain the original seed, format and actual results');
}
const timeline = structuredClone(previous.timeline);
const sourceFile = resolve(CAPTURE, 'game.webm');
const files = (await readFile(resolve(EDIT, 'segments-v17/concat.txt'), 'utf8')).trim().split(/\r?\n/)
  .map(line => {
    const match = /^file '([^']+)'$/.exec(line);
    if (!match) throw new Error('Unexpected original concat entry');
    return match[1];
  });
if (files.length !== timeline.length) throw new Error('Original segment list does not match the edit');
const rage = capture.samples.find((sample: { wall: number; details: { fighters: { rage?: { active: boolean } }[] } }) =>
  sample.wall > 60 && sample.details.fighters[0].rage?.active);
const lastThree = capture.samples.find((sample: { wall: number; alive: number }) => sample.wall > 90 && sample.alive === 3);
if (!rage || !lastThree) throw new Error('Expected the original rage and final duel');
const offsets = [rage.wall - 4.35, 93.5];
const cadence = [];
await mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const run = (args: string[]) => command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript('globalThis.__name = fn => fn;');
  await page.goto('http://127.0.0.1:4182/fonts/Fredoka-OFL.txt');
  await page.setContent(`<style>@font-face{font-family:Fredoka;src:url('/fonts/Fredoka.ttf')}
    @font-face{font-family:Lilita;src:url('/fonts/LilitaOne-Regular.ttf')}</style>`);
  const crowd = JSON.parse(await readFile(resolve(ROOT, 'join-crowd-v16/capture.json'), 'utf8'));
  let take = 0;
  for (const [index, row] of timeline.entries()) {
    if (row.gameId !== 'blade-brawl') continue;
    row.source = 'alternate';
    row.from = offsets[take];
    row.sourceFrom = row.from;
    row.captureFile = sourceFile;
    row.cues[0].at = take === 0 ? 4.35 : lastThree.wall - row.from;
    row.reactions = eventReactions(row as VideoSegment);
    row.editorialCamera = cameraKeys(row as VideoSegment);
    const measured = recordedCadence(sourceFile, row.from, row.seconds);
    if (measured.framesPerSecond < 45 || measured.gapsOver100Ms > 0) {
      throw new Error('Recapture still has dropped frames in the selected Blade footage');
    }
    cadence.push(measured);
    const overlay = await gameplayOverlay(page, row as VideoSegment, 100 + take, crowd);
    const filters = [...editorialPictureFilters(row, row.editorialCamera),
      '[1:v]format=rgba,split=2[wi][wo]', '[base][2:v]overlay=0:0:format=auto[decorated]',
      "[decorated][wi]overlay=x='-200+12000*t':y=0:enable='lt(t,0.2)':format=auto[arrived]",
      `[arrived][wo]overlay=x='-2600+12000*(t-${row.seconds - .2})':y=0:enable='gte(t,${row.seconds - .2})':format=auto,format=yuv420p[out]`];
    const output = resolve(OUTPUT, `blade-${take}.mp4`);
    run(['-ss', String(row.from), '-i', sourceFile, '-loop', '1', '-framerate', '30', '-i', resolve(EDIT, 'cards/wipe.png'),
      '-i', overlay, '-t', String(row.seconds), '-filter_complex', filters.join(';'), '-map', '[out]', '-map', '0:a',
      '-af', `volume=1.4,afade=t=in:d=0.025,afade=t=out:st=${row.seconds - .04}:d=0.04`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2', '-c:a', 'aac', '-b:a', '192k',
      '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
    files[index] = output;
    take++;
  }
  if (take !== 2) throw new Error('Expected two Blade Brawl gameplay excerpts');
} finally { await browser.close(); }
const duration = timeline.at(-1).end;
for (const [index, file] of files.entries()) {
  if (Math.abs(probe(file).duration - timeline[index].seconds) > .05) throw new Error('Segment length changed');
}
const concat = resolve(OUTPUT, 'concat.txt');
await writeFile(concat, files.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n') + '\n');
const picture = resolve(EDIT, 'story-picture-v18.mp4');
run(['-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', picture]);
const swishes = resolve(EDIT, 'transition-swishes-v18.wav');
await transitionAudio(timeline.slice(0, -1).map((row: { end: number }) => row.end), duration, swishes);
const output = resolve(ROOT, 'chaos-factory-demo-v18.mp4');
run(['-i', picture, '-stream_loop', '-1', '-i', 'apps/show/public/music/adventure-2.ogg', '-i', swishes,
  '-filter_complex', '[0:v]fps=30,setpts=N/(30*TB)[picture];[0:a][2:a]amix=inputs=2:normalize=0[fx];[fx]asplit=2[game][key];'
    + `[1:a]atrim=start=${MUSIC_START_SECONDS},asetpts=PTS-STARTPTS,volume=0.22,afade=t=in:d=0.2,afade=t=out:st=${duration - 1.2}:d=1.2[bed];`
    + '[bed][key]sidechaincompress=threshold=0.035:ratio=4:attack=8:release=180[duck];[game][duck]amix=inputs=2:normalize=0,'
    + 'alimiter=limit=0.89:level=false,loudnorm=I=-18:TP=-1.5:LRA=9,aresample=192000,alimiter=limit=0.60:level=false:attack=5:release=50,'
    + 'aresample=48000,volume=0.88[audio]',
  '-t', String(duration), '-map', '[picture]', '-map', '[audio]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
  '-threads', '2', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
const media = probe(output);
if (Math.abs(media.duration - duration) > 1 / 30 || media.duration >= 180) throw new Error('Final film duration mismatch');
const final = resolve(ROOT, 'chaos-factory-demo.mp4');
await copyFile(output, final);
await writeFile(resolve(ROOT, 'edit.json'), JSON.stringify({ ...previous, output: final, edition: 18,
  duration: media.duration, timeline, media, sourceEdition: 17,
  retainedSegments: timeline.length - 2,
  bladeRepair: { selectedSeed: capture.selectedSeed, identicalResult: true, requestedFps: capture.requestedFps,
    cadence, source: sourceFile, normalSpeed: true } }, null, 2) + '\n');
console.log(JSON.stringify({ output: final, seconds: media.duration, cadence }, null, 2));
