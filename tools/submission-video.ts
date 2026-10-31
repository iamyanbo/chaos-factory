import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { command, probe } from './drama/capture-media';
import { transitionAudio } from './video-edit-audio';
import { cameraKeys, editorialPictureFilters } from './video-motion';
import { EDIT_BPM, INTRO_SECONDS, MUSIC_START_SECONDS } from './video-rhythm';
import { submissionVideoPlan, type RoundVideo, type JoinVideo, type CrowdVideo, type HostVideo } from './video-plan';
import { assertEffectsOnly, type AudioCaptureProof } from './video-audio';
import { loadAlternateVideo, optionalVideos } from './video-optional';

const directory = 'qa/submission-video/edit';
const root = 'qa/submission-video';
const AAC_HEADROOM_GAIN = .88;
await mkdir(`${directory}/segments-v16`, { recursive: true });
const rounds = JSON.parse(await readFile(`${root}/rounds-v16/capture.json`, 'utf8')) as RoundVideo & AudioCaptureProof;
await loadAlternateVideo(rounds, 'peg-fever');
const crowd = JSON.parse(await readFile(`${root}/join-crowd-v16/capture.json`, 'utf8')) as CrowdVideo & AudioCaptureProof;
const live = existsSync(`${root}/live-join/capture.json`)
  ? JSON.parse(await readFile(`${root}/live-join/capture.json`, 'utf8')) as JoinVideo : undefined;
