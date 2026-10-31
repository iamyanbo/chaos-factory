import { Container, Graphics } from 'pixi.js';
import type { HudState } from '../hud/hud';
import { card, TOY, ToyText } from '../kit/theme';
import { RoundEntrance } from './entrance';
import { ResultScreens } from './result-screen';

/** Shared between-round cards; outcomes and phase durations are read-only. */
export class ShowCards {
  readonly root = new Container();
  private graphics = new Graphics();
  private text: ToyText;
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
      : `ROUND ${show.round || 1}`, 140, 24, TOY.color.muted);
    if (state.phase === 'ATTRACT') {
      this.center('brand', 'CHAOS FACTORY', 280, 84);
      this.center('round-rule', 'Chat vs streamer · team battles · races', 430, 36);
      this.center('start', 'Start the show from the dashboard', 560, 28);
      this.center('join', 'Viewers type !join', 660, 44, TOY.color.accentB);
    } else if (state.phase === 'INTRO') {
      this.center('game', state.game.title, 260, 76);
      this.center('rule', state.game.tagline, 415, 30);
      this.center('join', state.game.spectator ? 'No joining needed' : 'Type !join', 770, 44, TOY.color.accentB);
    } else if (state.phase === 'LOBBY') {
      const joining = !state.game.spectator;
      this.center('game', state.game.title, 245, 64);
      this.center('lobby', state.waitingForHost ? joining ? 'WAITING FOR PLAYERS' : 'WAITING FOR HOST'
        : joining ? state.timeLeft > 0 ? 'JOINS CLOSE IN' : 'WAITING FOR PLAYERS' : 'STARTS IN', 360, 44);
      if (state.waitingForHost) {
        this.center('join', joining ? 'Type !join' : 'No joining needed', 490, 64,
          TOY.color.accentB);
        this.center('host', 'Waiting for host to start', 765, 30);
      } else if (state.timeLeft > 0) {
        this.center('clock', `${Math.ceil(state.timeLeft)}s`, 440, 110, TOY.color.accentB);
        this.center('join', joining ? 'Type !join' : 'No joining needed', 605, 44);
      } else {
        this.center('join', 'Type !join to start', 490, 64, TOY.color.accentB);
      }
      if (!state.game.spectator) this.center('admitted',
        `${state.participants}${state.capacity ? ` / ${state.capacity}` : ''} joined`, 685, 28);
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
