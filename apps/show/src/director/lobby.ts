import type { Director } from './director';
import { predictionOptions } from './roster';

export const START_COUNTDOWN_SECONDS = 3;
export const JOIN_WINDOW_SECONDS = 10;

export function canStartRound(d: Director): boolean {
  return Boolean(d.game.spectator || d.game.audienceIndependent
    || d.cup.round === 5 || d.ctx?.setup.participants.length);
}

/** Waiting for the host never opens a timed Twitch Prediction. */
export function openLobby(d: Director): void {
  d.waitingForHost = d.roundStart === 'manual';
  if (!d.waitingForHost) openBetting(d);
}

function openBetting(d: Director): void {
  const options = predictionOptions(d);
  d.predictionTitles = options.titles;
  d.predictionUsers = options.users;
  d.noWagers = !d.wagers || !d.canPredict || options.titles.length < 2;
  if (!d.noWagers) {
    d.noWagers = !d.hooks.send({ type: 'prediction.create', roundId: d.roundId,
      title: (d.cup.round === 5 ? 'Who takes the Chaos Factory Cup?'
        : d.game.predictionTitle(d.ctx!.setup)).slice(0, 45),
      outcomes: d.predictionTitles, windowSec: d.betWindow });
  }
}

export function startWaitingRound(d: Director): void {
  if (d.phase !== 'LOBBY_BET' || !d.waitingForHost || d.paused || !canStartRound(d)) return;
  d.waitingForHost = false;
  d.phaseTime = 0;
  openBetting(d);
  if (d.noWagers) d.enter('LOCK_COUNTDOWN');
  else d.broadcast();
}

export function setRoundStart(d: Director, mode: 'automatic' | 'manual'): void {
  d.roundStart = mode;
  d.roundStartChosen = true;
  if (mode === 'automatic' && d.waitingForHost) {
    d.phaseTime = 0;
    openLobby(d);
  }
}