assertEffectsOnly(rounds);
assertEffectsOnly(crowd);
const host = JSON.parse(await readFile(`${root}/host-setup-v16/capture.json`, 'utf8')) as HostVideo;
const plan = submissionVideoPlan(rounds, live, crowd, process.argv.includes('--offline-preview'), host, await optionalVideos());
const run = (args: string[]) => command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const audioOnly = process.argv.includes('--audio-only');
const segmentFlag = process.argv.indexOf('--segment');
const selected = segmentFlag < 0 ? undefined : process.argv[segmentFlag + 1].split(',').map(Number);
if (selected?.some(index => !Number.isInteger(index) || !plan[index])) throw new Error('Invalid segment index');
const files: string[] = [];
const timeline: object[] = [];
let elapsed = 0;
for (const [index, segment] of plan.entries()) {
  const capturedAudio = ['rounds', 'alternate', 'crowd', 'optional'].includes(segment.source);
  const gameplay = capturedAudio || segment.source === 'setup';
  const source = segment.source === 'rounds' ? `${root}/rounds-v16/rounds.webm`
    : segment.source === 'alternate' ? `${root}/alternate-games/${segment.gameId}/game.webm`
    : segment.source === 'crowd' ? `${root}/join-crowd-v16/crowd.webm`
    : segment.source === 'setup' ? `${root}/host-setup-v16/dashboard.webm`
    : segment.source === 'optional' ? `${root}/optional-games/${segment.gameId}/game.webm`
    : segment.source === 'section' ? `${directory}/cards/section-${index}-motion.webm`
    : `${directory}/cards/${segment.source}-motion.webm`;
  if (!gameplay && probe(source).duration < segment.seconds - 1 / 30) {
    throw new Error(`${segment.source} animation is shorter than its reading hold; regenerate the cards.`);
  }
  const inputs = ['-ss', String(segment.from), '-i', source,
    '-loop', '1', '-framerate', '30', '-i', `${directory}/cards/wipe.png`,
    ...(gameplay ? ['-i', `${directory}/overlays/${index}/overlay.mov`]
      : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']),
    ...(segment.source === 'setup' ? ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'] : []),
    ...(segment.inset ? ['-ss', String(segment.inset.from), '-i', `${root}/live-join/live-join.webm`] : [])];
  const motion = cameraKeys(segment, host);
  const filters = [...editorialPictureFilters(segment, motion),
    '[1:v]format=rgba,split=2[wi][wo]'];
  let video = 'base';
  if (gameplay) {
    filters.push('[base][2:v]overlay=0:0:format=auto[decorated]');
    video = 'decorated';
  }
  if (segment.inset) {
    const { at, seconds } = segment.inset;
    filters.push(`[3:v]crop=1024:1024:448:24,scale=376:376,setsar=1,setpts=PTS-STARTPTS+${at}/TB[real]`);
    filters.push(`[${video}][real]overlay=x=1492:y=500:enable='between(t,${at},${at + seconds})':format=auto[inset]`);
    video = 'inset';
  }
  // Both sides meet on the same solid plate at the edit: no abrupt source jump.
  filters.push(`[${video}][wi]overlay=x='-200+12000*t':y=0:enable='${index ? 'lt(t,0.2)' : '0'}':format=auto[arrived]`);
  filters.push(`[arrived][wo]overlay=x='-2600+12000*(t-${segment.seconds - .2})':y=0:enable='${index < plan.length - 1 ? `gte(t,${segment.seconds - .2})` : '0'}':format=auto,format=yuv420p[out]`);
  const output = `${directory}/segments-v16/${String(index).padStart(2, '0')}.mp4`;
  const renderThis = !audioOnly && (selected === undefined || selected.includes(index));
  if (renderThis) run([...inputs, '-t', String(segment.seconds), '-filter_complex', filters.join(';'),
    '-map', '[out]', '-map', capturedAudio ? '0:a' : segment.source === 'setup' ? '3:a' : '2:a',
    '-af', `volume=${gameplay ? 1.4 : 1},afade=t=in:d=0.025,afade=t=out:st=${segment.seconds - .04}:d=0.04`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
  files.push(`file '${String(index).padStart(2, '0')}.mp4'`);
  timeline.push({ start: elapsed, end: elapsed + segment.seconds, ...segment, editorialCamera: motion, sourceFrom: segment.from });
  elapsed += segment.seconds;
  console.log(`${renderThis ? 'Rendered' : 'Reusing video'} ${index + 1}/${plan.length}: ${segment.title || segment.gameId || segment.source}`);
}
await writeFile(`${directory}/segments-v16/concat.txt`, files.join('\n') + '\n');
if (process.argv.includes('--segments-only')) {
  console.log('Selected segments prepared; final assembly deferred.');
  process.exit(0);
}
const picture = `${directory}/story-picture-v16.mp4`;
run(['-f', 'concat', '-safe', '0', '-i', `${directory}/segments-v16/concat.txt`, '-c', 'copy', picture]);
const draft = !plan.some(row => row.inset?.evidence === 'real-chat');
const output = resolve(`${root}/${draft ? 'chaos-factory-offline-preview-v16' : 'chaos-factory-demo-v16'}.mp4`);
const swishes = `${directory}/transition-swishes.wav`;
const boundaries = plan.slice(0, -1).map((_, index) => plan.slice(0, index + 1).reduce((sum, row) => sum + row.seconds, 0));
await transitionAudio(boundaries, elapsed, swishes);
run(['-i', picture, '-stream_loop', '-1', '-i', 'apps/show/public/music/adventure-2.ogg', '-i', swishes,
  '-filter_complex', `[0:v]fps=30,setpts=N/(30*TB)[picture];[0:a][2:a]amix=inputs=2:normalize=0[fx];[fx]asplit=2[game][key];[1:a]atrim=start=${MUSIC_START_SECONDS},asetpts=PTS-STARTPTS,volume=0.22,afade=t=in:d=0.2,afade=t=out:st=${elapsed - 1.2}:d=1.2[bed];[bed][key]sidechaincompress=threshold=0.035:ratio=4:attack=8:release=180[duck];[game][duck]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=false,loudnorm=I=-18:TP=-1.5:LRA=9,aresample=192000,alimiter=limit=0.60:level=false:attack=5:release=50,aresample=48000,volume=${AAC_HEADROOM_GAIN}[audio]`,
  '-t', String(elapsed), '-map', '[picture]', '-map', '[audio]',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]);
const media = JSON.parse(command('ffprobe', ['-v', 'error', '-show_entries',
  'format=duration:stream=codec_type,width,height', '-of', 'json', output]));
const duration = Number(media.format.duration);
if (!(duration > 0 && duration < 180) || !media.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio')) {
  throw new Error('Final MP4 must have audio and stay under three minutes');
}
await writeFile(`${root}/edit.json`, JSON.stringify({ output, edition: 16, draft, duration,
  audio: { musicBeds: 1, music: 'adventure-2.ogg', roundAudio: 'verified sfx-only',
    crowdAudio: 'verified sfx-only', hostAudio: 'silent browser viewport recording', liveAudio: 'muted original mix',
    transitionAudio: 'original procedural stereo whooshes' },
  rhythm: { bpm: EDIT_BPM, musicOffsetSeconds: MUSIC_START_SECONDS, cutGridSeconds: INTRO_SECONDS },
  normalSpeedGameplay: true, desktopCaptured: false, realBroadcast: false,
  buildEvidence: 'Opening implementation credit and closing GitHub URL only; no code excerpt or Codex app footage',
  footage: 'Current eight-game dashboard workflow in mock mode; independent-round clips and three additional games at captured speed; 48 mock joins and the separately labeled historical real Twitch inset.',
  transitions: 'Held close-up cuts without moving pans, animated queue instructions, MINIGAMES/CHAT VS STREAMER stingers, centered text captions and independently scattered Twitch event reactions and Toy wipes', timeline, media }, null, 2));
if (!draft) await copyFile(output, resolve(`${root}/chaos-factory-demo.mp4`));
console.log(JSON.stringify({ output, duration, draft }, null, 2));
