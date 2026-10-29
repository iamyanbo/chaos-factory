import { expect, test } from 'vitest';
import { Director } from '../../apps/show/src/director/director';
import { createContext } from '../../apps/show/src/engine/context';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { resultSchema } from '@chaos/shared';
import type { BestTakeResult } from '../../apps/show/src/kit/take-types';

const selection = (requestedSeed: number, selectedSeed: number): BestTakeResult => ({
  requestedSeed, selectedSeed, elapsedMs: 10, budgetMs: 6000, timedOut: false,
  candidates: [{ seed: selectedSeed, score: 100,
    events: { duration: 60, finished: true, leadChanges: 2,
      quietMax: 3, passes: 40, finalCloseness: 0.9 } }]
});

test('entrant lock freezes physics, applies the chosen seed and persists scores with the selected replay setup', async () => {
  await initPhysics();
  let resolve!: (result: BestTakeResult) => void;
  const director = new Director({
    send: () => false, context: (def, setup, emit) => createContext(def, setup, { emit }),
    announce() {}, toast() {}, feed() {}, reset() {},
    chooseTake: () => new Promise(done => { resolve = done; })
  }, { practice: true, game: 'ring-escape' });
  try {
    director.startPractice({ gameId: 'ring-escape', mode: 'cvs', seed: 1, bots: 24, team: 'red' });
    expect(director.takePending).toBe(true);
    const roster = structuredClone(director.ctx!.setup.participants);
    for (let step = 0; step < 120; step++) {
      director.step(1 / 60);
      director.frame(1 / 60);
    }
    expect(director.phase).toBe('LOCK_COUNTDOWN');
    expect(director.instance!.takeState!()).toEqual(Array(24).fill(0));
    resolve(selection(1, 8));
    await Promise.resolve();
    expect(director.phase).toBe('PLAY');
    expect(director.roundSeed).toBe(8);
    expect(director.ctx!.setup.participants).toEqual(roster);
    for (let step = 0; step < 7200 && director.phase === 'PLAY'; step++) director.step(1 / 60);
    expect(director.phase).toBe('RESULT');
    const stored = resultSchema.parse(JSON.parse(JSON.stringify(director.result)));
    expect(stored.bestTake).toEqual(selection(1, 8));
    expect(stored.replay.seed).toBe(8);
    expect(stored.replay.setup!.seed).toBe(8);
    expect(stored.replay.setup!.participants).toEqual(roster);
  } finally {
    director.destroy();
  }
});

test('late results from a replaced search cannot overwrite the new field or seed', async () => {
  await initPhysics();
  const resolves: ((result: BestTakeResult) => void)[] = [];
  const signals: AbortSignal[] = [];
  const director = new Director({
    send: () => false, context: (def, setup) => createContext(def, setup),
    announce() {}, toast() {}, feed() {}, reset() {},
    chooseTake: (_setup, signal) => {
      signals.push(signal);
      return new Promise(done => resolves.push(done));
    }
  }, { practice: true, game: 'ring-escape' });
  try {
    director.startPractice({ gameId: 'ring-escape', mode: 'cvs', seed: 1, bots: 24, team: 'red' });
    director.startPractice({ gameId: 'ring-escape', mode: 'cvs', seed: 2, bots: 12, team: 'red' });
    expect(signals[0].aborted).toBe(true);
    resolves[0](selection(1, 999));
    await Promise.resolve();
    expect(director.roundSeed).toBe(2);
    expect(director.takePending).toBe(true);
    expect(director.ctx!.setup.participants).toHaveLength(12);
    resolves[1](selection(2, 8));
    await Promise.resolve();
    expect(director.roundSeed).toBe(8);
    expect(director.takePending).toBe(false);
    expect(director.ctx!.setup.participants).toHaveLength(12);
  } finally {
    director.destroy();
  }
});
