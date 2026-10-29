import { Rng, type TeamId } from "@chaos/shared";
import { PongModel, type PongHooks } from "./model";

const TEAMS: TeamId[] = ["red", "blue", "mint", "gold"];
const silent: PongHooks = { contact() {}, birth() {}, sprint() {} };

export function auditFairness(teamCount: number, seeds = 300) {
  const wins = Array(teamCount).fill(0) as number[];
  const tiedCredits = Array(teamCount).fill(0) as number[];
  const ties: { seed: number; teams: TeamId[]; counts: number[] }[] = [];
  let flips = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const model = new PongModel(TEAMS.slice(0, teamCount), new Rng(seed));
    while (!model.done) model.step(silent);
    const leaders = model.leaders();
    if (leaders.length === 1) wins[leaders[0]]++;
    else {
      ties.push({ seed, teams: leaders.map((i) => TEAMS[i]), counts: [...model.grid.counts] });
      for (const ordinal of leaders) tiedCredits[ordinal] += 1 / leaders.length;
    }
    flips += model.flips;
  }
  return {
    teamCount,
    seeds,
    seedRange: [1, seeds],
    expectedShare: 1 / teamCount,
    tolerancePercentagePoints: 5,
    ties: ties.length,
    voids: ties.length,
    decisiveRounds: seeds - ties.length,
    teams: TEAMS.slice(0, teamCount).map((teamId, i) => ({
      teamId,
      wins: wins[i],
      rawWinShare: wins[i] / seeds,
      decisiveWinShare: wins[i] / (seeds - ties.length),
      splitTieShare: (wins[i] + tiedCredits[i]) / seeds,
      passesRawGate: Math.abs(wins[i] / seeds - 1 / teamCount) <= 0.05,
      passesDecisiveGate: Math.abs(wins[i] / (seeds - ties.length) - 1 / teamCount) <= 0.05,
    })),
    averageFlips: flips / seeds,
    tieDetails: ties,
    method: "All consecutive seeds 1–300; unselected fixed-step live model. Equal starting balls and universal speed; mirrored specials, uniform eight-ball cap and the same trailing-territory Split rule for every team. Pre-play seat permutation. Rapier proxies are sensors and cannot change the model. Ties return void, never seed-based tiebreaks.",
  };
}
