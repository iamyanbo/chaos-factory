# Pong Wars

A 90-second automatic territory battle for 2–4 factions. Every side starts with
four balls regardless of audience size. Balls pass through their own color,
reflect off other tiles and claim the tile they touch. Most tiles wins; tied
leaders produce an honest void prediction. Viewers only type `!join`: names
rotate through their team's balls after each flip, without changing physics.
The machine also runs with zero viewers. There are no host controls.

## Special tiles and stages

The initial board has 32 specials (8% of the 400 squares), mirrored across both
arena center lines. White icons identify them:

- **★ Split:** the flipping side receives one ball, capped at eight per team.
- **✸ Bomb:** claims a 3×3 neighborhood and draws an expanding shockwave.
- **▣ Wall:** an eight-pixel white block that remains solid and unowned.

The Split child visibly fans 45° away from the striking ball at the same speed.
Split and Bomb rewards are consumed when hit. A Bomb does not set off neighboring
specials, and can never claim a Wall. Teams receive equal scheduled supplies at
30s and 45s, subject to the same eight-ball cap. Starting at 45s and every 15s
following, each side tied for the fewest tiles receives a mirrored pair of Split
tiles inside its current territory. These appear neutral so its own balls can
collect them; an opponent can still steal them. The side column announces the
comeback. The 80s final sprint raises every ball's speed by 1.4×.

The three stages are **OPENING → SPLITS → SUDDEN DEATH**. No result is selected
or modified by the comeback rule. A take's score uses only aggregate duration,
lead changes, closeness and quiet time, with a penalty below 75s.

## Physics and fairness

The same fixed-step PongModel runs live, in best-take workers and in balance
tests. Continuous analytic circle/rectangle contacts reflect at the drawn faces
and rounded corners. Rapier proxies are sensors only. Balls pass through one
another, as in the Pong reference. Contacts rotate priority each tick.

Layouts start in halves, quadrants, or compact thirds. Eight permanent walls
cannot divide evenly into three factions, so a small visible neutral remainder
keeps starting ownership exactly equal. Independent seeded streams choose
orientation, spatial seats, specials, motion and comeback pairs. Names and
viewer counts never enter these choices. Team labels can be permuted without
changing a spatial battle.

balance.test.ts runs every consecutive seed 1–300 for each team count and
records raw wins, ties and decisive shares under
qa/frames/pong-wars/fairness-<n>-teams.json. Nothing filters these seeds.
index.test.ts and specials.test.ts cover fixed ticks, visible contacts,
special geometry, caps, permanence, roster independence, replay and cleanup.

## Capture

Run `npm run frames -- --game pong-wars --seed 1 --teams 4`. Stills, the contact
sheet and seven-point still-only review live in
qa/frames/pong-wars/. The shared neon kit supplies glow, 25-position trails,
pentatonic bounce sounds, sparks and the side-column HUD. The grid is the
game-specific adaptation of the sparse ring reference; the original territory
idea is Koen van Gilst's Pong Wars (MIT), credited in ASSETS.md and
licenses/pong-wars-MIT.txt.

Hype uses late close territory for live
decisive emphasis, and actual comeback/leader changes for stamps. An independently
armed rare celebration requires a real split that fills a team's eighth slot.
There is no death surface here, so it never fabricates kill or near-miss events.
Routine tile flips emit no combos and show no combo counter.
