import type { Graphics } from 'pixi.js';
import { TEAMS, type TeamId } from '@chaos/shared';
import type { GameContext } from '../contract';
import { PX, type RAPIER } from '../../engine/physics';
import { MachineGeometry } from '../../kit/machine-geometry';
import { WHITE, strokeLine } from '../../kit/neon';
import type { Marble } from '../../kit/marble';
import type { Unit } from './types';
import { BALL_RADIUS, COURSE, LINE_WIDTH, RELAY_TOP } from './course-layout';
import { drawBody, drawGeometry } from './geometry-view';
import { wall, toyColor } from '../../kit/theme';

export const RELAY_GOAL = 5;
export const RELAY_BASE_STOCK = 5;
export const RELAY_FINISH_Y = RELAY_TOP + 1020;
const FEED_SECONDS = .16;
const MAX_IN_FLIGHT = 112;
const FEED_Y = RELAY_TOP + 100;
const CLOSED_GAP = 44;
const OPEN_TRAVEL = 48;
const GATE_PERIOD = 4.8;
const SUDDEN_TRAVEL = 100;
interface Lip { body: RAPIER.RigidBody; x: number; y: number; side: number; phase: number }

/** The three multiplier drops supply this final, shared first-to-five race. */
export class CascadeRelay {
  readonly stock = new Map<TeamId, number>();
  readonly finished = new Map<TeamId, number>();
  readonly frame: MachineGeometry;
  readonly lips: Lip[] = [];
  readonly seats: TeamId[];
  winner?: TeamId;
  sudden = false;
  private nextFeed = 0;
  private previous = new Map<string, number>();
  private decisive = false;
  private lastLeader?: TeamId;
  private pendingTeam?: TeamId;

  constructor(private ctx: GameContext, teams: TeamId[], supply: Map<TeamId, number>) {
    this.seats = ctx.rng.shuffle(teams);
    for (const team of teams) {
      this.stock.set(team, RELAY_BASE_STOCK + (supply.get(team) ?? 0));
      this.finished.set(team, 0);
    }
    this.frame = new MachineGeometry(ctx);
    this.frame.rail(COURSE.left, RELAY_TOP + 540, LINE_WIDTH, 1032);
    this.frame.rail(COURSE.right, RELAY_TOP + 540, LINE_WIDTH, 1032);
    this.frame.rail(960, RELAY_TOP + 1056, COURSE.right - COURSE.left, LINE_WIDTH);
    for (const [row, [center, top, bottom]] of [[900, 170, 350], [1020, 460, 650], [960, 770, 950]].entries()) {
      const phase = ctx.rng.range(0, Math.PI * 2) + row;
      for (const side of [-1, 1]) {
        const outer = side < 0 ? COURSE.left : COURSE.right;
        const inner = center + side * CLOSED_GAP / 2;
        const x = (outer + inner) / 2;
        const y = RELAY_TOP + (top + bottom) / 2;
        const length = Math.hypot(inner - outer, bottom - top);
        const body = ctx.physics.box(x, y, length, LINE_WIDTH, { kinematic: true,
          angle: Math.atan2(bottom - top, inner - outer), friction: .015,
          restitution: .12, entity: 'cascade-relay-lip' });
        this.lips.push({ body, x, y, side, phase });
      }
    }
  }

  port(index: number): number { return COURSE.left + (index + .5) * (COURSE.right - COURSE.left) / this.seats.length; }

