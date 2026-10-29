# Pong Wars fairness — doc 21

The required gate is each team's wins divided by **all 300 rounds**, within
±5 percentage points of the equal share. Every consecutive seed 1–300 is run
through the unselected live fixed-step model. No seed is filtered and no tied
round is assigned a winner.

| Teams | Raw wins in team order | Ties | Raw win shares | Required range | Result |
| --- | --- | --- | --- | --- | --- |
| 2 | RED 151 / BLUE 144 | 5 | 50.33% / 48.00% | 45–55% | PASS |
| 3 | RED 102 / BLUE 99 / MINT 94 | 5 | 34.00% / 33.00% / 31.33% | 28.33–38.33% | PASS |
| 4 | RED 90 / BLUE 61 / MINT 67 / GOLD 71 | 11 | 30.00% / 20.33% / 22.33% / 23.67% | 20–30% | PASS |

The 4-team RED share among the 289 decisive rounds is **31.14%**. That is above
the raw-share range when applied to a different denominator. It is retained as
a diagnostic in fairness-4-teams.json, rather than hidden or used to change
physics, seed selection or tie outcomes. Split-tie credit also appears in each
JSON report; the required gate uses neither decisive-only nor split-tie shares.

All sides start with four balls and exactly equal claimable territory. The 32
initial special tiles are mirrored across both center lines, with eight
permanent unowned walls. Contact-earned Split births fan 45° away from the
striking ball at unchanged speed. Every side has the same eight-ball cap,
scheduled supplies, speed schedule and trailing-territory comeback rule.

A full-round identity permutation test relabels every team for seeds 1, 17 and
83, then asserts identical ownership, motion, flip counts, special activations
and comeback placement. A separate 100-seed test checks every special's exact
horizontal and vertical mirror partners. Viewer count/name independence,
repeatability, caps, wall permanence and cleanup are also covered by tests.
