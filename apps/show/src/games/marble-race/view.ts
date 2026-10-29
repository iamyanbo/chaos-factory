import { Graphics, Text } from 'pixi.js';
import type { GameContext } from '../contract';
import { NeonBalls, WHITE, strokeArc, strokeLine } from '../../kit/neon';
import { FINISH_Y, LEFT, RIGHT, TRAP_CLOSED } from './config';
import type { RaceCourse } from './course';
import type { Racer } from './types';
import { peg, TOY } from '../../kit/theme';

const SHOW_NAME_DISTANCE = 112;
const HIDE_NAME_DISTANCE = 82;
const NAME_HOLD_SECONDS = 0.45;
const LEADER_LABEL_SECONDS = 0.3;
const DOOR_TIMER_OFFSET = 38;
const DOOR_TIMER_HEIGHT = 54;
const DOOR_TIMER_RADIUS = 24;
const MACHINE_COLORS = { paddle: TOY.color.orange, seesaw: TOY.color.green, door: TOY.color.accentB };

interface NameVisibility { visible: boolean; changed: number }

export class RaceView {
  private graphics = new Graphics();
  private balls: NeonBalls;
  private places: Text[] = [];
  private names = new Map<string, NameVisibility>();
  private leaderSince = new Map<string, number>();
  private finishLabel: Text;

  constructor(private ctx: GameContext) {
    ctx.stage.world.addChild(this.graphics);
    this.balls = new NeonBalls(ctx);
    this.finishLabel = ctx.stage.labels.addChild(new Text({ text: 'FINISH', style: {
      fontFamily: TOY.font.display, fontSize: 36, fill: TOY.color.yellow,
      stroke: { color: TOY.color.ink, width: 5, join: 'round' }
    } }));
    this.finishLabel.anchor.set(.5);
    this.finishLabel.position.set((LEFT + RIGHT) / 2, FINISH_Y - 42);
  }

  render(course: RaceCourse, racers: Racer[], time: number, alpha: number): void {
    const g = this.graphics;
    g.clear();
    for (const rail of course.rails) {
      if (rail.ax === rail.bx && (rail.ax === LEFT || rail.ax === RIGHT)) continue;
      if (rail.ax !== rail.bx || rail.ay !== rail.by) strokeLine(g, rail.ax, rail.ay, rail.bx, rail.by);
    }
    for (const point of course.pegs) if (point.radius > 0) peg(g, point.x, point.y, point.radius);
    course.breakthrough.draw(g, time);
    for (const machine of course.machines) {
      if (!machine.body.isValid()) continue;
      const position = this.ctx.physics.position(machine.body);
      const angle = machine.body.rotation();
      const half = machine.width / 2;
      const line = (rotation: number) => strokeLine(g,
        position.x - Math.cos(rotation) * half,
        position.y - Math.sin(rotation) * half,
        position.x + Math.cos(rotation) * half,
        position.y + Math.sin(rotation) * half, MACHINE_COLORS[machine.kind]);
      line(angle);
      if (machine.kind === 'paddle') line(angle + Math.PI / 2);
      if (machine.kind !== 'door') peg(g, machine.x, machine.y, 12, MACHINE_COLORS[machine.kind]);
      else {
        peg(g, machine.x, machine.y, 10, TOY.color.accentA);
        const remaining = course.trapRemaining(time, machine.timeOffset);
        if (remaining > 0) strokeArc(g, machine.x - machine.direction * DOOR_TIMER_OFFSET,
          machine.y - DOOR_TIMER_HEIGHT, DOOR_TIMER_RADIUS,
          -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / TRAP_CLOSED);
      }
    }
    for (let x = LEFT + 12; x < RIGHT - 12; x += 28) {
      g.rect(x, FINISH_Y, 14, 12).fill(WHITE);
      g.rect(x + 14, FINISH_Y, 14, 12).fill(TOY.color.ink);
      g.rect(x, FINISH_Y + 12, 14, 12).fill(TOY.color.ink);
      g.rect(x + 14, FINISH_Y + 12, 14, 12).fill(WHITE);
    }
    const leaders = [...racers].sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || b.y - a.y);
    const top = new Set(leaders.slice(0, 8).map(racer => racer.id));
    this.balls.render(racers.map(racer => {
      const state = this.names.get(racer.id) ?? { visible: false, changed: 0 };
      const leader = top.has(racer.id);
      if (leader && !this.leaderSince.has(racer.id)) this.leaderSince.set(racer.id, time);
      else if (!leader) this.leaderSince.delete(racer.id);
      const stableLeader = leader && time - this.leaderSince.get(racer.id)! >= LEADER_LABEL_SECONDS;
      const clearance = state.visible ? HIDE_NAME_DISTANCE : SHOW_NAME_DISTANCE;
      const clear = !racers.some(other => other.id !== racer.id && other.alive
        && Math.hypot(other.x - racer.x, other.y - racer.y) < clearance);
      const visible = stableLeader || clear;
      if (time - state.changed >= NAME_HOLD_SECONDS && state.visible !== visible) {
        state.visible = visible;
        state.changed = time;
      }
      this.names.set(racer.id, state);
      return { ...racer, name: state.visible ? racer.name : '', hideName: !state.visible,
        leader, alive: racer.alive };
    }), alpha, time);
    const finished = racers.filter(racer => racer.finished).sort((a, b) => a.place! - b.place!);
    for (const [index, racer] of finished.slice(0, 8).entries()) {
      const place = this.places[index] ??= this.ctx.stage.labels.addChild(new Text({
        text: '', style: { fontFamily: TOY.font.body, fontSize: 26, fill: TOY.color.ink }
      }));
      place.text = `${racer.place}. ${racer.name}`;
      place.style.fill = TOY.color.ink;
      place.position.set(LEFT + 24 + Math.floor(index / 4) * 460, FINISH_Y + 30 + index % 4 * 22);
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.balls.destroy();
    this.finishLabel.destroy();
    for (const place of this.places) place.destroy();
  }
}
