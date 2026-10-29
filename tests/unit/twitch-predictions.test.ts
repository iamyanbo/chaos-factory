import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import type { Message, Prediction } from '@chaos/shared';
import { Predictions } from '../../apps/server/src/predictions';
import { BridgeError, type TwitchBridge } from '../../apps/server/src/twitch/bridge';
import type { OwnedPrediction } from '../../apps/server/src/prediction-session';
import { temporaryStore } from './twitch-fixture';

class ControlledBridge implements TwitchBridge {
  onChat: TwitchBridge['onChat'] = () => {};
  onPrediction: TwitchBridge['onPrediction'] = () => {};
  prediction?: Prediction;
  records = new Map<string, Prediction>();
  calls: string[] = [];
  fail: Partial<Record<'lock' | 'resolve' | 'cancel', number>> = {};
  private managedId?: string;
  async connect() {}
  disconnect() {}
  async say() { throw new Error('Outbound chat is not used'); }
  status() { return { mode: 'live' as const, connected: true, channel: 'host', userId: '100', canPredict: true }; }
  restorePrediction(prediction: Prediction) { this.managedId = prediction.id; }
  async getPrediction(id: string) { return this.records.get(id); }
  async createPrediction(_title: string, outcomes: string[]): Promise<Prediction> {
    this.calls.push('create');
    if (this.prediction && ['ACTIVE', 'LOCKED'].includes(this.prediction.status))
      throw new BridgeError('ALREADY_ACTIVE', 'Another prediction exists');
    const value: Prediction = { id: randomUUID(), status: 'ACTIVE', locksAt: 30000,
      outcomes: outcomes.map((title, index) => ({ id: `outcome-${index}`, title, users: 0, points: 0, top: [] })) };
    this.records.set(value.id, value);
    this.managedId = value.id;
    this.prediction = value;
    return structuredClone(value);
  }
  private change(op: 'lock' | 'resolve' | 'cancel', winnerIndex?: number) {
    this.calls.push(op);
    if ((this.fail[op] ?? 0) > 0) {
      this.fail[op]!--;
      throw new BridgeError('TWITCH_UNAVAILABLE', 'Fixture network outage', true);
    }
    const value = this.records.get(this.managedId!)!;
    value.status = op === 'lock' ? 'LOCKED' : op === 'resolve' ? 'RESOLVED' : 'CANCELED';
    value.winnerIndex = winnerIndex;
    this.prediction = value;
    this.onPrediction(value);
  }
  async lockPrediction() { this.change('lock'); }
  async resolvePrediction(index: number) { this.change('resolve', index); }
  async cancelPrediction() { this.change('cancel'); }
}

const create = (roundId: string): Message => ({ type: 'prediction.create', roundId,
  title: 'Who wins?', outcomes: ['RED', 'BLUE'], windowSec: 30 });

test('known payouts persist through backoff/restart and never become a new round result or disconnect refund', async () => {
  const storage = await temporaryStore();
  const bridge = new ControlledBridge();
  let now = 0;
  const messages: Message[] = [];
  const a = new Predictions(bridge, storage.store, message => messages.push(message), () => now);
  const roundId = randomUUID();
  let b: Predictions | undefined;
  try {
    await a.recover();
    await a.handle(create(roundId));
    await a.handle({ type: 'prediction.lock', roundId });
    bridge.fail.resolve = 2;
    await a.handle({ type: 'prediction.resolve', roundId, outcomeIndex: 1 });
    const saved = await storage.store.read<{ prediction: OwnedPrediction }>('session.json', {} as never);
    expect(saved.prediction.pending).toMatchObject({ op: 'resolve', outcomeIndex: 1, attempts: 1, nextAt: 1000 });
    const otherRound = randomUUID();
    await a.handle(create(otherRound));
    await a.handle({ type: 'prediction.resolve', roundId: otherRound, outcomeIndex: 0 });
    await a.handle({ type: 'prediction.cancel', roundId: otherRound, reason: 'New round error' });
    await a.shutdown();
    expect(bridge.calls.filter(call => call === 'cancel')).toHaveLength(0);
    b = new Predictions(bridge, storage.store, message => messages.push(message), () => now);
    await b.recover();
    now = 1000;
    await b.retry();
    expect(bridge.calls.filter(call => call === 'resolve')).toHaveLength(2);
    now = 3999;
    await b.retry();
    expect(bridge.calls.filter(call => call === 'resolve')).toHaveLength(2);
    now = 4000;
    await b.retry();
    expect(bridge.prediction).toMatchObject({ status: 'RESOLVED', winnerIndex: 1 });
    expect(await storage.store.read('session.json', {})).toMatchObject({ closedRounds: [roundId] });
    expect(messages).toContainEqual(expect.objectContaining({ code: 'PENDING_RESOLUTION' }));
    await b.handle(create(roundId));
    expect(bridge.calls.filter(call => call === 'create')).toHaveLength(1);
  } finally { await a.shutdown(); await b?.shutdown(); await storage.clean(); }
});

