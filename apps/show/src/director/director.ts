import { Rng, RateLimit, TEAMS, type ChatGameInput, type CupState, type GameEvent, type LoggedInput,
  type Message, type Mode, type Phase, type RoundResult, type RoundSetup, type StreamerInput,
  type TeamId, type UserStats, type ViewerProfile } from '@chaos/shared';
import { games, cupGames, registry } from '../games/registry';
import { isDefaultGame, type GameContext, type GameDefinition, type GameInstance } from '../games/contract';
import type { HudState } from '../hud/hud';
import type { BestTakeResult } from '../kit/take-types';
import { Participants } from './participants';
import { Balance } from './balance';
import { Cup } from '../show-layer/cup';
import { Stages } from '../show-layer/stages';
import { TakeSearch } from './take-search';
import { audienceRoster, chooseGame, prepareLineup, roundRoster } from './roster';
import { enterPhase, advancePhase, settleRound, phaseDuration } from './round-flow';
import { configurePractice, practiceChat } from './practice-session';
import { receiveMessage } from './network';
import { handleCommand } from './commands';
import { advanceGame } from '../engine/game-clock';
import { readRaceSummary } from '../show-layer/race-summary';
import { celebrateResult } from '../kit/hype';
import { viewerColor } from '../kit/neon/identity';

export interface DirectorHooks {
  chooseTake?(setup: RoundSetup, signal: AbortSignal): Promise<BestTakeResult>;
  send(message: Message): boolean;
  context(definition: GameDefinition, setup: RoundSetup, emit: (event: GameEvent) => void): GameContext;
  announce(text: string, priority?: number): void;
  toast(text: string): void;
  feed(text: string): void;
  reset(): void;
  onResult?(result: RoundResult): void;
}
export type PracticeRole = 'boss' | 'chatter';
export interface PracticeSetup {
  gameId: string; mode: Mode; seed: number; bots: number; team: TeamId; role?: PracticeRole;
  capacity?: number; teamCount?: number; competition?: 'individual' | 'team'; format?: 'boss' | 'ffa' | 'faction';
}
export const PRACTICE_USER = 'offline-player';

/** The shared show clock owns phases and identity; plugins own all outcomes. */
export class Director {
  readonly games = games;
  readonly registry = registry;
  readonly capacities = new Map<string, number>();
  readonly cupShow = new Cup();
  readonly stages = new Stages();
  readonly search = new TakeSearch();
  readonly rng: Rng;
  phase: Phase = 'ATTRACT';
  phaseTime = 0;
  game: GameDefinition = games[0];
  instance?: GameInstance;
  ctx?: GameContext;
  initialSetup?: RoundSetup;
  mode: Mode = 'cvs';
  format?: 'boss' | 'ffa' | 'faction';
  competition: 'individual' | 'team' = 'individual';
  modeOverride: 'auto' | Mode = 'auto';
  cup: CupState = { round: 0, rounds: 5, chat: 0, streamer: 0, teams: {} };
  participants = new Participants();
  balance = new Balance();
  enabled = new Set(cupGames.filter(isDefaultGame).map(game => game.id));
  queue: string[] = [];
  finalists: string[] = [];
  results: RoundResult[] = [];
  predictions: import('@chaos/shared').Prediction[] = [];
  inputs: LoggedInput[] = [];
  profiles: Record<string, ViewerProfile> = Object.create(null);
  profileCrownId?: string;
  stats: Record<string, UserStats> = Object.create(null);
  seenReturns = new Set<string>();
  modifiers: string[] = [];
  paused = false;
  autopilot = true;
  wagers = true;
  canPredict = true;
  noWagers = false;
  connected = false;
  bridgeMode: 'mock' | 'live' = 'mock';
  streamerName = 'Streamer';
  prediction?: import('@chaos/shared').Prediction;
  predictionUsers: string[] = [];
  predictionTitles: string[] = [];
  result?: RoundResult;
  record?: import('@chaos/shared').CupRoundRecord;
  recorded = false;
  roundId = '';
  roundSeed = 1;
  roundCapacity = 0;
  mockCount = 60;
  betWindow = 30;
  roundStart: 'automatic' | 'manual' = 'automatic';
  roundStartChosen = false;
  waitingForHost = false;
  clock = 0;
  tick = 0;
  stateClock = 0;
  takePending = false;
  bestTake?: BestTakeResult;
  practiceJoined = false;
  practiceRole: PracticeRole = 'chatter';
  lastStreamerInput?: StreamerInput;
  limits = new RateLimit();
  volume = .5;
  musicEnabled = true;
  transparent = false;
  safeZone = { x: 1440, y: 810, w: 480, h: 270 };
  showSafeZone = false;
  notifications: { text: string; until: number }[] = [];
  payoffRemaining = 0;

