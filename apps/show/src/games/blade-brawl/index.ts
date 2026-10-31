import { createFighters } from "./fighters";
import { buildResult, updateHud, inspectFight } from "./state";
import {
  type RoundResult,
  type Winner,
} from "@chaos/shared";
import type {
  GameContext,
  GameDefinition,
  GameInstance,
  GameStatus,
} from "../contract";
import { PX } from "../../engine/physics";
import {
  NeonSound,
  circleWall,
  resizeCircleWall,
  hitStop,
  rememberTrail,
} from "../../kit/neon";
import { Combat } from "./combat";
import { effectiveSpin, parryPoint } from "./weapons";
import { budgetKnockback, containAtWall, normalizeSpeed } from './motion';
import { BladeView } from "./view";
import { arenaRadiusAt } from './arena';
import { BladeHype } from './hype';
import { BossRage } from './rage';
import { TOY } from '../../kit/theme/toy';
import type { ContactMark, Fighter, WeaponPose } from "./types";
import {
  ARENA_RADIUS,
  HARD_CAP,
  MAX_VIEWERS,
  SPEED,
  START_HP,
  KILL_FREEZE_MS,
  KILL_FREEZE_COOLDOWN,
  BLADE_RADIUS_FRACTION,
} from "./config";

export class BladeBrawl implements GameInstance {
  time = 0;
  tick = 0;
  radius = ARENA_RADIUS;
  readonly marbles: Fighter[] = [];
  readonly format: "boss" | "ffa" | "faction";
  readonly wall;
  private combat = new Combat();
  private sound: NeonSound;
  private view?: BladeView;
  private contacts: ContactMark[] = [];
  private feed: string[] = [];
  private started = false;
  private result?: RoundResult;
  private lastKillFreeze = -Infinity;
  private suddenDeathAt?: number;
  private feedback: BladeHype;
  constructor(readonly ctx: GameContext) {
    if (ctx.setup.participants.length > MAX_VIEWERS)
      throw new Error("Blade Brawl admits at most 32 viewers");
    this.format =
      ctx.setup.format ?? (ctx.setup.mode === "faction" ? "faction" : "boss");
    ctx.physics.world.gravity = { x: 0, y: 0 };
    this.wall = circleWall(ctx, this.radius);
    this.sound = new NeonSound(ctx);
    this.feedback = new BladeHype(ctx);
    this.marbles.push(...createFighters(ctx, this.format));
    if (this.format === 'boss' && this.marbles[0]) {
      this.marbles[0].rage = new BossRage(this.marbles[0]);
    }
    if (!ctx.headless) this.view = new BladeView(ctx);
    this.hud();
  }

  start(): void {
    this.started = true;
  }

  suddenDeath(): void {
    this.suddenDeathAt ??= this.time;
  }

  step(dt: number): void {
    if (!this.started || this.result || !this.marbles.length) return;
    this.time += dt;
    this.ctx.hype.at(this.time);
    this.tick++;
    if (this.time >= HARD_CAP) this.suddenDeath();
    const radius = arenaRadiusAt(this.time, this.suddenDeathAt);
    if (this.tick % 15 === 0 && radius !== this.radius) {
      this.radius = radius;
      resizeCircleWall(this.wall, this.radius);
    }
    const alive = this.marbles.filter((m) => m.alive);
    for (const fighter of alive) budgetKnockback(fighter, dt);
    const incoming = alive.map((m) => ({ ...m.body.linvel() }));
    for (const fighter of alive) {
      fighter.prevX = fighter.x;
      fighter.prevY = fighter.y;
      for (const weapon of fighter.weapons) {
        weapon.previous = weapon.angle;
        weapon.length = Math.min(weapon.length, this.radius * BLADE_RADIUS_FRACTION);
        weapon.angle += weapon.direction * effectiveSpin(weapon, this.time) * dt;
      }
    }
    this.ctx.physics.step();
    alive.forEach((fighter, index) => {
      containAtWall(fighter, this.radius, this.ctx);
      const p = this.ctx.physics.position(fighter.body);
      fighter.x = p.x;
      fighter.y = p.y;
      const velocity = fighter.body.linvel();
      const changed =
        Math.hypot(
          velocity.x - incoming[index].x,
          velocity.y - incoming[index].y,
        ) > 0.00001;
      if (changed) {
        const speed = Math.hypot(velocity.x, velocity.y);
        const v =
          speed > 0.001
            ? velocity
            : { x: -incoming[index].x, y: -incoming[index].y };
        const length = Math.hypot(v.x, v.y) || 1;
        fighter.body.setLinvel(
          {
            x: ((v.x / length) * SPEED) / PX,
            y: ((v.y / length) * SPEED) / PX,
          },
          true,
        );
        this.sound.bounce(speed * PX);
        fighter.knockbackLeft = 0;
      }
      if (!changed && !fighter.knockbackLeft) normalizeSpeed(fighter);
      if (!this.ctx.headless) rememberTrail(fighter.trail, p.x, p.y);
    });
    this.combat.step(this.marbles, this.radius, this.time, {
      hit: (attacker, target, weapon, x, y, kill) => {
        this.feedback.hit(attacker, target, weapon, x, y, kill, this.marbles);
        this.ctx.emit({ t: "activity", kind: "hit", time: this.time });
        this.sound.hit(weapon.spin * weapon.length, weapon.damage, kill);
        if (!this.ctx.headless) this.ctx.camera.shakePixels(3);
        if (kill && this.time - this.lastKillFreeze >= KILL_FREEZE_COOLDOWN) {
          hitStop(this.ctx, KILL_FREEZE_MS);
          this.lastKillFreeze = this.time;
        }
        this.view?.sparks.burst(x, y, target.color, this.time, kill ? 32 : 12);
        this.contacts.push({
          x,
          y,
          color: attacker.color,
          until: this.time + 0.3,
          attacker: attacker.name,
          victim: target.name,
        });
        if (kill) {
          target.alive = false;
          this.ctx.emit({ t: 'elim', victim: target.id, by: attacker.id, cause: 'blade' });
          this.ctx.physics.remove(target.body);
          this.feed.unshift(`${target.name} shattered`);
          this.feed = this.feed.slice(0, 7);
          this.view?.sparks.burst(
            target.x,
            target.y,
            target.color,
            this.time,
            32,
          );
        }
      },
      parry: (a, b) => this.parry(a, b),
    });
    const boss = this.format === 'boss' ? this.marbles[0] : undefined;
    if (boss?.rage?.observe(this.time)) {
      this.ctx.hype.callout(boss.x, boss.y, { text: 'RAGE!', color: TOY.palette[1] });
    }
    this.feedback.observe(this.marbles, this.radius, this.time);
    this.contacts = this.contacts.filter(
      (contact) => contact.until > this.time,
    );
    this.hud();
    const living = this.marbles.filter((m) => m.alive);
    if (this.format === "boss") {
      const boss = this.marbles[0];
      if (!boss.alive) this.complete({ kind: "chat" });
      else if (living.length === 1) this.complete({ kind: "streamer" }, boss);
    } else if (this.format === "faction") {
      const groups = new Set(living.map((m) => m.group));
      if (groups.size === 1 && living.length)
        this.complete({
          kind: "team",
          teamId: living[0].owner.teamId ?? "red",
        });
    } else if (living.length === 1) this.complete({ kind: "chat" }, living[0]);
    if (!living.length && !this.result)
      this.complete({ kind: "void", reason: "Mutual knockout" });
  }

