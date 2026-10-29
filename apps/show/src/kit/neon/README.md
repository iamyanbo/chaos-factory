# Shared neon kit

This is the extracted Ring Run v4 look for the five-game lineup. Runtime game
modules import from `../../kit/neon`. No module in the kit imports a game.

- `INK`, `WHITE`, `STROKE`, `ARENA`, `CENTER`, `PALETTE`: near-black, 8px white
  strokes, center square 420–1500 and twelve saturated colors.
- `strokeLine`, `strokeArc`, `strokeCircle`: independent paths with round caps;
  use these to avoid origin connectors after fills.
- `NeonBalls(ctx)`: main-thread view. `render(actors, alpha, time)` accepts
  `NeonBall` objects (id, name, x/y, prevX/prevY, radius, color; optional alive,
  trail, hp, detail, flashUntil, leader, hideName). It draws glow, 25-position
  fading trails, names, scaling text and bold central HP. Destroy it on cleanup.
- `rememberTrail(trail,x,y)`: call only for cosmetic history; it never uses RNG.
- `NeonSparks(ctx)`: main-thread view; `burst(x,y,color,time,count)` and
  `render(time)`. It owns a separate cosmetic RNG and has a bounded particle pool.
- `NeonSound(ctx)`: `bounce(speed)`, `pass(depth)`, `hit(speed,damage,kill)`,
  `parry(speed)`, `setOctave(octave)`. It is safe in a headless game.
- `hitStop(ctx,ms)`: presentation only; 40–100ms. Set the game definition's
  `hitStop:true` to enable it. Blade uses 60ms hits/100ms kills.
- `circleWall(ctx,radius)`, `resizeCircleWall(body,radius)`: actual elastic
  Rapier boundaries matching the drawn half-stroke skin.
- `NeonSidebar`: used by the shared show HUD. A plugin calls
  `ctx.hud.setSide?.({bars,rows,feed,subtitle,countLabel})` and/or `setLadder`.
  Bars take `{label,value,color,text?,flash?,side?:'left'|'right'}` with value 0–1;
  rows take `{label,names,color?}`. No HUD content is drawn in the central square.

Construct DOM/Pixi views only when `!ctx.headless`. Gameplay always uses
`ctx.rng`, fixed 60Hz steps and `ctx.physics`. Cosmetic effects cannot consume
the gameplay RNG. No game imports another game.

Definitions can declare `formats:['boss','ffa','faction']` (supported subset),
`presentation:'minimal'`, `defaultBots`, `camera:'fixed'|'scroll'`, and an optional
constant `cameraZoom` (default 1). Marble Race follows the leader's section at
zoom 1; Cascade preserves its approved slow scroll at a declared 0.8. Use `ctx.camera.follow({x:960,y:sectionY},1)`. The show clips world layers
to the center square and leaves the sidebar fixed.

The offline selector passes `ctx.setup.format`, `mode`, `competition`, `teams`
and the locked roster. Use `audienceIndependent:true` for machines that run with
zero viewers; use `spectator:true` only if the game never needs viewer names.
Pong keeps viewer names in its roster while its fixed ball supply stays separate.

Implement public `marbles`, `inspect()`, `start/step/render/status/destroy`,
no-op `onChat/onStreamer`, and locked `onJoin():false`. `marbles` supplies the
show's debug/actor count; inspection should include the standard id/name/team/
x/y/radius/alive/dormant/isStreamer/boost/heat/staged/finished fields.
For `scoreTake(events)`, expose stable-ordinal `takeState():number[]`, normalized
progress 0–6, larger better; use −1 for eliminated actors. Only physical actions
emit `{t:'activity',time,kind:'hit'|'parry'|'flip'|'checkpoint'|'birth'}`; ring
passes use `{t:'pass',time,ring}`. The selector's aggregate field `passes` counts
these physical activity events. Scores contain no player/team/winner identities.

Frame capture: `npm run frames -- --game <id> --seed 1` (optional `--format`,
`--bots`, `--teams`). Set `CHAOS_TEST_URL` to the running production preview
when reviewing. Output: `qa/frames/<id>/20s.webm`, 2/6/12s stills and ten-frame
`sheet.png`; write the seven-line self-review after opening your images.
Ask the root agent for registry, shared-code or build changes during parallel work.
