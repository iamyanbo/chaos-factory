import type { Participant, RoundResult } from "@chaos/shared";
import type { GameContext, GameDefinition, GameInstance, GameStatus } from "../contract";
import { NeonSound, rememberTrail } from "../../kit/neon";
import type { RAPIER } from "../../engine/physics";
import {
  ROUND_SECONDS,
  TILE_COUNT,
  GRID_SIZE,
  INITIAL_BALLS,
  FLIP_FLASH_SECONDS,
  BIRTH_FLASH_SECONDS,
  FLIP_SPARKS,
  BIRTH_SPARKS,
  HUD_REFRESH_TICKS,
  MAX_SUPPORTERS,
  DEFAULT_SUPPORTERS,
  TAKE_BASE_SCORE,
  TAKE_LEAD_WEIGHT,
  TAKE_CLOSENESS_WEIGHT,
  TAKE_QUIET_LIMIT,
  TAKE_QUIET_WEIGHT,
  TAKE_DURATION_WEIGHT,
} from "./config";
import { PongModel } from "./model";
import type { PongBall } from "./types";
import { PongView } from "./view";
import { buildResult, selectedTeams, updateHud } from "./state";
import { PongHype } from './hype';
import { celebrateResult } from '../../kit/hype';

export class PongWars implements GameInstance {
  readonly model: PongModel;
  readonly marbles: PongBall[];
  private proxies = new Map<string, RAPIER.RigidBody>();
  private sound: NeonSound;
  private view?: PongView;
  private roster: Participant[][];
  private cursors: number[];
  private carriers = new Map<string, string>();
  private credits = new Map<string, number>();
  private feed: string[] = [];
  private started = false;
  private result?: RoundResult;
  private hype: PongHype;

  constructor(readonly ctx: GameContext) {
    const teams = selectedTeams(ctx.setup.teams);
    this.model = new PongModel(teams, ctx.rng);
    this.hype = new PongHype(ctx);
    this.marbles = this.model.balls;
    this.roster = teams.map((team) => ctx.setup.participants.filter((owner) => owner.teamId === team));
    this.cursors = teams.map(() => 0);
    this.sound = new NeonSound(ctx);
    ctx.physics.world.gravity = { x: 0, y: 0 };
    if (!ctx.headless) this.view = new PongView(ctx);
    for (const ball of this.marbles) this.admit(ball);
    updateHud(ctx, this.model, this.feed);
  }

  get time(): number {
    return this.model.time;
  }

  private rotateName(ball: PongBall): void {
    const owners = this.roster[ball.ordinal];
    if (!owners.length) return;
    const crown = owners.find(owner => owner.userId === this.ctx.setup.crownUserId);
    const rotating = crown && owners.length > 1 ? owners.filter(owner => owner !== crown) : owners;
    const owner = crown && ball.slot === 0 ? crown : rotating[this.cursors[ball.ordinal]++ % rotating.length];
    ball.name = owner.displayName;
    ball.hideName = false;
    ball.profileId = owner.userId;
    ball.crownVisible = ball.slot === 0;
    this.carriers.set(ball.id, owner.userId);
  }

  private admit(ball: PongBall): void {
    this.rotateName(ball);
    const body = this.ctx.physics.ball(ball.x, ball.y, ball.radius, {
      kinematic: true,
      sensor: true,
      entity: ball.id,
    });
    this.proxies.set(ball.id, body);
  }

  start(): void {
    this.started = true;
  }

