import type { Container } from 'pixi.js';
import type { Mode, Phase, RoundResult, TEAMS } from '@chaos/shared';
import type { GameDefinition, GameHud } from '../games/contract';
import type { NeonSideUpdate } from '../kit/neon/hud';
import type { ShowState } from '../show-layer/state';
import { ShowCards } from '../show-layer/cards';
import { ToySidebar } from '../kit/theme/sidebar';
import { ToyToast } from '../kit/theme/effects';

export interface HudState {
  streamerName?: string;
  show?: ShowState;
  selectingTake?: boolean;
  waitingForHost?: boolean;
  alive?: number;
  roundCompetition?: 'individual' | 'team';
  practice?: boolean;
  practiceRole?: 'boss' | 'chatter';
  practiceTeam?: keyof typeof TEAMS;
  localJoined?: boolean;
  participantNames?: Record<string, string>;
  participantColors?: Record<string, number>;
  phase: Phase;
  timeLeft: number;
  round: number;
  game: GameDefinition;
  mode: Mode;
  paused: boolean;
  participants: number;
  capacity?: number;
  crowd: number;
  connected: boolean;
  result?: RoundResult;
  modifiers: string[];
  wheel: { id: string; name: string; help: string }[];
  votes: number[];
  autopilot: boolean;
  safeZone: { x: number; y: number; w: number; h: number };
  showSafeZone: boolean;
}

/** Shared Toy presentation. Game state, round clocks and outcomes stay with the director. */
export class Hud implements GameHud {
  private sidebar: ToySidebar;
  private cards: ShowCards;
  private toastView: ToyToast;
  private side: NeonSideUpdate = {};
  private ladder: { label: string; names: string[] }[] = [];
  private clock = 0;
  private toasts: { text: string; until: number }[] = [];

  constructor(layer: Container, _practice = false) {
    this.sidebar = new ToySidebar(layer);
    this.cards = new ShowCards(layer);
    this.toastView = new ToyToast(layer);
  }

  setSide(state: NeonSideUpdate): void { this.side = state; }
  scoreTarget(displayName: string) { return this.sidebar.scoreTargets.get(displayName); }
  setMetric(_title: string, _value: string): void {}
  setTeams(_values: { team: string; value: number }[]): void {}
  setLadder(rows: { label: string; names: string[] }[]): void { this.ladder = rows; }
  announce(text: string, _intensity = 1): void { this.toast(text); }
  kill(text: string): void { this.toast(text); }
  feedback(_userId: string, _verb: string, _team?: string): void {}

  toast(text: string): void {
    this.toasts.push({ text, until: this.clock + 4 });
    this.toasts = this.toasts.slice(-3);
  }

  clear(): void {
    this.side = {};
    this.ladder = [];
    this.toasts = [];
    this.toastView.show();
  }

  update(state: HudState, dt: number): void {
    this.clock += dt;
    this.toasts = this.toasts.filter(toast => toast.until > this.clock);
    this.sidebar.root.visible = ['PLAY', 'FINALE'].includes(state.phase);
    if (this.sidebar.root.visible) this.sidebar.update(state, this.side, dt, this.ladder);
    this.cards.update(state, dt);
    this.toastView.show(['RESULT'].includes(state.phase) ? undefined
      : this.toasts.at(-1)?.text ?? state.show?.notifications.at(-1));
  }
}
