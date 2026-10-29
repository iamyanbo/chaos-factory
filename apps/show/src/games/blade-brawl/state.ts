import type { RoundResult, Winner } from "@chaos/shared";
import type { GameContext } from "../contract";
import { weaponLabel } from "./weapons";
import type { Fighter, ContactMark } from "./types";
import { TOY } from '../../kit/theme/toy';
import { RAGE_DAMAGE_MULTIPLIER } from './rage';
type BladeFormat = "boss" | "ffa" | "faction";

export function updateHud(
  ctx: GameContext,
  marbles: Fighter[],
  format: BladeFormat,
  feed: string[],
  radius = 500,
  time = 0,
  suddenDeath = false,
): void {
  if (ctx.headless) return;
  for (const fighter of marbles)
    fighter.detail = fighter.weapons.map(weapon => weaponLabel(weapon, radius, time)).join(" / ");
  const boss = format === "boss" ? marbles[0] : undefined;
  ctx.hud.setSide?.({
    arenaPercent: Math.round(radius / 5),
    subtitle:
      suddenDeath
        ? "SUDDEN DEATH"
        : format === "boss"
          ? `${ctx.setup.streamerName} vs CHAT`
          : format === "ffa"
            ? "FREE FOR ALL"
            : "FACTION WAR",
    countLabel: `${marbles.filter((m) => m.alive).length} fighters left`,
    feed: feed,
    bars: boss
      ? [
          {
            label: `${ctx.setup.streamerName} HP`,
            value: boss.hp / boss.maxHp,
            color: boss.color,
            text: `${Math.ceil(boss.hp)} / ${boss.maxHp}`,
            side: "left",
          },
          {
            label: boss.rage?.active(time) ? `RAGING · ${RAGE_DAMAGE_MULTIPLIER}× DAMAGE` : 'RAGE',
            value: boss.rage?.fill(time) ?? 0,
            color: TOY.palette[1],
            text: boss.rage?.active(time)
              ? `${Math.ceil(boss.rage.until - time)}s` : `${Math.round((boss.rage?.charge ?? 0) * 100)}%`,
            side: 'left',
          },
        ]
      : [],
    rows: [
      {
        label: "FIGHTERS",
        names: marbles
          .filter((m) => m.alive)
          .sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)
          .slice(0, 5)
          .map((m) => `${m.name} ${Math.ceil(m.hp)}HP`),
      },
    ],
  });
}

export function buildResult(
  ctx: GameContext,
  marbles: Fighter[],
  format: BladeFormat,
  winner: Winner,
  champion?: Fighter,
): RoundResult {
  return {
    winner,
    champion: champion
      ? {
          userId: champion.id,
          displayName: champion.name,
          reason: "LAST FIGHTER STANDING",
        }
      : undefined,
    mvps: [],
    highlights: [],
    perUser: Object.fromEntries(
      ctx.setup.participants.map((owner) => {
        const m = marbles.find((fighter) => fighter.id === owner.userId)!;
        const won =
          (winner.kind === "chat" && format === "boss") ||
          (winner.kind === "team" && winner.teamId === owner.teamId) ||
          champion?.id === m.id;
        return [
          owner.userId,
          {
            score: m.weapons.reduce((sum, weapon) => sum + weapon.hits, 0),
            tags: [
              ...(won ? ["win"] : []),
              ...(m.alive ? ["survived"] : []),
              ...(owner.teamId ? [`team:${owner.teamId}`] : []),
            ],
          },
        ];
      }),
    ),
    replay: { seed: ctx.setup.seed, inputs: [] },
  };
}

export function inspectFight(
  time: number,
  radius: number,
  format: BladeFormat,
  marbles: Fighter[],
  contacts: ContactMark[],
) {
  return {
    time: time,
    keys: [],
    details: {
      format: format,
      radius: radius,
      fighters: marbles.map((m) => ({
        id: m.id,
        hp: m.hp,
        maxHp: m.maxHp,
        weapons: m.weapons,
        rage: m.rage ? { charge: m.rage.charge, until: m.rage.until, active: m.rage.active(time) } : undefined,
      })),
      contacts: contacts,
    },
    marbles: marbles.map((m) => ({
      id: m.id,
      name: m.name,
      team: m.group,
      x: m.x,
      y: m.y,
      radius: m.radius,
      alive: m.alive,
      dormant: false,
      isStreamer: m.isStreamer,
      boost: 0,
      heat: 0,
      staged: false,
      finished: false,
    })),
  };
}
