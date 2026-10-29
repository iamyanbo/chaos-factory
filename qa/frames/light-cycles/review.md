# Light Cycles — Toy frame review

2026-10-28. Updated for edge clipping and arrow-head feedback. Visual authority: docs/24-toy-theme.md, with the user's requested thinner trails and arrows; scope: docs/23-ship.md.

Ran `npm run frames -- --game light-cycles --seed 1 --exact --label arrow-heads` and another capture with `--from 72 --label arrow-closing-edges` against the production build at 1920×1080. Reviewed full-size stills against theme-toy.png and the earlier thick-trail capture, including the four outer corners and moving wall edges. No video was recorded.

| Check | Result | Evidence |
|---|---|---|
| Background and floor | PASS | Warm #ffd56b → #ff8f6b gradient; white r5/48px/22% dots. Filled #5fc9f8 → #3a8ee6 floor with faint white rings, 26px white rim and blue drop. |
| Arena and layout | PASS | Arena plus rim is approximately 1041px high (96% of the frame). The square board and clipping rectangle match the square collision grid; rounded corner cutouts are gone. 380px side columns, fixed whole-arena camera. |
| Arrow heads | PASS with requested ball replacement | Directional matte arrowheads use Toy palette fills, ink outlines and solid undersides. They point in the actual cardinal heading, without ball squash on turns. Crowns and upright names remain. Collision cells and head radius are unchanged. |
| Machinery and trails | PASS with requested thin-trail exception | Trails use a 3px core, 1.25px ink outline and 1px underside. Continuous segments keep right-angle turns connected while adjacent grid paths stay separate. The square white wall's inner face matches the actual blocked grid boundary, with a dark filled closing region behind it. No glow remains. |
| Cards and type | PASS | White radius-26 cards, 5px ink borders, 8px offset shadows and 22/26px padding. Local Lilita 54px titles/44px main values; Fredoka 26/24px body; uppercase 20px labels; eased 26px bars. Debug statistics and rule paragraphs are absent. |
| Names | PASS | Shared white Lilita 24px/ink 6px tags are restricted to the top eight, crown, Boss and last five. Layout uses nearby candidate positions and board bounds. The Boss has its own anchored label. |
| Callouts and toasts | PASS | Shared yellow Lilita 110px callouts, ink 8px stroke/10px solid drop, −6° tilt and a bounded pop. Circle/panel bounds keep them off side cards. Bottom-center event toasts use an ink pill and white Fredoka 26px. |

Permanent trails are thin filled palette tracks with ink outlines and solid undersides. Smaller arrowheads replace oversized balls; the rectangular floor, mask and inner wall avoid edge cutoffs. Name placement is bounded on all four sides as walls close and hides labels once they cannot fit. Finale zoom is disabled for this game, keeping all four walls visible while live slow motion continues. Occupied cells and steering are unchanged.

Capture: zero browser errors; sampled 60.0–60.0 FPS; camera zoom 1. Frames are normal speed with existing live event emphasis. Physics, RNG, scoring, timings and round endings were not changed. Full verification: typecheck and 319 tests across 64 files pass. A new browser regression samples the actual seeded closing-wall finale and verifies that decisive slow motion leaves zoom at 1 and the camera centered throughout.

Files in `arrow-heads/` and `arrow-closing-edges/`: still-02s.png, still-06s.png, still-12s.png, frame-00.png through frame-18.png, sheet.png and capture.json. PNGs and manifests remain local QA artifacts.

Shared candidate-style and show-screen checks are in ../deadline-polish.md. These stills validate the visual pass; they do not claim new gameplay tuning or an authenticated Twitch rehearsal.


## 2026-10-28 offline ship polish

Reviewed normal-speed `npm run frames` captures in `ship-polish/` against `docs/refs/theme-toy.png`. This section supersedes older unchanged-behavior statements where noted. No video was recorded.

| Look point | Review |
|---|---|
| Background/floor | PASS: warm dotted background, blue filled floor and white rim retained. |
| Arena/layout | PASS: full fixed machine remains visible; Marble Race retains its requested leader-follow exception. |
| Actors | PASS: existing matte palette actors remain readable; Light Cycles retains its requested arrow replacement. |
| Machinery/spacing | PASS: chunky outlined solid hardware, actual open passages and readable functional colors; thin cycle trails are the requested exception. |
| Type/cards | PASS: local Lilita/Fredoka, side cards and live outcome values retained. |
| Names | PASS: featured names remain next to their own actors; no new name panels or bookkeeping. |
| Effects | PASS: callouts are bounded, live emphasis preserves fixed arenas, and winning payouts retain the Toy treatment. |

