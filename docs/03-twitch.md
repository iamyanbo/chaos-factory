# Twitch connection: joins only

The October 31 user instruction supersedes the former wagering design. The live
bridge reads `!join` through Twurple and EventSub. It does not request, subscribe
to, create, lock, resolve or cancel Predictions. There are no point balances,
Cup scores, progression writes or outbound chat messages.

## Setup

Run `npm run twitch`, then open http://localhost:4181/dashboard. Register a Public
Twitch app, enter its public Client ID and approve the broadcaster login. Device
Code Flow needs no client secret or working HTTPS callback. If app registration
requires a redirect, `https://localhost:4181/auth/callback` is an unused registration
value; use the local HTTP dashboard.

Only `user:read:chat` is requested. Every channel type can receive joins. Saved
authorization stays in gitignored `.data/live/` and refreshes on the server. An
existing grant with extra scopes still works, but the app no longer uses them.
No credentials are sent to the browser or written to logs.

## Running rounds

1. Open one http://localhost:4181/show?manual=1 page, or use it as a 1920x1080 OBS source.
2. Queue games in the dashboard and click **Start show**.
3. Viewers type `!join`; the player count and Last !join status update.
4. Click **Start round** when ready. Loading completes before the visible 3, 2, 1 countdown.
5. The natural result is displayed, then the next game waits for the host again.
   Automatic countdown is optional: a ten-second join window precedes the countdown.
   An empty player-dependent lobby stays open until somebody joins.

There is no tournament qualification. Each game admits its own full field, subject
to the chosen player limit and first-come queue. Team machines can play without
joiners, with joined viewers shown as supporters. Blade Brawl and Hot Potato use
chat versus streamer by default in the show. Other games keep their existing rules.

## Input and recovery

Only joins are parsed (`!join`, with the retained optional team argument; bare
`join` is accepted). Other messages do not consume the 400 ms join cooldown.
EventSub message IDs are deduplicated. Viewer colors are derived from user ID,
without storing XP, titles or a crown. Late joins wait for the next round.

Twurple handles EventSub reconnects; revocation makes the login button reappear.
A disconnected chat connection never pauses a running simulation. Restarting a
show begins a fresh session. Old local profile and wagering files are left unused;
no destructive migration of host data is performed.

Mock is the default. `npm run demo` uses 24 simulated viewers and delayed joins on
4182, independent of live authorization. The offline chat box also accepts !join.
Tests exercise the actual Twurple clients against local OAuth/HTTP/EventSub fixtures,
including reconnect, revocation, refresh persistence and secret isolation.
