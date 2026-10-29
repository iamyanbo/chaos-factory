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

## Demo storyboard — 2 minutes 45 seconds

Record only after the final broadcast rehearsal. This document does not stand
in for the required Twitch footage. Label any offline footage as MOCK DEMO.

| Time | Picture | Voiceover / point |
|---|---|---|
| 0:00–0:12 | Strong Cascade multiplier burst, Peg ×10 landing, race gate break | “One join. Five games. A whole stream competing.” |
| 0:12–0:35 | Actual Twitch chat `!join`, lobby count, host start and countdown | Show a real viewer entering; no reflex controls needed. |
| 0:35–0:55 | Cascade's multiplication and first-to-five relay | Finite hopper supply becomes an actual shared physical race. |
| 0:55–1:15 | Hot Potato handoff/fuse and Peg Fever landing stamp | Anticipation, a visible handoff, then a concrete payoff. |
| 1:15–1:35 | Marble Race cracked gate and leader camera | Leaders open a route for the pack; all geometry is visible. |
| 1:35–1:55 | Standings, top-eight final, champion and crown | The final survivor takes the Cup; profiles persist. |
| 1:55–2:30 | AGENTS.md, game folders, CODEX_LOG.md, still comparisons, tests | Explain how feedback changed the build and how seeded replay checks it. |
| 2:30–2:45 | Dashboard queue drag, OBS source and final payoff | Show how a streamer runs it, then finish on the clearest actual moment. |

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
