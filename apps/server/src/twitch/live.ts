import { EventSubWsListener } from '@twurple/eventsub-ws';
import type { Prediction } from '@chaos/shared';
import { createPredictionSchema, parseChat } from '@chaos/shared';
import type { TwitchBridge, TwitchStatus } from './bridge';
import { BridgeError } from './bridge';
import { TwitchAuth } from './auth';
import { twitchError } from './errors';
import { eventChat, eventPrediction, helixPrediction } from './mapping';

export class LiveBridge implements TwitchBridge {
  onChat: TwitchBridge['onChat'] = () => {};
  onPrediction: TwitchBridge['onPrediction'] = () => {};
  onStatus: (status: TwitchStatus) => void = () => {};
  prediction?: Prediction;
  private managedId?: string;
  private listener?: EventSubWsListener;
  private listenerUser?: string;
  private connected = false;
  private lastError?: string;
  private seenMessages = new Set<string>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private lastJoinAt?: number;

  constructor(readonly auth: TwitchAuth, private eventSubUrl?: string) {
    auth.onReady = async () => this.listen();
    auth.onLost = () => this.stopListener();
  }

  async connect(): Promise<void> {
    await this.auth.connect();
    this.publishStatus();
  }

  disconnect(): void { this.auth.disconnect(); }

