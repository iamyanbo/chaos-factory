# Light Cycles

One automatic cycle per entrant draws a solid trail on a 160 by 160 grid
across the fixed 1080 square. Touching a trail or the white wall crashes the cycle;
the last one still riding wins. Crashed trails visibly fade for three seconds
and remain solid for those same three seconds, then their exact cells reopen.
There are no replacement cycles, rebounds, hidden pushes or outcome adjustments.

Trails render as continuous 3px color tracks with a 1.25px outline and a 1px
underside. The complete painted track fits within one grid cell, leaving adjacent
routes readable. Heads are matte directional arrows rather than balls, pointing
along the actual grid heading. Their smaller footprint stays readable near walls;
names and crowns remain upright and bounded by the current playable rectangle.
The Toy board and inner white border have square corners matching the grid.
These changes affect presentation only; collision cells, motion, steering and
results are unchanged.

Steering looks three cells forward and compares safe forward/left/right routes.
A bounded free-space check avoids choosing a small sealed pocket over open space.
Each live cycle gets a seeded 4% turn request every fixed 60Hz tick; a turn happens
at a cell center and only when it is safe compared with the alternatives. Nobody
reverses into their own attached trail. Cell claims resolve simultaneously, so two
heads entering the same empty cell crash together rather than rewarding the first
array entry. Existing trail crashes credit the actual trail owner for rivalries
and the Cup crown.

The three stages are OPEN GRID, SPEED UP at 40s (speed x1.3), and WALLS CLOSE from
70s. The drawn white border moves inward at a fixed public rate; it is the actual
collision boundary, not a camera effect. Initial speed is eight cells/second,
54px/s, then 70.2px/s. At 150s sudden death visibly closes the real collision
border faster until the rule is decided. There is no timer verdict; a simultaneous
last crash voids the round. Raw seeds may end earlier;
the winner-blind take score prefers 90–120s and the shared selector penalizes
rounds below 75s. No name, team, profile, wager or winner enters that score.

Use `/play?game=light-cycles&seed=1`. The default offline field is 24 bots; a round
admits at most 32 viewers, first come, first served. Viewers type only `!join`.
There are no viewer or streamer steering controls. Profiles provide stable colors,
levels, titles and the shared champion crown. All geometry and audio are procedural;
the shared Toy palette supplies matte arrows, thin solid tracks, crash sparks
and motion-pitched notes.
Permanent solid trail segments use static batched quads rather than rebuilding
the whole maze every animation frame.

Run `npx vitest run apps/show/src/games/light-cycles/` for grid contacts, simultaneous
collisions, actual trail reopening, steering, deterministic replay and pacing.
`npm run frames -- --game light-cycles --seed 1` captures the real browser page;
stills, a contact sheet and the seven-point review go to
`qa/frames/light-cycles/`.

Doc22 hype credits actual trail-owner cutoffs and physical crashes. The last-two
duel and deciding crash can trigger live slow motion. The full grid stays in frame
during that slow motion; finale zoom is disabled. A current survival leader
(longest live trail, stable ordinal on ties) or crowned rider who turns away
within 0.3 head radius of the drawn trail or wall gets SO CLOSE. On an independent
third of seeds, the first actual opponent-trail cutoff earns a cosmetic jackpot.
Consecutive attributed crashes feed the combo; a crowned rider's crash gets
DETHRONED. These observations consume no steering RNG and change no grid cells,
turn, survival result or wager reward. The shared layer pays off the winner once.

The current Toy view uses shaded rounded arrow heads and filled tube trails.
A small quarter-circle joins each perpendicular pair of segments; cached atlas
quads keep this display work batched. The underlying grid, steering and crash
rules are unchanged. Near-miss captions follow the affected living rider at
40px type and at most 180px wide, with no floating offset.
