import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { AUDIT_SECONDS } from './config';
import definition, { MarbleRace } from './index';

function option(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : Number(process.argv[index + 1]);
}

const runs = option('runs', 32);
const count = option('count', 24);
const firstSeed = option('seed', 1);
const faction = process.argv.includes('--faction');
if (!Number.isInteger(runs) || runs < 1 || !Number.isInteger(count)
  || count < 1 || count > 48) throw new Error('Use --runs <integer> --count <1..48>');

await initPhysics();
const rows: { seed: number; duration: number; physicallyFinished: number;
  void: boolean; bodies: number;
  modules: { kind: string; y: number; mirrored: boolean }[];
  stranded?: { x: number; y: number; speed: number; checkpoints: number[] }[] }[] = [];
for (let seed = firstSeed; seed < firstSeed + runs; seed++) {
  const teams = ['red', 'blue', 'mint', 'gold'] as const;
  const setup: RoundSetup = {
    gameId: definition.id, seed, mode: faction ? 'faction' : 'cvs',
    format: faction ? 'faction' : 'ffa', difficulty: 1, modifiers: [],
    teams: [...teams], streamerName: 'Host',
    participants: Array.from({ length: count }, (_, index) => ({
      userId: `p${index}`, login: `p${index}`, displayName: `Runner ${index + 1}`,
      color: '#ffffff', teamId: faction ? teams[index % teams.length] : undefined,
    })),
  };
  const ctx = headlessContext(definition, setup, () => {});
  const game = new MarbleRace(ctx);
  game.start();
  let bodies = ctx.physics.entities.size;
  try {
    for (let tick = 0; tick <= AUDIT_SECONDS * 60 && game.status() === 'playing'; tick++) {
      game.step(1 / 60);
      bodies = Math.max(bodies, ctx.physics.entities.size);
    }
    const status = game.status();
    const result = typeof status === 'object' && 'done' in status ? status.done : undefined;
    rows.push({ seed, duration: game.time, bodies, modules: game.course.modules,
      physicallyFinished: game.marbles.filter(marble => marble.finished).length,
      void: result?.winner.kind === 'void',
      stranded: result?.winner.kind === 'void' ? game.marbles.map(marble => ({
        x: marble.x, y: marble.y, speed: Math.hypot(marble.body.linvel().x, marble.body.linvel().y),
        checkpoints: marble.checkpointTimes,
      })) : undefined });
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
}
const times = rows.map(row => row.duration).sort((a, b) => a - b);
const summary = { runs, firstSeed, count, faction,
  duration: { min: times[0], median: times[Math.floor(runs / 2)], max: times[runs - 1] },
  under75: times.filter(time => time < 75).length,
  in90to120: rows.filter(row => !row.void
    && row.duration >= 90 - 1e-6 && row.duration <= 120 + 1e-6).length,
  voids: rows.filter(row => row.void).length,
  maxBodies: Math.max(...rows.map(row => row.bodies)),
};
const directory = resolve('qa/frames/marble-race');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, `pacing-${count}-${faction ? 'faction' : 'ffa'}-${firstSeed}-${runs}.json`),
  JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
