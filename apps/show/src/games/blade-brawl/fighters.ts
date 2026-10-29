import { TEAMS, type Participant } from "@chaos/shared";
import type { GameContext } from "../contract";
import { PX } from "../../engine/physics";
import { CENTER, viewerColor } from "../../kit/neon";
import { createWeapon, WEAPON_KINDS } from "./weapons";
import type { Fighter, WeaponKind } from "./types";
import {
  bossHp,
  BOSS_RADIUS,
  FIGHTER_RADIUS,
  START_HP,
  STARTING_RADII,
  SEATS_PER_RING,
  SPEED,
  BOSS_DENSITY,
} from "./config";

class FighterFactory {
  readonly marbles: Fighter[] = [];
  private weaponId = 0;
  private loadouts = new Map<string, WeaponKind[]>();

  private nextWeapon(group: string): WeaponKind {
    let bag = this.loadouts.get(group);
    if (!bag?.length) {
      bag = this.ctx.rng.shuffle(WEAPON_KINDS);
      this.loadouts.set(group, bag);
    }
    return bag.pop()!;
  }

  constructor(
    readonly ctx: GameContext,
    readonly format: "boss" | "ffa" | "faction",
  ) {
    if (this.format === "boss" && ctx.setup.participants.length) {
      this.spawn(
        {
          userId: "streamer",
          login: "streamer",
          displayName: ctx.setup.streamerName,
          color: "#ff5ec4",
        },
        CENTER.x,
        CENTER.y,
        BOSS_RADIUS,
        bossHp(ctx.setup.participants.length),
        "boss",
        true,
      );
    }
    const phase = ctx.rng.range(0, Math.PI * 2);
    const seats = ctx.rng.shuffle(
      STARTING_RADII.flatMap((radius, row) =>
        Array.from({ length: SEATS_PER_RING }, (_, seat) => {
          const angle =
            phase + ((seat + row / 2) * Math.PI * 2) / SEATS_PER_RING;
          return {
            x: CENTER.x + Math.cos(angle) * radius,
            y: CENTER.y + Math.sin(angle) * radius,
          };
        }),
      ),
    );
    for (const [index, owner] of ctx.setup.participants.entries()) {
      const { x, y } = seats[index];
      const group =
        this.format === "boss"
          ? "chat"
          : this.format === "ffa"
            ? owner.userId
            : (owner.teamId ?? "red");
      this.spawn(owner, x, y, FIGHTER_RADIUS, START_HP, group, false, index);
    }
  }
  private spawn(
    owner: Participant,
    x: number,
    y: number,
    radius: number,
    hp: number,
    group: string,
    boss: boolean,
    index = 0,
  ): void {
    const body = this.ctx.physics.ball(x, y, radius, {
      restitution: 1,
      friction: 0,
      density: boss ? BOSS_DENSITY : 1,
      entity: owner.userId,
    });
    body.setLinearDamping(0);
    body.setAngularDamping(0);
    const heading = this.ctx.rng.range(0, Math.PI * 2);
    body.setLinvel(
      {
        x: (Math.cos(heading) * SPEED) / PX,
        y: (Math.sin(heading) * SPEED) / PX,
      },
      true,
    );
    const kinds = boss
      ? (["Sword", "Hammer"] as const)
      : [this.nextWeapon(group)];
    const weapons = kinds.map((kind) =>
      createWeapon(kind, this.weaponId++, this.ctx.rng),
    );
    const color = boss
      ? 0xff5ec4
      : this.format === "faction"
        ? TEAMS[owner.teamId ?? "red"].hex
        : viewerColor(owner);
    this.marbles.push({
      id: owner.userId,
      owner,
      name: owner.displayName,
      group,
      body,
      x,
      y,
      prevX: x,
      prevY: y,
      radius,
      hp,
      maxHp: hp,
      color,
      weapons,
      alive: true,
      isStreamer: boss,
      trail: [],
    });
  }
}

export function createFighters(
  ctx: GameContext,
  format: "boss" | "ffa" | "faction",
): Fighter[] {
  return new FighterFactory(ctx, format).marbles;
}
