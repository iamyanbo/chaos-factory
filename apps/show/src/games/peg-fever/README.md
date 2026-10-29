# Peg Fever v2

Watch `/play?game=peg-fever`. Offline bots are included; nobody needs controls.
Up to 64 viewers get exactly three balls each, in three passes through join order.
Four-ball bursts start every 2.5 simulation seconds, with a short muzzle stagger
to avoid spawning overlapping bodies. The launcher follows a seeded sine path.

The seeded board chooses concentric rings, a staggered weave or five chevron
bands. Every pattern has 100 blue, 20 orange and one central gold peg, mirrored
opportunities and ball-sized clear gaps. Gravity,
bouncy Rapier contacts and real slot dividers determine every landing. The nine
permanent slots are ×1 ×2 ×3 ×5 ×10 ×5 ×3 ×2 ×1; the middle slot is narrower.

Every launch starts with a visible 100-point run. This applies equally to all
viewers and makes the permanent slots matter after the pegboard clears. No
points are paid before a physical landing. The nth fresh peg hit adds its base
value times n to that ball's run: blue 10,
orange 50. Gold doubles both the existing run and later hits. The run number
travels beside the ball. Owner totals change only on landing: a visible arithmetic
stamp multiplies the run by its slot and flies into the owner's sidebar total.
Claimed pegs stay physical until that claiming ball lands, then clear together.

Hitting the last orange starts Fever immediately, doubles all slot multipliers
for the remainder, turns their hardware/labels gold and raises the music octave.
Queued balls keep firing; there is no separate end phase or extra supply. If
orange targets remain, Fever never starts. LAST BALLS appears after all third
balls fire; the last real floor contact decides the final totals and winner.
Faction mode adds member totals. Score ties use orange hits, total hits and join
order in that order. No bucket, extra balls or end-phase bonus exists.

At the hidden 150-second safety threshold, the drawn physical peg rack lifts
out of the machine to release lingering balls. No velocity correction or clock
verdict is used. All live and headless play uses the same seeded 60 Hz steps.

The 36-body flight pool plus rack/frame/eight dividers stays below 64 bodies.
`npm run frames -- --game peg-fever --seed 1` captures stills only. Tests cover
contacts, delayed claims, finite supply, gold, all nine slots, Fever, end timing,
faction sums, replay and the body budget.
