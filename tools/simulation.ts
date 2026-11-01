import { TEAMS, TEAM_IDS, type Mode, type RoundResult, type RoundSetup, type LoggedInput } from '@chaos/shared';
import { initPhysics } from '../apps/show/src/engine/physics';
import { createContext } from '../apps/show/src/engine/context';
import { registry } from '../apps/show/src/games/registry';
import { isAutomatic } from '../apps/show/src/games/contract';
import type { BaseGame } from '../apps/show/src/kit/base-game';
import { advanceGame, SIMULATION_LIMIT_SECONDS } from '../apps/show/src/engine/game-clock';

export interface SimOptions {
  format?: 'boss' | 'ffa' | 'faction';
  game: string;
  seed: number;
  mode?: Mode;
  difficulty?: number;
  participants?: number;
  teams?: number;
  modifiers?: string[];
  replay?: LoggedInput[];
  setup?: RoundSetup;
  observe?: (game: BaseGame) => void;
}
export interface SimResult {
  result: RoundResult;
  duration: number;
  timeout: boolean;
  bodies: number;
  positions: number[];
}

export function makeSetup(options: SimOptions): RoundSetup {
  const definition = registry.get(options.game);
  if (!definition) throw new Error(`Unknown game: ${options.game}`);
  const teams = TEAM_IDS.slice(0, options.teams ?? 4);
  const mode = options.mode ?? definition.modes[0];
  const count = definition.spectator ? 0 : options.participants
    ?? Math.min(definition.defaultBots ?? 60, definition.maxParticipants);
  return {
    format: options.format, gameId: options.game, seed: options.seed, mode,
    difficulty: options.difficulty ?? .5, modifiers: options.modifiers ?? [],
    streamerName: 'FACTORY BOSS', teams,
    participants: Array.from({ length: count }, (_, index) => {
      const teamId = teams[index % teams.length];
      return {
        userId: `bot${index}`, login: `bot${index}`, displayName: `BOT ${index}`,
        color: TEAMS[teamId].color, ...(mode === 'faction' ? { teamId } : {}),
      };
    }),
  };
}

/** Current games run automatically. Only explicitly supplied replay inputs are delivered. */
export async function simulate(options: SimOptions): Promise<SimResult> {
  await initPhysics();
  const definition = registry.get(options.game);
  if (!definition) throw new Error(`Unknown game: ${options.game}`);
  const setup = structuredClone(options.setup ?? makeSetup(options));
  if (definition.spectator) setup.participants = [];
  const initialSetup = structuredClone(setup);
  const ctx = createContext(definition, setup);
  const instance = definition.create(ctx) as BaseGame;
  const inputs: LoggedInput[] = [];
  let tick = 0;
  let replayIndex = 0;
  let maxBodies = ctx.physics.entities.size;
  const replay = (item: LoggedInput) => {
    if (item.kind === 'chat') instance.onChat(item.input);
    else if (item.kind === 'join') instance.onJoin(item.input);
    else instance.onStreamer(item.input);
  };
  try {
    while (options.replay?.[replayIndex]?.tick === 0) replay(options.replay[replayIndex++]);
    instance.start();
    while (tick < SIMULATION_LIMIT_SECONDS * 60) {
      tick++;
      while (options.replay?.[replayIndex]?.tick === tick) replay(options.replay[replayIndex++]);
      advanceGame(instance, 1 / 60, tick / 60);
      options.observe?.(instance);
      maxBodies = Math.max(maxBodies, ctx.physics.entities.size);
      const state = instance.status();
      if (isAutomatic(definition) && tick % 60 === 0) {
        ctx.physics.world.forEachRigidBody(body => {
          const position = body.translation();
          const velocity = body.linvel();
          if (!Number.isFinite(position.x + position.y + velocity.x + velocity.y)) {
            throw new Error('Non-finite assembly or projectile');
          }
        });
      }
      if (typeof state === 'object' && 'done' in state) {
        state.done.replay = { seed: options.seed, inputs: options.replay ?? inputs, setup: initialSetup };
        return {
          result: structuredClone(state.done), duration: tick / 60, timeout: false, bodies: maxBodies,
          positions: (instance.inspect?.().marbles ?? []).filter(marble => marble.alive)
            .flatMap(marble => [marble.x, marble.y]),
        };
      }
    }
    return {
      result: {
        winner: { kind: 'void', reason: 'Observation budget exhausted' }, mvps: [], highlights: [], perUser: {},
        replay: { seed: options.seed, inputs },
      },
      duration: tick / 60, timeout: true, bodies: maxBodies, positions: [],
    };
  } catch (error) {
    console.error(`Simulation error: ${options.game}, seed ${options.seed}, tick ${tick}`, error);
    throw error;
  } finally {
    try { instance.destroy(); }
    finally { ctx.physics.destroy(); }
  }
}