  private parry(a: WeaponPose, b: WeaponPose): void {
    const { x, y } = parryPoint(a, b);
    this.ctx.emit({ t: "activity", kind: "parry", time: this.time });
    this.sound.parry(
      a.weapon.spin * a.weapon.length + b.weapon.spin * b.weapon.length,
    );
    this.view?.sparks.burst(x, y, 0xffffff, this.time, 12);
  }

  private hud(): void {
    updateHud(this.ctx, this.marbles, this.format, this.feed, this.radius,
      this.time, this.suddenDeathAt !== undefined);
  }

  private complete(winner: Winner, champion?: Fighter): void {
    this.result = buildResult(
      this.ctx,
      this.marbles,
      this.format,
      winner,
      champion,
    );
  }

  takeState(): number[] {
    if (!this.marbles.length) return [];
    if (this.format === "boss")
      return [
        (this.marbles[0].hp / Math.max(1, this.marbles[0].maxHp)) * 6,
        (this.marbles.slice(1).reduce((sum, m) => sum + m.hp, 0) /
          Math.max(1, START_HP * (this.marbles.length - 1))) *
          6,
      ];
    return this.marbles.map((m) => (m.alive ? (m.hp / m.maxHp) * 6 : -1));
  }

  inspect() {
    return inspectFight(
      this.time,
      this.radius,
      this.format,
      this.marbles,
      this.contacts,
    );
  }

  render(alpha: number): void {
    this.view?.render(
      this.marbles,
      this.radius,
      this.time,
      alpha,
      this.contacts,
    );
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
    for (const m of this.marbles) this.ctx.physics.remove(m.body);
    this.ctx.physics.remove(this.wall);
  }
}

const definition: GameDefinition = {
  id: "blade-brawl",
  title: "BLADE BRAWL",
  tagline: "Spinning weapons. Growing danger. Last fighter standing.",
  archetype: "boss",
  tier: 1,
  modes: ["cvs", "faction"],
  formats: ["boss", "ffa", "faction"],
  durationSec: { target: 90, hardCap: HARD_CAP },
  ending: 'natural',
  maxBodies: 34,
  maxParticipants: MAX_VIEWERS,
  joinOnly: true,
  competition: "team",
  presentation: "minimal",
  hitStop: true,
  defaultBots: 16,
  chatVerbs: [],
  streamerControls: [],
  supportsModifiers: [],
  participantNoun: "fighter",
  scoreTake: (events) =>
    100 -
    Math.max(0, 45 - events.duration, events.duration - 90) * 4 +
    events.leadChanges * 6 +
    events.finalCloseness * 30 -
    Math.max(0, events.quietMax - 6) * 6 -
    (events.finished ? 0 : 300),
  create: (ctx) => new BladeBrawl(ctx),
};
export default definition;
