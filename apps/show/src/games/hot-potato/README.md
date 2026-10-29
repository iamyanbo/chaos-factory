# Hot Potato

Automatic bomb tag in a fixed, zero-gravity circular arena. Elastic Rapier balls
start at 180 px/s; there is no steering or velocity normalization. A real new
ball contact passes the bomb without resetting its seeded 8–14 second fuse.
The glowing fuse arc and shrinking spark show the remaining burn, and the
procedural beeps accelerate with it.

An explosion eliminates its holder. Its visible expanding shockwave applies
outward impulses only when the front reaches a ball. The same front removes any
white rim segments it reaches, including their actual colliders. A ball wholly
outside the circle is out. A second elimination caused by that shockwave earns
DOUBLE KILL; unrelated later exits receive no blast attribution.

Each exploded or lost bomb returns after a two-second breather. Fewer than eight
survivors means two distinct bomb carriers; fewer than four shortens existing
and newly seeded fuses by 30%, once. One third of seeds arm one visibly gold mega-bomb with a
larger, equally visible shockwave. At 150 seconds the visible fuse burn triples;
the game continues to a physical outcome and never awards a clock verdict.

FFA ends with the actual last survivor. Simultaneous total elimination is void.
CvS adds a larger streamer ball: chat must eliminate it while more than three
chatters remain, and the streamer wins when only three remain. Fields starting
with three or fewer chatters instead play to the last survivor. All explosions
from a fixed step resolve before either objective is checked.

Rendering uses the shared neon and hype kits. All artwork and audio are
procedural; no external assets are added. Only the registered GameContext
services are used, and headless and displayed games run the same fixed physics.
