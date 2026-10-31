import { parseChat, stableViewerColor, type ChatMessage, type Message } from '@chaos/shared';
import type { Director } from './director';
import { Participants } from './participants';

export function receiveMessage(d: Director, message: Message): void {
  if (message.type === 'chat') handleChat(d, message);
  else if (message.type === 'director.command') d.command(message);
  else if (message.type === 'twitch.status') {
    const name = message.mode === 'live' && (message.authenticated || message.connected)
      ? message.displayName || message.channel : 'Streamer';
    let refreshPreview = name !== d.streamerName;
    d.streamerName = name;
    if (message.mode === 'live' && d.bridgeMode !== 'live') {
      if (!d.roundStartChosen) d.roundStart = 'manual';
      d.mockCount = 0;
      d.participants = new Participants();
      refreshPreview = true;
    }
    d.bridgeMode = message.mode;
    if (refreshPreview && ['ATTRACT', 'INTRO', 'LOBBY'].includes(d.phase)) d.preview(false);
  } else if (message.type === 'mock.status') {
    d.mockCount = message.viewers;
    if (d.phase === 'ATTRACT') {
      d.participants = new Participants();
      d.participants.fill(message.viewers, d.clock);
      d.preview(false);
    }
  }
}

export function handleChat(d: Director, message: ChatMessage): void {
  const parsed = parseChat(message.text);
  if (parsed?.kind !== 'join') return;
  const existed = d.participants.members.has(message.userId);
  const member = d.participants.join({ userId: message.userId, login: message.login,
    displayName: message.displayName, color: stableViewerColor(message.userId) }, d.clock, parsed.teamId);
  if (['ATTRACT', 'INTRO', 'LOBBY'].includes(d.phase)) {
    if (!existed) d.preview(false);
    const admitted = d.ctx?.setup.participants.some(user => user.userId === member.userId);
    if (!existed && !admitted && !d.game.spectator) {
      d.notify(`@${member.displayName} · waiting #${d.queuePosition(member.userId)}`);
    }
  } else if (!existed) {
    d.notify(`@${member.displayName} · next round · #${d.queuePosition(member.userId)}`);
  }
  d.participants.crowd = Math.max(0, d.participants.members.size - (d.ctx?.setup.participants.length ?? 0));
}
