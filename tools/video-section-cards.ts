import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command } from './drama/capture-media';
import type { VideoSegment } from './video-plan';

/** Full-frame editorial section stingers with a stable reading hold. */
export async function sectionCard(page: Page, segment: VideoSegment, index: number): Promise<void> {
  const directory = resolve('qa/submission-video/edit/cards');
  const frames = await page.evaluate(async ({ segment }) => {
    await document.fonts.load('176px Lilita');
    await document.fonts.load('36px Fredoka');
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    const images: string[] = [];
    const colors = ['#ff4f7b', '#3a8ee6', '#2ecc71', '#8e5cff', '#ffb000'];
    for (let frame = 0; frame < Math.ceil(segment.seconds * 30); frame++) {
      const time = frame / 30;
      const enter = Math.min(1, time / .22);
      const titleAge = Math.max(0, time - .16);
      const pop = 1 - Math.exp(-titleAge * 18) * Math.cos(titleAge * 15);
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
      ctx.save();
      ctx.translate(960, 515);
      ctx.scale(Math.max(.01, pop), Math.max(.01, pop));
      ctx.rotate(-.035);
      for (let ray = 0; ray < 14; ray++) {
        const angle = ray * Math.PI / 7;
        ctx.save();
        ctx.translate(Math.cos(angle) * 720, Math.sin(angle) * 335);
        ctx.rotate(angle);
        ctx.fillStyle = colors[ray % colors.length];
        ctx.fillRect(-22, -8, 75, 16);
        ctx.restore();
      }
      ctx.fillStyle = '#1b1b3a';
      ctx.beginPath();
      ctx.roundRect(-335, -232, 670, 70, 22);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '34px Fredoka';
      ctx.fillText('CHAOS FACTORY', 0, -197);
      ctx.font = '176px Lilita';
      const titleSize = Math.min(176, 176 * 1500 / Math.max(1, ctx.measureText(segment.title).width));
      ctx.font = `${titleSize}px Lilita`;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1b1b3a';
      ctx.lineWidth = 20;
      ctx.strokeText(segment.title, 8, 8);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 11;
      ctx.strokeText(segment.title, 0, 0);
      ctx.fillStyle = '#ffde3b';
      ctx.fillText(segment.title, 0, 0);
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#1b1b3a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(-475, 132, 950, 92, 24);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1b1b3a';
      ctx.font = '38px Fredoka';
      ctx.fillText(segment.body, 0, 178);
      ctx.restore();
      for (let ball = 0; ball < 5; ball++) {
        const age = Math.max(0, time - .12 - ball * .035);
        const scale = Math.min(1, age * 9);
        ctx.save();
        ctx.translate(700 + ball * 130, 870 + (1 - enter) * 140);
        ctx.scale(scale, scale);
        ctx.fillStyle = colors[ball];
        ctx.strokeStyle = '#1b1b3a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      images.push(canvas.toDataURL().split(',')[1]);
    }
    return images;
  }, { segment });
  const frameDirectory = resolve(directory, `section-${index}-frames`);
  await mkdir(frameDirectory, { recursive: true });
  await Promise.all(frames.map((data, frame) => writeFile(
    resolve(frameDirectory, `${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))));
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30',
    '-i', resolve(frameDirectory, '%04d.png'), '-frames:v', String(frames.length),
    '-c:v', 'libvpx', '-pix_fmt', 'yuv420p', '-deadline', 'realtime', '-cpu-used', '6',
    '-b:v', '8M', '-threads', '2', resolve(directory, `section-${index}-motion.webm`)]);
  console.log(`Section ${index}: ${segment.title}`);
}
