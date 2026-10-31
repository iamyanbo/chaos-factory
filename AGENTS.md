# AGENTS.md — Chaos Factory

Read this file before every task. Rejected prototypes and historical design docs are excluded from the submission repository. Do not revive them unless the user requests it.

## What this is

Chaos Factory is a physics game show for Twitch, inspired by MIKAN-style marble videos and Marbles on Stream. Viewers type `!join` and get a named marble. A round lasts about 60 s. Interaction is joining only; there are no channel-point Predictions. There are two modes:
- **Chat vs Streamer**
- **Faction War**: color teams compete against each other

It is a hackathon entry for Codex x TwitchCon, due **Nov 2, 2026, 5:00pm EST**. It is judged on innovation, impact, technical implementation, and "easy to use and fun to watch".

## How design works now (read this)

**Use the Toy theme and check your own frames against it.** Read `docs/24-toy-theme.md`; the visual references are `docs/refs/theme-toy.png` and `docs/refs/ui-themes.html?theme=toy`. Your job is to:
1. Build simple, honest, **visible** physics using the shared Toy tokens and components. Balls default to matte vinyl; no glossy billiard balls.
2. Render your own frames (`npm run frames`), open them next to the Toy reference, and fix every difference before you hand over.
3. Let the best-take selector pick the most watchable seed. The user does not tune by hand.

These rules apply to every game:
- **No invisible forces.** Never apply an impulse, velocity override, attraction or "jet" that the viewer cannot see on screen. If something pushes a marble, it must be drawn: a piston, a fan with visible wind streaks, a bumper. Hidden help or hindrance looks broken on stream.
- **No gaming metrics.** Don't tune toward a number in a way that the user would see as fake. If a metric and the user's opinion disagree, the user wins.
- **Fixed camera by default.** The whole arena fits in the frame at once. No auto-zoom and no follow camera unless the user turns it on in the panel.
- **No instant replays.** They are removed.
- **One mechanic per game.** Remove features before adding them. A new feature needs the user's request.
- **Readable code.** Use normal formatting, one statement per line, and named constants for every tunable. Don't write dense minified one-liners.

## Scope

- **Visuals: `docs/24-toy-theme.md` wins all visual conflicts**, including the older visual table in doc 23.
- **Current scope (October 31 user override):** eight existing games; default rotation is Hot Potato, Blade Brawl, Multiplier Cascade, Peg Fever and Marble Race. Light Cycles, Pong Wars and Ring Run+ remain optional queue/rotation choices and offline games. No new games or mechanics without a user request.
- Every round stands alone. No Cup points, standings, qualification, forced Grand Final, XP, progression or persistent crown. Preserve each game's intrinsic objective score, such as Peg Fever landings and Pong territory.
- Chat interaction is **!join only**. No Predictions, emote rain, hype meter, votes or reflex controls. Natural game endings decide results; the hidden safety threshold starts visible sudden death instead of inventing a timed winner.
- Live Twitch joins remain supported; only `user:read:chat` is requested. Mock mode remains the development default, with no credentials or viewers needed.

## Stack (do not swap)

- TypeScript strict, npm workspaces: `apps/server`, `apps/show`, `packages/shared`.
- Show: Vite, PixiJS v8, `@dimforge/rapier2d-deterministic-compat`, Howler.
- Server: Fastify + `ws`, Twurple, zod, JSON persistence in `.data/`.
- Tests: Vitest and Playwright.

## Hard rules

1. Tokens and secrets live only on the server and never reach the browser.
2. Mock mode (`TWITCH_MODE=mock`) gives the same show experience, with simulated chat that has a 2–5 s delay.
3. Deterministic 60 Hz fixed step. Game logic uses only the seeded RNG.
4. Games are plugins in `apps/show/src/games/<id>/`. They touch the engine only through `GameContext`.
5. Chat input must tolerate a 2–5 s stream delay. Never require reflex timing.
6. Art and audio must be stream-safe: procedural or CC0, recorded in `ASSETS.md`. Never use MIKAN or Marbles on Stream names or assets.
7. Twitch failures never freeze the show. The current round continues if chat disconnects.
8. Keep files under about 300 lines.

## Working conventions

- Before finishing a task, run `npm run typecheck && npm test`.
- After each task, append **at most 10 lines** to `CODEX_LOG.md`: what you built, decisions made, and what's left.
- Commit message format: `feat(game:ring-escape): ...`

## Commands

```
npm run dev        # server + show, mock mode
npm run dev:live   # real Twitch (needs .env)
npm run typecheck
npm test
```

Pages:
- `/play?game=<id>&seed=<n>`: the offline game
- `/show`: the OBS source
- `/dashboard`
