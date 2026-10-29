import type { ChatMessage, Prediction, Message } from '@chaos/shared';
export type TwitchStatus = Omit<Extract<Message, { type: 'twitch.status' }>, 'type'>;
export interface TwitchBridge {
  connect(): Promise<void>; disconnect(): void;
  onChat: (chat: ChatMessage) => void; onPrediction: (prediction: Prediction) => void;
  onStatus?: (status: TwitchStatus) => void;
  prediction?: Prediction;
  restorePrediction?(prediction: Prediction): void;
  getPrediction?(id: string): Promise<Prediction | undefined>;
  createPrediction(title: string, outcomes: string[], windowSec: number): Promise<Prediction>;
  lockPrediction(): Promise<void>; resolvePrediction(outcomeIndex: number): Promise<void>; cancelPrediction(reason: string): Promise<void>;
  say(text: string): Promise<void>;
  status(): TwitchStatus;
}
export class BridgeError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) { super(message); }
}
