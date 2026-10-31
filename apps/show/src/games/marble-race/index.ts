import { TEAMS, type GameEvent, type RoundResult } from '@chaos/shared';
import type { GameContext, GameDefinition, GameInstance, GameStatus } from '../contract';
import { PX } from '../../engine/physics';
import { NeonSound, viewerColor, rememberTrail } from '../../kit/neon';
import {
  CHECKPOINTS, FINAL_SECTION_TOP, FINISH_Y, GRAVITY, HARD_CAP,
  FINISH_GRACE_SECONDS, MAX_ENTRANTS, MODULE_HEIGHT, RADIUS, START_Y
} from './config';
import { RaceCamera } from './camera';
import { RaceCourse } from './course';
import { RaceView } from './view';
import { factionStandings, scoreRaceTake } from './scoring';
import type { Racer } from './types';
import { RaceHype } from './hype';

export class MarbleRace implements GameInstance {
  readonly marbles: Racer[] = [];
  readonly course: RaceCourse;
  readonly events: GameEvent[] = [];
  time = 0;
  private started = false;
  private result?: RoundResult;
  private view?: RaceView;
  private sound: NeonSound;
  readonly camera = new RaceCamera();
  private lastBounce = -1;
  private finishCount = 0;
  private firstFinishAt?: number;
  private suddenDeathStarted = false;
  private hype: RaceHype;

  constructor(readonly ctx: GameContext) {
    if (ctx.setup.participants.length > MAX_ENTRANTS) throw new Error('Marble Race admits at most 48 entrants');
    ctx.physics.world.gravity = { x: 0, y: GRAVITY };
    ctx.physics.world.numSolverIterations = 8;
    this.course = new RaceCourse(ctx);
    this.sound = new NeonSound(ctx);
    this.hype = new RaceHype(ctx);
    const slots = ctx.rng.shuffle(ctx.setup.participants.map((_, index) => index));
    const columns = Math.min(24, ctx.setup.participants.length);
    for (const [index, owner] of ctx.setup.participants.entries()) {
      const slot = slots[index];
      const x = 960 + ((slot % columns) - (columns - 1) / 2) * 34;
      const y = START_Y + Math.floor(slot / columns) * 36;
      const body = ctx.physics.ball(x, y, RADIUS, {
        restitution: 0.5, friction: 0.06, entity: owner.userId
      });
      body.setLinearDamping(0.012);
      const team = owner.teamId ?? 'chat';
      const color = ctx.setup.mode === 'faction' && owner.teamId
        ? TEAMS[owner.teamId].hex : viewerColor(owner);
      this.marbles.push({ id: owner.userId, name: owner.displayName, owner,
        team, body, x, y, prevX: x, prevY: y, color, radius: RADIUS,
        checkpoint: 0, checkpointTimes: [], alive: true, finished: false, trail: [] });
    }
    ctx.physics.onCollision = (a, b, started) => {
      if (!started) return;
      const racer = this.marbles.find(marble => marble.id === a || marble.id === b);
      if (!racer || !racer.alive) return;
      const gate = this.course.breakthrough.hit(a === racer.id ? b : a, this.time);
      if (gate) {

        this.emit({ t: 'activity', time: this.time, kind: 'hit' });
        if (gate.brokenAt !== undefined) {
          this.sound.pass(3);
          this.emit({ t: 'moment', text: 'GATE BROKEN · THE CHASE IS ON', intensity: 2 });
        }
      }
      if (this.time - this.lastBounce < 0.045) return;
      const velocity = racer.body.linvel();
      this.sound.bounce(Math.hypot(velocity.x, velocity.y) * PX);
      this.lastBounce = this.time;
    };
    if (!ctx.headless) this.view = new RaceView(ctx);
  }

  start(): void {
    this.started = true;
    if (!this.marbles.length) this.complete();
  }

