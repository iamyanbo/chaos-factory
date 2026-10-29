import { TEAMS, type RoundResult, type TeamId } from "@chaos/shared";
import type { GameContext } from "../contract";
import {
  SPRINT_AT,
  TEAM_COLORS,
  WALL_OWNER,
  LEADER_FLASH_SECONDS,
  LEADER_FLASH_HZ,
  ROUND_SECONDS,
} from "./config";
import type { PongModel } from "./model";

export function updateHud(ctx: GameContext, model: PongModel, feed: string[]): void {
  if (ctx.headless) return;
  const leaders = model.leaders();
  const available = model.grid.cells.filter(owner => owner !== WALL_OWNER).length;
  const flashing = model.time >= ROUND_SECONDS - LEADER_FLASH_SECONDS
    && Math.floor(model.time * LEADER_FLASH_HZ) % 2 === 0;
  ctx.hud.setSide?.({
    subtitle: model.time >= SPRINT_AT ? "FINAL SPRINT · 1.4×" : "FACTION WAR · MOST TILES WINS",
    countLabel: `${model.balls.length} balls · MAX 8 PER TEAM`,
    bars: model.teams.map((team, ordinal) => ({
      label: TEAMS[team].name,
      value: model.grid.counts[ordinal] / available,
      color: TEAM_COLORS[team],
      text: `${model.grid.counts[ordinal]} tiles · ${(100 * model.grid.counts[ordinal] / available).toFixed(1)}%`,
      flash: flashing && leaders.includes(ordinal),
    })),
    rows: [
      {
        label: "THE RULE",
        names: ["Hit a rival tile. Flip it.", "Pass through your own color.", "Most tiles at 90s wins."],
      },
      {
        label: "SPECIAL TILES",
        names: ["★ SPLIT: +1 ball · cap 8", "✸ BOMB: claim a 3×3 area", "▣ WALL: always solid"],
      },
      {
        label: "ESCALATION",
        names: ["30s / 45s: equal supplies", "45s+: trailing side gets ★", "80s: everyone speeds up"],
      },
    ],
    feed,
  });
}

export function buildResult(ctx: GameContext, model: PongModel, credits: Map<string, number>): RoundResult {
  const leaders = model.leaders();
  const winner = leaders.length === 1 ? model.teams[leaders[0]] : undefined;
  const standings = model.teams.map((teamId, ordinal) => ({
    teamId,
    score: model.grid.counts[ordinal],
    stat: `${model.grid.counts[ordinal]} tiles`,
  })).sort((a, b) => b.score - a.score);
  return {
    winner: winner ? { kind: "team", teamId: winner } : {
      kind: "void",
      reason: `Territory tie: ${leaders.map((ordinal) => model.teams[ordinal].toUpperCase()).join(" / ")}`,
    },
    standings,
    mvps: [...credits].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([userId, flips]) => ({
      userId,
      title: "TILE FLIPPER",
      stat: `${flips} flips while carrying your name`,
    })),
    highlights: [],
    perUser: Object.fromEntries(ctx.setup.participants.map((owner) => [owner.userId, {
      score: credits.get(owner.userId) ?? 0,
      tags: [
        ...(owner.teamId ? [`team:${owner.teamId}`] : []),
        ...(winner && owner.teamId === winner ? ["win"] : []),
      ],
    }])),
    replay: { seed: ctx.setup.seed, inputs: [] },
  };
}

export function selectedTeams(teams?: TeamId[]): TeamId[] {
  const unique = [...new Set(teams ?? ["red", "blue", "mint", "gold"] as TeamId[])];
  if (unique.length < 2 || unique.length > 4) throw new Error("Pong Wars supports 2–4 teams");
  return unique;
}
