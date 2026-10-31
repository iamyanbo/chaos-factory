import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { submissionSchema } from './submission-readiness';

const directory = 'qa/submission-video';
await mkdir(directory, { recursive: true });
const fields = submissionSchema.parse(JSON.parse(await readFile('docs/submission-fields.json', 'utf8')));
const edit = JSON.parse(await readFile(`${directory}/edit.json`, 'utf8')) as {
  output: string; duration: number; draft: boolean;
  timeline: { start: number; source: string; title: string }[];
};
if (edit.draft) throw new Error('Upload copy requires a cut with verified real Twitch join footage.');
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const first = (predicate: (row: typeof edit.timeline[number]) => boolean) => edit.timeline.find(predicate)?.start ?? 0;
const title = 'Chaos Factory | Codex x TwitchCon Hackathon Demo';
const videoName = basename(edit.output);
const description = `One join. Eight games. A whole stream competing.

Chaos Factory is an automatic Twitch physics game show. Viewers type !join to
enter individual contests or support a faction. Four Cup rounds lead into a
top-eight Blade Brawl final.

This video showcases the default five-game Cup, plus Pong Wars, Light Cycles and
Ring Run+ in a separate optional-game section. All eight work offline and can be
queued from the dashboard. The original five remain the default rotation.
Rounds can be individual contests or faction battles; Cascade in this video
shows teams competing. In team machines such as Pong Wars, viewers support a
faction and names rotate through its balls; there is not one physical ball per viewer.

The opening shows the current eight-game dashboard in offline demo mode, queue
reordering and Start Cup, with animated instructions and stationary close-ups.

This video shows 48 simulated viewers joining the actual game lobby, followed
by normal-speed excerpts from a five-round Cup. A separately labeled inset shows
the actual Twitch EventSub join rehearsal with iamyanbo in Peg Fever.
The channel was offline during that test. Simulated viewers are labeled. No public broadcast or native point payout is claimed.
This is a standard channel: native Predictions require Affiliate/Partner status.

${time(0)} Chaos Factory
${time(first(row => row.source === 'setup'))} Dashboard and Cup controls (offline demo)
${time(first(row => row.source === 'crowd'))} Joining the show
${time(first(row => row.title === 'MULTIPLIER CASCADE'))} Physics games and the Cup
${time(first(row => row.title === 'MORE GAMES'))} Optional games: Pong Wars, Light Cycles and Ring Run+
${time(first(row => row.title === 'TOP EIGHT'))} Standings and Grand Final

MINIGAMES and GRAND FINAL title stingers introduce the game sections.
Centered payoff captions remain text-only. PogChamp, SeemsGood, LUL and NotLikeThis
pop independently around events; these editorial reactions are not captured chat messages.
Each game uses its actual name and short rules over gameplay.
The opening title credits the project: Implemented with Codex.
There is no standalone code excerpt. The submission text explains the build workflow;
the closing card links the source repository. No Codex app recording is claimed.

Source and offline judge setup: ${fields.repositoryUrl}
No account or tokens are needed for the mock demo: npm ci, then npm run demo.

Built with TypeScript, PixiJS, Rapier, Fastify, WebSockets and Twurple, using Codex.
Music in this edit: Juhani Junkala, Chiptune Adventures Stage 2, CC0.
Twitch emote stickers: PogChamp, SeemsGood, LUL and NotLikeThis from the official Twitch
global emote API/CDN. Rights remain with Twitch/the respective rights holders.
Credits and full notices: ${fields.repositoryUrl}/blob/main/ASSETS.md
`;
await writeFile(`${directory}/youtube.txt`, `TITLE\n${title}\n\nDESCRIPTION\n${description}`);
await writeFile(`${directory}/devpost-copy.md`, `# Chaos Factory

**Elevator pitch:** One join. Eight games. A whole stream competing.

## Inspiration
Physics videos are compelling because viewers can follow a simple object through
a visible machine. I wanted chat to become those objects, with a whole show to
care about rather than another reflex command that arrives too late through stream delay.

## What it does
Viewers type !join to enter individual contests or support a faction. Five-round Cups draw from Hot Potato,
Blade Brawl, Multiplier Cascade, Peg Fever and Marble Race. Four rounds award Cup
points; the top eight enter a Blade Brawl final, where the final survivor wins.
Profiles preserve colors, titles and the champion's crown between shows.
Pong Wars, Light Cycles and Ring Run+ are three optional games, shown separately
in the video and available from the dashboard queue or automatic rotation settings.
All eight games also work offline. Pong Wars is a territory battle for 2-4 factions:
viewers support a team and their names rotate through its balls. Individual games
give viewers their own entrants. In faction Cup rounds, members of the winning
side earn win points; the top-eight final still decides one individual champion.

The dashboard manages the queue, player limits and host starts. A separate browser
source fits OBS. Native Predictions are integrated for eligible Twitch channels,
with a no-wager fallback when they are unavailable. The mock demo runs with delayed
simulated viewers and needs no Twitch account.

## How I built it with Codex
Codex implemented the entire project: engine, games, presentation, Twitch connector,
dashboard, Cup layer, tests and recording/editing tools. I directed the design,
played and reviewed builds, and gave feedback throughout.
PixiJS renders the Toy theme; deterministic Rapier runs at 60 Hz. Fastify,
WebSockets and Twurple connect the show to Twitch. Credentials remain on the server.

The build changed through repeated feedback. I rejected weak prototypes, reduced
the lineup, replaced neon with the Toy theme, and reviewed actual frames. Codex
fixed delayed multiplication spawns, misleading event captions and unclear result
screens. Seeded replay tests and full-Cup browser checks helped catch regressions.
AGENTS.md and CODEX_LOG.md preserve the instructions and implementation record.

## Challenges and what I learned
Working physics and passing metrics do not automatically make something fun to
watch. Visible causes, readable scores and clean payoffs mattered more than adding
mechanics. Supporting a viewer with no audience also meant making the same show
usable offline and keeping manual starts available for a real channel rehearsal.

## What is verified and what remains
The demo includes a real Twitch EventSub !join admitting iamyanbo into Peg Fever,
with gameplay without wagers, shown as a labeled inset. The main join sequence
uses 48 simulated viewers, and Cup excerpts use a labeled simulated audience. The channel was offline during capture, and no public
broadcast is claimed. Native Prediction payout remains untested because this is
a standard channel, not Affiliate/Partner. The streamer-versus-chat Blade Brawl
balance still favors the streamer; the known failure is disclosed in the repository.

## Built with
TypeScript, Node.js, PixiJS, Rapier, Fastify, WebSockets, Twurple, Vitest,
Playwright, FFmpeg and OpenAI Codex.

## Submission fields
- Repository: ${fields.repositoryUrl}
- Team: ${fields.teamMembers.join(', ')} (solo)
- Actual main Codex session ID: ${fields.codexSessionId}
- YouTube URL: add after uploading the finished MP4
- Video file: ${edit.output}
- Duration: ${edit.duration.toFixed(2)} seconds
`);
await writeFile(`${directory}/FINISH.md`, `# Finish the submission

The finished story cut is **${time(Math.round(edit.duration))}**, 1920x1080 H.264/AAC:
[${videoName}](${videoName}).

1. Upload that MP4 at https://studio.youtube.com. Title/description are in youtube.txt.
   Choose Public or Unlisted so judges can view it. Wait for processing and check playback.
2. Paste the project text from devpost-copy.md into your hackathon entry:
   https://devpost.com/submit-to/31742-codex-x-twitchcon-hackathon/manage/submissions
3. Add the YouTube URL, repository URL and actual session ID from devpost-copy.md.
   Confirm solo membership and the form's eligibility/terms yourself. Click Submit.
4. Confirm the project appears as Submitted before Nov 2, 2026, 5 pm Eastern.

There is no authenticated YouTube/Devpost API connector available to this agent.
These account steps were not performed. The dashboard is an explicitly labeled offline demo of our own app, recorded headlessly without desktop capture.
The video accurately labels real API-connected Twitch chat while the channel is offline;
it does not claim a public live broadcast or a native Prediction payout.

Full Cup: full-cup-sfx/full-cup.webm. Real join: live-join/live-join.webm.
edit.json records source cuts and evidence labels. contact-sheet-v15.png is the visual review.
`);
console.log(`Upload and submission copy: ${resolve(directory)}`);
