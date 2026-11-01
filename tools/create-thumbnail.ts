import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve('qa/submission-video');
const OUTPUT = resolve(ROOT, 'chaos-factory-thumbnail-v2.png');
const SOURCE_FILES = ['film-30.png', 'film-10.png', 'film-14.png']
  .map(file => resolve(ROOT, 'v18-review', file));
const [displayFont, bodyFont] = await Promise.all(['LilitaOne-Regular.ttf', 'Fredoka.ttf']
  .map(async file => (await readFile(resolve('apps/show/public/fonts', file))).toString('base64')));
const images = await Promise.all(SOURCE_FILES.map(async path =>
  `data:image/png;base64,${(await readFile(path)).toString('base64')}`));
await mkdir(ROOT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>
    @font-face{font-family:Lilita;src:url('data:font/ttf;base64,${displayFont}')}
    @font-face{font-family:Fredoka;src:url('data:font/ttf;base64,${bodyFont}');font-weight:100 900}
    body{margin:0}canvas{display:block}
    </style><canvas width="1280" height="720"></canvas>`);
  await page.addScriptTag({ content: 'globalThis.__name = fn => fn;' });
  await page.evaluate(async ({ images }) => {
    await document.fonts.load('125px Lilita');
    await document.fonts.load('34px Fredoka');
    const loaded = await Promise.all(images.map(async source => {
      const image = new Image();
      image.src = source;
      await image.decode();
      return image;
    }));
    const canvas = document.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const ink = '#1b1b3a';
    const gradient = ctx.createLinearGradient(0, 0, 0, 720);
    gradient.addColorStop(0, '#ffd56b');
    gradient.addColorStop(1, '#ff8f6b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#ffffff44';
    for (let x = 8; x < 1280; x += 32) {
      for (let y = 8; y < 720; y += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 3.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The hero is an unaltered crop of the actual Blade Brawl arena.
    ctx.save();
    ctx.beginPath();
    ctx.arc(965, 360, 382, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(loaded[0], 460, 40, 1000, 1000, 575, -30, 780, 780);
    ctx.restore();
    const word = (text: string, x: number, y: number, size: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-.055);
      ctx.textAlign = 'center';
      ctx.font = `${size}px Lilita`;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 14;
      ctx.strokeText(text, 5, 7);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 9;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = ink;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    // Same local font, outline and rotation as the existing video intro.
    word('CHAOS', 298, 220, 133);
    word('FACTORY', 298, 360, 125);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(62, 410, 474, 60, 18);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '600 31px Fredoka';
    ctx.textAlign = 'center';
    ctx.fillText('8 GAMES. JUST !JOIN.', 299, 451);
    const inset = (image: HTMLImageElement, crop: number[], x: number, label: string) => {
      const y = 508;
      const w = 220;
      const h = 180;
      ctx.fillStyle = '#1b1b3a33';
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 7, w, h, 18);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 18);
      ctx.clip();
      ctx.drawImage(image, crop[0], crop[1], crop[2], crop[3], x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 18);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.roundRect(x + 16, y - 14, w - 32, 35, 10);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '22px Lilita';
      ctx.fillText(label, x + w / 2, y + 11);
    };
    inset(loaded[1], [510, 320, 900, 730], 60, 'CASCADE');
    inset(loaded[2], [525, 165, 875, 720], 315, 'PEG FEVER');
  }, { images });
  await page.screenshot({ path: OUTPUT });
} finally { await browser.close(); }
const bytes = await readFile(OUTPUT);
await writeFile(resolve(ROOT, 'thumbnail-v2.json'), JSON.stringify({
  file: OUTPUT, width: 1280, height: 720, bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  method: 'Actual gameplay crops and the existing intro typography; no generative illustration.',
  sourceFiles: SOURCE_FILES, fonts: ['Lilita One', 'Fredoka'],
}, null, 2) + '\n');
console.log(`Gameplay thumbnail: ${OUTPUT} (${bytes.length} bytes)`);
