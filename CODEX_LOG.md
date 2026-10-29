# Chaos Factory — build log

## 2026-10-24 · T01–T20 + full catalog · scope

Read the game bible and preserved the original prototype unchanged under `legacy/`.
The requested scope is the complete local/mock show, including all 19 games. Live
Twitch OAuth, EventSub, Helix, credentials and live verification are explicitly excluded.
The implementation and measured validation will be recorded below as they finish.

## 2026-10-24 · T01–T04 · foundation and shared kit

Created three strict TypeScript workspaces; Vite/PixiJS v8 rendering and deterministic
Rapier2D at 60 Hz; typed zod WebSocket protocol with role gates and a single show
owner; seeded RNG and independent bot/cosmetic streams. Added original procedural
marbles, labels, hazards, tracks, camera trauma/punch, hit-stop, pooled FX capped at
1500, slow-mo cues and procedural audio. Bundled Lilita One and Baloo 2 with OFL
licenses. Kept the legacy prototype files unchanged in `legacy/`. Later split route
bundles so the dashboard/controller do not load the WASM game runtime.

## 2026-10-24 · T05–T06, T09–T11, T17 · complete local show

Built delayed mock personalities, configurable crowd settings, prediction limits,
locking, pool-conserving payouts, refunds and persisted startup recovery. The
browser director owns Cup phases, roster/team locks, input cooldowns, replay logs,
mode rotation, difficulty and Chaos Wheel voting. Added the dashboard, keyboard /
pointer / gamepad controller relay, safe-zone camera reservation, persistent stats,
15 earned titles, MVPs and traitor callouts. Stored full setup with replays and added
a replay verification CLI. Live Twitch T08 is intentionally excluded.

## 2026-10-24 · T07, T12–T18 and Tier 3 · all 19 plugins

Implemented Crusher Run, Collision Royale, Grand Prix, Color Conquest, Ring Escape,
Gauntlet, Core Siege, Plinko, Pinball, Meteor Dodge, Lava Rise, Hot Potato, Derby,
Trapdoor, Multiply, Cannon Clash, Tree War, Tower Topple and Bike Down. Each has a
definition, bot policy entrypoint, README and contract/balance test entrypoint.
Mechanics include grid territory and split painters, shared ring shatters and
shrinking boosts, seeded fork votes, eroding meteor platforms, one-way climber
platforms, fuse passing, vote-selected multiplier lanes, ballistic destructible
forts, tree upgrade cards, real stacked blocks, and a jointed bike/rider course.

## 2026-10-24 · T19 · measured fixes and validation

The initial surveys were not balanced. Fixed a negative hazard timer that prevented
repeat firing; shuffled equal faction rosters to eliminate release-order advantage;
corrected CvS team/color and meter eligibility; added one-way lava collisions and
bike rider springs; made overlapping Tree War fruit sensors; and calibrated actual
physical speed, cooldown, HP, gap and quota knobs. No winner is selected by a coin
flip. Final report: **29 modes × 200 consecutive seeds = 5800 rounds, zero timeouts;
all 16 CvS modes at 41.5–58% streamer wins** (`qa/sim-report.md`). The full modifier
sweep completed **1044 simulations with zero failures**, including 2/6 teams and
maximum rosters (`qa/modifier-report.md`).

Browser QA found sparse-label teardown failures in Multiply/Tree War; fixed and
regression-tested them. Added overlap rejection to label LOD. Fixed manual input
replay tick ordering and recorded autopilot releases when a person takes over.
Hardened per-user maps for property-like usernames. Production Playwright passed
**22 tests**, including all 19 games at 1080p/720p, manual chat/join/verbs, queue,
Cup settlement, pause/resume, controller relay and void/refund. Build and dependency
audit pass; the audit reports zero vulnerabilities. Performance validation is
recorded in a follow-up entry once measurements finish.

## 2026-10-24 · T20 · demo and handoff material

Searched seeds 1–20 with bot simulations and selected Crusher Run **2**, Ring Escape
**13**, Color Conquest **12** using highlights and close-finale cues. Demo mode uses
the three-game script, deterministic bots and a reset director RNG/difficulty.
Finished setup/OBS/commands/architecture documentation, implementation notes and an
honest submission draft. External repo publication, real Twitch verification, OBS
compression/audio review, video recording and submission require the owner.

## 2026-10-24 · T19–T20 · final recovery, replay and capacity checks

Final typecheck and Vitest pass: **93 tests across 29 files**, with sixteen expensive
balance assertions gated behind `CHAOS_BALANCE=1`; their 200-seed scenarios were
actually run with the simulation CLI. Merged the final Cannon faction rerun into
the complete 5800-round report. After preserving real-time Turbo notice/vote
windows, an additional 87 Turbo rounds ended without timeouts beyond the original
1044-case modifier sweep. Verified an on-disk Color Conquest replay: winner and
highlights match after 1105 recorded inputs over 60.78 simulation seconds. A newly
persisted UUID-named Ring Escape replay also verified (18 inputs, 56.62 seconds).

Fixed fractional finish-place protocol validation without rounding damage scores.
Separated round UUIDs from simulation seeds so new repeated-seed rounds count in
stats and retransmissions do not count twice. Fresh shows get a crypto-generated
starting seed; explicit seeds and scripted demo seeds remain deterministic.
Bridge loss marks the current round no-wager; during play it releases held boss
controls and enables autopilot. The browser queues twenty completed offline round
records, but discards stale prediction commands. Added recovery/idempotence tests.

Replaced particle geometry with a capped sprite pool and reused label objects.
The uncapped 1920×1080 Chrome capacity audit reached **66.2 FPS** with 200 active
marbles and 1500 persistent particles; longest lab frame **34 ms**. All nineteen
early-play samples exceeded 58 FPS, and the ten-round retained heap increase was
**31.13 MB**, with no page errors. An empty page in normally paced headless Chrome
also averaged about 56 FPS here. Frame limiting and GPU VSync were disabled only
for the capacity run; this is not a claim of verified OBS capture performance.
Real OBS maximum-body capture, compressed-stream readability and audio review
remain operator checks. All nineteen game READMEs link their measured balance
and record the completed automated quality checks. Dependency audit: zero known
vulnerabilities. Live Twitch remains deliberately unimplemented.

Final production browser run: **24 Playwright tests passed in 4.8 minutes**,
including all nineteen arenas at 1080p/720p, phase screenshots, manual join/verbs,
dashboard queue and mobile layout, controller/pause/void flow, three settled Cup
predictions, the fixed-seed demo and the duplicate-show ownership explanation.
Final source typecheck, all 93 unit/game checks and the production build pass.

## 2026-10-24 · Offline solo testing

Added `/play` and `npm run play` for testing without real chatters, Twitch or the
application bridge. The same director and game plugins run one immediate round
at normal speed, hold the result, and restart with an exact chosen seed. A local
24-bot crowd is configurable; delayed game-specific chat bots exclude the human
player. Boss control starts manual, supports keyboard/gamepad/held buttons, and
has optional autopilot. Local chat verb buttons, team selection and aim arguments
make faction-only games testable too. Practice sends no WebSocket messages,
predictions or lifetime-stat records and can coexist with the broadcast show.

Added dashboard links, responsive controls outside the canvas, host-sized renderer
resizing, and held-input release on restart/pause. Checked desktop controls fit
the viewport and phone layout has no horizontal overflow. A director regression
checks immediate start, real bot delay, human input, exact setup restart, mode
fallback, held result and no prediction/stat writes. Browser tests launch every
one of the 29 supported game/mode combinations and exercise manual controls, chat,
pause, same-seed restart and new seeds. Both tests pass against the built frontend
on its own, with API access blocked and zero bridge WebSockets. Typecheck, build
and **94 unit/game tests** pass (the same sixteen balance tests remain opt-in).
The full production browser suite also passes: **26 tests in 4.9 minutes**, covering
the offline additions and the existing Cup, dashboard, controller, demo and all
nineteen 1080p/720p arenas. Inspected both offline layout screenshots after fixing
a transient mobile canvas overflow. Left the user's development server running.

## 2026-10-24 · Gameplay repair after the first human playtest

The user found confusing role ownership, three broken opening games, centre-screen
name spam and incorrect Color Conquest ball effects. Earlier launch/end and balance
checks did not establish that these interactions were playable. This entry corrects
that gap rather than treating the previous green suite as proof of game quality.

Practice now chooses exactly one human role. Boss mode operates the pink hero or
machines without a separate blue YOU marble; chatter mode controls normal chat
actions while the boss is automated. Faction mode is chatter-only. Added goals,
role-specific controls, cooldowns, actual shared-meter percentages, a whole-team
offline testing option, immediate game selection and Bike Down's pre-ride plans.
CvS setups remove saved faction tags while retaining Cup membership separately.

Rebuilt Crusher Run's factory, conveyor, real trapdoor and quota; Collision Royale's
physical obstacles, steering/knockback, dash and mass restoration; and Grand Prix's
physical downhill course, gated votes, real branches and finish crossing. Repaired
Color Conquest's swept circle/tile contacts, neutral-wall reflections, blue backup
powers, pink steering/burst, faction palettes and real-user score attribution.
Shared input latches preserve taps between physics ticks. Only declared meter verbs
charge powers. Accepted-vote feedback uses a bounded side feed, and painter backups
do not duplicate name labels over the action. Vote-only games show no fake meter.

The wider control review fixed persistent dashes, remembered Tree War card choices,
Cannon aim/rotated-body rendering, a visible physical Plinko deflector and vote
lookup, Ring Escape's outer-ring collisions, Tower spawn/camera framing and ignored
CvS Trapdoor votes. Source edits caused Vite reloads during an early walkthrough;
those observations were discarded and the nineteen-game walkthrough was repeated
against a fixed production build. The audit is in `qa/gameplay-audit.md`.

Changed game/mode balance rows were rerun with 200 consecutive seeds; every current
CvS row meets the 40–60% bot target. This is bot balance evidence, not human pacing
approval. The supported modifier/roster sweep completed 1038 cases without failure;
a later Trapdoor follow-up passed 72 cases. Grand Prix excludes the fixed-origin
magnet after the sweep proved it could prevent descent. Deliberate design changes
are recorded in the catalog and implementation notes. Full human pacing, real OBS
capture, compressed-stream readability and microphone mix remain operator checks.
Live Twitch connectors remain excluded.

Repair validation: typecheck, production build and **115 unit/game checks pass**
(sixteen opt-in balance checks skipped in Vitest; measured separately by the CLI).
The full production suite passed **29 browser tests in 5.2 minutes**; after removing
fake vote-only charge bars, the five offline browser tests passed again. A fresh
saved Ring Escape replay reproduced its winner and highlights. All current balance
rows have 200 runs and no timeouts; CvS bot win rates range from 42.5% to 57.0%.
The catalog walkthrough recorded zero page errors. Production dependency audit:
zero known vulnerabilities. The user's development server remains running.

The final stress check exposed another issue: rebuilding marble geometry every
frame limited the 200-marble/1500-particle lab to 46.9 FPS. Retained body/trail
geometry raised the same uncapped lab to 146.3 FPS (20.5 ms longest frame);
large-crowd Collision Royale rose from 54.6 to 103.4 FPS and Trapdoor from 48.3 to
86.3 FPS. The first optimization run then exposed a 161.15 MB retained-heap
regression. Pixi requires explicit graphics-context disposal when child-destruction
options are supplied. Fixed that and released eliminated marble views immediately;
added a real-context elimination/round-cleanup regression. Final typecheck, build
and all 115 unit/game checks pass. The five offline browser tests and colour/role
screenshots pass with retained rendering. The focused ten-round cleanup rerun with
the same 200-viewer crowd retained **18.25 MB**, with zero page errors. Rendering
samples and the later cleanup rerun are distinguished in the performance report.
Physics and replay behavior were unchanged by the rendering optimization.

## 2026-10-24 · DESIGN-01 — Redesign proposal

The user rejected the current game feel and engagement, including marble racing,
Collision Royale, Crusher Run, Ring Escape and Core Siege. They requested a
proposal instead of more implementation. Their selected direction is: mostly
choose buffs and risks while physics runs automatically. Treat that preference
as the basis for the next design iteration, including automatic Color Conquest
movement with meaningful boss advantages against a bounded chat squad.

Prepared a proposal to narrow the active lineup, use visible card drafts and
12-second chat votes, establish consistent momentum/contact behavior, and replace
the three-row input-notification clutter with labeled decisions and consequences.
Candidates: Color Conquest v2 first, a physical marble rally with equal-sized
scoring squads next, and a structural fort battle as a later experiment. Proposed
parking the current Crusher/Core/Collision/Ring concepts. These are proposals,
not implemented game changes or adopted replacements for the game bible.

