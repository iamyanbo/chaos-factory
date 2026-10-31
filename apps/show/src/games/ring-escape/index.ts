import type { RoundResult } from '@chaos/shared';
import type { GameContext, GameDefinition, GameInstance, GameStatus } from '../contract';
import { PX } from '../../engine/physics';
import { NeonSound, rememberTrail } from '../../kit/neon';
import { scoreRingTake } from './score';
import { createRings, hazardState, turnRings, widenGap } from './rings';
import { createRunners, deepestFirst, fieldRadius, type Runner } from './runners';
import { escapedChampion, makeResult, updateHud } from './outcome';
import { RingView } from './view';
import { RingHype } from './hype';
import {
  BOUNCE_GAIN, CENTER, MAX_SPEED, PASS_FLASH_SECONDS, PASS_GROWTH,
  POP_SOUND_DAMAGE, RADII, SPEED_FLASH_SECONDS, SPEED_UP_GAIN, SPEED_UP_INTERVAL, STROKE,
  MAX_ROTATION, SUDDEN_DEATH_AT, SUDDEN_GAP_SPEED, SUDDEN_MAX_GAP
} from './config';

export type { Runner } from './runners';

export class RingRun implements GameInstance {
  time = 0;
  readonly rings;
  readonly marbles: Runner[];
  readonly faction: boolean;
  readonly target = 1;
  private suddenAt?: number;
  speedFlashUntil = 0;
  finale = false;
  private started = false;
  private result?: RoundResult;
  private view?: RingView;
  private sound: NeonSound;
  private speedStage = 0;
  private hazardTouches = new Map<string, Set<string>>();
  private feedback: RingHype;

  constructor(readonly ctx: GameContext) {
    this.faction = ctx.setup.format === 'faction'
      || (!ctx.setup.format && ctx.setup.mode === 'faction');
    ctx.physics.world.gravity = { x: 0, y: 0 };
    this.rings = createRings(ctx, fieldRadius(ctx.setup.participants.length));
    this.marbles = createRunners(ctx, this.faction);
    this.sound = new NeonSound(ctx);
    this.feedback = new RingHype(ctx);
    ctx.physics.onCollision = (a, b, started) => {
      this.trackContact(a, b, started);
      this.trackContact(b, a, started);
    };
    if (!ctx.headless) this.view = new RingView(ctx);
    updateHud(ctx, this.marbles, this.faction);
  }

  start(): void {
    this.started = true;
    if (!this.marbles.length) this.complete(undefined, 'No entrants');
  }

  step(dt: number): void {
    if (!this.started || this.result) return;
    this.time += dt;
    this.ctx.hype.at(this.time);
    if (this.time >= SUDDEN_DEATH_AT) this.suddenDeath();
    if (this.suddenAt !== undefined) {
      for (const ring of this.rings) widenGap(ring, Math.min(SUDDEN_MAX_GAP,
        ring.baseGap + (this.time - this.suddenAt) * SUDDEN_GAP_SPEED));
    }
    this.escalate();
    turnRings(this.rings, dt);
    for (const marble of this.marbles) {
      marble.prevX = marble.x;
      marble.prevY = marble.y;
    }
    const incoming = this.marbles.map(m => ({ ...m.body.linvel() }));
    this.ctx.physics.step();
    for (const [index, marble] of this.marbles.entries()) {
      if (!marble.alive) continue;
      const position = this.ctx.physics.position(marble.body);
      marble.x = position.x;
      marble.y = position.y;
      this.bounce(marble, incoming[index]);
      const touching = this.hazardTouches.get(marble.id);
      if (!marble.finished && touching && [...touching].some(arc => this.deadly(arc))) {
        this.pop(marble);
        continue;
      }
      if (!this.ctx.headless) rememberTrail(marble.trail, marble.x, marble.y);
      if (!marble.finished) this.pass(marble, dt);
    }
    this.feedback.observe(this.marbles, this.rings, this.time);
    if (!this.ctx.headless) updateHud(this.ctx, this.marbles, this.faction, this.suddenAt !== undefined);
    const champion = escapedChampion(this.marbles);
    if (champion) {
      this.complete(champion, 'FIRST MARBLE THROUGH ALL FIVE RINGS');
    } else {
      const living = this.marbles.filter(marble => marble.alive);
      if (living.length === 1 && this.marbles.length > 1) this.complete(living[0], 'LAST SURVIVOR');
      else if (!living.length) this.complete(undefined, 'All marbles popped simultaneously');
    }
  }

  suddenDeath(): void {
    if (this.suddenAt !== undefined) return;
    this.suddenAt = this.time;
    this.ctx.emit({ t: 'moment', text: 'SUDDEN DEATH: GAPS OPENING', intensity: 2 });
  }

  private trackContact(arc: string, runner: string, started: boolean): void {
    if (!arc.startsWith('hazard:')) return;
    const touching = this.hazardTouches.get(runner) ?? new Set<string>();
    if (started) touching.add(arc);
    else touching.delete(arc);
    if (touching.size) this.hazardTouches.set(runner, touching);
    else this.hazardTouches.delete(runner);
  }

  private deadly(entity: string): boolean {
    if (!entity.startsWith('hazard:')) return false;
    const [, ring, arc] = entity.split(':');
    const hazard = this.rings[Number(ring)]?.hazards[Number(arc)];
    return Boolean(hazard && hazardState(hazard, this.time) === 'deadly');
  }

