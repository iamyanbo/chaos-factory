import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TwitchAuth } from './auth';
import { BridgeError } from './bridge';
import { DeviceLogin, publicClientId } from './device-login';

const COOKIE = 'chaos_device_login';
const startBody = z.object({ clientId: publicClientId.optional() }).strict();
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
function setOwner(reply: FastifyReply, value: string): void {
  reply.header('set-cookie', `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/auth/device; Max-Age=1800`);
}

function protect(request: FastifyRequest, reply: FastifyReply): boolean {
  reply.header('cache-control', 'no-store').header('referrer-policy', 'no-referrer');
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip);
  try {
    const host = new URL(`http://${request.headers.host}`);
    const origin = request.headers.origin ? new URL(request.headers.origin) : undefined;
    if (local && LOOPBACK.has(host.hostname) && (!origin || origin.host === host.host
      && ['http:', 'https:'].includes(origin.protocol)) && (request.method === 'GET' || origin)) return true;
  } catch { /* Reject malformed Host and Origin headers. */ }
  reply.code(403).send({ error: 'Connect Twitch from the dashboard on this computer.' });
  return false;
}

function owner(request: FastifyRequest): string {
  const value = request.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : '';
}

export function registerDeviceLogin(app: FastifyInstance, auth: TwitchAuth, publish = () => {}): DeviceLogin {
  const login = new DeviceLogin(auth);
  app.post('/auth/device/start', { logLevel: 'silent' }, async (request, reply) => {
    if (!protect(request, reply)) return;
    const body = startBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Enter the Client ID of your public Twitch app.' });
    const sessionOwner = owner(request) || randomBytes(32).toString('hex');
    try {
      const status = await login.start(sessionOwner, body.data.clientId);
      publish();
      setOwner(reply, sessionOwner);
      return status;
    } catch (error) {
      const code = error instanceof BridgeError ? error.code : '';
      return reply.code(['CONNECT_PENDING', 'ALREADY_CONNECTED', 'CLIENT_MISMATCH'].includes(code) ? 409 : 400)
        .send({ error: error instanceof BridgeError ? error.message : 'Twitch login could not start. Retry from the dashboard.' });
    }
  });
  app.get('/auth/device/status', { logLevel: 'silent' }, async (request, reply) => {
    if (!protect(request, reply)) return;
    const identity = owner(request) || randomBytes(32).toString('hex');
    if (!owner(request)) setOwner(reply, identity);
    return login.status(identity) || { state: 'idle' };
  });
  app.post('/auth/device/cancel', { logLevel: 'silent' }, async (request, reply) => {
    if (!protect(request, reply)) return;
    if (!owner(request) || !login.cancel(owner(request)))
      return reply.code(409).send({ error: 'Authorization is already finishing or this login belongs to another tab.' });
    return { state: 'canceled' };
  });
  app.addHook('preClose', async () => login.close());
  return login;
}
