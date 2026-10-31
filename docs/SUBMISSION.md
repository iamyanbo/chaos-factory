# Chaos Factory submission

Project name: **Chaos Factory**

Tagline: **One join. Eight games. A whole stream competing.**

Chaos Factory turns Twitch chat into an automatic physics game show. Viewers type
`!join` to enter as named objects or support a team. The host queues games, waits
for viewers, and starts each round with a countdown. Chat versus streamer,
individual races and standalone team battles each have their own winner.
There are no Cup points, qualification, account levels or Predictions.

The eight games are Hot Potato, Blade Brawl, Multiplier Cascade, Peg Fever,
Marble Race, Pong Wars, Light Cycles and Ring Run+. Watch a bomb pass just before
it explodes, a marble stream multiply through a machine, or race leaders break
a gate open for the chasing pack. Native objective scores, such as Peg Fever's
multiplied landings and Pong's territory, decide only that game.

The stack is strict TypeScript, PixiJS, deterministic Rapier physics, Fastify,
WebSockets and Twurple. Isolated game plugins share presentation, audio and round
services through GameContext. Physics runs at fixed 60 Hz. The same seed and locked
entrants reproduce a round. Best-take selection uses aggregate activity and pacing,
without looking at player identity or which side wins.

Live Twitch integration reads joins with server-only authorization. No account
privileges beyond chat reading are requested. Disconnects never freeze an active
round. Mock mode provides delayed simulated viewers and an identical show flow,
without a Twitch account or real audience. A real EventSub !join from iamyanbo
was captured on October 29 while the channel was offline; no public broadcast
or large real crowd is claimed.

Codex implemented the entire project: engine, games, art, audio, connector,
dashboard, tests and recording/editing tools. I directed the design, played and
reviewed builds, and gave feedback. Repeated review removed rejected prototypes,
replaced neon with the Toy theme, improved physical multipliers and race tracking,
and ultimately simplified the show to joining and independent rounds.
CODEX_LOG.md records decisions and verification.

## Judge setup

Install Node.js 22 or newer, then run `npm ci` and `npm run demo`.
Open http://127.0.0.1:4182/play for individual games or
http://127.0.0.1:4182/show for an automatic sequence. The dashboard is at
http://127.0.0.1:4182/dashboard. The demo always uses mock mode and bundled assets.

## Video status

The local v15 edit predates the October 31 removal of Cups, standings and the
Grand Final. It needs a recut before upload so it describes this version accurately.
Preserve the approved animated intro, centered captions, context-aware Twitch
stickers and continuous CC0 music; show current queue controls and independent
round results. Label simulated audiences separately from the actual Twitch join.
Do not claim a public broadcast, channel-point wagering or progression.

Repository: https://github.com/iamyanbo/chaos-factory
The solo member and actual main Codex session ID are saved in submission-fields.json.
YouTube upload and Devpost submission remain owner account steps.
