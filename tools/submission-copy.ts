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
const description = `One join. Five games. A whole stream competing.

Chaos Factory is an automatic Twitch physics game show. Viewers type !join to
become named marbles. Four Cup rounds lead into a top-eight Blade Brawl final.

This video combines normal-speed excerpts from a simulated five-round Cup with
an actual Twitch EventSub !join on iamyanbo, followed by the host starting Peg Fever.
The channel was offline during capture. The real-chat clip is labeled separately
from simulated viewers. No public broadcast or native point payout is claimed.
This is a standard channel: native Predictions require Affiliate/Partner status.

${time(0)} Chaos Factory and real Twitch chat
${time(first(row => row.title === 'MULTIPLY'))} Physics games and the Cup
${time(first(row => row.title === 'FINAL ROUND') - 6)} Standings and Grand Final
${time(first(row => row.source === 'brief'))} How I used Codex

Source and offline judge setup: ${fields.repositoryUrl}
No account or tokens are needed for the mock demo: npm ci, then npm run demo.

Built with TypeScript, PixiJS, Rapier, Fastify, WebSockets and Twurple, using Codex.
Music in this edit: Juhani Junkala, Chiptune Adventures Stage 2, CC0.
Credits and full notices: ${fields.repositoryUrl}/blob/main/ASSETS.md
`;
await writeFile(`${directory}/youtube.txt`, `TITLE\n${title}\n\nDESCRIPTION\n${description}`);
await writeFile(`${directory}/devpost-copy.md`, `# Chaos Factory

**Elevator pitch:** One join. Five games. A whole stream competing.

## Inspiration
Physics videos are compelling because viewers can follow a simple object through
a visible machine. I wanted chat to become those objects, with a whole show to
care about rather than another reflex command that arrives too late through stream delay.

## What it does
Viewers type !join and enter as named marbles. Five-round Cups draw from Hot Potato,
Blade Brawl, Multiplier Cascade, Peg Fever and Marble Race. Four rounds award Cup
points; the top eight enter a Blade Brawl final, where the final survivor wins.
Profiles preserve colors, titles and the champion's crown between shows.
Three additional games remain available for offline play.

The dashboard manages the queue, player limits and host starts. A separate browser
source fits OBS. Native Predictions are integrated for eligible Twitch channels,
with a no-wager fallback when they are unavailable. The mock demo runs with delayed
simulated viewers and needs no Twitch account.

## How I built it with Codex
I directed the design and used Codex to implement the TypeScript engine, isolated
game plugins, Twitch connector, dashboard, Cup layer, tests and recording tools.
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
followed by host start and gameplay without wagers. The Cup excerpts use simulated
viewers and are labeled. The channel was offline during capture, and no public
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
These account steps were not performed. No browser UI or desktop recording was used.
The video accurately labels real API-connected Twitch chat while the channel is offline;
it does not claim a public live broadcast or a native Prediction payout.

Full Cup: full-cup-sfx/full-cup.webm. Real join: live-join/live-join.webm.
edit.json records source cuts and evidence labels. contact-sheet-v3.png is the visual review.
`);
console.log(`Upload and submission copy: ${resolve(directory)}`);
