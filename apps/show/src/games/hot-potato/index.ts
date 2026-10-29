import type { RoundResult, Winner } from '@chaos/shared';
import type { GameContext, GameDefinition, GameInstance, GameStatus } from '../contract';
import { PX } from '../../engine/physics';
import { NeonSound, rememberTrail } from '../../kit/neon';
import { createPotatoes, leadingPotato, syncPotatoes } from './actors';
import { PotatoArena } from './arena';
import { BombRack, bombSubject } from './bombs';
import { Shockwaves } from './shockwaves';
import { makeResult, scoreTake, updateHud } from './state';
import { PotatoView } from './view';
import { ARENA_RADIUS, BLAST_CREDIT_SECONDS, BOSS_CHAT_THRESHOLD, CENTER,
  DEFAULT_BOTS, HUD_TICKS, MAX_PARTICIPANTS, NEAR_MISS_RADII, RING_OUT_MARGIN,
  SHORT_FUSE_BELOW, SUDDEN_AT, SUDDEN_BURN, TWO_BOMBS_BELOW } from './config';
import type { Potato, Shockwave } from './types';

export class HotPotato implements GameInstance {
  readonly arena: PotatoArena;
  readonly marbles: Potato[];
  readonly bombs: BombRack;
  readonly waves: Shockwaves;
  readonly boss: boolean;
  time = 0;
  sudden = false;
  private started = false;
  private result?: RoundResult;
  private contacts: [string, string][] = [];
  private sound: NeonSound;
  private view?: PotatoView;
  private feed: string[] = [];
  private ticks = 0;

  constructor(readonly ctx: GameContext) {
    this.boss = ctx.setup.format === 'boss';
    ctx.physics.world.gravity = { x: 0, y: 0 };
    this.arena = new PotatoArena(ctx);
    this.marbles = createPotatoes(ctx, this.boss);
    this.bombs = new BombRack(ctx, this.marbles);
    this.waves = new Shockwaves(ctx, this.arena, this.marbles,
      segments => this.view?.breakRim(segments, this.time));
    this.sound = new NeonSound(ctx);
    if (!ctx.headless) this.view = new PotatoView(ctx);
    ctx.physics.onCollision = (a, b, started) => {
      if (started) this.contacts.push([a, b]);
    };
  }

  start(): void {
    this.started = true;
    this.terminal();
    if (!this.result) this.bombs.refill(this.time, true);
    this.hud();
  }

  step(dt: number): void {
    if (!this.started || this.result) return;
    this.time += dt;
    this.ctx.hype.at(this.time);
    if (this.time >= SUDDEN_AT) this.suddenDeath();
    this.bombs.refill(this.time);
    for (const marble of this.marbles) {
      marble.prevX = marble.x;
      marble.prevY = marble.y;
    }
    this.ctx.physics.step();
    syncPotatoes(this.ctx, this.marbles);
    this.processContacts();
    const expired = this.bombs.burn(dt, this.time, this.sudden ? SUDDEN_BURN : 1);
    // Snapshot all expired holders before changing life state: simultaneous blasts stay simultaneous.
    const detonations = expired.map(bomb => ({ bomb, holder: this.marbles[bomb.holder] }));
    for (const { bomb, holder } of detonations) {
      if (!holder.alive) continue;
      const wave = this.waves.add(bomb, holder, this.time);
      this.eliminate(holder, 'bomb', wave);
      this.view?.explosion(holder, bomb, this.time);
    }
    for (const marble of this.marbles) {
      if (!marble.alive) continue;
      this.checkEdge(marble);
      if (!this.ctx.headless && marble.alive) rememberTrail(marble.trail, marble.x, marble.y);
    }
    this.waves.step(this.time);
    this.bombs.removeDead(this.time);
    this.terminal();
    if (this.ticks++ % HUD_TICKS === 0) this.hud();
  }

