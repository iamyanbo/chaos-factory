import type { RoundResult } from '@chaos/shared';
import type { GameContext, GameDefinition, GameInstance, GameStatus } from '../contract';
import { PX } from '../../engine/physics';
import { NeonSound } from '../../kit/neon';
import { PegBoard } from './board';
import { FlightPool } from './flights';
import { PegScoring } from './scoring';
import { makeResult, updateHud } from './state';
import { PegView } from './view';
import { scorePegTake } from './take-score';
import { BALLS_PER_VIEWER, GRAVITY, HUD_TICKS, SHOT_INTERVAL, SLOT_TOP,
  SUDDEN_AT, WAVE_SECONDS, WAVE_SIZE, landingSlot } from './config';
import type { Peg, Shot } from './types';

export class PegFever implements GameInstance {
  readonly board: PegBoard;
  readonly flights: FlightPool;
  readonly scoring: PegScoring;
  readonly fired: number[];
  time = 0;
  fever = false;
  sudden = false;
  private started = false;
  private result?: RoundResult;
  private sound: NeonSound;
  private view?: PegView;
  private contacts: [string, string][] = [];
  private pending: number[] = [];
  private cursor = 0;
  private nextWave = 0;
  private nextShot = 0;
  private ticks = 0;
  private hudDirty = true;

  constructor(readonly ctx: GameContext) {
    ctx.physics.world.gravity = { x: 0, y: GRAVITY / PX };
    this.board = new PegBoard(ctx);
    this.flights = new FlightPool(ctx);
    this.scoring = new PegScoring(ctx, this.board, (shot, peg) => this.startFever(shot, peg));
    this.fired = ctx.setup.participants.map(() => 0);
    this.sound = new NeonSound(ctx);
    if (!ctx.headless) this.view = new PegView(ctx);
    ctx.physics.onCollision = (a, b, began) => {
      if (began) this.contacts.push([a, b]);
    };
  }

  get lastBalls(): boolean {
    return this.fired.length > 0 && this.fired.every(count => count === BALLS_PER_VIEWER);
  }

  start(): void {
    this.started = true;
    if (!this.ctx.setup.participants.length) this.result = makeResult(this.ctx, this.scoring);
  }

  step(dt: number): void {
    if (!this.started || this.result) return;
    this.time += dt;
    this.ctx.hype.at(this.time);
    if (this.time >= SUDDEN_AT) this.suddenDeath();
    this.schedule();
    this.flights.before();
    this.board.update(this.time);
    this.ctx.physics.step();
    this.board.sync();
    this.flights.sync();
    const landed = new Set<Shot>();
    for (const [a, b] of this.contacts) {
      const shotId = a.startsWith('shot:') ? a : b.startsWith('shot:') ? b : undefined;
      if (!shotId) continue;
      const shot = this.flights.shots[Number(shotId.slice(5))];
      if (!shot?.active) continue;
      const other = a === shotId ? b : a;
      if (other === 'rack') continue;
      if (other === 'landing-floor' && shot.y > SLOT_TOP) landed.add(shot);
      this.sound.bounce(Math.hypot(...Object.values(shot.body.linvel())) * PX);
      if (!other.startsWith('peg:')) continue;
      const peg = this.board.pegs[Number(other.slice(4))];
      if (peg && this.scoring.hit(shot, peg, this.time)) this.view?.hit(peg, this.time);
    }
    this.contacts = [];
    for (const shot of landed) this.land(shot);
    const active = this.flights.shots.filter(shot => shot.active).length;
    if (!this.ctx.headless && (this.ticks++ % HUD_TICKS === 0 || this.hudDirty)) {
      updateHud(this.ctx, this.scoring, this.fever, this.sudden, active, this.lastBalls);
      this.hudDirty = false;
    }
    if (this.lastBalls && active === 0) this.result = makeResult(this.ctx, this.scoring);
  }

  private schedule(): void {
    const viewers = this.ctx.setup.participants.length;
    const total = viewers * BALLS_PER_VIEWER;
    if (this.cursor < total && !this.pending.length && this.time + 1e-8 >= this.nextWave) {
      const count = Math.min(WAVE_SIZE, total - this.cursor);
      for (let index = 0; index < count; index++) this.pending.push(this.cursor++ % viewers);
      this.nextWave = this.time + WAVE_SECONDS;
    }
    if (this.time + 1e-8 < this.nextShot || !this.pending.length) return;
    const owner = this.pending[0];
    if (!this.flights.launch(owner, this.time)) return;
    this.fired[owner]++;
    if (this.lastBalls) this.hudDirty = true;
    this.pending.shift();
    this.nextShot = this.time + SHOT_INTERVAL;
    this.ctx.emit({ t: 'activity', time: this.time, kind: 'birth' });
  }

