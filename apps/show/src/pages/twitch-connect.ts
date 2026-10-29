import type { Message } from '@chaos/shared';

type Status = Extract<Message, { type: 'twitch.status' }>;
interface Login { state: string; userCode?: string; verificationUri?: string; expiresAt?: number; message?: string }
const POLL_MS = 1500;

/** Public app ID in, Twitch consent out. Tokens never enter this page. */
export class TwitchConnect {
  readonly root = document.createElement('div');
  private form: HTMLFormElement;
  private input: HTMLInputElement;
  private setup: HTMLElement;
  private start: HTMLButtonElement;
  private progress: HTMLElement;
  private message: HTMLElement;
  private code: HTMLElement;
  private authorize: HTMLAnchorElement;
  private cancel: HTMLButtonElement;
  private popup: Window | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private configured = false;
  private busy = false;
  private resumed = false;
  private destroyed = false;
  private readiness: Promise<void> = Promise.resolve();

  constructor() {
    const registrationUri = new URL('/auth/callback', location.origin);
    registrationUri.protocol = 'https:';
    this.root.className = 'twitch-connect';
    this.root.innerHTML = `<form class="twitch-connect-form">
      <div class="twitch-first-time"><p>One-time setup: register a <strong>Public</strong> Twitch app, then paste its Client ID here.</p>
        <details><summary>Register the app</summary><ol>
          <li>Open <a href="https://dev.twitch.tv/console/apps/create" target="_blank" rel="noopener noreferrer">Twitch app registration ↗</a>. Choose a unique name, Game Integration, and <strong>Public</strong> client type.</li>
          <li>If Twitch asks for a redirect URL, enter <code>${registrationUri.href}</code>. Our Public app uses Device Code Flow and never visits that address; no HTTPS server is needed.</li>
          <li>Copy the app’s <strong>Client ID</strong> below. You don’t need a client secret or access token.</li>
        </ol></details>
        <label class="twitch-client-label" for="twitch-client-id">Client ID (public)
          <input id="twitch-client-id" name="clientId" autocomplete="off" spellcheck="false" maxlength="100" pattern="[A-Za-z0-9]{8,100}" placeholder="Paste your Twitch app Client ID" required>
        </label>
      </div><button class="button primary" type="submit">Connect Twitch</button>
      <p class="muted small">Sign in as the broadcaster. Twitch handles consent; this app saves and refreshes authorization on this computer.</p>
    </form><div class="twitch-auth-progress" hidden>
      <p class="twitch-auth-message" role="status"></p><strong class="twitch-user-code"></strong>
      <div class="button-row"><a class="button primary twitch-authorize" target="_blank" rel="noopener noreferrer">Authorize on Twitch ↗</a>
        <button class="button twitch-cancel" type="button">Cancel login</button></div>
    </div>`;
    this.form = this.root.querySelector('form')!;
    this.input = this.root.querySelector('input')!;
    this.setup = this.root.querySelector('.twitch-first-time')!;
    this.start = this.root.querySelector('button[type=submit]')!;
    this.progress = this.root.querySelector('.twitch-auth-progress')!;
    this.message = this.root.querySelector('.twitch-auth-message')!;
    this.code = this.root.querySelector('.twitch-user-code')!;
    this.authorize = this.root.querySelector('.twitch-authorize')!;
    this.cancel = this.root.querySelector('.twitch-cancel')!;
    this.form.onsubmit = event => { event.preventDefault(); void this.connect(); };
    this.cancel.onclick = () => { void this.cancelLogin(); };
    addEventListener('beforeunload', () => this.destroy(), { once: true });
  }

  update(status: Status): void {
    const enabled = status.mode === 'live' && status.authFlow === 'device';
    this.root.hidden = !enabled || Boolean(status.authenticated);
    this.configured = Boolean(status.configured);
    this.setup.hidden = this.configured;
    this.input.required = !this.configured;
    if (status.authenticated) this.finish();
    if (enabled && !status.authenticated && !this.resumed) {
      this.resumed = true;
      this.readiness = this.resume();
    }
  }

  private async request(path: string, body?: object): Promise<Login> {
    const response = await fetch(`/auth/device/${path}`, { method: body ? 'POST' : 'GET',
      cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    const value = await response.json();
    if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Twitch login could not complete.');
    return value as Login;
  }

  private async connect(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.start.disabled = true;
    this.popup = window.open('about:blank', 'chaos-factory-twitch', 'popup,width=720,height=850');
    if (this.popup) this.popup.document.body.textContent = 'Opening Twitch authorization…';
    try {
      await this.readiness;
      await this.request('status');
      const status = await this.request('start', this.configured ? {} : { clientId: this.input.value.trim() });
      this.show(status);
      if (status.verificationUri && this.popup && !this.popup.closed) this.popup.location.replace(status.verificationUri);
      this.poll();
    } catch (error) {
      this.popup?.close();
      this.fail(error);
    }
  }

  private async resume(): Promise<void> {
    try {
      const status = await this.request('status');
      if (['waiting', 'authorizing'].includes(status.state)) { this.show(status); this.poll(); }
    } catch { /* A disconnected bridge is already shown by the dashboard. */ }
  }

  private show(status: Login): void {
    const waiting = ['waiting', 'authorizing'].includes(status.state);
    this.busy = waiting;
    this.start.disabled = waiting;
    this.form.hidden = waiting;
    this.progress.hidden = false;
    this.message.textContent = status.message ?? (status.state === 'authorizing'
      ? 'Authorized. Connecting your channel…' : 'Approve the connection in Twitch. This page will update automatically.');
    this.code.textContent = status.userCode ?? '';
    this.code.hidden = !waiting;
    this.authorize.hidden = status.state !== 'waiting' || !status.verificationUri;
    if (status.verificationUri) {
      const url = new URL(status.verificationUri);
      if (url.origin !== 'https://www.twitch.tv' || url.pathname !== '/activate') throw new Error('Unexpected Twitch login address.');
      this.authorize.href = url.href;
    }
    this.cancel.hidden = !waiting;
    this.cancel.disabled = status.state === 'authorizing';
    if (!waiting) this.finish();
  }

  private poll(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.destroyed || !this.busy) return;
    this.timer = setTimeout(() => {
      void this.request('status').then(status => {
        if (status.state === 'idle') { this.fail(new Error('Twitch login expired. Connect again.')); return; }
        this.show(status);
        if (this.busy) this.poll();
      }).catch(error => this.fail(error));
    }, POLL_MS);
  }

  private async cancelLogin(): Promise<void> {
    try {
      const status = await this.request('cancel', {});
      this.show({ ...status, message: 'Twitch login canceled.' });
    } catch (error) {
      this.message.textContent = error instanceof Error ? error.message : 'Authorization is finishing.';
      this.poll();
    }
  }

  private fail(error: unknown): void {
    this.message.textContent = error instanceof Error ? error.message : 'Twitch is unavailable. Retry from this page.';
    this.progress.hidden = false;
    this.code.hidden = this.authorize.hidden = this.cancel.hidden = true;
    this.form.hidden = false;
    this.finish();
  }

  private finish(): void {
    this.busy = false;
    this.start.disabled = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.popup && !this.popup.closed) this.popup.close();
    this.popup = null;
  }

  private destroy(): void {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
