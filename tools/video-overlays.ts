import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command } from './drama/capture-media';
import type { CrowdVideo, VideoSegment } from './video-plan';
import type { BuildProof } from './video-proof';
import { drawVideoDialogue } from './video-dialogue';
import { installVideoEmotes } from './video-emotes';
import { drawVideoImpact, IMPACT_CAPTION_LAYOUT } from './video-impact';
import { CHAPTER_TIMING } from './video-titles';
const FPS = 30;
const BATCH = 20;
/** Deterministic transparent motion graphics, separate from the untouched game canvas. */
export async function gameplayOverlay(page: Page, segment: VideoSegment, index: number, crowd: CrowdVideo, proof: BuildProof): Promise<string> {
  await installVideoEmotes(page);
  await page.addScriptTag({ content: `window.drawVideoImpact = ${drawVideoImpact.toString()};` });
  await page.addScriptTag({ content: `window.drawVideoDialogue = ${drawVideoDialogue.toString()};` });
  const directory = resolve('qa/submission-video/edit/overlays', String(index));
  await mkdir(directory, { recursive: true });
  const frames = Math.ceil(segment.seconds * FPS);
  for (let start = 0; start < frames; start += BATCH) {
    const batch = await page.evaluate(async ({ segment, crowd, start, count, fps, chapterTiming, proof, impactLayout }) => {
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
        display = false, color = INK, mono = false): number {
        ctx.font = `${size}px ${mono ? 'Consolas' : display ? 'Lilita' : 'Fredoka'}`;
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
        const label = segment.source === 'setup' ? 'TWITCH CONNECTED | HOST CONTROLS' : 'SIMULATED AUDIENCE';
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
        const entry = segment.sectionIntro ? time - 1.85 : segment.chapter ? time - chapterTiming.rulesAt : time;
        const lifetime = Math.min(7.5, segment.seconds - .3);
        const alpha = Math.min(1, entry / .2, (lifetime - time) / .3);
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
        const scale = 1 + Math.sin(entry * 16) * Math.exp(-entry * 5) * .07;
        ctx.translate(42 - (1 - ease(entry)) * 440, 655);
        ctx.scale(scale, scale);
        box(0, 0, 380, 370);
        const next = lines(segment.title, 23, 21, 334, 51, true, INK);
        ctx.fillStyle = '#ffde3b';
        ctx.fillRect(23, next + 7, 80 + Math.min(250, time * 180), 7);
        lines(segment.body, 23, next + 34, 334, 32);
        ctx.restore();
      }
      function display(text: string, x: number, y: number, size: number, color = '#ffde3b') {
        ctx.font = `${size}px Lilita`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        const small = size < 45;
        ctx.strokeStyle = INK;
        ctx.lineWidth = small ? 5 : 12;
        ctx.strokeText(text, x + (small ? 2 : 5), y + (small ? 3 : 7));
        ctx.strokeStyle = small ? INK : 'white';
        ctx.lineWidth = small ? 3 : 6;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
      }
      function chapter(time: number) {
        const AGE_START = chapterTiming.start;
        const LIFE = chapterTiming.hold + chapterTiming.exit;
        const age = time - AGE_START;
        if (!segment.chapter || age < 0 || age > LIFE) return;
        const leave = Math.max(0, Math.min(1, (age - chapterTiming.hold) / chapterTiming.exit));
        const pop = 1 - Math.exp(-age * 24) * Math.cos(age * 20);
        ctx.save();
        ctx.globalAlpha = Math.min(1, age * 12) * (1 - leave);
        ctx.translate(960 - leave * 650, 490 + leave * 230);
        ctx.rotate(-.055 * (1 - leave));
        ctx.scale(pop * (1 - leave * .5), pop * (1 - leave * .5));
        const words = segment.title.split(' ');
        display(segment.chapter === 5 ? 'GRAND FINAL' : `ROUND ${segment.chapter} / 5`, 0, -158, 30, 'white');
        words.forEach((word, index) => display(word, 0, -50 + index * 132, 128));
        ctx.restore();
      }
      function celebration(time: number) {
        if (!segment.celebrate) return;
        const colors = ['#ff4f7b', '#ffde3b', '#3a8ee6', '#2ecc71'];
        for (let index = 0; index < 22; index++) {
          const age = time + (index % 7) * .12;
          const left = index % 2 === 0;
          const x = (left ? 30 : 1890) + (left ? 1 : -1) * (age * 28 + index % 5 * 24);
          const y = (index * 107 + age * 130) % 1090;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(age * 2 + index);
          ctx.fillStyle = colors[index % colors.length];
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-8, -4, 28, 12, 4);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
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
      function buildRecord(time: number) {
        if (!segment.buildProof || time < 3.2 || time > 13.2) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (time - 3.2) * 5, (13.2 - time) * 5);
        const x = 1480;
        box(x, 515, 400, 520);
        lines('ACTUAL BUILD RECORD', x + 22, 536, 356, 29, true);
        ctx.fillStyle = '#ffde3b';
        ctx.fillRect(x + 22, 578, 356, 6);
        if (time < 7.8) {
          lines('MY PROMPT', x + 22, 609, 356, 22, true, PINK);
          const next = lines(proof.request.excerpt, x + 22, 646, 356, 30);
          lines('CODEX REPLY', x + 22, next + 26, 356, 22, true, '#3a8ee6');
          lines(proof.response.excerpt, x + 22, next + 63, 356, 30);
          lines('Edited project transcript', x + 22, 990, 356, 21);
        } else {
          lines('CODEX CHANGE', x + 22, 609, 356, 22, true, '#3a8ee6');
          lines('kit/hype/view.ts', x + 22, 646, 356, 22, false, INK, true);
          lines('BEFORE', x + 22, 701, 356, 21, true, PINK);
          lines(proof.before, x + 22, 738, 356, 20, false, INK, true);
          lines('AFTER', x + 22, 824, 356, 21, true, '#218747');
          lines(proof.after.replace('hypeFocus', '\nhypeFocus'), x + 22, 861, 356, 20, false, INK, true);
          lines(`COMMIT ${proof.commit.slice(0, 7)}`, x + 22, 990, 356, 21);
        }
        ctx.restore();
      }
      const output: string[] = [];
      for (let frame = start; frame < start + count; frame++) {
        const time = frame / fps;
        ctx.clearRect(0, 0, 1920, 1080);
        badge();
        rule(time);
        crowdFeed(time);
        chapter(time);
        buildRecord(time);
        window.drawVideoImpact(ctx, segment, time, impactLayout);
        celebration(time);
        window.drawVideoDialogue(ctx, segment, time);
        output.push(canvas.toDataURL().split(',')[1]);
      }
      return output;
    }, { segment, crowd, start, count: Math.min(BATCH, frames - start), fps: FPS, chapterTiming: CHAPTER_TIMING, proof, impactLayout: IMPACT_CAPTION_LAYOUT });
    await Promise.all(batch.map((data, offset) => writeFile(
      resolve(directory, `${String(start + offset).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))));
  }
  const output = resolve(directory, 'overlay.mov');
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS),
    '-i', resolve(directory, '%04d.png'), '-frames:v', String(frames), '-c:v', 'qtrle', '-pix_fmt', 'argb', output]);
  console.log(`Overlay ${index}: ${segment.title || 'champion'}`);
  return output;
}
