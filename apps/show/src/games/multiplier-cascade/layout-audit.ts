import { mkdir, writeFile } from 'node:fs/promises';
import { initPhysics } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import type { RoundSetup, TeamId } from '@chaos/shared';
import definition, { MultiplierCascade } from './index';

await initPhysics();
const rows: unknown[] = [];
for (const [teams, seed] of [[2, 4], [4, 4], [6, 4], [6, 46]]) {
  const setup: RoundSetup = {
    gameId: definition.id, seed, mode: 'faction', format: 'faction', difficulty: 1,
    modifiers: [], participants: [], streamerName: 'Host',
    teams: (['red', 'blue', 'mint', 'gold', 'violet', 'orange'] as TeamId[]).slice(0, teams),
  };
  const ctx = headlessContext(definition, setup, () => {});
  const game = new MultiplierCascade(ctx);
  let peakBodies = ctx.physics.entities.size;
  try {
    game.start();
    for (let tick = 0; tick < 220 * 60 && !game.result; tick++) {
      game.step(1 / 60);
      peakBodies = Math.max(peakBodies, ctx.physics.entities.size);
    }
    rows.push({ teams, seed, time: game.time, peakBodies, drops: game.drops,
      stalls: game.stalls, contacts: game.contacts, supply: Object.fromEntries(game.scores),
      relay: game.relay?.inspect(), result: game.result?.winner });
  } finally {
    game.destroy();
    ctx.physics.destroy();
  }
}
await mkdir('qa/frames/multiplier-cascade', { recursive: true });
await writeFile('qa/frames/multiplier-cascade/layout-audit.json', JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