  private listen(): void {
    const user = this.auth.user;
    if (!user || !this.auth.api || this.listenerUser === user.id) return;
    this.stopListener();
    const listener = this.listener = new EventSubWsListener({ apiClient: this.auth.api,
      url: this.eventSubUrl, logger: { minLevel: 'critical' } });
    this.listenerUser = user.id;
    const subscribed = new Set<string>();
    let socketReady = false;
    const ready = () => {
      this.connected = socketReady && subscribed.size >= (user.broadcasterType ? 5 : 1);
      if (this.connected) this.lastError = undefined;
      this.publishStatus();
    };
    listener.onUserSocketReady(() => { socketReady = true; ready(); });
    listener.onSubscriptionCreateSuccess((_subscription, value) => {
      subscribed.add(value.type);
      ready();
    });
    listener.onUserSocketDisconnect(() => {
      socketReady = false;
      this.connected = false;
      this.lastError = 'Twitch chat disconnected. Reconnecting; the show continues.';
      this.publishStatus();
    });
    listener.onRevoke(() => this.auth.lose('Twitch access was revoked. Reconnect Twitch.'));
    listener.onSubscriptionCreateFailure(() => {
      this.lastError = 'A Twitch subscription failed. Reconnect Twitch; this round has no wagers.';
      this.connected = false;
      this.publishStatus();
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = undefined;
          this.stopListener();
          this.listen();
        }, 5000);
        this.reconnectTimer.unref();
      }
    });
    listener.onChannelChatMessage(user.id, user.id, event => {
      if (!parseChat(event.messageText)) return;
      if (this.seenMessages.has(event.messageId)) return;
      this.seenMessages.add(event.messageId);
      if (this.seenMessages.size > 2000) this.seenMessages.delete(this.seenMessages.values().next().value!);
      this.lastJoinAt = Date.now();
      this.onChat(eventChat(event));
      this.publishStatus();
    });
    if (user.broadcasterType) {
      listener.onChannelPredictionBegin(user.id, event => this.emit(eventPrediction(event, 'ACTIVE')));
      listener.onChannelPredictionProgress(user.id, event => this.emit(eventPrediction(event, 'ACTIVE')));
      listener.onChannelPredictionLock(user.id, event => this.emit(eventPrediction(event, 'LOCKED')));
      listener.onChannelPredictionEnd(user.id, event =>
        this.emit(eventPrediction(event, event.status.toUpperCase() as Prediction['status'])));
    }
    listener.start();
  }

  private stopListener(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.listener?.stop();
    this.listener = undefined;
    this.listenerUser = undefined;
    this.connected = false;
    this.publishStatus();
  }

  status(): TwitchStatus {
    const user = this.auth.user;
    return {
      mode: 'live', configured: this.auth.configured, connected: this.connected,
      authenticated: Boolean(user), eventSubConnected: this.connected,
      authFlow: this.auth.flow, lastJoinAt: this.lastJoinAt,
      channel: user?.name ?? 'Not connected', userId: user?.id,
      displayName: user?.displayName,
      broadcasterType: user?.broadcasterType,
      canPredict: this.connected && Boolean(user?.broadcasterType),
      lastError: this.auth.lastError ?? this.lastError,
      loginUrl: new URL('/auth/login', this.auth.settings.redirectUri).href
    };
  }

  private publishStatus(): void { this.onStatus(this.status()); }
  private emit(value: Prediction): Prediction {
    this.prediction = value;
    this.onPrediction(structuredClone(value));
    return value;
  }

  restorePrediction(value: Prediction): void {
    this.managedId = value.id;
    this.prediction = value;
  }

  private api() {
    if (!this.auth.api || !this.auth.user)
      throw new BridgeError('AUTH_REQUIRED', 'Connect Twitch to manage predictions.', true);
    return { api: this.auth.api.predictions, userId: this.auth.user.id };
  }

  async getPrediction(id: string): Promise<Prediction | undefined> {
    try {
      const { api, userId } = this.api();
      const value = await api.getPredictionById(userId, id);
      if (value && value.id !== id) throw new BridgeError('OWNERSHIP_MISMATCH', 'Unexpected prediction was left untouched.');
      return value ? helixPrediction(value) : undefined;
    } catch (error) { throw twitchError(error); }
  }

  async createPrediction(title: string, outcomes: string[], windowSec: number): Promise<Prediction> {
    if (!createPredictionSchema.safeParse({ title, outcomes, windowSec }).success)
      throw new BridgeError('INVALID_ARGUMENT', 'Invalid prediction title, choices or window.');
    if (!this.status().canPredict)
      throw new BridgeError('NO_WAGERS', 'Twitch is not ready for predictions. The round continues without wagers.');
    try {
      const { api, userId } = this.api();
      const value = await api.createPrediction(userId, { title, outcomes, autoLockAfter: windowSec });
      this.managedId = value.id;
      return this.emit(helixPrediction(value));
    } catch (error) {
      const mapped = twitchError(error);
      if (mapped.code === 'INVALID_STATE') {
        const { api, userId } = this.api();
        const existing = await api.getPredictions(userId, { limit: 1 });
        if (existing.data.some(value => ['ACTIVE', 'LOCKED'].includes(value.status.toUpperCase())))
          throw new BridgeError('ALREADY_ACTIVE', 'Another prediction is running. It has been left untouched.');
      }
      throw mapped;
    }
  }

  private async managed(): Promise<Prediction | undefined> {
    if (!this.managedId) throw new BridgeError('NOT_FOUND', 'No prediction owned by this show.');
    return this.getPrediction(this.managedId);
  }

  async lockPrediction(): Promise<void> {
    const current = await this.managed();
    if (!current || current.status === 'LOCKED') return;
    if (current.status !== 'ACTIVE') throw new BridgeError('INVALID_STATE', 'Prediction already ended.');
    try {
      const { api, userId } = this.api();
      this.emit(helixPrediction(await api.lockPrediction(userId, current.id)));
    } catch (error) {
      const latest = await this.managed();
      if (latest?.status === 'LOCKED') { this.emit(latest); return; }
      throw twitchError(error);
    }
  }

  async resolvePrediction(outcomeIndex: number): Promise<void> {
    const current = await this.managed();
    if (!current) return;
    const outcome = current.outcomes[outcomeIndex];
    if (!outcome) throw new BridgeError('INVALID_ARGUMENT', 'Unknown winning outcome.');
    if (current.status === 'RESOLVED' && current.winnerIndex === outcomeIndex) { this.emit(current); return; }
    if (!['ACTIVE', 'LOCKED'].includes(current.status))
      throw new BridgeError('INVALID_STATE', 'The prediction has already ended.');
    try {
      const { api, userId } = this.api();
      this.emit(helixPrediction(await api.resolvePrediction(userId, current.id, outcome.id)));
    } catch (error) { throw twitchError(error); }
  }

  async cancelPrediction(_reason: string): Promise<void> {
    if (!this.managedId) return;
    const current = await this.managed();
    if (!current || !['ACTIVE', 'LOCKED'].includes(current.status)) return;
    try {
      const { api, userId } = this.api();
      this.emit(helixPrediction(await api.cancelPrediction(userId, current.id)));
    } catch (error) { throw twitchError(error); }
  }

  async say(_text: string): Promise<void> { /* This connector never sends chat messages. */ }
}
