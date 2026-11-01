import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { submissionSchema } from './submission-readiness';

const directory = 'qa/submission-video';
await mkdir(directory, { recursive: true });
const fields = submissionSchema.parse(JSON.parse(await readFile('docs/submission-fields.json', 'utf8')));
const edit = JSON.parse(await readFile(`${directory}/edit.json`, 'utf8')) as {
  output: string; duration: number; draft: boolean;
  timeline: { start: number; source: string; title: string }[];
};
if (edit.draft) throw new Error('Upload copy requires verified real Twitch join footage.');
if (edit.timeline.some(row => /cup|grand final|standings|champion/i.test(row.title))) {
  throw new Error('This edit shows the retired Cup format. Recut it for independent rounds before generating upload copy.');
}
const title = 'Chaos Factory | Codex x TwitchCon Hackathon Demo';
const description = `One join. Eight games. A whole stream competing.

Viewers type !join to enter automatic physics minigames or support a team.
The host queues games and starts each independent round with a countdown.
Chat versus streamer, individual races and team battles have their own winners.
There are no Cup points, qualification, account progression or Predictions.

Games: Hot Potato, Blade Brawl, Multiplier Cascade, Peg Fever, Marble Race,
Pong Wars, Light Cycles and Ring Run+. Each game's own objective score still
counts for that game, including Peg Fever multiplied landings and Pong territory.

Codex (GPT-6.1 Sol) implemented the entire project. I directed design and reviewed builds.
The video labels simulated audiences separately from the real Twitch join.
The recorded real join happened while the channel was offline; no public
broadcast is claimed. Twitch authorization reads chat only.

Repository: ${fields.repositoryUrl}
Run locally: Node 22+, npm ci, npm run demo.
Music, fonts and emote sources are credited in ASSETS.md.
`;
await writeFile(`${directory}/youtube.txt`, `${title}\n\n${description}`);
await writeFile(`${directory}/devpost-copy.md`, await readFile('docs/SUBMISSION.md', 'utf8'));
await writeFile(`${directory}/FINISH.md`, `# Remaining owner steps

Video: ${basename(edit.output)} (${edit.duration.toFixed(2)} seconds).
Check the final film matches independent rounds before uploading.

1. Upload to YouTube and confirm visibility and duration.
2. Save the actual YouTube URL in docs/submission-fields.json.
3. Paste docs/SUBMISSION.md into Devpost with the repository and main session ID.
4. Confirm solo membership and complete the final submission.

No account upload or Devpost submission was performed by this script.
`);
console.log('Current independent-round upload copy prepared.');
