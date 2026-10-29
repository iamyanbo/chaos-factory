export interface VideoTransition {
  wall: number;
  phase: string;
  round: number;
  game: string;
  stage: number;
}
export interface CupVideo {
  transitions: VideoTransition[];
  wallSeconds: number;
  media: { duration: number };
}
export interface JoinVideo {
  joinedAt?: number;
  startedAt?: number;
  member?: { displayName?: string };
  mode: string;
  media: { duration: number };
}
export interface VideoSegment {
  source: 'cup' | 'live' | 'title' | 'brief' | 'review' | 'outro' | 'pending';
  from: number;
  seconds: number;
  title: string;
  body: string;
  evidence: 'mock' | 'real-chat' | 'project-files' | 'pending';
  card?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
}

/** Editorial shot choices were reviewed against the original normal-speed captures. */
export function submissionVideoPlan(cup: CupVideo, live?: JoinVideo, offlinePreview = false): VideoSegment[] {
  const segments: VideoSegment[] = [];
  function round(game: string) {
    const play = cup.transitions.find(row => row.game === game && row.phase === 'PLAY');
    const result = cup.transitions.find(row => row.game === game && row.phase === 'RESULT');
    if (!play || !result || result.wall <= play.wall) throw new Error(`Missing completed ${game} footage`);
    return { play: play.wall, result: result.wall, round: play.round };
  }
  function shot(game: string, offset: number, seconds: number, title = '', crop?: VideoSegment['crop']) {
    const timing = round(game);
    const latest = Math.min(timing.result + 3, cup.media.duration) - seconds;
    if (latest < timing.play) throw new Error(`Insufficient real ${game} footage for the reviewed shot`);
    const from = Math.max(timing.play, Math.min(timing.play + offset, latest));
    if (from + seconds > timing.result + 3 || from + seconds > cup.media.duration) {
      throw new Error(`Insufficient real ${game} footage for the reviewed shot`);
    }
    segments.push({ source: 'cup', from, seconds, title, body: '', evidence: 'mock', card: !!title, crop });
  }
  // Cold open: a multiplier landing, a fuse expiring, then a working machine.
  shot('peg-fever', 39.55, 2, '', { x: 528, y: 552, width: 864, height: 486 });
  shot('hot-potato', 54.1, 2, '', { x: 432, y: 250, width: 1056, height: 594 });
  shot('multiplier-cascade', 30.2, 2, '', { x: 432, y: 280, width: 1056, height: 594 });
  segments.push({ source: 'title', from: 0, seconds: 2.5, title: '', body: '', evidence: 'project-files' });
  if (live?.mode === 'live' && live.joinedAt !== undefined && live.startedAt !== undefined && live.member) {
    const choices = [
      { from: Math.max(0, live.joinedAt - 1), seconds: 3.5, title: 'TYPE !JOIN' },
      { from: live.startedAt + 2.8, seconds: 3.2, title: '' },
      { from: live.startedAt + 6.5, seconds: 5.5, title: `@${live.member.displayName ?? 'viewer'} IS IN` }
    ];
    for (const choice of choices) {
      if (choice.from + choice.seconds > live.media.duration) throw new Error('Real Twitch proof is too short');
      segments.push({ source: 'live', ...choice, body: '', evidence: 'real-chat', card: !!choice.title });
    }
  } else {
    if (!offlinePreview) throw new Error('Real Twitch join proof is missing; use --offline-preview for an explicitly labeled draft');
    segments.push({ source: 'pending', from: 0, seconds: 12.2, title: 'TWITCH PROOF PENDING',
      body: 'This is an offline preview. A real !join rehearsal is still needed.', evidence: 'pending' });
  }
  // One cause-and-payoff sequence, then brief contrasting physical moments.
  shot('multiplier-cascade', 16, 7.5, 'MULTIPLY');
  shot('multiplier-cascade', 48, 11, 'FIRST TO FIVE');
  shot('hot-potato', 60.4, 7.5, 'PASS THE FUSE');
  shot('peg-fever', 6.8, 7, 'SCORE THE DROP');
  shot('marble-race', 71.5, 8, 'BREAK THROUGH');
  const standings = cup.transitions.find(row => row.phase === 'STANDINGS' && row.round === 4);
  if (!standings || standings.wall + 7 > cup.media.duration) throw new Error('Fourth-round Cup standings are missing');
  segments.push({ source: 'cup', from: standings.wall + 1.2, seconds: 6,
    title: 'TOP EIGHT', body: '', evidence: 'mock', card: true });
  // Show the field shrinking, then hold the actual final duel through its winner.
  shot('blade-brawl', 44.4, 5, 'FINAL ROUND');
  shot('blade-brawl', 64.9, 13, 'ONE CUP WINNER');
  const champion = cup.transitions.find(row => row.phase === 'CUP_RESULTS');
  if (!champion || champion.wall + 4.2 > cup.media.duration) throw new Error('The actual Cup champion screen is missing');
  segments.push({ source: 'cup', from: champion.wall + .2, seconds: 4,
    title: '', body: '', evidence: 'mock', card: false });
  for (const source of ['brief', 'review'] as const) {
    segments.push({ source, seconds: 6, from: 0, title: '', body: '', evidence: 'project-files' });
  }
  segments.push({ source: 'outro', from: 0, seconds: 4, title: '', body: '', evidence: 'project-files' });
  if (segments.reduce((sum, row) => sum + row.seconds, 0) >= 120) throw new Error('This story cut must stay under two minutes');
  return segments;
}
