# Marble Race

A seeded gravity course, with one radius-14 marble per locked entrant
(maximum 48). All five middle modules appear once, in seeded order and mirrored
variants: zigzag ramps, rotating paddles, breakthrough gates, weight-responsive
seesaws and hinged trapdoors. Each module has two physical storeys. Chambers use
different routes: staggered slalom switchbacks with inside drops, diagonal rotor
junctions with outside bypasses, sequential tilting bridges, gates at different
heights and two breakthrough sluices discharging into staggered pegs. The same
fork-and-merge roof is no longer repeated across every floor. All ramps are
reachable by real fields. Both breakthrough lanes have their own cracked plank;
trapdoor lanes open two seconds apart. Moving arms are color-coded by function.
White lines are actual Rapier collision geometry. No hidden impulses,
recoveries or chat steering alter marble motion.
Trapdoors use 240px hinged arms with space to discharge onto the staggered ramps. They open in 0.45s
and close over 1.25s, retaining 0.9s fully open in each four-second cycle; a
closing door does not need to catapult marbles to clear the course.

The camera follows the leading active marble at a constant zoom of one,
looking 140px ahead along the course. It only moves downward,
with a 60px target dead zone and a critically damped spring (4/s). Its speed is
capped at 900px/s and acceleration at 2400px/s². It never changes physics.
The first physical finish crossing starts a full ten-second grace period for
the field, including solo races. Crossings within a tick are ordered by their
interpolated crossing time; crossings outside that window cannot earn a place.
The side column shows the top three and `finished N/total`, without a timer.
Faction uses the best average finishing place of each team's top three; a
smaller roster uses its actual size. After the grace period, DNFs count as
field-size + 1, and that penalty is stated in the final standings. Equal team
averages use the earliest individual finish as the tie-break.

At 150 seconds, a hidden safety threshold starts visible sudden death. Over
three seconds the actual supporting rails retract into their endpoints, peg
caps shrink away, and machine arms retract. Their displayed dimensions match
their Rapier collider dimensions throughout. The side walls remain in place;
gravity carries the marbles through the opened course. This never changes a
marble's velocity, awards a clock verdict, or stops the live simulation.
The 360-second audit observation horizon is not a live round cap. An empty
roster is the only immediate void result.

The shared Toy kit supplies matte balls, chunky ramps, side cards and impact
melody. The take selector sees stable roster-order progress from 0 to 6
and actual checkpoint crossings; its score contains no player or team identity.
Real checkpoint passes feed the shared combo counter, and the first real finish
raises decisive live slow motion. An independent cosmetic seed arms a rare
celebration for a full course clear before the emergency opening. No hype event
changes the course, marbles, physics RNG, placements or ten-second grace period.
The top three always show names; other names appear as the pack separates,
with distance hysteresis. The final podium retains actual finishers, while
the faction feed shows each team's average and any DNF penalty.

Controls: type `!join` before entrants lock. The race runs automatically. Run
`npx tsx apps/show/src/games/marble-race/pacing-audit.ts --runs 32 --count 24`
for raw duration, physical-finish and body-budget results. Camera regression
tests simulate 200 seeded courses through their natural ending and measure
actual per-tick displacement. Focused ending tests check physical crossing
order, the full grace window, solo behavior, and matching retracted collider
dimensions. The best-take score penalizes short and unfinished takes without
reading identities.
Hype tests compare enabled and silent motion, results and the next RNG value
against the revised branching course's SHA-256 baseline. Route tests run eight
raw 48-marble fields, requiring both lanes in all ten storeys and real contacts
on every internal ramp across the sample before emergency clearing.