  step(_dt: number): void {
    if (!this.started || this.result) return;
    this.ctx.hype.at(this.time + 1 / 60);
    this.model.step({
      territory: (ball, from, to) => {
        const by = this.carriers.get(ball.id);
        if (by && from >= 0) this.ctx.emit({ t: 'territory', by,
          from: this.model.teams[from], to: this.model.teams[to] });
      },
      contact: (ball, tile, x, y, flips = 1) => {
        this.sound.bounce(Math.hypot(ball.vx, ball.vy));
        if (tile < 0) return;
        this.ctx.emit({ t: "activity", kind: "flip", time: this.time });
        const owner = this.carriers.get(ball.id);
        if (owner) this.credits.set(owner, (this.credits.get(owner) ?? 0) + flips);
        this.rotateName(ball);
        ball.flashUntil = this.time + FLIP_FLASH_SECONDS;
        this.view?.sparks.burst(x, y, ball.color, this.time, FLIP_SPARKS);
      },
      birth: (ball, reason) => {
        this.admit(ball);
        this.ctx.emit({ t: "activity", kind: "birth", time: this.time });
        ball.flashUntil = this.time + BIRTH_FLASH_SECONDS;
        this.view?.sparks.burst(ball.x, ball.y, ball.color, this.time, BIRTH_SPARKS);
        if (reason === "split") {
          this.feed.unshift(`${ball.team.toUpperCase()} SPLIT · ${this.model.ballCount(ball.ordinal)}/8 BALLS`);
          this.feed = this.feed.slice(0, 3);
          this.sound.pass(ball.slot);
        } else if (ball.ordinal === 0) {
          this.feed.unshift(`${Math.floor(this.time)}s · REINFORCEMENTS · CAP 8`);
          this.feed = this.feed.slice(0, 3);
          this.sound.pass(ball.slot);
        }
      },
      sprint: () => {
        this.feed.unshift("80s · EVERY BALL NOW 1.4× FASTER");
        this.feed = this.feed.slice(0, 3);
        this.sound.setOctave(1);
      },
      special: (kind, ball) => {
        if (kind === "bomb") {
          this.feed.unshift(`${ball.team.toUpperCase()} BOMB · 3×3 CLAIM`);
          this.feed = this.feed.slice(0, 3);
          this.sound.pass(2);
        }
      },
      comeback: (owner) => {
        this.feed.unshift(`${this.model.teams[owner].toUpperCase()} · COMEBACK SPLITS APPEAR`);
        this.feed = this.feed.slice(0, 3);
        this.sound.pass(1);
      },
    });
    for (const ball of this.marbles) {
      this.ctx.physics.move(this.proxies.get(ball.id)!, ball.x, ball.y);
      if (!this.ctx.headless) rememberTrail(ball.trail, ball.x, ball.y);
    }
    this.ctx.physics.step();
    this.hype.step(this.model);
    if (this.model.tick % HUD_REFRESH_TICKS === 0) updateHud(this.ctx, this.model, this.feed);
    if (this.model.done) {
      this.result = buildResult(this.ctx, this.model, this.credits);
      celebrateResult(this.ctx, this.result);
    }
  }

  takeState(): number[] {
    return this.model.grid.counts.map((count) => 6 * count / TILE_COUNT);
  }

  inspect() {
    return {
      time: this.time,
      keys: [],
      details: {
        gridSize: GRID_SIZE,
        ownership: [...this.model.grid.cells],
        specials: [...this.model.grid.specials],
        shares: Object.fromEntries(this.model.teams.map((team, i) => [team, this.model.grid.counts[i]])),
        ballsPerTeam: Object.fromEntries(this.model.teams.map((team, i) => [team, this.model.ballCount(i)])),
        splits: this.model.splits,
        bombs: this.model.bombs,
        comebacks: this.model.comebacks,
        sprinting: this.model.sprinting,
        flips: this.model.flips,
      },
      marbles: this.marbles.map((ball) => ({
        id: ball.id,
        name: ball.name,
        team: ball.team,
        x: ball.x,
        y: ball.y,
        radius: ball.radius,
        alive: ball.alive,
        dormant: false,
        isStreamer: false,
        boost: 0,
        heat: 0,
        staged: false,
        finished: this.model.done,
      })),
    };
  }

  render(alpha: number): void {
    this.view?.render(this.model, alpha);
  }

  status(): GameStatus {
    return this.result ? { done: this.result } : "playing";
  }

  onChat(): void {}
  onStreamer(): void {}
  onJoin(): boolean {
    return false;
  }

  destroy(): void {
    this.view?.destroy();
    for (const proxy of this.proxies.values()) this.ctx.physics.remove(proxy);
    this.proxies.clear();
  }
}

const definition: GameDefinition = {
  ending: 'timed',
  id: "pong-wars",
  title: "PONG WARS",
  tagline: "Split your swarm. Bomb rival territory. Most tiles at ninety seconds.",
  archetype: "faction",
  tier: 1,
  modes: ["faction"],
  formats: ["faction"],
  camera: "fixed",
  durationSec: { target: ROUND_SECONDS, hardCap: 150 },
  maxBodies: 32,
  maxTeams: 4,
  maxParticipants: MAX_SUPPORTERS,
  defaultBots: DEFAULT_SUPPORTERS,
  joinOnly: true,
  audienceIndependent: true,
  presentation: "minimal",
  machineBallsPerTeam: INITIAL_BALLS,
  competition: "team",
  participantNoun: "supporter",
  chatVerbs: [],
  streamerControls: [],
  supportsModifiers: [],
  predictionTitle: () => "Pong Wars: WHICH TEAM OWNS THE MOST TILES?",
  scoreTake: (events) => TAKE_BASE_SCORE
    + events.leadChanges * TAKE_LEAD_WEIGHT
    + events.finalCloseness * TAKE_CLOSENESS_WEIGHT
    - Math.max(0, events.quietMax - TAKE_QUIET_LIMIT) * TAKE_QUIET_WEIGHT
    - Math.max(0, 75 - events.duration) * TAKE_DURATION_WEIGHT
    - Math.abs(events.duration - ROUND_SECONDS) * TAKE_DURATION_WEIGHT,
  create: (ctx) => new PongWars(ctx),
};

export default definition;
