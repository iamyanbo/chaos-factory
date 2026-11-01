# Release limits — October 29, 2026

## Still open

- **Validation runtime:** earlier October 31 full runs completed the existing
  200-course camera audit but exceeded its 240 s time limit. The v13 full run
  during encoding passed 374 tests with that one timeout. Its unchanged three-test
  file passed after rendering in 137.28 s. The current v18 full run passes all
  351 tests across 75 files, including that audit, after encoding finished. An
  earlier concurrent run took 268.535 s for the audit and exceeded its limit.
  Physics assertions and timeout values are unchanged; machine load affects the audit.

- **Blade Brawl Boss balance:** the requested rage power is implemented; the
  200-seed-per-size rerun favors the Boss (78.5%, 89.0%, 67.5% at 8/16/32
  chatters), with zero voids or arena escapes. This is FAIL against 45–55%.
  HP remains the documented 55/viewer. Earlier no-rage threshold probes are
  historical and do not calibrate this version. Cosmetic event-timing/palette
  edits during/after the long audit also prevent its source-hash acceptance;
  no balance PASS is claimed. See qa/blade-boss-balance.md and JSON provenance.
  Do not add an undisclosed population curve or select takes by who wins.
- **Current video:** v18 keeps independent rounds, all eight games and chat versus
  streamer, adding the original doc 24 request and four-file code scroll with the
  requested GPT-6.1 Sol credit. The local 2:57.0 MP4 is ready for owner
  review and upload at qa/submission-video/chaos-factory-demo.mp4. Blade Brawl
  was recaptured with the same seed and identical result after recorded-frame
  checks found stutters missed by the game's FPS counter. Simulated audiences
  and the historical real join remain labeled.
- **Twitch rehearsal:** the real EventSub !join admitted iamyanbo to Peg Fever
  on October 29. The October 31 design requests chat-read permission only and
  removes Predictions entirely. No native payout rehearsal remains.
- **Submission account steps:** the public repository is
  https://github.com/iamyanbo/chaos-factory. The actual main Codex session ID is
  prepared; the final YouTube URL is still missing.
  Solo membership is recorded as iamyanbo. The copy and storyboard are in
  docs/SUBMISSION.md; docs/SHIP-CHECKLIST.md now collects the remaining owner
  steps. `npm run submission` packages the committed handoff without publishing
  it, and `npm run submission:check` reports missing fields/confirmations from
  docs/submission-fields.json. The revised 2:57.0 MP4 and upload/form copy are
  local in qa/submission-video/. YouTube upload and final Devpost submission
  still require account access; neither has been performed.

## Expected behavior

- An equal-territory Pong Wars result is a draw/void, rather than an invented
  tiebreak winner. One of 16 raw seeds tied in the release audit. Pong stays
  outside the default pool and available as an optional queue/rotation choice.
- Raw Ring Run+ seeds can escape quickly (11.9s in the current sample). Normal
  play uses the winner-blind best-take selector; `take=seed` bypasses it for
  debugging. Ring Run+ is an optional queue/rotation choice, outside the default pool.
- A hidden 150s threshold begins visible sudden death; it does not award a
  timed win. The release sample needed no sudden death at default field sizes.
- The app allows one controlling `/show` connection per server. Additional
  shows explain the conflict; use `/play` for independent offline games.
- A production build reports a large bundle warning because deterministic
  Rapier is included in the show and simulation worker. Round preparation can
  take up to six seconds, followed by the visible three-second countdown.

The offline release audit covers completion, natural results and body limits.
Passing it is not a claim that every seed is equally entertaining; real viewer
feedback remains the standard for watchability.
