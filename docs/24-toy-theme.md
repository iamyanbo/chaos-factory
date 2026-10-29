# 24 — Toy theme (latest doc, wins all conflicts on visuals)

**Status: 2026-10-27. The user picked the "Toy" theme.** The reference is `docs/refs/theme-toy.png`, from `docs/refs/ui-themes.html?theme=toy`. Match it for everything **except the balls**: the user doesn't like the glossy, billiard-style balls in the mockup. The `.html` is a design mockup. Use it for colors, sizes and layout, and don't copy its code.

## Tokens (`apps/show/src/kit/theme/toy.ts`; every game and screen reads from here)

| Token | Value |
|---|---|
| Background | vertical gradient #ffd56b → #ff8f6b, with a white dot pattern (r 5, 48 px grid, 22% opacity) |
| Arena floor | radial gradient #5fc9f8 → #3a8ee6, with faint concentric rings (white, 8%) |
| Arena rim | white, 26 px, with a #1d4f9c shadow offset 10 px down |
| Ink (outlines and text) | #1b1b3a |
| Accent A / B | #3a8ee6 / #ff4f7b |
| Ball palette | #ff4f7b #ffb000 #2ecc71 #8e5cff #00c2d1 #ff7a1a #e84393 #4b7bec |
| Display font | Lilita One (OFL, bundled locally in `apps/show/public/fonts/` and credited in `ASSETS.md`) |
| Body font | Fredoka 500/700 (OFL, bundled locally) |

## Components (build once in `kit/theme/`)

- **Card:** white panel, 26 px radius, 5 px ink border, a solid offset shadow of 8 px (ink at 20%) and 22–26 px padding. Labels are 20 px uppercase with letter spacing; big numbers are Lilita 44 px.
- **Bars** (HP, Prediction, territory): 26 px tall, fully rounded, a pale track and a solid fill, animated with an ease-out. The Prediction bar uses accent A vs B.
- **Name tag:** Lilita 24 px, white fill, 6 px ink stroke under the fill. Show it only for the top 8, the crown holder, the Boss and the last 5 alive.
- **Callout:** Lilita 110 px, yellow #ffde3b, an 8 px ink stroke, a solid 10 px ink drop, rotated −6°. It pops in with a scale overshoot. It must stay inside the arena bounds and never cover the side cards.
- **Toast:** an ink pill, white Fredoka 26 px, at bottom center. Used for joins and short events.
- **Walls, ramps, pegs, gates:** filled shapes in white or palette colors, with a 4 px ink outline and a 6 px darker offset underside for a chunky toy look. No thin lines anywhere.
- **Layout:** the arena is centered and fills ≥ 75% of the height. The cards sit in 380 px side columns with 40 px margins. Use at most 3 cards per side.

## Balls: three candidate styles (the user will pick)

Implement all three behind one renderer, selectable with `?ball=a|b|c` on `/play` and `/show`. The default is `a` until the user picks.

- **a. Flat toy:** a solid palette fill, a 4 px ink outline, a darker crescent on the bottom-right third (the fill 25% darker) and **no** white highlight dot. Matte, like vinyl toys.
- **b. Jelly:** the fill at 90% opacity with a lighter inner ring, a soft white curved sheen (an arc stroke, not a dot) at the top-left, and a 3 px outline 30% darker than the fill instead of ink. Squash and stretch is stronger (up to 30%).
- **c. Face:** the flat toy style plus two simple ink eyes, which look toward the direction of travel and squint on hits. It's playful and mascot-like.

Shared rules:
- radius ≥ 20 px (≥ 16 px above 40 balls on screen)
- a soft ground shadow (ink at 25%, offset 5 px down)
- squash on impact
- any number (HP or score) sits in the center in Lilita, white with an ink stroke
- the crown is drawn above the ball

## Screens to restyle (same tokens)

The lobby/join screen, every game, standings, the winner podium and the dashboard (the dashboard can be simpler, but uses the same fonts and colors).