  step(dt: number): void {
    if (!this.started || this.result) return;
    this.time += dt;
    this.ctx.hype.at(this.time);
    if (this.time >= HARD_CAP - 0.000001) this.suddenDeath();
    this.course.step(this.time);
    for (const racer of this.marbles) {
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      // Waking sleeping contacts lets visible moving machinery carry its load.
      if (racer.alive && racer.body.isSleeping()) racer.body.wakeUp();
    }
    this.ctx.physics.step();
    const crossing: { racer: Racer; fraction: number }[] = [];
    for (const racer of this.marbles) {
      if (!racer.alive) continue;
      const position = this.ctx.physics.position(racer.body);
      racer.x = position.x;
      racer.y = position.y;
      if (!Number.isFinite(racer.x + racer.y)) throw new Error('Non-finite race position');
      if (!this.ctx.headless) rememberTrail(racer.trail, racer.x, racer.y);
      while (racer.checkpoint < CHECKPOINTS.length
        && racer.prevY < CHECKPOINTS[racer.checkpoint]
        && racer.y >= CHECKPOINTS[racer.checkpoint]) {
        racer.checkpoint++;
        racer.checkpointTimes.push(this.time);
        this.emit({ t: 'activity', time: this.time, kind: 'checkpoint' });
        this.sound.pass(racer.checkpoint);
      }
      if (racer.prevY < FINISH_Y && racer.y >= FINISH_Y) crossing.push({ racer,
        fraction: (FINISH_Y - racer.prevY) / (racer.y - racer.prevY) });
    }
    for (const { racer, fraction } of crossing.sort((a, b) => a.fraction - b.fraction)) {
      const finishTime = this.time - dt + dt * fraction;
      if (this.firstFinishAt !== undefined
        && finishTime > this.firstFinishAt + FINISH_GRACE_SECONDS + 0.000001) continue;
      racer.finished = true;
      racer.place = ++this.finishCount;
      racer.finishTime = finishTime;
      this.firstFinishAt ??= finishTime;
      racer.alive = false;
      this.ctx.physics.remove(racer.body);
      this.emit({ t: 'finish', who: racer.name, place: racer.place });
      this.hype.finish(racer, this.suddenDeathStarted);
    }
    this.updateHud(dt);
    if (this.firstFinishAt !== undefined
      && this.time >= this.firstFinishAt + FINISH_GRACE_SECONDS - 0.000001) this.complete();
  }

  suddenDeath(): void {
    if (this.suddenDeathStarted || this.result) return;
    this.suddenDeathStarted = true;
    this.course.open(this.time);
    this.ctx.hud.announce('SUDDEN DEATH · COURSE OPENING', 3);
    this.emit({ t: 'moment', text: 'SUDDEN DEATH · COURSE OPENING', intensity: 3 });
  }

  private updateHud(dt: number): void {
    const order = [...this.marbles].sort((a, b) =>
      (a.place ?? Infinity) - (b.place ?? Infinity) || b.y - a.y);
    const leader = order[0];
    this.ctx.camera.follow({ x: 960, y: this.camera.step(this.marbles, dt) }, 1);
    const module = this.course.modules.find(part => leader && leader.y >= part.y && leader.y < part.y + MODULE_HEIGHT);
    const name = module?.kind.toUpperCase() ?? (leader && leader.y > FINAL_SECTION_TOP ? 'FINAL STRAIGHT' : 'START FUNNEL');
    this.ctx.hud.setMetric('MARBLE RACE', `${name} · FINISHED ${this.finishCount}/${this.marbles.length}`);
    this.ctx.hud.setSide?.({
      countLabel: `finished ${this.finishCount}/${this.marbles.length}`,
      subtitle: this.firstFinishAt !== undefined ? 'Winner home · the field is still racing'
        : this.ctx.setup.mode === 'faction' ? 'Best average place · team top 3' : 'First over the line wins',
      rows: order.slice(0, 3).map((racer, index) => ({ label: `${index + 1}${['ST', 'ND', 'RD'][index] ?? 'TH'}${racer.finished ? ' · PODIUM' : ''}`,
        names: [racer.name, racer.finished ? `FINISHED ${racer.place}` : `${Math.floor(this.progress(racer) / 6 * 100)}%`], color: racer.color })),
      feed: this.course.modules.map((part, index) => `${index + 1}. ${part.kind.toUpperCase()}`)
    });
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
    this.ctx.emit(event);
  }

