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
canvas and HTML/CSS work using the bundled fonts. The v10 film uses only Chiptune
Adventures Stage 2 as one continuous CC0 bed over original game effects. Its new
transition whooshes are original seeded noise synthesis in tools/video-edit-audio.ts,
with no third-party samples. Comic accents label real recorded events. No microphone,
desktop footage or external artwork is used. Generated media
stays outside Git under qa/submission-video/.

The host segment records our own connected dashboard in a headless browser. Its
pointer and click rings are editorial aids. The Marble Race build-record panel
uses only selected public user/assistant messages and the actual committed patch
listed in docs/build-evidence.json. It is a rendered transcript/diff viewer, not
a recording of the Codex app UI. No private reasoning, credentials or raw session
logs are included. tools/video-proof.ts validates the code against Git.

The v9 edit adds original eased framing, impact rings/rays and a brief warm
exposure accent. The headless dashboard cursor uses timed curved input rather
than instantaneous mouse steps. These are editorial presentation effects; the
recorded gameplay timeline and underlying physics remain unchanged.

The v10 edit replaces moving pan/zoom paths with stationary close-up cuts. Its
numbered queue captions and MINIGAMES/GRAND FINAL stingers are original canvas
typography and geometry using the same bundled fonts. The captions are text only;
no speech synthesis or additional music/third-party samples are used.

The v11 video's editorial stickers are the authentic global Twitch emotes
SeemsGood (64138), PartyHat (965738) and TwitchLit (166263), downloaded through
[Twitch Get Global Emotes](https://dev.twitch.tv/docs/api/reference/#get-global-emotes)
and its official static-cdn.jtvnw.net image URLs. These images belong to Twitch
and/or their respective rights holders; they are not claimed as CC0 or original
project art. They appear as editorial stickers, not captured messages or real
viewer reactions. No emote chat integration is added to the game. PNGs and the
source/hash manifest remain local in qa/submission-video/twitch-emotes/ and are
excluded from the runtime and source ZIP. Fetching uses server-side authorization;
the renderer receives only public image bytes. See tools/fetch-video-emotes.ts.

The current edit uses independent, unboxed Twitch reactions: PogChamp (305954156),
LUL (425618), NotLikeThis (58765) and SeemsGood (64138), fetched from
the same official global-emote API/CDN. Images remain attributed to Twitch/their
respective rights holders and cached outside the source/runtime package. The
standalone build excerpt and earlier feedback/fix conversation are removed from
the current cut. The original opening credit and closing repository link remain.
These are original editorial layouts; no raw session or native Codex footage is exported.

The optional-game previews for Pong Wars, Light Cycles and Ring Run+ are crops
of our own current Toy gameplay captures, exported at 640x640. The optional-game
video section uses fresh normal-speed game captures with sound effects only.
The refreshed dashboard tutorial is explicitly labeled as an offline demo;
the separately labeled real Twitch join inset remains the earlier rehearsal.

The v16 recut records the current join-only dashboard, a 48-viewer mock lobby and
five independent rounds, plus a separately recorded Peg Fever take with a real
Fever trigger. It retains the reviewed optional-game captures and historical real
Twitch join inset. The original vector intro, captions, music and licensed emote
sources are unchanged; no new third-party assets are introduced.
