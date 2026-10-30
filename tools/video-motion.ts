import type { HostVideo, VideoSegment } from './video-plan';

export interface CameraKey { at: number; zoom: number; x: number; y: number }
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const key = (at: number, zoom = 1, x = 960, y = 540): CameraKey => ({ at, zoom, x, y });

/** Editorial framing only. Recorded simulation time and game cameras stay intact. */
export function cameraKeys(segment: VideoSegment, host?: HostVideo): CameraKey[] {
  const end = segment.seconds;
  if (segment.source === 'setup' && host) {
    const at = (action: string) => (host.actions.find(row => row.action === action)?.at ?? host.readyAt) - segment.from;
    const drag = at('drag-reorder');
    const start = at('start-cup');
    return [key(0), key(.6), key(at('queue:hot-potato') - .15, 1.12, 960, 650),
      key(at('queue:multiplier-cascade') - .1, 1.2, 1130, 660),
      key(drag - 1.05, 1.7, 1430, 765), key(drag + .2, 1.7, 1430, 740),
      key(start - .1, 1.55, 1420, 420), key(start + .9, 1.12, 1100, 360), key(end - .25)];
  }
  // Race's build record and finish stay in a stable full-frame view.
  if (segment.gameId === 'marble-race') return [key(0), key(end)];
  const cue = segment.cues?.[0];
  if (cue) {
    const first = Math.max(segment.chapter ? 3.03 : .3, cue.at - .85);
    const focusY = cue.kind === 'score' ? 690 : 550;
    return [key(0), key(first), key(cue.at - .06, 1.15, 960, focusY),
      key(cue.at + .2, 1.15, 960, focusY), key(Math.min(end - .3, cue.at + 1.05)), key(end)];
  }
  if (segment.gameId === 'multiplier-cascade') {
    return [key(0), key(segment.chapter ? 3.1 : .7), key(end * .66, 1.12, 960, 600), key(end - .3)];
  }
  if (segment.gameId === 'blade-brawl') {
    return [key(0), key(3.1), key(end - 5, 1.12, 960, 530),
      key(end - 2, 1.18, 960, 530), key(end - .25)];
  }
  return [key(0), key(end)];
}

const smooth = (t: number) => t * t * (3 - 2 * t);
export function cameraAt(keys: readonly CameraKey[], time: number): CameraKey {
  let value = { ...keys[0] };
  for (let index = 1; index < keys.length; index++) {
    const before = keys[index - 1];
    const after = keys[index];
    const t = smooth(Math.max(0, Math.min(1, (time - before.at) / (after.at - before.at))));
    for (const field of ['zoom', 'x', 'y'] as const) value[field] = before[field] + (after[field] - before[field]) * t;
    if (time < after.at) break;
  }
  value.at = time;
  return value;
}

function expression(keys: readonly CameraKey[], field: 'zoom' | 'x' | 'y'): string {
  let value = String(keys.at(-1)![field]);
  for (let index = keys.length - 1; index > 0; index--) {
    const before = keys[index - 1];
    const after = keys[index];
    const t = `max(0,min(1,(on/${FPS}-${before.at})/${after.at - before.at}))`;
    const interpolation = `${before[field]}+(${after[field] - before[field]})*(${t})*(${t})*(3-2*(${t}))`;
    value = `if(lt(on/${FPS},${after.at}),${interpolation},${value})`;
  }
  return value;
}

/** Upsample before zoompan to avoid its integer-crop stepping at 1080p. */
export function editorialCameraFilter(keys: readonly CameraKey[]): string {
  if (keys.every(row => row.zoom === 1)) return 'null';
  const zoom = expression(keys, 'zoom');
  const x = `max(0,min(iw-iw/zoom,(${expression(keys, 'x')})/${WIDTH}*iw-iw/(2*zoom)))`;
  const y = `max(0,min(ih-ih/zoom,(${expression(keys, 'y')})/${HEIGHT}*ih-ih/(2*zoom)))`;
  return `scale=3840:2160:flags=bicubic,zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}`;
}

/** Keep original side HUDs readable while the central playfield is punched in. */
export function editorialPictureFilters(segment: VideoSegment, keys: readonly CameraKey[]): string[] {
  const camera = editorialCameraFilter(keys);
  if (!segment.gameId || camera === 'null') {
    return [`[0:v]fps=30,setpts=PTS-STARTPTS,${camera},format=rgba[base]`];
  }
  return ['[0:v]fps=30,setpts=PTS-STARTPTS,split=3[moving][leftRaw][rightRaw]',
    `[moving]${camera},format=rgba[framed]`,
    '[leftRaw]crop=448:1080:0:0[leftHud]',
    '[rightRaw]crop=448:1080:1472:0[rightHud]',
    '[framed][leftHud]overlay=0:0:format=auto[leftProtected]',
    '[leftProtected][rightHud]overlay=1472:0:format=auto[base]'];
}
