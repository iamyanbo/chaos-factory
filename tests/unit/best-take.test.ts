import { afterEach, expect, test, vi } from 'vitest';
import { bestCompletedTake, selectBestTake } from '../../apps/show/src/kit/best-take';
import { scoreRingTake } from '../../apps/show/src/games/ring-escape/score';
import { makeSetup } from '../../tools/simulation';
import type { TakeEvents, ScoredTake } from '../../apps/show/src/kit/take-types';

const events: TakeEvents = {
  duration: 60, finished: true, leadChanges: 3,
  finalCloseness: 0.9, quietMax: 4, passes: 50
};
function take(seed: number, changes = 3): ScoredTake {
  const trace = { ...events, leadChanges: changes };
  return { seed, events: trace, score: scoreRingTake(trace) };
}

class WorkerFixture {
  static instance: WorkerFixture;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { message: string; preventDefault(): void }) => void;
  request?: unknown;
  terminated = false;
  constructor() { WorkerFixture.instance = this; }
  postMessage(request: unknown) { this.request = request; }
  terminate() { this.terminated = true; }
  send(data: unknown) { this.onmessage?.({ data }); }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('the score rewards duration, reversals, close final depths and uninterrupted passes', () => {
  const score = scoreRingTake(events);
  expect(score).toBeGreaterThan(scoreRingTake({ ...events, duration: 20 }));
  expect(score).toBeGreaterThan(scoreRingTake({ ...events, leadChanges: 0 }));
  expect(score).toBeGreaterThan(scoreRingTake({ ...events, finalCloseness: 0 }));
  expect(score).toBeGreaterThan(scoreRingTake({ ...events, quietMax: 15 }));
  expect(score).toBeGreaterThan(scoreRingTake({ ...events, finished: false }));
  expect(bestCompletedTake([take(10), take(12, 5), take(13, 5)], 1)).toBe(12);
});

test('the six-second wall budget terminates work and chooses only completed scored takes', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('Worker', WorkerFixture);
  const setup = makeSetup({ game: 'ring-escape', seed: 1, participants: 24 });
  const promise = selectBestTake(setup);
  const worker = WorkerFixture.instance;
  expect(worker.request).toEqual({ setup, count: 24 });
  worker.send({ take: take(9) });
  worker.send({ take: take(18, 5) });
  await vi.advanceTimersByTimeAsync(6000);
  const result = await promise;
  expect(worker.terminated).toBe(true);
  expect(result.selectedSeed).toBe(18);
  expect(result.timedOut).toBe(true);
  expect(result.candidates).toHaveLength(2);
});

test('a restart aborts a stale worker rather than applying its seed to a new roster', async () => {
  vi.stubGlobal('Worker', WorkerFixture);
  const controller = new AbortController();
  const pending = selectBestTake(makeSetup({ game: 'ring-escape', seed: 1 }), { signal: controller.signal });
  const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejection;
  expect(WorkerFixture.instance.terminated).toBe(true);
});

test('worker failure falls back to the requested seed and keeps a diagnostic', async () => {
  vi.stubGlobal('Worker', WorkerFixture);
  const pending = selectBestTake(makeSetup({ game: 'ring-escape', seed: 42 }));
  WorkerFixture.instance.send({ error: 'Unavailable fixture' });
  const result = await pending;
  expect(result.selectedSeed).toBe(42);
  expect(result.reason).toBe('Unavailable fixture');
  expect(result.candidates).toEqual([]);
  expect(WorkerFixture.instance.terminated).toBe(true);
});
