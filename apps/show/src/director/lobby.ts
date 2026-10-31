import type { Director } from './director';

export const START_COUNTDOWN_SECONDS = 3;
export const JOIN_WINDOW_SECONDS = 10;

export function canStartRound(d: Director): boolean {
  return Boolean(d.game.spectator || d.game.audienceIndependent || d.ctx?.setup.participants.length);
}

export function openLobby(d: Director): void {
  d.waitingForHost = d.roundStart === 'manual';
}

export function startWaitingRound(d: Director): void {
  if (d.phase !== 'LOBBY' || !d.waitingForHost || d.paused || !canStartRound(d)) return;
  d.enter('LOCK_COUNTDOWN');
}

export function setRoundStart(d: Director, mode: 'automatic' | 'manual'): void {
  d.roundStart = mode;
  d.roundStartChosen = true;
  if (d.phase === 'LOBBY') {
    d.phaseTime = 0;
    openLobby(d);
  }
}