  constructor(readonly hooks: DirectorHooks, readonly options: {
    fast?: boolean; demo?: boolean; practice?: boolean; skipCountdown?: boolean; seed?: number; game?: string;
    competition?: 'individual' | 'team'; format?: 'boss' | 'ffa' | 'faction';
  } = {}) {
    this.rng = new Rng(options.seed ?? 20261024);
    this.game = registry.get(options.game ?? '') ?? games[0];
    this.format = options.format ?? this.game.formats?.[0];
    this.mode = this.format === 'faction' ? 'faction' : 'cvs';
    this.competition = this.format === 'ffa' ? 'individual' : 'team';
    this.participants.fill(this.mockCount, 0);
    this.cupShow.reset();
    this.preview();
  }

  capacityFor(id = this.game.id): number { return this.capacities.get(id) ?? registry.get(id)!.maxParticipants; }
  get capacity(): number { return this.roundCapacity || this.capacityFor(); }
  queuePosition(id: string): number {
    return this.participants.queuePosition(id, ['RESULT', 'STANDINGS', 'CUP_RESULTS'].includes(this.phase)
      ? [] : this.ctx?.setup.participants.map(user => user.userId) ?? []);
  }
  setCapacity(id: string, limit: number): void {
    const game = registry.get(id);
    if (game?.joinOnly && Number.isFinite(limit)) this.capacities.set(id, Math.max(1, Math.min(game.maxParticipants, Math.floor(limit))));
  }

  preview(newSeed = true): void {
    this.cupShow.streamerName = this.streamerName;
    this.destroyGame();
    this.participants.capTeams(this.game.maxTeams ?? 6);
    this.roundCapacity = this.capacityFor();
    if (newSeed && !this.options.practice) this.roundSeed = this.rng.int(1, 2147483647);
    const setup: RoundSetup = { format: this.format, mode: this.mode, competition: this.competition,
      seed: this.roundSeed, gameId: this.game.id, difficulty: .5, modifiers: [],
      participants: roundRoster(this), audience: audienceRoster(this), teams: this.participants.teams,
      crownUserId: this.cupShow.crownUserId, streamerName: this.streamerName };
    this.initialSetup = structuredClone(setup);
    this.ctx = this.hooks.context(this.game, setup, event => this.event(event));
    this.instance = this.game.create(this.ctx);
    this.tick = 0;
    this.payoffRemaining = 0;
    this.inputs = [];
    this.limits = new RateLimit();
    this.stages.reset(this.game.id);
  }

  start(_rounds = 5): void {
    if (!['ATTRACT', 'CUP_RESULTS'].includes(this.phase)) return;
    this.cup = { round: 1, rounds: 5, chat: 0, streamer: 0, teams: {} };
    this.cupShow.reset(this.cupShow.crownUserId);
    this.results = [];
    this.predictions = [];
    this.seenReturns.clear();
    this.participants.fill(this.mockCount, this.clock);
    this.paused = false;
    prepareLineup(this);
    chooseGame(this);
    this.enter('INTRO');
  }
  startPractice(setup: PracticeSetup): void { configurePractice(this, setup); }
  practiceChat(text: string, _wholeTeam = false): void { practiceChat(this, text); }
  beginPracticeRound(): void { this.prepareTake(); }
  prepareTake(): void { this.search.prepare(this); }
  enter(phase: Phase): void { enterPhase(this, phase); }
  select(): void { chooseGame(this); }
  settle(): void { settleRound(this); }
  receive(message: Message): void { receiveMessage(this, message); }
  command(message: Extract<Message, { type: 'director.command' }>): void { handleCommand(this, message); }
  streamer(_input: StreamerInput, _bot = false): void { /* All games are automatic. */ }

