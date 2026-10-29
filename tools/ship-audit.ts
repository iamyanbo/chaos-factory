import { mkdir, writeFile } from 'node:fs/promises';
import { games } from '../apps/show/src/games/registry';
import { headlessContext } from '../apps/show/src/engine/headless';
import { initPhysics } from '../apps/show/src/engine/physics';
import { advanceGame, SIMULATION_LIMIT_SECONDS } from '../apps/show/src/engine/game-clock';
import { makeSetup } from './simulation';
import type { RoundResult } from '@chaos/shared';

interface AuditRow {
  game: string; seed: number; duration: number; done: boolean;
  winner?: RoundResult['winner']; peakBodies: number; bodyCap: number;
  beats: number; quiet: number; eliminations: number; jackpot: number; sudden: boolean;
  moments: { time: number; text: string }[]; fever?: unknown; orange?: unknown;
  landings?: number; paidLandings?: number;
  drops?: { born: number; banked: number; lost: number; expired: number }[];
}

const args = process.argv.slice(2);
function option(key: string, fallback: string): string {
  const index = args.indexOf(`--${key}`);
  return index < 0 ? fallback : args[index + 1];
}
const runs = Number(option('runs', '8'));
const out = option('out', 'qa/ship-audit');
const ids = option('games', games.map(game => game.id).join(',')).split(',');
if (!Number.isInteger(runs) || runs < 1 || runs > 200) throw new Error('Use --runs 1..200');
await initPhysics();
const rows: AuditRow[] = [];
for (const definition of games.filter(game => ids.includes(game.id))) {
  for (let seed = 1; seed <= runs; seed++) {
    let lastBeat = 0;
    let quiet = 0;
    let beats = 0;
    let eliminations = 0;
    let jackpot = 0;
    let sudden = false;
    const moments: { time: number; text: string }[] = [];
    const format = definition.formats?.[0];
    const setup = makeSetup({ game: definition.id, seed, participants: definition.defaultBots,
      mode: format === 'faction' ? 'faction' : 'cvs', format });
    const context = headlessContext(definition, setup, event => {
      if (event.t === 'activity' && event.kind !== 'birth') {
        quiet = Math.max(quiet, event.time - lastBeat);
        lastBeat = event.time;
        beats++;
      }
      if (event.t === 'elim') eliminations++;
      if (event.t === 'hype' && event.kind === 'jackpot') jackpot++;
      if (event.t === 'moment') {
        moments.push({ time: elapsed, text: event.text });
        sudden ||= event.text.includes('SUDDEN DEATH');
      }
    });
    let elapsed = 0;
    const game = definition.create(context);
    let peakBodies = context.physics.entities.size;
    try {
      game.start();
      for (let tick = 1; tick <= SIMULATION_LIMIT_SECONDS * 60 && game.status() === 'playing'; tick++) {
        elapsed = tick / 60;
        advanceGame(game, 1 / 60, elapsed);
        peakBodies = Math.max(peakBodies, context.physics.entities.size);
      }
      const status = game.status();
      const done = typeof status === 'object' && 'done' in status;
      const inspection = game.inspect?.();
      const details = inspection?.details ?? {};
      quiet = Math.max(quiet, elapsed - lastBeat);
      rows.push({ game: definition.id, seed, duration: elapsed, done,
        winner: done ? status.done.winner : undefined, peakBodies, bodyCap: definition.maxBodies,
        beats, quiet, eliminations, jackpot, sudden, moments,
        fever: details.fever, orange: details.orange,
        landings: Array.isArray(details.landings) ? details.landings.length : undefined,
        paidLandings: Array.isArray(details.landings)
          ? details.landings.filter(landing => landing.total > 0).length : undefined,
        drops: Array.isArray(details.drops) ? details.drops.map(drop => ({ born: drop.born,
          banked: drop.banked, lost: drop.lost, expired: drop.expired })) : undefined });
    } finally {
      game.destroy();
      context.physics.destroy();
    }
  }
  const sample = rows.filter(row => row.game === definition.id);
  console.log(JSON.stringify({ game: definition.id, rounds: sample.length,
    duration: sample.map(row => row.duration), sudden: sample.filter(row => row.sudden).length }));
}
const summaries = ids.map(id => {
  const sample = rows.filter(row => row.game === id);
  const times = sample.map(row => row.duration).sort((a, b) => a - b);
  return { id, rounds: sample.length, min: times[0], median: times[Math.floor(times.length / 2)],
    max: times.at(-1), sudden: sample.filter(row => row.sudden).length,
    voids: sample.filter(row => row.winner?.kind === 'void').length,
    failures: sample.filter(row => !row.done || row.peakBodies > row.bodyCap).length,
    quiet: Math.max(...sample.map(row => row.quiet)) };
});
await mkdir('qa', { recursive: true });
await writeFile(`${out}.json`, JSON.stringify({ at: new Date().toISOString(), rows, summaries }, null, 2));
await writeFile(`${out}.md`, ['# Offline release audit', '',
  `${runs} raw consecutive seeds per game, default fields, real 60 Hz simulation. No best-take selection.`, '',
  '| Game | Rounds | Min / median / max seconds | Sudden death | Voids | Failed completion/body budget |',
  '|---|---:|---|---:|---:|---:|',
  ...summaries.map(row => `| ${row.id} | ${row.rounds} | ${row.min?.toFixed(1)} / ${row.median?.toFixed(1)} / ${row.max?.toFixed(1)} | ${row.sudden} | ${row.voids} | ${row.failures} |`),
  '', 'Activity counts and quiet intervals are diagnostic observations, not entertainment scores. Human frame review remains required.'
].join('\n'));
if (summaries.some(row => row.failures)) process.exitCode = 1;
