import { Container, Graphics } from 'pixi.js';
import type { HudState } from '../../hud/hud';
import type { NeonSideUpdate } from '../neon/hud';
import { card } from './shapes';
import { TOY, toyColor } from './toy';
import { ToyBar } from './bar';
import { ToyText } from './text';
import { roundCountdown } from '../../hud/round-clock';

interface ScoreRow { name: string; value: string; color?: number }
const CONTENT = TOY.layout.column - TOY.card.padX * 2;

/** Viewer information only: one title, one live metric, one stage, and actual leaders. */
export class ToySidebar {
  readonly root = new Container();
  readonly scoreTargets = new Map<string, { x: number; y: number }>();
  private graphics = new Graphics();
  private text: ToyText;
  private bars = new Map<string, ToyBar>();

  constructor(layer: Container) {
    layer.addChild(this.root);
    this.root.addChild(this.graphics);
    this.text = new ToyText(this.root);
  }

  private bar(key: string): ToyBar {
    if (!this.bars.has(key)) this.bars.set(key, new ToyBar());
    return this.bars.get(key)!;
  }

  update(state: HudState, side: NeonSideUpdate, dt: number,
    ladder: { label: string; names: string[] }[]): void {
    const g = this.graphics.clear();
    this.scoreTargets.clear();
    this.text.hide();
    const left = TOY.layout.left;
    const right = TOY.layout.right;
    const pad = TOY.card.padX;
    const title = this.text.set('title', state.game.title, left + pad, 62, TOY.type.title, true);
    const modeY = 62 + title.height + 8;
    const mode = state.mode === 'faction' ? 'FACTION WAR'
      : state.game.formats?.includes('boss') && state.roundCompetition !== 'individual'
        ? `${state.streamerName ?? 'Streamer'} vs CHAT` : 'JOIN & WATCH';
    const modeText = this.text.set('mode', mode, left + pad, modeY, TOY.type.small);
    const headerHeight = modeY + modeText.height + TOY.card.padY - TOY.layout.margin;
    card(g, { x: left, y: 40, width: 380, height: headerHeight });
    let y = 40 + headerHeight + TOY.layout.gap;
    const countdown = roundCountdown(state.game.ending, state.phase, state.timeLeft);
    const metrics = (side.bars ?? []).filter(bar => bar.side === 'left' || state.game.id === 'pong-wars');
    if (metrics.length) {
      const many = metrics.length > 2;
      const rowHeight = many ? 81 : 130;
      const height = 44 + rowHeight * metrics.length + (many ? 0 : 26);
      card(g, { x: left, y, width: 380, height });
      for (const [index, metric] of metrics.entries()) {
        const top = y + 22 + index * rowHeight;
        this.text.label(`metric-label:${index}`, metric.label, left + pad, top);
        this.text.set(`metric-value:${index}`, metric.text ?? `${Math.round(metric.value * 100)}%`,
          left + pad, top + 31, many ? TOY.type.small : TOY.type.number, !many);
        this.bar(`metric:${index}`).draw(g, left + pad, top + (many ? 58 : 83), CONTENT,
          metric.value, dt, toyColor(metric.color));
      }
      if (!many) this.text.set('count', this.count(state, side), left + pad,
        y + height - 46, TOY.type.small);
      y += height + TOY.layout.gap;
    } else {
      const label = state.game.id === 'multiplier-cascade' && side.countLabel === 'FIRST TO FIVE' ? 'THE FINAL RACE'
        : state.game.id === 'peg-fever' ? 'BALLS LANDED'
        : state.game.id === 'marble-race' ? 'FINISHED'
          : state.game.id === 'light-cycles' ? 'STILL RIDING' : 'ON THE FLOOR';
      const count = this.count(state, side);
      const value = this.text.set('count', count, left + pad, y + 55, TOY.type.number, true);
      const height = Math.max(132, value.height + 80);
      card(g, { x: left, y, width: 380, height });
      this.text.label('count-label', label, left + pad, y + 24);
      y += height + TOY.layout.gap;
    }
    const special = state.paused ? { label: 'Round paused', value: 'PAUSED' }
      : countdown !== undefined ? { label: 'Final seconds', value: String(countdown) }
      : side.arenaPercent !== undefined ? {
        label: state.show?.stages[state.show.stageIndex]?.name ?? 'Arena', value: `ARENA ${side.arenaPercent}%` }
      : state.game.id === 'peg-fever' ? {
        label: side.subtitle?.startsWith('FEVER') ? 'FEVER!' : 'ORANGE PEGS',
        value: side.subtitle?.startsWith('FEVER') ? 'SLOTS ×2' : (side.feed?.[0] ?? '20 / 20').split(' orange')[0] }
      : state.game.id === 'multiplier-cascade' && side.countLabel !== 'FIRST TO FIVE' ? {
        label: 'COURSE', value: side.subtitle ?? 'CASCADE' }
      : undefined;
    if (special) {
      card(g, { x: left, y, width: 380, height: 124 });
      this.text.label('stage-label', special.label, left + pad, y + 23);
      this.text.set('stage-value', special.value, left + pad, y + 58, TOY.type.number, true);
    }
    let rightY = 40;
    if (!state.practice) rightY = this.prediction(state, dt) + TOY.layout.gap;
    const rows = this.rows(state, side, ladder).slice(0, 5);
    if (rows.length) {
      card(g, { x: right, y: rightY, width: 380, height: 74 + rows.length * 43 });
      const label = state.game.id === 'multiplier-cascade'
        ? side.countLabel === 'FIRST TO FIVE' ? 'RACE TO FIVE' : 'BALLS'
        : state.game.id === 'marble-race' ? 'THE LEADERS' : state.game.id === 'blade-brawl' ? 'TOP FIGHTERS' : 'THE LEADERS';
      this.text.label('leaders', label, right + pad, rightY + 24);
      for (const [index, row] of rows.entries()) {
        const top = rightY + 66 + index * 43;
        this.scoreTargets.set(row.name, { x: right + 300, y: top + 12 });
        const color = row.color ?? state.participantColors?.[row.name] ?? TOY.palette[index % TOY.palette.length];
        g.circle(right + pad + 13, top + 12, 15).fill(toyColor(color))
          .stroke({ color: TOY.color.ink, width: 3 });
        this.text.set(`leader-name:${index}`, row.name.slice(0, 17), right + pad + 42, top - 3,
          TOY.type.body, false, TOY.color.ink, 220);
        if (row.value) this.text.set(`leader-value:${index}`, row.value.slice(0, 9), right + 278,
          top - 3, TOY.type.small, false, TOY.color.ink, 78);
      }
    }
  }

