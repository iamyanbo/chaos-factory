import { newViewerProfile, parseChat, type ChatMessage, type Message } from '@chaos/shared';
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
    d.canPredict = message.canPredict;
    if (message.mode === 'live' && d.bridgeMode !== 'live') {
      if (!d.roundStartChosen) d.roundStart = 'manual';
      d.mockCount = 0;
      d.participants = new Participants();
      refreshPreview = true;
    }
    d.bridgeMode = message.mode;
    if (refreshPreview && ['ATTRACT', 'INTRO', 'LOBBY_BET'].includes(d.phase)) d.preview(false);
    if (!message.canPredict) d.noWagers = true;
  } else if (message.type === 'mock.status') {
    d.mockCount = message.viewers;
    if (d.phase === 'ATTRACT' && d.cup.round === 0) {
      d.participants = new Participants();
      d.participants.fill(message.viewers, d.clock);
      d.preview(false);
    }
  } else if (message.type === 'profiles.snapshot') {
    Object.assign(d.profiles, message.users);
    d.profileCrownId = message.crownUserId;
    if (!d.cupShow.crownUserId || ['ATTRACT', 'CUP_RESULTS'].includes(d.phase)) d.cupShow.crownUserId = message.crownUserId;
    Object.assign(d.cupShow.lastWinners, message.lastWinners ?? {});
    if (['ATTRACT', 'INTRO', 'LOBBY_BET'].includes(d.phase)) d.preview(false);
  } else if (message.type === 'stats.snapshot') d.stats = message.users;
  else if (message.type === 'prediction.update') {
    const titlesMatch = message.outcomes.map(outcome => outcome.title).join('|') === d.predictionTitles.join('|');
    if (!titlesMatch || d.prediction && d.prediction.id !== message.id) return;
    d.prediction = message;
    if (['RESOLVED', 'CANCELED'].includes(message.status) && !d.predictions.some(item => item.id === message.id)) d.predictions.push(message);
  } else if (message.type === 'prediction.error') {
    d.noWagers = true;
    d.notify(`NO WAGERS THIS ROUND - ${message.code}`);
    d.hooks.send({ type: 'prediction.cancel', reason: 'Prediction unavailable - refund our round', roundId: d.roundId });
  }
}

export function handleChat(d: Director, message: ChatMessage): void {
  const parsed = parseChat(message.text);
  if (!parsed) return;
  if (parsed.kind === 'join') {
    const existed = d.participants.members.has(message.userId);
    const profile = d.profiles[message.userId] ?? newViewerProfile(message);
    const member = d.participants.join({ userId: message.userId, login: message.login,
      displayName: message.displayName, color: profile.color, title: profile.title, level: profile.level }, d.clock, parsed.teamId);
    if (profile.wins && !d.seenReturns.has(member.userId)) {
      d.notify(`@${member.displayName} is back: ${profile.wins} wins`);
      d.seenReturns.add(member.userId);
    }
    if (['ATTRACT', 'INTRO', 'LOBBY_BET'].includes(d.phase)) {
      if (!existed) d.preview(false);
      if (!existed && (d.ctx?.setup.participants.length ?? 0) >= d.capacity && !d.game.spectator) {
        const admitted = d.ctx?.setup.participants.some(user => user.userId === member.userId);
        if (!admitted) d.notify(`@${member.displayName} - WAITING #${d.queuePosition(member.userId)}`);
      }
    } else if (!existed) d.notify(`@${member.displayName} - WAITING #${d.queuePosition(member.userId)} - NEXT ROUND`);
    d.participants.crowd = Math.max(0, d.participants.members.size - (d.ctx?.setup.participants.length ?? 0));
    return;
  }
}