  private processContacts(): void {
    const actor = (entity: string) => entity.startsWith('potato:')
      ? this.marbles[Number(entity.slice(7))] : undefined;
    const pairs = this.contacts.map(([a, b]) => ({ a: actor(a), b: actor(b) }));
    pairs.sort((a, b) => Math.min(a.a?.ordinal ?? Infinity, a.b?.ordinal ?? Infinity)
      - Math.min(b.a?.ordinal ?? Infinity, b.b?.ordinal ?? Infinity));
    for (const { a, b } of pairs) {
      if (a && b && this.bombs.transfer(a, b, this.time)) {
        const receiver = this.bombs.active.some(bomb => bomb.holder === a.ordinal) ? a : b;
        this.view?.tag(receiver === a ? b : a, receiver, this.time);
      }
      const marble = a ?? b;
      if (marble?.alive) {
        const velocity = marble.body.linvel();
        this.sound.bounce(Math.hypot(velocity.x, velocity.y) * PX);
      }
    }
    this.contacts = [];
  }

  private checkEdge(marble: Potato): void {
    const distance = Math.hypot(marble.x - CENTER.x, marble.y - CENTER.y);
    const death = ARENA_RADIUS + marble.radius + RING_OUT_MARGIN;
    if (distance > death) {
      const blast = this.time - (marble.blastAt ?? -Infinity) <= BLAST_CREDIT_SECONDS ? marble.blast : undefined;
      this.eliminate(marble, 'ring out', blast);
      this.view?.ringOut(marble, this.time);
      return;
    }
    const featured = marble.id === this.ctx.setup.crownUserId || leadingPotato(this.marbles) === marble;
    if (featured && death - distance <= marble.radius * NEAR_MISS_RADII) marble.edgeDanger = true;
    if (marble.edgeDanger && distance < ARENA_RADIUS - marble.radius) {
      marble.edgeDanger = false;
      this.ctx.hype.nearMiss(marble.x, marble.y,
        { userId: marble.id, name: marble.name, color: marble.color });
    }
  }

  private eliminate(marble: Potato, cause: string, wave?: Shockwave): void {
    if (!marble.alive) return;
    marble.alive = false;
    marble.outAt = this.time;
    if (wave) {
      marble.blast = wave;
      marble.blastAt = this.time;
    }
    marble.body.setEnabled(false);
    const attacker = wave?.attacker === undefined ? undefined : this.marbles[wave.attacker];
    if (wave) wave.kills++;
    this.ctx.emit({ t: 'elim', victim: marble.id, by: attacker?.id, cause });
    this.ctx.emit({ t: 'activity', time: this.time, kind: 'hit' });
    const subject = { userId: attacker?.id, name: attacker?.name, color: attacker?.color ?? marble.color,
      key: wave ? `blast:${wave.id}` : `rim:${marble.ordinal}` };
    this.ctx.hype.kill(marble.x, marble.y, subject);

    this.feed.push(`${marble.name} / ${cause === 'bomb' ? 'BOOM' : 'RING OUT'}`);
    if (this.feed.length > 6) this.feed.shift();
  }

  private terminal(): void {
    const living = this.marbles.filter(marble => marble.alive);
    if (!living.length) {
      this.complete({ kind: 'void', reason: this.marbles.length ? 'Simultaneous elimination' : 'No entrants' },
        'No survivor');
      return;
    }
    if (this.boss && this.ctx.setup.participants.length > BOSS_CHAT_THRESHOLD) {
      const boss = this.marbles.find(marble => marble.isStreamer)!;
      const chats = living.filter(marble => !marble.isStreamer);
      if (!boss.alive && chats.length > BOSS_CHAT_THRESHOLD) {
        const attacker = this.marbles[boss.blast?.attacker ?? -1];
        this.complete({ kind: 'chat' }, 'BOSS ELIMINATED BEFORE THREE CHATTERS REMAIN',
          attacker && !attacker.isStreamer ? attacker : undefined);
      } else if (chats.length <= BOSS_CHAT_THRESHOLD) {
        this.complete({ kind: 'streamer' }, 'CHAT DOWN TO THREE', boss);
      }
    } else if (living.length === 1) {
      this.complete({ kind: living[0].isStreamer ? 'streamer' : 'chat' }, 'LAST BALL ALIVE', living[0]);
    }
  }

