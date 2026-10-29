import { expect, test } from 'vitest';
import type { RoundSetup } from '@chaos/shared';
import { initPhysics, PX } from '../../engine/physics';
import { headlessContext } from '../../engine/headless';
import { HypeBus, type HypeEvent } from '../../kit/hype';
import definition, { MultiplierCascade } from './index';
import { BALL_RADIUS, COURSE, GATE_Y } from './course-layout';
import type { Unit } from './types';
import { cascadeHypeFixture } from './hype-fixture';

// Atomic outlet splits and upstream floors; enabled/silent motion must still match.
const RELAY_FINGERPRINT = 'f75617ef83f47437a4bb58a22f7047e6eab40d313b6006f6d1404786bd2df199';

async function fixture() {
  await initPhysics();
  const setup: RoundSetup = {
    gameId: definition.id, seed: 4, mode: 'faction', format: 'faction', difficulty: 1,
    modifiers: [], participants: [], teams: ['red', 'blue'], streamerName: 'Host'
  };
  const ctx = headlessContext(definition, setup, () => {});
  const events: HypeEvent[] = [];
  ctx.hype = new HypeBus(event => events.push(event), false);
  const game = new MultiplierCascade(ctx);
  game.start();
  return { ctx, game, events, destroy() { game.destroy(); ctx.physics.destroy(); } };
}

function place(unit: Unit, x: number, y: number): void {
  unit.marble.x = unit.marble.prevX = x;
  unit.marble.y = unit.marble.prevY = y;
  unit.marble.body.setTranslation({ x: x / PX, y: y / PX }, true);
  unit.marble.body.setLinvel({ x: 0, y: 0 }, true);
}

test('six-team hype preserves committed physical traces, scoring, result and physics RNG', async () => {
  const visible = await cascadeHypeFixture();
  const silent = await cascadeHypeFixture(false);
  expect(visible.hash).toBe(RELAY_FINGERPRINT);
  expect(silent.hash).toBe(RELAY_FINGERPRINT);
  expect(visible.status).toEqual(silent.status);
  expect(visible.events.filter(event => event.kind === 'jackpot')).toHaveLength(0);
  expect(visible.events.some(event => event.kind === 'kill')).toBe(false);
  expect(visible.events.filter(event => event.kind === 'combo')).toHaveLength(0);
  expect(visible.events.filter(event => event.kind === 'decisive')).toHaveLength(1);
});

test('ordinary clone and drain crossings do not invent near misses or kills', async () => {
  const scene = await fixture();
  try {
    const [survivor, drained] = [...scene.game.units.values()];
    const boundary = COURSE.left + (COURSE.right - COURSE.left) * 0.78;
    place(survivor, boundary - BALL_RADIUS * 0.2, GATE_Y[0] + 1);
    place(drained, boundary + BALL_RADIUS * 0.2, GATE_Y[0] + 1);
    scene.game.step(1 / 60);
    expect(survivor.marble.alive).toBe(true);
    expect(drained.marble.alive).toBe(false);
    const misses = scene.events.filter(event => event.kind === 'nearMiss');
    expect(misses).toHaveLength(0);
    expect(scene.events.filter(event => event.kind === 'kill')).toHaveLength(0);
  } finally { scene.destroy(); }
});

test('only a real ×2→×2→×3 branch earns ×12 and children inherit that exact history', async () => {
  const scene = await fixture();
  try {
    const unit = [...scene.game.units.values()][0];
    for (let stage = 0; stage < 3; stage++) {
      const bay = scene.game.board.bay();
      const fraction = scene.game.board.mirrored(stage) ? 0.68 : 0.32;
      place(unit, bay.left + bay.w * fraction, GATE_Y[stage] + 1);
      scene.game.step(1 / 60);
      if (stage < 2) expect(scene.events.some(event => event.kind === 'jackpot')).toBe(false);
    }
    expect(unit.lineage).toBe(12);
    expect(scene.events.filter(event => event.kind === 'jackpot')).toHaveLength(0);
    const children = [...scene.game.units.values()].filter(child => child.root === unit.root && child.stage === 3);
    expect(children.length).toBeGreaterThan(1);
    expect(children.every(child => child.lineage === 12)).toBe(true);
  } finally { scene.destroy(); }
});
