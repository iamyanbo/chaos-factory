import { Container, Graphics } from 'pixi.js';
import type { HudState } from '../hud/hud';
import { card, TOY, ToyBar, ToyText } from '../kit/theme';
import { RoundEntrance } from './entrance';
import { ResultScreens } from './result-screen';

/** Shared between-round cards; outcomes and phase durations are read-only. */
export class ShowCards {
  readonly root = new Container();
  private graphics = new Graphics();
  private text: ToyText;
  private bet = new ToyBar();
  private entrance = new RoundEntrance();
  private results: ResultScreens;

  constructor(layer: Container) {
    layer.addChild(this.root);
    this.root.addChild(this.graphics);
    this.text = new ToyText(this.root);
    this.results = new ResultScreens(this.root);
  }

  private center(key: string, value: string, y: number, size: number, color = TOY.color.ink as number): void {
    this.text.set(key, value, 960, y, size, size >= 40, color, 880, true);
  }

  update(state: HudState, dt: number): void {
    this.root.visible = Boolean(state.show && !['PLAY', 'FINALE'].includes(state.phase));
    if (!this.root.visible || !state.show) return;
    const show = state.show;
    this.graphics.clear();
    this.text.hide();
    const countScale = this.entrance.update(this.root, state, dt);
    if (this.results.update(state, dt)) return;
    card(this.graphics, { x: 460, y: 110, width: 1000, height: 860 });
    this.center('header', state.practice ? 'JOIN & WATCH'
      : show.grandFinal ? 'GRAND FINAL · TOP 8' : `CUP · ROUND ${show.round} OF 5`, 140, 24, TOY.color.muted);
    if (state.phase === 'ATTRACT') {
      this.center('brand', 'CHAOS FACTORY', 280, 84);
      this.center('cup-rule', 'Five rounds. One Cup champion.', 430, 36);
      this.center('start', 'Start a Cup from the dashboard', 560, 28);
      this.center('join', 'Viewers type !join', 660, 44, TOY.color.accentB);
    } else if (state.phase === 'INTRO') {
      this.center('game', state.game.title, 260, 76);
      this.center('rule', show.grandFinal ? 'Last fighter standing takes the Cup.' : state.game.tagline, 415, 30);
      if (show.lastWinner) this.center('last', `Last winner: ${show.lastWinner}`, 525, 26);
      if (!state.noWagers) this.center('question', show.question, 610, 34);
      this.center('join', show.grandFinal ? 'Top 8 finalists'
        : state.game.spectator ? 'No joining needed' : 'Type !join', 770, 44, TOY.color.accentB);
    } else if (state.phase === 'LOBBY_BET') {
      const joining = !show.grandFinal && !state.game.spectator;
      this.center('game', state.game.title, 245, 64);
      this.center('lobby', state.waitingForHost ? joining ? 'WAITING FOR PLAYERS' : 'WAITING FOR HOST'
        : joining ? 'JOINS CLOSE IN' : 'STARTS IN', 360, 44);
      if (state.waitingForHost) {
        this.center('join', joining ? 'Type !join' : show.grandFinal ? 'Top 8 finalists' : 'No joining needed', 490, 64,
          TOY.color.accentB);
        this.center('host', 'Waiting for host to start', 765, 30);
      } else {
        this.center('clock', `${Math.ceil(state.timeLeft)}s`, 440, 110, TOY.color.accentB);
        this.center('join', joining ? 'Type !join' : show.grandFinal ? 'Top 8 finalists' : 'No joining needed', 605, 44);
      }
      if (!state.game.spectator) this.center('admitted',
        `${state.participants}${state.capacity && !show.grandFinal ? ` / ${state.capacity}` : ''} ${show.grandFinal ? 'finalists' : 'joined'}`, 685, 28);
      const prediction = state.prediction;
      if (prediction && !state.noWagers) {
        const total = prediction.outcomes.reduce((sum, outcome) => sum + outcome.points, 0);
        this.center('wager', 'PREDICTION OPEN', 765, 24);
        this.bet.draw(this.graphics, 630, 815, 660,
          total ? prediction.outcomes[0].points / total : 0, dt, TOY.color.accentA, TOY.color.accentB);
        this.center('pool', `${total.toLocaleString()} points`, 865, 26);
      }
    } else if (state.phase === 'LOCK_COUNTDOWN') {
      this.center('game', state.game.title, 280, 64);
      if (state.selectingTake) {
        this.center('loading', 'Loading game…', 450, 54);
        for (let index = 0; index < 3; index++) {
          const pulse = .5 + .5 * Math.sin(this.entrance.loadingTime * 6 - index * .9);
          this.graphics.circle(924 + index * 36, 560, 8 + pulse * 4).fill(TOY.color.accentB);
        }
      }
      else {
        this.center('starting', 'STARTING IN', 410, 44);
        const number = this.text.set('countdown', String(Math.max(1, Math.ceil(state.timeLeft))),
          960, 570, 180, true, TOY.color.accentB, 880, true);
        number.anchor.set(.5);
        number.scale.set(countScale);
      }
    }
  }
}
