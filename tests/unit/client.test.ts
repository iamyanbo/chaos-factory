import { expect,test,vi } from 'vitest';
import { Client } from '../../apps/show/src/net/client';
test('disconnected commands are not replayed after a new handshake', () => {
  class Socket {
    static OPEN = 1;
    static instance: Socket;
    readyState = 0;
    sent: string[] = [];
    onopen?: () => void;
    constructor() { Socket.instance = this; }
    send(message: string) { this.sent.push(message); }
    close() { this.readyState = 3; }
  }
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
  const client = new Client('dashboard');
  try {
    expect(client.send({ type: 'director.command', cmd: 'start' })).toBe(false);
    Socket.instance.readyState = 1;
    Socket.instance.onopen!();
    expect(Socket.instance.sent.map(message => JSON.parse(message).type)).toEqual(['hello']);
    expect(client.send({ type: 'director.command', cmd: 'start' })).toBe(true);
    expect(Socket.instance.sent).toHaveLength(2);
  } finally { client.destroy(); vi.unstubAllGlobals(); }
});