  step(age: number, time: number, units: Map<string, Unit>,
    spawn: (team: TeamId, x: number, y: number) => Marble,
    remove: (unit: Unit) => void, onFinish: (team: TeamId, count: number) => void): void {
    if (this.winner) return;
    for (const lip of this.lips) {
      const opening = Math.max(0, Math.sin(age * Math.PI * 2 / GATE_PERIOD + lip.phase));
      const travel = opening * OPEN_TRAVEL + (this.sudden ? SUDDEN_TRAVEL : 0);
      this.ctx.physics.move(lip.body, lip.x + lip.side * travel, lip.y);
    }
    const crossing = [...units.values()].filter(unit => unit.marble.y >= RELAY_FINISH_Y)
      .map(unit => {
        const m = unit.marble;
        const previous = this.previous.get(m.id) ?? m.y;
        return { unit, fraction: (RELAY_FINISH_Y - previous) / Math.max(.001, m.y - previous) };
      }).sort((a, b) => a.fraction - b.fraction);
    for (const { unit } of crossing) {
      const m = unit.marble;
      const team = m.team as TeamId;
      const count = (this.finished.get(team) ?? 0) + 1;
      this.finished.set(team, count);
      remove(unit);
      this.previous.delete(m.id);
      onFinish(team, count);
      if (count === RELAY_GOAL) { this.winner = team; break; }
    }
    for (const unit of units.values()) {
      const m = unit.marble;
      this.previous.set(m.id, m.y);
      if (m.body.isSleeping()) m.body.wakeUp();
      if (!this.decisive && this.finished.get(m.team as TeamId) === RELAY_GOAL - 1 && m.y > RELAY_TOP + 900) {
        this.decisive = true;
        this.ctx.hype.decisive(m.x, m.y, { color: m.color, name: m.team.toUpperCase() });
      }
    }
    const best = Math.max(...this.finished.values());
    const leaders = this.seats.filter(team => this.finished.get(team) === best);
    if (leaders.length === 1) {
      const leader = leaders[0];
      if (this.lastLeader && leader !== this.lastLeader && best >= 3) {
        this.ctx.hype.callout(960, RELAY_TOP + 970, { text: 'COMEBACK', color: TEAMS[leader].hex });
      }
      this.lastLeader = leader;
    }
    if (this.winner || age < this.nextFeed) return;
    this.nextFeed = age + FEED_SECONDS;
    if (units.size >= MAX_IN_FLIGHT || this.ctx.physics.entities.size >= this.ctx.physics.cap) return;
    const available = this.seats.filter(team => this.stock.get(team)! > 0);
    if (!available.length) return;
    // Draw the next ball from the finite, earned supply. A fuller hopper pours
    // more of its color; scores never change an in-flight ball or a gate.
    const team = this.pendingTeam ?? this.ctx.rng.weighted(available.map(value =>
      ({ value, weight: this.stock.get(value)! })));
    this.pendingTeam = team;
    const center = this.port(this.seats.indexOf(team));
    const x = [center - 32, center, center + 32].find(port => ![...units.values()].some(unit =>
      Math.hypot(unit.marble.x - port, unit.marble.y - FEED_Y) < BALL_RADIUS * 2 + 3));
    if (x === undefined) return;
    const marble = spawn(team, x, FEED_Y);
    this.previous.set(marble.id, FEED_Y);
    this.stock.set(team, this.stock.get(team)! - 1);
    this.pendingTeam = undefined;
    this.ctx.emit({ t: 'activity', time, kind: 'birth' });
  }

  draw(g: Graphics): void {
    drawGeometry(g, this.frame);
    for (const lip of this.lips) {
      drawBody(g, lip.body);
      // The visible horizontal bearing explains the slow opening of each lip.
      strokeLine(g, lip.x - 54, lip.y, lip.x + 54, lip.y, WHITE, 2, .35);
    }
    for (const [index, team] of this.seats.entries()) {
      const x = this.port(index);
      wall(g, x - 57, RELAY_TOP + 36, x - 48, FEED_Y - 16, toyColor(TEAMS[team].hex));
      wall(g, x + 48, FEED_Y - 16, x + 57, RELAY_TOP + 36, toyColor(TEAMS[team].hex));
    }
    for (let x = COURSE.left + 12; x < COURSE.right - 12; x += 28) g.rect(x, RELAY_FINISH_Y, 14, 8).fill(WHITE);
  }

  inspect() {
    return { stock: Object.fromEntries(this.stock), finished: Object.fromEntries(this.finished),
      winner: this.winner, goal: RELAY_GOAL, sudden: this.sudden,
      lips: this.lips.map(lip => ({ ...this.ctx.physics.position(lip.body), angle: lip.body.rotation() })) };
  }

  destroy(): void {
    this.ctx.physics.remove(this.frame.body);
    for (const lip of this.lips) this.ctx.physics.remove(lip.body);
  }
}
