# Hot Potato — Toy frame review

2026-10-27. This replaces the earlier neon review. Visual authority: docs/24-toy-theme.md; scope: docs/23-ship.md.

Ran npm run frames -- --game hot-potato --seed 1 --ball a against the production build at 1920×1080. The normal selector chose 1473644863. Reviewed the full-size stills and ten-frame sheet beside theme-toy.png and the rendered Toy HTML reference. No video was recorded.

| Check | Result | Evidence |
|---|---|---|
| Background and floor | PASS | Warm #ffd56b → #ff8f6b gradient; white r5/48px/22% dots. Filled #5fc9f8 → #3a8ee6 floor with faint white rings, 26px white rim and blue drop. |
| Arena and layout | PASS | Arena plus rim is approximately 891px high (82% of the frame). 380px side columns at 40px margins; no more than three cards per side. Fixed whole-arena camera. |
| Balls | PASS | Default A is matte palette fill, ink 4px outline and a darker lower-right crescent, without a white highlight dot. Rendering radius is at least 20px, or 16px above 40 live balls. Shadows, hit squash, centered Lilita numbers and crowns are shared. Colliders are unchanged. |
| Machinery | PASS | Filled walls/ramps/rings use at least 14px paint, 4px ink and a 6px solid underside; pegs use at least 10px radius. World-pixel conversion preserves these sizes after presentation fitting. No glow or wireframe skin remains. |
| Cards and type | PASS | White radius-26 cards, 5px ink borders, 8px offset shadows and 22/26px padding. Local Lilita 54px titles/44px main values; Fredoka 26/24px body; uppercase 20px labels; eased 26px bars. Debug statistics and rule paragraphs are absent. |
| Names | PASS | Shared white Lilita 24px/ink 6px tags are restricted to the top eight, crown, Boss and last five. Layout uses nearby candidate positions and board bounds. The Boss has its own anchored label. |
| Callouts and toasts | PASS | Shared yellow Lilita 110px callouts, ink 8px stroke/10px solid drop, −6° tilt and a bounded pop. Circle/panel bounds keep them off side cards. Bottom-center event toasts use an ink pill and white Fredoka 26px. |

The bomb, fuse ring and changing rim gaps retain their real positions. The rim now has the reference blue drop behind the floor, without an extra dark wall outline.

Capture: zero browser errors; sampled 60.0–60.0 FPS; camera zoom 1. Frames are normal speed with the existing live event emphasis. Physics, RNG, scoring, timings and round endings were not changed.

Files: still-02s.png, still-06s.png, still-12s.png, frame-00.png through frame-18.png, sheet.png and capture.json. PNGs and manifests remain local QA artifacts.

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

Real transfers have a brief connecting flash; the carrier gets a red urgency pulse below two seconds. Fuse and explosion rules are unchanged.

All capture manifests report zero browser errors and approximately 60 FPS samples. These are sampled presentation checks, not a claim that every frame meets a performance bound or every seed is equally entertaining. The recent-combo window has separate regression tests so another entrant cannot prolong an expired peak.


## 2026-10-28 ? spawn and feedback audit

Opened `feedback-audit/frame-12.png` and normal-speed stills beside `docs/refs/theme-toy.png`. No videos. Removed pass/blast combos and generic CLUTCH/DOUBLE KILL/mega-bomb prize banners. Physical handoffs, fuse danger, blasts and real last-moment escapes remain.

1. Background/floor: existing warm dotted Toy surround, blue filled arena and white rim match the reference.
2. Layout: full-height arena and side cards remain distinct. Fixed camera is retained except for the requested Race/Cascade course scroll.
3. Balls/heads: matte palette, outlines, shadows and existing size rules remain; this pass introduces no ball resizing.
4. Machinery/trails: visible filled geometry is preserved. Cascade alone moves the holding floors upstream to clear its outlets.
5. Type/cards: local Lilita/Fredoka, bold numbers and the existing Toy cards remain; the global combo HUD is removed.
6. Callouts: only actual rules/scores/danger/finishes remain. No generic DOUBLE KILL, COMBO, UPSET or invented jackpot overlay; true landing arithmetic is retained.
7. Verification: whole-round event-contract and feedback invariance tests, browser round completion, and still review cover this game's changed feedback. No new hidden force or random winner bias.
