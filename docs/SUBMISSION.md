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

Codex helped implement the engine, games, connector, dashboard, Cup structure,
replay checks, tests and frame-capture workflow. The project was shaped through
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

## Current edit - about 1 minute 46 seconds

The first 2:47 cut was rejected as a long catalog. The latest cut adds animated
Toy titles and short impact captions to an action
hook, compact real join proof, a few contrasting physical moments, then one Cup
payoff. Gameplay stays at its captured speed; only the cold open uses editorial
close-ups. One continuous music bed accompanies effects-only Cup footage; the older
live clip is muted to avoid stacking its original background music. There is no
recorded voiceover.

| Time | Picture | Purpose |
|---|---|---|
| 0:00-0:06 | Multiplier landing, fuse burst, moving machine | Lead with visible action |
| 0:06-0:09 | Brief project title | Name the show |
| 0:09-0:21 | Actual join count change, countdown and named player | Demonstrate the Twitch connection without the loading wait |
| 0:21-0:39 | Cascade machinery and the real first-to-five payoff | Show one complete cause-and-payoff sequence |
| 0:39-1:02 | Brief bomb, landing and broken-gate moments | Contrast the physical stakes without teaching every game |
| 1:02-1:30 | Standings, field shrinking, final duel, actual champion | Explain why the Cup matters |
| 1:30-1:42 | Two short actual-source cards | Explain user direction, Codex implementation and feedback |
| 1:42-1:46 | Source link and offline invitation | End on the usable project |

Latest local MP4: qa/submission-video/chaos-factory-demo-v3.mp4. The earlier cuts
remain as chaos-factory-demo-v1.mp4 and chaos-factory-demo-v2.mp4 for comparison.
Upload copy and contact sheets are beside the videos; generated media is excluded
from Git.

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
