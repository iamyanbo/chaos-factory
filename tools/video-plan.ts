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
  source: 'cup' | 'live' | 'brief' | 'code' | 'review' | 'outro' | 'pending';
  from: number;
  seconds: number;
  title: string;
  body: string;
  evidence: 'mock' | 'real-chat' | 'project-files' | 'pending';
  card?: boolean;
}

export function submissionVideoPlan(cup: CupVideo, live?: JoinVideo, offlinePreview = false): VideoSegment[] {
  const segments: VideoSegment[] = [];
  function round(game: string) {
    const play = cup.transitions.find(row => row.game === game && row.phase === 'PLAY');
    const result = cup.transitions.find(row => row.game === game && row.phase === 'RESULT');
    if (!play || !result || result.wall <= play.wall) throw new Error(`Missing completed ${game} footage`);
    return { play: play.wall, result: result.wall, round: play.round };
  }
  function clip(game: string, title: string, body: string, from: number, seconds: number, card = true) {
    const available = cup.media.duration - from;
    if (from < 0 || available < 1) throw new Error('Clip falls outside the actual recording');
    segments.push({ source: 'cup', from, seconds: Math.min(seconds, available), title, body,
      evidence: 'mock', card });
  }
  function ending(game: string, title: string, body: string, seconds: number) {
    const timing = round(game);
    const from = Math.max(timing.play, timing.result - seconds + 3);
    clip(game, title, body, from, Math.min(seconds, timing.result + 3 - from));
  }
  const cascade = round('multiplier-cascade');
  clip('multiplier-cascade', 'CHAOS\nFACTORY', 'One join. Five games.\nA whole stream competing.', cascade.play + 12, 6);
  if (live?.mode === 'live' && live.joinedAt !== undefined && live.startedAt !== undefined && live.member) {
    const from = Math.max(0, live.joinedAt - 2);
    const seconds = Math.min(24, live.media.duration - from);
    if (seconds < 12) throw new Error('Real Twitch proof is too short');
    segments.push({ source: 'live', from, seconds, title: 'REAL TWITCH\nJOIN',
      body: `@${live.member.displayName ?? 'viewer'} sent !join.\nOne real player joined.\nHost start + countdown.\nStandard channel:\nNo channel-point wagers.`,
      evidence: 'real-chat', card: true });
  } else {
    if (!offlinePreview) throw new Error('Real Twitch join proof is missing; use --offline-preview for an explicitly labeled draft');
    segments.push({ source: 'pending', from: 0, seconds: 24, title: 'TWITCH PROOF\nPENDING',
      body: 'This cut uses simulated viewers.\nThe connector is implemented.\nA real !join rehearsal is still needed.\nThis is an offline preview.', evidence: 'pending' });
  }
  const split = cup.transitions.find(row => row.game === 'multiplier-cascade'
    && row.phase === 'PLAY' && row.stage === 1);
  clip('multiplier-cascade', 'MULTIPLIER\nCASCADE', 'Split the stream.\nRoute through the machine.\nFirst team to five finishers wins.',
    Math.min(split?.wall ?? cascade.play + 25, cascade.result - 14), 12);
  ending('multiplier-cascade', 'FIRST TO\nFIVE', 'The finish line decides it.\nEvery crossing is physical.', 12);
  ending('hot-potato', 'HOT\nPOTATO', 'The bomb passes on contact.\nKeep watching the fuse.\nLast survivor wins.', 18);
  const peg = round('peg-fever');
  const fever = cup.transitions.find(row => row.game === 'peg-fever' && row.phase === 'PLAY' && row.stage === 2);
  clip('peg-fever', 'PEG\nFEVER', 'Three balls per viewer.\nPermanent multiplier slots.\nLast orange peg doubles them.',
    Math.max(peg.play, Math.min((fever?.wall ?? peg.play + 20) + 1, peg.result - 13)), 12);
  ending('peg-fever', 'EVERY BALL\nCOUNTS', 'Each landing pays its own run.\nThe final landing ends the round.', 8);
  const race = round('marble-race');
  clip('marble-race', 'MARBLE\nRACE', 'Multiple connected routes.\nLeaders break gates open\nfor the chasing pack.', race.play + 3, 8);
  ending('marble-race', 'CHASE THE\nLEADER', 'The camera follows the leader.\nActual finish times decide places.', 14);
  const standings = cup.transitions.find(row => row.phase === 'STANDINGS' && row.round === 4);
  if (!standings) throw new Error('Fourth-round Cup standings are missing');
  clip('marble-race', '', '', standings.wall + 1, 6, false);
  ending('blade-brawl', 'GRAND\nFINAL', 'Four rounds earn Cup points.\nThe top eight face off.\nFinal survivor takes the Cup.', 14);
  const champion = cup.transitions.find(row => row.phase === 'CUP_RESULTS');
  if (!champion) throw new Error('The actual Cup champion screen is missing');
  clip('blade-brawl', '', '', champion.wall + .2, 5.4, false);
  for (const [source, seconds] of [['brief', 7], ['code', 7], ['review', 8]] as const) {
    segments.push({ source, seconds, from: 0, title: '', body: '', evidence: 'project-files' });
  }
  segments.push({ source: 'outro', from: 0, seconds: 6, title: '', body: '', evidence: 'project-files' });
  if (segments.reduce((sum, row) => sum + row.seconds, 0) >= 180) throw new Error('Submission cut must stay under three minutes');
  return segments;
}
