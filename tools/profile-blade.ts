import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { resolve } from 'node:path';

interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: { name?: string; data?: Record<string, unknown> };
}

const after = process.argv.includes('--after');
const timingOnly = process.argv.includes('--timing-only');
const label = timingOnly ? 'normal-run' : after ? 'after' : 'baseline';
const directory = resolve('qa/frames/blade-brawl');
await mkdir(directory, { recursive: true });
const sourceFiles = ['config', 'combat', 'index', 'weapons', 'view', 'fighters'];
const hash = createHash('sha256');
for (const file of sourceFiles) {
  hash.update(await readFile(`apps/show/src/games/blade-brawl/${file}.ts`));
}
hash.update(await readFile('apps/show/src/kit/neon/balls.ts'));
const sourceHash = hash.digest('hex');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript('globalThis.__name = fn => fn;');
// Profiling must survive other game threads saving files through Vite HMR.
await page.routeWebSocket('**', socket => socket.close());
try {
  const base = process.env.CHAOS_TEST_URL ?? 'http://127.0.0.1:5173';
  await page.goto(`${base}/play?game=blade-brawl&seed=42&take=seed&bots=32&format=ffa&paused=1&mute=1`);
  await page.waitForFunction(() => window.__chaos?.phase === 'PLAY' && window.__chaos.paused);
  await page.waitForTimeout(1500);
  const session = await page.context().newCDPSession(page);
  const trace: TraceEvent[] = [];
  session.on('Tracing.dataCollected', event => trace.push(...event.value as unknown as TraceEvent[]));
  const complete = new Promise<void>(done => session.once('Tracing.tracingComplete', () => done()));
  await session.send('Tracing.start', {
    categories: 'toplevel,devtools.timeline,v8,blink.user_timing'
      + (timingOnly ? '' : ',disabled-by-default-v8.cpu_profiler'),
    options: 'sampling-frequency=1000',
    transferMode: 'ReportEvents'
  });
  const runtime = await page.evaluate(async () => {
    const intervals: number[] = [];
    let previous = 0;
    let running = true;
    const frame = (now: number) => {
      if (previous) intervals.push(now - previous);
      previous = now;
      if (running) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.__chaos.command('resume');
    const start = performance.now();
    await new Promise(done => setTimeout(done, 20000));
    running = false;
    return { intervals, wallSeconds: (performance.now() - start) / 1000,
      gameSeconds: window.__chaos.inspect().time,
      actors: window.__chaos.participants.length, inspect: window.__chaos.inspect() };
  });
  await session.send('Tracing.end');
  await complete;
  const main = trace.find(event => event.name === 'thread_name' && event.args?.name === 'CrRendererMain');
  const tasks = trace.filter(event => event.pid === main?.pid && event.tid === main?.tid
    && event.ph === 'X' && event.name === 'ThreadControllerImpl::RunTask');
  const callbacks = trace.filter(event => event.pid === main?.pid && event.tid === main?.tid
    && event.ph === 'X' && event.name === 'FireAnimationFrame');
  const origin = callbacks[0]?.ts ?? tasks[0]?.ts ?? 0;
  const longest = (events: TraceEvent[]) => [...events].sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0)).slice(0, 10)
    .map(event => ({ ms: (event.dur ?? 0) / 1000, atSeconds: (event.ts - origin) / 1e6 }));
  const sorted = [...runtime.intervals].sort((a, b) => a - b);
  const summary = {
    label, recorded: new Date().toISOString(), sourceHash, cpu: cpus()[0]?.model,
    chrome: browser.version(), viewport: '1920x1080', seed: 42, format: 'ffa', fighters: 32,
    ...runtime, longestMainTasks: longest(tasks), longestAnimationCallbacks: longest(callbacks),
    frameInterval: { max: sorted.at(-1), p99: sorted[Math.floor(sorted.length * .99)],
      median: sorted[Math.floor(sorted.length * .5)], over20ms: sorted.filter(ms => ms > 20).length },
    traceFile: `${label}-performance.trace.json`
  };
  await writeFile(resolve(directory, `${label}-performance.trace.json`), JSON.stringify({ traceEvents: trace }));
  await writeFile(resolve(directory, `${label}-performance.json`), JSON.stringify(summary, null, 2));
  const lines = [
    `## ${timingOnly ? 'Normal run, timeline only (no CPU sampler)' : after ? 'After fixes' : 'Baseline before fixes'}`,
    `Recorded ${summary.recorded}; Chrome ${summary.chrome}; ${summary.cpu}; 1920x1080.`,
    `Chrome DevTools Protocol Performance trace (devtools.timeline${timingOnly ? ', no CPU sampling' : ' + sampled V8 CPU'}), no video encoder, 32 FFA fighters, seed 42, 20 s at normal speed.`,
    `Source SHA-256: ${sourceHash}. Raw trace: ${summary.traceFile} (open in Chrome Performance).`,
    `Wall ${runtime.wallSeconds.toFixed(2)} s; simulation ${runtime.gameSeconds.toFixed(2)} s.`,
    `Frame intervals: median ${summary.frameInterval.median?.toFixed(2)} ms; p99 ${summary.frameInterval.p99?.toFixed(2)} ms; maximum ${summary.frameInterval.max?.toFixed(2)} ms; ${summary.frameInterval.over20ms} over 20 ms.`,
    '', '| Longest animation callback (ms) | Time (s) |', '| ---: | ---: |',
    ...summary.longestAnimationCallbacks.map(row => `| ${row.ms.toFixed(3)} | ${row.atSeconds.toFixed(2)} |`),
    '', '| Longest main-thread task (ms) | Time (s) |', '| ---: | ---: |',
    ...summary.longestMainTasks.map(row => `| ${row.ms.toFixed(3)} | ${row.atSeconds.toFixed(2)} |`),
    '', 'Frame intervals include scheduling/GPU/OS delays; callback duration is CPU work inside the game frame. Both are reported, without removing outliers.', ''
  ];
  const report = resolve(directory, 'perf.md');
  const existing = after || timingOnly ? await readFile(report, 'utf8') : '# Blade Brawl performance\n\n';
  await writeFile(report, existing + lines.join('\n'));
  console.log(JSON.stringify({ label, gameSeconds: runtime.gameSeconds,
    frameInterval: summary.frameInterval, longestAnimationCallbacks: summary.longestAnimationCallbacks.slice(0, 3), report }, null, 2));
} finally {
  await browser.close();
}
