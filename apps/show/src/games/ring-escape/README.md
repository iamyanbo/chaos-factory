# Ring Run+

Five permanent rotating rings fill 85% of the fixed 1080 square. One named marble
per viewer bounces with zero gravity and elastic contacts; the first fully out of
the fifth ring wins. Each pass grows its visible ball and Rapier shape by 6%.
The clear lane width is 87 px: over 4.5 diameters even for the largest active
marble after four passes. To fit those lanes inside the 920 px machine, starting
radius is 7.5 px through 30 entrants and 6 px for 31–64 entrants.

Only rings four and five have red sections, each one starting ball diameter long
including its rounded end caps.
They light up at 25 seconds and become deadly at 30. A second section per ring
telegraphs at 55 seconds and becomes deadly at 60. Until activation each section
is an ordinary solid white part of the same ring; no geometry appears or vanishes.
Actual contact with an active red collider pops that marble. White contacts and
the warning phase bounce normally. Red sections pulse before crossing the bottom.

Every 15 seconds the existing arcs rotate 15% faster, up to the calm speed cap.
An actual speed increase flashes them white. Gaps remain
open throughout the flash. The first entry into ring five turns its ordinary
stroke gold and raises the bounce/pass melody one octave. Real solver bounces
give the 1.005× speed gain, capped at 210px/s. Every marble starts at 150px/s.
Free flight has no acceleration.

To support a full staged round, outer openings have the same visible physical
clear width (four maximum active ball diameters), rather than becoming huge
compared with the marble. The inner opening stays capped at 38 degrees. The
rotation speed caps at 50 degrees per second so the gap remains physically
crossable; only an actual speed increase flashes the rings.

FFA ends with the first whole enlarged marble out of ring five, or the last
survivor of an initially larger field. Faction victory credits the first actual
escape to its team. An actual simultaneous all-pop is a void. There is no clock
verdict or visible timer. At 150 seconds, sudden death visibly widens the existing
gaps, updating the same Rapier shapes used to draw them. No marble receives
assistance or an invented escape.

Use `/play?game=ring-escape&seed=1&format=ffa` or `&format=faction`. There are 24
default bots, no steering or live joins after lock, and no streamer ball. Entrants
are capped at 64: starting radius 7.5px through 30 players, 6px above 30. This is
the permitted v4 upgrade; no archived implementation was read or copied.

The shared neon kit supplies glow, 25-position trails, notes and sparks. The
physim reference has its [MIT notice](../../../../../licenses/physim-MIT.txt).
The top three names stay visible. Other names hide in crowded clusters and
reappear with 64 px of local space; a 40 px hide threshold prevents flicker.
The side ladder retains five names per ring.
The take selector sees stable roster ordinals with progress 0–5 (−1 when popped)
and only actual pass/contact activity. `scoreRingTake` uses aggregate duration,
lead changes, closeness and quiet gaps, with no winner or identity data. It aims
for a full 90s round, penalizes rounds under 75s, and strongly penalizes pop
fractions of 25% or more. Raw seeds can still finish early; selecting takes
never delays a physical escape or changes its result.

Run `npx vitest run apps/show/src/games/ring-escape/ring-run-plus.test.ts` for
physical growth, red/white contact, gap geometry, timing, faction outcomes,
all-pop handling and deterministic headless checks. Capture the real page with
`npm run frames -- --game ring-escape --seed 1 --format ffa`; stills, the sheet,
and the seven-point review live in
`qa/frames/ring-escape/`.

Doc22 hype follows actual passes and red-collider eliminations. Entry into the
outer ring anticipates the finale with live slow motion; first escape or the
last-survivor event can supply the second decisive moment. A depth leader or
crowned marble escaping an active red arc within 0.3 radius gets SO CLOSE.
On an independently armed third of seeds, the first real outer-ring pass while
its red arcs are deadly earns a cosmetic jackpot. Combos count real ring passes
or consecutive red-arc eliminations. Feedback changes no gap, velocity, result
or game RNG; the shared result layer supplies the winner payoff once.
