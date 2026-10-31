# Chaos Factory

A Twitch physics game show. Viewers type `!join`, become named marbles, and watch
five-round Cups with standings, a top-eight final and a returning champion's crown.
Native Twitch Predictions add channel-point stakes on eligible channels.

## Try it in two minutes

Install **Node.js 22 or newer**, then run:

```sh
npm ci
npm run demo
```

- [Play offline](http://127.0.0.1:4182/play)
- [Automatic five-round Cup](http://127.0.0.1:4182/show)
- [Host dashboard](http://127.0.0.1:4182/dashboard)

The demo always uses mock Twitch, 24 simulated viewers and delayed joins. No
account, credentials, external fonts or browser extensions are needed. Stop with
Ctrl+C. Windows users can also double-click `START.cmd`.

## Games

| Game | Offline link | In Cups |
|---|---|---|
| Blade Brawl | [Play](http://127.0.0.1:4182/play?game=blade-brawl) | Yes; also the Grand Final |
| Hot Potato | [Play](http://127.0.0.1:4182/play?game=hot-potato) | Yes |
| Multiplier Cascade | [Play](http://127.0.0.1:4182/play?game=multiplier-cascade) | Yes |
| Peg Fever | [Play](http://127.0.0.1:4182/play?game=peg-fever) | Yes |
| Marble Race | [Play](http://127.0.0.1:4182/play?game=marble-race) | Yes |
| Light Cycles | [Play](http://127.0.0.1:4182/play?game=light-cycles) | No |
| Pong Wars | [Play](http://127.0.0.1:4182/play?game=pong-wars) | No |
| Ring Run+ | [Play](http://127.0.0.1:4182/play?game=ring-escape) | No |

Games play automatically; chat never needs reflex timing. Four Cup rounds award
points, then the top eight enter a Blade Brawl final. The final survivor wins.
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
starts each round when ready. Predictions require an Affiliate or Partner channel.
API failures keep the show running without wagers. Only one controlling `/show`
connection is allowed per server; `/play` is independent.

Follow [LIVE-TEST.md](docs/LIVE-TEST.md) for connection details and the real-channel
rehearsal. The offline demo on **4182** never places real wagers.

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
show layer supply physics, presentation, scoring and Cup services.

Browser QA defaults to installed Chrome on Windows; set `CHROME_PATH` elsewhere.
For stills, run `npm run frames -- --game peg-fever`. Optional frame sheets need
Python with Pillow. Tests, captures, builds and local data are excluded from Git;
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
no balanced 50/50 claim is made. Real Twitch chat admission and the no-wager flow
were rehearsed on the standard channel iamyanbo. Native point payout requires an
eligible channel and remains untested; mock wagers do not establish payout success.

`npm run submission` creates a source ZIP, commit/hash manifest, copy, credits and
five existing game images in `qa/submission/`. Commit reviewed changes first.
`npm run submission:check` flags missing links, the actual main Codex session ID,
team details and owner-confirmed access/rehearsal checks in
`docs/submission-fields.json`. It does not publish or submit the Devpost entry.

## Demo recording without desktop capture

Optional recording needs Chrome and FFmpeg on PATH. With the mock demo running:

```sh
npx tsx tools/capture-cup.ts --sfx-only --out qa/submission-video/full-cup-sfx
npx tsx tools/capture-join-crowd.ts
# With npm run twitch running separately, capture an actual chat !join:
npx tsx tools/capture-live-join.ts
# Fetch the official Twitch stickers locally using the saved server authorization:
npx tsx tools/fetch-video-emotes.ts
# Capture the connected host workflow without desktop automation:
npx tsx tools/capture-host-setup.ts
npm run video
```

The recorder captures the game canvas and sound effects with in-game music disabled.
The edit adds one continuous music bed, original transition whooshes and
source-timed comic accents, held close-up cuts and centered text-only captions and independently scattered Twitch event reactions. The
dashboard capture uses timed curved pointer movement and animated queue instructions.
MINIGAMES and GRAND FINAL title cards introduce the game sections. Major cuts use the measured music grid; gameplay
continues at its captured speed. The older mixed-audio live inset is muted.
A guard rejects Cup footage with music enabled. The edit uses
normal-speed clips, labels simulated viewers and real Twitch chat separately,
and overlays each game's actual name and short rules during gameplay. The opening
title says "Implemented with Codex". The connected dashboard shows queue ordering
and Start Cup. A separate full-screen BUILT WITH CODEX section shows selected real
conversation excerpts and the full committed before/after code; it is an edited
presentation rather than a native Codex UI recording. Chapter titles hold still before moving into their corner. The animated lobby feed uses actual recorded mock arrivals; a
separate inset labels the real Twitch test. It does not start a public broadcast. The MP4, contact sheet and paste-ready YouTube/Devpost text remain
local under `qa/submission-video/`; they are excluded from Git. Account uploads
and final Devpost submission are not automated.
