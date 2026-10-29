# Connect Chaos Factory to Twitch

The app is ready without access tokens. Complete the one-time connection below
when you want to authorize your channel. This is a local desktop app; tokens
stay on the server and are never pasted into the dashboard.

## Start it

```sh
npm run twitch
```

This builds and opens [the live dashboard](http://localhost:4181/dashboard).
It runs alongside `npm run dev`; offline development remains mock mode.
Running the command again opens the existing live app rather than starting a
second broadcaster connection.

Games, the lineup and round controls stay on the main dashboard. Predictions,
rotation and player limits are under **Settings**; the browser-source address
and volume are under **OBS & audio**. Expand **Twitch connection** to inspect
chat readiness and the last join. It opens automatically when login is needed.

## Your one-time connection

1. Expand **Register the app** in the connection card. Open
   [Twitch app registration](https://dev.twitch.tv/console/apps/create), choose
   a unique name, **Game Integration** and **Public** client type. If a redirect
   is required, enter `https://localhost:4181/auth/callback`. This is an unused
   registration value for Device Code Flow; keep the local dashboard on HTTP,
   and do not set up an HTTPS listener or certificate. Twitch may ask you to
   sign in or complete its account verification before registering an app.
2. Paste the app's **Client ID** into the card and press **Connect Twitch**.
   This is a public app identifier. Do not generate or paste an access token or
   client secret.
3. Approve Twitch's authorization screen as the **broadcaster**. The dashboard
   updates automatically and the small authorization window closes. If popups
   are blocked, use **Authorize on Twitch** in the card instead.

Twitch requires an app registration; the project cannot supply one for your
account. After this connection, saved authorization reconnects on later launches.
If Twitch revokes or expires the grant, the same Connect button reappears.

The card should show:

| Field | Expected |
|---|---|
| Account authorization | Authorized as your channel |
| Channel type | Affiliate, Partner, or Standard |
| Chat connection | Connected |
| Last !join | Updates when a real join arrives |

The only permissions requested are chat reading and Prediction reading/managing.
Standard channels can use chat joins; native Predictions require Affiliate or
Partner eligibility. The app sends no chat messages.

## Run the real-channel rehearsal when ready

1. Open the [live Show](http://localhost:4181/show?manual=1), or add that URL as
   an OBS browser source at 1920×1080. Use the dashboard on **4181** to control it.
2. Start a Cup. Live Twitch defaults to **Host starts each round**: the show
   displays **Type !join**, a player count and **Waiting for host to start**.
   Type `!join` from another Twitch account and confirm **Last !join** updates
   and the player count increases. Click **Start round** when ready. A channel
   with Predictions gets the full betting window first, followed by **3, 2, 1**;
   a chat-only round goes straight to the countdown. Every later game waits
   for the host again. Choose **Automatic countdown** to run rounds on a timer.
3. In a Boss or Faction round, confirm a native Prediction opens with matching
   outcome names. Place a small test bet from eligible viewer accounts. Large
   individual fields intentionally run without wagers; the eight-person Grand
   Final can use its locked finalists.
4. Confirm betting locks before play, the game continues and the correct native
   outcome resolves after the result. Check the viewer's point balance in Twitch.
5. Start another wagered round and use **Void + refund**. Confirm Twitch cancels
   the Prediction. On a separate rehearsal, restart the app mid-round: an owned
   open wager is refunded, while a recorded winning payout resumes instead.

The app stores the public ID, authorization, profiles and owned prediction jobs
inside gitignored `.data/live/`. Keep this directory on the host computer.
Mock data and manually created Twitch Predictions are left alone.

The automated suite tests the actual Twurple clients against local OAuth,
Helix and EventSub fixtures, including public-client refresh and restart recovery.
It also tests the setup UI.

Verified October 29, 2026: iamyanbo's saved public-client authorization reconnected
to real Twitch EventSub. An actual `!join` admitted the named account into Peg
Fever, and host start/countdown led to PLAY with one real participant. No mock chat
or Prediction was used. The account is a standard channel, so the no-wager flow
was verified and native Prediction payout is not applicable on this account.
The local capture contains game audio and records the API-connected show while
the Twitch channel is offline. A public broadcast and eligible-channel native
point payout have not been performed or claimed.

Existing Confidential apps may still use `.env`, `npm run dev:live` and
`http://localhost:4174/auth/callback`; that older development path is unchanged.

Sources: [app registration](https://dev.twitch.tv/docs/authentication/register-app/),
[Device Code Flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow),
[Predictions](https://dev.twitch.tv/docs/api/predictions/).
