import { Rng } from '@chaos/shared';
import { registry } from '../games/registry';
import { simulateTake } from './take-simulation';
import type { TakeRequest } from './take-types';

const worker = globalThis as unknown as {
  onmessage: (event: MessageEvent<TakeRequest>) => void;
  postMessage: (message: unknown) => void;
};

worker.onmessage = async event => {
  const { setup, count } = event.data;
  const definition = registry.get(setup.gameId);
  if (!definition?.scoreTake) {
    worker.postMessage({ error: 'This game does not export scoreTake' });
    return;
  }
  const rng = new Rng(setup.seed).fork('best-take-v1');
  const used = new Set<number>();
  try {
    for (let index = 0; index < count; index++) {
      let seed = index === 0 ? setup.seed : rng.int(1, 2147483647);
      while (used.has(seed)) seed = rng.int(1, 2147483647);
      used.add(seed);
      const take = await simulateTake(definition, { ...setup, seed });
      worker.postMessage({ take });
    }
    worker.postMessage({ done: true });
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};
