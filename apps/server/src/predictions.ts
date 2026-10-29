import { randomUUID } from 'node:crypto';
import type { Message, Prediction } from '@chaos/shared';
import { BridgeError, type TwitchBridge } from './twitch/bridge';
import { twitchError } from './twitch/errors';
import type { JsonStore } from './storage';
import { BACKGROUND_RETRY_MS, RETRY_DELAYS_MS, isOpen,
  ownedPredictionSchema, type OwnedPrediction, type PredictionJob } from './prediction-session';

/** Jobs always carry one persisted, app-owned prediction ID across retries. */
export class Predictions {
  private pending: Promise<void> = Promise.resolve();
  private owned?: OwnedPrediction;
  private recovered = false;
  private timer?: ReturnType<typeof setInterval>;
  private closedRounds: string[] = [];
  constructor(private bridge: TwitchBridge, private store: JsonStore,
    private send: (message: Message) => void, private clock = Date.now) {}

  private queue(work: () => Promise<void>): Promise<void> {
    const job = this.pending.then(work);
    this.pending = job.catch(() => {});
    return job;
  }

  async recover(): Promise<void> {
    if (this.recovered) return;
    this.recovered = true;
    const saved = await this.store.read<unknown>('session.json', {});
    const session = saved && typeof saved === 'object'
      ? saved as { prediction?: OwnedPrediction; closedRounds?: unknown } : {};
    this.closedRounds = Array.isArray(session.closedRounds)
      ? session.closedRounds.filter((value): value is string => typeof value === 'string').slice(-200) : [];
    const recovered = ownedPredictionSchema.safeParse(session.prediction);
    if (recovered.success) this.owned = recovered.data;
    else if (session.prediction) this.fail('prediction.recover',
      new BridgeError('RECOVERY_INVALID', 'An invalid saved prediction was left untouched.'));
    // Legacy mock snapshots are local simulations. Never adopt unknown live IDs.
    if (!this.owned && this.bridge.status().mode === 'mock' && this.bridge.prediction && isOpen(this.bridge.prediction)) {
      this.owned = this.record(this.bridge.prediction, randomUUID());
    }
    if (this.owned) {
      this.bridge.restorePrediction?.(this.owned.prediction);
      this.owned.pending ??= { op: 'cancel', reason: 'Startup recovery — refund', attempts: 0, nextAt: this.clock() };
      await this.save();
      await this.retry();
    }
    this.timer = setInterval(() => { void this.retry(); }, 500);
    this.timer.unref();
  }

  handle(message: Message): Promise<void> {
    return this.queue(async () => {
      try {
        if (this.bridge.status().mode === 'live'
          && ['prediction.create', 'prediction.lock', 'prediction.resolve'].includes(message.type)
          && !('roundId' in message && message.roundId))
          throw new BridgeError('ROUND_REQUIRED', 'Refresh the Show page before enabling live wagers.');
        if (message.type !== 'prediction.create' && 'roundId' in message && message.roundId
          && message.roundId !== this.owned?.roundId) return;
        if (message.type === 'prediction.create') await this.create(message);
        else if (message.type === 'prediction.lock') await this.schedule('lock');
        else if (message.type === 'prediction.resolve') await this.schedule('resolve', message.outcomeIndex);
        else if (message.type === 'prediction.cancel') await this.schedule('cancel', undefined, message.reason);
      } catch (error) { this.fail(message.type, error); }
    });
  }

  private record(prediction: Prediction, roundId: string): OwnedPrediction {
    return { createdBy: 'chaos', roundId, id: prediction.id,
      outcomeIds: prediction.outcomes.map(outcome => outcome.id), createdAt: this.clock(),
      broadcasterId: this.bridge.status().userId, prediction: structuredClone(prediction) };
  }

