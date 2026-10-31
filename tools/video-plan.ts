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
export interface RoundVideo {
  transitions: VideoTransition[];
  wallSeconds: number;
  media: { duration: number };
  reviewed: Record<string, ReviewedTake[]>;
  alternate?: Record<string, OptionalGameVideo>;
}
export interface ReviewedTake {
  offset: number;
  seconds: number;
  cues?: VideoSegment['cues'];
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
export interface OptionalGameVideo {
  game: string;
  mode: string;
  normalSpeed: boolean;
  resultAt?: number;
  result?: { winner: { kind: string } };
  media: { duration: number };
}
export interface VideoSegment {
  source: 'rounds' | 'crowd' | 'setup' | 'optional' | 'alternate' | 'section' | 'title' | 'outro';
  from: number;
  seconds: number;
  title: string;
  body: string;
  subtitle?: string;
  sectionIntro?: string;
  captions?: { from: number; to: number; step: number; label: string; text: string }[];
  gameId?: string;
  chapter?: number;
  bonus?: boolean;
  category?: string;
  hostMode?: 'mock' | 'live';
  celebrate?: boolean;
  reactions?: VideoReaction[];
  cues?: { at: number; seconds: number; kind: 'burst' | 'score' | 'finish'; title: string; detail?: string;
    reactionsOnly?: boolean; moment?: 'spill' | 'elimination' | 'score' | 'fever' | 'finish' | 'powerup' | 'multiply' }[];
  evidence: 'mock' | 'project-files' | 'host-ui';
  inset?: { from: number; at: number; seconds: number; name: string; evidence: 'real-chat' };
}

/** Keep each physical sequence intact; cover source jumps with animated Toy wipes. */
export function submissionVideoPlan(rounds: RoundVideo, live?: JoinVideo, crowd?: CrowdVideo,
  offlinePreview = false, host?: HostVideo, optional: readonly OptionalGameVideo[] = []): VideoSegment[] {
  if (rounds.transitions.some(row => ['STANDINGS', 'CUP_RESULTS'].includes(row.phase))) {
    throw new Error('Recapture independent rounds; historical tournament footage is not a current-build source.');
  }
  if (crowd?.mode !== 'mock' || crowd.viewers < 24 || crowd.joins.length < 24
    || crowd.playAt === undefined || crowd.startedAt === undefined) {
    throw new Error('Capture a populated mock lobby first: tools/capture-join-crowd.ts');
  }
  const segments: VideoSegment[] = [
    { source: 'title', from: 0, seconds: INTRO_SECONDS, title: '', body: '', subtitle: TITLE_CREDIT, evidence: 'project-files' }
  ];
  if (host) {
    const start = host.actions.find(row => row.action === 'start-show');
    const validHost = host.connected && (host.mode === 'mock' || host.mode === 'live' && host.authenticated);
    if (!host.actions.some(row => row.action === 'queue:multiplier-cascade')
      || !host.actions.some(row => row.action === 'drag-reorder') || !validHost || !start
      || start.at + 1 > host.media.duration) throw new Error('Connected host workflow proof is incomplete');
    const hostSeconds = Math.max(9.3, start.at - host.readyAt + 2.1);
    segments.push({ source: 'setup', from: host.readyAt, seconds: hostSeconds,
      title: '', body: '', evidence: 'host-ui', hostMode: host.mode as 'mock' | 'live', captions: [
        { from: .35, to: host.actions.find(row => row.action === 'queue:multiplier-cascade')!.at - host.readyAt + .2,
          step: 1, label: 'ADD GAMES', text: 'Click "+ Queue" to add games.' },
        { from: host.actions.find(row => row.action === 'queue:multiplier-cascade')!.at - host.readyAt + .2,
          to: start.at - host.readyAt - 1, step: 2, label: 'CHANGE THE ORDER', text: 'Drag the grip to change the order.' },
        { from: start.at - host.readyAt - 1, to: hostSeconds - .25, step: 3, label: 'START THE SHOW',
          text: 'Click "Start show" to begin.' }
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
  segments.push(lobby);
  function round(game: string) {
    const replacement = rounds.alternate?.[game];
    if (replacement) {
      if (replacement.game !== game || replacement.mode !== 'mock' || !replacement.normalSpeed
        || replacement.resultAt === undefined || !replacement.result || replacement.result.winner.kind === 'void') {
        throw new Error(`Invalid alternate ${game} recording`);
      }
      return { play: 0, result: replacement.resultAt };
    }
    const play = rounds.transitions.find(row => row.game === game && row.phase === 'PLAY');
    const result = rounds.transitions.find(row => row.game === game && row.phase === 'RESULT');
    if (!play || !result || result.wall <= play.wall) throw new Error(`Missing completed ${game} footage`);
    return { play: play.wall, result: result.wall };
  }
  function game(gameId: string, title: string, body: string, category: string) {
    const timing = round(gameId);
    const takes = rounds.reviewed?.[gameId];
    if (!takes?.length) throw new Error(`Reviewed event windows are missing for ${gameId}`);
    for (const [index, take] of takes.entries()) {
      const from = timing.play + take.offset;
      if (take.offset < 0 || from + take.seconds > timing.result + 2) {
        throw new Error(`Reviewed ${gameId} shot is outside its recorded round`);
      }
      segments.push({ source: rounds.alternate?.[gameId] ? 'alternate' : 'rounds', gameId, from, seconds: take.seconds,
        title: index ? '' : title, body: index ? '' : body,
        chapter: index ? undefined : new Set(segments.map(row => row.gameId).filter(Boolean)).size + 1,
        category, cues: take.cues ? structuredClone(take.cues) : undefined, evidence: 'mock' });
    }
  }
  segments.push({ source: 'section', from: 0, seconds: 2.2, title: 'MINIGAMES',
    body: 'EIGHT GAMES. JUST !JOIN.', evidence: 'project-files' });
  game('multiplier-cascade', 'MULTIPLIER CASCADE',
    'Multiply your supply.\nFirst team to five finishers wins.', 'TEAM MACHINE');
  game('peg-fever', 'PEG FEVER',
    'Three balls each.\nEvery landing multiplies its score.', 'INDIVIDUAL');
  game('marble-race', 'MARBLE RACE',
    'Leaders break gates.\nFollowers get an open lane.', 'INDIVIDUAL');
  const picks = [
    ['pong-wars', 'PONG WARS', 'Support a faction.\nMost tiles wins.', 'TEAM BATTLE'],
    ['light-cycles', 'LIGHT CYCLES', 'Trails become walls.\nLast cycle riding wins.', 'INDIVIDUAL'],
    ['ring-escape', 'RING RUN+', 'Escape five rings.\nFirst out or last survivor wins.', 'INDIVIDUAL']
  ];
  if (optional.length !== picks.length) throw new Error('Capture all three optional games before showing them.');
  for (const [gameId, title, body, category] of picks) {
    const capture = optional.find(row => row.game === gameId);
    if (!capture || capture.mode !== 'mock' || !capture.normalSpeed || capture.resultAt === undefined
      || !capture.result || capture.result.winner.kind === 'void' || capture.media.duration < 10) {
      throw new Error(`A completed normal-speed ${gameId} recording is required.`);
    }
    // Retained extras stop before their older result-card entrance.
    const from = gameId === 'light-cycles' ? 33.5 : capture.resultAt - 9.7;
    segments.push({ source: 'optional', gameId, category, title, body,
      chapter: new Set(segments.map(row => row.gameId).filter(Boolean)).size + 1,
      from, seconds: 9, evidence: 'mock' });
  }
  segments.push({ source: 'section', from: 0, seconds: 2.2, title: 'CHAT VS STREAMER',
    body: 'YOUR CHAT. YOUR OPPONENTS.', evidence: 'project-files' });
  game('hot-potato', 'HOT POTATO',
    'Pass the bomb.\nBeat the streamer before only three chatters remain.', 'CHAT VS STREAMER');
  game('blade-brawl', 'BLADE BRAWL',
    'Spinning weapons.\nChat takes on the streamer.', 'CHAT VS STREAMER');
  const winner = round('blade-brawl').result;
  segments.push({ source: 'rounds', from: winner + .3, seconds: 3.2,
    title: '', body: '', celebrate: true, evidence: 'mock' });
  segments.push({ source: 'outro', from: 0, seconds: 2.5, title: '', body: '', evidence: 'project-files' });
  let elapsed = 0;
  for (const segment of segments) {
    const reviewedFrom = segment.from;
    if (segment.source !== 'title' && segment.source !== 'outro') {
      segment.seconds = durationToBeat(elapsed, segment.seconds);
      if (segment.source === 'optional') {
        segment.from = Math.min(segment.from,
          optional.find(row => row.game === segment.gameId)!.media.duration - segment.seconds);
      } else if (segment.gameId) {
        segment.from = Math.min(segment.from, round(segment.gameId).result + 2 - segment.seconds);
      }
    }
    if (segment.source === 'setup' && segment.from + segment.seconds > host!.media.duration) {
      throw new Error('Host workflow recording ends before its reading hold');
    }
    for (const cue of segment.cues ?? []) {
      cue.at += reviewedFrom - segment.from;
      if (cue.at < 0 || cue.at + cue.seconds >= segment.seconds - .2) {
        throw new Error('A reviewed event would be truncated by this cut.');
      }
    }
    segment.reactions = eventReactions(segment);
    elapsed += segment.seconds;
  }
  if (segments.reduce((sum, row) => sum + row.seconds, 0) >= 180) throw new Error('Story cut must stay under three minutes');
  return segments;
}
