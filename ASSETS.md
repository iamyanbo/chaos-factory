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
- The shared winner/standings screens reuse these fonts and procedural ball
  portraits with original crown/card geometry. See [qa/end-screen-review.md](qa/end-screen-review.md).

Rejected prototypes, unused fonts and historical reference footage are excluded
from this submission repository. Dependency licenses remain with their packages.

The submission video uses captures of our own game canvas and original motion
graphics describing the game rules and Codex implementation work. Its Toy title
animation, animated arrival feed, plate wipes and gameplay overlays are original
canvas and HTML/CSS work using the bundled fonts. The v7 film uses only Chiptune
Adventures Stage 2 as one continuous CC0 bed over original game effects. Its new
transition whooshes are original seeded noise synthesis in tools/video-edit-audio.ts,
with no third-party samples. Comic accents label real recorded events. No microphone,
desktop footage or external artwork is used. Generated media
stays outside Git under qa/submission-video/.