  private complete(winner: Winner, reason: string, champion?: Potato): void {
    this.result = makeResult(this.ctx, this.marbles, this.time, winner, reason, champion);
  }

  suddenDeath(): void {
    if (this.sudden) return;
    this.sudden = true;
    this.ctx.emit({ t: 'moment', text: 'SUDDEN DEATH: FUSES BURN x3', intensity: 2 });
    this.hud();
  }

  private hud(): void {
    updateHud(this.ctx, this.marbles, this.bombs.active, this.boss, this.sudden, this.feed);
  }

  inspect() {
    const living = this.marbles.filter(marble => marble.alive).length;
    return { time: this.time, keys: [], details: {
      stage: living < SHORT_FUSE_BELOW ? 2 : living < TWO_BOMBS_BELOW ? 1 : 0,
      living, bombCount: this.bombs.active.length, suddenDeath: this.sudden,
      format: this.boss ? 'boss' : 'ffa', radius: ARENA_RADIUS, burnRate: this.sudden ? SUDDEN_BURN : 1,
      rimSegments: this.arena.segments.filter(segment => segment.active).length,
      bombs: this.bombs.active.map(bomb => ({ ...bomb, holderId: this.marbles[bomb.holder].id })),
      waves: this.waves.active.map(wave => ({ id: wave.id, x: wave.x, y: wave.y,
        radius: wave.radius, range: wave.range, mega: wave.mega, kills: wave.kills }))
    }, marbles: this.marbles.map(marble => ({ id: marble.id, name: marble.name,
      team: marble.isStreamer ? 'streamer' : 'chat', x: marble.x, y: marble.y,
      radius: marble.radius, alive: marble.alive, dormant: false, isStreamer: marble.isStreamer,
      boost: 0, heat: 0, staged: false, finished: false })) };
  }

  takeState(): number[] {
    return this.marbles.map(marble => marble.alive ? Math.min(6, 2 + marble.tags * .2
      - (this.bombs.active.some(bomb => bomb.holder === marble.ordinal) ? 1 : 0)) : -1);
  }

  render(alpha: number): void { this.view?.render(this, alpha); }
  onChat(): void {}
  onStreamer(): void {}
  onJoin(): boolean { return false; }
  status(): GameStatus { return this.result ? { done: this.result } : 'playing'; }

  destroy(): void {
    this.view?.destroy();
    this.ctx.physics.onCollision = () => {};
    for (const marble of this.marbles) this.ctx.physics.remove(marble.body);
    this.arena.destroy();
  }
}

const definition: GameDefinition = {
  id: 'hot-potato', title: 'HOT POTATO', tagline: 'Touch to pass the bomb. Last ball alive wins.',
  ending: 'natural', archetype: 'luck', tier: 2, modes: ['cvs'], formats: ['ffa', 'boss'],
  durationSec: { target: 100, hardCap: SUDDEN_AT }, maxBodies: 66,
  maxParticipants: MAX_PARTICIPANTS, defaultBots: DEFAULT_BOTS, participantNoun: 'ball',
  joinOnly: true, competition: 'individual', presentation: 'minimal', camera: 'fixed',
  chatVerbs: [], streamerControls: [], supportsModifiers: [],
  predictionTitle: setup => setup.format === 'boss'
    ? 'Hot Potato: can chat eliminate the boss before three remain?' : 'Hot Potato: last ball alive?',
  scoreTake, create: ctx => new HotPotato(ctx)
};

export default definition;
