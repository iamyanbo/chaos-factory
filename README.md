# Chaos Factory

A Twitch physics game show. Viewers type `!join` to enter a round or support a
team. Play chat versus the streamer, individual races, or one-off team battles.
Each round has its own winner. There are no Cup points, progression or Predictions.

## Try it in two minutes

Install **Node.js 22 or newer**, then run:

```sh
npm ci
npm run demo
```

- [Play offline](http://127.0.0.1:4182/play)
- [Automatic show](http://127.0.0.1:4182/show)
- [Host dashboard](http://127.0.0.1:4182/dashboard)

The demo always uses mock Twitch, 24 simulated viewers and delayed joins. No
account, credentials, external fonts or browser extensions are needed. Stop with
Ctrl+C. Windows users can also double-click `START.cmd`.

## Games

| Game | Offline link | Automatic rotation |
|---|---|---|
| Blade Brawl | [Play](http://127.0.0.1:4182/play?game=blade-brawl) | Default |
| Hot Potato | [Play](http://127.0.0.1:4182/play?game=hot-potato) | Default |
| Multiplier Cascade | [Play](http://127.0.0.1:4182/play?game=multiplier-cascade) | Default |
| Peg Fever | [Play](http://127.0.0.1:4182/play?game=peg-fever) | Default |
| Marble Race | [Play](http://127.0.0.1:4182/play?game=marble-race) | Default |
| Light Cycles | [Play](http://127.0.0.1:4182/play?game=light-cycles) | Optional |
| Pong Wars | [Play](http://127.0.0.1:4182/play?game=pong-wars) | Optional |
| Ring Run+ | [Play](http://127.0.0.1:4182/play?game=ring-escape) | Optional |

Games play automatically; chat never needs reflex timing. Queue any of the eight
games in the dashboard, or use the default five-game rotation. An empty queue
continues with enabled games. Every round admits its full field, including rounds
five and later. Blade Brawl and Hot Potato default to chat versus streamer in the
show; games without that format keep their own individual or team rules.

Individual games give viewers their own entrants. Team machines such as Pong Wars
rotate supporters' names through faction balls. Team rounds finish with their own
result; wins do not award account points or carry into another game. A game's own
objective score, such as Peg Fever's multiplied landings, still decides its winner.

The dashboard supports a draggable queue, player limits, manual starts and audio
controls. Rounds load visibly and count down before play. Offline results offer
**Play again** and **Change game**.

The musical-note button toggles bundled CC0 music separately from effects.
Toy balls default to matte vinyl; add `&ball=b` for jelly or `&ball=c` for faces.
Normal rounds choose fresh hidden seeds. Debug URLs accept `seed` and `take=seed`
for exact reproduction.

## Connect your Twitch channel

```sh
npm run twitch
```

Open http://localhost:4181/dashboard. The connection card guides you through
registering a **Public** Twitch app and authorizing as the broadcaster using its
Client ID. No pasted access tokens or client secret are needed. Saved grants
reconnect automatically; credentials remain in gitignored server storage.

OBS Browser Source: **1920 x 1080**, `http://localhost:4181/show?manual=1`.
Control that show from the dashboard on **4181**. Viewers type `!join`; the host
starts each round when ready. Twitch authorization requests only `user:read:chat`.
Chat disconnections do not freeze the current round. Only one controlling `/show`
connection is allowed per server; `/play` is independent.

Follow [LIVE-TEST.md](docs/LIVE-TEST.md) for connection details and the real-channel
rehearsal. The offline demo on **4182** uses simulated joins.

## Develop and verify

```sh
npm run dev          # mock bridge + Vite on http://127.0.0.1:5173
npm run typecheck
npm test
npm run build
npm run test:e2e
```

TypeScript is strict. PixiJS v8 renders the Toy theme; deterministic Rapier runs at
60 Hz. Fastify, WebSockets and Twurple connect the show and Twitch. Games are
isolated plugins under `apps/show/src/games/`; the shared engine/context, kits and
show layer supply physics, presentation, round transitions and results.

Browser QA defaults to installed Chrome on Windows; set `CHROME_PATH` elsewhere.
For stills, run `npm run frames -- --game peg-fever`. Optional frame sheets need
Python with Pillow. Test outputs, captures, builds and local data are excluded from Git;
selected review notes remain in `qa/`. `npm run audit:ship` runs raw-seed completion
and body-budget checks. Replays can be checked with `npm run replay -- --file <file>`.
The best-take selector scores aggregate activity and pacing, never player identity
or which side wins.

## Submission and limitations

- [Submission description](docs/SUBMISSION.md), [remaining steps](docs/SHIP-CHECKLIST.md)
- [Known issues](qa/known-issues.md), [verification summary](qa/release-check.md)
- [Asset credits and licenses](ASSETS.md), [how Codex was used](CODEX_LOG.md)
- [Toy theme](docs/24-toy-theme.md), [frozen lineup](docs/23-ship.md)

Streamer-versus-chat Blade Brawl favors the streamer in the last diagnostic sample;
no balanced 50/50 claim is made. Real Twitch chat admission was rehearsed on the
standard channel iamyanbo. Affiliate or Partner eligibility is not needed for joins.

`npm run submission` creates a source ZIP, commit/hash manifest, copy, credits and
eight existing game images in `qa/submission/`. Commit reviewed changes first.
`npm run submission:check` flags missing links, the actual main Codex session ID,
team details and owner-confirmed access/rehearsal checks in
`docs/submission-fields.json`. It does not publish or submit the Devpost entry.

## Recording

Recording uses headless Chrome and FFmpeg, without desktop capture. With the mock
demo running, `npx tsx tools/capture-rounds.ts --sfx-only` captures five independent
queued rounds. `tools/capture-live-join.ts` captures an actual arriving chat join;
it does not send chat or start a broadcast.

The current local edit is `qa/submission-video/chaos-factory-demo-v17.mp4`
(2:57.0, 1080p H.264/AAC). All eight games appear as independent rounds, with a
separate chat-versus-streamer section. It includes the current dashboard tutorial,
a populated simulated lobby, and the separately labeled historical real Twitch join.
The opening credits Codex / GPT-6.1 Sol; a short original doc 24 request excerpt
leads into four actual source files scrolling together, then the dashboard tutorial.
The approved intro, centered captions, scattered event emotes and continuous CC0
music remain. Account uploads and final Devpost submission have not been performed.