Source inspection confirmed repeated velocity assignments in Grand Prix and
recurring upward impulses in Ring Escape, plus route input logic without live
vote totals. The three @-name rows are accepted-input notifications. Referenced
official descriptions of Peglin and Ultimate Chicken Horse while considering
upgrade-driven simulation and shared course decisions. Typecheck and the existing
115 unit/game checks pass (16 opt-in balance checks skipped); these are baseline
checks and do not establish that the proposed games will be enjoyable.

## 2026-10-24 · DESIGN-02 — Color Conquest automatic draft prototype

Implemented the first experiment from the redesign after the user asked to
develop something. `/play` defaults to Color Conquest: automatic paint billiards,
one large crowned pink boss with Royal Ink versus a fixed three-ball blue squad.
The boss chooses cards with 1/2/3 or clicks; chat votes 1/2/3. Three twelve-second
drafts at 0, 30 and 60 seconds select upgrades during a ninety-second battle.
Votes count each viewer's latest selection once. Empty/tied votes are seeded.
The UI shows actual card titles, tradeoffs, counts, accepted selections, lock
timers, winning cards and accumulated builds. The old steering/PAINT meter and
three-row input feed are removed from this game. Bots draft and vote with the
normal stream delay, so it works alone. Controller labels follow current cards.

Added five boss and five chat cards with stacking upgrades or explicit temporary
effects: larger/slower brushes, twins, bursts followed by recovery, reinforcements,
remote paint bombs, collision splashes and telegraphed walls. The body budget is
twenty; measured runs peaked at nine. The old Color Conquest Faction variant is
parked for this CvS prototype. The other eighteen game designs remain as before.

The first visual pass barely changed territory. Replaced boundary-only tile
conversion with swept paint trails, physical-wall reflections and elastic
circle contacts (mass proportional to radius squared). Removed target steering
and repeated movement impulses. A bomb regression revealed that targeting an
opponent's current brush could erase the effect immediately; bombs now prefer
safe enemy territory. Added momentum/energy, draft timing, vote replacement,
actual card-effect/recovery and warning-to-impact tests. Browser walkthroughs
reviewed upgrade changes, a second draft, live votes and mobile layout against a
fixed production build. Full rules and review scope: docs/11-color-conquest-prototype.md.

Validation: typecheck, build, **120 unit/game checks** (sixteen expensive balance
checks skipped by default) and **30 browser tests in 5.7 minutes** pass. Two hundred
consecutive seeds at d=0.5 measured **52.5% boss wins**, zero timeouts and a 90.0s
mean. Nine supported modifier/extreme-voter cases pass. An actual browser-recorded
round replayed identically (winner/highlights, 439 logged inputs). The focused
1920×1080 uncapped rendering sample with 200 mock viewers and persistent particles
measured **367.1 FPS**, 8.7ms longest frame, five bodies/1490 particles and zero page
errors; this is capacity evidence, not OBS or sustained maximum-load certification.
Human replayability and build/pacing feedback remain the next review. No live
Twitch connector was added. Left development running and stopped the isolated QA
server after validation.

## 2026-10-24 · DESIGN-03 — Just !join

The user clarified that participation should be becoming an object in the show,
with only `!join`. Replaced the draft prototype with automatic sixty-second
Faction paint billiards. Every admitted participant owns one ordinary named
painter; no synthetic voting squad, boss, cards, powers, steering or meters remain
in this game. The neutral floor, two solid islands, swept trails and elastic
contacts provide the simulation. New arrivals receive a name highlight and
spawn feedback; the ordinary input feed stays suppressed.

Made this the default offline game and the only enabled default Cup game. Other
eighteen games remain explicitly selectable earlier experiments, without claiming
their design is now approved. Offline starts with 24 bots and a single !join
button; zero bots is supported. The role/team/gameplay controls disappear in this
mode. Restart retains local membership. Dashboard/controller copy follows the
host role, and the default Cup skips wheel voting. Updated the game bible,
AGENTS direction, README and per-game README to prevent restoring the rejected
interaction model. The prior draft document and measurements are marked historical.

Added optional plugin onJoin and replay join inputs with shared validation.
Accepted mid-round joins preserve existing positions and time; duplicates create
no extra actor/input. The floor admits 160, with overflow queued. Membership
persists without continual chat activity. The initial replay setup is cloned
before game creation, so late arrivals reproduce from their logged tick instead
of appearing at time zero. A real Director late-join result matches its headless
replay exactly. Mock viewers use the same !join command; no live connector was added.

Validation: typecheck and production build pass; **121 unit/game checks** pass
(15 expensive balance checks opt in). The full **31 browser checks** pass; after
the final dashboard cleanup, all eight dashboard/offline checks pass again.
Desktop/mobile screenshots show the ordinary YOU painter and single join UI.
Two hundred consecutive seeds with sixty painters across four teams end at
60.0 seconds with no timeouts: red 45, blue 57, mint 49, gold 49 wins. All six
supported modifier/extreme-roster cases pass. The merged report has 28 current
game/mode rows; unchanged earlier catalog measurements are retained explicitly.

The first focused production rendering sample at 1920x1080, 160 named painters and
1470 particles measured **72.9 FPS**, **38.6 ms** longest frame and zero page
errors with frame limiting/VSync disabled. This is capacity evidence, not OBS
certification. Human pacing/replayability, audio mix and compressed-stream review
remain open. Stopped the isolated QA server and left the user's development
servers running after validation.

The maximum-roster screenshot then exposed overlapping multi-team prediction
captions and frequent lead announcements covering the arena. Shortened the
captions, bounded each to its slot, and kept live territory in the score strip
without mid-round lead announcements. Typecheck/build and all 121 unit/game
checks pass again; the three affected offline/live-join browser checks pass on
the final production bundle. Physics, RNG consumption and recorded results are
unchanged by this presentation cleanup.
The final full-field rendering rerun measured **80.7 FPS**, **30.4 ms** longest
frame with 160 painters and 1480 particles, zero page errors. The inspected
screenshot has separate prediction captions and an unobscured playfield.

## 2026-10-24 · DESIGN-04 — More join-only mode proposals

The user asked for more game modes. Wrote eight proposals around the confirmed
single-command participation model in docs/13-join-only-mode-proposals.md and
linked it from the current design. Recommended Coin Pusher, Marble Rally and
Tipping Buckets as the next three distinct physics experiments; other candidates
are Domino Dash, Junkyard Towers, Last on the Tray, Jackpot Drop and Bubble
Breakout. Each names the viewer's physical object and its visible win condition.

The proposal calls for consistent physical causes, readable progress, quick heats
for early eliminations, offline bots/solo testing, bounded bodies and deterministic
replay. Competitive races/heats queue late arrivals rather than teleporting them
ahead or granting unearned points. It explicitly distinguishes proposals from
implemented or approved games. No gameplay code or active lineup changed.
Validation: typecheck and all 121 unit/game checks pass; 15 expensive balance
checks remain opt-in. No new tests or browser runs were added for this proposal.

## 2026-10-24 · DESIGN-05 — MIKAN-style automatic simulation candidates

The user asked about MIKAN-type minigames. Reviewed available channel/video title
metadata and Physion's written Multiply or Release implementation explanation;
did not claim to have watched complete videos. Expanded the existing proposal
with seven original variants: Knockout Circuit, Ammo Foundry, Growth War,
Contagion Clash, Jelly Jam, Scrapbike Survival and Rolling Pursuit.

Recommended Knockout Circuit and Ammo Foundry for this direction: staged
qualification and a visible physical selector that builds/releases attacks.
Kept !join as the sole viewer input, with no forced streamer boss. Called out
actual structural/deformation effects, bounded ammo, visible machinery, identity
retention, and smaller rosters for articulated bodies. These are discussion
candidates, not built modes or changes to the active rotation. References and
the limits of the review are recorded in docs/13-join-only-mode-proposals.md.

Validation: typecheck and all 121 unit/game checks pass; 15 expensive balance
checks remain opt-in. No gameplay code, browser behavior or connectors changed.

## 2026-10-24 · DESIGN-06 — Seven automatic physics modes

The user requested all seven modes from the latest proposal. Built separate
plugins for Elimination Circuit, Multiply & Fire, Growth War, Contagion Clash,
Soft Marble Escape, Scrapbike Survival and Rolling Pursuit, each with its
definition, passive bot policies, README and balance contract. They join Color
Conquest in the default eight-game Cup lineup; eighteen earlier experiments stay
explicitly selectable. No Twitch connector was added.

Added shared join-only identity/admission logic, compound fixed scenery, physical
peg selectors with visible protected return lifts, destructible fort/tree parts
and bounded ballistic projectiles. The circuit has actual qualifying crossings,
two elimination stages and a final sprint. Contagion collects contact effects
before applying allegiance changes and preserves each viewer's name. Each jelly
has twelve skin particles plus a center and distance springs; each bike has a
chassis, wheel motors, prismatic suspension and a rider joint. Smaller caps of
twelve jellies and sixteen bikes reflect those assemblies, within 200 bodies.

All viewers use only !join. Offline bot counts reserve a place for YOU; zero-bot
rooms wait without spending their simulation clock. Race arrivals after five
seconds queue for the next round. The UI shows correct object/team/status text,
qualification markers, safe places and named individual champions. It omits the
old team-survival meters from individual races. Replays preserve immutable
starting rosters and timed arrivals, including articulated late-join bikes.

Mechanics checks caught real faults during development: blocked peg clearances,
self-contact locking bike wheels, sleeping motors, a skipped third jelly heat,
and a middle-stage gate that never cleared. Fixed the geometry and motor/contact
handling instead of accepting successful round termination as proof of play.
The first battle pilot exposed color/position and firing-order bias. Bays and
starting slots now shuffle from the seed, firing priority rotates, target orders
are per-team, and projectile arcs clear intermediate forts. Return transport is
protected so it cannot eject another team's selector marbles.

Final validation: typecheck and production build pass; **154 unit/game checks**
pass across forty files (fifteen expensive legacy balance checks opt in). The full
**46 browser checks** pass; all eight automatic join/solo checks pass again on the
final artwork build. Offline desktop/mobile walkthroughs exercise joining, live
motion, final results and layout. Final screenshots were inspected. All seven
modes complete **200 consecutive seeds each: 1,400 rounds**, no voids/timeouts,
non-finite assemblies or body overruns. Circuit and Pursuit produce actual finishers
in 200/200 runs. Bikes finish in 189/200, with eleven explicitly labeled progress
results at the bell. Jelly rounds execute all three heats and earn escape scores.
Twenty-one supported Fog/extreme-roster cases pass. Main reports now contain 35
game/mode rows; older unchanged catalog measurements remain identified.

Three actual browser-recorded rounds (jelly, bike and Multiply & Fire) replayed
their winner, highlights, champion, game scores/tags and MVPs. The strengthened
CLI deliberately excludes the bridge's wager-derived traitor tag, which is added
after simulation and cannot be reproduced from gameplay inputs alone. A separate
Director regression reproduces a real articulated late join exactly.

The focused 1920x1080 production rendering audit with 200 mock viewers, full
plugin participant caps and roughly 1500 visible particles measured 227.8–677.8
FPS uncapped; longest sampled frame 19.6 ms, zero page errors. A ten-round Cup
explicitly including all new plugins and repeated jelly/bike teardown retained
**26.09 MB** after garbage collection. These are capacity/cleanup measurements,
not OBS certification. Actual rules and deliberate proposal adaptations are in
docs/14-automatic-modes.md; measured reports are in qa/. Human pacing/replayability,
microphone mix and compressed-stream review remain open. Stopped the isolated QA
server after validation and left the user's development servers running.

### 2026-10-24 — REWORK-CIRCUIT-FOUNDRY: continuous cuts, larger machines and fair firing lanes

Responded to the user's playtest feedback that Circuit replenished/hid entrants,
felt slow and small, and had too little level variety; Multiply & Fire protected
the outside forts and destroyed the middle too quickly. Rebuilt Circuit as five
connected chambers in one world: pinwheels, pegs, sliding gates, real hinged
decks and a final drop. Qualified marbles remain visible on collectors; opening
floors carries the same bodies and momentum onward. Cutoffs only remove entrants,
never reset or spawn them, and only actual line crossers qualify. Increased marble
size, retuned gravity/contact damping, and moved the camera through active rooms.
Solo regression seed 219 exposed a ramp/deck wedge: removed those pinch pockets
and gently motorized the hinged decks instead of accepting a bell fallback.

