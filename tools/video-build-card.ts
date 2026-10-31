import type { Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command } from './drama/capture-media';
import type { BuildProof } from './video-proof';
import type { VideoSegment } from './video-plan';

export function buildCodeLines(proof: BuildProof, patch: string): { before: string; after: string } {
  const lines = patch.split('\n');
  const before = lines.find(line => line.startsWith('-') && line.includes(proof.before));
  const after = lines.find(line => line.startsWith('+') && line.includes(proof.after));
  if (!before || !after) throw new Error('Build card must use actual removed/added Git lines.');
  return { before: before.slice(1).trim(), after: after.slice(1).trim() };
}

/** Brief, explicitly labeled project-source evidence attached to the opening. */
export async function buildCard(page: Page, segment: VideoSegment, index: number): Promise<void> {
  const source = await readFile('apps/show/src/games/peg-fever/scoring.ts', 'utf8');
  const lines = landingExcerpt(source);
  const images = await page.evaluate(async ({ segment, lines }) => {
    await document.fonts.load('78px Lilita');
    await document.fonts.load('42px Fredoka');
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    const images: string[] = [];
    for (let frame = 0; frame < Math.ceil(segment.seconds * 30); frame++) {
      const time = frame / 30;
      const gradient = ctx.createLinearGradient(0, 0, 0, 1080);
      gradient.addColorStop(0, '#ffd56b');
      gradient.addColorStop(1, '#ff8f6b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = '#ffffff44';
      for (let x = 0; x < 1920; x += 48) {
        for (let y = 0; y < 1080; y += 48) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1b1b3a';
      ctx.font = '78px Lilita';
      ctx.fillText('BUILT WITH CODEX', 960, 175);
      ctx.font = '38px Fredoka';
      ctx.fillText('From physics and scoring to the Twitch show', 960, 245);
      ctx.save();
      ctx.translate(0, Math.exp(-time * 11) * 120);
      ctx.fillStyle = '#1b1b3a33';
      ctx.beginPath();
      ctx.roundRect(168, 320, 1600, 520, 28);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#1b1b3a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(160, 310, 1600, 520, 28);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1d4f9c';
      ctx.font = '32px Fredoka';
      ctx.fillText('PEG FEVER / scoring.ts', 215, 375);
      ctx.font = '30px Consolas';
      lines.forEach((line, index) => {
        ctx.fillStyle = index === 3 ? '#218747' : '#1b1b3a';
        ctx.fillText(line, 215, 450 + index * 49);
      });
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1b1b3a';
      ctx.font = '30px Fredoka';
      ctx.fillText('Actual project source excerpt', 960, 940);
      images.push(canvas.toDataURL().split(',')[1]);
    }
    return images;
  }, { segment, lines });
  const directory = resolve('qa/submission-video/edit/cards');
  const frames = resolve(directory, `build-${index}-frames`);
  await mkdir(frames, { recursive: true });
  await Promise.all(images.map((data, frame) => writeFile(resolve(frames,
    `${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))));
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30',
    '-i', resolve(frames, '%04d.png'), '-frames:v', String(images.length),
    '-c:v', 'libvpx', '-pix_fmt', 'yuv420p', '-deadline', 'realtime', '-cpu-used', '6',
    '-b:v', '8M', '-threads', '2', resolve(directory, `build-${index}-motion.webm`)]);
  console.log(`Opening source glimpse ${index}: ${segment.seconds}s`);
}

export function landingExcerpt(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex(line => line.includes('const multiplier = SLOTS[slot]'));
  if (start < 0 || !lines[start + 1]?.includes('const total = shot.points * multiplier')) {
    throw new Error('Peg Fever scoring source changed; review the build excerpt.');
  }
  return lines.slice(start, start + 7).map(line => line.slice(4));
}
