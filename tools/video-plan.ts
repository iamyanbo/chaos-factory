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
export interface CrowdVideo {
  mode: string;
  viewers: number;
  playAt?: number;
  startedAt?: number;
  joins: { wall: number; name: string; color: string }[];
  media: { duration: number };
}
export interface VideoSegment {
  source: 'cup' | 'crowd' | 'title' | 'outro';
  from: number;
  seconds: number;
  title: string;
  body: string;
  credit?: string;
  evidence: 'mock' | 'project-files';
  inset?: { from: number; at: number; seconds: number; name: string; evidence: 'real-chat' };
}

/** Keep each physical sequence intact; cover source jumps with animated Toy wipes. */
export function submissionVideoPlan(cup: CupVideo, live?: JoinVideo, crowd?: CrowdVideo,
  offlinePreview = false): VideoSegment[] {
  if (crowd?.mode !== 'mock' || crowd.viewers < 24 || crowd.joins.length < 24
    || crowd.playAt === undefined || crowd.startedAt === undefined) {
    throw new Error('Capture a populated mock lobby first: tools/capture-join-crowd.ts');
  }
  const segments: VideoSegment[] = [
    { source: 'title', from: 0, seconds: 2.5, title: '', body: '', evidence: 'project-files' }
  ];
  const from = Math.max(0, crowd.joins[0].wall - .7);
  const seconds = Math.floor((crowd.playAt + 5 - from) * 30) / 30;
  if (from + seconds > crowd.media.duration) throw new Error('Crowd recording ends before gameplay.');
  const lobby: VideoSegment = { source: 'crowd', from, seconds, title: 'TYPE !JOIN',
    body: 'One message. Your marble is in.', evidence: 'mock' };
  if (live?.mode === 'live' && live.joinedAt !== undefined && live.startedAt !== undefined && live.member) {
    const insetFrom = live.startedAt + 6.5;
    if (insetFrom + 4 > live.media.duration) throw new Error('Real Twitch proof is too short.');
    lobby.inset = { from: insetFrom, at: crowd.playAt + .5 - from, seconds: 4,
      name: live.member.displayName ?? 'viewer', evidence: 'real-chat' };
  } else if (!offlinePreview) {
    throw new Error('Real Twitch join proof is missing; use --offline-preview for a labeled draft');
  }
  segments.push(lobby);
  function round(game: string) {
    const play = cup.transitions.find(row => row.game === game && row.phase === 'PLAY');
    const result = cup.transitions.find(row => row.game === game && row.phase === 'RESULT');
    if (!play || !result || result.wall <= play.wall) throw new Error(`Missing completed ${game} footage`);
    return { play: play.wall, result: result.wall };
  }
  function shot(game: string, offset: number, seconds: number, title: string, body: string, credit?: string) {
    const timing = round(game);
    const latest = Math.min(timing.result + 2, cup.media.duration) - seconds;
    if (latest < timing.play) throw new Error(`Insufficient real ${game} footage`);
    segments.push({ source: 'cup', from: Math.max(timing.play, Math.min(timing.play + offset, latest)),
      seconds, title, body, credit, evidence: 'mock' });
  }
  shot('multiplier-cascade', 35.2, 24, 'MULTIPLIER CASCADE',
    'Grow your team.\nFirst to five finishers wins.',
    'Codex implemented the entire project.\nI directed and reviewed it.');
  // Reviewed source: first fuse expiry at +11.83s; another blast at about +22.13s.
  // Keep both in a continuous crowded-field shot, with room for the shockwaves.
  shot('hot-potato', 10.5, 20, 'HOT POTATO',
    'Pass the bomb on contact.\nLast marble standing wins.');
  shot('peg-fever', 9, 9, 'PEG FEVER',
    'Three balls each.\nEvery landing multiplies its score.');
  shot('marble-race', 69.5, 12, 'MARBLE RACE',
    'Leaders break gates.\nFollowers get an open lane.');
  const standings = cup.transitions.find(row => row.phase === 'STANDINGS' && row.round === 4);
  if (!standings || standings.wall + 5.7 > cup.media.duration) throw new Error('Fourth-round Cup standings are missing');
  segments.push({ source: 'cup', from: standings.wall + 1.2, seconds: 4.5,
    title: 'TOP EIGHT', body: 'Four rounds earn points.\nEight finalists. One Cup.', evidence: 'mock' });
  const final = round('blade-brawl');
  shot('blade-brawl', final.result - final.play - 14.5, 15, 'BLADE BRAWL',
    'The arena closes.\nLast fighter takes the Cup.');
  const champion = cup.transitions.find(row => row.phase === 'CUP_RESULTS');
  if (!champion || champion.wall + 4.2 > cup.media.duration) throw new Error('The actual Cup champion screen is missing');
  segments.push({ source: 'cup', from: champion.wall + .2, seconds: 4,
    title: '', body: '', evidence: 'mock' });
  segments.push({ source: 'outro', from: 0, seconds: 2.5, title: '', body: '', evidence: 'project-files' });
  if (segments.reduce((sum, row) => sum + row.seconds, 0) >= 120) throw new Error('Story cut must stay under two minutes');
  return segments;
}