Built a compact selector bank and an overhead polygon fort arena for Multiply &
Fire. Every enemy pair has a direct firing lane and equivalent physical armor.
Added larger cores, lane armor destruction, visible targets, viewer-owned FIFO
volleys, ammo retention on queue overflow and an automatic final overdrive. Mutual
destruction ends promptly and HP takes precedence over contributions at the bell.
Kept Growth War's existing selector/siege helpers separate. Both games retain only
!join; offline bots and solo admission work. Added Expand game / Show settings,
increasing the desktop canvas from 770 to 945 pixels high, with corrected mobile
wrapping. All graphics/audio remain procedural; no external assets were added.

Final mechanical audits: Circuit finishes physically in 200/200 solo runs,
200/200 sixty-player runs and 50/50 full 96-player runs. Continuous handle/state
checks find no suspended, relocated or resurrected survivors; the largest full
roster per-tick displacement is 33.8 px. Sixty-player mean duration drops from
57.7 s in the earlier build to 30.5 s. Foundry completes 200 four-team runs with
physical seat wins 60/47/41/52; all seventy ordered source/target pairs for two
through six teams reach the intended fort and symmetric firing fixtures produce
equal actual impacts/core damage. Twenty further full six-team runs stay within
157 bodies. Six Fog/extreme-roster cases pass. These are 670 final audited rounds
plus the modifier cases; exploratory pilots were superseded, not counted again.

Normal-speed production walkthroughs observed all five chambers, joins, complete
rounds and mobile layouts. Both browser-recorded rounds reproduce winner,
highlights, champion, contributions and MVPs. Fixed replay comparison to use the
JSON persistence format so omitted optional fields do not falsely fail; changed
causes, scores and MVPs still fail. The existing wager-derived traitor exclusion
remains explicit. Typecheck and production build pass; all 166 unit/game checks
pass across 42 files (15 expensive legacy balance checks opt in); all 48 browser
checks pass, including all 26 arenas at 1080p/720p.

The first ten-round cleanup measurement failed at 67.95 MB retained growth.
Heap snapshots traced the large buffers to renderer geometry rather than physics.
Cached marble bodies exceeded Pixi's automatic batching cutoff; eye changes could
borrow an arena-sized buffer for each body. Explicit shared batching fixes that
pattern. The identical stress/ten-round check now retains 17.12 MB, with
165.2/183.8 FPS uncapped, 10.3 ms longest sampled frame, roughly 1500 visible
particles and no page errors. Rechecked the entire browser suite because this
renderer correction affects other modes too. Reports and current rules are in
qa/circuit-foundry-review.md and docs/14-automatic-modes.md; older measurements
are marked historical. Human audience response, OBS compression and audio mix
remain operator review, not inferred from automated completion. Stopped only the
identified QA server; left the user's servers on 5173 and 4174 running.

### 2026-10-24 — PACE-CAPACITY-01: slower Circuit, first-come rooms and parked losing teams

The user liked the animations but found Circuit too fast, asked about large
audiences, and wanted defeated foundry teams to stop moving and turn gray. They
selected a configurable maximum per game with first-come admission, and asked
for suggestions for the next minigames. Preserved one viewer per admitted object;
did not implement shared squads or add new gameplay inputs.

Added physical exit gates to all five Circuit chambers, an eight-second hold,
1.5-second opening, twelve-second minimum chamber and 1.5-second cut telegraph.
Kept 60 Hz physics and survivor continuity. Current mean is 68.7 seconds rather
than 30.5. All 200 standard, 100 solo and 50 full-roster seeds finish physically;
no progress fallbacks. Peak full-roster budget is 135 bodies.

Added Player limit controls to dashboard cards and offline setup, bounded by each
plugin's safe cap. Fixed the old recent-activity roster policy: a FIFO queue now
retains join order despite repeated messages. Completed players move behind those
waiting, including across Cup starts. Late/full arrivals receive queue positions.
After lock, edited limits apply next round without evicting current players.
Queued viewers never create extra bodies or receive scores for an unplayed round.
Tests exercise ten thousand queued members, two thousand joins into a running
twelve-place room, and successive first-come groups across an actual Cup.

Foundry retirement clears return trips and salvos, freezes the team's paddle and
marbles, grays their bodies/labels, and removes survival credit. Gray objects keep
their original admission places; later entrants use a living team. A regression
parks a marble while it is inside a return pipe and verifies exact positions
while opponents continue. Main foundry outcomes remain stable over 200 seeds.

Typecheck/build pass; all 172 unit/game checks across 43 files pass (15 costly
legacy balance checks opt in), and the entire 51-check browser suite passes.
Normal-speed desktop/mobile walkthroughs observed all five chambers, actual
results and limit controls. Both saved browser rounds replay exactly. Six
supported Fog/extreme-roster cases pass. Updated current reports/READMEs and
marked earlier measurements historical.

Production stress with 96 admitted viewers and roughly 1500 particles measures
91.2/118.5 FPS uncapped, longest sampled frames 35.6/14.9 ms. A ten-round Cup
retains 11.41 MB after garbage collection with no page errors. The capacity sample
does not certify OBS compression/audio or audience engagement. Current rules and
measurements are in docs/15-audience-capacity.md and qa/pacing-admission-review.md.
Suggested Last on the Tray first, then Coin Pusher and Jackpot Drop; these remain
proposals in docs/16-next-minigames.md, as requested by the user's 'suggest' reply.
Stopped only the two verified QA servers and left development ports 5173/4174 up.

## 2026-10-24 — TEAM-EVENTS-01: fixed-team spectator machines

Implemented the approved split: community games retain named objects and FIFO
admission; spectator events use fixed equal machinery with no joining or audience
dependence. Converted Multiply & Fire and Growth War, and built Ammo Lab, Claw
Wars and Fortress Factory as plugins with passive bot policies, balance contracts
and READMEs. The default lineup now has six community games and five events;
eighteen older experiments remain opt-in. No live Twitch connector was added.

Separated spectator participation from join-only automation across the Director,
offline setup, HUD, dashboard and controller. Events start with zero participants,
ignore inputs, preserve community queues and run optional mock predictions.
Results contain team standings/integrity, without invented users, MVPs or personal
win tags. Actual standings supply Cup runner-up points. Saved integrity explains
last-core, bell and simultaneous-destruction results; held offline results say DONE.

Ammo Lab snapshots power/burst recipes into bounded physical volleys; size,
contact damage and armor penetration really change. Fortress construction
restores solid plates, repair respects HP/death and overdrive is announced.
Claw cranes use fixed grasp joints and kinematic hoists/rails, then release light
balls, heavy balls or steel bars into dynamic block towers. Captured speed/mass
contributes to bounded impact damage. An initial Growth War audit found only end
positions winning; replaced its horizontal battle with equivalent circular seats.
Final harvest stops endless branch replacement. Routine lane flashes replace
floating text spam; small effect rings are bounded/coalesced, and announcers clear
before results. All art/audio remains procedural; no external assets were added.

Fixed a finale edge case: in-flight shots can destroy the provisional winner,
so standings are evaluated at resolution. Added regressions for this, real
construction/repair, upgraded contacts, cargo lift/release/collapse, fixed counts,
ignored 10,000-viewer rosters and empty personal awards. Typecheck/build pass;
199 unit/game tests across 47 files pass (15 legacy CvS balance checks opt-in).
The 59-case full browser run passes, followed by 13 focused cases and eight final
event cases, including a new simultaneous-destruction fixture. A held-clock visual
check also passes. Normal-speed and six-team 1080p/720p captures were reviewed.

Final audits cover 200 consecutive seeds per event: 1,000 rounds, zero
voids/timeouts, every four-team physical seat winning in each event. Mean durations
are 41.0/65.5/50.7/61.7/64.2 seconds in the order above. Thirty Fog/extreme cases
pass, including two/six teams. Five fresh six-team browser records replay exactly,
including integrity/standings, highlights, winner and zero gameplay inputs.
Restarted the temporary bridge after the protocol extension to verify persistence
against the current schema; discarded an invalid browser load overlapping a build.

Six-team production stress samples with about 1,500 particles measure
209.3–476.6 FPS uncapped, longest 12.9 ms. A ten-round stress Cup retained 3.85 MB;
a final caption/integrity follow-up retained 4.47 MB over ten rounds, with no page
errors. Reports and current rules are in qa/spectator-events-*.md and document 17.
These measurements do not establish audience enjoyment, OBS capture quality or
audio balance. Future live Predictions remain optional work, explicitly excluded
from this build. Stopped only verified QA ports 4180/4181; development 5173/4174
remain running.

## 2026-10-24 — DESIGN-RESET-01: reject foundry variants and revise direction

The user correctly identified Ammo Lab and Fortress Factory as near-duplicates
of Multiply & Fire and rejected Claw Wars visually. The shared factory kit gave
them working mechanics but insufficient variety or appeal; the previous test and
performance results did not establish those product qualities. They should not
have been presented as three distinct, successful additions.

Marked all three experimental, removed them from initial random rotation and
the featured event selector group, and added rejected-prototype labels/banner.
Kept explicit preview/queue available for reference. Added isDefaultGame so
rotation eligibility is separate from automatic input behavior. Default lineup
returns to six community games plus Multiply & Fire / Growth War.

Revised document 16 around visible multiplication, buildup/release and physical
comebacks without hidden loser buffs. Proposed rebuilding the existing Plinko
experiment as Multiplier Cascade rather than adding a duplicate catalog entry,
and a separate population-survival Swarm Flood concept. Both remain proposals;
no replacement minigame was implemented or claimed complete this turn.

Typecheck/build and all 200 unit/game tests pass (15 legacy balance tests remain
opt-in). A focused browser check verifies only two featured events, three
rejected prototypes, the rejection banner and unchecked random-rotation toggles.
No physics changes, balance reruns or live Twitch work were needed. Existing
development servers remain running; no additional server was started.

## 2026-10-24 — CASCADE-01: rebuild Plinko as one multiplication prototype

Implemented the approved Multiplier Cascade proposal under the existing `plinko`
ID. It replaces manual Plinko votes/deflector/CvS with two to six spectator teams,
three equal-supply drops, actual ×2 / ×3 / ×2 ball splitting, ×1 routes, ×0 drains,
physical hold/release floors and +1 / +5 / +20 bank sensors. Parent bodies survive
splits; actual children form in clear ports. Only physical pocket contacts award
points once. Scores never influence spawning or physics. No viewer identities,
joining, boss controls or personal MVPs are invented. Swarm Flood remains unbuilt.

Added a separate Physics prototypes picker group and PROTOTYPE badge. The
experimental marker now distinguishes active prototypes from rejected work.
Cascade stays disabled in the unchanged eight-game default rotation. The catalog
still has 29 entries: eight defaults, one active prototype, three rejected
prototypes and seventeen earlier experiments. Added a points-based HUD/result
mode, exact BANKED totals, in-play counts, split rings, banking notes, visible
release cues, comeback announcements and final slow motion.

Early layouts failed clearance tests: some balls perched on dividers or caught
open floor edges, and kinematic motors could sleep. Corrected the physical
geometry and motor waking, rather than crediting stuck balls or applying private
winning nudges. Compound moving peg geometry now renders its actual translation.
Adaptive supply is three seeds for two/four teams and two for five/six, bounding
the theoretical peak at 193 bodies inside the declared 200-body cap.

Current audits cover 200 consecutive four-team seeds and 50 six-team seeds, with
zero expiry, timeouts or physical bank/birth/loss ledger failures. Mean durations
are 72.9/72.8 seconds; observed body peaks 118/158. In 64/200 four-team rounds and
26/50 six-team rounds, the final winner trailed after drop two. Seed 1 shows Gold
recovering from 231–302 against Blue to win 432–408. Those are observed outcomes,
not scripted reversals or a guarantee. A score-change regression preserves the
same seeded paths and splits.

Typecheck/build pass. Full Vitest: 208 tests pass across 48 files; fourteen older
CvS balance checks remain opt-in. Eleven focused browser cases pass, including
API-blocked offline play, no sockets/users/controls, pause/restart/expand/mobile,
six teams, default exclusion and mock Cups. The browser audit caught and fixed a
duplicate prototype option. Prediction checks were corrected to wait for terminal
updates and permit the existing refund when nobody backed the winning team.
Normal-speed 1080p and six-team 720p captures were inspected. Fresh four- and
six-team browser records replay exactly with empty input logs and personal awards.

