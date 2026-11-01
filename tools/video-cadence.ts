import { command } from './drama/capture-media';

/** Measure timestamps actually encoded by MediaRecorder, rather than the game's rAF counter. */
export function recordedCadence(path: string, from: number, seconds: number) {
  const data = JSON.parse(command('ffprobe', ['-v', 'error', '-select_streams', 'v',
    '-show_entries', 'packet=pts_time', '-of', 'json', path])) as { packets: { pts_time?: string }[] };
  const times = data.packets.map(packet => Number(packet.pts_time))
    .filter(time => Number.isFinite(time) && time >= from && time <= from + seconds);
  if (times.length < 2) throw new Error('Not enough recorded video frames');
  const gaps = times.slice(1).map((time, index) => time - times[index]);
  if (gaps.some(gap => gap <= 0)) throw new Error('Non-increasing source video timestamps');
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    from, seconds, recordedFrames: times.length,
    framesPerSecond: (times.length - 1) / (times.at(-1)! - times[0]),
    p99GapMs: sorted[Math.floor((sorted.length - 1) * .99)] * 1000,
    maxGapMs: Math.max(...gaps) * 1000,
    gapsOver100Ms: gaps.filter(gap => gap > .1).length,
  };
}
