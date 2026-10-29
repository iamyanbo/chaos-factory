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
and its JSON provenance. Authenticated !join/Prediction/native payout rehearsal,
the actual main Codex session ID, team details, video and final Devpost submission
remain owner steps. No recording or live Twitch action was performed in this pass.
See qa/known-issues.md and docs/SHIP-CHECKLIST.md.
