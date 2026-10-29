import { type Phase } from '@chaos/shared';
import type { Director } from './director';
import { audienceRoster, predictionOptions } from './roster';
import { openLobby, START_COUNTDOWN_SECONDS, JOIN_WINDOW_SECONDS } from './lobby';

export function phaseDuration(d: Director): number {
  const durations: Partial<Record<Phase, number>> = {
    INTRO: 6, LOBBY_BET: d.noWagers ? JOIN_WINDOW_SECONDS : d.betWindow,
    LOCK_COUNTDOWN: START_COUNTDOWN_SECONDS,
    RESULT: 6, STANDINGS: 8, CUP_RESULTS: 20
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
    d.record = undefined;
    d.recorded = false;
    d.prediction = undefined;
    d.preview();
    const options = predictionOptions(d);
    d.predictionTitles = options.titles;
    d.predictionUsers = options.users;
    d.noWagers = !d.wagers || !d.canPredict || options.titles.length < 2;
  }
  if (phase === 'LOBBY_BET') openLobby(d);
  if (phase === 'LOCK_COUNTDOWN') {
    if (!d.noWagers) d.hooks.send({ type: 'prediction.lock', roundId: d.roundId });
    d.preview(false);
    d.prepareTake();
  }
  if (phase === 'PLAY') {
    d.cupShow.beginRound(d.ctx?.setup.audience ?? audienceRoster(d), d.game.id);
    d.stages.reset(d.game.id);
    d.instance?.start();
    if (d.cup.round === 5 && !d.options.practice && !d.ctx?.setup.participants.length) d.void('No Cup qualifiers');
  }
  if (phase === 'RESULT') settleRound(d);
  if (phase === 'CUP_RESULTS') {
    d.cupShow.crownUserId = d.profileCrownId ?? d.cupShow.championId ?? d.cupShow.crownUserId;
    d.hooks.send({ type: 'prediction.cancel', reason: 'Cup ended' });
  }
  d.broadcast();
}

export function advancePhase(d: Director): void {
  const factor = d.options.fast ? 10 : 1;
  if (d.phaseTime < phaseDuration(d) / factor) return;
  if (d.phase === 'INTRO') d.enter('LOBBY_BET');
  else if (d.phase === 'LOBBY_BET') d.enter('LOCK_COUNTDOWN');
  else if (d.phase === 'LOCK_COUNTDOWN') d.enter('PLAY');
  else if (d.phase === 'RESULT') d.enter(d.cup.round === 5 ? 'CUP_RESULTS' : 'STANDINGS');
  else if (d.phase === 'STANDINGS') {
    d.cup.round++;
    d.select();
    d.enter('INTRO');
  } else if (d.phase === 'CUP_RESULTS') d.enter('ATTRACT');
}

export function settleRound(d: Director): void {
  if (!d.result || d.recorded) return;
  d.recorded = true;
  const result = d.result;
  d.results.push(result);
  d.record = d.cupShow.settle(d.game.id, d.cup.round, result, d.instance,
    d.mode === 'faction', d.format === 'boss');
  const winner = result.winner;
  if (winner.kind === 'chat') d.cup.chat++;
  if (winner.kind === 'streamer') d.cup.streamer++;
  if (winner.kind === 'team') d.cup.teams[winner.teamId] = (d.cup.teams[winner.teamId] ?? 0) + 1;
  if (d.options.practice) { d.hooks.onResult?.(result); return; }
  if (d.game.joinOnly) d.participants.finishRound(d.ctx?.setup.participants.map(user => user.userId) ?? []);
  if (winner.kind === 'void') d.hooks.send({ type: 'prediction.cancel', reason: winner.reason, roundId: d.roundId });
  else if (!d.noWagers) {
    const index = d.format === 'ffa' ? d.predictionUsers.indexOf(result.champion?.userId ?? '')
      : winner.kind === 'team' ? d.predictionUsers.indexOf(winner.teamId)
      : winner.kind === 'chat' ? 0 : 1;
    if (index < 0) d.hooks.send({ type: 'prediction.cancel', reason: 'No matching prediction outcome', roundId: d.roundId });
    else d.hooks.send({ type: 'prediction.resolve', outcomeIndex: index, roundId: d.roundId });
  }
  d.hooks.send({ type: 'round.record', gameId: d.game.id, mode: d.mode,
    roundId: d.roundId, result, cup: d.record });
  d.hooks.onResult?.(result);
}
