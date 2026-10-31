import type { ChatMessage, Message } from '@chaos/shared';
export type TwitchStatus = Omit<Extract<Message, { type: 'twitch.status' }>, 'type'>;
export interface TwitchBridge {
  connect(): Promise<void>;
  disconnect(): void;
  onChat: (chat: ChatMessage) => void;
  onStatus?: (status: TwitchStatus) => void;
  status(): TwitchStatus;
}
export class BridgeError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) { super(message); }
}
