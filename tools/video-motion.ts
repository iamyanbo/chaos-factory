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
    const at = (action: string) => host.actions.find(row => row.action === action)!.at - segment.from;
    return [key(0), key(at('queue:multiplier-cascade') + .2, 1.7, 1355, 760),
      key(at('start-cup') - 1, 1.55, 1300, 540), key(at('start-cup') + .9), key(end)];
  }
  const cue = segment.cues?.[0];
  if (cue && segment.gameId !== 'marble-race') {
    const titleEnd = segment.chapter ? 3.03 : 0;
    const closeUpAt = Math.max(titleEnd, cue.at - .15);
    return [key(0), key(closeUpAt, 1.1),
      key(Math.min(end - .3, cue.at + .8)), key(end)];
  }
  if (segment.gameId === 'blade-brawl') {
    return [key(0), key(end - 5, 1.1), key(end - .4), key(end)];
  }
  return [key(0), key(end)];
}

/** Hold a composition until a deliberate cut; never interpolate lateral position. */
export function cameraAt(keys: readonly CameraKey[], time: number): CameraKey {
  const pose = [...keys].reverse().find(row => row.at <= time) ?? keys[0];
  return { ...pose, at: time };
}

function expression(keys: readonly CameraKey[], field: 'zoom' | 'x' | 'y'): string {
  let value = String(keys.at(-1)![field]);
  for (let index = keys.length - 1; index > 0; index--) {
    const before = keys[index - 1];
    const after = keys[index];
    value = `if(lt(on/${FPS},${after.at}),${before[field]},${value})`;
  }
  return value;
}

/** Static digital close-ups. Switching compositions is an edit, without a camera travel. */
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
