import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import { hostname } from 'node:os';
import { messageSchema, type Message, type DirectorState } from '@chaos/shared';
type Role = 'show' | 'dashboard' | 'controller';
const permissions: Record<Role, string[]> = {
  show: ['prediction.create', 'prediction.lock', 'prediction.resolve', 'prediction.cancel', 'round.record', 'director.state', 'ping'],
  dashboard: ['director.command', 'mock.chat', 'mock.swarm', 'ping'], controller: ['streamer.input', 'ping']
};
export class Hub {
  private clients = new Map<WebSocket, Role>(); private show?: WebSocket;
  state?: DirectorState;
  readonly wss: WebSocketServer;
  onMessage: (m: Message, role: Role) => void = () => {};
  onHello: (send: (m: Message) => void) => void = () => {};
  onShowDisconnect: () => void = () => {};
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2 * 1024 * 1024 });
    this.wss.on('connection', (socket, request) => {
      // A matching forged Host/Origin pair must not bypass the local-app boundary.
      try {
        const host = new URL(`http://${request.headers.host}`).hostname.toLowerCase();
        const localAddress = request.socket.localAddress?.replace(/^::ffff:/, '').toLowerCase();
        if (!new Set(['localhost', '127.0.0.1', '::1', '[::1]', hostname().toLowerCase(), localAddress]).has(host)) {
          socket.close(1008, 'Untrusted host');
          return;
        }
      } catch { socket.close(1008, 'Invalid host'); return; }
      // Local/LAN clients must originate on the same host; refuse third-party browser pages.
      if (request.headers.origin) {
        try { if (new URL(request.headers.origin).hostname !== new URL(`http://${request.headers.host}`).hostname) { socket.close(1008, 'Origin mismatch'); return; } }
        catch { socket.close(1008, 'Invalid origin'); return; }
      }
      const timer = setTimeout(() => { if (!this.clients.has(socket)) socket.close(1008, 'Hello required'); }, 5000);
      let count = 0; let windowStart = Date.now();
      socket.on('message', raw => {
        if (Date.now() - windowStart > 1000) { count = 0; windowStart = Date.now(); }
        if (++count > 180) { socket.close(1008, 'Rate limit'); return; }
        try {
          const parsed = messageSchema.safeParse(JSON.parse(raw.toString()));
          if (!parsed.success) return;
          const m = parsed.data;
          if (m.type === 'hello') {
            if (this.clients.has(socket)) return;
            if (m.role === 'show' && this.show?.readyState === WebSocket.OPEN) { socket.close(4001, 'A show is already running'); return; }
            this.clients.set(socket, m.role); if (m.role === 'show') this.show = socket;
            clearTimeout(timer); this.onHello(msg => this.send(socket, msg));
            if (this.state) this.send(socket, this.state);
            return;
          }
          const role = this.clients.get(socket); if (!role || !permissions[role].includes(m.type)) return;
          if (m.type === 'ping') { this.send(socket, { type: 'pong', at: m.at }); return; }
          if (m.type === 'director.state') { this.state = m; this.broadcast(m, ['dashboard', 'controller']); }
          if (m.type === 'director.command' || m.type === 'streamer.input') this.broadcast(m, ['show']);
          this.onMessage(m, role);
        } catch { /* Invalid packets cannot take down the stream. */ }
      });
      socket.on('error', () => {});
      socket.on('close', () => { clearTimeout(timer); this.clients.delete(socket); if (this.show === socket) { this.show = undefined; this.onShowDisconnect(); } });
    });
  }
  private send(socket: WebSocket, m: Message): void { if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 4 * 1024 * 1024) socket.send(JSON.stringify(m)); }
  broadcast(m: Message, roles?: Role[]): void { for (const [socket, role] of this.clients) if (!roles || roles.includes(role)) this.send(socket, m); }
  close(): void { for (const socket of this.clients.keys()) socket.close(); this.wss.close(); }
}
