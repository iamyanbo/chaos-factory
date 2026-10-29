import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { submissionVideoPlan, type CupVideo, type JoinVideo } from './video-plan';

const directory = 'qa/submission-video/edit';
await mkdir(`${directory}/segments`, { recursive: true });
const cupPath = 'qa/submission-video/full-cup';
const livePath = 'qa/submission-video/live-join';
const cup = JSON.parse(await readFile(`${cupPath}/capture.json`, 'utf8')) as CupVideo;
const live = existsSync(`${livePath}/capture.json`)
  ? JSON.parse(await readFile(`${livePath}/capture.json`, 'utf8')) as JoinVideo : undefined;
const plan = submissionVideoPlan(cup, live, process.argv.includes('--offline-preview'));
function run(args: string[]) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
}
const files: string[] = [];
const timeline: { start: number; end: number; source: string; sourceFrom: number; evidence: string; title: string }[] = [];
let elapsed = 0;
for (const [index, segment] of plan.entries()) {
  const gameplay = segment.source === 'cup' || segment.source === 'live';
  const inputs = gameplay
    ? ['-ss', String(segment.from), '-i', `${segment.source === 'cup' ? cupPath : livePath}/${segment.source === 'cup' ? 'full-cup' : 'live-join'}.webm`,
      '-loop', '1', '-framerate', '30', '-i', `${directory}/cards/overlay-${index}.png`]
    : ['-loop', '1', '-framerate', '30', '-i', `${directory}/cards/${segment.source}.png`,
      '-stream_loop', '-1', '-i', 'apps/show/public/music/menu.ogg'];
  const output = `${directory}/segments/${String(index).padStart(2, '0')}.mp4`;
  const video = gameplay
    ? ['-filter_complex', '[0:v]fps=30,format=rgba[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p[out]', '-map', '[out]', '-map', '0:a']
    : ['-vf', 'fps=30,format=yuv420p', '-map', '0:v', '-map', '1:a'];
  run([...inputs, '-t', String(segment.seconds), ...video,
    '-af', `volume=${gameplay ? 3.5 : 1.4},alimiter=limit=0.89:level=false,afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, segment.seconds - .12)}:d=0.12`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
  files.push(`file '${String(index).padStart(2, '0')}.mp4'`);
  timeline.push({ start: elapsed, end: elapsed + segment.seconds, source: segment.source,
    sourceFrom: segment.from, evidence: segment.evidence, title: segment.title.replaceAll('\n', ' ') });
  elapsed += segment.seconds;
  console.log(`Rendered ${index + 1}/${plan.length}: ${segment.title.replaceAll('\n', ' ') || segment.source}`);
}
await writeFile(`${directory}/segments/concat.txt`, files.join('\n') + '\n');
const draft = !plan.some(row => row.evidence === 'real-chat');
const output = resolve(`qa/submission-video/${draft ? 'chaos-factory-offline-preview' : 'chaos-factory-demo'}.mp4`);
run(['-f', 'concat', '-safe', '0', '-i', `${directory}/segments/concat.txt`, '-c', 'copy', '-movflags', '+faststart', output]);
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height',
  '-of', 'json', output], { encoding: 'utf8' });
if (probe.status !== 0) throw new Error('Could not verify the final MP4');
const media = JSON.parse(probe.stdout);
const duration = Number(media.format.duration);
if (!(duration > 0 && duration < 180) || !media.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio')) {
  throw new Error('Final MP4 must have audio and stay under three minutes');
}
await writeFile('qa/submission-video/edit.json', JSON.stringify({ output, draft, duration,
  normalSpeedGameplay: true, desktopCaptured: false, realBroadcast: false,
  footage: 'Edited normal-speed game excerpts; real Twitch chat proof if present; actual project-file cards.', timeline, media }, null, 2));
console.log(JSON.stringify({ output, duration, draft }, null, 2));
