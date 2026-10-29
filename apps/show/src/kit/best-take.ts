import type { RoundSetup } from '@chaos/shared';
import type { BestTakeResult, ScoredTake } from './take-types';

export const DEFAULT_TAKES = 24;
export const TAKE_BUDGET_MS = 6000;

export function bestCompletedTake(takes: readonly ScoredTake[], fallback: number): number {
  let best: ScoredTake | undefined;
  for (const take of takes) {
    if (Number.isFinite(take.score) && (!best || take.score > best.score)) best = take;
  }
  return best?.seed ?? fallback;
}

export function selectBestTake(
  setup: RoundSetup,
  options: { count?: number; budgetMs?: number; signal?: AbortSignal } = {}
): Promise<BestTakeResult> {
  const count = Math.max(1, Math.min(128, Math.floor(options.count ?? DEFAULT_TAKES)));
  const budgetMs = Math.max(1, Math.min(TAKE_BUDGET_MS, options.budgetMs ?? TAKE_BUDGET_MS));
  const started = performance.now();
  const candidates: ScoredTake[] = [];
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException('Round replaced', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./best-take.worker.ts', import.meta.url), { type: 'module' });
    let ended = false;
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      options.signal?.removeEventListener('abort', abort);
    };
    const finish = (timedOut: boolean, reason?: string) => {
      if (ended) return;
      ended = true;
      cleanup();
      resolve({ requestedSeed: setup.seed,
        selectedSeed: bestCompletedTake(candidates, setup.seed), candidates,
        elapsedMs: performance.now() - started, budgetMs, timedOut, reason });
    };
    const abort = () => {
      if (ended) return;
      ended = true;
      cleanup();
      reject(new DOMException('Round replaced', 'AbortError'));
    };
    const timer = setTimeout(() => finish(true), budgetMs);
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      const message = event.data as { take?: ScoredTake; done?: boolean; error?: string };
      if (message.take) candidates.push(message.take);
      if (message.done || message.error) finish(false, message.error);
    };
    worker.onerror = event => {
      event.preventDefault();
      finish(false, event.message);
    };
    worker.postMessage({ setup: structuredClone(setup), count });
  });
}
