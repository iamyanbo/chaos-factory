# Shared plugin helpers

The `kit/neon` import path is retained for existing plugins. Its ball and sidebar
renderers delegate to `kit/theme`; all current artwork uses the Toy theme.
It does not enable neon, glow or wireframe styling.

- `NeonBalls` / `NeonBall`: compatibility aliases for `ToyBalls` / `ToyBall`.
  Ball style comes from `?ball=a|b|c`; the default is matte vinyl.
- `NeonSidebar`: the shared Toy HUD cards, bars and names.
- `strokeLine`, `strokeArc`, `strokeCircle`: independent outlined paths.
- `NeonSparks`: bounded cosmetic particles with a separate RNG.
- `NeonSound`: synthesized bounce, hit, parry and multiplier notes; headless-safe.
- `circleWall`, `resizeCircleWall`: visible circular Rapier boundaries.
- `hitStop`: presentation feedback. Blade Brawl uses an 80 ms kill freeze,
  limited to once every 0.75 seconds; normal hits do not freeze play.
- `rememberTrail`: cosmetic position history; never consumes gameplay RNG.

Create Pixi views only when `!ctx.headless`. Physics uses the seeded `ctx.rng`,
fixed 60 Hz steps and `ctx.physics`. Keep geometry and visible collisions aligned.
No helper imports a game.

Plugins expose `start`, `step`, `render`, `status`, `destroy` and `inspect` through
`GameContext`. Current games run automatically and have no steering/chat powers.
The best-take selector reads aggregate activity and pacing, never player identity
or which side wins.

Camera framing is fixed unless the game has an approved scrolling course.
Marble Race follows the leading section; Cascade uses its approved slow scroll.
Side cards remain fixed and readable.

Render stills with `npm run frames -- --game <id> --format <format>`.
Use `CHAOS_TEST_URL` for an existing preview server. Output is in
`qa/frames/<id>/`: 2/6/12-second stills, a contact sheet and capture metadata.
This command does not record a video. Compare the images to
`docs/refs/theme-toy.png` and record the review alongside them.
