import { beforeAll, expect, test } from 'vitest';
import { games } from '../../apps/show/src/games/registry';
import type { BaseGame } from '../../apps/show/src/kit/base-game';
import { HypeBus, type HypeEvent } from '../../apps/show/src/kit/hype';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { headlessContext } from '../../apps/show/src/engine/headless';
import { advanceGame } from '../../apps/show/src/engine/game-clock';
import { makeSetup } from '../../tools/simulation';

beforeAll(async () => initPhysics());

const labels: Record<string, string[]> = {
  'blade-brawl': ['RAGE!', 'DETHRONED'],
  'ring-escape': ['DETHRONED'],
  'light-cycles': ['DETHRONED'],
  'multiplier-cascade': ['COMEBACK'],
  'peg-fever': ['EXTREME FEVER']
};

test.each(games.map(game => [game.id, game] as const))('%s emits feedback for actual rules without generic streaks',
  (id, definition) => {
    const ctx = headlessContext(definition,
      makeSetup({ game: id, seed: 4, participants: 24, teams: 4 }), () => {});
    const events: HypeEvent[] = [];
    ctx.hype = new HypeBus(event => events.push(event), false);
    const game = definition.create(ctx) as BaseGame;
    try {
      game.start();
      for (let tick = 1; tick <= 360 * 60 && game.status() === 'playing'; tick++) {
        advanceGame(game, 1 / 60, tick / 60);
      }
      expect(game.status()).not.toBe('playing');
      expect(events.filter(event => event.kind === 'combo' || event.kind === 'jackpot')).toEqual([]);
      expect(events.some(event => event.text === 'DOUBLE KILL' || event.text === 'UPSET!'
        || event.text === 'CLUTCH!')).toBe(false);
      for (const event of events.filter(event => event.kind === 'callout')) {
        expect(labels[id] ?? []).toContain(event.text);
      }
      if (['marble-race', 'pong-wars', 'peg-fever', 'multiplier-cascade'].includes(id)) {
        expect(events.filter(event => event.kind === 'kill')).toEqual([]);
      }
    } finally {
      game.destroy();
      ctx.physics.destroy();
    }
  });