  private escalate(): void {
    const stage = Math.floor((this.time + 0.000001) / SPEED_UP_INTERVAL);
    if (stage <= this.speedStage) return;
    let accelerated = false;
    for (const ring of this.rings) {
      const speed = Math.sign(ring.speed) * Math.min(MAX_ROTATION,
        Math.abs(ring.speed) * SPEED_UP_GAIN ** (stage - this.speedStage));
      accelerated ||= Math.abs(speed - ring.speed) > 0.000001;
      ring.speed = speed;
    }
    this.speedStage = stage;
    if (accelerated) this.speedFlashUntil = this.time + SPEED_FLASH_SECONDS;
  }

  private bounce(marble: Runner, incoming: { x: number; y: number }): void {
    const velocity = marble.body.linvel();
    const changed = Math.hypot(velocity.x - incoming.x, velocity.y - incoming.y) > 0.00001;
    // With no gravity or damping, only a real solver impulse changes velocity.
    if (!changed) return;
    const speed = Math.hypot(velocity.x, velocity.y);
    const nextSpeed = Math.min(MAX_SPEED / PX, speed * BOUNCE_GAIN);
    if (speed > 0) marble.body.setLinvel({
      x: velocity.x * nextSpeed / speed,
      y: velocity.y * nextSpeed / speed
    }, true);
    this.sound.bounce(speed * PX);
  }

  private pass(marble: Runner, dt: number): void {
    const distance = Math.hypot(marble.x - CENTER.x, marble.y - CENTER.y);
    const before = Math.hypot(marble.prevX - CENTER.x, marble.prevY - CENTER.y);
    // The whole newly enlarged ball must clear the stroke before awarding a pass.
    const boundary = RADII[marble.depth] + STROKE / 2 + marble.radius * PASS_GROWTH;
    if (distance <= boundary || before > boundary) return;
    const fraction = (boundary - before) / Math.max(0.000001, distance - before);
    this.rings[marble.depth].flashUntil = this.time + PASS_FLASH_SECONDS;
    marble.depth++;
    marble.arrivedAt = this.time - dt + fraction * dt;
    marble.radius *= PASS_GROWTH;
    this.ctx.physics.radius(marble.body, marble.radius);
    if (marble.depth === RADII.length - 1 && !this.finale) {
      this.finale = true;
      this.sound.setOctave(1);
    }
    this.ctx.emit({ t: 'pass', time: this.time, ring: marble.depth });
    this.sound.pass(marble.depth);
    marble.finished = marble.depth === RADII.length;
    this.feedback.pass(marble, this.rings[marble.depth - 1], this.time);
  }

  private pop(marble: Runner): void {
    marble.alive = false;
    marble.body.setEnabled(false);
    const velocity = marble.body.linvel();
    this.view?.pop(marble, this.time);
    this.sound.hit(Math.hypot(velocity.x, velocity.y) * PX, POP_SOUND_DAMAGE, true);
    this.ctx.emit({ t: 'activity', time: this.time, kind: 'hit' });
    this.ctx.emit({ t: 'elim', victim: marble.id, cause: 'red arc' });
    this.feedback.pop(marble);
  }

  private complete(champion: Runner | undefined, reason: string): void {
    this.result = makeResult(this.ctx, this.marbles, this.faction, champion, reason);
  }

  takeState(): number[] {
    return this.marbles.map(m => m.alive ? m.depth : -1);
  }

  inspect() {
    return {
      time: this.time, keys: [], details: {
        version: 6, angles: this.rings.map(r => r.angle), gaps: this.rings.map(r => r.gap), speed: MAX_SPEED,
        ringSpeeds: this.rings.map(r => r.speed), speedStage: this.speedStage,
        target: this.target, finale: this.finale, suddenDeath: this.suddenAt !== undefined,
        redArcs: this.rings.map(ring => ring.hazards.map(arc => hazardState(arc, this.time)))
      },
      marbles: this.marbles.map(m => ({
        id: m.id, name: m.owner.displayName, team: m.team ?? 'chat',
        x: m.x, y: m.y, radius: m.radius, alive: m.alive, dormant: false,
        isStreamer: false, boost: 0, heat: 0, staged: false, finished: m.finished
      }))
    };
  }

  render(alpha: number): void {
    this.view?.render(this.rings, this.marbles, this.time, alpha,
      this.speedFlashUntil, this.finale);
  }

  onChat(): void {}
  onStreamer(): void {}
  onJoin(): boolean { return false; }

  status(): GameStatus {
    return this.result ? { done: this.result } : 'playing';
  }

  destroy(): void {
    this.view?.destroy();
    this.ctx.physics.onCollision = () => {};
    for (const marble of this.marbles) this.ctx.physics.remove(marble.body);
    for (const ring of this.rings) this.ctx.physics.remove(ring.body);
  }
}

const definition: GameDefinition = {
  id: 'ring-escape', title: 'RING RUN+',
  tagline: 'Escape five rings. First out or last survivor wins.',
  ending: 'natural',
  archetype: 'luck', tier: 1, modes: ['cvs', 'faction'], formats: ['ffa', 'faction'],
  durationSec: { target: 90, hardCap: SUDDEN_DEATH_AT },
  maxBodies: 69, maxParticipants: 64, defaultBots: 24, participantNoun: 'marble',
  joinOnly: true, competition: 'individual', presentation: 'minimal', camera: 'fixed',
  chatVerbs: [], streamerControls: [], supportsModifiers: [],
  scoreTake: scoreRingTake,
  create: ctx => new RingRun(ctx)
};

export default definition;