Thin continuous paths, square grid boundaries and directional arrows remain readable. No simulation changes; the complete machine stays visible during highlights.

All capture manifests report zero browser errors and approximately 60 FPS samples. These are sampled presentation checks, not a claim that every frame meets a performance bound or every seed is equally entertaining. The recent-combo window has separate regression tests so another entrant cannot prolong an expired peak.

## 2026-10-28 — Feedback pass

Reviewed normal-speed stills against docs/refs/theme-toy.png; doc 24 overrides the old neon look. No videos.
feedback-corners: square-capped filled trail layers close each right-angle join; arrow heads and fixed square arena retained.

| Look point | Current review |
|---|---|
| 1. Backdrop | PASS: warm dotted background, blue floor and white rim use Toy tokens. |
| 2. Framing | PASS: whole arena stays centered and fixed, including live emphasis. |
| 3. Actors | PASS: matte palette actors, outlines and shadows; requested arrows replace cycle balls. |
| 4. Geometry | PASS: filled outlined machinery and open real passages; cycle trails retain requested thin paint with filled joins. |
| 5. Type/cards | PASS: bundled Lilita/Fredoka, readable side cards, no visible seed setting. |
| 6. Names | PASS: names stay with featured actors; no new name panels. |
| 7. Effects | PASS: bounded callouts, live feedback and game-specific events; no Pong combo. |

The capture manifests retain actual FPS/time observations and report zero browser errors. Physical completion, body limits and visual inspection are separate checks, not a claim of equal watchability for every seed.

## 2026-10-28 — Continuous course and softer feedback

Reviewed current normal-speed stills against theme-toy.png. No video.
soft-trails: shaded rounded arrows and filled curved tube bends match the Toy surfaces. Grid trajectories are unchanged. Browser samples verify small captions follow their living subject.

| Look point | Result |
|---|---|
| Backdrop | PASS: Toy dotted warm background, blue arena, white rim. |
| Framing | PASS: fixed zoom; Cascade uses the user's requested slow downward scroll, other arenas stay fixed. |
| Actors | PASS: matte filled actors and readable numbers; Cascade radius stays constant through crowds. |
| Hardware | PASS: solid outlined surfaces, distinct chambers and open sensor mouths; cycle bends are filled curves. |
| Type/cards | PASS: local fonts, actual values and brief labels; streamer identity replaces role nicknames. |
| Names | PASS: names stay by featured actors and the connected streamer. |
| Effects | PASS: local multiplication stamps; near-miss type is 40px, capped at 180px and follows the affected living actor. |


## 2026-10-28 ? smaller arrowheads

Opened `smaller-arrows/frame-06.png` and its normal-speed sheet beside `docs/refs/theme-toy.png`. The user approved the trails; this pass scales the rounded arrowhead art to 85%, with no grid, trail, timing or collision changes. No videos.

1. Warm dotted background and filled blue floor match the Toy reference.
2. Whole square arena and all four walls remain in the fixed camera, including the decisive finale (browser regression).
3. Arrowheads are 15% smaller while the rounded tube trail keeps its existing width.
4. Ink outlines, matte palette fills and darker undersides remain; no neon/glow or wireframe added.
5. Local Lilita/Fredoka labels, cards and crown remain shared; labels keep their original scale.
6. Rounded corners and shaded joins are unchanged from the approved version; the smaller head no longer overstates the trail width.
7. Small actor-following near-miss captions remain centered on the living rider, with the 180px cap; audio now has a separately switchable CC0 bed.


## 2026-10-28 ? spawn and feedback audit

Opened `feedback-audit/frame-12.png` and normal-speed stills beside `docs/refs/theme-toy.png`. No videos. Removed generic kill streaks, combos and random trail prizes. Crashes identify victims; small near-miss labels only follow living riders.

1. Background/floor: existing warm dotted Toy surround, blue filled arena and white rim match the reference.
2. Layout: full-height arena and side cards remain distinct. Fixed camera is retained except for the requested Race/Cascade course scroll.
3. Balls/heads: matte palette, outlines, shadows and existing size rules remain; this pass introduces no ball resizing.
4. Machinery/trails: visible filled geometry is preserved. Cascade alone moves the holding floors upstream to clear its outlets.
5. Type/cards: local Lilita/Fredoka, bold numbers and the existing Toy cards remain; the global combo HUD is removed.
6. Callouts: only actual rules/scores/danger/finishes remain. No generic DOUBLE KILL, COMBO, UPSET or invented jackpot overlay; true landing arithmetic is retained.
7. Verification: whole-round event-contract and feedback invariance tests, browser round completion, and still review cover this game's changed feedback. No new hidden force or random winner bias.