  private complete(): void {
    const champion = this.marbles.find(racer => racer.place === 1);
    const faction = this.ctx.setup.mode === 'faction';
    const standings = factionStandings(this.marbles);
    const winner = faction && champion && standings[0] ? { kind: 'team' as const, teamId: standings[0].teamId }
      : champion ? { kind: 'chat' as const }
      : { kind: 'void' as const, reason: 'No entrants joined the race' };
    this.result = {
      winner, mvps: [], highlights: this.events,
      champion: !faction && champion ? { userId: champion.id,
        displayName: champion.name, reason: 'FIRST ACROSS THE FINISH LINE' } : undefined,
      standings: faction ? standings.map(({ teamId, score, stat }) => ({ teamId, score, stat })) : undefined,
      perUser: Object.fromEntries(this.marbles.map(racer => [racer.id, {
        score: racer.finished ? this.marbles.length + 1 - racer.place! : 0,
        tags: [...(racer.finished ? [`place:${racer.place}`] : ['dnf']),
          ...(winner.kind === 'team' && racer.team === winner.teamId || !faction && racer === champion ? ['win'] : [])]
      }])),
      replay: { seed: this.ctx.setup.seed, inputs: [] }
    };
    this.ctx.hud.setSide?.({
      countLabel: `finished ${this.finishCount}/${this.marbles.length}`,
      subtitle: faction ? 'Team standings · lowest average wins' : 'The podium · every place earned',
      rows: this.marbles.filter(racer => racer.finished).sort((a, b) => a.place! - b.place!).slice(0, 3)
        .map(racer => ({ label: `${racer.place}${['ST', 'ND', 'RD'][racer.place! - 1]} · PODIUM`,
          names: [racer.name, `${racer.finishTime!.toFixed(2)}s`], color: racer.color })),
      feed: faction ? [...standings.map(row => `${row.teamId.toUpperCase()} · ${row.stat}`),
        `DNF counts as place ${this.marbles.length + 1}`] : []
    });
  }

  private progress(racer: Racer): number {
    return racer.finished ? 6 : Math.max(0, Math.min(5.999,
      (racer.y - START_Y) / (FINISH_Y - START_Y) * 6));
  }

  takeState(): number[] {
    return this.marbles.map(racer => racer.finished ? 6 : racer.alive ? this.progress(racer) : -1);
  }

  inspect() {
    return { time: this.time, keys: [], details: {
      modules: this.course.modules, finished: this.finishCount, total: this.marbles.length,
      firstFinishAt: this.firstFinishAt,
      graceEndsAt: this.firstFinishAt === undefined ? undefined : this.firstFinishAt + FINISH_GRACE_SECONDS,
      suddenDeath: this.suddenDeathStarted,
      gates: this.course.breakthrough.gates.map(gate => ({ id: gate.id, x: gate.x, y: gate.y,
        damage: gate.damage, brokenAt: gate.brokenAt })),
      podium: this.marbles.filter(racer => racer.finished).sort((a, b) => a.place! - b.place!).slice(0, 3)
        .map(racer => ({ id: racer.id, name: racer.name, place: racer.place, time: racer.finishTime })),
      camera: { y: this.camera.y, targetY: this.camera.targetY, velocity: this.camera.velocity },
      places: this.marbles.filter(racer => racer.finished).map(racer =>
        ({ id: racer.id, place: racer.place, time: racer.finishTime })),
      checkpoints: this.marbles.map(racer => ({ id: racer.id, times: racer.checkpointTimes })),
      machines: this.course.machines.filter(machine => machine.body.isValid()).map(machine => ({ kind: machine.kind,
        x: machine.x, y: machine.y, angle: machine.body.rotation() }))
    }, marbles: this.marbles.map(racer => ({ id: racer.id, name: racer.name,
      team: racer.team, x: racer.x, y: racer.y, radius: racer.radius,
      alive: racer.alive, dormant: false, isStreamer: false, boost: 0,
      heat: 0, staged: false, finished: racer.finished })) };
  }

  render(alpha: number): void { this.view?.render(this.course, this.marbles, this.time, alpha); }
  onChat(): void {}
  onStreamer(): void {}
  onJoin(): boolean { return false; }
  status(): GameStatus { return this.result ? { done: this.result } : 'playing'; }
  destroy(): void {
    this.view?.destroy();
    for (const racer of this.marbles) if (racer.body.isValid()) this.ctx.physics.remove(racer.body);
    this.course.destroy();
  }
}

const definition: GameDefinition = {
  id: 'marble-race', title: 'MARBLE RACE',
  tagline: 'Split, rejoin, race to the finish.',
  archetype: 'runner', tier: 1, modes: ['cvs', 'faction'], formats: ['ffa', 'faction'],
  durationSec: { target: 105, hardCap: HARD_CAP }, maxBodies: 64,
  ending: 'natural',
  maxParticipants: MAX_ENTRANTS, defaultBots: 24, participantNoun: 'marble',
  joinOnly: true, competition: 'individual', presentation: 'minimal', camera: 'scroll',
  chatVerbs: [], streamerControls: [], supportsModifiers: [],
  scoreTake: scoreRaceTake, create: ctx => new MarbleRace(ctx)
};

export default definition;
