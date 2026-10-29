import { writeFile } from 'node:fs/promises';

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const SWISH_SECONDS = .34;
const SWISH_GAIN = .14;

/** Original editorial transition sounds; no synthetic gameplay hits or explosions. */
export async function transitionAudio(boundaries: readonly number[], duration: number, output: string): Promise<void> {
  const frames = Math.ceil(duration * SAMPLE_RATE);
  const mix = new Float32Array(frames * CHANNELS);
  let randomState = 8192;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x1_0000_0000 * 2 - 1;
  };
  for (const [index, boundary] of boundaries.entries()) {
    const first = Math.round((boundary - SWISH_SECONDS / 2) * SAMPLE_RATE);
    const length = Math.round(SWISH_SECONDS * SAMPLE_RATE);
    let low = 0;
    let bass = 0;
    for (let frame = 0; frame < length; frame++) {
      const target = first + frame;
      if (target < 0 || target >= frames) continue;
      const progress = frame / length;
      const noise = random();
      low += (.12 + progress * .28) * (noise - low);
      bass += .025 * (noise - bass);
      const envelope = Math.sin(Math.PI * progress) ** 2;
      const value = (low - bass) * envelope * SWISH_GAIN;
      const pan = index % 2 ? 1 - progress : progress;
      mix[target * 2] += value * Math.sqrt(1 - pan);
      mix[target * 2 + 1] += value * Math.sqrt(pan);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(36 + mix.length * 2, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
  header.writeUInt16LE(CHANNELS * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(mix.length * 2, 40);
  const pcm = Buffer.alloc(mix.length * 2);
  for (let index = 0; index < mix.length; index++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[index])) * 32767), index * 2);
  }
  await writeFile(output, Buffer.concat([header, pcm]));
}