test('startup refunds only the persisted app-owned prediction and leaves manual predictions alone', async () => {
  const storage = await temporaryStore();
  const bridge = new ControlledBridge();
  const prediction = await bridge.createPrediction('Owned?', ['RED', 'BLUE']);
  const record: OwnedPrediction = { createdBy: 'chaos', roundId: randomUUID(), id: prediction.id,
    outcomeIds: prediction.outcomes.map(outcome => outcome.id), createdAt: 0, broadcasterId: '100', prediction };
  await storage.store.write('session.json', { prediction: record });
  const manager = new Predictions(bridge, storage.store, () => {});
  try {
    await manager.recover();
    expect(bridge.prediction?.status).toBe('CANCELED');
    const manual = { ...prediction, id: 'manual', status: 'ACTIVE' as const };
    bridge.prediction = manual;
    bridge.records.set('manual', manual);
    const count = bridge.calls.filter(call => call === 'cancel').length;
    await manager.handle(create(randomUUID()));
    await manager.handle({ type: 'prediction.cancel', reason: 'Failed new create' });
    expect(bridge.calls.filter(call => call === 'cancel')).toHaveLength(count);
    expect(manual.status).toBe('ACTIVE');
  } finally { await manager.shutdown(); await storage.clean(); }
});

test('duplicate round creates and repeated retry feedback do not duplicate wagers or reset backoff', async () => {
  const storage = await temporaryStore();
  const bridge = new ControlledBridge();
  let now = 0;
  const manager = new Predictions(bridge, storage.store, () => {}, () => now);
  const roundId = randomUUID();
  try {
    await manager.recover();
    await manager.handle(create(roundId));
    await manager.handle(create(roundId));
    expect(bridge.calls.filter(call => call === 'create')).toHaveLength(1);
    bridge.fail.cancel = 4;
    await manager.handle({ type: 'prediction.cancel', roundId, reason: 'Void' });
    await manager.handle({ type: 'prediction.cancel', roundId, reason: 'Repeated UI refund' });
    expect(bridge.calls.filter(call => call === 'cancel')).toHaveLength(1);
    for (const at of [1000, 4000, 13000]) { now = at; await manager.retry(); }
    expect(bridge.calls.filter(call => call === 'cancel')).toHaveLength(4);
    const saved = await storage.store.read<{ prediction: OwnedPrediction }>('session.json', {} as never);
    expect(saved.prediction.pending).toMatchObject({ attempts: 4, nextAt: 43000 });
    now = 43000;
    await manager.retry();
    expect(bridge.prediction?.status).toBe('CANCELED');
  } finally { await manager.shutdown(); await storage.clean(); }
});

test('invalid or unproven persisted ownership cannot trigger a native refund', async () => {
  const storage = await temporaryStore();
  const bridge = new ControlledBridge();
  const messages: Message[] = [];
  await storage.store.write('session.json', { prediction: { createdBy: 'chaos', id: 'manual' } });
  const manager = new Predictions(bridge, storage.store, message => messages.push(message));
  try {
    await manager.recover();
    expect(bridge.calls).toEqual([]);
    expect(messages).toContainEqual(expect.objectContaining({ code: 'RECOVERY_INVALID' }));
  } finally { await manager.shutdown(); await storage.clean(); }
});

test('a cached unscoped live client cannot create or replace a native payout', async () => {
  const storage = await temporaryStore();
  const bridge = new ControlledBridge();
  const messages: Message[] = [];
  const manager = new Predictions(bridge, storage.store, message => messages.push(message));
  try {
    await manager.recover();
    await manager.handle({ type: 'prediction.create', title: 'Old client', outcomes: ['A', 'B'], windowSec: 30 });
    expect(bridge.calls).toHaveLength(0);
    expect(messages).toContainEqual(expect.objectContaining({ code: 'ROUND_REQUIRED' }));
    await manager.handle(create(randomUUID()));
    await manager.handle({ type: 'prediction.resolve', outcomeIndex: 0 });
    expect(bridge.calls.filter(call => call === 'resolve')).toHaveLength(0);
    await manager.handle({ type: 'prediction.cancel', reason: 'Global show shutdown' });
    expect(bridge.prediction?.status).toBe('CANCELED');
  } finally { await manager.shutdown(); await storage.clean(); }
});

test.each([null, 'invalid', { closedRounds: 17 }])('malformed session shape fails soft: %j', async saved => {
  const storage = await temporaryStore();
  const bridge = new ControlledBridge();
  const manager = new Predictions(bridge, storage.store, () => {});
  try {
    await storage.store.write('session.json', saved);
    await manager.recover();
    expect(bridge.calls).toHaveLength(0);
    await manager.handle(create(randomUUID()));
    expect(bridge.calls).toEqual(['create']);
  } finally { await manager.shutdown(); await storage.clean(); }
});
