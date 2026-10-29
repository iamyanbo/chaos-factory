import { predictionSchema, type Prediction } from '@chaos/shared';
import { z } from 'zod';

export interface PredictionJob {
  op: 'lock' | 'resolve' | 'cancel';
  outcomeIndex?: number;
  reason?: string;
  attempts: number;
  nextAt: number;
}
export interface OwnedPrediction {
  createdBy: 'chaos';
  roundId: string;
  id: string;
  outcomeIds: string[];
  createdAt: number;
  broadcasterId?: string;
  prediction: Prediction;
  pending?: PredictionJob;
}

export function isOpen(value: Prediction): boolean {
  return value.status === 'ACTIVE' || value.status === 'LOCKED';
}

export const RETRY_DELAYS_MS = [1000, 3000, 9000] as const;
export const BACKGROUND_RETRY_MS = 30000;

export const ownedPredictionSchema = z.object({
  createdBy: z.literal('chaos'), roundId: z.string().uuid(), id: z.string().min(1).max(100),
  outcomeIds: z.array(z.string().min(1).max(100)).min(2).max(10), createdAt: z.number().finite(),
  broadcasterId: z.string().max(100).optional(), prediction: predictionSchema,
  pending: z.object({ op: z.enum(['lock', 'resolve', 'cancel']),
    outcomeIndex: z.number().int().min(0).max(9).optional(), reason: z.string().max(500).optional(),
    attempts: z.number().int().nonnegative(), nextAt: z.number().finite() }).optional()
}).refine(value => value.id === value.prediction.id
  && value.outcomeIds.join('|') === value.prediction.outcomes.map(outcome => outcome.id).join('|')
  && (value.pending?.op !== 'resolve' || value.outcomeIds[value.pending.outcomeIndex ?? -1] !== undefined));
