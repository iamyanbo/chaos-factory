import { expect, test } from 'vitest';
import { Stages } from '../../apps/show/src/show-layer/stages';
import { stableViewerColor } from '@chaos/shared';

test('stages follow real events, keep checkpoint timestamps and never rewind', () => {
  const stages = new Stages();
  stages.reset('ring-escape');
  stages.update(25, undefined);
  expect(stages.index).toBe(1);
  stages.update(30, undefined);
  expect(stages.rows[2]).toEqual({ name: 'RED ZONE', startedAt: 30 });
  stages.update(10, undefined);
  expect(stages.index).toBe(2);
  stages.reset('marble-race');
  stages.update(22, { inspect: () => ({ time: 22, keys: [], marbles: [],
    details: { checkpoints: [{ times: [2, 8, 17, 22] }] } }) } as never);
  expect(stages.rows[1].startedAt).toBe(22);
});
