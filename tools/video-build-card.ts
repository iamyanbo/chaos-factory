import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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

/** Readable full-screen evidence, clearly presented as conversation/code excerpts. */
export async function buildCard(page: Page, segment: VideoSegment, index: number, proof: BuildProof): Promise<void> {
  const patch = execFileSync('git', ['show', proof.commit, '--format=', '--', proof.file],
    { encoding: 'utf8', windowsHide: true });
  const code = buildCodeLines(proof, patch);
  const images = await page.evaluate(async ({ segment, proof, code }) => {
    await document.fonts.load('78px Lilita');
    await document.fonts.load('48px Fredoka');
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    const ink = '#1b1b3a';
    const images: string[] = [];
    function card(x: number, y: number, w: number, h: number, color = 'white') {
      ctx.fillStyle = '#1b1b3a33';
      ctx.beginPath();
      ctx.roundRect(x + 8, y + 10, w, h, 26);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 26);
      ctx.fill();
      ctx.stroke();
    }
    function text(body: string, x: number, y: number, width: number, size: number, font = 'Fredoka', color = ink) {
      ctx.font = `${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let line = '';
      let at = y;
      for (const word of body.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > width) {
          ctx.fillText(line, x, at);
          at += size * 1.25;
          line = word;
        } else line = next;
      }
      ctx.fillText(line, x, at);
    }
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
      text('BUILT WITH CODEX', 96, 75, 1720, 78, 'Lilita');
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (time - .25) / .2));
      text('MY FEEDBACK', 120, 210, 700, 28, 'Lilita', '#cc2453');
      card(96, 255, 760, 255);
      text(proof.request.excerpt, 128, 295, 690, 48);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (time - 1.8) / .25));
      text('CODEX', 120, 566, 700, 28, 'Lilita', '#1d4f9c');
      card(96, 610, 760, 190);
      text(proof.response.excerpt, 128, 646, 690, 46);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (time - 3.1) / .25));
      text('COMMITTED FIX', 944, 210, 820, 28, 'Lilita', '#1d4f9c');
      card(920, 255, 904, 580);
      text('kit/hype/view.ts', 952, 282, 830, 30, 'Consolas');
      ctx.fillStyle = '#ffe8ef';
      ctx.fillRect(944, 348, 856, 180);
      text('BEFORE', 964, 365, 800, 24, 'Lilita', '#cc2453');
      text(code.before, 964, 405, 808, 29, 'Consolas');
      ctx.fillStyle = '#e1f7e9';
      ctx.fillRect(944, 567, 856, 175);
      text('AFTER', 964, 584, 800, 24, 'Lilita', '#218747');
      text(code.after, 964, 624, 808, 29, 'Consolas');
      text(`Commit ${proof.commit.slice(0, 7)}`, 952, 775, 820, 25, 'Fredoka');
      ctx.restore();
      text('Selected project conversation and committed code', 96, 990, 1720, 25);
      images.push(canvas.toDataURL().split(',')[1]);
    }
    return images;
  }, { segment, proof, code });
  const directory = resolve('qa/submission-video/edit/cards');
  const frames = resolve(directory, `build-${index}-frames`);
  await mkdir(frames, { recursive: true });
  await Promise.all(images.map((data, frame) => writeFile(resolve(frames,
    `${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))));
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30',
    '-i', resolve(frames, '%04d.png'), '-frames:v', String(images.length),
    '-c:v', 'libvpx', '-pix_fmt', 'yuv420p', '-deadline', 'realtime', '-cpu-used', '6',
    '-b:v', '8M', '-threads', '2', resolve(directory, `build-${index}-motion.webm`)]);
  console.log(`Build section ${index}: ${segment.seconds}s`);
}
