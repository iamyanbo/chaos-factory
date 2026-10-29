import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AccessToken } from '@twurple/auth';
import { TwitchAuth, TWITCH_SCOPES } from './auth';
import { BridgeError } from './bridge';

export const publicClientId = z.string().trim().regex(/^[a-zA-Z0-9]{8,100}$/);
const MIN_POLL_MS = 5000;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_LIFETIME_MS = 30 * 60 * 1000;
const deviceReply = z.object({ device_code: z.string().min(1).max(2048),
  user_code: z.string().min(1).max(40), verification_uri: z.string().url(),
  expires_in: z.number().int().positive(), interval: z.number().positive() });
const tokenReply = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1),
  expires_in: z.number().positive(), scope: z.array(z.string()) });

export interface DeviceStatus {
  state: 'waiting' | 'authorizing' | 'connected' | 'expired' | 'canceled' | 'error';
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  message?: string;
}
interface Session extends DeviceStatus {
  owner: string;
  deviceCode: string;
  interval: number;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  expiry?: ReturnType<typeof setTimeout>;
}
class DeviceFailure extends Error {
  constructor(readonly code: string) { super('Twitch authorization could not complete.'); }
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** One browser-bound grant. Only the verification URL and user code leave this class. */
export class DeviceLogin {
  private session?: Session;
  private starting = false;
  private closed = false;
  private startingRequest?: AbortController;

  constructor(private auth: TwitchAuth) {}

  private async request(path: 'device' | 'token', values: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`https://id.twitch.tv/oauth2/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch { throw new DeviceFailure('unavailable'); }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new DeviceFailure('unavailable'); }
    if (!response.ok) {
      const message = typeof body === 'object' && body && 'message' in body ? String(body.message) : '';
      if (['authorization_pending', 'slow_down', 'access_denied', 'expired_token', 'invalid device code'].includes(message))
        throw new DeviceFailure(message);
      throw new DeviceFailure(response.status === 429 ? 'slow_down' : response.status >= 500 ? 'unavailable' : 'rejected');
    }
    return body;
  }

  status(owner: string): DeviceStatus | undefined {
    const session = this.session;
    if (!session || session.owner !== hash(owner)) return;
    return { state: session.state, userCode: session.userCode, verificationUri: session.verificationUri,
      expiresAt: session.expiresAt, message: session.message };
  }

  async start(owner: string, clientId?: string): Promise<DeviceStatus> {
    const current = this.session;
    if (this.closed) throw new BridgeError('CLOSED', 'The Twitch bridge is shutting down.');
    if (this.auth.user) throw new BridgeError('ALREADY_CONNECTED', 'Twitch is already authorized.');
    if (current && ['waiting', 'authorizing'].includes(current.state)) {
      const existing = this.status(owner);
      if (existing) return existing;
      throw new BridgeError('CONNECT_PENDING', 'Finish the Twitch login already open in another local tab.');
    }
    if (this.starting) throw new BridgeError('CONNECT_PENDING', 'A Twitch login is already starting.');
    const id = this.auth.settings.clientId || clientId;
    if (!id) throw new BridgeError('CLIENT_REQUIRED', 'Enter the Client ID of your public Twitch app.');
    if (this.auth.configured && clientId && id !== clientId)
      throw new BridgeError('CLIENT_MISMATCH', 'Use the Twitch app already saved for this show.');
    this.starting = true;
    this.startingRequest = new AbortController();
    try {
      const result = deviceReply.parse(await this.request('device', { client_id: id, scopes: TWITCH_SCOPES.join(' ') },
        this.startingRequest.signal));
      const upstream = new URL(result.verification_uri);
      if (upstream.protocol !== 'https:' || !['www.twitch.tv', 'twitch.tv'].includes(upstream.hostname)
        || upstream.port || !/^\/activate\/?$/.test(upstream.pathname)) throw new DeviceFailure('rejected');
      if (this.closed) throw new DeviceFailure('unavailable');
      if (!this.auth.configured) await this.auth.configurePublicClient(id, () => !this.closed);
      if (this.closed) throw new DeviceFailure('unavailable');
      const verification = new URL('https://www.twitch.tv/activate');
      verification.searchParams.set('public', upstream.searchParams.get('public') === 'false' ? 'false' : 'true');
      verification.searchParams.set('device-code', result.user_code);
      const session: Session = { owner: hash(owner), state: 'waiting', deviceCode: result.device_code,
        userCode: result.user_code, verificationUri: verification.href,
        expiresAt: Date.now() + Math.min(MAX_LIFETIME_MS, result.expires_in * 1000),
        interval: Math.max(MIN_POLL_MS, result.interval * 1000), abort: new AbortController() };
      this.session = session;
      session.expiry = setTimeout(() => this.finish(session, 'expired', 'Twitch login expired. Connect again.'),
        session.expiresAt - Date.now());
      session.expiry.unref();
      this.schedule(session);
      return this.status(owner)!;
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      throw new BridgeError('DEVICE_START_FAILED',
        'Twitch could not start login. Check the public Client ID and your connection, then retry.');
    } finally { this.starting = false; this.startingRequest = undefined; }
  }

  private schedule(session: Session): void {
    session.timer = setTimeout(() => { void this.poll(session); }, session.interval);
    session.timer.unref();
  }

  private async poll(session: Session): Promise<void> {
    const active = () => !this.closed && this.session === session && ['waiting', 'authorizing'].includes(session.state);
    if (!active()) return;
    if (Date.now() >= session.expiresAt) { this.finish(session, 'expired', 'Twitch login expired. Connect again.'); return; }
    try {
      const response = tokenReply.parse(await this.request('token', {
        client_id: this.auth.settings.clientId, device_code: session.deviceCode,
        scopes: TWITCH_SCOPES.join(' '), grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }, session.abort.signal));
      if (!active()) return;
      session.state = 'authorizing';
      const token: AccessToken = { accessToken: response.access_token, refreshToken: response.refresh_token,
        scope: response.scope, expiresIn: response.expires_in, obtainmentTimestamp: Date.now() };
      await this.auth.authorizeDevice(token, active);
      if (active()) this.finish(session, 'connected', 'Authorized. Twitch chat is connecting.');
    } catch (error) {
      if (!active()) return;
      if (error instanceof DeviceFailure && ['authorization_pending', 'slow_down', 'unavailable'].includes(error.code)) {
        if (error.code !== 'authorization_pending') session.interval = Math.min(60000, session.interval + MIN_POLL_MS);
        this.schedule(session);
      } else this.finish(session, 'error', error instanceof BridgeError ? error.message
        : error instanceof DeviceFailure && error.code === 'access_denied' ? 'Twitch authorization was declined. Connect again.'
          : 'Twitch login could not complete. Connect again and approve the requested permissions.');
    }
  }

  private finish(session: Session, state: DeviceStatus['state'], message?: string): void {
    if (this.session !== session || !['waiting', 'authorizing'].includes(session.state)) return;
    session.state = state;
    session.message = message;
    session.deviceCode = '';
    session.abort.abort();
    if (session.timer) clearTimeout(session.timer);
    if (session.expiry) clearTimeout(session.expiry);
  }

  cancel(owner: string): boolean {
    if (this.status(owner)?.state !== 'waiting') return false;
    this.finish(this.session!, 'canceled', 'Twitch login canceled.');
    return true;
  }

  close(): void {
    if (this.session) this.finish(this.session, 'canceled');
    this.closed = true;
    this.startingRequest?.abort();
  }
}
