import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { auditFairness } from "./balance";

for (const count of [2, 3, 4]) {
  test(`Pong Wars ${count}-team fairness: all 300 seeds within ±5 percentage points`, () => {
    const report = auditFairness(count);
    const directory = resolve("qa/frames/pong-wars");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, `fairness-${count}-teams.json`), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ teamCount: count, wins: report.teams.map((team) => team.wins),
      ties: report.ties, averageFlips: report.averageFlips }));
    expect(report.teams.every((team) => team.passesRawGate)).toBe(true);
    // Doc 20's gate is wins out of all 300 rounds. Keep decisive shares as
    // a diagnostic; excluding voids changes that denominator and that gate.
  }, 120000);
}
