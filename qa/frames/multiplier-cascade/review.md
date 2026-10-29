# Multiplier Cascade — Toy frame review

2026-10-27. This replaces the earlier neon review. Visual authority: docs/24-toy-theme.md; scope: docs/23-ship.md.

Ran npm run frames -- --game multiplier-cascade --seed 1 --ball a against the production build at 1920×1080. The normal selector chose 1525965497. Reviewed the full-size stills and ten-frame sheet beside theme-toy.png and the rendered Toy HTML reference. No video was recorded.

| Check | Result | Evidence |
|---|---|---|
| Background and floor | PASS | Warm #ffd56b → #ff8f6b gradient; white r5/48px/22% dots. Filled #5fc9f8 → #3a8ee6 floor with faint white rings, 26px white rim and blue drop. |
| Arena and layout | PASS | Arena plus rim is approximately 996px high (92% of the frame). 380px side columns at 40px margins; no more than three cards per side. Fixed whole-arena camera. |
| Balls | PASS | Default A is matte palette fill, ink 4px outline and a darker lower-right crescent, without a white highlight dot. Rendering radius is at least 20px, or 16px above 40 live balls. Shadows, hit squash, centered Lilita numbers and crowns are shared. Colliders are unchanged. |
| Machinery | PASS | Filled walls/ramps/rings use at least 14px paint, 4px ink and a 6px solid underside; pegs use at least 10px radius. World-pixel conversion preserves these sizes after presentation fitting. No glow or wireframe skin remains. |
| Cards and type | PASS | White radius-26 cards, 5px ink borders, 8px offset shadows and 22/26px padding. Local Lilita 54px titles/44px main values; Fredoka 26/24px body; uppercase 20px labels; eased 26px bars. Debug statistics and rule paragraphs are absent. |
| Names | PASS | Shared white Lilita 24px/ink 6px tags are restricted to the top eight, crown, Boss and last five. Layout uses nearby candidate positions and board bounds. The Boss has its own anchored label. |
| Callouts and toasts | PASS | Shared yellow Lilita 110px callouts, ink 8px stroke/10px solid drop, −6° tilt and a bounded pop. Circle/panel bounds keep them off side cards. Bottom-center event toasts use an ink pill and white Fredoka 26px. |

Filled green/blue/pink multiplier planes, chunky moving machinery and raised pocket labels remain legible. The extra toy-relay frame set checks hopper counts inside the board and actual finishers out of five in the right card.

Capture: zero browser errors; sampled 60.0–60.0 FPS; camera zoom 1. Frames are normal speed with the existing live event emphasis. Physics, RNG, scoring, timings and round endings were not changed.

Files: still-02s.png, still-06s.png, still-12s.png, frame-00.png through frame-18.png, sheet.png and capture.json. PNGs and manifests remain local QA artifacts.

Shared candidate-style and show-screen checks are in ../deadline-polish.md. These stills validate the visual pass; they do not claim new gameplay tuning or an authenticated Twitch rehearsal.


## 2026-10-28 offline ship polish

Reviewed normal-speed `npm run frames` captures in `ship-polish/ and ship-relay/` against `docs/refs/theme-toy.png`. This section supersedes older unchanged-behavior statements where noted. No video was recorded.

| Look point | Review |
|---|---|
| Background/floor | PASS: warm dotted background, blue filled floor and white rim retained. |
| Arena/layout | PASS: full fixed machine remains visible; Marble Race retains its requested leader-follow exception. |
| Actors | PASS: existing matte palette actors remain readable; Light Cycles retains its requested arrow replacement. |
| Machinery/spacing | PASS: chunky outlined solid hardware, actual open passages and readable functional colors; thin cycle trails are the requested exception. |
| Type/cards | PASS: local Lilita/Fredoka, side cards and live outcome values retained. |
| Names | PASS: featured names remain next to their own actors; no new name panels or bookkeeping. |
| Effects | PASS: callouts are bounded, live emphasis preserves fixed arenas, and winning payouts retain the Toy treatment. |

Blue/green/yellow physical holding gates release earlier. Dense streams cross visible multiplier planes; the finite relay still ends at the fifth physical finish. Sixteen raw rounds take 93.7?100.9 seconds.