  frame(dt: number): void {
    this.clock += dt;
    this.stateClock += dt;
    this.notifications = this.notifications.filter(row => row.until > this.clock);
    if (this.stateClock >= .25) { this.stateClock = 0; this.broadcast(); }
    if (this.paused) return;
    if (this.waitingForHost) return;
    this.phaseTime += dt;
    if (this.phase === 'PLAY' && this.result && this.payoffRemaining > 0) {
      this.payoffRemaining = Math.max(0, this.payoffRemaining - dt);
      if (!this.payoffRemaining) this.enter('RESULT');
      return;
    }
    if (this.options.practice && ['RESULT', 'LOBBY_BET'].includes(this.phase)) return;
    if (this.takePending) return;
    advancePhase(this);
  }

  step(dt: number): void {
    if (this.paused || this.takePending || !this.instance) return;
    if (this.phase === 'ATTRACT') return;
    if (this.phase !== 'PLAY') return;
    if (this.result) return;
    if (!this.game.spectator && !this.game.audienceIndependent && !this.ctx?.setup.participants.length) return;
    this.tick++;
    try {
      this.ctx?.hype.at(this.tick / 60);
      advanceGame(this.instance, dt, this.tick / 60);
      this.stages.update(this.tick / 60, this.instance);
      const status = this.instance.status();
      if (typeof status === 'object' && 'done' in status) {
        this.result = status.done;
        if (this.bestTake) this.result.bestTake = structuredClone(this.bestTake);
        this.result.replay = { seed: this.roundSeed, inputs: this.inputs, setup: structuredClone(this.initialSetup!) };
        if (this.ctx) celebrateResult(this.ctx, this.result, this.ctx.camera.target);
        this.payoffRemaining = this.options.fast || this.ctx?.headless || this.result.winner.kind === 'void' ? 0 : 2;
        if (!this.payoffRemaining) this.enter('RESULT');
      }
    } catch (error) {
      this.notify(`Round recovered: ${String(error).slice(0, 100)}`);
      this.void('Game error - all bets refunded');
    }
  }

