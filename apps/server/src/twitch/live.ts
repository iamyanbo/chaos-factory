import { EventSubWsListener } from '@twurple/eventsub-ws';
import { parseChat } from '@chaos/shared';
import type { TwitchBridge, TwitchStatus } from './bridge';
import { TwitchAuth } from './auth';
import { eventChat } from './mapping';

export class LiveBridge implements TwitchBridge {
  onChat: TwitchBridge['onChat'] = () => {};
  onStatus: (status: TwitchStatus) => void = () => {};
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
      this.connected = socketReady && subscribed.has('channel.chat.message');
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
      this.lastError = 'Twitch chat could not connect. Reconnecting; the round continues.';
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
      lastError: this.auth.lastError ?? this.lastError,
      loginUrl: new URL('/auth/login', this.auth.settings.redirectUri).href
    };
  }

  private publishStatus(): void { this.onStatus(this.status()); }
}