Six-team production stress: 131.4 FPS uncapped at 1920×1080, longest frame 12.8 ms,
127 bodies and 1,489 particles. Ten Cascade rounds retain 5.20 MB after collection,
with zero page errors. Rules and reproducible reports are in the plugin README,
document 16 and qa/cascade-*.md. Human enjoyment, pacing, sound mix, sustained OBS
capture and compression review remain pending; automated checks do not promote
the prototype. No real Twitch connector or external asset work was added.
The corrected Cup settlement cases also pass in a final two-case rerun. Stopped
only the verified QA server on 4180; the user's 5173/4174 development services
remain running, and the direct offline play URL returns HTTP 200.

## 2026-10-24 — CASCADE-02: larger scrolling course and physical machinery

The user found the compact Cascade scene too small and physically sparse. Replaced
the parallel team boards with one shared shaft spanning 3,360 world pixels, over
five times the previous board height. Increased ball radius from 11 to 20 pixels.
All team colors now collide. Added two crossed paddle wheels, two dynamic hinged
seesaws with weak motors that respond to real marble weight, two crossing sweepers,
angled ramps and large bumpers. Three real collector floors release at 7.5/15.5/24
seconds. Equal supply, multiplication, actual pocket banking and three-drop team
scoring remain; there are still no viewers, joins, controls or Twitch dependencies.

The camera now follows the crowd downward through a 590-pixel window at a bounded
220 world pixels/second, preserving a close view instead of shrinking the whole
shaft. Added a shared removable screen-space mask for world/effects/world labels,
after the first visual pass exposed scenery behind the HUD. Current chamber names,
open-chute labels and forming-ball counts stay readable. Machinery and physics
live in focused plugin modules; the catalog still has the same opt-in prototype.

The six-team audit found one suspended ball in seed 46, drop two. A trace showed
that it remained asleep after its kinematic support floor swung away, even though
the floor was visibly at the wall. Waking sleeping marbles lets gravity resume;
it changes no position, velocity or applied force. Added that seed to full-round
regression coverage. Also tested actual cross-team contact response, a bridge's
loaded/empty tilt difference and bounded monotonic camera progression.

Reran the affected audits after the sleep fix: 200 four-team seeds, 50 six-team
and 50 two-team seeds all finish with zero expiry, timeouts or bank-ledger errors.
Mean durations are 98.0/97.5/97.2 seconds, measured body peaks 136/146/80. The
theoretical maximum is 144 balls plus 16 machinery bodies = 160, below the declared
200 cap. Final winners trailed after drop two in 72/18/8 rounds respectively;
all physical seats win. Seed 3 has Red recover from 116 versus Mint's 145 to win
232–190. Every four-team run records real wheel, seesaw, sweeper and cross-team
contacts; those are measured interactions, not cosmetic animations.

Typecheck/build pass. The final full suite passes 212 tests across 48 files, with
14 older CvS balance checks opt-in. All three Cascade browser cases pass, covering
offline API blocking, no users/controls, camera progression, pause/restart/expand,
mobile, six teams, prototype exclusion and a mock Cup. A fresh four-team browser
record replays exactly with zero inputs. Normal-speed and six-team 1080p/720p
captures were inspected; the closer final framing leaves the HUD clear. Updated
the rules, README and QA reports to replace compact-board claims. Human enjoyment,
OBS capture, audio mix and compression review remain pending; the prototype stays
out of default rotation. No live Twitch connector or external asset was added.
Final six-team production stress sample: 232.7 FPS uncapped, 6.5ms longest frame,
96 bodies and 1,492 active particles (the playfield mask clips off-window effects).
Ten Cascade rounds retain 4.50 MB after garbage collection, with zero page errors.
A fresh six-team record also replays exactly. Stopped only verified QA port 4180;
the user's 5173/4174 services remain running and the offline play URL returns 200.

## 2026-10-24 — PROTO-BATCH-01: parallel physics prototypes and Ring rebuild

The user explicitly authorized parallel agents for the proposed modes. Delegated
isolated plugin folders, mechanism tests and audits for Swarm Flood, Coin Pusher
and Last on the Tray; kept the Ring Escape rebuild and shared integration in the
parent. Reused the Tray agent for central documentation and an independent
read-only review. No agent changed shared code concurrently. Three new entries
plus one replacement bring the catalog to 32 entries:8 defaults, 5 active prototypes,
3 rejected prototypes and 16 earlier experiments. All new work remains opt-in;
the default 8 are unchanged. Cascade's engagement/wording polish stays deferred.

Swarm Flood uses a large shared basin, actual contact-triggered children, moving
splitters/lifts, neutral telegraphed drain doors and equal resupply offers. Real
surviving bodies determine the winner; caps are 32/team or 24 with five/six teams,
with a 153-body theoretical ceiling. Coin Pusher uses opposing physical plates,
staggered shelves and a rigid-token pile. Tray uses a real weight-responsive
revolute deck, retracting guards, staggered bumper lowering and actual falls.
Ring now has five actual rotating compound rings, one named body per viewer,
real gaps and public panel retraction; boost/jump/reverse/CvS are removed.
Tray and Ring admit 96 named players; Swarm and Coin need no joining or viewers.

Integration review found and fixed final-tick scoring omissions in both team
events: actual drain/tray contacts now flush before winner selection. Coin
captures collision time/tick, keeping point valuation independent of when its
queue is processed. Independent review found Ring's same-tick roster-order
bias and final-target-tick progress gap. Root now resolves all post-physics
crossings with segment/circle fractions, seeded exact ties and explicit boundary
tests. Every Ring champion retains one rigid-body handle through all five rings.

Watching and audits changed Coin's design. Sparse feed gave a thin pile and 122/200
tied four-team finishes. Denser equal two-row feeds sustained about 43 coins at 42s
and more stacked overhangs, but one-point scoring still tied 84/200 and most
six-team trials. Added a public neutral tray window:1 point normally, 3 points
from 8.5–11s of each 12s cycle after a 1.5s warning. It uses actual contact time,
never losing-team state. Physical collected counts and point totals are separate.
Final four-team ties fall to 23/200; six-team 20-seed trials tie 4 times. This is a
deliberate rule adaptation, not a hidden boost or fabricated physical population.

Final primary audits cover 200 consecutive seeds per mode, 800 rounds total, with
zero cap/ledger/completion failures. Swarm averages 85.02s, peak 128 bodies,
106 outright deficit-at 70s wins and 8 ties. Coin averages 90.02s, peak 95 bodies,
41 outright deficit-at 60s wins and 23 ties. Its physical ledger is 66,400 supplied
=61,839 collected+4,514 left+47 actual losses; points are 68,099=61,839+2×3,130 bonus
entries. Full 96-player Tray averages 68.8s, peak 98 bodies, 95 real falls then a
last-standing winner in every run. Ring averages 72.0s, peak 101, all actual
five-ring finishes, including rare fast chains (15.9–75.1s). Solo/capacity
matrices also pass; the mode-specific reports preserve their actual sample sizes.

Generalized scoreDisplay HUD metadata to ALIVE/BALLS and collection POINTS with
correct result reasons. Prototypes appear once, start unchecked in the dashboard
and are excluded from featured default groups. Visual fixes remove clipped
duplicate counters, reserve heading width and move no-wager text away from
the arena/fall feed. Original procedural coin badges remain upright while their
rim shows actual rotation. All art/audio remains original/procedural.

Typecheck/build pass. Final full suite:255 tests across 55 files pass;13 legacy
CvS balance checks remain opt-in. A 42-case browser pass covers all 32 arenas,
old controls, mock Cups and prototype integration. The final six-case prototype
suite passes after scoring/fairness changes. Normal-speed 1080p/720p frames were
inspected. Fresh six-team browser records for all four modes replay exactly,
including winners, standings/champions and highlights, with zero gameplay inputs.
The old manual-wheel Director fixture now uses Crusher Run because automatic
Ring correctly skips voting; both flows retain coverage.

Initial profiling saw one 92.9ms Tray frame and missed a Ring 35s sampling point
when a round ended early. The harness now supports per-game ages and collects
prior-page garbage before capacity samples. Controlled samples measure 133.9–150.2
FPS, longest 15.0–22.5ms, with about 1,500 active particles and up to 101 measured
bodies. A ten-round mixed Cup retains 14.72 MB after collection with no page errors.
These are rendering-capacity measurements, not a claim that OBS has no GC/frame
spikes. Operator audio/compression checks and audience enjoyment remain unproven.

Updated rules/README/QA reports and canonical simulation rows; rejected Coin
calibrations remain labeled historical. No live Twitch connector or external
asset work was added. Stopped only verified QA port 4180; user services 5173/4174
remain running. All four direct offline URLs return HTTP 200.

## 2026-10-25 — PHYSICS-REVIEW-01: structural revisions after user rejection

The user rejected the previous Swarm basin, two-shelf Coin cabinet, inactive
Tray and gravity-pooled Ring. Kept those four entries rejected/awaiting review
and outside the default Cup. Catalog status is now eight defaults, one active
prototype, seven rejected designs and sixteen earlier experiments. Prior test
totals remain historical rather than being reused to claim these versions work
or are entertaining. Reused the three explicitly authorized agents for isolated
Swarm, Coin and Tray revisions; root rebuilt Ring and integrated/reviewed the
results. Tray's agent independently reviewed Ring collision and final-tick logic.

Swarm is now one pressure-driven flood: a loaded hinged dam physically strikes
a fork, multiplying branches load a counterweighted relay, crowds spill and
later lighter groups can cross. Local child formation/cancellation keeps the
physical ledger honest. Reworked the long initial shaft into a connected,
readable fork/relay view. Nine current two/four/six-team traces clear in
24.2–35.7 seconds with no recorded cap/ledger/contact-visibility failures. Four
population ties remain announced, seeded ties. This is a short review slice;
all-zero or unresolved flows explicitly void instead of inventing a winner.

Coin now has four pressure terraces, a gravity-driven rocker and two loaded
tipping pans. A fixed raised gold collector pays three points; the old clock
bonus is removed. Dense, clearance-checked stock and equal whole-team feeds
replace thin two-row arrivals. Thirty current rounds have no ledger/spawn/cap/
inactive-pan failures. Three of twenty four-team winners trailed at 60 seconds,
but pauses, unequal branch traffic and unscored retained stock remain limits.
The initial stress check failed at 50 FPS. Shared batched team-face geometry and
rotating rim instances replace per-frame token rebuilding without changing any
physics, RNG, supply or scoring. Four render regressions cover shared resources,
cleanup, interpolation, sensor removal and exact rendered/headless RNG parity.

Tray now transfers a real sliding ballast's weight through a prismatic joint
under its hinged deck. Soft centering permits visible crowd/ballast tilts and
reversals immediately; guards retreat from 6.5 seconds instead of 36. Actual
post-physics fall fractions resolve simultaneous and final-tick outcomes, and
an already falling sole survivor must finish its fall. Sixty solo/default/full
traces resolve physically with no bells or invariant failures. Means are
25.2/29.5/30.3 seconds; this short loop is not padded into a full-length round.

Ring now uses zero gravity, five continuous oval boundaries and shared unique
escapes that crack each barrier. The next real opening unlocks only when the
previous barrier shatters; first out of the final ring wins. All entrants keep
their bodies and eligibility. Reduced its ceiling to 64 readable marbles.
Investigating physics exposed restitution energy growth at overlapping panels
and missed glancing contacts from end-position normals. Rapier handles CCD,
positions and contact candidates; swept contact-time elastic responses preserve
energy and momentum without adding propulsion. Resolve motion before final-tick
wall removal. Independent review and targeted head-on/glancing/nub/near-miss,
clearance, unique-contributor and energy regressions cover those fixes. Final
ten-seed matrices at one/24/25/64 entrants have 39 physical final escapes and one
explicit solo most-progress bell. All thirty multiplayer races escape; means
are 61.9/61.9/57.9 seconds. Solo uses visibly labeled wider gaps.

A second real bug invalidated earlier browser physics evidence: long-running
Vite served optimized Rapier 0.19.3 while installed/headless/production used
0.21.0. Excluded the pure ESM physics package from optimization, exposed
`window.__chaos.physicsVersion` and added a browser/Node version regression.
The user's development process remains running with 0.21.0. Fresh Swarm browser
replays match all 23 sampled actor poses exactly. Fresh joined 64-player Ring
and 25-player Tray normal-speed recordings replay their complete results exactly,
including their ordinary join input. Names are capped and no-wager banners sit
below the arena. Documentation and QA distinguish these revisions from their
rejected predecessors. No external assets or live Twitch connector were added.

Final build/typecheck pass. The complete final suite passes 285 tests across
56 files, with 13 older CvS balance checks skipped by their existing opt-in policy.
All seven final prototype browser cases pass, alongside the eight unchanged event
cases already checked. Four fresh six-team Cup results replay exactly: Swarm
29.10s, Coin 90.02s, Tray 31.00s and Ring 59.02s, with zero gameplay inputs.
Canonical copies are preserved outside rotating QA retention. The earlier Tray
before/after videos use stale 0.19.3 and are now explicitly historical; current
normal-speed root captures and exact replays use 0.21.0. Audience engagement,
audio/compression review and sustained OBS capture remain unproven.

