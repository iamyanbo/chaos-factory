import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import definition, { BladeBrawl } from '../apps/show/src/games/blade-brawl';
import { bossHpPerChatter } from '../apps/show/src/games/blade-brawl/config';
import { advanceGame, SIMULATION_LIMIT_SECONDS } from '../apps/show/src/engine/game-clock';
import { initPhysics } from '../apps/show/src/engine/physics';
import { headlessContext } from '../apps/show/src/engine/headless';
import { makeSetup } from './simulation';

const args = process.argv.slice(2);
function option(key: string, fallback: string): string {
  const index = args.indexOf(`--${key}`);
  return index < 0 ? fallback : args[index + 1];
}
const runs = Number(option('runs', '200'));
const counts = option('counts', '8,16,32').split(',').map(Number);
const coefficient = Number(option('coefficient', String(bossHpPerChatter)));
const out = resolve(option('out', 'qa/blade-boss-balance'));
const thresholdProbe = args.includes('--thresholds');
if (!Number.isInteger(runs) || runs < 1 || counts.some(n => ![8, 16, 32].includes(n)) || coefficient <= 0) {
  throw new Error('Use positive --runs, --counts 8,16,32 and --coefficient');
}
await initPhysics();
async function hashSources() {
  const files = ['config', 'index', 'combat', 'weapons', 'fighters', 'state', 'motion', 'rage'];
  return Promise.all(files.map(async name => {
    const path = `apps/show/src/games/blade-brawl/${name}.ts`;
    return [path, createHash('sha256').update(await readFile(path)).digest('hex')];
  }));
}
const source = await hashSources();
const results = [];
for (const chat of counts) {
  const rows = [];
  for (let seed = 1; seed <= runs; seed++) {
    const setup = makeSetup({ game: definition.id, seed, participants: chat, mode: 'cvs' });
    setup.format = 'boss';
    const ctx = headlessContext(definition, setup, () => {});
    const game = new BladeBrawl(ctx);
    const boss = game.marbles[0];
    // The only tuning parameter allowed by doc 21. No physics/loadout overrides.
    if (args.includes('--coefficient')) boss.hp = boss.maxHp = Math.round(coefficient * chat);
    if (thresholdProbe) boss.hp = boss.maxHp = 1e9;
    let outcome = 'void';
    let escapes = 0;
    try {
      game.start();
      for (let tick = 0; tick < SIMULATION_LIMIT_SECONDS * 60; tick++) {
        advanceGame(game, 1 / 60, (tick + 1) / 60);
        if (tick % 60 === 0) {
          for (const fighter of game.marbles) {
            if (fighter.alive && Math.hypot(fighter.x - 960, fighter.y - 540) + fighter.radius > game.radius + 2) escapes++;
          }
        }
        const status = game.status();
        if (typeof status === 'object' && 'done' in status) {
          outcome = status.done.winner.kind;
          break;
        }
      }
      rows.push({ seed, outcome, duration: game.time, bossHp: boss.hp, escapes,
        requiredHpPerChatter: thresholdProbe ? (1e9 - boss.hp) / chat : undefined });
    } finally {
      game.destroy();
      ctx.physics.destroy();
    }
    if (seed % 25 === 0) console.error(`Blade ${chat} chat: ${seed}/${runs}`);
  }
  const wins = rows.filter(row => row.outcome === 'streamer').length;
  const voids = rows.filter(row => !['streamer', 'chat'].includes(row.outcome)).length;
  const escapes = rows.reduce((sum, row) => sum + row.escapes, 0);
  const sorted = rows.map(row => row.duration).sort((a, b) => a - b);
  const result = { chat, wins, bossShare: wins / runs, voids, escapes,
    median: sorted[Math.floor(sorted.length / 2)],
    pass: wins / runs >= .45 && wins / runs <= .55 && !voids && !escapes, rows };
  results.push(result);
  console.log(JSON.stringify({ ...result, rows: undefined }));
  if (thresholdProbe) {
    const thresholds = rows.map(row => row.requiredHpPerChatter!).sort((a, b) => a - b);
    console.log(JSON.stringify({ chat, thresholdProbe: true,
      q45: thresholds[Math.floor(runs * .45)], median: thresholds[Math.floor(runs * .5)],
      q55: thresholds[Math.floor(runs * .55)] }));
  }
}
const unchanged = JSON.stringify(source) === JSON.stringify(await hashSources());
const pass = results.every(row => row.pass) && !args.includes('--coefficient') && !thresholdProbe
  && runs >= 200 && new Set(counts).size === 3 && unchanged;
const table = [
  '| Chat fighters | Boss HP | Boss wins | Share | Target | Voids | Escapes | Median s | Result |',
  '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |',
  ...results.map(row => `| ${row.chat} | ${Math.round(coefficient * row.chat)} | ${row.wins}/${runs} | ${(row.bossShare * 100).toFixed(1)}% | 45-55% | ${row.voids} | ${row.escapes} | ${row.median.toFixed(2)} | ${row.pass ? 'PASS' : 'FAIL'} |`)
];
await mkdir(dirname(out), { recursive: true });
await writeFile(`${out}.json`, JSON.stringify({ generatedAt: new Date().toISOString(),
  bossHpPerChatter: coefficient, configuredCoefficient: bossHpPerChatter, thresholdProbe, runs, source, unchanged, pass, results }, null, 2));
await writeFile(`${out}.md`, ['# Blade Brawl Boss HP balance', '',
  `Overall: **${pass ? 'PASS' : 'FAIL / TUNING'}**. Raw consecutive seeds 1-${runs}, no best-take selection. Boss HP = round(${coefficient} * chat).`,
  ...table, '', 'Only bossHpPerChatter is tuned. Overrides are probes, not final acceptance. Source hashes and every outcome are retained in JSON.'
].join('\n'));
console.log(table.join('\n'));
if (!pass) process.exitCode = 1;
