# Shared hype

Games call `ctx.hype.at(time)` then emit events at actual physical contacts or
rule milestones. `decisive`, `nearMiss`, `jackpot`, `kill`, `combo`, `win` and
`callout` never change a body, RNG draw, score or result. Actor keys keep combo
chains separate; one second without a hit resets them. Headless and live runs
emit the same events. Best takes score anonymous final-third reactions only.

The view slows the current fixed-step simulation to 0.3 for 1.2 real seconds,
with a short 1.4x camera emphasis, at most twice. It never stores past frames.
Callouts are limited to one per two seconds; payoff names last two seconds.
Confetti, flash and notes use separate visual clocks and pooled views.
The show keeps a decided arena visible for its payoff before opening the outro.

`RareCelebration` arms one third of seeds with an independent stream. Callers
still require a real feat: an upgraded-weapon kill, clearing an outer hazard,
an attributed cycle cutoff, a completed gravity course, a full multiplier chain,
or filling Pong's eighth ball slot. This is a cosmetic reward, never a fake hit,
score bonus or outcome adjustment. Peg and destruction games define their own
explicit physical gold/bomb/mega-ball rewards.

Only !join and native Predictions connect viewers to the show. Hype comes from
physical game events; ordinary chat never changes the display or simulation.
