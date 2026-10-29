import type { DirectorState, Message } from '@chaos/shared';
import { registry } from '../games/registry';

type Send = (cmd: Extract<Message, { type: 'director.command' }>['cmd'], arg?: string) => void;

export class RoundStartControl {
  readonly root = document.createElement('div');
  private select: HTMLSelectElement;
  private button: HTMLButtonElement;
  private help: HTMLElement;

  constructor(send: Send) {
    this.root.className = 'round-start-control';
    this.root.innerHTML = `<label>Round start<select id="round-start" disabled>
      <option value="automatic">Automatic countdown</option>
      <option value="manual">Host starts each round</option>
    </select></label>
    <p id="round-start-help" class="muted small" hidden></p>
    <button id="start-round" class="button primary" hidden>▶ Start round</button>`;
    this.select = this.root.querySelector('select')!;
    this.button = this.root.querySelector('button')!;
    this.help = this.root.querySelector('p')!;
    this.select.onchange = () => send('setRoundStart', this.select.value);
    this.button.onclick = () => send('startRound');
  }

  update(state: DirectorState): void {
    const game = registry.get(state.gameId);
    const needsPlayers = !game?.spectator && !game?.audienceIndependent && !state.cup.grandFinal;
    const empty = needsPlayers && !state.participants;
    this.select.disabled = false;
    this.select.value = state.roundStart ?? 'automatic';
    this.button.hidden = !state.waitingForHost;
    this.button.disabled = Boolean(state.paused || empty);
    this.help.hidden = !state.waitingForHost || (!state.paused && !empty);
    this.help.textContent = state.waitingForHost
      ? state.paused ? 'Resume the show before starting.'
        : empty ? 'Waiting for the first !join.' : 'Click Start round when everyone has joined.'
      : state.roundStart === 'manual' ? 'Each game waits for you to click Start round.'
        : 'Each game starts after the join countdown.';
  }
}

export function roundPhaseLabel(state: DirectorState): string {
  if (state.paused) return 'Paused';
  if (state.preparingRound) return 'Loading game';
  if (state.waitingForHost) return registry.get(state.gameId)?.spectator ? 'Waiting for host' : 'Waiting for players';
  const labels: Record<string, string> = { ATTRACT: 'Ready to start a Cup', INTRO: 'Next game',
    LOBBY_BET: 'Starting soon', LOCK_COUNTDOWN: 'Starting soon', PLAY: 'Playing',
    RESULT: 'Round results', STANDINGS: 'Cup standings', CUP_RESULTS: 'Cup complete' };
  return labels[state.phase] ?? 'Next game';
}
