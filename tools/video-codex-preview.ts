import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command, probe } from './drama/capture-media';

// Editorial excerpts of genuine inputs/source, not a replica of the Codex app.
const OUTPUT = resolve('qa/submission-video/codex-preview');
const FPS = 30;
const SECONDS = 6;
const CREDIT = 'Built with Codex · GPT-6.1 Sol';
const FILES = ['apps/show/src/kit/theme/toy.ts', 'apps/show/src/kit/theme/balls.ts'];
const request = JSON.parse(await readFile(resolve(OUTPUT, 'request-source.json'), 'utf8')) as {
  at: string; text: string; sha256: string;
};
if (createHash('sha256').update(request.text).digest('hex') !== request.sha256) {
  throw new Error('Original request hash mismatch');
}
const excerpts = [
  'Read AGENTS.md, docs/24-toy-theme.md (wins all visual conflicts) and docs/23-ship.md.',
  '1. Build kit/theme/toy.ts and the shared components from doc 24',
  '2. Build the ball renderer with the three styles a/b/c',
];
for (const text of excerpts) {
  if (!request.text.includes(text)) throw new Error('Request excerpt is not verbatim');
}
const sources = await Promise.all(FILES.map(async file => ({
  file, content: await readFile(file, 'utf8'),
})));
const fontData = await Promise.all(['Fredoka.ttf', 'LilitaOne-Regular.ttf'].map(async file =>
  (await readFile(resolve('apps/show/public/fonts', file))).toString('base64')));
const frames = resolve(OUTPUT, 'frames');
await mkdir(frames, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const highlight = (text: string) => {
    const pattern = /('[^'\n]*'|`[^`\n]*`|\/\/[^\n]*|\b(?:export|const|class|interface|private|readonly|return|import|from|if|for|new|let|as|true|false|undefined)\b|\b(?:0x[0-9a-f]+|\d+(?:\.\d+)?)\b)/gi;
    return text.split(pattern).map(part => {
      const kind = part.startsWith('//') ? 'comment' : /^[\x27`]/.test(part) ? 'string'
        : /^(?:0x|\d)/.test(part) ? 'number' : /^(?:export|const|class|interface|private|readonly|return|import|from|if|for|new|let|as|true|false|undefined)$/.test(part) ? 'keyword' : '';
      return kind ? `<span class="${kind}">${escape(part)}</span>` : escape(part);
    }).join('');
  };
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    @font-face{font-family:Fredoka;src:url('data:font/ttf;base64,${fontData[0]}');font-weight:100 900}
    @font-face{font-family:Lilita;src:url('data:font/ttf;base64,${fontData[1]}')}
    *{box-sizing:border-box}body{margin:0;color:#1b1b3a;width:1920px;height:1080px;overflow:hidden;
      background:radial-gradient(circle at 5px 5px,#fff5 4px,transparent 5px) 0 0/48px 48px,
      linear-gradient(#ffd56b,#ff8f6b);font-family:Fredoka}
    .label{position:absolute;left:112px;top:66px;font:32px Fredoka;font-weight:600;letter-spacing:2px}
    .panel{position:absolute;inset:140px 110px 176px;border:5px solid #1b1b3a;border-radius:28px;
      box-shadow:10px 12px #1b1b3a33;background:#fff;overflow:hidden}
    .request{padding:66px 76px;display:flex;flex-direction:column;justify-content:center}.request .lead{font-size:53px;line-height:1.28;margin:0 0 40px}
    .request .step{font-size:41px;line-height:1.28;margin:22px 0;padding-left:24px;border-left:9px solid #3a8ee6}
    .filebar{height:76px;border-bottom:3px solid #dce3ed;display:flex;align-items:center;padding:0 32px;
      background:#f0f5fc;font:30px Fredoka}.filebar b{font-weight:600}.filebar span{margin-left:auto;font-size:23px;color:#50506b}
    .viewport{height:674px;overflow:hidden;background:#fffdf7;position:relative}
    .code{font:29px/43px Consolas,monospace;padding:22px 24px 80px 0;margin:0;will-change:transform}
    .line{display:flex;white-space:pre;min-height:43px}.ln{flex:0 0 84px;text-align:right;padding-right:26px;color:#8991a2;user-select:none}
    .text{flex:1}.comment{color:#7b8190}.keyword{color:#7b42b4}.string{color:#21664b}.number{color:#b65a24}
    .credit{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);padding:16px 36px;
      border:4px solid #1b1b3a;background:white;border-radius:22px;font:34px Fredoka;white-space:nowrap;
      box-shadow:7px 8px #1b1b3a33}.progress{position:absolute;left:0;bottom:0;height:7px;background:#ff4f7b}
  </style><div class="label" id="label">ORIGINAL BUILD REQUEST</div>
  <section class="panel request" id="request"><p class="lead">${escape(excerpts[0])}</p>
    <p class="step">${escape(excerpts[1])}…</p><p class="step">${escape(excerpts[2])}…</p></section>
  ${sources.map((source, index) => `<section class="panel source" id="source${index}" style="display:none">
    <div class="filebar"><b>${escape(source.file)}</b><span>TypeScript</span></div>
    <div class="viewport"><div class="code" id="code${index}">${source.content.split(/\r?\n/).map((line, number) =>
      `<div class="line"><span class="ln">${number + 1}</span><span class="text">${highlight(line)}</span></div>`).join('')}</div></div>
    <div class="progress" id="progress${index}"></div></section>`).join('')}
  <div class="credit">${CREDIT}</div>`);
  await page.evaluate(async () => { await document.fonts.ready; });
  for (let frame = 0; frame < FPS * SECONDS; frame++) {
    const time = frame / FPS;
    await page.evaluate(({ time }) => {
      const codeAt = 3;
      const requestVisible = time < codeAt;
      document.getElementById('request')!.style.display = requestVisible ? 'flex' : 'none';
      document.getElementById('label')!.textContent = requestVisible ? 'ORIGINAL BUILD REQUEST' : 'IMPLEMENTATION';
      const index = time < 4.5 ? 0 : 1;
      for (let file = 0; file < 2; file++) {
        document.getElementById(`source${file}`)!.style.display = !requestVisible && index === file ? 'block' : 'none';
      }
      if (requestVisible) return;
      const age = time - (index === 0 ? 3 : 4.5);
      const progress = Math.max(0, Math.min(1, (age - .17) / 1.17));
      const ease = progress * progress * (3 - 2 * progress);
      const code = document.getElementById(`code${index}`)!;
      const total = Math.min(code.scrollHeight - 660, index === 0 ? 48 * 43 : 76 * 43);
      code.style.transform = `translateY(${-total * ease}px)`;
      document.getElementById(`progress${index}`)!.style.width = `${progress * 100}%`;
    }, { time });
    await page.screenshot({ path: resolve(frames, `${String(frame).padStart(4, '0')}.png`) });
  }
} finally {
  await browser.close();
}
const insert = resolve(OUTPUT, 'codex-insert-preview.mp4');
command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS),
  '-i', resolve(frames, '%04d.png'), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
  '-t', String(SECONDS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', insert]);
const manifest = {
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
  request: { at: request.at, sha256: request.sha256, excerpts },
  files: sources.map(source => ({ file: source.file,
    sha256: createHash('sha256').update(source.content).digest('hex') })),
  credit: CREDIT, modelCreditSource: 'User supplied model attribution', seconds: SECONDS,
  presentation: 'Editorial layout of verbatim build-thread excerpts and real source; no native app UI is represented.',
  media: probe(insert),
};
await writeFile(resolve(OUTPUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Six-second preview: ${insert}`);