All capture manifests report zero browser errors and approximately 60 FPS samples. These are sampled presentation checks, not a claim that every frame meets a performance bound or every seed is equally entertaining. The recent-combo window has separate regression tests so another entrant cannot prolong an expired peak.

## 2026-10-28 — Feedback pass

Reviewed normal-speed stills against docs/refs/theme-toy.png; doc 24 overrides the old neon look. No videos.
feedback-drop-one, feedback-drop-two, feedback-drop-three: different actual geometry; clear outer drain approaches; 111–123s raw rounds.

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
scroll-crowd / scroll-finale / tall-midcourse: one eight-chamber course and a finish below it. Constant 22-world-pixel balls; bounded red drains and an outer bypass. No repeated drops or fake kill captions.

| Look point | Result |
|---|---|
| Backdrop | PASS: Toy dotted warm background, blue arena, white rim. |
| Framing | PASS: fixed zoom; Cascade uses the user's requested slow downward scroll, other arenas stay fixed. |
| Actors | PASS: matte filled actors and readable numbers; Cascade radius stays constant through crowds. |
| Hardware | PASS: solid outlined surfaces, distinct chambers and open sensor mouths; cycle bends are filled curves. |
| Type/cards | PASS: local fonts, actual values and brief labels; streamer identity replaces role nicknames. |
| Names | PASS: names stay by featured actors and the connected streamer. |
| Effects | PASS: local multiplication stamps; near-miss type is 40px, capped at 180px and follows the affected living actor. |


## 2026-10-28 ? smaller balls and faster flow

Visual authority remains doc 24, with the user's explicit smaller-ball and scrolling-camera overrides. Opened `theme-toy.png` beside `fast-flow/frame-12.png`, `fast-finish/sheet.png` and their full-size stills. Captures use the real production `/play` view at normal speed, exact seed 2; no videos.

1. Background/floor: matches the warm dotted Toy surround and filled blue floor; no neon/glow.
2. Layout/camera: full-height machine stays in the center, side cards remain separate. The requested downward-only scroll stops at the scoring pockets until the finish opens; the retired frame stays visible during the pan.
3. Balls/spacing: requested radius 16 replaces 22 for both colliders and rendering, consistently at every population. Matte fills, ink outline, crescent and shadow remain; no population-dependent resize.
4. Machinery: chunky white/colored surfaces, pegs, bearings and pivoting/retracting floors remain visible. Gates swing in 0.75s, hatch in 0.5s; floor cadence is 4.5s. Clones retain downward momentum, and ordinary gravity increases from 2.5 to 4.25.
5. Feedback/audio: no global combo in multiplication, banking or the finish. Local ?2/?3/?0 stamps still show real arithmetic. Bounce notes remain; the CC0 factory bed is independently switchable.
6. Motion/readability: the smaller balls have visibly more clearance at pegs and multiplier exits; the camera no longer scrolls below the pockets into blank floor. Actual multiplications and physical contacts determine supply.
7. Ending: the visible final release starts at 40s; the finite first-to-five finish remains. Seeds 1?16 finish in 51.6?57.5s with zero expiry, zero sudden death and exact supply conservation. No hidden push or result adjustment.


## 2026-10-28 ? spawn and feedback audit

Opened `immediate-splits/frame-12.png` and normal-speed stills beside `docs/refs/theme-toy.png`. No videos. Removed deferred births, anonymous near-miss banners and random prizes. Holding floors are upstream; split bodies appear together in the crossing step. Saturated outlets show blue ?1 until clear.

1. Background/floor: existing warm dotted Toy surround, blue filled arena and white rim match the reference.
2. Layout: full-height arena and side cards remain distinct. Fixed camera is retained except for the requested Race/Cascade course scroll.
3. Balls/heads: matte palette, outlines, shadows and existing size rules remain; this pass introduces no ball resizing.
4. Machinery/trails: visible filled geometry is preserved. Cascade alone moves the holding floors upstream to clear its outlets.
5. Type/cards: local Lilita/Fredoka, bold numbers and the existing Toy cards remain; the global combo HUD is removed.
6. Callouts: only actual rules/scores/danger/finishes remain. No generic DOUBLE KILL, COMBO, UPSET or invented jackpot overlay; true landing arithmetic is retained.
7. Verification: whole-round event-contract and feedback invariance tests, browser round completion, and still review cover this game's changed feedback. No new hidden force or random winner bias.
