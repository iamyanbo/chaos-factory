import { beforeAll, expect, test } from 'vitest';
import type { RoundSetup } from '@chaos/shared';
import { headlessContext } from '../../engine/headless';
import { initPhysics, PX } from '../../engine/physics';
import definition, { MarbleRace } from './index';
import { GATE_HITS } from './breakthrough';

beforeAll(async () => initPhysics());
function fixture() {
  const setup: RoundSetup = { gameId: definition.id, seed: 4, mode: 'cvs', format: 'ffa',
    difficulty: .5, modifiers: [], streamerName: 'Host', participants: [
      { userId: 'leader', login: 'leader', displayName: 'Leader', color: '#ffffff' },
      { userId: 'chaser', login: 'chaser', displayName: 'Chaser', color: '#ffffff' }
    ] };
  const ctx = headlessContext(definition, setup, () => {});
  const game = new MarbleRace(ctx);
  return { ctx, game, destroy() { game.destroy(); ctx.physics.destroy(); } };
}

test('gravity-driven impacts crack a gate, remove its collider and let the following field through', () => {
  const f = fixture();
  try {
    const gate = f.game.course.breakthrough.gates[0];
    for (const [index, racer] of f.game.marbles.entries()) {
      racer.x = racer.prevX = gate.x;
      racer.y = racer.prevY = gate.y - 60 - index * 250;
      racer.body.setTranslation({ x: racer.x / PX, y: racer.y / PX }, true);
      racer.body.setLinvel({ x: 0, y: 0 }, true);
    }
    f.game.start();
    const damage = new Set<number>();
    for (let tick = 0; tick < 12 * 60; tick++) {
      f.game.step(1 / 60);
      damage.add(gate.damage);
      if (f.game.marbles.every(racer => racer.y > gate.y + 80)) break;
    }
    expect(damage.has(1)).toBe(true);
    expect(damage.has(2)).toBe(true);
    expect(gate.damage).toBe(GATE_HITS);
    expect(gate.brokenAt).toBeDefined();
    expect(gate.collider.isValid()).toBe(false);
    expect(f.game.marbles.every(racer => racer.y > gate.y + 80)).toBe(true);
  } finally { f.destroy(); }
});

test('waiting never damages a gate and sudden death removes every remaining solid plank', () => {
  const f = fixture();
  try {
    f.game.start();
    for (let tick = 0; tick < 60; tick++) f.game.step(1 / 60);
    expect(f.game.course.breakthrough.gates.every(gate => gate.damage === 0)).toBe(true);
    f.game.suddenDeath();
    expect(f.game.course.breakthrough.gates.every(gate => !gate.collider.isValid())).toBe(true);
  } finally { f.destroy(); }
});
