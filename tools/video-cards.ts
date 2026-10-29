import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { submissionVideoPlan, type CupVideo, type JoinVideo } from './video-plan';

const directory = resolve('qa/submission-video/edit/cards');
await mkdir(directory, { recursive: true });
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const agents = await readFile('AGENTS.md', 'utf8');
const log = await readFile('CODEX_LOG.md', 'utf8');
const rules = agents.split('\n').filter(line => /^(1\. Tokens|3\. Deterministic|4\. Games are plugins)/.test(line)).join('\n\n');
const reviewStart = log.indexOf('## 2026-10-28 - Immediate splits');
const review = log.slice(reviewStart, log.indexOf('\n\n', reviewStart + 6));
const cards = [
  { id: 'brief', eyebrow: 'BUILT WITH CODEX', title: 'I SET THE RULES.',
    heading: 'Codex built the show.',
    copy: 'Game plugins. Twitch bridge. Cup flow.\nI reviewed the frames and game feel.',
    file: 'AGENTS.md / actual build instructions', code: rules },
  { id: 'review', eyebrow: 'BUILT WITH CODEX', title: 'I WATCHED. THEN REVISED.',
    heading: 'Feedback changed the code.',
    copy: 'Delayed clones fixed.\nMisleading popups removed.\nWeak prototypes cut.',
    file: 'CODEX_LOG.md / actual revision record',
    code: review.split('\n').filter(line => line.startsWith('- ')).slice(0, 2).join('\n\n') }
];
const css = `
@font-face{font-family:Lilita;src:url('/fonts/LilitaOne-Regular.ttf')}
@font-face{font-family:Fredoka;src:url('/fonts/Fredoka.ttf')}
*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;color:#1b1b3a;
background:radial-gradient(circle at 5px 5px,#ffffff55 4px,transparent 5px) 0 0/48px 48px,
linear-gradient(#ffd56b,#ff8f6b);font-family:Fredoka}
.eyebrow{position:absolute;top:66px;left:80px;font-size:26px;letter-spacing:3px;font-weight:600}
h1{position:absolute;top:95px;left:75px;margin:0;font:76px Lilita;max-width:1770px}
.panel{position:absolute;top:265px;height:690px;background:white;border:5px solid #1b1b3a;
border-radius:30px;box-shadow:10px 12px 0 #1b1b3a33;padding:42px}
.left{left:80px;width:620px}.right{left:740px;width:1100px;padding:34px 38px;overflow:hidden}
h2{font:50px Lilita;margin:0 0 32px}p{font-size:36px;line-height:1.6;white-space:pre-line;margin:0}
.file{font-size:23px;font-weight:600;padding-bottom:24px;border-bottom:3px solid #e9f3ff}
pre{font:28px/1.55 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:32px 0}
.foot{position:absolute;bottom:45px;left:80px;font-size:23px;letter-spacing:1px}
.end{left:240px;top:190px;width:1440px;height:700px;text-align:center;padding:72px}
.end h1{position:static;font-size:122px}.end p{font-size:38px;margin-top:22px}
.url{font:39px Fredoka;background:#e9f3ff;border-radius:20px;padding:20px;margin:34px 0}
`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://127.0.0.1:4182/fonts/Fredoka-OFL.txt');
  await page.setContent(`<style>${css}.title{text-align:center;padding-top:280px} .title h1{position:static;font-size:142px} .title p{margin:26px auto 0;font-size:38px}</style>
    <main class="title"><h1>CHAOS FACTORY</h1><p>A physics game show for Twitch.</p></main>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(directory, 'title.png') });
  for (const card of cards) {
    await page.setContent(`<style>${css}</style><div class="eyebrow">${card.eyebrow}</div>
      <h1>${card.title}</h1><section class="panel left"><h2>${card.heading}</h2><p>${card.copy}</p></section>
      <section class="panel right"><div class="file">${card.file}</div><pre>${escape(card.code)}</pre></section>
      <div class="foot">ACTUAL PROJECT FILES / github.com/iamyanbo/chaos-factory</div>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${card.id}.png`) });
  }
  for (const pending of [false, true]) {
    await page.setContent(`<style>${css}</style><section class="panel end">
      <h1>${pending ? 'OFFLINE PREVIEW' : 'CHAOS FACTORY'}</h1>
      <p>${pending ? 'Real Twitch join footage still needs to be added.' : 'Your chat is the cast.'}</p>
      <div class="url">github.com/iamyanbo/chaos-factory</div>
      <p>${pending ? 'Simulated viewers in this cut. No native payout proof.' : 'Try it offline. No audience needed.'}</p>
      <p style="font-size:24px">Real chat filmed offline. Native wagers require Affiliate/Partner.</p></section>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${pending ? 'pending' : 'outro'}.png`) });
  }
  const cupFile = 'qa/submission-video/full-cup/capture.json';
  if (existsSync(cupFile)) {
    const cup = JSON.parse(await readFile(cupFile, 'utf8')) as CupVideo;
    const liveFile = 'qa/submission-video/live-join/capture.json';
    const live = existsSync(liveFile) ? JSON.parse(await readFile(liveFile, 'utf8')) as JoinVideo : undefined;
    const plan = submissionVideoPlan(cup, live, true);
    for (const [index, segment] of plan.entries()) {
      if (!['mock', 'real-chat'].includes(segment.evidence)) continue;
      const label = segment.evidence === 'real-chat'
        ? 'REAL TWITCH CHAT / CHANNEL OFFLINE' : 'SIMULATED AUDIENCE';
      await page.setContent(`<style>${css}
        body{background:transparent}.badge{position:absolute;right:32px;top:7px;background:#1b1b3a;
        color:white;border-radius:9px;padding:5px 12px;font:21px Fredoka}
        .caption{position:absolute;left:40px;bottom:40px;max-width:370px;background:white;
        border:4px solid #1b1b3a;border-radius:18px;padding:14px 18px;box-shadow:6px 7px 0 #1b1b3a33}
        .caption h2{font:32px/1.08 Lilita;white-space:pre-line;margin:0}
        </style><div class="badge">${label}</div>${segment.card
          ? `<div class="caption"><h2>${escape(segment.title)}</h2><p>${escape(segment.body)}</p></div>` : ''}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(directory, `overlay-${index}.png`), omitBackground: true });
    }
  }
} finally { await browser.close(); }
console.log(`Source walkthrough cards: ${directory}`);
