# End-screen redesign ? October 28

The previous result used a generic white modal, an unexplained +5/+1 podium even offline, a Cup-only next-step message in practice, and remnants of the old arena behind it. The new presenter has a clear game/round heading, a large matte winner avatar with crown, labeled game results, and separate actual Cup bonuses. It names the Grand Final champion independently of Cup-point rank. Cancelled/empty results do not celebrate a winner or claim an imaginary prediction refund.

Offline: Play again starts a fresh hidden seed in the same game/format; Change game reveals and focuses the existing selector. Neither action is shown as an OBS control. Live results identify the next screen and use the existing phase clock; Cup standings use two columns and highlight actual qualifiers after round four. The game backdrop and transient game-owned HUD hide at intermission, preventing Peg's last receipt from drifting over the result footer.

Before/after stills: `qa/frames/end-screen/before/` and `after/`. Preview cases include a long name, all six teams, individual points, Cup champion, standings, cancellation and an empty Cup. Actual offline endings and replay/change-game actions are checked separately. No videos.

Toy review:
1. Warm gradient/dot background matches the reference; the old arena is hidden during results.
2. Two large rounded result cards fill the frame with clear margins, without gameplay HUD overlap.
3. Winner avatar reuses the existing matte/jelly/face renderer and palette, with a procedural crown.
4. Existing five-pixel ink borders, rounded white cards and offset shadows remain shared components.
5. Lilita headings and Fredoka results have a clear size hierarchy; long names fit without overwriting values or bonuses.
6. Game scores, actual Cup bonuses, finish times and finisher counts have explicit units. No invented fallback point or rank.
7. Entry motion is brief and cosmetic. Offline actions work; show timing, scoring, predictions and physics are unchanged.

`npm run frames -- --game multiplier-cascade --seed 4 --exact --phase RESULT --label result-screen` captures a real normal-speed ending and a ten-frame sheet at `qa/frames/multiplier-cascade/result-screen/`. The --phase extension accepts PLAY/RESULT only and records no video.

Validation: typecheck/build pass. The clean full suite passes 353 tests in 71 files, including real award/rank semantics, Grand Final champion identity and gameplay/result HUD isolation. The main browser sweep passes 26 checks; a focused rerun of end actions and the complete five-round Cup passes after separating transient HUD layers. A parallel unit attempt exceeded the existing long camera-audit timeout; the clean sequential run passes without weakening its checks.