The final clean six-team 1080p production stress run measures Swarm 115.1 FPS,
Coin 134.6, Tray 85.7 and Ring 109.5, with about 1,500 active particles and a
35.2ms maximum frame. Body counts are sampled observations (47/99/97/87), not
forced theoretical caps; community rosters are 96/64. Ten mixed rounds have
zero page errors, no voids/bell fallbacks and 6.04 MB retained heap growth after
collection. All samples use Rapier 0.21.0. Final notes and current capture links
are in `qa/physics-redesign-review.md`; older central batch reports are labeled
historical. Automated success leaves all four revisions awaiting human review.

Stopped only verified QA listeners 4180/4181 after validation. The user's
5173/4174 processes remain running, and all four direct offline preview URLs
return HTTP 200. A final independent read-only source/report audit found no
remaining material discrepancy in caps, mechanics, evidence or promotion status.

## 2026-10-25 — DRAMA-RESET-01: suspense as the design gate

Read doc 18 as the new authority. Revoked the earlier no-director/no-impulse
constraints and stopped using mechanics totals as design acceptance. Split the
two plugin rebuilds and measurement/capture tools across the three authorized
agents; root owns integration, the five-game cut, shared presentation and review.

Implemented `npm run drama`: nine explicit metrics, failure exit, seeded runs,
real event qualification and 300-seed faction fairness. Chose and documented
strict aggregation before baseline capture: worst-run bursts, minimum per-round
near misses, one-second lead debounce and geometric near-miss survival/hysteresis.
The configured target is fixed rather than fitted to actual round duration.
Saved unchanged Ring/Tray source, then measured each over 200 pacing runs and
300 fairness seeds. Ring fails four drama metrics; Tray fails six. Their
immutable baseline reports are `qa/drama-baseline-{ring,tray}.md` and JSON.

Cut the active catalog from 32 to five candidates. Moved the other 27 folders,
including Swarm Flood/Coin Pusher, and obsolete tests/tools to root `archive/`.
Retained Circuit, Multiply & Fire and Cascade without claiming they were retuned.
Ring Run/Hot Plate stay opt-in. Added full-frame presentation, readable radius
floors, outside kill feed/depth ladder, larger final names and transient slow-mo.
Individual/team victory rules are explicit in offline setup and replay data.

The first new runs exposed real design failures: moving narrow Ring gaps outrun
radial transit; packed Hot Plate riders transfer sideways momentum along a row.
Visible regional jets/steam let actual bodies clear those interactions. The
controllers use aggregate counts/density/position, with bounded pressure updates.
Tuning continues against the fixed metrics; no winner is selected by identity.

Capture tools preserve a full normal-speed round with game-only procedural audio
and payoff, plus a nominal 60-second preview. Twelve frames use exact timestamp
seeks; the three-line beat log labels video/game clocks separately. Tiny-clip
tests caught and fixed a misleading mid-bin frame extraction. Final acceptance
batches, normal-speed viewing artifacts and final engineering checks remain.

## 2026-10-25 — DRAMA-RESET-02 — gate and capture audit (in progress)

Ring Run passes 200 pacing runs and 300 fairness seeds: duration median 61.950s,
quiet median 2.917s, worst burst 0.238, curve error 0.054, pre-win final contest
8.267s, lead median 3 with a change in 99% of runs, minimum 25 qualified misses,
and zero reliability failures. A separate 200-seed physical audit records every
outer escape in 54.620–63.030s; 97% retain two OTHER bodies in rings 5–6.

The first recording caught a real camera failure: an inner straggler displaced
the decisive outer escape offscreen. A presentation-only action camera now
frames the exit, the approaching outer contender and nearby rivals. The revised
seed-1 recording, twelve-frame sheet and three-line log are in
`qa/drama/ring-run/`. The full movie includes replay and five seconds of payoff;
the nominal 60-second clip includes the result. The earlier offscreen movie is
preserved as a failed iteration.

Audits tightened the reporter to stop finalContest at the physical win rather
than publication, exclude solved contacts from misses, and require all requested
entrants. Both immutable baselines retain exactly the same contest values.
The metric thresholds were not relaxed. Saved-report validation rejects partial
or duplicate seed collections. Source-verified pacing data can be combined with
the remaining fairness seeds through the same reporter functions.

Ring rendering samples pass at 64 admitted players plus 1,500 stress particles:
127.8 FPS early and 197.8 FPS with late replay capture, longest frame 19ms.
Ten accelerated rounds retain -0.33MB; ten actual normal-speed rounds with image
replay retain +1.40MB, clear every replay buffer and report zero page errors.

Hot Plate is NOT accepted yet. Full batches exposed mass falls, too few real
misses and late voids. Contact/clearance audits also removed inflated events.
Locked regional forecasts, real rebound materials and visible steam geometry
now produce more return traffic. Current tuning addresses the remaining strict
minimum-per-round near-miss failures. The source-level geometry cache was checked
against identical result/position/raw-event hashes on three seeds, cutting their
headless time roughly in half. Independent material probes are read-only and
are not acceptance evidence. A provisional normal-speed movie is preserved under
`qa/drama/iterations/hot-plate-floor075/`; it is not the final delivery.

An earlier frozen candidate passed TypeScript, 192 tests and all eight browser
checks, including offline/API-blocked launch, ordinary local-player identity,
mock prediction settlement and exact browser/headless replay. Current Hot Plate
changes still need their complete gate, final recording and integrated checks.
Neither rebuild has been promoted to the default Cup or declared fun by metrics.

## 2026-10-25 — DRAMA-RESET-03 — completed gates and review delivery

Finished Hot Plate against the unchanged drama thresholds. The frozen default
24-player revision passes 200 pacing runs: duration 69.608s, quiet 3.300s, worst
burst 5/23, curve error 0.095, pre-win contest 8.758s and a minimum of six actual
qualified misses in every run. All 300 fairness seeds completed with red/blue/
mint/gold shares 23.7/25.3/26.0/25.0%, zero voids, errors, timeouts or invalid
telemetry. The retained first 200 traces and remaining 100 use the same canonical
reporter and verified source hashes, not a changed metric or selected seed set.

The last tuning changes retained separated two/three-pad groups through five
survivors and mixed return/risk throw ranges at warning time. Active steam now
physically drifts, blooms and rises with its visible wisps; it is not a cosmetic
near-miss detector. Every new actuation requires its own actual active approach,
retreat and no solved contact, with one bounded current record per pad/actor.
An independent audit checked that shot identities represent real warned fires,
not relabeling continuous proximity. Earlier failed batches remain preserved.

The 200-seed first-four median is still 59.008s, later than the intended 48–55s
beat. This is disclosed in the plugin README and review. It is not a formal
metric failure, but remains a viewing limitation; the aggregate pass is not a
claim of audience enjoyment. Boundary tests establish mechanics, not equal drama
for solo, 64-player or every team-count field.

Captured the final production source at normal speed, with procedural audio:
Ring Run seed1 and Hot Plate seed2 each have a nominal 60-second WebM, full round
with replay/five-second payoff, exactly twelve timestamped frames, the drama
table and exactly three beat-log lines. Ring's result appears at video59.85s;
Hot's physical decision is at59.98s and publication61.07s, so its preview ends
before the result and the full companion is explicit. Both final decisions,
actual image replays and payoff were visually checked. No HMR bundle was used.
The handoff is `qa/drama-reset-review.md`, with immutable baselines linked.

Final runtime passed `npm run typecheck`, all27 active Vitest files,
`npm run build` and all8 Playwright tests, including exact browser/headless
replay, offline/API-blocked play and mock prediction settlement. Final capacity
samples pass for the rebuilt games at64 admitted players: Ring94.0FPS/26.9ms,
Hot93.8FPS/40.9ms; late Hot with actual replay capture passes189.8FPS/18.9ms.
The mixed ten-round Cup retains5.09MB with zero page errors. The overall five-game
capacity check fails honestly: retained Circuit has a395.1ms frame. Circuit was
not retuned here; that observed hitch remains separate work. Ring's independent
ten-normal-round replay check retains1.40MB and clears every replay buffer.

The active selector has exactly five candidates. Swarm Flood, Coin Pusher and
the other removed plugins remain in root `archive/`, outside selector/Cup imports.
Live Twitch connectors remain excluded. Ring Run and Hot Plate stay opt-in,
pending the user's viewing approval as required by doc18. No further bookkeeping
was added as a substitute for their physical loops. Only the temporary root QA
server is stopped; the user's5173/4174 development services are left running.

## 2026-10-25 - FEEL-LOOP-01
Moved Ring v3 unopened to archive/ring-escape-v3; built v4 fresh in about 400 readable TS lines.
Fixed full-height neon ring stack, elastic zero-gravity balls, 25-position glow trails and motion-tied pentatonic audio; no jets, burns, zoom, replay or slow motion.
Added npm run frames: real 1080p /play capture, 20s WebM with audio, 2/6/12s stills and a ten-frame sheet. Reopened all refs and final frames; review.md records all seven comparisons.
Self-review caught a gap-covering flash and stray cap-path connectors; corrected both and added the empty-corner screenshot regression.
Added a worker best-take search (up to 24 candidates, six-second budget), blind watchability scores, stale-search cancellation and scores in round results; selected seed/setup replay exactly.
Final capture: seed 1 selected from eight completed takes; chosen duration 42.417s is below the 45-90s preference and retains that score penalty. No duration gate or hidden physics help was added.
Checks pass: TypeScript, 181 unit tests and four browser checks. Final media is qa/frames/ring-escape/20s.webm; Hot Plate was not retuned.
Left: user approval before faction victory; live Twitch submission connectors remain outside this rebuild.

## 2026-10-25 - LINEUP-STEP0-BLADE
Extracted kit/neon: palette12, glow/trails, round strokes, audio, sparks, contact stop, side HUD and label placement.
Built Blade Brawl Boss/FFA/Faction with elastic Rapier bodies, four scaling weapons, actual swept parries, recoil, shrinking wall and readable central HP.
Real20s capture,3stills,10frame sheet and720p check are in qa/frames/blade-brawl; review records7style checks plus HP/contact attribution.
TypeScript/build and193unit tests passed before the parallel lineup integration.
The600raw-seed Boss test FAILS one linear HP multiplier; source hashes and every run are retained in qa/blade-boss-balance.json.
Proposed population HP curve projects50/48/50percent at8/16/32; changing doc20's one-constant rule awaits the user's explicit design choice. No hidden outcome correction.
Started the requested3isolated game threads after kit, implementation and capture; root owns shared integration and retirement of older games.

## 2026-10-25 - LINEUP-BOSS-CALIBRATION
The single linear Boss multiplier could not fit8/16/32 under uncapped weapon growth; I asked a design-preference question, then prioritized fair rounds as a reversible local tuning decision.
Published round(92 * viewers^0.55) in config, README and doc20, giving289/423/619startingHP. No motion, seed selection, damage or outcome corrections depend on identity or wagers.
The final source-frozen600actual rounds pass:100/200,96/200,100/200 Boss wins; zero voids and escapes. Raw runs and unchanged source hashes are in qa/blade-boss-balance.json.
This deliberately changes the original linear-form requirement; it is documented rather than disguised as an unchanged120-times-player rule.

## 2026-10-25 - LINEUP-PONG
Built Pong Wars in an isolated parallel thread using kit/neon: swept tile contacts, fixed ball supply, rotating names, equal reinforcements and final sprint.
All900 raw rounds pass fairness at2/3/4teams, including honest ties/refunds; spatial generation and independent seeded streams remove team-label dependence.
Three teams start with133tiles each plus one neutral tile. Names never affect physics; large fields may finish before every name rotates onscreen.
Reopened all6refs and reviewed real2/6/12stills, sheet and normal20sWebM; late diagnostics verify30/45/50/55/60s behavior. MIT credit retained.

## 2026-10-25 - LINEUP-RING-PLUS
Upgraded v4 with actual Rapier radius growth, red-contact pops, pulse warnings, ring acceleration and gold/octave finale; no jets or hidden assistance.
Added FFA/Faction victory, deepest/earliest all-pop fallback and common small-team escape target.20focused/regression tests passed.
Reopened all6refs; seven-point review, normal20sWebM,3stills and10frame sheet are in qa/frames/ring-escape.

