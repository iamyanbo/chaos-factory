# Assets and licenses

Game art, Toy geometry, ball textures, crowns, effects, icons and synthesized
sound effects are original procedural PixiJS/Canvas/WebAudio work. No external
game sprites are loaded. `docs/refs/theme-toy.png` and `ui-themes.html` are supplied
design references, not runtime assets.

## Fonts (bundled locally)

- **Lilita One**, Juan Montoreano, SIL Open Font License 1.1.
  [Source](https://github.com/google/fonts/tree/main/ofl/lilitaone).
  Font and notice: `apps/show/public/fonts/LilitaOne-Regular.ttf`, `LilitaOne-OFL.txt`.
- **Fredoka**, The Fredoka Project Authors (2016), SIL Open Font License 1.1.
  [Source](https://github.com/google/fonts/tree/main/ofl/fredoka).
  Font and notice: `apps/show/public/fonts/Fredoka.ttf`, `Fredoka-OFL.txt`.

The show makes no third-party font request.

## Background music (CC0)

- `adventure-1.ogg` and `adventure-2.ogg`: **Chiptune Adventures, Stage 1 / Stage 2**,
  Juhani Junkala (SubspaceAudio). [Author release](https://opengameart.org/content/4-chiptunes-adventure).
  Original notice: `apps/show/public/music/Juhani-Junkala-NOTICE.txt`.
- `factory.ogg` and `menu.ogg`: **Empacotatron, loop / menu**, Fupi.
  [Author release](https://opengameart.org/content/empacotatron).
- All four recordings use [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
  OGG originals are unmodified. MP3 compatibility versions were encoded locally
  using FFmpeg/libmp3lame at 128 kbps. Notices are bundled in
  `apps/show/public/music/LICENSE.txt`; source hashes/durations are in
  [qa/music-metadata.json](qa/music-metadata.json).
- Music can accompany streams and recordings. It is local, can be muted separately
  from effects, and has an original procedural fallback on load failure.

## Design and code provenance

- Ring Run's original reference was footage rendered with
  [physim](https://github.com/TRC-Loop/physim), MIT, copyright 2026 Arne K. (TRC-Loop).
  The TypeScript game is a fresh implementation. Retained notice:
  [licenses/physim-MIT.txt](licenses/physim-MIT.txt).
- Pong Wars adapts the territory-flipping idea from
  [vnglst/pong-wars](https://github.com/vnglst/pong-wars), MIT, copyright 2024 Koen van Gilst.
  Its solver, four-team grid and art are original TypeScript work. Retained notice:
  [licenses/pong-wars-MIT.txt](licenses/pong-wars-MIT.txt).
- Dashboard previews in `apps/show/public/game-previews/` are captures of our own
  procedural renderers: the central 1024 px arena crop, resized to 640 px WebP.
  Refresh them from `npm run frames` after changing game presentation.
- The shared winner and team-result screens reuse these fonts and procedural ball
  portraits with original crown/card geometry. See [qa/end-screen-review.md](qa/end-screen-review.md).

Rejected prototypes, unused fonts and historical reference footage are excluded
from this submission repository. Dependency licenses remain with their packages.


## Submission video

The final movie is `qa/submission-video/chaos-factory-demo.mp4`. It uses our own
normal-speed game and dashboard recordings, original Toy motion graphics, bundled
fonts and a single continuous CC0 Chiptune Adventures Stage 2 music bed. Game SFX
and procedural transition whooshes (`tools/video-edit-audio.ts`) are original;
there is no voiceover or third-party sound sample. Captures and generated media
are local and excluded from Git and the source ZIP.

The dashboard cursor, click rings, centered event captions, stationary close-up
cuts and section cards are editorial aids. The simulated audience and historical
real Twitch join are labeled separately; the real join occurred while the channel
was offline. No large real audience or public broadcast is claimed.

The original doc 24 request is quoted verbatim from the owner's build thread,
followed by four actual theme/renderer source files scrolling together. This is
an original editorial layout, not native Codex UI footage. The GPT-6.1 Sol credit
is the owner's supplied attribution. No private reasoning, credentials or full
session transcript is exported. The code view uses the installed Consolas system
font; no additional font file is redistributed.

The Blade Brawl replacement records the same seed and 24-viewer streamer round,
with identical complete per-user results, winner and champion. Encoded-frame
cadence is checked independently of the render counter. There are no generated
intermediate frames, speed-up or changes to physics.

### Twitch editorial stickers

PogChamp (305954156), LUL (425618), NotLikeThis (58765) and SeemsGood (64138) are
authentic global Twitch emotes, fetched through
[Twitch Get Global Emotes](https://dev.twitch.tv/docs/api/reference/#get-global-emotes)
and official static-cdn.jtvnw.net URLs. They belong to Twitch and/or their
respective rights holders; they are not claimed as CC0 or original project art.
They appear as editorial stickers rather than captured chat messages or real
viewer reactions. No emote integration is added to the game.

The cached PNGs and source/hash manifest stay local in
`qa/submission-video/twitch-emotes/`. Fetching uses server-side authorization;
renderers receive only public image bytes. See `tools/fetch-video-emotes.ts`.

### Video thumbnail

The selected thumbnail is `qa/submission-video/chaos-factory-gameplay-screenshot.png`:
a full in-game frame from the Blade Brawl recording at 66.6 seconds, resized to
1280x720. Its HUD and RAGE callout are native game rendering; no additional text,
layout, illustration or objects are added. Earlier illustrated/composite drafts
are not selected. Thumbnail files remain local upload assets, excluded from Git.
