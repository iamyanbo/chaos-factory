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

Codex (GPT-6.1 Sol) implemented the entire project: engine, games, art, audio, connector,
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

The final local film is 2:57.0 at 1080p, with all eight games shown as independent
rounds. The dashboard tutorial explains adding games, dragging the queue and
Start show. The simulated lobby fills with 48 actual mock joins; a separately
labeled inset retains the real Twitch rehearsal while the channel was offline.

MINIGAMES and CHAT VS STREAMER section cards introduce the gameplay. Cascade
includes multiplication and the first-to-five win; Peg Fever includes a 5,580
landing and doubled Fever slots; Marble Race progresses from launch to a real
gate break and first finishes. Pong Wars, Light Cycles and Ring Run+ each have
their own chapter. Hot Potato retains the fuse, blast and rim spill. Blade Brawl
shows rage activation and a final duel, ending on that round's winning side.

The approved animated intro, two-second game-title holds, centered event captions,
context-aware Twitch stickers and one continuous CC0 music bed are retained.
Gameplay stays at its captured speed, including the game's own live slow motion.
The opening says Built with Codex / GPT-6.1 Sol. The owner's original doc 24
request leads into four actual source files scrolling together. This brief
editorial excerpt precedes the dashboard; it does not imitate native Codex UI.
The closing card links the repository.
No public broadcast, channel-point wagering or account progression is claimed.

Repository: https://github.com/iamyanbo/chaos-factory
The solo member and actual main Codex session ID are saved in submission-fields.json.
YouTube upload and Devpost submission remain owner account steps.
