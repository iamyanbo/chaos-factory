# Submission checklist — October 29, 2026

Deadline: **November 2, 2026, 5 pm Eastern / 2 pm Pacific**.
Aim to submit November 1. The organizer requires an accessible source repository,
a description of the project and Codex's role, the main Codex session ID, and a
YouTube demo showing Twitch and Codex in under three minutes. A saved draft is
not submitted. [Official rules](https://twitchcon-codex.devpost.com/rules),
[organizer FAQ](https://twitchcon-codex.devpost.com/resources).

## Already prepared

- Eight playable games; five-game Cup pool, standings, top-eight final and profiles.
- Mock judge demo: `npm ci`, then `npm run demo`; no account or tokens needed.
- Live connector, reconnect/recovery behavior and server-only authorization storage.
- Project description and demo outline in [SUBMISSION.md](SUBMISSION.md).
- Licensed fonts/music and credits in [ASSETS.md](../ASSETS.md).
- Test coverage and still reviews. Current limitations remain in [known issues](../qa/known-issues.md).
- `npm run submission`: creates `qa/submission/` with committed source ZIP, commit/hash
  manifest, copy, checklist, credits and five existing game images. It records no video.

## Owner steps, apart from recording

1. **Check the published repository.** The submission repo is
   https://github.com/iamyanbo/chaos-factory. Future reviewed updates can be pushed with:

   ```sh
   git push -u origin HEAD
   ```

   Keep the public repository available for judging. Check its URL signed out
   again before submitting; no judge invitation is required while it is public.
   Never upload `.env` or `.data`; the source ZIP excludes them.
2. **Confirm a real Twitch round.** Your earlier connection is not a completed
   payout rehearsal. Run `npm run twitch`, open
   http://localhost:4181/show?manual=1, and use the dashboard on **4181**.
   Follow [LIVE-TEST.md](LIVE-TEST.md): real `!join`, host start, Prediction open,
   lock, correct resolution, native point payout and a no-wager fallback.
   Use an eligible channel for wagering. No live actions were taken by this setup task.
3. **Enter the actual main Codex session ID and team members.** Use the main
   build thread's ID; the organizer FAQ above explains where to find it.
4. **Fill [submission-fields.json](submission-fields.json).** Enter the repository,
   actual session ID and team now; add the YouTube URL after recording. Set the
   verification booleans only after observing the corresponding real behavior.
   These are owner confirmations, not claims that the tool verified external services.
5. **Create the Devpost project draft.** Paste [SUBMISSION.md](SUBMISSION.md)'s
   description and the real links/ID. Check team membership in Devpost. Local JSON
   does not populate or submit that form. Add the video when ready, then click
   Submit and confirm the project is listed as Submitted before the deadline.

## Rebuild the handoff

```sh
npm run typecheck
npm test
npm run build
# Commit the reviewed changes and filled fields first.
npm run submission
npm run submission:check
```

`submission:check` intentionally exits nonzero while a required field or owner
confirmation is missing. It checks URL syntax, not reachability, YouTube visibility,
duration, team eligibility, real payouts or Devpost submission status.
The ZIP represents exactly HEAD; tracked edits must be committed before packaging.
Untracked local files are not included. The pack's source commit and SHA-256
identify the exact handoff; preserve that commit for the submission.

## Remaining game limitation

Blade Brawl's streamer-versus-chat mode favors the streamer in the last diagnostic
sample. The known balance FAIL remains disclosed; this setup does not change HP,
rage or take selection. Use FFA/Faction for a competitive showcase, and do not
claim the streamer mode is balanced. No new games or mechanics are planned.

## OBS setup when you are ready

Use one Browser Source at **1920×1080**:
`http://localhost:4181/show?manual=1`. Keep it active across scenes so a reload does
not restart the show. Use **Control audio via OBS**, then confirm the source is
audible in the mixer; verify music/effects before recording. Control the Cup from
`http://localhost:4181/dashboard`. Keep the dashboard/login window out of capture.
The separate offline demo on **4182** contains mock viewers and mock wagers.
Check the real Twitch player, chat and Prediction widget alongside the show during
the rehearsal. This checklist does not create an OBS scene or start a broadcast.
