import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TWITCH_SCOPES, type TwitchAuth } from './auth';

const STATE_TTL_MS = 10 * 60 * 1000;
const COOKIE = 'chaos_oauth_state';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export class OAuthStates {
  private pending = new Map<string, number>();
  constructor(private clock = Date.now) {}

  issue(): string {
    for (const [key, until] of this.pending) if (until < this.clock()) this.pending.delete(key);
    if (this.pending.size >= 100) this.pending.delete(this.pending.keys().next().value!);
    const state = randomBytes(32).toString('hex');
    this.pending.set(hash(state), this.clock() + STATE_TTL_MS);
    return state;
  }

  consume(value: unknown, cookie: string | undefined): boolean {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)
      || !cookie || !/^[a-f0-9]{64}$/.test(cookie)) return false;
    const key = hash(value);
    const until = this.pending.get(key);
    if (!until || until < this.clock() || !timingSafeEqual(Buffer.from(value), Buffer.from(cookie))) return false;
    this.pending.delete(key);
    return true;
  }
}

function local(request: FastifyRequest): boolean {
  return request.ip === '127.0.0.1' || request.ip === '::1' || request.ip === '::ffff:127.0.0.1';
}

function cookie(request: FastifyRequest): string | undefined {
  return request.headers.cookie?.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
}

function protect(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store').header('referrer-policy', 'no-referrer');
}

/** Canonical localhost URLs keep the HttpOnly state cookie on one host. */
export function registerOAuth(app: FastifyInstance, auth: TwitchAuth, states = new OAuthStates()): void {
  const redirect = new URL(auth.settings.redirectUri);
  const flags = `HttpOnly; SameSite=Lax; Path=/auth${redirect.protocol === 'https:' ? '; Secure' : ''}`;
  app.get('/auth/login', { logLevel: 'silent' }, async (request, reply) => {
    protect(reply);
    if (!local(request)) return reply.code(403).send({ error: 'Connect Twitch on the host computer.' });
    if (!auth.configured) return reply.code(503).send({ error: 'Configure the Twitch app credentials first.' });
    if (auth.flow === 'device') return reply.redirect('/dashboard?twitch=connect');
    if (request.headers.host !== redirect.host) return reply.redirect(new URL('/auth/login', redirect).href);
    const state = states.issue();
    reply.header('set-cookie', `${COOKIE}=${state}; ${flags}; Max-Age=${STATE_TTL_MS / 1000}`);
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.search = new URLSearchParams({ response_type: 'code', client_id: auth.settings.clientId,
      redirect_uri: redirect.href, scope: TWITCH_SCOPES.join(' '), state, force_verify: 'true' }).toString();
    return reply.redirect(url.href);
  });

  // Silence the route logger: incoming callback URLs contain authorization codes.
  app.get('/auth/callback', { logLevel: 'silent' }, async (request, reply) => {
    protect(reply);
    reply.header('set-cookie', `${COOKIE}=; ${flags}; Max-Age=0`);
    if (!local(request)) return reply.code(403).send({ error: 'Local callback required.' });
    const query = request.query as Record<string, unknown>;
    if (request.headers.host !== redirect.host || !states.consume(query.state, cookie(request)))
      return reply.code(400).send({ error: 'Login expired or did not match this browser. Try Connect Twitch again.' });
    if (query.error) return reply.redirect('/dashboard?twitch=denied');
    if (typeof query.code !== 'string' || !query.code || query.code.length > 2048)
      return reply.code(400).send({ error: 'Missing Twitch authorization code.' });
    try {
      await auth.authorize(query.code);
      return reply.redirect('/dashboard?twitch=connected');
    } catch {
      return reply.redirect('/dashboard?twitch=failed');
    }
  });
}