  private async create(message: Extract<Message, { type: 'prediction.create' }>): Promise<void> {
    if (message.roundId && this.closedRounds.includes(message.roundId))
      throw new BridgeError('ALREADY_ENDED', 'This round prediction has already ended.');
    if (this.owned) {
      if (message.roundId && this.owned.roundId === message.roundId) {
        if (message.outcomes.join('|') !== this.owned.prediction.outcomes.map(outcome => outcome.title).join('|'))
          throw new BridgeError('ROUND_CONFLICT', 'This round already has different prediction choices.');
        this.send({ type: 'prediction.update', ...this.owned.prediction });
        return;
      }
      if (this.owned.pending?.op === 'resolve')
        throw new BridgeError('PENDING_RESOLUTION', 'Previous points are still being settled; this round has no wagers.');
      await this.schedule('cancel', undefined, 'Previous show prediction — refund');
      if (this.owned) throw new BridgeError('PENDING_REFUND', 'Previous refunds are pending; this round has no wagers.');
    }
    const prediction = await this.bridge.createPrediction(message.title, message.outcomes, message.windowSec);
    this.owned = this.record(prediction, message.roundId ?? randomUUID());
    try { await this.save(); }
    catch {
      await this.bridge.cancelPrediction('Could not persist prediction ownership');
      this.owned = undefined;
      throw new BridgeError('PERSISTENCE_ERROR', 'Wagers were refunded because session persistence failed.');
    }
  }

  private async schedule(op: PredictionJob['op'], outcomeIndex?: number, reason?: string): Promise<void> {
    if (!this.owned) return;
    // A late disconnect must not replace a known payout with a refund.
    if (this.owned.pending?.op === 'resolve' && op !== 'resolve') return;
    if (this.owned.pending?.op === op) {
      if (op === 'resolve' && this.owned.pending.outcomeIndex !== outcomeIndex)
        throw new BridgeError('RESULT_CONFLICT', 'A different outcome is already queued for this round.');
      return;
    }
    if (op === 'resolve' && !this.owned.outcomeIds[outcomeIndex ?? -1])
      throw new BridgeError('INVALID_ARGUMENT', 'Unknown winning outcome.');
    this.owned.pending = { op, outcomeIndex, reason, attempts: 0, nextAt: this.clock() };
    await this.save();
    await this.attempt();
  }

  retry(): Promise<void> {
    return this.queue(async () => {
      if (this.owned?.pending && this.owned.pending.nextAt <= this.clock()) await this.attempt();
    });
  }

  private async attempt(): Promise<void> {
    const record = this.owned;
    const job = record?.pending;
    if (!record || !job) return;
    try {
      if (record.broadcasterId && this.bridge.status().userId !== record.broadcasterId)
        throw new BridgeError('ACCOUNT_MISMATCH', 'Reconnect the broadcaster that owns the pending prediction.', true);
      this.bridge.restorePrediction?.(record.prediction);
      const current = await this.bridge.getPrediction?.(record.id) ?? this.bridge.prediction;
      if (current && current.id !== record.id)
        throw new BridgeError('OWNERSHIP_MISMATCH', 'Another prediction was left untouched.');
      if (current && !isOpen(current)) {
        this.finish();
        await this.save();
        return;
      }
      if (job.op === 'lock') await this.bridge.lockPrediction();
      else if (job.op === 'resolve') await this.bridge.resolvePrediction(job.outcomeIndex!);
      else await this.bridge.cancelPrediction(job.reason ?? 'Show refund');
      if (job.op === 'lock') {
        record.prediction = structuredClone(this.bridge.prediction ?? record.prediction);
        record.pending = undefined;
      } else this.finish();
      await this.save();
    } catch (error) {
      const failure = twitchError(error);
      job.attempts++;
      job.nextAt = this.clock() + (RETRY_DELAYS_MS[job.attempts - 1] ?? BACKGROUND_RETRY_MS);
      await this.save().catch(() => {});
      this.fail(`prediction.${job.op}`, failure);
    }
  }

  private finish(): void {
    if (this.owned) this.closedRounds.push(this.owned.roundId);
    this.closedRounds = this.closedRounds.slice(-200);
    this.owned = undefined;
  }
  private save(): Promise<void> {
    return this.store.write('session.json', { prediction: this.owned, closedRounds: this.closedRounds });
  }
  private fail(op: string, error: unknown): void {
    const failure = twitchError(error);
    this.send({ type: 'prediction.error', op, code: failure.code, message: failure.message });
  }

  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.handle({ type: 'prediction.cancel', reason: 'Server shutdown — refund' });
  }
}
