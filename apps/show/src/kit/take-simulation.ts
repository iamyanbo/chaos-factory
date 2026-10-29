import type { RoundSetup } from '@chaos/shared';
import { initPhysics } from '../engine/physics';
import { headlessContext } from '../engine/headless';
import type { GameDefinition } from '../games/contract';
import type { ScoredTake, TakeEvents } from './take-types';
import { advanceGame, SIMULATION_LIMIT_SECONDS } from '../engine/game-clock';
import { celebrateResult } from './hype';
import type { HypeEvent } from './hype';
import { reactionSummary, reactionTakeBonus } from './hype/take-score';

/** The worker and live game instantiate exactly the same plugin and fixed step. */
export async function simulateTake(def: GameDefinition, setup: RoundSetup): Promise<ScoredTake> {
  await initPhysics();
  let time = 0;
  let lastPass = 0;
  let quietMax = 0;
  let passes = 0;
  let pops = 0;
  let leadChanges = 0;
  let leader = -1;
  let candidate = -1;
  let candidateSince = 0;
  const tail: { time: number; closeness: number }[] = [];
  const reactions: Pick<HypeEvent, 'kind' | 'time'>[] = [];
  const context = headlessContext(def, structuredClone(setup), event => {
      if (event.t === 'hype' && (event.kind === 'jackpot' || event.kind === 'nearMiss')) {
        reactions.push({ kind: event.kind, time: event.time });
      }
      if (event.t === 'elim' && event.cause === 'red arc') pops++;
      if (event.t !== 'pass' && event.t !== 'activity') return;
      if (event.t === 'activity' && def.takeActivities && !def.takeActivities.includes(event.kind)) return;
      quietMax = Math.max(quietMax, event.time - lastPass);
      lastPass = event.time;
      passes++;
  });
  const game = def.create(context);
  let finished = false;
  try {
    game.start();
    for (let tick = 1; tick <= SIMULATION_LIMIT_SECONDS * 60; tick++) {
      time = tick / 60;
      context.hype.at(time);
      advanceGame(game, 1 / 60, time);
      const depths = game.takeState?.() ?? [];
      const contenders=depths.filter(value=>Number.isFinite(value)&&value>=0);
      const highest = Math.max(...contenders);
      const first = depths.indexOf(highest);
      const unique = highest>=0&&depths.lastIndexOf(highest) === first ? first : -1;
      if (unique !== candidate) {
        candidate = unique;
        candidateSince = time;
      }
      if (unique >= 0 && time - candidateSince >= 1 && unique !== leader) {
        if (leader >= 0) leadChanges++;
        leader = unique;
      }
      if (tick % 15 === 0) {
        const top = contenders.sort((a, b) => b - a).slice(0, 3);
        const spread = top.length ? top[0] - top[top.length - 1] : 6;
        tail.push({ time, closeness: Math.max(0, 1 - spread / 6) });
        while (tail[0]?.time < time - 10) tail.shift();
      }
      const status = game.status();
      if (typeof status === 'object' && 'done' in status) {
        finished = status.done.winner.kind !== 'void';
        celebrateResult(context, status.done);
        break;
      }
    }
    const events: TakeEvents = {
      duration: time, finished, leadChanges, passes, pops, entrants: setup.participants.length,
      ...reactionSummary(reactions, time),
      quietMax: Math.max(quietMax, time - lastPass),
      finalCloseness: tail.length ? tail.reduce((sum, item) => sum + item.closeness, 0) / tail.length : 0
    };
    const shortRound = Math.max(0, 75 - time) * 20;
    const overtime = Math.max(0, time - 120) * 10;
    return { seed: setup.seed, events, score: (def.scoreTake?.(events) ?? 0)
      + reactionTakeBonus(events) - shortRound - overtime };
  } finally {
    game.destroy();
    context.physics.destroy();
  }
}
