import { Container, Graphics, Sprite } from 'pixi.js';
import type { HudState } from '../hud/hud';
import { card, TOY, ToyText, toyColor } from '../kit/theme';
import { BallTextures } from '../kit/theme/ball-textures';
import { ballStyle } from '../kit/theme/ball-style';
import { roundResult, type ResultModel, type ResultRow } from './result-model';

const LEFT = 80;
const TOP = 222;
const HEIGHT = 646;
const HERO_WIDTH = 1030;
const LIST_X = 1150;
const LIST_WIDTH = 690;
const HERO_X = LEFT + HERO_WIDTH / 2;
const ROW_HEIGHT = 80;
const ENTER_SECONDS = .35;

function crown(g: Graphics, x: number, y: number, size = 1): void {
  g.poly([-32, 15, -40, -23, -17, -8, 0, -38, 17, -8, 40, -23, 32, 15]
    .map((n, index) => n * size + (index % 2 ? y : x)))
    .fill(TOY.color.yellow).stroke({ color: TOY.color.ink, width: 4, join: 'round' });
  g.roundRect(x - 32 * size, y + 21 * size, 64 * size, 10 * size, 4)
    .fill(TOY.color.yellow).stroke({ color: TOY.color.ink, width: 4 });
}

/** Read-only round, standings and champion presentation; every score is labeled. */
export class ResultScreens {
  readonly root = new Container();
  private body = new Container();
  private graphics = new Graphics();
  private text: ToyText;
  private portrait = new Sprite();
  private front = new Graphics();
  private textures = new BallTextures();
  private key = '';
  private age = 0;

  constructor(parent: Container) {
    parent.addChild(this.root);
    this.root.addChild(this.body);
    this.body.addChild(this.graphics, this.portrait, this.front);
    this.portrait.anchor.set(.5);
    this.text = new ToyText(this.body);
  }

  update(state: HudState, dt: number): boolean {
    this.root.visible = ['RESULT'].includes(state.phase);
    if (!this.root.visible || !state.show) return false;
    const key = `${state.phase}:${state.show.round}:${state.result?.replay.seed}`;
    if (key !== this.key) { this.key = key; this.age = 0; }
    this.age += dt;
    const ease = 1 - (1 - Math.min(1, this.age / ENTER_SECONDS)) ** 3;
    this.body.alpha = .35 + .65 * ease;
    this.body.y = 24 * (1 - ease);
    this.graphics.clear();
    this.front.clear();
    this.text.hide();
    this.portrait.visible = false;
    {
      const model = roundResult(state);
      this.header('ROUND COMPLETE', state.game.title);
      this.hero(model);
      this.list(model.rowsTitle, model.rows, model.winnerId);
      if (model.note) this.text.set('result-note', model.note, LIST_X + 34, TOP + HEIGHT - 48,
        24, false, TOY.color.muted, 600);
      if (model.cancelled) {
        this.text.set('empty-title', 'No winner recorded', LIST_X + 38, 340, 38, true, TOY.color.ink, 600);
        this.text.set('empty-copy', state.practice ? 'Play again or choose another game.' : 'The next round starts fresh.',
          LIST_X + 38, 420, 28, false, TOY.color.muted, 560);
      }
    }
    this.footer(state);
    return true;
  }

  private header(label: string, title: string): void {
    this.text.label('eyebrow', label, LEFT, 58, 1450);
    this.text.set('title', title, LEFT, 101, 64, true, TOY.color.ink, 1700);
    this.graphics.roundRect(LEFT, 188, 78, 8, 4).fill(TOY.color.accentB);
    for (const [index, x] of [1470, 1590, 1715, 1805].entries()) {
      this.graphics.roundRect(x, 88 + index % 2 * 38, 14, 32, 5)
        .fill(TOY.palette[index]);
    }
  }

