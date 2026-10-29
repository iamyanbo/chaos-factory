# 03 — Twitch integration

These facts were checked against the official Twitch API, OAuth and EventSub documentation on 2026-10-26, with public Device Code Flow verified on 2026-10-27. The live connector uses Twurple 8.2.0. Mock remains the default; the authenticated channel test is deferred to the user as requested. Start the guided connection with `npm run twitch`; the operator checklist is [LIVE-TEST.md](LIVE-TEST.md).

## Verified facts

**Predictions (Helix)**
- `POST https://api.twitch.tv/helix/predictions`. Scope `channel:manage:predictions`, user access token of the **broadcaster** (`broadcaster_id` must match the token's user).
- `title` ≤ **45** chars. `outcomes` **2–10**, each `title` ≤ **25** chars (titles go through AutoMod, so keep them plain).
- `prediction_window` **30–1800** seconds. The prediction is ACTIVE immediately on create.
- **Only one prediction at a time per broadcaster.** Creating while one is running gives a 400.
- `PATCH https://api.twitch.tv/helix/predictions` with `status`:
  - `LOCKED` (only from ACTIVE)
  - `RESOLVED` + `winning_outcome_id` (from ACTIVE or LOCKED); Twitch distributes points
  - `CANCELED` (from ACTIVE or LOCKED); refunds everyone
  - You have 24 h after the window closes to resolve, otherwise Twitch cancels and refunds.
- Outcome colors in Twitch's UI: with 2 outcomes the first is BLUE and the second PINK. With **more than 2, all are BLUE**, so the overlay must make the team ↔ outcome mapping obvious (team names in outcome titles, the overlay shows the same names in team colors).
- Response outcomes include `users`, `channel_points`, `top_predictors[]` (`user_id`, `user_login`, `channel_points_used`, `channel_points_won`). The docs describe top predictors as "the users who used the most Channel Points on this outcome" and don't give a count. **We only see the top predictors, not every bettor.**
- Channel points (and therefore predictions) exist only for **Affiliate/Partner** channels. Detect eligibility on login with `GET /helix/users` → `broadcaster_type` (`affiliate` | `partner` | `""`). If empty, run in no-wager mode and show it on the dashboard.

**EventSub over WebSocket**
- Connect to `wss://eventsub.wss.twitch.tv/ws` (optional `?keepalive_timeout_seconds=10..600`). You must subscribe within **10 s** of `session_welcome` or the socket closes.
- WebSockets use **user access tokens**. Limits per (client id, user): 3 connections, 300 enabled subscriptions per connection, `max_total_cost` 10.
- Handle `session_reconnect` (connect to the given URL; subscriptions carry over) and keepalive timeouts (reconnect plus resubscribe). Twurple's `EventSubWsListener` does this, so prefer it.
- `channel.chat.message` v1: condition `{ broadcaster_user_id, user_id }` where `user_id` is the reading user (we use the broadcaster's own token, so both are the broadcaster). Scope: `user:read:chat`.
- `channel.prediction.begin` / `.progress` / `.lock` / `.end` v1: condition `{ broadcaster_user_id }`. Scope: `channel:read:predictions` **or** `channel:manage:predictions`. Outcomes include `top_predictors`. `begin` includes `locks_at`.

**Chat input**
- Only joining affects the show. No outbound chat messages, emote input, voting or reflex controls are enabled.

## Scopes to request

`channel:manage:predictions channel:read:predictions user:read:chat`

Both prediction scopes are retained for the SDK's read/recovery operations and write operations. Chat-writing permission is not requested.

## Auth flow (local app)

1. `npm run twitch` builds the app and opens `http://localhost:4181/dashboard`, alongside any mock development server. It uses `.data/live/` so mock prediction ownership, fake profiles and live payouts remain separate.
2. The operator registers a **Public** app in the Twitch developer console (Game Integration). If the console requires a redirect, enter `https://localhost:4181/auth/callback` to satisfy its HTTPS validation. This registration value is unused: Device Code Flow sends no redirect URI and needs no HTTPS callback server. The local dashboard stays on HTTP. Paste only the public Client ID into the connection card and click **Connect Twitch**. The server requests a device grant, opens Twitch's verification page and polls at the supplied interval (at least five seconds). The operator signs in as the broadcaster and approves access.
3. Twurple `RefreshingAuthProvider` refreshes tokens and persists them atomically on refresh. Tokens are validated at startup and hourly. Revocation stops the listener and disables wagers; temporary network failures retry in the background.
4. After login: fetch the user (id, login, display name, `broadcaster_type`) and start the EventSub listener. Subscribe to `channel.chat.message` + the four prediction events when eligible. `twitch.status` reports authorization, EventSub readiness, broadcaster type, prediction eligibility and the last real join timestamp. The saved Client ID and tokens reconnect automatically next launch.

Secrets stay in `.env` / `.data/` (gitignored). Never send tokens to the browser.

Device grants are bound to a random HttpOnly SameSite cookie. Only the public verification URL, user code and state leave the server; device codes, access tokens and refresh tokens stay private. The routes require a loopback client, trusted Host and same-origin POST. Cancellation, expiry and shutdown stop polling; `slow_down` backs off. The secretless public refresh path is covered using the actual SDK.

Existing Confidential apps still work through `.env` and `npm run dev:live` on 4174. `/auth/login` uses an expiring, single-use state bound to an HttpOnly SameSite cookie, then exchanges the callback code on the server. Canonical callback hosting avoids localhost/127.0.0.1 cookie mismatches. Authorization routes silence request logging; no token appears in a redirect.

## Prediction lifecycle (owned by `apps/server/src/predictions.ts`)

Both mock and live bridges support create, lock, resolve and cancel. Team spectator events use fixed teams as outcomes regardless of audience membership; prediction sizes never affect physics. Grand Final predictions use the locked finalists. Larger individual fields run without wagers. Only app-created prediction IDs with persisted ownership may be changed. Paths below are relative to the bridge's data directory (`.data/live/` for the guided launcher).

```
show: prediction.create(title, outcomes, windowSec = lobbySeconds ≥ 30)
  └─ server: POST /predictions → store {id, outcomeIds[], createdBy: 'chaos', roundId} in session.json
     ├─ 400 "already running" → GET /predictions?first=1; if ours → cancel & retry once; if not ours → prediction.error ALREADY_ACTIVE (round runs no-wager)
     └─ other error → prediction.error → show banner "NO WAGERS THIS ROUND", round continues
show: end of lobby → prediction.lock (ignore "not ACTIVE" errors: Twitch auto-locks at window end)
show: round done → prediction.resolve(outcomeIndex) | prediction.cancel(reason) on void
  └─ retries: 3× with backoff 1s/3s/9s; then every 30s, retaining the job in session.json for restart (24 h grace)
startup recovery: an owned ACTIVE/LOCKED prediction without a result → CANCEL (refund)
                  a persisted winning result → resume RESOLVE, never replace it with a refund
```

`session.json` stores prediction ownership, outcome IDs, round ID and any pending operation; Cup summaries live in `cup-session.json`. Round IDs accompany create/lock/resolve/cancel messages so a later round cannot overwrite an older pending payout. Live create/lock/resolve require that identity; a cached older Show must be refreshed. Global shutdown/disconnect cancellation can omit it, but still cannot replace a known payout. A failed create never gives ownership of a manually created prediction. Terminal state checks make retries idempotent. Unknown or malformed saved ownership is left untouched.

EventSub `progress` events are throttled to the overlay at most 4×/s and drive the live pool bar: total points per outcome, users per outcome, top predictor names.

**Mapping outcomes:** CvS: `['CHAT WINS', 'STREAMER WINS']` (Twitch shows CHAT blue, STREAMER pink, so the overlay uses those colors). Faction: one outcome per team in play, titled with its team name (`RED RIOT`). Fixed-machine spectator events include every machine's team; roster-based factions include teams with at least one entrant. Fewer than two valid outcomes means a no-wager round. The Grand Final maps each locked finalist's login to their user ID; native resolution uses the corresponding stored outcome ID.

**Traitor callouts:** after lock, compare each outcome's `top_predictors` against faction membership. A top predictor who bet on a team other than their own gets a "🗡️ TRAITOR: @x bet 12,000 on BLUE" ticker line. Only call out top predictors; never imply full knowledge.

## Chat pipeline (`apps/server/src/chat/`)

1. Normalize and parse joins only (`!join`, with the existing optional team argument; bare `join` is also accepted).
2. Ignore ordinary chat and all other commands before rate limiting. They cannot consume a viewer's join cooldown.
3. De-duplicate EventSub message IDs, apply the per-user 400ms join limit and assign the stable viewer profile color.
4. Forward the join to the Show; its existing phase/capacity rules decide admission. Chat never controls physics. No emote rain, chat hype meter or votes are wired to the server.

## Mock bridge (`TWITCH_MODE=mock`)

Same interface as the real bridge.
- **Bot swarm:** `MOCK_VIEWERS` simulated chatters with generated names and stable colors. Bots join automatically; the retained personality controls affect mock audience behavior, never game inputs or physics.
- **Stream delay simulation:** joins are delayed by a random `MOCK_DELAY_MS` (default 2.5–4.5 s). Bots do not vote, emit emotes or send game verbs.
- **Fake predictions:** honors the same limits (title/outcome lengths, window range, one at a time; throws the same error codes). Bots bet with point balances from a log-normal distribution. Emits progress/lock/end. Resolution computes payouts like Twitch (winners split the total pool pro-rata) and prints a summary.
- The dashboard has a manual chat box to type as any fake user.

## Optional integration check with the Twitch CLI

The official Twitch CLI can stand in for Twitch locally:
- `twitch event websocket start-server` runs a local EventSub WebSocket server.
- `twitch event trigger channel.prediction.begin --transport=websocket` (also `prediction-progress`, `-lock`, `-end`) fires sample events.
- `twitch mock-api start` serves mock Helix endpoints, including predictions.

The automated suite uses the actual Twurple OAuth/Helix clients with intercepted HTTP and an ephemeral local EventSub WebSocket server. It verifies `!join`, all four prediction events, reconnect/revocation, OAuth state and secret isolation, refresh persistence, ownership, backoff and restart recovery. Run `npm test -- twitch-`. These fixtures do not authenticate to Twitch or award native channel points.

## Going live checklist

- [ ] `npm run twitch`, Public app registered, Client ID saved, Twitch authorization approved
- [ ] Dashboard shows `broadcaster_type: affiliate|partner`, `canPredict: true`
- [ ] Type `join` in real chat → marble appears with your name within 1 s of chat arrival
- [ ] Prediction appears in Twitch chat UI with the correct title/outcomes; pool bar moves as test accounts bet
- [ ] Round end → prediction RESOLVED → points paid (check a test account)
- [ ] Kill the server mid-round → restart → prediction gets CANCELED (refund) automatically
- [ ] Void round (force via dashboard) → CANCELED

Official references: [app registration](https://dev.twitch.tv/docs/authentication/register-app/), [Device Code Flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow), [refreshing public-client tokens](https://dev.twitch.tv/docs/authentication/refresh-tokens/), [Predictions API](https://dev.twitch.tv/docs/api/reference/#create-prediction), [OAuth code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow), [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/).
