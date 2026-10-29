The actual normal-speed five-round Cup is `full-cup.webm`:1920x1080,716.580s media /716.6485s wall, original VP8/Opus packets remuxed without retiming. Requested seed42;24mock viewers with2500–4500ms simulated stream delay. No browser errors. Audio is non-silent: mean-38.6dB, peak-12.2dB.

| Round | Game | Play starts | Result | Next card |
| --- | --- | ---: | ---: | --- |
|1|Ring Run+|42.11s|132.03s|Standings138.11–146.11s|
|2|Pong Wars|185.11s|275.12s|Standings281.11–289.11s|
|3|Marble Race|331.21s|418.31s|Standings424.32–432.33s|
|4|Multiplier Cascade|474.41s|574.91s|Standings580.91–589.01s|
|5|Blade Brawl FFA|628.71s|704.61s|Cup champion710.61s onward|

Opened the actual video extracts in `sheet.png`, the full-size first/fourth standings, Grand Final intro and champion card. Names, levels, titles, points, rank arrows and the top-eight cut line remain separate and readable. The standings reorder animation shows the old rows departing before the new rows enter, rather than crossing names. Six-second intro/outro cards and eight-second standings use wall time; lock includes the actual worker search when needed. All five rounds reached all three named stages.

Only the eight qualified user IDs entered the final. `neon_otter` physically survived it, while `neon_fox` remained the points leader: the survivor correctly took the Cup. `/api/profiles` persisted the champion, Cup win, XP, title and crown. The crown, stable viewer colors and music layers are visible/audible during the rounds. `capture.json` retains the original transitions, game results, FPS samples and profile snapshot. This recording covers the five established games; each new game also has its individual20s recording.

## Doc 22 production browser QA — 2026-10-26 (no new video)

This pass used the built production app at http://127.0.0.1:4180, an isolated mock server in `qa/cup-doc22-data`, 64 mock bettors, 24 visible entrants in each of the first four rounds, and eight finalists. Mock messages retained the 2500–4500 ms delay. Fast mode was used for this automated functional pass. Only stills and JSON were captured; the historical video evidence above was left untouched.

| Round | Game | Actual simulation duration | Outcome |
| --- | --- | ---: | --- |
| 1 | Hot Potato / Boss vs Chat | 59.45 s | Streamer survived to three chatters |
| 2 | Peg Fever / Faction | 40.88 s | Mint won after Extreme Fever |
| 3 | Spinner Showdown / FFA | 81.43 s | Last player on the platform |
| 4 | Tower Topple / Faction | 171.03 s | Red crown remained; visible sudden death continued beyond 150 s |
| 5 | Blade Brawl / top-eight FFA | 78.77 s | `pixel_otter` physically survived with 2 HP |

All five rounds ended through their rules. Hot Potato reached DOUBLE BOMBS before its CvS objective ended the round; Peg Fever, Spinner and Tower reached all three physical stages. The actual four standings cards, Grand Final intro, champion card and reloaded crown screen were opened and reviewed. Names, levels, points, rank arrows and the top-eight cut line are readable. The screenshots from this production build also exposed a global PAUSED banner/footer overlap; root has fixed its placement in source and will check a still after the final rebuild.

Exactly the eight round-four qualifiers entered the final. `neon_ghost` led the pre-final points, but `pixel_otter` won the actual fight and correctly took the Cup. The API and isolated on-disk `profiles.json` persisted its Cup win, 16 XP, level 2, Cup Champion title and crown. Reloading `/show` decorated the returning viewer with the crown and preserved the viewer color.

Four real mock prediction lifecycles (`mock-1` through `mock-4`) showed ACTIVE → LOCKED → RESOLVED, with actual mock bettors and payouts. Spinner FFA correctly ran without wagers because its full field exceeds the native outcome count; its physical result still earned Cup points. Live Twitch authorization was explicitly deferred for this pass.

The final combined result is **11/11 logical checks passed**: all ten offline views opened without WebSockets or browser errors, all three Blade formats and all four new-game browser results replayed exactly, the empty-viewer Pong machine ran, and the full Cup passed. Two initial replay collector failures were fixed in the shared simulation tool and the affected Peg/Spinner checks were rerun successfully; neither replay assertion was bypassed. Raw attempts remain in `qa/dopamine-browser-first-run.json` and `qa/dopamine-browser-retry.json`; `qa/dopamine-browser-final.json` is the explicit merged result. The Cup has zero page or console errors. Detailed state, phases, stages, qualifiers, profiles and prediction packets are in `qa/dopamine-browser-cup.json`, with a compact summary in `qa/dopamine-browser-summary.json` and stills in `qa/dopamine-browser-artifacts/`.

Final rebuilt UI fix verification (2026-10-26): opened `qa/dopamine-browser-artifacts/paused-layout-forced-void.png` from the refreshed production build. PAUSED is in the top-right card header near (1400, 65), clear of both the centered Cup title and the footer countdown. This is explicitly a **layout-only forced-void fixture**, not another competitive Cup: start → force-void RESULT → STANDINGS → pause for the still, then end Cup and resume back to ATTRACT. `qa/dopamine-browser-paused-layout.json` records the forced-void label, clean unpaused ATTRACT end state, zero page/console errors and no video. The real 11/11 production checks and their original Cup evidence remain preserved above and in their JSON reports.


## 2026-10-28 final offline ship Cup

Current production five-game lineup, normal speed, 24 simulated viewers, no real Twitch or wagers. No video was recorded.

| Round | Game | Simulation seconds |
|---:|---|---:|
| 1 | hot-potato | 60.42 |
| 2 | multiplier-cascade | 98.03 |
| 3 | peg-fever | 47.53 |
| 4 | marble-race | 88.37 |
| 5 | Blade Brawl top-eight FFA | Actual final survivor decides |

PASS: 564.391 wall seconds; zero browser errors. All four standings screens appeared, exactly the top eight qualified, and `cosmic_otter` won the actual final and persisted its Cup win/crown. Local originals: qa/ship-cup/report.json and standings-1..4.png, finalists.png, champion.png. The earlier normal-speed first pass remains separately in qa/ship-cup-first-pass/.

Peg Fever includes its equal visible 100-point starting run, and automatic no-wager joins use ten seconds. This supplements the historical reviews above; it does not claim an authenticated Twitch rehearsal.