  private hero(model: ResultModel): void {
    const g = this.graphics;
    card(g, { x: LEFT, y: TOP, width: HERO_WIDTH, height: HEIGHT });
    g.roundRect(HERO_X - 158, 248, 316, 48, 24).fill(model.color);
    this.text.set('hero-label', model.label, HERO_X, 258, 24, true, TOY.color.white, 300, true);
    if (!model.cancelled) {
      g.circle(HERO_X, 466, 128).fill(TOY.color.pale);
      g.ellipse(HERO_X, 565, 90, 16).fill({ color: TOY.color.ink, alpha: .15 });
      const art = this.textures.disc(model.color, 88, ballStyle());
      this.portrait.texture = art.texture;
      this.portrait.width = this.portrait.height = art.size;
      this.portrait.position.set(HERO_X, 464);
      this.portrait.visible = true;
      if (ballStyle() === 'c') {
        this.front.ellipse(HERO_X - 23, 458, 7, 10).ellipse(HERO_X + 23, 458, 7, 10).fill(TOY.color.ink);
      }
      crown(g, HERO_X, 345, 1.15);
      for (const side of [-1, 1]) {
        g.roundRect(HERO_X + side * 190, 406, 12, 36, 5).fill(model.color);
        g.circle(HERO_X + side * 218, 498, 7).fill(TOY.color.yellow);
        g.roundRect(HERO_X + side * 165, 540, 28, 10, 4).fill(TOY.color.accentA);
      }
    }
    const title = this.text.set('winner', model.name, HERO_X, model.cancelled ? 416 : 610,
      model.cancelled ? 60 : 78, true, TOY.color.ink, 920, true);
    title.style.wordWrap = false;
    title.scale.set(1);
    title.scale.set(Math.min(1, 920 / Math.max(1, title.width)));
    if (model.stat) this.text.set('stat', model.stat, HERO_X, 728, 34, true, model.color, 880, true);
    if (model.message) this.text.set('reason', model.message, HERO_X, 550, 28, false, TOY.color.muted, 830, true);
  }

  private name(key: string, value: string, x: number, y: number, width: number): void {
    const short = value.length > 22 ? value.slice(0, 21) + '\u2026' : value;
    const view = this.text.set(key, short, x, y, 28, false, TOY.color.ink, width);
    view.style.wordWrap = false;
    view.scale.set(1);
    view.scale.set(Math.min(1, width / Math.max(1, view.width)));
  }

  private list(title: string, rows: ResultRow[], winnerId?: string): void {
    const g = this.graphics;
    card(g, { x: LIST_X, y: TOP, width: LIST_WIDTH, height: HEIGHT });
    this.text.label('list-title', title, LIST_X + 34, TOP + 34, 600);
    for (const [index, row] of rows.slice(0, 6).entries()) {
      const y = 318 + index * ROW_HEIGHT;
      const won = row.id === winnerId;
      if (won) g.roundRect(LIST_X + 20, y - 6, LIST_WIDTH - 40, 72, 18).fill(TOY.color.pale);
      this.text.set(`rank:${index}`, row.rank === undefined ? '' : String(row.rank).padStart(2, '0'), LIST_X + 34, y + 11, 26, true, TOY.color.muted, 48);
      g.circle(LIST_X + 105, y + 28, 17).fill(toyColor(row.color)).stroke({ color: TOY.color.ink, width: 3 });
      this.name(`row-name:${index}`, row.name, LIST_X + 138, y + 2, 300);
      const value = this.text.set(`row-value:${index}`, row.value, LIST_X + LIST_WIDTH - 35,
        y + 6, 28, true, TOY.color.ink, 230);
      value.anchor.x = 1;
      if (row.detail) this.text.set(`detail:${index}`, row.detail, LIST_X + 138, y + 37, 20, true, TOY.color.muted, 310);
    }
  }

  private footer(state: HudState): void {
    const show = state.show!;
    const label = state.practice ? 'ANOTHER ROUND?' : 'UP NEXT';
    const next = state.practice ? 'Play again or choose a different game.'
      : show.nextGameTitle ?? 'Next game · type !join';
    this.text.label('footer-label', label, LEFT, 916, 1000);
    this.text.set('footer-next', next, LEFT, 955, 30, false, TOY.color.ink, 1050);
    if (!state.practice) {
      this.graphics.roundRect(1470, 926, 370, 70, 26).fill(TOY.color.ink);
      this.text.set('next-count', `NEXT IN ${Math.max(0, Math.ceil(state.timeLeft))}s`,
        1655, 946, 28, true, TOY.color.white, 340, true);
    }
  }
}
