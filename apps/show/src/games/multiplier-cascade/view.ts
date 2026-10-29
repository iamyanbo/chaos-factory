import { Text } from 'pixi.js';
import { TEAMS } from '@chaos/shared';
import type { GameContext } from '../contract';
import { NeonBalls, NeonSparks, WHITE } from '../../kit/neon';
import type { MultiplierCascade } from './cascade';
import { CHAMBERS, COURSE, GATE_Y, RELAY_TOP, PORTS, BALL_RADIUS } from './course-layout';
import { RELAY_GOAL } from './relay';
import { gateColor } from './paint';
import { TOY } from '../../kit/theme/toy';
import { CascadeBursts } from './bursts';

const HOPPER_LABEL_Y = RELAY_TOP + 82;
const POCKET_LABEL_OFFSET = 2;

/** All commentary stays in the side columns; only gate values label the machine. */
export class CascadeView {
  private balls: NeonBalls;
  private sparks: NeonSparks;
  private labels: Text[] = [];
  private bursts: CascadeBursts;

  constructor(private ctx: GameContext) {
    this.balls = new NeonBalls(ctx, { minimumRadius: BALL_RADIUS });
    this.sparks = new NeonSparks(ctx);
    this.bursts = new CascadeBursts(ctx);
  }

  multiply(x: number, y: number, factor: number, time: number): void {
    this.bursts.multiply(x, y, factor, time);
  }

  burst(x: number, y: number, color: number, time: number, count: number): void {
    this.sparks.burst(x, y, color, time, count);
  }

  private text(index: number, value: string, x: number, y: number, color = WHITE): void {
    const text = this.labels[index] ??= this.ctx.stage.hudWorld.addChild(new Text({
      text: value, style: { fontFamily: TOY.font.display, fontSize: 36, fill: TOY.color.white,
        stroke: { color: TOY.color.ink, width: 6, join: 'round' } }
    }));
    text.anchor.set(0.5);
    text.text = value;
    text.style.fill = TOY.color.white;
    text.position.set(x, y);
  }

  render(game: MultiplierCascade, alpha: number): void {
    for (const label of this.labels) label.visible = false;
    const bay = game.board.bay();
    let labelIndex = 0;
    if (game.relay) {
      for (const [index, team] of game.relay.seats.entries()) {
        this.text(labelIndex++, String(game.relay.stock.get(team)), game.relay.port(index), HOPPER_LABEL_Y);
      }
    } else for (let stage = 0; stage < GATE_Y.length; stage++) {
      const y = GATE_Y[stage] + 16;
      for (const port of PORTS) {
        const u = port.start + port.width / 2;
        const factor = port.multiply ? game.board.factor(stage) : port.factor;
        const x = bay.left + bay.w * (game.board.mirrored(stage) ? 1 - u : u);
        this.text(labelIndex++, `×${factor}`, x, y, gateColor(factor));
      }
    }
    if (!game.relay || game.camera.y < RELAY_TOP) for (let slot = 0; slot < 3; slot++) this.text(labelIndex++, `+${game.board.pocketValue(slot)}`,
      bay.left + bay.w * (slot + 0.5) / 3, COURSE.bankY + POCKET_LABEL_OFFSET);
    for (let index = 0; index < labelIndex; index++) this.labels[index].visible = true;
    const champion = this.ctx.setup.audience?.find(viewer => viewer.userId === this.ctx.setup.crownUserId);
    const carrier = champion ? game.marbles.find(marble => marble.alive
      && marble.team === champion.teamId) : undefined;
    this.balls.render(game.marbles.map(marble => ({ ...marble,
      profileId: marble === carrier ? champion?.userId : undefined,
      name: marble === carrier ? champion!.displayName : marble.team.toUpperCase(),
      hideName: marble !== carrier })), alpha, game.time);
    this.sparks.render(game.time);
    this.bursts.render(game.time);
  }

  destroy(): void {
    this.balls.destroy();
    this.sparks.destroy();
    this.bursts.destroy();
    for (const text of this.labels) text.destroy();
  }
}

export function updateCascadeHud(game: MultiplierCascade): void {
  if (game.relay) {
    game.ctx.hud.setSide?.({ countLabel: 'FIRST TO FIVE',
      subtitle: game.relay.sudden ? 'SUDDEN DEATH' : 'FIRST TO FIVE',
      rows: game.teams.map(team => ({ label: `${team.toUpperCase()} · ${game.relay!.finished.get(team)} / ${RELAY_GOAL}`,
        color: TEAMS[team].hex, names: [`${game.relay!.stock.get(team)} balls`] })), bars: [],
      feed: [] });
    return;
  }
  const room = Math.min(GATE_Y.length, Math.floor(game.camera.y / 400));
  game.ctx.hud.setSide?.({
    countLabel: `${game.units.size} balls`,
    subtitle: CHAMBERS[room],
    bars: [],
    rows: game.teams.map(team => ({ label: team.toUpperCase(), color: TEAMS[team].hex,
      names: [`${[...game.units.values()].filter(unit => unit.marble.team === team).length} balls`] })),
    feed: []
  });
}
