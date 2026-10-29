import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { finalizeRecording } from './drama/capture-media';
import { gameplayOverlay } from './video-overlays';
import { submissionVideoPlan, type CrowdVideo, type CupVideo, type JoinVideo } from './video-plan';

const directory = resolve('qa/submission-video/edit/cards');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript('globalThis.__name = fn => fn;');
  await page.goto('http://127.0.0.1:4182/fonts/Fredoka-OFL.txt');
  const css = `<style>
    @font-face{font-family:Lilita;src:url('/fonts/LilitaOne-Regular.ttf')}
    @font-face{font-family:Fredoka;src:url('/fonts/Fredoka.ttf')}
    body{margin:0;width:1920px;height:1080px;color:#1b1b3a;text-align:center;
    background:radial-gradient(circle at 5px 5px,#ffffff55 4px,transparent 5px) 0 0/48px 48px,
    linear-gradient(#ffd56b,#ff8f6b);font-family:Fredoka}
    h1{font:148px Lilita;margin:270px 0 20px}p{font-size:36px;margin:24px}
    .url{display:inline-block;padding:20px 34px;border:5px solid #1b1b3a;border-radius:24px;
    background:white;box-shadow:8px 10px #1b1b3a33;font-size:38px}</style>`;
  for (const id of ['title', 'outro']) {
    await page.setContent(`${css}<h1>CHAOS FACTORY</h1><p>Your chat is the cast.</p>
      ${id === 'outro' ? '<div class="url">github.com/iamyanbo/chaos-factory</div>' : ''}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${id}.png`) });
  }
  const wipe = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff4f7b';
    ctx.fillRect(0, 0, 2400, 1080);
    for (const [index, color] of ['#3a8ee6', '#ffde3b', 'white'].entries()) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(1850 + index * 150, 0);
      ctx.lineTo(2250 + index * 150, 0);
      ctx.lineTo(1950 + index * 150, 1080);
      ctx.lineTo(1550 + index * 150, 1080);
      ctx.fill();
    }
    for (let index = 0; index < 9; index++) {
      ctx.beginPath();
      ctx.arc(index * 265 + 80, 530 + Math.sin(index) * 250, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff44';
      ctx.fill();
    }
    return canvas.toDataURL().split(',')[1];
  });
  await writeFile(resolve(directory, 'wipe.png'), Buffer.from(wipe, 'base64'));
  for (const [id, seconds] of [['title', 2.5], ['outro', 2.5]] as const) {
    const background = (await readFile(resolve(directory, `${id}.png`))).toString('base64');
    const download = page.waitForEvent('download');
    await page.evaluate(async ({ id, seconds, background }) => {
      await document.fonts.load('190px Lilita');
      await document.fonts.load('38px Fredoka');
      const image = new Image();
      image.src = `data:image/png;base64,${background}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      document.body.replaceChildren(canvas);
      const ctx = canvas.getContext('2d')!;
      function backdrop(time: number) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 1080);
        gradient.addColorStop(0, '#ffd56b');
        gradient.addColorStop(1, '#ff8f6b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = '#ffffff44';
        for (let x = -48; x < 1968; x += 48) for (let y = 0; y < 1100; y += 48) {
          ctx.beginPath();
          ctx.arc(x + time * 7, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      function lettering(text: string, x: number, y: number, size: number, angle: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.textAlign = 'center';
        ctx.font = `${size}px Lilita`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 18;
        ctx.strokeStyle = '#1b1b3a';
        ctx.strokeText(text, 7, 9);
        ctx.lineWidth = 12;
        ctx.strokeStyle = 'white';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = '#1b1b3a';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
      function draw(time: number) {
        backdrop(time);
        const enter = Math.exp(-time * 8);
        const bounce = Math.sin(time * 18) * Math.exp(-time * 5);
        if (id === 'title') {
          const colors = ['#ff4f7b', '#3a8ee6', '#2ecc71', '#8e5cff'];
          for (let index = 0; index < 16; index++) {
            const angle = index * Math.PI / 8 + .07 * time;
            const radius = 210 + 210 * (1 - enter);
            ctx.save();
            ctx.translate(960 + Math.cos(angle) * radius * 1.65, 500 + Math.sin(angle) * radius);
            ctx.rotate(angle + time * .2);
            ctx.fillStyle = colors[index % colors.length];
            ctx.strokeStyle = '#1b1b3a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(-14, -8, 45, 17, 8);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          lettering('CHAOS', 960 - enter * 500, 410 + bounce * 24, 190, -.055);
          lettering('FACTORY', 960 + enter * 500, 625 - bounce * 20, 190, -.055);
          ctx.globalAlpha = Math.min(1, Math.max(0, (time - .3) * 4));
          ctx.font = '38px Fredoka';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#1b1b3a';
          ctx.fillText('YOUR CHAT IS THE CAST', 960, 760);
          ctx.globalAlpha = 1;
        } else {
          const scale = 1 - enter * .035 + bounce * .006;
          ctx.save();
          ctx.translate(960, 540 + enter * 34);
          ctx.scale(scale, scale);
          ctx.drawImage(image, -960, -540);
          ctx.restore();
          ctx.fillStyle = '#ff4f7b';
          ctx.fillRect(80, 200, Math.min(1760, time * 1760 / seconds), 8);
        }
      }
      draw(0);
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      await new Promise<void>(done => {
        recorder.onstop = () => done();
        const start = performance.now();
        recorder.start(100);
        const frame = () => {
          const elapsed = (performance.now() - start) / 1000;
          draw(Math.min(seconds, elapsed));
          if (elapsed >= seconds + .08) recorder.stop();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
      anchor.download = `${id}-motion.webm`;
      anchor.click();
      stream.getTracks().forEach(track => track.stop());
    }, { id, seconds, background });
    const raw = resolve(directory, `${id}-motion-raw.webm`);
    await (await download).saveAs(raw);
    finalizeRecording(raw, resolve(directory, `${id}-motion.webm`));
  }
  await page.setContent(css);
  const cup = JSON.parse(await readFile('qa/submission-video/full-cup-sfx/capture.json', 'utf8')) as CupVideo;
  const liveFile = 'qa/submission-video/live-join/capture.json';
  const live = existsSync(liveFile) ? JSON.parse(await readFile(liveFile, 'utf8')) as JoinVideo : undefined;
  const crowd = JSON.parse(await readFile('qa/submission-video/join-crowd/capture.json', 'utf8')) as CrowdVideo;
  const plan = submissionVideoPlan(cup, live, crowd, process.argv.includes('--offline-preview'));
  const selected = process.argv.indexOf('--overlay');
  const overlay = selected < 0 ? undefined : Number(process.argv[selected + 1]);
  if (overlay !== undefined && (!Number.isInteger(overlay) || !plan[overlay])) throw new Error('Invalid overlay index');
  for (const [index, segment] of plan.entries()) {
    if ((overlay === undefined || overlay === index) && (segment.source === 'cup' || segment.source === 'crowd')) {
      await gameplayOverlay(page, segment, index, crowd);
    }
  }
} finally { await browser.close(); }
console.log(`Animated Toy cards: ${directory}`);
