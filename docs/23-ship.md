# 23 — Ship plan (latest doc, wins all conflicts)

**Status: 2026-10-27. Deadline Nov 2, 5:00pm EST. The game list is frozen. No new games and no new mechanics.**

## Submission lineup (default rotation)

1. **Hot Potato**: the user likes it
2. **Blade Brawl**: the headline game, with Chat vs Streamer (Boss)
3. **Multiplier Cascade**
4. **Peg Fever**
5. **Marble Race**

October 31 update, requested by the user: Light Cycles, Pong Wars and Ring Run+
are now optional host queue and rotation choices, as well as offline games. The
five games above remain the default automatic rotation; explicitly queuing an
optional game includes it in the next round without changing that default.
October 31 scope override: rounds are independent. No Cup points, standings,
qualification, forced final, progression or Predictions. Counterweight Clash stays out.

## Visual overhaul: why it looks boring

The current look is thin outlines and tiny balls floating in a big black void, with 12 px text. MIKAN-style videos are **chunky, filled and colorful**. Apply these **measurable** rules to the 5 lineup games, through the shared kit wherever possible. Check every number in your `npm run frames` stills.

| Rule | Value at 1920×1080 |
|---|---|
| Ball radius | **≥ 20 px** (≥ 16 px only when more than 40 balls are on screen). Reduce the default bot count rather than shrinking balls. |
| Ball style | Solid saturated fill, **3 px dark outline**, a white highlight dot at the upper left (25% of radius), and a soft drop shadow offset 4 px down. Squash and stretch on impact: up to 20% for 80 ms. |
| Walls, rings, pegs, ramps | **Filled shapes, not lines.** Walls ≥ 14 px thick, with a solid fill, a lighter top edge and a dark outline. Pegs ≥ 10 px radius. |
| Arena | **Never a black void.** The arena floor is a filled shape: a deep navy/purple disc or panel, with a subtle grid or noise pattern and a 6–10 px colored border. The background outside the arena is a vertical gradient (e.g. #1b1640 → #0b0a1f). |
| Fill | Machines and arenas take **≥ 75% of the 1080 px height**. Empty dead space inside the arena is a bug: make the arena smaller or the balls bigger. |
| Name tags | **Bold**, ≥ 20 px, white with a 3 px dark stroke. Show names only for the top 8, the crown holder, the Boss and the last 5 alive. Hide the rest, so text never overlaps. |
| Side HUD | Title ≥ 48 px, body ≥ 24 px, on **filled rounded cards** (12 px radius, 85% opacity panel). At most 3 cards per side and at most 6 lines per card. Delete any text a viewer doesn't need: no rule paragraphs, debug labels or stage lists. |
| Callouts | ≥ 96 px, heavy font, with a colored stroke, centered on the event. |
| Color | Each game has one dominant palette: 2 arena colors plus bright ball colors. No white-on-black wireframes. |

**Done when:** all 5 games pass the table above, checked with your own stills, and `qa/frames/<id>/review.md` lists each rule as pass or fail.

## Remaining order of work (each step is one commit)

1. Apply the visual overhaul to the shared kit (ball renderer, wall style, HUD cards, name tags, background), then to each of the 5 games.
2. Keep the five-game default rotation and all eight queue choices. Each round stands alone.
3. **Live Twitch rehearsal checklist:** `npm run dev:live` with a real `.env`. On the dashboard, show:
   - whether the account is authenticated
   - the authenticated broadcaster name and chat-read connection
   - whether EventSub is connected
   - the time of the last `!join` received

   Write `docs/LIVE-TEST.md` with the exact steps the user follows.
4. Write a README quick start a judge can follow in 2 minutes: mock mode, no Twitch account needed.
5. Write `qa/known-issues.md`. Fix crashes only. Don't start new features.
