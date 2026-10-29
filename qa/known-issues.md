# Release limits — October 29, 2026

## Still open

- **Blade Brawl Boss balance:** the requested rage power is implemented; the
  200-seed-per-size rerun favors the Boss (78.5%, 89.0%, 67.5% at 8/16/32
  chatters), with zero voids or arena escapes. This is FAIL against 45–55%.
  HP remains the documented 55/viewer. Earlier no-rage threshold probes are
  historical and do not calibrate this version. Cosmetic event-timing/palette
  edits during/after the long audit also prevent its source-hash acceptance;
  no balance PASS is claimed. See qa/blade-boss-balance.md and JSON provenance.
  Do not add an undisclosed population curve or select takes by who wins.
- **Twitch rehearsal:** a real EventSub `!join` admitted iamyanbo to Peg Fever,
  and host start/countdown led to gameplay without wagers on October 29. The
  connected channel is standard, so native Predictions are not applicable on
  this account. A public broadcast and eligible-channel native point payout
  remain unperformed and are not claimed by the recorded chat proof.
- **Submission account steps:** the public repository is
  https://github.com/iamyanbo/chaos-factory. The actual main Codex session ID is
  prepared; the final YouTube URL is still missing.
  Solo membership is recorded as iamyanbo. The copy and storyboard are in
  docs/SUBMISSION.md; docs/SHIP-CHECKLIST.md now collects the remaining owner
  steps. `npm run submission` packages the committed handoff without publishing
  it, and `npm run submission:check` reports missing fields/confirmations from
  docs/submission-fields.json. The revised 1:49 MP4 and upload/form copy are
  local in qa/submission-video/. YouTube upload and final Devpost submission
  still require account access; neither has been performed.

## Expected behavior

- An equal-territory Pong Wars result is a draw/void, rather than an invented
  tiebreak winner. One of 16 raw seeds tied in the release audit. Pong stays
  outside the Cup pool.
- Raw Ring Run+ seeds can escape quickly (11.9s in the current sample). Normal
  play uses the winner-blind best-take selector; `take=seed` bypasses it for
  debugging. Ring Run+ stays outside the Cup pool.
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
