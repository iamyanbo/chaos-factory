import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve('qa/submission-video');
const OUTPUT = resolve(ROOT, 'chaos-factory-thumbnail-action.png');
const SOURCE = resolve(ROOT, 'thumbnail-action-source.png');
const font = (await readFile('apps/show/public/fonts/LilitaOne-Regular.ttf')).toString('base64');
const source = (await readFile(SOURCE)).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(`<style>
    @font-face{font-family:Lilita;src:url(data:font/ttf;base64,${font})}
    body{margin:0}canvas{display:block}
    </style><canvas width="1280" height="720"></canvas>`);
  await page.addScriptTag({ content: 'globalThis.__name = fn => fn;' });
  await page.evaluate(async source => {
    await document.fonts.load('150px Lilita');
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const ctx = document.querySelector('canvas')!.getContext('2d')!;
    const ink = '#1b1b3a';
    // A single, continuous gameplay crop. No objects are moved or duplicated.
    ctx.drawImage(image, 580, 310, 720, 560, 385, -12, 935, 751);
    const warm = ctx.createLinearGradient(0, 0, 0, 720);
    warm.addColorStop(0, '#ffd56b');
    warm.addColorStop(1, '#ff8f6b');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(615, 0);
    ctx.lineTo(465, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fillStyle = warm;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff38';
    for (let x = 20; x < 620; x += 38) {
      for (let y = 18; y < 720; y += 38) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(615, -10);
    ctx.lineTo(465, 730);
    ctx.stroke();
    const word = (text: string, x: number, y: number, size: number, fill: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.055);
      ctx.font = `${size}px Lilita`;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 16;
      ctx.strokeText(text, 4, 8);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 8;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = fill;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    word('CHAOS', 37, 195, 150, ink);
    word('FACTORY', 35, 325, 122, ink);
    word('YOU', 43, 478, 99, 'white');
    word('vs CHAT', 40, 594, 94, '#ffde3b');
  }, source);
  await page.screenshot({ path: OUTPUT });
} finally {
  await browser.close();
}
const bytes = await readFile(OUTPUT);
await writeFile(resolve(ROOT, 'thumbnail-action.json'), JSON.stringify({
  file: OUTPUT,
  width: 1280,
  height: 720,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  source: 'blade-smooth/game.webm',
  sourceTimeSeconds: 82.2,
  crop: [580, 310, 720, 560],
  method: 'Single gameplay close-up plus project title and YOU vs CHAT caption; no generated illustration or rearranged game objects.',
  font: 'Lilita One',
}, null, 2) + '\n');
console.log(OUTPUT);
