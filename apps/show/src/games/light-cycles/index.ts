import type { RoundResult } from '@chaos/shared';
import type { GameContext, GameDefinition, GameInstance, GameStatus } from '../contract';
import { NeonSound, rememberTrail, viewerColor, type NeonBall } from '../../kit/neon';
import {
  CELL_SIZE, CLOSE_AT, CRASH_SOUND_DAMAGE, DEFAULT_PLAYERS, FEED_LENGTH, GRID_SIZE,
  HEAD_RADIUS, HUD_REFRESH_TICKS, MAX_PLAYERS, ROUND_LIMIT, ROUND_TARGET, SPEED_UP_AT,
  TAKE_BASE_SCORE, TAKE_DURATION_WEIGHT, TAKE_MIN_DURATION, TAKE_QUIET_LIMIT,
  TAKE_QUIET_WEIGHT, TAKE_UNFINISHED_PENALTY, TURN_TONE_INTERVAL, speedAt
} from './config';
import { LightModel } from './model';
import { buildResult, updateHud } from './state';
import { LightView } from './view';
import { LightHype } from './hype';

export class LightCycles implements GameInstance {
  readonly model: LightModel;
  readonly marbles: NeonBall[];
  private sound: NeonSound;
  private view?: LightView;
  private started = false;
  private result?: RoundResult;
  private feed: string[] = [];
  private lastTone = -Infinity;
  private ticks = 0;
  private sudden = false;
  private feedback: LightHype;

  constructor(readonly ctx: GameContext) {
    ctx.physics.world.gravity = { x: 0, y: 0 };
    this.model = new LightModel(ctx.setup.participants.length, ctx.rng);
    this.marbles = this.model.cycles.map(cycle => {
      const owner = ctx.setup.participants[cycle.ordinal];
      return { id: owner.userId, profileId: owner.userId, name: owner.displayName,
        x: cycle.x, y: cycle.y, prevX: cycle.x, prevY: cycle.y,
        radius: HEAD_RADIUS, color: viewerColor(owner), alive: true, trail: [] };
    });
    this.sound = new NeonSound(ctx);
    this.feedback = new LightHype(ctx);
    if (!ctx.headless) this.view = new LightView(ctx);
  }

  get time(): number { return this.model.time; }

  start(): void {
    this.started = true;
    const living = this.model.cycles.filter(cycle => cycle.alive);
    if (living.length <= 1) this.result = buildResult(this.ctx, this.model, living[0]?.ordinal, 'No entrants');
  }

  step(dt: number): void {
    if (!this.started || this.result) return;
    this.feedback.before(this.model);
    const events = this.model.step(dt);
    this.ctx.hype.at(this.time);
    if (this.time >= ROUND_LIMIT) this.suddenDeath();
    for (const cycle of this.model.cycles) {
      const actor = this.marbles[cycle.ordinal];
      Object.assign(actor, { x: cycle.x, y: cycle.y, prevX: cycle.prevX,
        prevY: cycle.prevY, alive: cycle.alive });
      if (!this.ctx.headless && cycle.alive) rememberTrail(actor.trail!, cycle.x, cycle.y);
    }
    if (events.turns.length && this.time - this.lastTone >= TURN_TONE_INTERVAL) {
      this.sound.bounce(speedAt(this.time) * CELL_SIZE);
      this.lastTone = this.time;
    }
    for (const crash of events.crashes) {
      const victim = this.ctx.setup.participants[crash.ordinal];
      const by = crash.by === undefined ? undefined : this.ctx.setup.participants[crash.by];
      this.ctx.emit({ t: 'elim', victim: victim.userId, by: by?.userId, cause: crash.cause });
      this.ctx.emit({ t: 'activity', time: this.time, kind: 'hit' });
      this.feedback.crash(crash, this.marbles, this.model);
      this.sound.hit(speedAt(this.time) * CELL_SIZE, CRASH_SOUND_DAMAGE, true);
      this.view?.crash(crash.x, crash.y, this.marbles[crash.ordinal].color, this.time);
      this.feed.unshift(by && by !== victim ? `${by.displayName} cut off ${victim.displayName}`
        : `${victim.displayName} hit ${crash.cause === 'wall' ? 'the wall' : 'a trail'}`);
    }
    this.feed = this.feed.slice(0, FEED_LENGTH);
    this.feedback.observe(this.model, events, this.marbles);
    if (!this.ctx.headless && this.ticks++ % HUD_REFRESH_TICKS === 0) updateHud(this.ctx, this.model, this.feed);
    const living = this.model.cycles.filter(cycle => cycle.alive);
    if (living.length <= 1) this.result = buildResult(this.ctx, this.model, living[0]?.ordinal);
  }

  suddenDeath(): void {
    if (this.sudden) return;
    this.sudden = true;
    this.ctx.emit({ t: 'moment', text: 'SUDDEN DEATH: WALLS CLOSING', intensity: 2 });
  }

  takeState(): number[] {
    return this.model.cycles.map(cycle => cycle.alive ? 6 : -1);
  }

  inspect() {
    return { time: this.time, keys: [],
      details: { grid: GRID_SIZE, phase: this.model.phase, border: this.model.grid.border,
        speed: speedAt(this.time) * CELL_SIZE,
        stage: this.time >= CLOSE_AT ? 2 : this.time >= SPEED_UP_AT ? 1 : 0, suddenDeath: this.sudden },
      marbles: this.marbles.map(actor => ({ ...actor, alive: actor.alive !== false,
        isStreamer: false, finished: false })) };
  }

  render(alpha: number): void { this.view?.render(this.model, this.marbles, alpha); }
  status(): GameStatus { return this.result ? { done: this.result } : 'playing'; }
  onChat(): void {}
  onStreamer(): void {}
  onJoin(): boolean { return false; }
  destroy(): void { this.view?.destroy(); }
}

const definition: GameDefinition = {
  id: 'light-cycles', title: 'LIGHT CYCLES',
  ending: 'natural',
  tagline: 'Solid trails are walls. Automatic turns. Last cycle still riding wins.',
  archetype: 'luck', tier: 1, modes: ['cvs'], formats: ['ffa'],
  durationSec: { target: ROUND_TARGET, hardCap: ROUND_LIMIT },
  maxBodies: MAX_PLAYERS, maxParticipants: MAX_PLAYERS, defaultBots: DEFAULT_PLAYERS,
  participantNoun: 'cycle', competition: 'individual', joinOnly: true,
  presentation: 'minimal', camera: 'fixed', chatVerbs: [], streamerControls: [], supportsModifiers: [],
  predictionTitle: () => 'Light Cycles: last cycle standing?',
  scoreTake: events => TAKE_BASE_SCORE
    - Math.max(0, TAKE_MIN_DURATION - events.duration, events.duration - ROUND_LIMIT) * TAKE_DURATION_WEIGHT
    - Math.max(0, events.quietMax - TAKE_QUIET_LIMIT) * TAKE_QUIET_WEIGHT
    - (events.finished ? 0 : TAKE_UNFINISHED_PENALTY),
  create: ctx => new LightCycles(ctx)
};

export default definition;