## 2026-10-25 - LINEUP-RACE-CASCADE
Built seeded four-screen Marble Race with all requested physical modules, fixed-zoom leader scroll, FFA first finish and faction top3averages with visible DNF treatment.
Restyled existing Cascade mechanics with shared neon and plain drop totals; preserved its approved slow scroll at constant0.8 as documented exception.
Frame review fixed Race label clutter and Cascade initial scale;30fps capture removed Cascade's midclip encoder stalls without altering game timing.
Both clips have audio,3stills,10frame sheets and7point reviews. In-page render measurements were57-60fps; startup encoder gaps are documented.

## 2026-10-25 - LINEUP-INTEGRATION
Selector/catalog now expose exactly5games. Moved Hot Plate, Circuit, Multiply & Fire and old Plinko plus obsolete tests/tools to archive/lineup-retired.
Offline formats/bots/capacity, optional names for fixed-supply Pong, constant camera scales and live team-count limits are integrated. User development services remain running.
Final TypeScript/build,158unit tests and9browser checks pass, including selected-seed replay, all5offline views,0viewerPong and ordinary YOU admission.
Boss actual600-run gate passes50/48/50%; Pong900-run fairness passes. All5normal20sclips and reviews live under qa/frames/<id>/. No live Twitch connector work was added.

## 2026-10-26 - Doc 21 step 0
- Created snapshot 6c8feeb before implementation; ignored dependencies, environment secrets and local data. Baseline typecheck and 158 tests passed.

## 2026-10-26 - Doc 21 step 1 / Part A
- Profiled 32-fighter Blade before changes; saved Chrome traces and longest-frame tables in qa/frames/blade-brawl/perf.md.
- Added universal weapon caps, 180px/s motion, bounded impact travel, unchanged attackers, pair parry cooldown and kill-only freeze; batched trails/FX and cached numeric glyphs.
- Rebuilt five-ring spacing/hazard timing, mirrored Pong specials, and the monotonic third-place race camera; expanded the physical race course for longer rounds.
- Reviewed normal-speed WebMs/stills for all four games. Typecheck and 172 tests passed; race camera passed 200 actual seeded courses.
- Boss HP uses only one constant (55). Actual 200 seeds each: 8/16/32 chatters = 68.5%/54%/34%; the required all-population balance gate remains unfinished and is reported as FAIL.
- Final controlled Blade trace after loading warmup: max frame16.9ms / callback10.762ms, zero over20ms; cold and concurrent-load outliers remain documented.

## 2026-10-26 - Doc 21 step 2 / Part B
- Built the shared five-round Cup: placement/faction points, 8s animated standings, top-eight Blade FFA Grand Final and survivor-defined champion.
- Added server profiles.json persistence with stable colors, wins/Cups/XP/levels/titles, deduplicated awards, crown badges, returns, +3 dethrones and rivalries.
- Added 6s intro/outro cards, shared physical stage/checkpoint labels, eight original three-layer procedural scores and common short-round take penalties.
- Replaced Cascade's scrolling shaft with a full-size fixed physical machine; preserved multipliers/pockets/supply/three drops, audited96-106s and155/200 peak bodies.
- Refactored the director into readable focused modules. Fixed delayed joins from departed mock viewers and added Cup standings to the dashboard.
- Typecheck and182 tests pass. A real five-round browser Cup verifies four standings screens, top-eight admission, final survival and persistent champion; reviewed the actual screenshots.
- Added tools/capture-cup.ts for the final normal-speed Cup recording after eight-game integration. Live authenticated testing remains the user's later handoff.

## 2026-10-26 - Doc 21 step 3 / Part C
- Added isolated neon Light Cycles, Floor is Falling and Eat Arena plugins with automatic deterministic play, bots, README files, headless tests and watchability-only take scoring.
- Light Cycles uses a160x160 solid-trail grid, simultaneous crashes, real3s trail clearing,40s speed-up and70s closing walls; canonical selected rounds91-98s.
- Floor uses96 physical supports, exact0.8s crumble deadlines and ten drawn moving springs. Two first-come entrants preserve individual fates and97-115s selected rounds without hidden assistance.
- Eat Arena transfers conserved mass on actual60%-area overlaps; visible growth slows the leader, with three music stages and a90s finish.
- Integrated all8 offline views, two-name Floor wagers, shared profiles/crowns/stages and an honest FINAL clock label past the target duration.
- Generated and personally reviewed all8normal20s WebMs, stills/sheets against all6refs; refreshed the first4clips with the shared show layer.
- Recorded a716.58s normal-speed five-round Cup with4eight-second standings, top8FFA final and persisted survivor champion; reviewed actual video extracts.
- Typecheck,232unit/simulation tests, production build and13production-browser checks pass, including all8offline views,3new exact-result replays and a full Cup. Boss population balance and authenticated Twitch test remain the stated exceptions.

## 2026-10-26 - Doc 21 step 4 / Live Twitch
- Added Twurple8.2 OAuth with server-only token exchange/refresh/persistence, cookie-bound expiring state, sanitized callbacks and hourly validation.
- Wired real EventSub !join plus all4Prediction events, reconnect/revocation handling, broadcaster eligibility and native create/lock/resolve/refund.
- Durable app-owned prediction jobs preserve outcome IDs, round IDs, payouts and1/3/9s retries across restart; manual predictions stay untouched and failures leave the game running.
- Added Connect Twitch dashboard status and a Windows-compatible dev:live command; preserved mock defaults, offline play, Cup profiles and standings.
- Verified18connector tests through the actual SDK against local OAuth/Helix/WebSocket fixtures, without authenticating or sending external chat/predictions; reviewed both dashboard modes.
- Final typecheck and232unit/simulation tests pass again before this commit; production build and13browser checks also pass. All8clips and the full716.58s Cup recording are in qa/.
- Authenticated live channel/native-point testing is deferred to the user as explicitly requested; .env.example, README and docs/03-twitch.md contain the setup. Boss8/32population balance remains the separate PartA failure.

## 2026-10-26 - Doc 22 step 1 / Natural endings
- Replaced clock verdicts with visible physical sudden death at 150s in retained survival/escape games; the shared director never times out a live game.
- Marble Race now waits ten seconds after its first real finisher, with an actual podium and finished count; 200 real courses pass the monotonic camera audit.
- Only Pong Wars and Cascade show the last-ten-second countdown; Cascade scores actual pocket totals at its 120s deadline.
- Rebuilt npm run frames as still-only capture, reopened all six game sheets against the references, and refreshed seven-point reviews. No videos recorded.
- Typecheck and all 242 tests pass, including physical geometry, replay and clock checks. Existing Boss population balance and user-deferred authenticated Twitch test remain open.

## 2026-10-26 - Doc 22 step 2 / Shared hype
- Added deterministic hype events, capped live slow motion, brief camera emphasis, throttled callouts, per-actor combos and pooled win/jackpot feedback.
- Wired the six retained games to actual physical feats; enabled/silent comparisons preserve trajectories, results and RNG, including golden Race/Cascade fingerprints.
- Added anonymous final-third jackpot/near-miss take bonuses and a two-second arena payoff before shared outro cards.
- Forwarded actual Twitch emote fragments and raw pre-limit message batches; bounded side-column rain uses original fake emotes offline and reserves title/top standings space.
- Refreshed still-only visual reviews; no videos recorded. Verification is captured in persistent qa/checks logs; bounded heap/single-Wasm compilation avoids local allocation failures.

## 2026-10-26 - Doc 22 step 3 / Lineup cuts
- Moved Floor is Falling and Eat Arena to archive/doc22-cut/; removed their live registry, selector metadata, stage and music entries.
- Replaced the retired Floor wager test with the retained Grand Final named-outcome check and updated offline browser expectations.
- Preserved archived source/history and existing viewer profiles; active Cup draws use only the retained lineup.

## 2026-10-26 - Doc 22 step 4 / Four reaction games
- Built Peg Fever, then Hot Potato, Spinner Showdown and Tower Topple as isolated neon/hype plugins with offline bots and natural physical endings.
- Added exact peg claims/combos/free balls/bonus slots, contact-preserving bomb fuses and shockwaves, real sweepers/falling support, and material towers with equal seeded artillery.
- Wired all ten games into shared stages, original three-layer music, Cup selection, profiles and crown; kept mock mode the default and Twitch secrets server-only.
- Peg take selection counts real board contacts, not launches, and rejects long empty searches; emotes use reserved outer gutters and combo text has a separate header slot.
- Added fixed-step mechanics, replay, body-budget and genuine simultaneous-draw tests; final stills and production Cup checks use no videos.
- Tower's unselected 300-seed audits per team count record actual outcomes and source hashes; earlier failed rubble cases remain preserved for review.
- Final typecheck and 333 tests pass; 11 production browser checks verify all 10 offline views, exact replays and a full Cup with profiles/crown/mock Predictions. All 900 Tower audit rounds naturally end within the uniform budgets and pass fairness; rubble pacing, prior Blade Boss balance and user-deferred authenticated Twitch testing remain disclosed. No videos recorded.

## 2026-10-26 - Doc 22 revision step 1 / Join-only chat
- Deleted emote rain, the CHAT HYPE meter, fragment schemas/mapping, activity batching and their tests.
- Live/mock bridges and the server accept joins only; removed stats/help/vote responses and unused outgoing chat/bot-hint protocol messages. Native Predictions remain intact.
- Typecheck and all 332 tests pass, including real SDK joins/Predictions and rejection of ordinary chat without blocking the join cooldown.

## 2026-10-26 - Doc 22 revision step 2 / Eight-game lineup
- Moved Spinner Showdown and Tower Topple with their tests into archive/doc22-cut/; removed live registry, limits, stage/music and selector entries.
- Updated browser Cup coverage to retained games and verified stale queues/enable commands cannot reintroduce archived games.
- Typecheck and all 295 tests pass. Archived source and previous QA evidence remain preserved.

## 2026-10-26 - Doc 22 revision step 1 follow-up / Stored payloads
- Restricted new/reloaded profiles to their declared fields, preserving wins, XP and crowns while dropping obsolete chat payloads.
- Verified the running mock API returns no extra profile fields; restart/persistence tests also check the normalization.

## 2026-10-26 - Doc 22 revision step 3 / Peg Fever v2
- Rebuilt the board with 100 blue, 20 orange and one gold peg, nine permanent physical multiplier lanes, and exactly three balls per viewer in four-ball/2.5s bursts.
- Runs stay beside their balls until landing; arithmetic stamps fly into owner totals, claimed pegs clear in batches, gold doubles runs and Fever doubles slots/music without cancelling shots.
- Added immediate LAST BALLS/Fever HUD updates, separate simultaneous stamp rows and a natural last-landing result. No bucket or bonus end phase remains.
- Reviewed fresh normal-speed stills, the sheet and full-lifecycle captures against every reference; counted positive scoring progress for automatic take selection. All 48 raw roster audits pass and production browser checks verify all eight views plus exact Peg replay. No videos recorded.
- Final typecheck, all 294 tests, production build and both browser checks pass; the live mock API has no obsolete chat/profile fields.

## 2026-10-27 - Counterweight Clash / Cascade relay / Breakthrough course
- Built the BLUE/PINK scale with a real bearing, unobstructed pans, threshold latches, finite-force spill hinges and damped motion; its tilt is the score.
- Folded Clone Relay into Cascade: three multiplier drops fill finite hoppers, then shared moving bottlenecks lead to the first five actual finishers; removed the clock verdict.
- Folded Breakthrough into Marble Race with two cracked, contact-damaged planks and solid chutes; retained the natural finish and ten-second grace.
- Stabilized crowded leader names and skipped hidden label boxes; consistent BLUE/PINK identities now reach Predictions, result cards and persistent winner labels.
- Reviewed every reference, normal-speed start/spill/gate/relay stills and sheets; no videos recorded. The other three proposed modes remain skipped.
- Typecheck, all 304 tests and production build pass; production browser checks complete all three offline views and a five-round faction Cup with four standings screens and five resolved mock Predictions.
- Raw Counterweight audit: 94 BLUE / 106 PINK wins across 200 seeds, no unfinished/non-finite runs, peak 100/112 bodies; the default chosen take lasts 56.83s. Authenticated live Twitch testing remains user-deferred.