  private count(state: HudState, side: NeonSideUpdate): string {
    let count = side.countLabel ?? `${state.participants} marbles`;
    count = count.split('·')[0].trim().replace(/finished\s*/i, '').replace(/\s*balls landed/i, '');
    count = count.replace(/\s*fighters left/i, ' fighters left');
    if (state.game.id === 'light-cycles') count = count.replace(/\s*still riding/i, '');
    if (count === 'FIRST TO FIVE') count = 'FIRST TO 5';
    return count;
  }

  private prediction(state: HudState, dt: number): number {
    const x = TOY.layout.right;
    const y = 40;
    const prediction = state.prediction;
    const label = state.noWagers ? 'PREDICTION · NO WAGERS'
      : `PREDICTION · ${prediction?.status ?? 'JOINS OPEN'}`;
    card(this.graphics, { x, y, width: 380, height: 175 });
    this.text.label('prediction', label, x + 26, y + 24);
    if (!prediction || state.noWagers) {
      this.text.set('prediction-status', state.noWagers ? 'Join & watch' : 'Back your winner', x + 26, y + 66, 26);
      this.text.set('prediction-hint', 'Viewers type !join', x + 26, y + 112, 24);
      return y + 175;
    }
    const total = prediction.outcomes.reduce((sum, outcome) => sum + outcome.points, 0);
    const first = prediction.outcomes[0];
    const last = prediction.outcomes.length === 2 ? prediction.outcomes[1]?.title : 'FIELD';
    this.text.set('bet-a', first?.title.slice(0, 15) ?? '', x + 26, y + 60, 24, true, TOY.color.ink, 210);
    this.text.set('bet-b', last?.slice(0, 9) ?? '', x + 256, y + 60, 24, true, TOY.color.ink, 100);
    this.bar('prediction').draw(this.graphics, x + 26, y + 90, CONTENT,
      total ? first.points / total : 0, dt, TOY.color.accentA, TOY.color.accentB);
    this.text.set('bet-total', `${total.toLocaleString()} points`, x + 26, y + 128, 24);
    return y + 175;
  }

  private rows(state: HudState, side: NeonSideUpdate,
    ladder: { label: string; names: string[] }[]): ScoreRow[] {
    const rows = side.rows ?? [];
    if (state.game.id === 'pong-wars') return [];
    if (state.game.id === 'ring-escape') return [...ladder].reverse()
      .flatMap(row => row.names.map(name => ({ name, value: row.label.replace('RING ', 'R') })));
    if (state.game.id === 'multiplier-cascade') return rows.map(row => ({
      name: row.label.split(' · ')[0], color: row.color,
      value: side.countLabel === 'FIRST TO FIVE' ? row.label.split(' · ')[1]?.replace(' / ', '/') ?? '0/5'
        : row.names[0]?.match(/[\d,]+/)?.[0] ?? '' }));
    if (state.game.id === 'marble-race') return rows.map(row => ({
      name: row.names[0] ?? '', value: row.names[1]?.replace('FINISHED ', '#') ?? '', color: row.color }));
    const row = rows.find(row => /TOP|FIGHTERS|STILL|TAGS/i.test(row.label)) ?? rows[0];
    return (row?.names ?? []).map(line => {
      const match = line.match(/^(.*?)(?::\s*|\s+)([\d,.]+)(?:HP)?$/);
      return { name: match?.[1] ?? line, value: match?.[2] ?? '', color: row?.color };
    });
  }
}