  private event(event: GameEvent): void {
    if (this.phase !== 'PLAY') return;
    for (const text of this.cupShow.event(event)) {
      this.notify(text);
      if (text.includes('DETHRONED') && this.ctx) {
        this.ctx.hype.callout(this.ctx.camera.target.x, this.ctx.camera.target.y, { text: 'DETHRONED' });
      }
    }
    if (event.t === 'moment') this.notify(event.text);
  }
  notify(text: string): void {
    this.notifications.push({ text, until: this.clock + 4 });
    this.notifications = this.notifications.slice(-3);
    this.hooks.toast(text);
  }
  render(alpha: number): void { this.instance?.render(this.result ? 1 : alpha); }
  connection(connected: boolean): void {
    this.connected = connected;
    if (!connected) { this.noWagers = true; this.notify('BRIDGE OFFLINE - PHYSICS CONTINUES'); }
  }
  void(reason: string): void {
    if (['ATTRACT', 'RESULT', 'STANDINGS', 'CUP_RESULTS'].includes(this.phase)) return;
    this.search.cancel(this);
    this.result = { winner: { kind: 'void', reason }, mvps: [], highlights: [], perUser: {},
      replay: { seed: this.roundSeed, inputs: this.inputs, setup: this.initialSetup } };
    this.enter('RESULT');
  }
  timeLeft(): number {
    if (this.waitingForHost) return 0;
    if (this.phase === 'PLAY') return this.game.durationSec.target - this.tick / 60;
    const duration = phaseDuration(this);
    return Number.isFinite(duration) ? Math.max(0, duration - this.phaseTime * (this.options.fast ? 10 : 1)) : 0;
  }
  broadcast(): void {
    this.hooks.send({ type: 'director.state', musicEnabled: this.musicEnabled, phase: this.phase, gameId: this.game.id, mode: this.mode,
      timeLeft: this.timeLeft(), cup: { ...this.cup, standings: this.cupShow.standings(this.profiles),
        championId: this.cupShow.championId, grandFinal: this.cup.round === 5 }, participants: this.ctx?.setup.participants.length ?? 0,
      capacity: this.game.spectator ? undefined : this.capacity, capacities: Object.fromEntries(this.capacities),
      waiting: this.participants.crowd, roundStart: this.roundStart, waitingForHost: this.waitingForHost,
      preparingRound: this.takePending, difficulty: .5, paused: this.paused, verbs: ['join'], controls: [],
      queue: this.queue, modifiers: [], roundSeed: this.roundSeed, teams: this.participants.teams });
  }
  view(): HudState {
    return { selectingTake: this.takePending, waitingForHost: this.waitingForHost,
      streamerName: this.ctx?.setup.streamerName ?? this.streamerName,
      roundCompetition: this.competition, practice: this.options.practice,
      practiceRole: this.practiceRole, practiceTeam: this.participants.members.get(PRACTICE_USER)?.teamId,
      localJoined: this.ctx?.setup.participants.some(user => user.userId === PRACTICE_USER),
      participantNames: Object.fromEntries((this.ctx?.setup.participants ?? []).map(user => [user.userId, user.displayName])),
      participantColors: Object.fromEntries((this.ctx?.setup.participants ?? []).map(user =>
        [user.displayName, this.mode === 'faction' && user.teamId ? TEAMS[user.teamId].hex : viewerColor(user)])),
      phase: this.phase, timeLeft: this.timeLeft(), cup: this.cup, game: this.game, mode: this.mode,
      paused: this.paused, participants: this.ctx?.setup.participants.length ?? 0, capacity: this.capacity,
      crowd: this.participants.crowd, prediction: this.prediction, noWagers: this.noWagers, connected: this.connected,
      result: this.result, modifiers: [], wheel: [], votes: [], autopilot: true, safeZone: this.safeZone,
      showSafeZone: this.showSafeZone, cupMvps: [], show: {
        raceSummary: this.result && this.game.id === 'marble-race' ? readRaceSummary(this.instance) : undefined,
        round: this.cup.round, rounds: this.cup.rounds, phaseTime: this.phaseTime * (this.options.fast ? 10 : 1),
        grandFinal: this.cup.round === 5 && !this.options.practice,
        standings: this.cupShow.standings(this.profiles), podium: this.cupShow.awards.slice(0, 3),
        roundAwards: this.cupShow.awards,
        qualified: this.finalists, championId: this.cupShow.championId,
        crownName: this.cupShow.crownUserId ? this.profiles[this.cupShow.crownUserId]?.displayName ?? this.cupShow.name(this.cupShow.crownUserId) : undefined,
        lastWinner: this.cupShow.lastWinners[this.game.id],
        nextGameTitle: this.cup.round === 4 ? this.registry.get('blade-brawl')?.title : this.registry.get(this.queue[0])?.title,
        question: this.cup.round === 5 ? 'Who takes the Cup?' : this.game.predictionTitle(this.ctx!.setup),
        stages: this.stages.rows, stageIndex: this.stages.index, elapsed: this.tick / 60,
        notifications: this.notifications.map(row => row.text)
      } };
  }
  destroyGame(): void {
    try { this.instance?.destroy(); } catch (error) { this.notify(`Cleanup recovered: ${String(error).slice(0, 80)}`); }
    this.ctx?.physics.destroy();
    this.instance = undefined;
    this.ctx = undefined;
    this.hooks.reset();
  }
  destroy(): void { this.search.cancel(this); this.destroyGame(); }
}
