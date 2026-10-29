import { z } from 'zod';

export const submissionSchema = z.object({
  repositoryUrl: z.string(),
  videoUrl: z.string(),
  codexSessionId: z.string(),
  teamMembers: z.array(z.string()),
  repositoryAccessChecked: z.boolean(),
  liveJoinVerified: z.boolean(),
  livePredictionPayoutVerified: z.boolean(),
  noWagerFallbackVerified: z.boolean()
}).strict();

export type SubmissionFields = z.infer<typeof submissionSchema>;
export interface ReadinessItem { label: string; ready: boolean }

function publicUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    return url;
  } catch { return; }
}

export function submissionReadiness(fields: SubmissionFields): ReadinessItem[] {
  const repository = publicUrl(fields.repositoryUrl);
  const video = publicUrl(fields.videoUrl);
  const repositoryValid = !!repository
    && ['github.com', 'gitlab.com', 'bitbucket.org'].includes(repository.hostname)
    && repository.pathname.split('/').filter(Boolean).length >= 2;
  const videoValid = !!video && (
    (['youtube.com', 'www.youtube.com'].includes(video.hostname)
      && video.pathname === '/watch' && /^[\w-]{11}$/.test(video.searchParams.get('v') ?? ''))
    || (video.hostname === 'youtu.be' && /^\/[\w-]{11}$/.test(video.pathname))
  );
  return [
    { label: 'Repository URL (GitHub, GitLab or Bitbucket)', ready: repositoryValid },
    { label: 'Judge repository access checked by owner', ready: fields.repositoryAccessChecked },
    { label: 'YouTube demo URL (visibility and duration checked manually)', ready: videoValid },
    { label: 'Actual main Codex session ID', ready: fields.codexSessionId.trim().length >= 8
      && !/placeholder|replace|example|todo|tbd|<|>/i.test(fields.codexSessionId) },
    { label: 'Team members entered', ready: fields.teamMembers.length > 0
      && fields.teamMembers.every(name => name.trim().length > 0) },
    { label: 'Real Twitch !join rehearsal confirmed by owner', ready: fields.liveJoinVerified },
    { label: 'Native Prediction lock, resolution and payout confirmed by owner', ready: fields.livePredictionPayoutVerified },
    { label: 'No-wager fallback rehearsal confirmed by owner', ready: fields.noWagerFallbackVerified }
  ];
}

export function excludedSourcePath(path: string): boolean {
  const parts = path.replaceAll('\\', '/').split('/');
  return parts.some(part => ['node_modules', '.data', '.git', 'dist', 'archive', 'legacy'].includes(part)
    || (part === '.env' || part.startsWith('.env.')) && part !== '.env.example');
}
