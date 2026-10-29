import type { Message } from '@chaos/shared';
import type { Director } from './director';
import { setRoundStart, startWaitingRound } from './lobby';

export function handleCommand(d: Director, message: Extract<Message, { type: 'director.command' }>): void {
  const { cmd, arg } = message;
  if (cmd === 'start') d.start();
  else if (cmd === 'startRound') startWaitingRound(d);
  else if (cmd === 'setRoundStart' && (arg === 'automatic' || arg === 'manual')) setRoundStart(d, arg);
  else if (cmd === 'pause') {
    d.paused = true;
    if (d.phase === 'LOBBY_BET') d.notify('PAUSED - the Twitch prediction window continues');
  } else if (cmd === 'resume') d.paused = false;
  else if (cmd === 'forceVoid') d.void('Voided by the host');
  else if (cmd === 'skip') {
    if (['ATTRACT', 'CUP_RESULTS'].includes(d.phase)) return;
    if (d.phase === 'STANDINGS') {
      d.cup.round++;
      d.select();
      d.enter('INTRO');
      return;
    }
    if (d.phase === 'RESULT') { d.enter(d.cup.round === 5 ? 'CUP_RESULTS' : 'STANDINGS'); return; }
    d.void('Skipped by the host');
    d.enter(d.cup.round === 5 ? 'CUP_RESULTS' : 'STANDINGS');
  } else if (cmd === 'endCup' && d.phase !== 'ATTRACT') {
    d.void('Cup ended by the host');
    d.enter('CUP_RESULTS');
  } else if (cmd === 'next' && typeof arg === 'string' && d.registry.has(arg)) d.queue.unshift(arg);
  else if (cmd === 'queue' && Array.isArray(arg)) d.queue = arg.filter(id => d.registry.has(id));
  else if (cmd === 'setMode' && (arg === 'cvs' || arg === 'faction' || arg === 'auto')) d.modeOverride = arg;
  else if (cmd === 'setTeams' && typeof arg === 'number' && ['ATTRACT', 'CUP_RESULTS'].includes(d.phase)) {
    d.participants.reset(Math.min(arg, d.game.maxTeams ?? 6));
    d.participants.fill(d.mockCount, d.clock);
    d.preview(false);
  } else if (cmd === 'toggleWagers') {
    d.wagers = typeof arg === 'boolean' ? arg : !d.wagers;
    if (!d.wagers) {
      d.noWagers = true;
      d.hooks.send({ type: 'prediction.cancel', reason: 'Wagers disabled', roundId: d.roundId });
    }
  } else if (cmd === 'enableGame' && typeof arg === 'string') {
    if (d.enabled.has(arg) && d.enabled.size > 1) d.enabled.delete(arg);
    else if (d.registry.has(arg)) d.enabled.add(arg);
  } else if (cmd === 'audio' && typeof arg === 'number') d.volume = Math.max(0, Math.min(1, arg));
  else if (cmd === 'music' && typeof arg === 'boolean') d.musicEnabled = arg;
  else if (cmd === 'betWindow' && typeof arg === 'number') d.betWindow = Math.max(30, Math.min(120, Math.floor(arg)));
  else if (cmd === 'setCapacity' && arg && typeof arg === 'object' && !Array.isArray(arg)) {
    for (const [id, limit] of Object.entries(arg)) d.setCapacity(id, limit);
    if (['ATTRACT', 'INTRO', 'LOBBY_BET'].includes(d.phase)) d.preview(false);
    else d.notify('JOIN LIMIT SAVED - APPLIES NEXT ROUND');
  } else if (cmd === 'transparent') d.transparent = Boolean(arg);
  else if (cmd === 'autopilot') d.autopilot = true;
  d.broadcast();
}
