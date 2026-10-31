# Live Twitch join rehearsal

Run `npm run twitch`, open http://localhost:4181/dashboard, and connect your Public
Twitch app using its Client ID. Approve the broadcaster login. Only chat-read
permission is requested; no token pasting or Affiliate/Partner status is needed.
Device Code Flow uses no HTTPS callback server. If registration requires a redirect,
enter `https://localhost:4181/auth/callback` and keep the dashboard on HTTP.

1. Open http://localhost:4181/show?manual=1 (one controlling show per server).
2. Queue a game and click **Start show**. Live mode waits for the host by default.
3. Send `!join` in your channel chat. Confirm Last !join updates and your name is admitted.
4. Click **Start round**. Confirm loading, the 3, 2, 1 countdown and automatic gameplay.
5. After the winner, confirm the next game accepts joins and waits again. Scores do
   not carry between rounds. Team games show that round's winning team.
6. Try Pause/Resume, Cancel round, Skip round and Stop show from the dashboard.

OBS source: 1920x1080, http://localhost:4181/show?manual=1. Enable Control audio via
OBS and check the mixer. This guide does not start a public broadcast.

A real EventSub !join from iamyanbo entered Peg Fever on October 29; the host
started the game while the channel was offline. That recorded arrival remains
real chat evidence. The October 31 design removes Predictions completely; no
payout rehearsal remains to do. The connector's chat-only scopes, SDK subscriptions,
reconnection and authorization are covered with local fixtures.

All eight existing games are available in the host queue. The original five are
the default automatic rotation; the other three can be queued or enabled in Settings.
Use `npm run demo` on 4182 to test with simulated viewers without a Twitch account.
