# Blade Brawl Boss HP balance

Overall: **FAIL / TUNING**. Raw consecutive seeds 1-200, no best-take selection. Boss HP = round(55 * chat).
| Chat fighters | Boss HP | Boss wins | Share | Target | Voids | Escapes | Median s | Result |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 8 | 440 | 157/200 | 78.5% | 45-55% | 0 | 0 | 85.88 | FAIL |
| 16 | 880 | 178/200 | 89.0% | 45-55% | 0 | 0 | 91.50 | FAIL |
| 32 | 1760 | 135/200 | 67.5% | 45-55% | 0 | 0 | 98.18 | FAIL |

Only bossHpPerChatter is tuned. Overrides are probes, not final acceptance. Source hashes and every outcome are retained in JSON.
Feedback version: damage received charges the requested five-second 1.5x rage.
The run used the same HP, geometry, combat damage and rage constants throughout.
Cosmetic near-miss timestamp/palette plumbing changed during/after this audit;
JSON retains the original hashes and `unchanged: false`. This is a diagnostic
FAIL, not final source-hash acceptance or a claim of 50/50 balance. Earlier
no-rage damage-threshold probes do not calibrate this version.