  private land(shot: Shot): void {
    const slot = landingSlot(shot.x);
    const landing = this.scoring.settle(shot, slot, this.fever, this.time);
    if (!landing) return;
    this.hudDirty = true;
    this.view?.land(shot, landing);
    this.sound.pass(slot === 4 ? 5 : 2);
    const cleared = this.board.clear(shot.life);
    this.view?.clear(cleared, shot.color, this.time);
    if (landing.total > 0) this.ctx.emit({ t: 'activity', time: this.time, kind: 'checkpoint' });
    this.flights.release(shot);
  }

  private startFever(shot: Shot, peg: Peg): void {
    if (this.fever) return;
    this.fever = true;
    this.hudDirty = true;
    this.sound.setOctave(1);
    const subject = { userId: shot.player.userId, name: shot.name, color: shot.color };
    this.ctx.hype.decisive(shot.x, shot.y, subject);
    this.ctx.hype.callout(peg.x, peg.y, { ...subject, text: 'EXTREME FEVER' });
    this.view?.fever(peg.x, peg.y, this.time);
  }

  suddenDeath(): void {
    if (this.sudden) return;
    this.sudden = true;
    this.board.suddenDeath(this.time);
    this.ctx.emit({ t: 'moment', text: 'SUDDEN DEATH: PEG RACK LIFTS', intensity: 2 });
  }

  takeState(): number[] {
    const maximum = Math.max(1, ...this.scoring.scores);
    return this.scoring.scores.map(score => 6 * score / maximum);
  }

  inspect() {
    return { time: this.time, keys: [], details: {
      version: 2, pegs: this.board.pegs.filter(peg => !peg.removed).length,
      orange: this.scoring.remaining, scores: [...this.scoring.scores],
      fired: [...this.fired], landed: [...this.scoring.landed],
      lastBalls: this.lastBalls, fever: this.fever, suddenDeath: this.sudden,
      stage: this.fever ? 2 : this.scoring.remaining <= 10 || this.lastBalls ? 1 : 0,
      rackLift: this.board.lift, landings: this.scoring.landings.map(landing => ({ ...landing })),
      shots: this.flights.shots.filter(shot => shot.active).map(shot => ({
        life: shot.life, owner: shot.owner, combo: shot.combo,
        multiplier: shot.multiplier, points: shot.points }))
    }, marbles: this.flights.shots.map(shot => ({ id: shot.id, x: shot.x, y: shot.y,
      alive: shot.active, dormant: !shot.active, isStreamer: false })) };
  }

  render(alpha: number): void { this.view?.render(this, alpha); }
  onChat(): void {}
  onStreamer(): void {}
  onJoin(): boolean { return false; }
  status(): GameStatus { return this.result ? { done: this.result } : 'playing'; }
  destroy(): void {
    this.ctx.physics.onCollision = () => {};
    this.view?.destroy();
    this.flights.destroy();
    this.board.destroy();
  }
}

const definition: GameDefinition = {
  id: 'peg-fever', title: 'PEG FEVER', ending: 'natural',
  tagline: 'Three balls each. Build a run. Land a multiplier. Highest total wins.',
  archetype: 'luck', tier: 1, modes: ['cvs', 'faction'], formats: ['ffa', 'faction'],
  durationSec: { target: 55, hardCap: SUDDEN_AT }, maxBodies: 64,
  maxParticipants: 64, defaultBots: 24, maxTeams: 4, participantNoun: 'viewer',
  competition: 'individual', joinOnly: true, presentation: 'minimal', camera: 'fixed',
  takeActivities: ['hit', 'checkpoint'], chatVerbs: [], streamerControls: [], supportsModifiers: [],
  predictionTitle: setup => setup.mode === 'faction' ? 'Peg Fever: highest scoring team?' : 'Peg Fever: highest score?',
  scoreTake: scorePegTake,
  create: ctx => new PegFever(ctx)
};

export default definition;
