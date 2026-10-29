# Multiplier Cascade

Open `/play?game=multiplier-cascade`. Fixed color teams run automatically;
joining and Twitch are optional. Balls keep the same 22-world-pixel radius
throughout multiplication, crowds and the finish. The Toy renderer never needs
to change their size at its crowded-field threshold.

One continuous course replaces the three repeated drops. Eight chambers span
3,520 world pixels: pinwheels, split bridges, a staggered peg maze, crossing
sweepers, a giant rotor, crossroads, twin rotors and the final split. Holding
flaps release at 6/14/22/30/38/46/54/62 seconds. Actual physical rails, joints,
pegs and arms explain every contact. There are no hidden pushes or velocity
rescues. The downward-only camera follows the front with 200px of course ahead,
a 150px/s speed limit and bounded acceleration; zoom stays at one.

The eight multiplier rows are x2, x2, x3, x2, x2, x3, x2, x3. Each has a bounded
red x0 mouth, a main multiplier, an x1 strip and an outer x1 bypass. The outside
wall lane is survivable. Gate labels use exactly the same boundaries as scoring.
Real multiplying contacts pop local arithmetic stamps and play rising notes;
drains show a local x0 rather than announcing fake kills. Side cards show real
live ball counts by team, then physical finish counts.

The bottom pockets add finite supply to the finish hoppers. The first color to
land five balls in the shared finish wins. That machine continues below the
course, so the camera keeps scrolling down instead of jumping back to the top.
Each team has five base balls even if its course yield is zero. More earned
supply pours more of that color; totals never change in-flight balls or gates.
Crossings within one physics tick use their fractional finish times.

Queued children only form in clear ports above the holding flaps. Failed port
attempts rotate fairly through the queue and work is bounded each step; the
complete machine stays within 200 bodies. At 80s the course hardware withdraws
to clear lingering supply. The hidden 150s threshold opens the finish lips
further; it never awards a clock result.

Tests cover all eight sensors, physical drains, constant radius, downward-only
camera movement, exact replay, finite hopper stock, zero-yield finishes, body
limits and conservation with no expired supply at two/four/six teams. Hype-on
and silent full six-team rounds have the same committed physical fingerprint.

`npm run frames -- --game multiplier-cascade --seed 2 --from 49` captures the
large crowd. `--when relay` captures the final machine; neither records video.
Stills and the Toy review live in `qa/frames/multiplier-cascade/`.
