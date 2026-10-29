# Submission release check - October 29, 2026

## Current scope

Eight playable games; the five-game Cup pool ends with the top-eight Blade Brawl
final. The public submission repository is https://github.com/iamyanbo/chaos-factory.
Rejected prototypes, old design docs, obsolete tools/reports, historical reference
footage and unused Baloo 2 assets are excluded. Original files/history are preserved
locally; the public repository starts with the clean submission snapshot.

## Verified in the cleaned source

- Typecheck and production build: PASS.
- Unit suite: **352 tests across 71 files PASS**. Four rejected Counterweight-only
  tests were retired with that plugin. The two director/Prediction regressions now
  use the shipped two-team Cascade game, including real winning-outcome mapping.
- Browser regressions: **13 PASS**, against the production mock build. All eight
  games reach results without generic combo/jackpot captions. Cascade replays in
  the headless simulation; offline replay/change-game actions and result variants
  work; selector/dashboard pools and local fonts are correct.
- The browser pass includes a complete accelerated five-round Cup, all four
  standings screens, qualification and the Grand Final. It is a functional check,
  not normal-speed footage or a live Twitch broadcast.
- Retained tracked text passes the credential-pattern scan. Local .env/.data,
  dependencies, builds and generated captures are excluded from the repository.
- GitHub checks run npm ci, typecheck, tests and build on Node 22.

## Reproduce

From a fresh checkout, run `npm ci`, then `npm run demo`. The production mock
show is http://127.0.0.1:4182/show and the offline selector is /play. For browser
QA, install Chrome and set CHROME_PATH if needed; set CHAOS_TEST_URL to the running
instance before `npm run test:e2e`.

Frame review notes for the eight games remain under qa/frames/<id>/review.md.
Regenerate stills with `npm run frames`; original generated media stays local.
The result-screen review is qa/end-screen-review.md. Fonts, music and retained
MIT notices are credited in ASSETS.md.

## Remaining limits

The current Blade Brawl streamer balance FAIL remains in qa/blade-boss-balance.md
and its JSON provenance. Eligible-channel Prediction/native payout rehearsal,
the final YouTube URL and final Devpost submission remain owner steps. The actual
main Codex session ID, solo membership and real EventSub !join are now prepared.
A standard channel cannot rehearse native Predictions. The latest v3 film uses a
fresh normal-speed five-round Cup, four standings and actual champion with game
music disabled at capture; one continuous licensed track is mixed afterward.
See qa/submission-video-review.md, qa/known-issues.md and docs/SHIP-CHECKLIST.md.


## Finish-camera and film audio pass ? October 29

Typecheck and all 357 unit tests across 73 files pass. The production browser pass
adds 16 passing checks across eight games, offline/results views, music controls
and the first Race finish. The finish regression failed on the old temporary zoom
and passes with the monotonic camera. A fresh normal-speed Cup and final MP4 decode
also pass; the film's clean audio provenance and frame review are recorded in
qa/submission-video-review.md. Older test totals above describe the cleanup snapshot.


## Film flow revision - October 29

The latest film is v4, 95.430 seconds, with 48 simulated joins and a separately
labeled real Twitch-test inset. Rules/Codex notes accompany the five game clips;
there is no separate explanation ending. Typecheck and all 358 tests/73 files
pass; the five focused film-plan/audio checks also pass after the final overlay
fixes. Final H.264/AAC decoding and audio-level checks pass. Gameplay was unchanged.


## Gameplay payoff and attribution revision - October 29

The latest film is v5, 109.415 seconds. Hot Potato now retains twenty seconds
through actual fuse expiries, shockwaves and rim damage. Peg Fever shows multiplied
landings and Marble Race holds through two finishes. All five overlays use their
actual game names; one credit states Codex implemented the entire project, with
user direction/review. Typecheck and all 359 tests/73 files pass, including six
focused film-plan/audio tests. Final decoding and audio checks pass; gameplay
code and timings are unchanged. See qa/submission-video-review.md.


## Motion edit revision - October 29

The latest film is v6, 110.975 seconds: kinetic chapter titles, source-timed comic
accents, original stereo transition sounds, champion confetti and animated closing
branding. The approved intro, physical payoffs, whole-project Codex attribution and
honest simulated/real-chat labels remain. The 154 BPM cut grid extends gameplay
windows; actual encoded drift is under one frame. Full decoding and audio checks
pass. Typecheck and all 361 tests/73 files pass, plus eight final focused checks.


## Reading holds and focused action - October 29

The latest film is v7, 107.720 seconds. Titles hold for two seconds before a
slower exit; only the 3.5-second opening says "Implemented with Codex". Quiet
scroll/fuse sections are cut while both explosions and other physical payoffs
remain. Deterministic title frames and a source-duration guard preserve reading
time in the export. Typecheck, all 361 tests/73 files and eight final focused
checks pass. Full decoding, cut timing and final audio headroom checks pass.