## 2026-10-27 - Deadline machine presentation / Counterweight cut
- Accepted the user's solid-color machine direction; froze new modes and removed rejected Counterweight from the default selector and Cup pool, retaining explicit inspection/replays.
- Added outlined solid balls, restrained trails/glow and existing rounded OFL fonts to the shared presentation.
- Gave Cascade colored multiplier light curtains, real-split pulses and distinct moving parts; replaced empty hopper bars with plain supply counts. Race's contact-broken gates are gold.
- Changed no physical geometry, forces, ball counts, seeded draws, timings or win rules. Updated the scope and demo plan instead of expanding modes.
- Rendered all eight normal-speed frame sets, reviewed current stills, machine/gate sheets and the relay against the references; no videos recorded. Recorded intentional visual differences honestly.
- Typecheck, all 304 tests and production build pass; browser checks cover eight selector entries, a real five-finisher relay and a five-round mock Cup with four standings screens and five resolved Predictions.
- This is a presentation pass, not audience approval of the games. Authenticated live Twitch testing remains user-deferred.

## 2026-10-27 - Marble Race routes / Cup entry fix
- Replaced single forced chutes and stray side ledges with connected two-lane forks/merges in all ten race storeys, including separate breakable gates and opposite-phase trapdoors with individual countdown arcs.
- Eight raw 48-marble seeds use both lanes in every storey, touch every internal ramp across the sample and finish without emergency clearing; peak 61/64 bodies. Added a physical reachability regression and revised the geometry fingerprint while preserving enabled/silent replay equality.
- Reproduced the plain /show idle state, then made mock Cups start once on audience handshake. Live Twitch and /show?manual=1 remain host-controlled; dashboard and OBS links use manual mode.
- Extra show tabs now explain the single-show rejection and link to the dashboard instead of silently waiting.
- Reviewed normal-speed start and middle-course frames against all references: zero browser errors, 59–60 FPS, no videos. Natural finish/grace and the monotonic camera remain intact.
- Typecheck, 305 tests across 61 files and production build pass. Three production browser regressions cover plain-URL play, manual/duplicate tabs and a complete automatic Cup; a second five-round Cup includes the rebuilt race and resolves five mock Predictions.

## 2026-10-27 - Doc 24 Toy theme (four ordered commits)
- Step 1: built centralized Toy tokens, cards, eased bars, tags, bounded callouts/toasts, chunky geometry and gradient/pattern surfaces; bundled Fredoka alongside Lilita One with OFL credits. Reviewed the rendered kit against both supplied references; typecheck and 305 tests pass.
- Step 2: replaced glowing discs/trails with pooled matte/jelly/face sprites selected by ?ball=a|b|c, default a; added ground shadows, impact squash, restricted tags, centered numbers and crowns. Radius changes are rendering only. Three frame sets, identical locked fields across styles, typecheck, 305 tests and two browser regressions pass.
- Step 3: restyled all eight selector games, shared HUD/show cards, lobby, standings, podium and dashboard; added read-only screen previews and the five-game Cup pool from doc 23. Local-font, style-invariance, startup and complete-Cup browser checks (7), typecheck, 305 tests and production build pass; no simulation or phase timings changed.
- Step 4: captured/reviewed all eight default-A still sets and contact sheets against the Toy references, plus jelly/faces and Cascade's relay. Fixed Boss tag anchoring, rim layering, screen-pixel geometry sizes, arena-bounded callouts, course clipping, launcher visibility and relay labels; replaced all eight previous visual reviews.
- Final checks: typecheck, 305 tests across 61 files, production build and four refreshed theme/style browser checks pass. All frame captures report zero browser errors; no videos, gameplay changes or timing changes.

## 2026-10-27 - Guided Twitch connection
- Added a Public-app Device Code Flow: enter one public Client ID, approve Twitch, then server-only tokens persist/refresh automatically. No client secret, pasted access tokens or chat-write scope; the existing Confidential flow remains available.
- Added browser-bound setup/status/cancel routes with local origin checks, polling backoff, expiry/shutdown handling, SDK refresh/restart tests, and dashboard authorization/channel/chat/last-join status.
- Added npm run twitch: builds/opens the live app on 4181, reuses an existing instance and isolates live data in .data/live while npm run dev stays mock. Live setup is running without any account authorized.
- Reviewed Toy setup/pending/connected stills; typecheck, 315 tests across 63 files, production build, 30 Twitch fixtures and three browser checks pass. Docs/LIVE-TEST.md explains the remaining app registration/consent and deferred real-channel payout rehearsal. No games or timings changed.

## 2026-10-27 - Twitch registration HTTPS correction
- Changed the Public app registration hint and setup docs to https://localhost:4181/auth/callback; this unused Device Code Flow registration value requires no HTTPS listener. The local dashboard remains HTTP.
- Added a browser regression for the HTTPS hint and HTTP dashboard; reviewed the updated setup card. Typecheck, production build, 315 unit tests and three browser checks pass. Authenticated real-channel testing remains deferred to the broadcaster.

## 2026-10-27 - Distinct dashboard game previews
- Replaced the five identical ring/ball placeholders with compressed screenshots of each Cup game's own Toy arena, preserving the shared cards. Documented the original procedural asset sources in ASSETS.md.
- Checked the live bridge read-only: authentication and chat are connected; this standard channel cannot create Predictions, and no real join has arrived yet. No live Cup or wager was started.
- Reviewed the rebuilt game floor against the Toy reference and checked loaded previews and matching offline links. Isolated the first-time Twitch UI test from the broadcaster's now-authorized account; all five browser checks pass.
- Final checks: typecheck, production build and 315 tests across 63 files pass. No gameplay, physics, timing or authorization changes.

## 2026-10-27 - Plain pre-game screens and host starts
- Removed the locked-field/physics slogans and best-take loading copy. Shared screens now show joins/player counts, plain loading text or a real 3–2–1 countdown after preparation.
- Added Host starts each round and Automatic countdown controls. Live defaults to host starts; joins stay open without a clock or Prediction until Start round, followed by the full betting window when available. Empty player arenas and repeated starts are guarded.
- Fixed idle director state serialization so manual shows reach the dashboard; disabled Start a Cup during an active Cup. No game physics or outcomes changed.
- Reviewed waiting/loading/countdown stills against the Toy reference. Seven browser checks cover the join wait, host button, actual countdown, preview screens and Twitch setup; focused director/protocol checks pass. Restarted the idle live server and confirmed saved Twitch/chat authorization restored.
- Final typecheck, production build, 319 tests across 64 files and all seven browser checks pass. No videos recorded.

## 2026-10-27 - Compact dashboard and game entrances
- Replaced the tall dashboard gallery with compact gameplay rows beside the host controls and queue. Moved standings, settings, OBS/audio, mock testing and logs into closed sections; removed tiers, duplicate controls and retired personality fields from the UI.
- Twitch details collapse after connection and open when authorization is needed. Game rotation, player limits, Predictions and mock tools remain available; updated the live guide.
- Offline play now waits through 3–2–1 after loading, matching the show. Added card slide/pop, pulsing loading dots, countdown number pops and an arena reveal; headless simulations and explicit paused captures retain immediate setup. No physics changed.
- Reviewed desktop/mobile and loading/countdown stills against the Toy theme. Typecheck, production build, 319 tests across 64 files and eight browser checks pass, including the real default loading path, frozen physics throughout the countdown, manual joins and Twitch setup. No videos or live wagers.

## 2026-10-27 - Restore readable dashboard cards
- Replaced the cramped rows with three-column Toy cards, full square gameplay previews, larger titles and more spacing. Host controls stay alongside the gallery while scrolling; secondary settings remain collapsed in a two-column area.
- Kept one- and two-column responsive layouts, full-arena thumbnails, the existing game lineup and all host actions. Replaced the one-screen packing assertion with checks for visible previews and mobile overflow.
- Reviewed the rendered desktop/mobile cards against the Toy reference. Typecheck, production build and eight browser checks pass, covering the gallery, Twitch setup, manual starts and the default offline countdown. No game, physics or timing changes.
- Full verification: 319 tests across 64 files pass. No videos recorded.

## 2026-10-27 - Queue drag and dashboard polish
- Replaced arrow controls with a dedicated sortable queue: grab handles, thumbnails, a floating row/drop slot, touch dragging, keyboard movement, remove/clear and edge scrolling. External show updates cancel a stale drag; duplicate games keep their identity by position.
- Replaced the all-caps live label with normal-case connection text and a status dot. Added equal thumbnail insets and rounded frames, aligned card copy and removed overlapping number badges.
- Reviewed desktop/mobile queue and gallery stills. Typecheck, production build, 319 tests across 64 files and nine browser checks pass, including persisted mouse/touch/keyboard reordering, duplicate entries, removal and mid-drag show updates. No game physics, timing, videos or live wagers changed.

## 2026-10-28 - Varied race routes and readable cycle trails
- Replaced Marble Race's repeated fork/merge with distinct slalom, rotor, seesaw, staggered-door and twin breakthrough routes. Color-coded moving arms; staggered pegs prevent exact centered balancing without hidden forces.
- Narrowed Light Cycles trails to continuous 3px tracks with smaller outlines/shadows. Grid collisions, steering, heads and outcomes are unchanged.
- Captured/reviewed early and middle race sections and cycle trails against the Toy reference; zero browser errors, sampled 59–60 FPS. Refreshed the Marble Race dashboard preview. No videos or live wagers.
- Typecheck, production build and 319 tests across 64 files pass, including physical ramp reachability/both-route coverage over eight full fields, real gate release, deterministic replay and the 200-course camera audit. The browser gallery/preview check also passes.

## 2026-10-28 - Leader camera and directional cycles
- Marble Race now follows the leading active runner with 140px of course ahead and a faster damped response. Updated leader/overtake tests; retained downward-only movement and speed/acceleration bounds.
- Replaced Light Cycles balls with matte directional arrows, upright bounded names and crowns. Square floor, clip and wall faces now match the grid; dark closing walls remain distinct. Disabled its finale zoom to keep all edges in frame while retaining live slow motion.
- Reviewed fresh early/closing-wall cycle frames and mid-course race frames against the Toy reference. No physics, steering, scoring, videos or live wagers changed.
- Typecheck, production build and 319 tests across 64 files pass, including the 200-course camera audit. A new browser regression verifies centered zoom-1 framing throughout the actual closing-wall finale, including decisive slow motion.

## 2026-10-28 - Offline ship polish and release preparation
- Cascade's visible gates release at 5/11/17s with shorter handoffs: raw default rounds drop from 136–141s to 94–101s. Two/four/six-team tests retain real fifth-finisher results and zero expired supply.
- Peg Fever launches carry the same visible 100-point run, keeping cleared-board/Fever slots valuable; all 72 landings pay in each of 16 seeds. Improved slot contrast and bounded receipts without early score credit.
- Added weapon colors, bomb handoff/urgent fuse emphasis, a checkered race finish, restrained callouts and a recent-earned-combo window. Fixed machines keep their full view during slow motion; refreshed previews/reviewed all eight games.
- No-wager automatic joins use ten seconds; manual host waits and full Prediction windows remain. Added explicit-mock npm run demo, source audit, judge instructions, submission copy/storyboard and honest known issues.
- Typecheck/build and 325 tests across 66 files pass; all 20 browser regressions pass. Two normal-speed production Cups pass, including the final 9.4-minute Cup, all standings, top-eight final and persistent crown. No videos or live wagers.
- Clean source extraction, npm ci and production build pass with no private files included. Boss HP remains 55/viewer: sampled population ranges differ; a public curve is awaiting the user's choice. Real Twitch rehearsal/footage and submission account details remain.

## 2026-10-28 - Clear feedback, rage and varied machines
- Removed Pong contact combos. Boss rage charges on damage (14% max HP), grants five seconds of 1.5x weapon damage, drains its bar and shows gold weapons/ring; no movement boost.
- Removed the seed field; normal starts/restarts choose fresh hidden seeds while explicit QA reproduction links remain usable.
- Cascade now has pinwheel/zigzag/diamond geometry with open outer drain approaches and 7/15/24s releases; 16 raw rounds finish in 111–123s. Two/four/six-team tests verify distinct layouts, real drains, conservation and no expiry.
- Light Cycles trail layers overlap with full square caps at turns. Peg Fever chooses rings, weave or chevron bands with exact counts, symmetry and ball clearance.
- Reviewed fresh normal-speed stills against Toy, refreshed three previews and recorded the seven-point checks. No videos or Twitch actions.
- Typecheck/build and 327 tests across 66 files pass after a clean rerun of a camera audit that timed out under concurrent load. Eight browser regressions pass, including both replays and a complete accelerated Cup with standings/final/crown.
- All 48 raw sampled rounds finish within body limits; every Peg landing pays. Boss balance remains FAIL (78.5/89/67.5% wins at 8/16/32); retained diagnostic/source provenance and updated known issues.

