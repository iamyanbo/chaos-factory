import { durationToBeat, INTRO_SECONDS } from './video-rhythm';
import { eventReactions, type VideoReaction } from './video-reactions';
import { TITLE_CREDIT } from './video-titles';

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
export interface HostVideo {
  mode: string;
  authenticated: boolean;
  connected: boolean;
  readyAt: number;
  actions: { at: number; action: string }[];
  media: { duration: number };
}
export interface VideoSegment {
  source: 'cup' | 'crowd' | 'setup' | 'build' | 'section' | 'title' | 'outro';
  from: number;
  seconds: number;
  title: string;
  body: string;
  subtitle?: string;
  sectionIntro?: string;
  captions?: { from: number; to: number; step: number; label: string; text: string }[];
  gameId?: string;
  chapter?: number;
  celebrate?: boolean;
  reactions?: VideoReaction[];
  cues?: { at: number; seconds: number; kind: 'burst' | 'score' | 'finish'; title: string; detail?: string }[];
  evidence: 'mock' | 'project-files' | 'host-ui';
  inset?: { from: number; at: number; seconds: number; name: string; evidence: 'real-chat' };
}

/** Keep each physical sequence intact; cover source jumps with animated Toy wipes. */
export function submissionVideoPlan(cup: CupVideo, live?: JoinVideo, crowd?: CrowdVideo,
  offlinePreview = false, host?: HostVideo): VideoSegment[] {
  if (crowd?.mode !== 'mock' || crowd.viewers < 24 || crowd.joins.length < 24
    || crowd.playAt === undefined || crowd.startedAt === undefined) {
    throw new Error('Capture a populated mock lobby first: tools/capture-join-crowd.ts');
  }
  const segments: VideoSegment[] = [
    { source: 'title', from: 0, seconds: INTRO_SECONDS, title: '', body: '', subtitle: TITLE_CREDIT, evidence: 'project-files' }
  ];
  if (host) {
    const start = host.actions.find(row => row.action === 'start-cup');
    if (!host.actions.some(row => row.action === 'queue:multiplier-cascade')
      || !host.actions.some(row => row.action === 'drag-reorder') || host.mode !== 'live' || !host.authenticated || !host.connected || !start
      || start.at + 1 > host.media.duration) throw new Error('Connected host workflow proof is incomplete');
    segments.push({ source: 'setup', from: host.readyAt, seconds: 9.3,
      title: '', body: '', evidence: 'host-ui', captions: [
        { from: .35, to: host.actions.find(row => row.action === 'queue:multiplier-cascade')!.at - host.readyAt + .2,
          step: 1, label: 'ADD GAMES', text: 'Click "+ Queue" to add games.' },
        { from: host.actions.find(row => row.action === 'queue:multiplier-cascade')!.at - host.readyAt + .2,
          to: start.at - host.readyAt - 1, step: 2, label: 'CHANGE THE ORDER', text: 'Drag the grip to change the order.' },
        { from: start.at - host.readyAt - 1, to: 9.05, step: 3, label: 'START THE SHOW',
          text: 'Click "Start a Cup" to begin.' }
      ] });
  }
  const from = Math.max(0, crowd.joins[0].wall - .7);
  const seconds = Math.floor((crowd.playAt + 5 - from) * 30) / 30;
  if (from + seconds > crowd.media.duration) throw new Error('Crowd recording ends before gameplay.');
  const lobby: VideoSegment = { source: 'crowd', from, seconds, title: 'TYPE !JOIN',
    body: 'One message. Your marble is in.', sectionIntro: 'CHAT JOINS', evidence: 'mock' };
  if (live?.mode === 'live' && live.joinedAt !== undefined && live.startedAt !== undefined && live.member) {
    const insetFrom = live.startedAt + 6.5;
    if (insetFrom + 4 > live.media.duration) throw new Error('Real Twitch proof is too short.');
    lobby.inset = { from: insetFrom, at: crowd.playAt + .5 - from, seconds: 4,
      name: live.member.displayName ?? 'viewer', evidence: 'real-chat' };
  } else if (!offlinePreview) {
    throw new Error('Real Twitch join proof is missing; use --offline-preview for a labeled draft');
  }
  segments.push({ source: 'build', from: 0, seconds: 7.5, title: 'BUILT WITH CODEX',
    body: '', evidence: 'project-files' });
  segments.push(lobby);
  function round(game: string) {
    const play = cup.transitions.find(row => row.game === game && row.phase === 'PLAY');
    const result = cup.transitions.find(row => row.game === game && row.phase === 'RESULT');
    if (!play || !result || result.wall <= play.wall) throw new Error(`Missing completed ${game} footage`);
    return { play: play.wall, result: result.wall };
  }
  function shot(game: string, offset: number, seconds: number, title: string, body: string) {
    const timing = round(game);
    const latest = Math.min(timing.result + 2, cup.media.duration) - seconds;
    if (latest < timing.play) throw new Error(`Insufficient real ${game} footage`);
    segments.push({ source: 'cup', from: Math.max(timing.play, Math.min(timing.play + offset, latest)),
      seconds, title, body, gameId: game,
      chapter: segments.some(row => row.gameId === game) ? undefined
        : new Set(segments.map(row => row.gameId).filter(Boolean)).size + 1,
      evidence: 'mock' });
  }
  segments.push({ source: 'section', from: 0, seconds: 2.2, title: 'MINIGAMES',
    body: 'FIVE GAMES. ONE CUP.', evidence: 'project-files' });
  // Keep the multiplier stream and the finish race; omit the quiet course scroll.
  shot('multiplier-cascade', 26.2, 8, 'MULTIPLIER CASCADE',
    'Grow your team.\nFirst to five finishers wins.');
  shot('multiplier-cascade', 48, 11, '', '');
  // Each bomb sequence keeps the fuse, the real blast and its aftermath.
  // The forward cut removes the middle of the next long fuse, never a detonation.
  shot('hot-potato', 8.5, 7, 'HOT POTATO',
    'Pass the bomb on contact.\nLast marble standing wins.');
  shot('hot-potato', 19.8, 8, '', '');
  shot('peg-fever', 8, 10, 'PEG FEVER',
    'Three balls each.\nEvery landing multiplies its score.');
  shot('marble-race', 68, 13.5, 'MARBLE RACE',
    'Leaders break gates.\nFollowers get an open lane.');
  const standings = cup.transitions.find(row => row.phase === 'STANDINGS' && row.round === 4);
  if (!standings || standings.wall + 5.7 > cup.media.duration) throw new Error('Fourth-round Cup standings are missing');
  segments.push({ source: 'cup', from: standings.wall + 1.2, seconds: 4.5,
    title: 'TOP EIGHT', body: 'Four rounds earn points.\nEight finalists. One Cup.', evidence: 'mock' });
  segments.push({ source: 'section', from: 0, seconds: 2, title: 'GRAND FINAL',
    body: 'TOP EIGHT. ONE WINNER.', evidence: 'project-files' });
  const final = round('blade-brawl');
  shot('blade-brawl', final.result - final.play - 17.5, 18, 'BLADE BRAWL',
    'The arena closes.\nLast fighter takes the Cup.');
  const champion = cup.transitions.find(row => row.phase === 'CUP_RESULTS');
  if (!champion || champion.wall + 4.2 > cup.media.duration) throw new Error('The actual Cup champion screen is missing');
  segments.push({ source: 'cup', from: champion.wall + .2, seconds: 4,
    title: '', body: '', celebrate: true, evidence: 'mock' });
  segments.push({ source: 'outro', from: 0, seconds: 2.5, title: '', body: '', evidence: 'project-files' });
  let elapsed = 0;
  for (const segment of segments) {
    if (segment.source !== 'title' && segment.source !== 'outro') {
      segment.seconds = durationToBeat(elapsed, segment.seconds);
      if (segment.gameId) {
        segment.from = Math.min(segment.from, round(segment.gameId).result + 2 - segment.seconds);
      }
    }
    if (segment.source === 'setup' && segment.from + segment.seconds > host!.media.duration) {
      throw new Error('Host workflow recording ends before its reading hold');
    }
    // These are annotations of reviewed events in the retained source, never invented events.
    const cue = (sourceOffset: number, seconds: number, kind: 'burst' | 'score' | 'finish',
      title: string, detail?: string) => {
      const at = round(segment.gameId!).play + sourceOffset - segment.from;
      if (at >= 0 && at + seconds <= segment.seconds - .2) {
        (segment.cues ??= []).push({ at, seconds, kind, title, detail });
      }
    };
    if (segment.gameId === 'hot-potato') {
      cue(11.91, .9, 'burst', 'BOOM!');
      cue(22.28, 1.1, 'burst', 'RIM BREAK!');
    }
    if (segment.gameId === 'peg-fever') cue(11.65, 1.2, 'score', '2,960', '1,480 x 2');
    if (segment.gameId === 'marble-race') cue(79.24, 1.15, 'finish', 'FINISH!', 'FIRST HOME');
    segment.reactions = eventReactions(segment);
    elapsed += segment.seconds;
  }
  if (segments.reduce((sum, row) => sum + row.seconds, 0) >= 180) throw new Error('Story cut must stay under three minutes');
  return segments;
}
