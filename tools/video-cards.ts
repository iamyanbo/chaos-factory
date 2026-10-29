import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { submissionVideoPlan, type CupVideo, type JoinVideo } from './video-plan';

const directory = resolve('qa/submission-video/edit/cards');
await mkdir(directory, { recursive: true });
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const agents = await readFile('AGENTS.md', 'utf8');
const registry = await readFile('apps/show/src/games/registry.ts', 'utf8');
const log = await readFile('CODEX_LOG.md', 'utf8');
const rules = agents.slice(agents.indexOf('These rules apply'), agents.indexOf('## Scope'));
const reviewStart = log.indexOf('## 2026-10-28 - Immediate splits');
const review = log.slice(reviewStart, log.indexOf('\n\n', reviewStart + 6));
const cards = [
  { id: 'brief', eyebrow: '01 / THE BRIEF', title: 'BUILT WITH CODEX',
    heading: 'The user set the rules.',
    copy: 'Automatic physics. One !join.\nVisible machines. No reflex controls.\nA Toy theme checked against real frames.',
    file: 'AGENTS.md / actual project instructions', code: rules.slice(0, 1050) },
  { id: 'code', eyebrow: '02 / THE BUILD', title: 'SHARED ENGINE. EIGHT PLUGINS.',
    heading: 'Codex implemented the show.',
    copy: 'TypeScript + PixiJS + Rapier.\nIsolated game plugins and a shared Cup layer.\nServer-only Twitch credentials.',
    file: 'apps/show/src/games/registry.ts / actual source', code: registry },
  { id: 'review', eyebrow: '03 / THE FEEDBACK LOOP', title: 'BUILD. WATCH. REVISE.',
    heading: 'Working code was only the start.',
    copy: 'Weak prototypes were cut.\nDelayed clones and misleading popups were fixed.\nSeeded replays and full-Cup tests checked the result.',
    file: 'CODEX_LOG.md / actual implementation record', code: review.slice(0, 1050) }
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
h2{font:50px Lilita;margin:0 0 32px}p{font-size:34px;line-height:1.6;white-space:pre-line;margin:0}
.file{font-size:23px;font-weight:600;padding-bottom:24px;border-bottom:3px solid #e9f3ff}
pre{font:23px/1.55 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:24px 0}
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
      <p>${pending ? 'Real Twitch join footage still needs to be added.' : 'One join. Five games. A whole stream competing.'}</p>
      <div class="url">github.com/iamyanbo/chaos-factory</div>
      <p>${pending ? 'Simulated viewers in this cut. No native payout proof.' : 'Try it offline: npm ci &nbsp; then &nbsp; npm run demo'}</p>
      <p style="font-size:26px">Native Predictions require an Affiliate or Partner channel.</p></section>`);
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
        ? 'REAL TWITCH CHAT / CHANNEL OFFLINE' : 'OFFLINE / SIMULATED VIEWERS';
      await page.setContent(`<style>${css}
        body{background:transparent}.badge{position:absolute;right:32px;top:7px;background:#1b1b3a;
        color:white;border-radius:9px;padding:5px 12px;font:21px Fredoka}
        .caption{position:absolute;left:40px;bottom:40px;width:368px;background:white;
        border:4px solid #1b1b3a;border-radius:24px;padding:18px;box-shadow:7px 8px 0 #1b1b3a33}
        .caption h2{font:43px/1.03 Lilita;white-space:pre-line;margin:0 0 16px}
        .caption p{font:24px/1.3 Fredoka;white-space:pre-line;margin:0}
        </style><div class="badge">${label}</div>${segment.card
          ? `<div class="caption"><h2>${escape(segment.title)}</h2><p>${escape(segment.body)}</p></div>` : ''}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(directory, `overlay-${index}.png`), omitBackground: true });
    }
  }
} finally { await browser.close(); }
console.log(`Source walkthrough cards: ${directory}`);
