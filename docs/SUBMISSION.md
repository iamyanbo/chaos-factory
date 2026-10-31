# Submission copy and recording plan

Deadline: November 2, 2026, 5pm Eastern. Internal target: November 1.
Remaining setup: [SHIP-CHECKLIST.md](SHIP-CHECKLIST.md).

Project name: **Chaos Factory**

Tagline: **One join. Five games. A whole stream competing.**

## Project description

Chaos Factory turns a Twitch stream into an automatic physics game show.
Viewers type `!join` to enter as named objects. They can follow their own ball,
support a faction, and compete across a five-round Cup without trying to time
inputs through stream delay.

The five-game Cup pool is Hot Potato, Blade Brawl, Multiplier Cascade, Peg Fever
and Marble Race. Watch a bomb change hands just before its fuse runs out, a
marble stream multiply through a machine, or a front runner break a gate open
for the chasing pack. Four rounds earn Cup points; the top eight enter a
Blade Brawl final, where the last survivor wins the Cup. Persistent viewer
profiles carry colors, titles, levels and the champion's crown between shows.

The app uses strict TypeScript, PixiJS, deterministic Rapier physics, Fastify,
WebSockets and Twurple. Games are isolated plugins sharing presentation, audio
and show services through GameContext. The same seed and locked entrants can
reproduce a round. Candidate takes are selected using aggregate activity and
pacing; player identities and winners do not enter the take score.

Twitch integration supports chat joins and native Predictions. Credentials stay
on the server. Native wagering requires an eligible broadcaster, and API
failures fall back to a round without wagers. An offline demo includes delayed
simulated viewers and works without a Twitch account.

The real chat and no-wager flow were rehearsed on the standard channel iamyanbo:
an actual Twitch `!join` admitted the named viewer and the host started Peg Fever.
The submission video labels this real API-connected chat separately from the
simulated Cup audience. No public broadcast or native point payout is claimed.
Prediction payout remains untested because this channel is not Affiliate/Partner.

Codex implemented the entire project: engine, games, visuals, connector, dashboard,
Cup structure, replay checks, tests and recording/editing tools. I directed the
design, played and reviewed builds, and gave feedback. The project was shaped through
repeated user feedback: several technically functioning games were rejected,
the lineup was reduced, the Toy theme replaced the original neon presentation,
and real screenshots were reviewed against references. Recent changes include
immediate physical multiplier splits in Cascade, leader tracking in Marble Race,
rounded Light Cycles trails, per-ball scoring in Peg Fever, and shared result
screens that distinguish actual game scores from Cup points.
CODEX_LOG.md records the implementation decisions and verification.

## Judge setup

Requires Node.js 22 or newer and npm. From the repository root:

```sh
npm ci
npm run demo
```

Open http://127.0.0.1:4182/play for individual games, or
http://127.0.0.1:4182/show for the automatic Cup. The demo explicitly uses mock
mode even if the host has a live `.env`. It does not need browser extensions,
external fonts, accounts or Twitch access. Stop the process with Ctrl+C.

## Current edit - under three minutes

The film opens with the animated Chaos Factory intro, followed directly by an actual connected
Twitch dashboard capture shows queue ordering and Start Cup. Animated captions explain adding games, dragging the queue and starting a Cup.
Close-ups hold still, with cuts between compositions. A continuous mock lobby
fills to 48 viewers, counts down, and starts a populated Peg Fever field. An
inset separately labels the real Twitch test with iamyanbo while the channel
was offline. The main audience is simulated; no real crowd is implied.

Bold MINIGAMES and GRAND FINAL stingers separate the sections. Five game chapters lead through the Cup standings, final duel and actual
champion. Titles hold still for two seconds before a slower move into the corner.
The opening title says "Implemented with Codex"; the closing card links GitHub.
The standalone code excerpt is removed. The [official rules](https://twitchcon-codex.devpost.com/rules)
say the video should show how the project was built with Codex; they do not prescribe
a code excerpt or separate build card. This edit uses the credit and repository link,
with the workflow explained in the written submission; no Codex app footage is claimed.
Short rules remain beside each game, and the standings note stays above its table.

Cascade shows the large x3 volley and the five-finisher win. Hot Potato includes
the rim-break explosion and a later mass elimination, retaining each lead-in and
aftermath. Peg Fever shows dense peg hits, multiplied landings and the final orange
triggering Fever and doubled slots. Marble Race cuts forward from the launch pack
to the gate breach and first finishes. Blade Brawl includes two midround knockouts
and the final survivor. The title lead-ins
leave the key payoffs visible. The champion leads directly to the animated ending.

One continuous music bed, beat-aligned Toy wipes and soft stereo whooshes join
the scenes. Centered text captions mark recorded payoffs. Iconic Twitch emotes pop separately
in varied parts of the frame around events; they are editorial reactions, not
actual chat messages. Gameplay stays at its
captured speed; the old real-chat mix is muted. No voiceover is recorded.

Latest local MP4: qa/submission-video/chaos-factory-demo-v14.mp4. A protected cleanup script is provided
for obsolete exports and generated edit files; deletion was blocked by automatic review. edit.json records exact source windows and the real-test
inset. Upload copy, contact sheet and transition review are beside the videos;
generated media is excluded from Git.

Include native Prediction creation, lock and resolution only after a successful
eligible-channel rehearsal. Otherwise describe the wagering limitation honestly
and demonstrate the working chat integration. Do not imply mock payouts are real.

## Fields still supplied at submission

- Repository URL: https://github.com/iamyanbo/chaos-factory (public submission repo).
- YouTube URL for the final Twitch demonstration, under three minutes.
- Main build thread's actual Codex session ID, obtained with `/status`.
- Team membership and final Devpost Submit action.

No session ID, repository address, live-test result or video URL is fabricated
in this draft. Use qa/release-check.md and qa/known-issues.md for current limits.
