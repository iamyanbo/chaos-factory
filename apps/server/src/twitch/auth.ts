import { ApiClient, type HelixUser } from '@twurple/api';
import { RefreshingAuthProvider, getTokenInfo, InvalidTokenError, CachedRefreshFailureError,
  type AccessToken } from '@twurple/auth';
import type { JsonStore } from '../storage';
import { BridgeError } from './bridge';
import { twitchError } from './errors';

declare module '@twurple/api-call' {
  interface TwitchApiCallFetchOptions { signal?: AbortSignal }
}

export const TWITCH_SCOPES = ['user:read:chat'];
export const VALIDATE_INTERVAL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;
export interface AuthSettings { clientId: string; clientSecret: string; redirectUri: string; deviceFlow?: boolean }
interface SavedToken { clientId?: string; userId: string; token: AccessToken }

/** The only owner of Twitch credentials. Public status never includes these fields. */
export class TwitchAuth {
  provider?: RefreshingAuthProvider;
  api?: ApiClient;
  user?: HelixUser;
  userId?: string;
  lastError?: string;
  onReady: () => Promise<void> = async () => {};
  onLost: () => void = () => {};
  private timer?: ReturnType<typeof setInterval>;
  private validation?: Promise<void>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private authorizationGuard?: () => boolean;

  constructor(readonly settings: AuthSettings, private store: JsonStore) {
    this.initialize();
  }

  private initialize(): void {
    if (!this.configured) return;
    this.provider = new RefreshingAuthProvider({ ...this.settings,
      clientSecret: this.settings.clientSecret || undefined });
    this.api = new ApiClient({ authProvider: this.provider, logger: { minLevel: 'critical' },
      fetchOptions: { get signal() { return AbortSignal.timeout(REQUEST_TIMEOUT_MS); } } });
    this.provider.onRefresh((userId, token) => {
      void this.store.write('tokens.json', { clientId: this.settings.clientId, userId, token })
        .catch(() => this.lose('Token persistence failed.'));
    });
    this.provider.onRefreshFailure(() => this.lose('Twitch authorization expired. Reconnect Twitch.'));
  }

  get configured(): boolean { return Boolean(this.settings.clientId); }
  get flow(): 'device' | 'code' { return this.settings.deviceFlow || !this.settings.clientSecret ? 'device' : 'code'; }

  async configurePublicClient(clientId: string, current = () => true): Promise<void> {
    if (this.configured) throw new BridgeError('ALREADY_CONFIGURED', 'The Twitch app is already configured.');
    await this.store.write('twitch-client.json', { clientId });
    if (!current()) throw new BridgeError('CLOSED', 'The Twitch bridge is shutting down.');
    this.settings.clientId = clientId;
    this.settings.clientSecret = '';
    this.settings.deviceFlow = true;
    this.initialize();
    await this.connect();
  }

  async connect(): Promise<void> {
    this.stopped = false;
    if (!this.configured) {
      this.lastError = 'Enter your public Twitch Client ID on the dashboard to connect.';
      return;
    }
    const saved = await this.store.read<SavedToken | null>('tokens.json', null);
    if (saved?.userId && saved.token?.accessToken && saved.token.refreshToken
      && (!saved.clientId || saved.clientId === this.settings.clientId)) {
      this.userId = saved.userId;
      try {
        this.provider!.addUser(saved.userId, saved.token);
        await this.validate();
      } catch { this.lose('Reconnect Twitch to authorize this channel.'); }
    } else this.lastError = 'Connect Twitch from the dashboard.';
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => { void this.validate().catch(() => {}); }, VALIDATE_INTERVAL_MS);
    this.timer.unref();
  }

  async authorize(code: string): Promise<void> {
    if (!this.provider) throw new BridgeError('NOT_CONFIGURED', 'Twitch app credentials are not configured.');
    try {
      await this.validation?.catch(() => {});
      this.userId = await this.provider.addUserForCode(code);
      await this.validate();
    } catch {
      this.lose('Twitch login failed. Try Connect Twitch again.');
      throw new BridgeError('AUTH_FAILED', this.lastError!);
    }
  }

  /** Device grants enter here on the server; neither token is exposed to the UI. */
  async authorizeDevice(token: AccessToken, current: () => boolean): Promise<void> {
    if (!this.provider) throw new BridgeError('NOT_CONFIGURED', 'Enter your Twitch Client ID first.');
    await this.validation?.catch(() => {});
    const info = await getTokenInfo(token.accessToken, this.settings.clientId);
    if (!info.userId || info.clientId !== this.settings.clientId
      || TWITCH_SCOPES.some(scope => !info.scopes.includes(scope)))
      throw new BridgeError('SCOPES_REQUIRED', 'Approve the requested Twitch permissions and try again.');
    if (this.userId && info.userId !== this.userId)
      throw new BridgeError('ACCOUNT_MISMATCH', 'Sign in as the broadcaster already connected to this app.');
    if (!current()) return;
    this.stopped = false;
    this.authorizationGuard = current;
    this.userId = info.userId;
    this.provider.addUser(info.userId, token);
    try { await this.validate(); }
    finally {
      this.authorizationGuard = undefined;
      if (!current()) {
        this.provider.removeUser(info.userId);
        this.user = undefined;
        this.onLost();
      }
    }
  }

  validate(): Promise<void> {
    if (this.validation) return this.validation;
    if (!this.provider || !this.userId) return Promise.resolve();
    const work = this.check();
    this.validation = work.finally(() => { this.validation = undefined; });
    return this.validation;
  }

  private async check(): Promise<void> {
    if (this.stopped) return;
    try {
      const token = await this.provider!.getAccessTokenForUser(this.userId!);
      if (!token) throw new BridgeError('AUTH_REQUIRED', 'Reconnect Twitch.');
      const info = await getTokenInfo(token.accessToken, this.settings.clientId);
      if (info.userId !== this.userId || info.clientId !== this.settings.clientId
        || TWITCH_SCOPES.some(scope => !info.scopes.includes(scope)))
        throw new BridgeError('SCOPES_REQUIRED', 'Reconnect Twitch to grant the required permissions.');
      const user = await this.api!.users.getUserById(this.userId);
      if (!user) throw new BridgeError('AUTH_REQUIRED', 'Reconnect Twitch.');
      if (this.stopped || this.authorizationGuard && !this.authorizationGuard()) return;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      this.user = user;
      this.lastError = undefined;
      await this.store.write('tokens.json', { clientId: this.settings.clientId, userId: this.userId, token });
      if (this.stopped || this.authorizationGuard && !this.authorizationGuard()) {
        this.user = undefined;
        return;
      }
      await this.onReady();
    } catch (error) {
      this.lose('Twitch authorization is unavailable. Reconnect Twitch.');
      const failure = twitchError(error);
      const invalid = error instanceof InvalidTokenError || error instanceof CachedRefreshFailureError;
      if (failure.retryable && !invalid && !this.stopped && !this.retryTimer) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = undefined;
          void this.validate().catch(() => {});
        }, 15000);
        this.retryTimer.unref();
      }
      throw new BridgeError('AUTH_REQUIRED', this.lastError!);
    }
  }

  lose(message: string): void {
    this.lastError = message;
    this.user = undefined;
    this.onLost();
  }

  disconnect(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.timer = undefined;
    this.onLost();
  }
}