## 2026-10-28 - Continuous Cascade and player-focused feedback
- Connected public display names now reach fighters, HP/round cards and Predictions; practice can read local public identity without chat. Removed charge instructions and role nicknames; rage uses percentages/seconds.
- Replaced Cascade's repeated drops with one eight-chamber, 3,520px course and a finish below it. The requested downward scroll keeps fixed zoom and bounded speed/acceleration; all balls keep radius 22.
- Added bounded red drains with an outer x1 bypass, actual multiplication stamps and live team-ball counts. Removed fake drain-kill announcements; kept the real first-to-five finish.
- Bounded deferred-birth work and made port attempts rotate; larger children clear both other balls and the holding flaps. Supply conservation and the complete 200-body budget remain enforced.
- Light Cycles has shaded rounded arrows and batched curved tube joins without changing the grid simulation. Near-miss captions are 40px/max180px, follow the subject and hide on death; sizing precedes clamping.
- Reviewed fresh normal-speed stills against Toy, refreshed previews and saved identity/caption checks. No videos or live Twitch actions.
- Typecheck/build and 328 tests/66 files pass. Replaced an obsolete infinite wait-for-second-drop test with bounded single-course assertions; preserved collision, scoring, replay and conservation checks.
- Twelve browser regressions and a complete accelerated Cup pass. Sixteen raw Cascade seeds finish in 98.8–113.8s with zero expiry/voids/body failures; sampled frames stay near 60 FPS. Earlier Boss balance/live rehearsal limits remain.


## 2026-10-28 - Faster Cascade and licensed music
- Removed Cascade combos from splitting, scoring and the finish; retained only local arithmetic stamps for real multipliers.
- Reduced physical/rendered ball radius from 22 to 16 at every population. Increased gravity, preserved clone fall momentum, shortened floor openings and moved the visible final release to 40s.
- The downward camera holds scoring pockets before revealing the finish; the empty scoring frame stays drawn during the pan. Light Cycles arrowheads are 15% smaller; simulation/trails are unchanged.
- Bundled CC0 Chiptune Adventures (Juhani Junkala) and Empacotatron (Fupi), original notices and MP3 compatibility encodes; credited sources/hashes. Local Howler loops replace the procedural bed, with a file-failure fallback and one audible loop at a time.
- Added a remembered music-note toggle on play/show/dashboard. Effects remain separate; first-gesture resume, pause, master volume and the capture mix work with the new beds.
- Reviewed normal-speed stills against Toy, updated previews and saved QA notes. Sixteen raw Cascade seeds finish in 51.6?57.5s; all 8,658 balls are conserved with zero expiry or sudden death.
- Typecheck/build, 330 tests across 67 files and 16 clean browser checks pass, including audio signal/mute, separate-context dashboard control, replay and a complete accelerated five-round Cup. No videos or live Twitch actions.


## 2026-10-28 - Immediate splits and truthful feedback
- Replaced Cascade's deferred clone queue with atomic same-step offspring reservations. Moved holding floors upstream; children stay in the correct outlet and include same-tick newborns in clearance checks before Rapier refreshes its index.
- Saturated outlets visibly switch to blue x1 instead of owing future clones. The 200-body budget, fixed step and unassisted parent physics remain; capacity recovery cannot cause late backfill.
- Removed the shared combo HUD and automatic death-to-DOUBLE KILL inference. All eight playable games stop producing generic combos, random jackpot celebrations, premature UPSET banners and CLUTCH labels.
- Kept actual score multipliers, Fever, Rage, crown loss, meaningful living-player near misses and real endings. Cascade no longer announces near misses for disposable clones.
- Peg Fever receipts fade locally when no visible owner score row exists; real row destinations freeze at takeoff and pop scaling is included in edge clearance.
- Reviewed fresh normal-speed stills for all eight games against Toy and refreshed previews. Across 48 raw Cascade rounds, all 5,795 balls are accounted for, with zero delayed births/expiry and peak 143 bodies.
- Typecheck/build, 343 tests/69 files and 24 browser checks pass, including complete rounds, music controls, a full Cup and deterministic replays. A separate browser-to-headless Cascade replay and 16 focused contract/emission tests also pass. No videos or live Twitch operations.


## 2026-10-28 - Result screens and offline round actions
- Replaced the generic result podium with shared winner, standings and Cup champion screens using Toy cards, matte winner portraits, crowns and readable labeled results.
- Presentation uses actual game scores, finish times/counts and supplied Cup awards. Offline play has no fake +5/+1 bonus, unknown ranks stay unnumbered, and cancelled rounds never invent a winner or refund.
- Full round awards and the queued next-game title are read-only HUD data. The Grand Final winner remains champion independently of points rank; collective hit statistics keep their own rank.
- Added Play again (fresh hidden seed, same settings) and Change game with selector focus. Live screens show the existing next-phase countdown; no physics, scoring, wagering or timing changed.
- Hid the arena, stale toasts and transient game-owned HUD at intermission; Peg's final receipt cannot overlap the result footer. All gameplay layers restore for the next round.
- Reviewed actual and preview stills against Toy, including long names, six teams, voids, empty Cups and a real normal-speed RESULT contact sheet. Extended npm run frames with --phase RESULT; no videos or live Twitch actions.
- Typecheck/build and the quiet full suite pass 353 tests/71 files. Twenty-six browser checks, a repeated full Cup and focused layer/model checks pass; the first parallel run timed out the unchanged 200-seed camera audit, then passed with browser QA stopped.

## 2026-10-29 - Submission handoff setup
- Added npm run submission: committed source ZIP, SHA-256/commit manifest, project copy, judge setup, credits, checklist and five existing game images. No recording or publication.
- Added typed submission fields and a readiness command that stays pending for missing URLs, session ID, team and owner-confirmed repository/live rehearsal checks; it never treats mock tests as live proof.
- Packaging refuses dirty tracked changes and credential/data/dependency paths. Tests cover source exclusions, URL validation and unverified rehearsal flags.
- Verified the official Nov 2, 5 pm Eastern deadline; consolidated the remaining owner actions and OBS/live rehearsal instructions. Updated the project copy to the current Cascade, scoring and result screens.
- Typecheck, production build and all 356 tests across 72 files pass. The mock demo remains available; no live Twitch actions, account submission or game/balance changes.
- Repository publication, the actual main session ID/team, real-channel payout rehearsal and final YouTube/Devpost submission remain owner steps. The existing Blade Brawl balance FAIL stays disclosed.

## 2026-10-29 - Clean GitHub submission repository
- Retired 434 tracked prototype, legacy, stale doc/report/tool and unused font files; kept the original files/history locally and all eight shipped games.
- Removed Counterweight from the runtime registry/stages/music. Moved its two director/Prediction checks to Cascade; kept the real team-winner outcome assertion.
- Simplified README, asset credits, agent guidance and ignore rules; removed the stale root submission draft and made START.cmd launch the explicit mock demo.
- Created public iamyanbo/chaos-factory with judge access; prepared a fresh submission root so rejected history is not pushed. Retained CODEX_LOG and required license notices.
- Added pinned GitHub Actions for Node 22 install, typecheck, tests and build; source packaging now refuses archive/legacy paths.
- Typecheck/build, 352 tests/71 files and 13 production browser checks pass, including all eight games, replay, result actions, local fonts and a full accelerated Cup. Credential-pattern scan passes.
- No game mechanics, live Twitch actions or videos added. Streamer balance and the remaining owner submission/rehearsal fields stay disclosed.

## 2026-10-29 - Scripted submission video and real chat proof
- Recorded the full 594s five-game Cup and actual champion at normal speed, then built a 167.42s 1080p H.264/AAC edit with licensed audio and actual project-file Codex walkthrough cards.
- Real Twitch EventSub admitted iamyanbo into Peg Fever after !join; recorded host start/countdown and gameplay with one real entrant. No chat message, result or wager was mocked in that proof.
- Standard-channel eligibility is recorded explicitly: Predictions are N/A, not a fabricated payout PASS. The video labels the channel offline and mock Cup viewers separately; no public broadcast is claimed.
- Added reproducible headless canvas/audio capture, timestamp-based edits, fitted Toy captions and paste-ready YouTube/Devpost copy. No desktop, microphone or computer-use tools used in the completed capture/edit.
- Saved the actual main thread ID and confirmed solo membership. Updated live rehearsal, credits and remaining submission steps; generated video/media stay outside Git.
- Reviewed the contact sheet, opening and live-proof frames; fixed caption overflow and quiet audio. Final measured audio peak -1.8 dB; game physics/timings unchanged.
- Typecheck and all 356 tests/72 files pass. YouTube upload and Devpost final submission remain blocked by unavailable authenticated API connectors under the user's no-computer-use constraint.

## 2026-10-29 - Recut the submission video after feedback
- Acknowledged the original edit was an overlong game catalog. Preserved v1 and its source-cut manifest for comparison.
- Reviewed event-specific source contact sheets and built a 105.72s story cut: action hook, compact real join, machine payoff, brief contrasts, standings, one final duel and actual champion.
- Removed loading/waiting, rule paragraphs and equal game blocks. Added three audited opening close-ups; gameplay speed, physics and actual results remain unchanged.
- Replaced disconnected per-clip music with one continuous CC0 bed ducked by actual game audio; final export measures -18.1 LUFS and -4.0 dBTP. No fabricated effects or narration.
- Shortened Codex evidence to two actual-source cards with user-direction/feedback copy. Updated versioned upload links and chapters; optional narration text stays local.
- Typecheck and all 356 tests/72 files pass. Reviewed the new opening and contact sheet; user watchability feedback remains the standard. No computer-use or live broadcast actions.

## 2026-10-29 - Race finish and stronger film presentation
- Reproduced the Race finish rebound: temporary zoom released against leader follow. Removed camera focus/scale changes while retaining actual live slow motion, physics and results; failing-before/passing-after browser coverage proves it.
- Corrected earlier edits stacking a music bed over already mixed music. Recaptured a 592.312s normal-speed Cup with music disabled and effects retained; every sampled music flag is false. The renderer now rejects mixed sources and mutes the older live-join mix.
- Rendered v3 (105.735s, 1080p/30 H.264/AAC) with one continuous CC0 track, animated Toy title/confetti, moving source cards and brief yellow impact captions. Retained previous cuts; no fake hits or results.
- Reviewed the 16-frame film sheet, normal-speed Race finish strip and npm run frames stills beside the Toy reference. Final MP4 decode passes; measured -18.18 LUFS/-2.83 dBTP. Updated credits, reproduction steps and upload copy.
- Typecheck and all 357 tests/73 files pass; 16 browser checks pass across all eight games, music, results and the Race finish. No computer-use tools or public broadcast. YouTube upload/Devpost submission remain owner account actions.

## 2026-10-29 - Continuous film flow and populated joins
- Preserved the approved animated intro, put it first and reduced 19 shots to ten continuous source sequences with matching Toy plate wipes.
- Recorded 48 real mock-bridge arrivals with 2-5 s delays, countdown and 144-ball Peg Fever field. Arrival graphics use actual recorded names/timestamps; simulated viewers remain labeled. Real Twitch proof is a separately labeled, muted four-second inset.
- Moved short rules and Codex-build notes into animated overlays for all five Cup games. Removed the explanation tail; champion leads directly to the brief logo/source ending. Positioned standings copy above its table after frame review.
- Rendered v4 at 95.430 s, 1080p/30 H.264/AAC. One continuous CC0 music bed remains; source music guards, full decoding and -18.11 LUFS/-4.12 dBTP checks pass. Gameplay/physics unchanged.
- Reviewed the 16-frame film sheet, transition strip and full-resolution join, game and standings frames. Typecheck and 358 tests/73 files pass, plus the five final focused plan/audio checks. No computer use; external upload/submission remain owner actions.

## 2026-10-29 - Show physical payoffs and credit the whole implementation
- Replaced Hot Potato's quiet eight-second final pair with a twenty-second crowded-field sequence showing actual fuse expiries, shockwaves, rim breaks and ring-outs; reviewed the source and rendered payoff strip.
- Used the actual five game names in every game overlay. Shifted Peg Fever to multiplied landings and extended Race through the first two finishes; kept the approved intro, crowded mock joins, wipes and direct champion ending.
- Replaced selective feature credits with one fitted whole-project credit: Codex implemented the entire project; the user directed and reviewed it. Updated project and upload copy accordingly.
- Rendered v5 at 109.415 s, 1080p/30 H.264/AAC. Reviewed the final sixteen-frame sheet and full-resolution credit, landing and finish frames. Full decoding and one-bed audio checks pass (-18.08 LUFS/-4.82 dBTP); no fabricated explosions, gameplay changes or computer use.
- Typecheck and all 359 tests/73 files pass, including six focused plan/audio tests protecting Hot Potato's reviewed blast window, canonical names and single full-project attribution. Account upload/submission remain owner actions.
