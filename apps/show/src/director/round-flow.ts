import type { Phase } from '@chaos/shared';
import type { Director } from './director';
import { openLobby, START_COUNTDOWN_SECONDS, JOIN_WINDOW_SECONDS, canStartRound } from './lobby';

export function phaseDuration(d: Director): number {
  const durations: Partial<Record<Phase, number>> = {
    INTRO: 6, LOBBY: JOIN_WINDOW_SECONDS,
    LOCK_COUNTDOWN: START_COUNTDOWN_SECONDS, RESULT: 8
  };
  return durations[d.phase] ?? Infinity;
}

export function enterPhase(d: Director, phase: Phase): void {
  d.phase = phase;
  d.phaseTime = 0;
  d.waitingForHost = false;
  if (phase === 'INTRO') {
    d.search.cancel(d);
    d.bestTake = undefined;
    d.roundId = crypto.randomUUID();
    d.result = undefined;
    d.recorded = false;
    d.preview();
  }
  if (phase === 'LOBBY') openLobby(d);
  if (phase === 'LOCK_COUNTDOWN') {
    d.preview(false);
    d.prepareTake();
  }
  if (phase === 'PLAY') {
    d.stages.reset(d.game.id);
    d.instance?.start();
  }
  if (phase === 'RESULT') settleRound(d);
  d.broadcast();
}

export function advancePhase(d: Director): void {
  const factor = d.options.fast ? 10 : 1;
  if (d.phaseTime < phaseDuration(d) / factor) return;
  if (d.phase === 'INTRO') d.enter('LOBBY');
  else if (d.phase === 'LOBBY') {
    // Empty live lobbies stay open instead of starting a frozen game.
    if (canStartRound(d)) d.enter('LOCK_COUNTDOWN');
  } else if (d.phase === 'LOCK_COUNTDOWN') d.enter('PLAY');
  else if (d.phase === 'RESULT') nextRound(d);
}

export function nextRound(d: Director): void {
  d.round++;
  d.select();
  d.enter('INTRO');
}

export function settleRound(d: Director): void {
  if (!d.result || d.recorded) return;
  d.recorded = true;
  // Results are local to each round, without a persistent score or progression ledger.
  d.results.push(d.result);
  d.results = d.results.slice(-8);
  if (!d.options.practice && d.game.joinOnly) {
    d.participants.finishRound(d.ctx?.setup.participants.map(user => user.userId) ?? []);
  }
  d.hooks.onResult?.(d.result);
}
