import { expect, test } from 'vitest';
import { headlessContext } from '../../engine/headless';
import { initPhysics } from '../../engine/physics';
import { makeSetup } from '../../../../../tools/simulation';
import definition, { MultiplierCascade } from './index';
import { BALL_RADIUS, GATE_Y, COURSE } from './course-layout';

test('one continuous eight-chamber course conserves supply and finishes before sudden death', async () => {
  await initPhysics();
  for (const teams of [2, 4, 6]) for (let seed = 1; seed <= 4; seed++) {
    const setup = makeSetup({ game: definition.id, seed, participants: 0, teams, mode: 'faction' });
    const ctx = headlessContext(definition, setup, () => {});
    const game = new MultiplierCascade(ctx);
    try {
      game.start();
      let previousCameraY = game.camera.y;
      const radii = new Set<number>();
      let backwards = false;
      let peakScroll = 0;
      let pocketOverrun = false;
      for (let tick = 0; tick < 150 * 60 && !game.result; tick++) {
        game.step(1 / 60);
        backwards ||= game.camera.y < previousCameraY;
        peakScroll = Math.max(peakScroll, game.camera.y - previousCameraY);
        pocketOverrun ||= game.phase === 'drop' && game.camera.y > COURSE.bottom - COURSE.viewHeight / 2;
        previousCameraY = game.camera.y;
        if (tick % 60 === 0) for (const unit of game.units.values()) radii.add(unit.marble.radius);
      }
      expect([...radii]).toEqual([BALL_RADIUS]);
      expect(backwards).toBe(false);
      expect(pocketOverrun).toBe(false);
      expect(peakScroll).toBeLessThanOrEqual(150 / 60 + 1e-8);
      expect(game.result?.winner.kind, `${teams} teams, seed ${seed}`).toBe('team');
      expect(game.drops).toHaveLength(1);
      for (const drop of game.drops) {
        expect(drop.expired).toBe(0);
        expect(drop.born).toBe(drop.banked + drop.lost);
      }
      expect(game.relay?.finished.get(game.relay.winner!)).toBe(5);
      expect(game.time).toBeGreaterThan(45);
      expect(game.time).toBeLessThan(150);
      expect(game.splits.some(split => split.factor === 0)).toBe(true);
      expect(new Set(game.splits.map(split => split.stage)).size).toBe(GATE_Y.length);
      expect(game.camera.y).toBeGreaterThan(3500);
    } finally {
      game.destroy();
      ctx.physics.destroy();
    }
  }
}, 60000);
