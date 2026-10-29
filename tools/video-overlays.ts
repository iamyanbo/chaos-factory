import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command } from './drama/capture-media';
import type { CrowdVideo, VideoSegment } from './video-plan';

const FPS = 30;
const BATCH = 20;

/** Deterministic transparent motion graphics, separate from the untouched game canvas. */
export async function gameplayOverlay(page: Page, segment: VideoSegment, index: number, crowd: CrowdVideo): Promise<string> {
  const directory = resolve('qa/submission-video/edit/overlays', String(index));
  await mkdir(directory, { recursive: true });
  const frames = Math.ceil(segment.seconds * FPS);
  for (let start = 0; start < frames; start += BATCH) {
    const batch = await page.evaluate(async ({ segment, crowd, start, count, fps }) => {
      await document.fonts.load('60px Lilita');
      await document.fonts.load('32px Fredoka');
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      const INK = '#1b1b3a';
      const PINK = '#ff4f7b';
      const ease = (age: number) => 1 - Math.exp(-Math.max(0, age) * 10);
      function box(x: number, y: number, width: number, height: number) {
        ctx.fillStyle = '#1b1b3a33';
        ctx.beginPath();
        ctx.roundRect(x + 7, y + 9, width, height, 22);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 22);
        ctx.fill();
        ctx.stroke();
      }
      function lines(text: string, x: number, y: number, width: number, size: number,
        display = false, color = INK): number {
        ctx.font = `${size}px ${display ? 'Lilita' : 'Fredoka'}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let at = y;
        for (const paragraph of text.split('\n')) {
          let line = '';
          for (const word of paragraph.split(' ')) {
            const next = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(next).width > width) {
              ctx.fillText(line, x, at);
              at += size * 1.2;
              line = word;
            } else line = next;
          }
          ctx.fillText(line, x, at);
          at += size * 1.2;
        }
        return at;
      }
      function badge() {
        const label = 'SIMULATED AUDIENCE';
        ctx.font = '21px Fredoka';
        const width = ctx.measureText(label).width + 24;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.roundRect(1888 - width, 7, width, 36, 9);
        ctx.fill();
        lines(label, 1900 - width, 13, width, 21, false, 'white');
      }
      function rule(time: number) {
        if (!segment.title) return;
        const lifetime = Math.min(7.5, segment.seconds - .3);
        const alpha = Math.min(1, time / .2, (lifetime - time) / .3);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (segment.title === 'TOP EIGHT') {
          const x = 1200 + (1 - ease(time)) * 720;
          box(x, 40, 680, 190);
          lines(segment.title, x + 24, 59, 630, 44, true);
          lines(segment.body, x + 24, 122, 630, 30);
          ctx.restore();
          return;
        }
        const scale = 1 + Math.sin(time * 16) * Math.exp(-time * 5) * .07;
        ctx.translate(42 - (1 - ease(time)) * 440, 655);
        ctx.scale(scale, scale);
        box(0, 0, 380, 370);
        const next = lines(segment.title, 23, 21, 334, 51, true, INK);
        ctx.fillStyle = '#ffde3b';
        ctx.fillRect(23, next + 7, 80 + Math.min(250, time * 180), 7);
        lines(segment.body, 23, next + 34, 334, 32);
        ctx.restore();
      }
      function credit(time: number) {
        if (!segment.credit) return;
        const age = time - 2.4;
        const alpha = Math.min(1, age / .2, (Math.min(8.4, segment.seconds - .35) - time) / .3);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        const x = 1480 + (1 - ease(age)) * 460;
        box(x, 720, 400, 245);
        lines('IMPLEMENTED BY CODEX', x + 24, 744, 350, 25, true, PINK);
        lines(segment.credit, x + 24, 788, 350, 28);
        ctx.restore();
      }
      function crowdFeed(time: number) {
        if (segment.source !== 'crowd') return;
        const sourceTime = segment.from + time;
        if (sourceTime < crowd.playAt! - .5) {
          const arrived = crowd.joins.filter(join => join.wall <= sourceTime);
          const recent = arrived.slice(-4);
          recent.forEach((join, position) => {
            const age = sourceTime - join.wall;
            const x = 1480 + (1 - ease(age)) * 420;
            const y = 450 + position * 122;
            box(x, y, 400, 100);
            ctx.beginPath();
            ctx.arc(x + 38, y + 50, 19, 0, Math.PI * 2);
            ctx.fillStyle = join.color;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 4;
            ctx.fill();
            ctx.stroke();
            lines(join.name, x + 73, y + 17, 302, 26, true);
            lines('!join', x + 73, y + 53, 300, 25, false, PINK);
          });
        }
        const inset = segment.inset;
        if (inset && time >= inset.at && time <= inset.at + inset.seconds) {
          box(1480, 435, 400, 510);
          lines('REAL TWITCH TEST', 1504, 454, 356, 27, true, PINK);
          lines(`@${inset.name} | channel offline`, 1504, 901, 356, 22);
        }
      }
      const output: string[] = [];
      for (let frame = start; frame < start + count; frame++) {
        const time = frame / fps;
        ctx.clearRect(0, 0, 1920, 1080);
        badge();
        rule(time);
        credit(time);
        crowdFeed(time);
        output.push(canvas.toDataURL().split(',')[1]);
      }
      return output;
    }, { segment, crowd, start, count: Math.min(BATCH, frames - start), fps: FPS });
    await Promise.all(batch.map((data, offset) => writeFile(
      resolve(directory, `${String(start + offset).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))));
  }
  const output = resolve(directory, 'overlay.mov');
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS),
    '-i', resolve(directory, '%04d.png'), '-frames:v', String(frames), '-c:v', 'qtrle', '-pix_fmt', 'argb', output]);
  console.log(`Overlay ${index}: ${segment.title || 'champion'}`);
  return output;
}
